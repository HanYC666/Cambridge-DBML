# Pi Zero W Deployment

This server only serves the browser application. It stores no SQL, database
files, sessions, uploads, or user data. `POST`, `PUT`, `PATCH`, `DELETE`, and
every other non-read method return `405 Method Not Allowed`.

Build the static site first, then compile the self-contained Linux ARM binary:

```sh
cd github-static
npm ci
npm run build
cd ..
mkdir -p build
GOOS=linux GOARCH=arm GOARM=6 CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o build/cambridge-dbml-armv6 .
```

Copy `build/cambridge-dbml-pi` to the Pi and run it as an unprivileged account:

```sh
chmod 0755 build/cambridge-dbml-pi
LISTEN_ADDR=127.0.0.1:8080 ./build/cambridge-dbml-pi
```

Put Cloudflare Tunnel, nginx, or another TLS reverse proxy in front of the
loopback listener. Do not expose the Pi directly to the Internet and do not
run the binary as root.

## Cloudflare caching

The server sends `Cache-Control`, `CDN-Cache-Control`, and
`Cloudflare-CDN-Cache-Control` on every response. HTML has a Cloudflare TTL of
one day with a seven-day stale-while-revalidate window; hashed JS/CSS/WASM
assets are immutable for one year.

Create a Cloudflare Cache Rule for the public hostname:

1. Match `Hostname equals your-domain.example`.
2. Set cache eligibility to **Eligible for cache** so Cloudflare caches HTML,
   not only static-file extensions.
3. Respect origin cache-control headers.
4. Exclude any future administration hostname or path from that rule.

Purge the hostname cache after deploying a new binary when an immediate HTML
update is required. The site has no API routes and uses no cookies, so it is
safe to cache for all visitors.

## Verification

```sh
go test ./...
curl -I http://127.0.0.1:8080/
curl -i -X POST http://127.0.0.1:8080/
```

The first request must show the cache and security headers. The second must
return `405` with `Allow: GET, HEAD`.
