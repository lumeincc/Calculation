package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"net/mail"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
)

const sessionTTL = 90 * 24 * time.Hour
const maxBody = 8 << 20

// Shared workspace documents that clients may read and write.
var docKeys = map[string]bool{"prices": true, "company": true, "estimateDefaults": true, "metalCost": true}

var idRe = regexp.MustCompile(`^[A-Za-z0-9-]{8,64}$`)

type API struct {
	store   *Store
	origins map[string]bool
	limiter *limiter
}

func NewAPI(store *Store, origins []string) *API {
	o := map[string]bool{}
	for _, x := range origins {
		if x = strings.TrimRight(strings.TrimSpace(x), "/"); x != "" {
			o[x] = true
		}
	}
	return &API{store: store, origins: o, limiter: newLimiter(10, time.Minute)}
}

func (a *API) Routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) { writeJSON(w, 200, map[string]any{"ok": true}) })
	mux.HandleFunc("POST /api/auth/register", a.register)
	mux.HandleFunc("POST /api/auth/login", a.login)
	mux.HandleFunc("POST /api/auth/logout", a.auth(a.logout))
	mux.HandleFunc("GET /api/me", a.auth(a.me))
	mux.HandleFunc("PATCH /api/workspace", a.auth(a.ownerOnly(a.renameWorkspace)))
	mux.HandleFunc("POST /api/workspace/invite", a.auth(a.ownerOnly(a.rotateInvite)))
	mux.HandleFunc("DELETE /api/workspace/members/{id}", a.auth(a.ownerOnly(a.removeMember)))
	mux.HandleFunc("GET /api/estimates", a.auth(a.listEstimates))
	mux.HandleFunc("PUT /api/estimates/{id}", a.auth(a.putEstimate))
	mux.HandleFunc("DELETE /api/estimates/{id}", a.auth(a.deleteEstimate))
	mux.HandleFunc("GET /api/docs/{key}", a.auth(a.getDoc))
	mux.HandleFunc("PUT /api/docs/{key}", a.auth(a.putDoc))
}

// CORS lets the static site (e.g. GitHub Pages) talk to the API. Tokens travel in the
// Authorization header, so no cookies and no CSRF surface.
func (a *API) CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if origin := r.Header.Get("Origin"); origin != "" && (a.origins["*"] || a.origins[origin]) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Max-Age", "600")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

type ctxKey struct{}

func userFrom(r *http.Request) User { return r.Context().Value(ctxKey{}).(User) }

func (a *API) auth(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
		if !ok || token == "" {
			writeErr(w, 401, "Нужно войти в аккаунт")
			return
		}
		u, err := a.store.UserBySession(r.Context(), token)
		if err != nil {
			writeErr(w, 401, "Сессия истекла — войдите снова")
			return
		}
		h(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, u)))
	}
}

func (a *API) ownerOnly(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if userFrom(r).Role != "owner" {
			writeErr(w, 403, "Это может сделать только владелец компании")
			return
		}
		h(w, r)
	}
}

type authResponse struct {
	Token     string    `json:"token"`
	User      User      `json:"user"`
	Workspace Workspace `json:"workspace"`
}

func (a *API) register(w http.ResponseWriter, r *http.Request) {
	if !a.limiter.allow(clientIP(r)) {
		writeErr(w, 429, "Слишком много попыток, подождите минуту")
		return
	}
	var in struct {
		Email, Password, Name, Company, Invite string
	}
	if !readJSON(w, r, &in) {
		return
	}
	email := strings.ToLower(strings.TrimSpace(in.Email))
	if _, err := mail.ParseAddress(email); err != nil {
		writeErr(w, 400, "Укажите корректный e-mail")
		return
	}
	if len([]rune(in.Password)) < 8 {
		writeErr(w, 400, "Пароль должен быть не короче 8 символов")
		return
	}
	name := strings.TrimSpace(in.Name)
	if name == "" {
		name = strings.Split(email, "@")[0]
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
	if err != nil {
		writeErr(w, 500, "Ошибка сервера")
		return
	}
	ctx := r.Context()
	tx, err := a.store.db.BeginTx(ctx, nil)
	if err != nil {
		writeErr(w, 500, "Ошибка сервера")
		return
	}
	defer tx.Rollback()
	var ws Workspace
	role := "owner"
	if code := strings.ToUpper(strings.TrimSpace(in.Invite)); code != "" {
		ws, err = a.store.WorkspaceByInvite(ctx, tx, code)
		if err != nil {
			writeErr(w, 400, "Код приглашения не найден")
			return
		}
		role = "member"
	} else {
		company := strings.TrimSpace(in.Company)
		if company == "" {
			company = "Моя компания"
		}
		if ws, err = a.store.CreateWorkspace(ctx, tx, company); err != nil {
			writeErr(w, 500, "Ошибка сервера")
			return
		}
	}
	u := User{ID: newID(), Email: email, Name: name, WorkspaceID: ws.ID, Role: role, passHash: hash}
	if err := a.store.CreateUser(ctx, tx, u); err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			writeErr(w, 409, "Пользователь с таким e-mail уже есть — войдите")
			return
		}
		writeErr(w, 500, "Ошибка сервера")
		return
	}
	if err := tx.Commit(); err != nil {
		writeErr(w, 500, "Ошибка сервера")
		return
	}
	a.issue(w, r, u, ws)
}

