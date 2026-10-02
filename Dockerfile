# One image with everything: the frontend is built and embedded into the Go binary.
FROM node:22-alpine AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM golang:1.26-alpine AS server
WORKDIR /src
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server/ ./
COPY --from=web /app/dist/ ./web/
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/stroyraschet .

FROM alpine:3.22
RUN adduser -D -h /app app && mkdir -p /data && chown app /data
USER app
COPY --from=server /out/stroyraschet /app/stroyraschet
ENV PORT=8080 DB_PATH=/data/stroyraschet.db
VOLUME ["/data"]
EXPOSE 8080
ENTRYPOINT ["/app/stroyraschet"]
