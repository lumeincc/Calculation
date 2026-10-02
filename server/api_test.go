package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
)

type client struct {
	t     *testing.T
	srv   *httptest.Server
	token string
}

func newServer(t *testing.T) *httptest.Server {
	store, err := OpenStore(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { store.Close() })
	api := NewAPI(store, []string{"https://site.example"})
	api.limiter = newLimiter(1000, 1) // tests make many auth calls
	mux := http.NewServeMux()
	api.Routes(mux)
	srv := httptest.NewServer(api.CORS(mux))
	t.Cleanup(srv.Close)
	return srv
}

func (c *client) do(method, path string, body any) (int, map[string]any) {
	c.t.Helper()
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	req, _ := http.NewRequest(method, c.srv.URL+path, &buf)
	req.Header.Set("Content-Type", "application/json")
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		c.t.Fatal(err)
	}
	defer res.Body.Close()
	out := map[string]any{}
	_ = json.NewDecoder(res.Body).Decode(&out)
	return res.StatusCode, out
}

func register(t *testing.T, srv *httptest.Server, body map[string]any) *client {
	c := &client{t: t, srv: srv}
	code, out := c.do("POST", "/api/auth/register", body)
	if code != 200 {
		t.Fatalf("register: %d %v", code, out)
	}
	c.token = out["token"].(string)
	return c
}

func TestTeamSharesEstimatesWithVersioning(t *testing.T) {
	srv := newServer(t)
	owner := register(t, srv, map[string]any{"email": "Boss@Firm.kz", "password": "secret123", "name": "Бекзат", "company": "ТОО Каскад"})

	_, me := owner.do("GET", "/api/me", nil)
	ws := me["workspace"].(map[string]any)
	if ws["name"] != "ТОО Каскад" || ws["inviteCode"] == "" {
		t.Fatalf("workspace: %v", ws)
	}

	// A colleague joins with the invite code and sees no invite code (not an owner).
	worker := register(t, srv, map[string]any{"email": "worker@firm.kz", "password": "secret123", "name": "Айгерим", "invite": ws["inviteCode"]})
	_, wme := worker.do("GET", "/api/me", nil)
	if wme["workspace"].(map[string]any)["id"] != ws["id"] || wme["workspace"].(map[string]any)["inviteCode"] != nil {
		t.Fatalf("worker workspace: %v", wme["workspace"])
	}
	if n := len(wme["members"].([]any)); n != 2 {
		t.Fatalf("members: %d", n)
	}

	// Owner creates an estimate, worker sees it.
	id := "0f8fad5b-d9cb-469f-a165-70867728950e"
	code, out := owner.do("PUT", "/api/estimates/"+id, map[string]any{"version": 0, "data": map[string]any{"name": "Ангар"}})
	if code != 200 || out["version"].(float64) != 1 {
		t.Fatalf("create: %d %v", code, out)
	}
	_, list := worker.do("GET", "/api/estimates?since=0", nil)
	items := list["items"].([]any)
	if len(items) != 1 || items[0].(map[string]any)["data"].(map[string]any)["name"] != "Ангар" {
		t.Fatalf("list: %v", list)
	}

	// Worker edits version 1 → 2; owner's stale write on version 1 conflicts.
	if code, _ := worker.do("PUT", "/api/estimates/"+id, map[string]any{"version": 1, "data": map[string]any{"name": "Ангар v2"}}); code != 200 {
		t.Fatalf("worker edit: %d", code)
	}
	code, out = owner.do("PUT", "/api/estimates/"+id, map[string]any{"version": 1, "data": map[string]any{"name": "Ангар (мой)"}})
	if code != 409 || out["current"].(map[string]any)["data"].(map[string]any)["name"] != "Ангар v2" {
		t.Fatalf("conflict: %d %v", code, out)
	}

	// Deletion leaves a tombstone visible to sync.
	if code, _ := owner.do("DELETE", "/api/estimates/"+id, nil); code != 200 {
		t.Fatalf("delete: %d", code)
	}
	_, list = worker.do("GET", "/api/estimates?since=0", nil)
	if !list["items"].([]any)[0].(map[string]any)["deleted"].(bool) {
		t.Fatalf("tombstone: %v", list)
	}

	// Shared documents: prices.
	if code, _ := worker.do("PUT", "/api/docs/prices", map[string]any{"version": 0, "data": map[string]any{"overrides": map[string]any{"cement": 60}}}); code != 200 {
		t.Fatalf("put doc: %d", code)
	}
	_, doc := owner.do("GET", "/api/docs/prices", nil)
	if doc["version"].(float64) != 1 || doc["data"].(map[string]any)["overrides"].(map[string]any)["cement"].(float64) != 60 {
		t.Fatalf("doc: %v", doc)
	}
	if code, _ := owner.do("GET", "/api/docs/secrets", nil); code != 404 {
		t.Fatalf("unknown doc key: %d", code)
	}
}

