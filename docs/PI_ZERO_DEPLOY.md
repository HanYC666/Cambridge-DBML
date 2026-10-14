# Pi Zero W Deployment

The Go server reads a static site directory and accepts only `GET` and `HEAD`.
SQL and database files remain in the visitor's browser. Website updates do not
require recompiling the Go server or restarting systemd.

## Build

On a development machine:

```sh
cd github-static
npm ci
npm run build
cd ..
mkdir -p build
GOOS=linux GOARCH=arm GOARM=6 CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o build/cambridge-dbml-armv6 .
```

The deployable site is the **entire** `github-static/dist/` directory, including
`index.html`, hashed JavaScript and CSS, and `assets/vendor/sql-wasm.js` and
`sql-wasm.wasm`. Copying only `index.html` will not work. You can rebuild and
upload the site without rebuilding the server binary.

## One-time Pi setup

Copy `build/cambridge-dbml-armv6` to the Pi. Run it as an unprivileged account
with a site directory readable by that account. By default, the server looks
for `index.html` beside the executable. Set `SITE_DIR` to an absolute
path to use another location; this is useful when the binary and site releases
live in separate directories. For example:

```sh
LISTEN_ADDR=127.0.0.1:8080 SITE_DIR=/srv/cambridge-dbml/site /srv/cambridge-dbml/cambridge-dbml-armv6
```

The site directory must contain `index.html` when the service starts. If you
already run the embedded server under systemd, install this binary and add
`SITE_DIR` to the service configuration once, then restart it once. Subsequent
site updates need no service action. Keep Cloudflare Tunnel, nginx, or another
TLS reverse proxy in front of the loopback listener; do not expose the Pi
directly to the Internet or run the binary as root.

## Website updates without downtime

Build the site on the development machine and upload the whole `dist/` tree to
a new release directory on the Pi. For example, use a unique release name such
as a timestamp:

```sh
ssh pi-host 'mkdir -p /srv/cambridge-dbml/releases/NEW_RELEASE'
rsync -a github-static/dist/ pi-host:/srv/cambridge-dbml/releases/NEW_RELEASE/
```

If an old site is active, retain its hashed assets in the new release so
browsers that loaded the old HTML can still finish loading:

```sh
ssh pi-host 'rsync -a --ignore-existing /srv/cambridge-dbml/site/assets/ /srv/cambridge-dbml/releases/NEW_RELEASE/assets/'
```

Check the new release has `index.html`, then switch the `site` symlink in one
filesystem operation:

```sh
ssh pi-host 'test -f /srv/cambridge-dbml/releases/NEW_RELEASE/index.html && ln -s releases/NEW_RELEASE /srv/cambridge-dbml/site.next && mv -Tf /srv/cambridge-dbml/site.next /srv/cambridge-dbml/site'
```

The server opens files for each request, so it sees the new release after the
switch while existing requests complete. For initial setup, create the `site`
symlink before starting the service. Keep the previous release for rollback;
switch the symlink back if needed. The commands assume the deployment account
has write access to `/srv/cambridge-dbml` and that `site` is a symlink.

## Caching

HTML and unversioned vendor assets require revalidation. Hashed JS and CSS are
immutable for one year. Configure Cloudflare to respect the origin's
`Cache-Control` headers. After deploying a new release, a Cloudflare purge may
still be useful if an existing custom Cache Rule overrides those headers.

## Verification

```sh
go test ./...
curl -I http://127.0.0.1:8080/
curl -i -X POST http://127.0.0.1:8080/
curl -I http://127.0.0.1:8080/syntax.html
```

The first request should show cache and security headers. The second must
return `405` with `Allow: GET, HEAD`. The old syntax URL should redirect to
`/#syntax`.
