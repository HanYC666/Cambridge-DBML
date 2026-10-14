# Pi Zero W Deployment

The repository includes a Linux ARMv6 server binary and the built website at
the project root. The Go server only serves static files; SQL and database
files stay in each visitor's browser. Website updates can be applied without
rebuilding the binary or restarting systemd.

## Before installing

Use a Pi Zero W running Raspberry Pi OS with network access. The commands below
assume the public repository at
`https://github.com/HanYC666/Cambridge-DBML.git` and a TLS reverse proxy such as
Cloudflare Tunnel or nginx on the same Pi. The service listens only on
`127.0.0.1:8080`.

The repository must contain all three root deployment items before cloning:
`cambridge-dbml-armv6`, `index.html`, and the complete `assets/` directory.
The HTML references hashed CSS and JavaScript plus the SQLite WebAssembly files
under `assets/vendor/`. Commit and push any pending asset changes first.

## Clone and stage the first site release

Run on the Pi:

```sh
sudo apt-get update
sudo apt-get install -y git ca-certificates curl
sudo git clone https://github.com/HanYC666/Cambridge-DBML.git /opt/cambridge-dbml
sudo test -x /opt/cambridge-dbml/cambridge-dbml-armv6
sudo test -f /opt/cambridge-dbml/index.html
sudo test -f /opt/cambridge-dbml/assets/vendor/sql-wasm.wasm
id cambridge-dbml >/dev/null 2>&1 || sudo useradd --system --user-group --no-create-home --shell /usr/sbin/nologin cambridge-dbml
sudo install -d -m 0755 /srv/cambridge-dbml/releases
release="$(date -u +%Y%m%dT%H%M%SZ)-$(sudo git -C /opt/cambridge-dbml rev-parse --short=12 HEAD)"
site_release="/srv/cambridge-dbml/releases/$release"
sudo install -d -m 0755 "$site_release"
sudo cp -a /opt/cambridge-dbml/index.html /opt/cambridge-dbml/assets "$site_release/"
sudo ln -s "releases/$release" /srv/cambridge-dbml/site
```

The cloned repository stays at `/opt/cambridge-dbml`. The service reads website
files from `/srv/cambridge-dbml/site`, a symlink to a complete release. This
keeps the live site stable while Git updates the checkout.

## Install the systemd service

```sh
sudo tee /etc/systemd/system/cambridge-dbml.service >/dev/null <<'EOF'
[Unit]
Description=Cambridge DBML static website
After=network.target

[Service]
Type=simple
User=cambridge-dbml
Group=cambridge-dbml
Environment=LISTEN_ADDR=127.0.0.1:8080
Environment=SITE_DIR=/srv/cambridge-dbml/site
ExecStart=/opt/cambridge-dbml/cambridge-dbml-armv6
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now cambridge-dbml.service
sudo systemctl status --no-pager cambridge-dbml.service
```

Point the local TLS reverse proxy at `http://127.0.0.1:8080`. Keep the service
bound to loopback; do not expose port 8080 directly or run the server as root.

## Update the website without restarting systemd

After pushing a new commit to GitHub, run on the Pi:

```sh
sudo git -C /opt/cambridge-dbml pull --ff-only
release="$(date -u +%Y%m%dT%H%M%SZ)-$(sudo git -C /opt/cambridge-dbml rev-parse --short=12 HEAD)"
site_release="/srv/cambridge-dbml/releases/$release"
sudo install -d -m 0755 "$site_release"
sudo cp -a /opt/cambridge-dbml/index.html /opt/cambridge-dbml/assets "$site_release/"
sudo cp -a -n /srv/cambridge-dbml/site/assets/. "$site_release/assets/"
sudo test -f "$site_release/index.html"
sudo test -f "$site_release/assets/vendor/sql-wasm.wasm"
sudo ln -sfn "releases/$release" /srv/cambridge-dbml/site.next
sudo mv -Tf /srv/cambridge-dbml/site.next /srv/cambridge-dbml/site
```

The copy from the previous release retains old hashed assets for browsers that
loaded the previous HTML. The final symlink switch is atomic, and the running
server opens files for each request. Keep previous releases for rollback: point
`site.next` at the previous release and perform the same `mv -Tf` switch.

If `cambridge-dbml-armv6` itself changes, the site switch does not load the
new executable into the running process. Apply a binary update with
`sudo systemctl restart cambridge-dbml.service` when needed.

## Verify

```sh
sudo systemctl is-active cambridge-dbml.service
curl -I http://127.0.0.1:8080/
curl -I http://127.0.0.1:8080/assets/vendor/sql-wasm.wasm
curl -i -X POST http://127.0.0.1:8080/
curl -I http://127.0.0.1:8080/syntax.html
```

The HTML and WebAssembly requests should return `200`. The POST request should
return `405` with `Allow: GET, HEAD`; the old syntax URL should redirect to
`/#syntax`.

## Caching

HTML and unversioned vendor assets require revalidation. Hashed JavaScript and
CSS are immutable for one year. Configure Cloudflare to respect the origin's
`Cache-Control` headers. A Cloudflare purge may be needed if an existing custom
Cache Rule overrides them.