func (a *API) login(w http.ResponseWriter, r *http.Request) {
	if !a.limiter.allow(clientIP(r)) {
		writeErr(w, 429, "Слишком много попыток, подождите минуту")
		return
	}
	var in struct{ Email, Password string }
	if !readJSON(w, r, &in) {
		return
	}
	u, err := a.store.UserByEmail(r.Context(), strings.ToLower(strings.TrimSpace(in.Email)))
	if err != nil || bcrypt.CompareHashAndPassword(u.passHash, []byte(in.Password)) != nil {
		writeErr(w, 401, "Неверный e-mail или пароль")
		return
	}
	ws, err := a.store.Workspace(r.Context(), u.WorkspaceID)
	if err != nil {
		writeErr(w, 500, "Ошибка сервера")
		return
	}
	a.issue(w, r, u, ws)
}

func (a *API) issue(w http.ResponseWriter, r *http.Request, u User, ws Workspace) {
	token, err := a.store.CreateSession(r.Context(), u.ID, sessionTTL)
	if err != nil {
		writeErr(w, 500, "Ошибка сервера")
		return
	}
	if u.Role != "owner" {
		ws.InviteCode = ""
	}
	writeJSON(w, 200, authResponse{Token: token, User: u, Workspace: ws})
}

func (a *API) logout(w http.ResponseWriter, r *http.Request) {
	token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	_ = a.store.DeleteSession(r.Context(), token)
	writeJSON(w, 200, map[string]any{"ok": true})
}

func (a *API) me(w http.ResponseWriter, r *http.Request) {
	u := userFrom(r)
	ws, err := a.store.Workspace(r.Context(), u.WorkspaceID)
	if err != nil {
		writeErr(w, 500, "Ошибка сервера")
		return
	}
	if u.Role != "owner" {
		ws.InviteCode = ""
	}
	members, err := a.store.Members(r.Context(), u.WorkspaceID)
	if err != nil {
		writeErr(w, 500, "Ошибка сервера")
		return
	}
	writeJSON(w, 200, map[string]any{"user": u, "workspace": ws, "members": members})
}

func (a *API) renameWorkspace(w http.ResponseWriter, r *http.Request) {
	var in struct{ Name string }
	if !readJSON(w, r, &in) {
		return
	}
	name := strings.TrimSpace(in.Name)
	if name == "" || len([]rune(name)) > 200 {
		writeErr(w, 400, "Укажите название компании")
		return
	}
	if err := a.store.RenameWorkspace(r.Context(), userFrom(r).WorkspaceID, name); err != nil {
		writeErr(w, 500, "Ошибка сервера")
		return
	}
	writeJSON(w, 200, map[string]any{"name": name})
}

func (a *API) rotateInvite(w http.ResponseWriter, r *http.Request) {
	code, err := a.store.RotateInvite(r.Context(), userFrom(r).WorkspaceID)
	if err != nil {
		writeErr(w, 500, "Ошибка сервера")
		return
	}
	writeJSON(w, 200, map[string]any{"inviteCode": code})
}

