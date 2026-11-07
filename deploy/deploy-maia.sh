#!/bin/sh
# Put maia.mottet.xyz online. Run with sudo from the repo root once the
# DNS A record (and AAAA if mottet.xyz has one) points at this server:
#
#   sudo sh deploy/deploy-maia.sh
#
# Steps: nginx site, certificate, the systemd unit with write access to
# data/maia, then a restart so the Node app mounts maia-server.js.
set -eu

cd "$(dirname "$0")/.."

[ "$(id -u)" -eq 0 ] || { echo "run with sudo" >&2; exit 1; }
[ -f .maia-secrets.json ] || { echo ".maia-secrets.json is missing; the gate would answer 503" >&2; exit 1; }

install -m 0644 deploy/maia.nginx.conf /etc/nginx/sites-available/maia.mottet.xyz
ln -sfn /etc/nginx/sites-available/maia.mottet.xyz /etc/nginx/sites-enabled/maia.mottet.xyz
nginx -t && systemctl reload nginx

certbot --nginx -d maia.mottet.xyz --redirect

cp deploy/mottet.service /etc/systemd/system/mottet.service
systemctl daemon-reload && systemctl restart mottet

echo "Done. Open https://maia.mottet.xyz and log in with a password from .maia-secrets.json"
