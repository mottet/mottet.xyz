#!/bin/sh
set -eu
cd /home/debian/mottet.xyz
if [ -e /etc/letsencrypt/live/mottet.xyz/fullchain.pem ]; then
    echo 'HTTPS is already configured. Do not overwrite the live Nginx configuration.' >&2
    exit 1
fi
install -m 0644 deploy/mottet.service /etc/systemd/system/mottet.service
install -m 0644 deploy/mottet.nginx.conf /etc/nginx/sites-available/mottet.xyz
ln -sfn /etc/nginx/sites-available/mottet.xyz /etc/nginx/sites-enabled/mottet.xyz
# Disable Debian's default site; preserve the original configuration.
if [ -L /etc/nginx/sites-enabled/default ]; then
    unlink /etc/nginx/sites-enabled/default
fi
nginx -t
systemctl daemon-reload
systemctl enable --now mottet.service nginx.service certbot.timer
systemctl reload nginx
systemctl --no-pager --full status mottet.service nginx.service certbot.timer