func TestIsolationAndAuth(t *testing.T) {
	srv := newServer(t)
	a := register(t, srv, map[string]any{"email": "a@a.kz", "password": "secret123"})
	b := register(t, srv, map[string]any{"email": "b@b.kz", "password": "secret123"})
	id := "11111111-2222-3333-4444-555555555555"
	a.do("PUT", "/api/estimates/"+id, map[string]any{"version": 0, "data": map[string]any{"name": "A"}})
	_, list := b.do("GET", "/api/estimates?since=0", nil)
	if len(list["items"].([]any)) != 0 {
		t.Fatal("another company must not see estimates")
	}
	// Same id in another workspace is a different record.
	if code, _ := b.do("PUT", "/api/estimates/"+id, map[string]any{"version": 0, "data": map[string]any{"name": "B"}}); code != 200 {
		t.Fatal("ids are scoped by workspace")
	}

	anon := &client{t: t, srv: srv}
	if code, _ := anon.do("GET", "/api/estimates", nil); code != 401 {
		t.Fatal("anonymous access must be refused")
	}
	if code, _ := anon.do("POST", "/api/auth/login", map[string]any{"email": "a@a.kz", "password": "wrong-pass"}); code != 401 {
		t.Fatal("wrong password must be refused")
	}
	if code, _ := anon.do("POST", "/api/auth/register", map[string]any{"email": "A@a.kz", "password": "secret123"}); code != 409 {
		t.Fatal("duplicate email (case-insensitive) must be refused")
	}
	if code, _ := anon.do("POST", "/api/auth/register", map[string]any{"email": "c@c.kz", "password": "short"}); code != 400 {
		t.Fatal("short password must be refused")
	}
	if code, _ := anon.do("POST", "/api/auth/register", map[string]any{"email": "d@d.kz", "password": "secret123", "invite": "NOPE-NOPE"}); code != 400 {
		t.Fatal("bad invite must be refused")
	}
	code, out := anon.do("POST", "/api/auth/login", map[string]any{"email": "A@A.KZ", "password": "secret123"})
	if code != 200 || out["token"] == "" {
		t.Fatal("login is case-insensitive by email")
	}
	a.do("POST", "/api/auth/logout", nil)
	if code, _ := a.do("GET", "/api/me", nil); code != 401 {
		t.Fatal("logout must revoke the token")
	}
}

func TestOwnerManagesTeam(t *testing.T) {
	srv := newServer(t)
	owner := register(t, srv, map[string]any{"email": "o@o.kz", "password": "secret123"})
	_, me := owner.do("GET", "/api/me", nil)
	code1 := me["workspace"].(map[string]any)["inviteCode"].(string)
	worker := register(t, srv, map[string]any{"email": "w@o.kz", "password": "secret123", "invite": code1})
	if code, _ := worker.do("POST", "/api/workspace/invite", nil); code != 403 {
		t.Fatal("only owner rotates invites")
	}
	_, out := owner.do("POST", "/api/workspace/invite", nil)
	if out["inviteCode"] == code1 {
		t.Fatal("invite must change")
	}
	_, wme := worker.do("GET", "/api/me", nil)
	wid := wme["user"].(map[string]any)["id"].(string)
	if code, _ := owner.do("DELETE", "/api/workspace/members/"+wid, nil); code != 200 {
		t.Fatal("owner removes member")
	}
	if code, _ := worker.do("GET", "/api/me", nil); code != 401 {
		t.Fatal("removed member loses access")
	}
}

func TestCORS(t *testing.T) {
	srv := newServer(t)
	req, _ := http.NewRequest("OPTIONS", srv.URL+"/api/me", nil)
	req.Header.Set("Origin", "https://site.example")
	res, _ := http.DefaultClient.Do(req)
	if res.Header.Get("Access-Control-Allow-Origin") != "https://site.example" {
		t.Fatal("allowed origin")
	}
	req.Header.Set("Origin", "https://evil.example")
	res, _ = http.DefaultClient.Do(req)
	if res.Header.Get("Access-Control-Allow-Origin") != "" {
		t.Fatal("foreign origin must not be allowed")
	}
}
