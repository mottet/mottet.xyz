# Next passages on the watch

A Connect IQ app for the Garmin Venu 2 with the next real-time departures at
two stops, one page each (swipe up/down to switch, tap to refresh; it asks
again every 30 seconds while open):

| Page | Line | Stop | ref | line |
|---|---|---|---|---|
| 1 | RER A | Le Parc de Saint-Maur | `STIF:StopArea:SP:43234:` | `STIF:Line::C01742:` |
| 2 | Bus 306 | Cimetière, Saint-Maur-des-Fossés (both directions) | `STIF:StopArea:SP:58258:` | `STIF:Line::C01276:` |

Each row is a destination and the minutes left: green under five minutes,
`à quai` / `proche` in yellow under one, `supprimé` in red when cancelled.

## How it gets the times

The departures come from Île-de-France Mobilités' PRIM API (SIRI Lite
`stop-monitoring`), but the watch does not ask PRIM itself: PRIM's answer for
an RER station holds three hours of trains, about 50 kB, more than Connect IQ
accepts ("Réponse trop lourde"), and PRIM cannot be told to send fewer. So the
watch asks `mottet.xyz/api/transport/next` (`../transport-server.js`), which
asks PRIM with the API key, keeps the next eight departures (a few hundred
bytes) and caches them 20 seconds per stop.

The watch sends a token of its own as `Authorization: Bearer <token>`. The
server reads it, with the PRIM key, from `.transport-secrets.json` beside
`server.js` (gitignored, mode 600, read on every request):

```json
{ "primKey": "<PRIM API key>", "watch": "<24 characters or more>" }
```

Make a token with
`node -e 'console.log(require("crypto").randomBytes(24).toString("base64url"))'`.
The PRIM key comes from https://prim.iledefrance-mobilites.fr (*Mon jeton
d'authentification*), with the "Prochains passages – requête unitaire" API
subscribed. Ten wrong tokens in a quarter of an hour and the address waits.

## Building and installing

```sh
sh build.sh          # bin/transport.prg, token from .watch-token
sh build.sh run      # and start it in the simulator
sh build.sh test     # the unit tests, in the simulator
TRANSPORT_URL=http://127.0.0.1:8080 sh build.sh run   # against a local server
```

The token comes from `TRANSPORT_WATCH_TOKEN`, else `.watch-token` (gitignored),
else `../.transport-secrets.json`. `build.sh` writes it into
`resources/settings/properties.xml` (gitignored) from `properties.xml.template`.
It signs with Maïa's developer key (`../maia-watch/developer_key.der`) unless
`DEVELOPER_KEY` says otherwise. For a local server the simulator's
Settings › Use Device HTTPS Requirements must be off.

Install: plug the watch in over USB and copy `bin/transport.prg` to
`GARMIN/APPS/`. Requests go through Garmin Connect on the phone, so the phone
must be near.

## Other stops

Change the `stop*Ref`, `line*Ref`, `name*` and `badge*` properties in
`properties.xml.template` (a badge containing `RER` is red, others blue). In
the open data set `arrets` on data.iledefrance-mobilites.fr a stop's `zdaid`
gives `STIF:StopArea:SP:<zdaid>:`; in `arrets-lignes` the line's `IDFM:Cxxxxx`
gives `STIF:Line::Cxxxxx:`.
