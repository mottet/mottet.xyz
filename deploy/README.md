# Server configuration

The Node.js app runs as `debian` through `mottet.service`, listening on
`127.0.0.1:8080`. Nginx proxies HTTP and WebSockets. Both services start on boot;
systemd restarts the app if it exits.

The HTTPS listeners enable HTTP/2. Hashed Royal Game of Ur artwork under
`/assets/ur/` is served directly with one-year immutable caching; JavaScript and
CSS responses use gzip. Artwork regeneration and the cold-load p95 benchmark
are documented in `../scripts/README.md`.

Live configuration:

- `/etc/systemd/system/mottet.service`
- `/etc/nginx/sites-available/mottet.xyz` (includes HTTPS settings added by Certbot)
- `/etc/letsencrypt/live/mottet.xyz/` (certificate and private key; never commit)
- `/etc/letsencrypt/renewal/mottet.xyz.conf`

Certbot's enabled systemd timer checks for renewal twice daily. The Nginx plugin
reloads Nginx after renewing. The certificate covers `mottet.xyz` and
`www.mottet.xyz`. The certificate-account email is `marvin.mottet@pm.me`.
Keep DNS pointing to this server and inbound TCP ports 80 and 443 accessible.

Useful commands:

```sh
sudo systemctl status mottet nginx certbot.timer
sudo journalctl -u mottet -n 100 --no-pager
sudo systemctl restart mottet
sudo nginx -t && sudo systemctl reload nginx
sudo certbot certificates
sudo certbot renew --dry-run
sudo systemctl list-timers certbot.timer
# Optionally add a certificate-account contact email:
sudo certbot update_account --email YOUR_EMAIL
```

After pulling application changes, install dependencies with the bundled Yarn
and restart the application:

```sh
node .yarn/releases/yarn-3.3.1.cjs install --immutable
sudo systemctl restart mottet
```

## maia.mottet.xyz

Maïa's site is served by the same Node.js app, which answers for that host
name only (see `../maia-server.js`). `deploy-maia.sh` runs every step below
in order (`sudo sh deploy/deploy-maia.sh`, once DNS points here). It needs:

- a DNS `A` record `maia.mottet.xyz` pointing at this server (and the `AAAA`
  if `mottet.xyz` has one);
- the Nginx site `maia.nginx.conf`, then a certificate of its own:

  ```sh
  sudo install -m 0644 deploy/maia.nginx.conf /etc/nginx/sites-available/maia.mottet.xyz
  sudo ln -sfn /etc/nginx/sites-available/maia.mottet.xyz /etc/nginx/sites-enabled/maia.mottet.xyz
  sudo nginx -t && sudo systemctl reload nginx
  sudo certbot --nginx -d maia.mottet.xyz --redirect
  ```

- `ReadWritePaths=-/home/debian/mottet.xyz/data/maia` in the systemd unit
  (`mottet.service` here carries it; copy it to the live unit, then
  `sudo systemctl daemon-reload && sudo systemctl restart mottet`), because
  `ProtectHome=read-only` would otherwise stop the records and photos being
  written;
- `.maia-secrets.json` beside `server.js` (gitignored, mode 600) holding the
  two passwords and the cookie key:

  ```json
  { "parents": "...", "family": "...", "cookieSecret": "..." }
  ```

  It is read on every request, so passwords change without a restart. Without
  it the gate answers 503 and nobody can log in.

Records live in `data/maia/records.jsonl`, photos in `data/maia/photos/` and
the reminders (push subscriptions and the VAPID key pair) in
`data/maia/push.json`; all gitignored. Back them up with the secrets file. If
`push.json` is lost, every phone has to turn its reminders on again.

`install-services.sh` and `mottet.nginx.conf` are initial HTTP bootstrap files
for a fresh Debian server with nginx, nodejs, certbot, and python3-certbot-nginx
installed. Do not replace the live HTTPS configuration with the HTTP template.
On a fresh server, install dependencies, run the bootstrap script as root, then
request the certificate:

```sh
sudo sh deploy/install-services.sh
sudo certbot --nginx --non-interactive --agree-tos \
  --register-unsafely-without-email --redirect -d mottet.xyz -d www.mottet.xyz
```
