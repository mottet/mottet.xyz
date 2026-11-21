# Maïa on the watch

Two Connect IQ apps for the Garmin Venu 2 (and 2S, 2 Plus): a widget that
shows the last feed and starts, switches, pauses and stops one, and a watch
face with the time and the feed. It talks to
`maia.mottet.xyz/api/watch` (see `../maia-server.js`); the feed rules live on
the server, so a feed started on the watch is the same record a phone writes
and shows up at once on both phones, in the strips and in the reminders.

## What it shows

- **Glance** (swipe up from the watch face): `Maïa` over
  `1h 42m ago · R 18 min`, or `Feeding R · 12 min` while a feed runs. It reads
  the last summary the watch kept, asks the site for a fresh one each time it
  comes on screen (if its copy is over 30 seconds old) and once a minute while
  it stays there, so a feed started on a phone shows up. A background job also
  fetches one every five minutes (the shortest Connect IQ allows), and the
  minutes count on from the watch's own clock in between.
- **Full screen** (tap the glance), in the site's night colours: the site's
  blue tit perched on a leafy branch across the top. It sleeps (with drifting
  z's) for two and a half hours after a feed, then wakes; bobs while she
  feeds; rests while paused; and smiles with a rising heart when the site
  takes a start, a switch or a stop. Between feeds a thin arc round the edge
  fills over those two and a half hours (moss, then sun, then blush once it
  is past); during a feed a ring of leaves grows one a minute, each in the
  colour of the side she was on (green left, blue right, as on the strips),
  forty to the lap like the 40-minute reminder, golden after that.
- Idle, it shows the last feed (how long ago it ended, its start, minutes at
  the breast and sides) with **Left** / **Right** at the bottom, the
  suggested side filled. While a feed runs: a live clock, the
  side, and **Switch** / **Stop**; while paused, **Resume** / **Stop**. A tap
  above the buttons, or the action button, opens a menu with every action,
  Pause and Refresh included. The watch buzzes once the site has written it.
  The screen asks the site again every 30 seconds while open, so a feed
  started on a phone appears.
- **Last 5 feeds** (swipe up on the full screen, or from the menu): the five
  finished feeds before, newest first, as `Thu 22:10  18 min  L>R` (the day
  only for another day than today). Swipe down or back to return.

- **Watch face** (`face/`, *Maïa face*): the tit on its branch as in the
  widget, the time (12 or 24 hours, as the watch is set), the date, the feed
  (`Feeding · R · 23 min` in the side's colour, `Fed 51 min ago · R`, pink once
  it has been two and a half hours), a small battery (moss, sun under 20 %,
  red under 10 %) and the phone (moss when Garmin Connect is reachable, struck
  through in red when not), inside the same ring of leaves or arc. A watch
  face cannot go online itself, so its background job fetches the summary
  every five minutes; a feed started on a phone shows within five minutes, or
  at once in the widget. With the always-on display, while the watch sleeps
  it shows only the time and the feed in dim grey, drifting a few pixels each
  minute so the AMOLED screen does not burn in. It cannot start or stop a
  feed: swipe to the widget for that.

A Switch or Stop carries the id of the feed the screen showed; if a phone has
started or stopped a feed since, the site refuses it and the screen shows the
fresh state instead.

## How it reaches the site

Connect IQ apps cannot go online by themselves: requests go through the Garmin
Connect app on the phone over Bluetooth, so the phone must be near with Garmin
Connect running. Without it the screen says *Phone not connected* and the
glance keeps the last summary.

The watch cannot keep the site's login cookie, so it sends a token of its own
as `Authorization: Bearer <token>`. Put it in `.maia-secrets.json` on the
server beside the passwords (read on every request, no restart needed):

```sh
node -e 'console.log(require("crypto").randomBytes(24).toString("base64url"))'
```

```json
{ "parents": "...", "family": "...", "cookieSecret": "...", "watch": "<that token>" }
```

It must be 24 characters or more. Wrong tokens count as failed logins (ten in
a quarter of an hour and the address waits). To revoke a watch, change the
token.

## Building and installing

1. Install the [Connect IQ SDK](https://developer.garmin.com/connect-iq/sdk/)
   with the SDK Manager, and download the **Venu 2** device in it.
2. Make a developer key once (see the top of `build.sh`).
3. Build with the token baked in:

   ```sh
   MAIA_WATCH_TOKEN=$(cat .watch-token) sh build.sh   # or: sh build.sh run / run-face, for the simulator
   ```

   It writes `bin/maia.prg` (the widget) and `bin/maia-face.prg` (the watch
   face). The two share `shared/` (the site, the cache, the words, the
   colours and drawings) and `shared-resources/` (pictures, settings and the
   token). `.watch-token` (gitignored) keeps this checkout's copy of the token; the
   same value goes in `.maia-secrets.json` on the server. For the simulator,
   `MAIA_URL=http://localhost:<port>` points it at a local server, and
   Settings › Use Device HTTPS Requirements must be off.

   `shared-resources/settings/properties.xml` (gitignored) is written from
   `properties.xml.template` with the token.
4. Sideload: plug the watch in by USB and copy `bin/maia.prg` and
   `bin/maia-face.prg` to `GARMIN/APPS/` on it, then unplug. On a Mac use Garmin Express or
   [OpenMTP](https://openmtp.ganeshrvel.com/); on Linux the watch mounts over
   MTP (`gio mount -li`, or the file manager).
5. On the watch, swipe up to the glances, add Maïa from **Edit**, and open it
   once: that registers the background refresh. For the face, hold the screen
   (or Settings › Watch Face) and choose *Maïa face*; its first summary comes
   within five minutes.

A sideloaded widget cannot be configured from Garmin Connect, which is why the
token is built in. To change it from the phone instead, upload the `.iq`
(`monkeyc -e -f monkey.jungle -y developer_key.der -o bin/maia.iq`) to the
Connect IQ store as a private beta app: the Site address and Watch token
settings then show in Garmin Connect.

## The pictures

`art/build-art.cjs` draws the tit in its four moods, the branch and the sprig
from the site's own drawings (`maia/maia-art.js`) in its dark-theme colours,
and renders them to `shared-resources/drawables/` with headless Chrome:

```sh
node art/build-art.cjs
```

## The endpoint

- `GET /api/watch`: `{ ok, now, next, running, last, recent }`, times in Unix
  seconds; `recent` is the five newest finished feeds, shaped like `last`.
  `running` is `{ id, side, first, switches, start, active, paused, sideSince }`
  and `last` is `{ id, side, first, switches, start, end, active }` (`active` is
  seconds at the breast, pauses cut out; `side` is the side at the end, `first`
  the side it began on). `next` is the side to offer, or `null` for either.
- `POST /api/watch` with `{ "action": "start-left" | "start-right" | "switch" |
  "pause" | "resume" | "stop", "feed": "<running feed id>" }` writes the record
  (`by: "parents"`, `via: "watch"`), tells both phones live and answers with
  the summary; 409 with the summary and a message when it does not fit (a feed
  already running, none to stop, or the feed changed on a phone).

Check it from a terminal:

```sh
curl -H "Authorization: Bearer $TOKEN" https://maia.mottet.xyz/api/watch
```
