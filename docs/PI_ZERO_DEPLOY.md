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
`127.0.0.1:8011`.

The repository must contain all three root deployment items before cloning:
`cambridge-dbml-armv6`, `index.html`, and the complete `assets/` directory.
The HTML references hashed CSS and JavaScript plus the SQLite WebAssembly files
under `assets/vendor/`. Commit and push any pending asset changes first.

## Clone the repository

Run on the Pi:

```sh
sudo apt-get update
sudo apt-get install -y git ca-certificates curl
sudo git clone https://github.com/HanYC666/Cambridge-DBML.git /root/cambridge-dbml
sudo test -x /root/cambridge-dbml/cambridge-dbml-armv6
sudo test -f /root/cambridge-dbml/index.html
sudo test -f /root/cambridge-dbml/assets/vendor/sql-wasm.wasm
```

The binary reads `index.html` and `assets/` beside itself, so this checkout is
both the server location and the website directory.

## Install the systemd service

```sh
sudo tee /etc/systemd/system/cambridge-dbml.service >/dev/null <<'EOF'
[Unit]
Description=Cambridge DBML static website
After=network.target

[Service]
Type=simple
WorkingDirectory=/root/cambridge-dbml
Environment=LISTEN_ADDR=127.0.0.1:8011
ExecStart=/root/cambridge-dbml/cambridge-dbml-armv6
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now cambridge-dbml.service
sudo systemctl status --no-pager cambridge-dbml.service
```

Point the local TLS reverse proxy at `http://127.0.0.1:8011`. The service runs
as root because the checkout is under `/root`; keep the listener on loopback.

## Update the website without restarting systemd

After pushing a new commit to GitHub, run on the Pi:

```sh
sudo git -C /root/cambridge-dbml pull --ff-only
```

The server opens website files for each request, so HTML and asset changes are
served without restarting systemd. Keep previous hashed assets in the repo so
browsers with cached HTML can still fetch them. Git updates the checkout in
place, so requests during a pull can briefly see files from different commits.

If `cambridge-dbml-armv6` itself changes, the running process continues using
the old executable. Apply a binary update with
`sudo systemctl restart cambridge-dbml.service` when needed.

## Verify

```sh
sudo systemctl is-active cambridge-dbml.service
curl -I http://127.0.0.1:8011/
curl -I http://127.0.0.1:8011/assets/vendor/sql-wasm.wasm
curl -i -X POST http://127.0.0.1:8011/
curl -I http://127.0.0.1:8011/syntax.html
```

The HTML and WebAssembly requests should return `200`. The POST request should
return `405` with `Allow: GET, HEAD`; the old syntax URL should redirect to
`/#syntax`.

## Caching

HTML and unversioned vendor assets require revalidation. Hashed JavaScript and
CSS are immutable for one year. Configure Cloudflare to respect the origin's
`Cache-Control` headers. A Cloudflare purge may be needed if an existing custom
Cache Rule overrides them.
