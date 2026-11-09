#!/bin/sh
# Put flux.mottet.xyz online. Run with sudo from the repo root once the
# DNS A record (and AAAA if mottet.xyz has one) points at this server:
#
#   sudo sh deploy/deploy-flux.sh
#
# Steps: nginx site, certificate, then a restart so the Node app mounts
# flux-server.js. The site writes nothing, so the systemd unit is unchanged.
set -eu

cd "$(dirname "$0")/.."

[ "$(id -u)" -eq 0 ] || { echo "run with sudo" >&2; exit 1; }
[ -f flux/graph/index.json ] || { echo "flux/graph/index.json is missing; run the pipeline first (see scripts/README.md)" >&2; exit 1; }

install -m 0644 deploy/flux.nginx.conf /etc/nginx/sites-available/flux.mottet.xyz
ln -sfn /etc/nginx/sites-available/flux.mottet.xyz /etc/nginx/sites-enabled/flux.mottet.xyz
nginx -t && systemctl reload nginx

certbot --nginx -d flux.mottet.xyz --redirect

systemctl restart mottet

echo "Done. Open https://flux.mottet.xyz"
