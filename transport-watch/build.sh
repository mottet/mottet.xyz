#!/bin/sh
# Builds the next-passages app (bin/transport.prg) for the Venu 2 with the
# watch token baked in, so a sideloaded copy works without the Connect IQ
# store's settings page.
#
#   sh build.sh                 # token from .watch-token, or ../.transport-secrets.json
#   sh build.sh run             # and start it in the simulator
#   sh build.sh test            # run the unit tests in the simulator
#   TRANSPORT_URL=http://localhost:8080 sh build.sh run   # against a local server
#
# Needs the Connect IQ SDK (monkeyc on PATH, or CIQ_SDK pointing at it; else
# the SDK Manager's current one) with the venu2 device files, and a developer
# key (DEVELOPER_KEY, default ../maia-watch/developer_key.der, the same key
# as Maïa's apps; see the top of ../maia-watch/build.sh to make one).
set -eu
cd "$(dirname "$0")"
DEVICE=${DEVICE:-venu2}
KEY=$(realpath "${DEVELOPER_KEY:-../maia-watch/developer_key.der}")
if [ -n "${CIQ_SDK:-}" ]; then BIN=$CIQ_SDK/bin/
elif command -v monkeyc >/dev/null; then BIN=
else BIN=$(cat ~/.Garmin/ConnectIQ/current-sdk.cfg)bin/
fi

TOKEN=${TRANSPORT_WATCH_TOKEN:-}
[ -z "$TOKEN" ] && [ -f .watch-token ] && TOKEN=$(tr -d '[:space:]' < .watch-token)
if [ -z "$TOKEN" ] && [ -f ../.transport-secrets.json ]; then
  TOKEN=$(node -e 'process.stdout.write(String(require("../.transport-secrets.json").watch || ""))')
fi
case "$TOKEN" in *[!A-Za-z0-9_-]*) echo "The token may only hold letters, digits, - and _." >&2; exit 1 ;; esac
[ -n "$TOKEN" ] || echo "No token: the app will say 'Jeton manquant'." >&2
URL=${TRANSPORT_URL:-https://mottet.xyz}
sed -e "s/@TOKEN@/$TOKEN/" -e "s|https://mottet.xyz|$URL|" properties.xml.template > resources/settings/properties.xml

mkdir -p bin
case "${1:-}" in
  test)
    "${BIN}monkeyc" -f monkey.jungle -d "$DEVICE" -y "$KEY" -o bin/transport-test.prg -t -l 2
    pgrep -f "bin/simulator" >/dev/null || { "${BIN}connectiq" & sleep 5; }
    exec "${BIN}monkeydo" bin/transport-test.prg "$DEVICE" -t ;;
esac
"${BIN}monkeyc" -f monkey.jungle -d "$DEVICE" -y "$KEY" -o bin/transport.prg -r -l 2
echo "Built bin/transport.prg for $DEVICE"

case "${1:-}" in
  run)
    pgrep -f "bin/simulator" >/dev/null || { "${BIN}connectiq" & sleep 5; }
    "${BIN}monkeydo" bin/transport.prg "$DEVICE" ;;
esac
