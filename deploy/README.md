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
