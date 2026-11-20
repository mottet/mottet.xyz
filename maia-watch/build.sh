#!/bin/sh
# Builds the widget for the Venu 2 with the watch token baked in, so a
# sideloaded copy works without the Connect IQ store's settings page.
#
#   MAIA_WATCH_TOKEN=... sh build.sh            # bin/maia.prg for a venu2
#   MAIA_WATCH_TOKEN=... DEVICE=venu2s sh build.sh
#   sh build.sh run                             # and start it in the simulator
#   MAIA_URL=http://localhost:8098 ...           # against a local server
#
# Needs the Connect IQ SDK (monkeyc on PATH, or CIQ_SDK pointing at it) with the
# venu2 device files, and a developer key (DEVELOPER_KEY, default
# ./developer_key.der; make one with
#   openssl genrsa -out developer_key.pem 4096
#   openssl pkcs8 -topk8 -inform PEM -outform DER -in developer_key.pem -out developer_key.der -nocrypt).
# Without MAIA_WATCH_TOKEN the token is read from ../.maia-secrets.json if it is there.
set -eu
cd "$(dirname "$0")"
DEVICE=${DEVICE:-venu2}
KEY=${DEVELOPER_KEY:-developer_key.der}
BIN=${CIQ_SDK:+$CIQ_SDK/bin/}

TOKEN=${MAIA_WATCH_TOKEN:-}
if [ -z "$TOKEN" ] && [ -f ../.maia-secrets.json ]; then
  TOKEN=$(node -e 'process.stdout.write(String(require("../.maia-secrets.json").watch || ""))')
fi
case "$TOKEN" in *[!A-Za-z0-9_-]*) echo "The token may only hold letters, digits, - and _." >&2; exit 1 ;; esac
[ -n "$TOKEN" ] || echo "No token: the widget will answer 'Wrong watch token' until one is set in Garmin Connect." >&2
URL=${MAIA_URL:-https://maia.mottet.xyz}
sed -e "s/@TOKEN@/$TOKEN/" -e "s|https://maia.mottet.xyz|$URL|" properties.xml.template > resources/settings/properties.xml

mkdir -p bin
"${BIN}monkeyc" -f monkey.jungle -d "$DEVICE" -y "$KEY" -o bin/maia.prg -w
echo "Built bin/maia.prg for $DEVICE"

if [ "${1:-}" = run ]; then
  "${BIN}connectiq" &
  sleep 3
  "${BIN}monkeydo" bin/maia.prg "$DEVICE"
fi