func (a *API) removeMember(w http.ResponseWriter, r *http.Request) {
	if err := a.store.RemoveMember(r.Context(), userFrom(r).WorkspaceID, r.PathValue("id")); err != nil {
		writeErr(w, 404, "Сотрудник не найден")
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}

type recordJSON struct {
	Record
	Data json.RawMessage `json:"data,omitempty"`
}

func toJSON(r Record) recordJSON { return recordJSON{Record: r, Data: json.RawMessage(r.Data)} }

func (a *API) listEstimates(w http.ResponseWriter, r *http.Request) {
	since, _ := strconv.ParseInt(r.URL.Query().Get("since"), 10, 64)
	// Read the clock before querying so nothing written meanwhile is missed next time.
	now := nowMs()
	recs, err := a.store.EstimatesSince(r.Context(), userFrom(r).WorkspaceID, since)
	if err != nil {
		writeErr(w, 500, "Ошибка сервера")
		return
	}
	items := make([]recordJSON, len(recs))
	for i, rec := range recs {
		items[i] = toJSON(rec)
	}
	writeJSON(w, 200, map[string]any{"items": items, "now": now})
}

type putBody struct {
	Version int64           `json:"version"`
	Data    json.RawMessage `json:"data"`
}

func (a *API) putEstimate(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !idRe.MatchString(id) {
		writeErr(w, 400, "Некорректный идентификатор")
		return
	}
	var in putBody
	if !readJSON(w, r, &in) {
		return
	}
	if !json.Valid(in.Data) || len(in.Data) == 0 || in.Data[0] != '{' {
		writeErr(w, 400, "Некорректные данные сметы")
		return
	}
	u := userFrom(r)
	rec, err := a.store.PutEstimate(r.Context(), u.WorkspaceID, id, in.Version, in.Data, u.Name, false)
	a.writeVersioned(w, rec, err)
}

func (a *API) deleteEstimate(w http.ResponseWriter, r *http.Request) {
	u := userFrom(r)
	id := r.PathValue("id")
	cur, err := a.store.GetEstimate(r.Context(), u.WorkspaceID, id)
	if errors.Is(err, ErrNotFound) {
		writeJSON(w, 200, map[string]any{"ok": true})
		return
	}
	if err != nil {
		writeErr(w, 500, "Ошибка сервера")
		return
	}
	// Soft delete keeps a tombstone so other devices learn about the deletion.
	rec, err := a.store.PutEstimate(r.Context(), u.WorkspaceID, id, cur.Version, []byte("{}"), u.Name, true)
	a.writeVersioned(w, rec, err)
}

func (a *API) getDoc(w http.ResponseWriter, r *http.Request) {
	key := r.PathValue("key")
	if !docKeys[key] {
		writeErr(w, 404, "Неизвестный документ")
		return
	}
	rec, err := a.store.GetDoc(r.Context(), userFrom(r).WorkspaceID, key)
	if errors.Is(err, ErrNotFound) {
		writeJSON(w, 200, map[string]any{"id": key, "version": 0})
		return
	}
	if err != nil {
		writeErr(w, 500, "Ошибка сервера")
		return
	}
	writeJSON(w, 200, toJSON(rec))
}

func (a *API) putDoc(w http.ResponseWriter, r *http.Request) {
	key := r.PathValue("key")
	if !docKeys[key] {
		writeErr(w, 404, "Неизвестный документ")
		return
	}
	var in putBody
	if !readJSON(w, r, &in) {
		return
	}
	if !json.Valid(in.Data) || len(in.Data) == 0 {
		writeErr(w, 400, "Некорректные данные")
		return
	}
	u := userFrom(r)
	rec, err := a.store.PutDoc(r.Context(), u.WorkspaceID, key, in.Version, in.Data, u.Name)
	a.writeVersioned(w, rec, err)
}

func (a *API) writeVersioned(w http.ResponseWriter, rec Record, err error) {
	switch {
	case errors.Is(err, ErrConflict):
		writeJSON(w, 409, map[string]any{"error": "Документ изменил другой пользователь", "current": toJSON(rec)})
	case err != nil:
		log.Printf("write: %v", err)
		writeErr(w, 500, "Ошибка сервера")
	default:
		writeJSON(w, 200, toJSON(Record{ID: rec.ID, Version: rec.Version, UpdatedAt: rec.UpdatedAt, UpdatedBy: rec.UpdatedBy, Deleted: rec.Deleted}))
	}
}

func readJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBody))
	if err := dec.Decode(v); err != nil {
		writeErr(w, 400, "Некорректный запрос")
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]any{"error": msg})
}

func clientIP(r *http.Request) string {
	if xf := r.Header.Get("X-Forwarded-For"); xf != "" {
		return strings.TrimSpace(strings.Split(xf, ",")[0])
	}
	host := r.RemoteAddr
	if i := strings.LastIndexByte(host, ':'); i > 0 {
		host = host[:i]
	}
	return host
}

// limiter is a fixed-window counter per IP for login/registration attempts.
type limiter struct {
	mu     sync.Mutex
	max    int
	window time.Duration
	hits   map[string][]time.Time
}

func newLimiter(max int, window time.Duration) *limiter {
	return &limiter{max: max, window: window, hits: map[string][]time.Time{}}
}

func (l *limiter) allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	recent := l.hits[key][:0]
	for _, t := range l.hits[key] {
		if now.Sub(t) < l.window {
			recent = append(recent, t)
		}
	}
	if len(recent) >= l.max {
		l.hits[key] = recent
		return false
	}
	l.hits[key] = append(recent, now)
	return true
}
