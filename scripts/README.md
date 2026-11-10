# House navigation

`/board.html` is a second home page that lays the house out flat, as a board
game far larger than the screen. `board.js` draws a 4000-unit world in one SVG
and uses its viewBox as a camera, which starts zoomed on the hall medallion at
the centre. Six wooden ways radiate from the hall to stations beyond the
screen in the whiplash manner: tapered walnut stems with brass edges and a
bronze vein, a thinner vine twining across each, offshoots that hook back and
end in irises and rose buds, lanceolate leaves, tendril curls, and lamps on
curved stalks. The stems to the upper rooms carry fanned brass treads, stairs
seen from above, and every station blooms as a flower head. Each room has its
own craft, drawn at three scales: an emblem in a brass ring on its signpost at
the hall, themed surroundings for its station (a parterre with box hedge,
gravel walks and rose beds; a fringed tapestry carpet set with Ur rosettes and
counters; a round drawing table with a carved rim, pencils, palette and
compass; a night dial ringed by staves and a curving keyboard; a hexagonal
bench of glazed tiles with copper pipework and glass), and a painted interior
inside the station disc. The interiors are textured bitmaps: `board-
artwork.js` paints each 408-unit scene on a canvas with a seeded random
source, gouache dabs, paper fibres, wood grain, woodcut hatching and film
grain, and `build-board-artwork.cjs` renders them in headless Chromium at 1024
px, encodes WebP there, writes content-hashed files to `public/assets/board`,
updates `board-artwork-manifest.json` and points `board.js` at them. Run
`HOUSE_TEST_TOOLS=... npm run build:board-art` after changing the scenes
(`--preview` writes unhashed files without touching `board.js`). The field is
a printed Arts and Crafts ground in the Morris manner, waving stems with
leaves and four-petal flowers over paper and linen, inside a frieze border
with brass inlay rings. Whiplash sprays grow from wrought curls at the hall
ring into the six gaps between the stems, with lanceolate leaves, irises and
rose buds; a pale vine twines along every stem with leaves and buds, and brass
lamps on curved stalks glow at its sides. Each station stands in a leaf
wreath, dragonflies, butterflies and fallen petals drift over the field, and a
lettered cartouche names the house. Nothing moves at rest; only the pawn and
the camera animate. The world is painted once at 4000 units and the camera is
a CSS transform on its wrapper, so journeys composite cached tiles rather than
repainting the SVG. Signposts at the hall, the ways themselves, and the
stations are hash links; choosing one walks a brass pawn along the way while
the camera follows, and the station's plate opens the project. The URL hash
names the current station so reloads and Back restore it, dragging pans the
board, and a Whole board button pulls the camera out to see everything. A room
visited from the board returns to the board. Run `HOUSE_TEST_TOOLS=... npm run
test:board`.

The separate `/apartment.html` page renders a two-floor Three.js apartment in a
printed Art Nouveau palette at twilight. Curved walnut portals, botanical
wallpaper, floral glass, mosaic floors, and a spiral staircase are built as 3D
geometry. The seamless wallpaper combines a half-drop iris repeat with
interlocking ogee vines, veined leaves, seed heads, and fine printed grain.
Shared procedural walnut grain, brass dado inlays, raised leaf friezes, plaster
ceiling rosettes, petal lamps, and glass tracery add detail on both floors.
Door frames sit in arched openings in the walls, with fitted jambs and
floor-level thresholds. The side doorway bays join the curved walls at both
ends. Static ornament is batched by material; frames render only for camera
movement, navigation, and resizing. The locally hosted Three.js browser files
are pinned to 0.186.1 and include their MIT license.

All visible apartment controls are symbols. Accessible names identify rooms and
controls to screen readers. Drag or touch to look around; click or tap a door to
approach it, open it, and visit its original project. The two floor symbols and
stairs update URL hashes; Back restores the floor. Room return links lead back
to the apartment only when the visit originated there, using a consumed session
marker. Reduced motion skips journeys, and a text-free icon fallback preserves
navigation if WebGL or the module fails.

Run `HOUSE_TEST_TOOLS=/tmp/malik-test-tools/node_modules npm run test:apartment`.
The browser check covers all five entry/return journeys, floor history, camera
and touch input, modal focus, reduced motion, five viewport shapes, a failed
renderer, absence of visible text, and idle/bounded rendering. It uses Chromium
software WebGL; physical phone performance should be judged on the device.

The six projects are rooms in a two-floor Art Nouveau house. `houseScene.js`
draws the entrance hall and landing with reusable vectors, using the existing
walnut texture. A bent walnut arch with brass tendrils spans the hall, every
door has a carved whiplash surround, the floor carries a mosaic rosette, and dusk shows through the skylight and the
landing window while the pendant and sconces pool warm light. The same world
geometry is drawn through two fixed cameras: a 1200:680 landscape view for wide
screens and a 760:940 portrait view for upright phones and tablets, chosen by
the orientation media query. The visit card is sized from the viewport height
so the whole hall is visible without scrolling. Room links are placed over the
drawn doors and the staircase from the artwork's own bounds; a brass label
appears on hover and stays visible on touch screens. Titles use Federo, a
revival of a 1909 Jugendstil grotesque, and running text uses Cormorant
Garamond, both self-hosted under the SIL OFL in `public/assets/fonts`. The
doors keep the original project URLs. Floor changes use URL hashes so links,
reloads, and browser Back all restore the right floor.
`houseNavigation.js` supplies each room's return route and shared floor-plan
dialog. Ur keeps an immediate return link and loads the full house controls
after its first playable frame, so their downloads do not compete with the game.
Its controls isolate input from the older p5 games. All links work with
the keyboard; the dialog restores focus, and reduced-motion settings skip the
door and entrance animations. With JavaScript disabled, the ground-floor doors
and explicit upstairs links on the home page remain available.

Run the house browser check against the local server using the same external
Playwright installation described below:

```sh
HOUSE_TEST_TOOLS=/tmp/malik-test-tools/node_modules npm run test:house
```

Set `HOUSE_BASE_URL` to check another server. The check covers real journeys
through all six doors, floor history, return routes, current-room indication,
keyboard focus, canvas input isolation, mobile layout, and reduced motion.
It also verifies uniform SVG scaling, stable object placement, a shared vanishing
point, and mobile touch targets across portrait, landscape, and wide viewports.

The tooling path above is where Playwright 1.51.1 currently lives on this
machine (the earlier `/tmp/ur-tools` and `/tmp/ur-visual-check` are gone).

The sixth room, Glyphs (`/glyphs.html`), opens off the landing. Its door stands
on the first-floor back wall where the garden door stands downstairs, an
ogee-headed door with a round pane etched in brass with a quill and a curl of
smoke; the landing window moved to the right half of the back wall above the
stair rail, and the console table went. On the board it is the sixth station,
straight below the hall, with a parchment interior of a lit candle, a sand
timer, grey scrawls, a crossed-out blot, an ink pot and a quill; the lettered
cartouche moved to the lower right corner to make room. Nothing in the house
shows a spell shape: players are meant to discover those on the sheet. The
floor plan shows the room as a full-width row above the two landing rooms.

The maze garden adapts its grid to the available screen while keeping square
cells, fixed straight wall edges and a compact botanical border. Complete frames are composed off screen and
displayed once; only the areas being carved are repainted. The original random
walkers split into branches and stop at dead ends, leaving untouched pockets.
Plans that stop too early are retried so branches cover most of the grid.
Passages appear at a steady rate, completing in about 2.4 seconds.
Each opened passage grows a thick, curving rose stem with attached leaves and
hooked thorns; an oversized dusty pink rose blooms at each terminal cell.
Rose petals have shaded overlapping cups, pale folded rims and a curled centre.
Each rose has a fixed variation in size, petal shape, proportion and warmth.
Cached flower sprites open from buds over 520–820 ms; reduced motion displays
the finished blooms immediately. Flowers retain their drawing order as they open.
Stems and flowers use separate layers, with blooms above all branches.
Grid walls stay thin so the stems are clear.
Run `HOUSE_TEST_TOOLS=/tmp/malik-test-tools/node_modules npm run test:maze` to check stable
wall edges in the opening frames, path pixels during generation, branching,
untouched pockets, paced growth, connectivity, viewport coverage, grid edges
against maze data, incremental drawing against a clean redraw, rose stems and
flowers at every terminal branch, gradual bloom animation and size variation,
regeneration, and reduced motion.

# Glyphs

`/glyphs.html` is a duel of drawn spells against a monster. Each round lasts
ten seconds; the player draws one glyph on a sheet of paper (a canvas with
Pointer Events) while the monster "scratches its quill" off screen, and the
two spells meet in the arena at the same moment. The page shows one scene at
a time: casting sends the sheet away and brings up the battlefield, where the
spells are cast, meet, and the rings answer one badge at a time;
against the monster the next sheet waits for a Next round button, between
phones the server allows fourteen seconds and the page counts them down, and
the end of a duel is a card inside the battlefield rather than an overlay
(reduced motion swaps without animating).
Only the reaction is shown, and
each cast is drawn as what it is rather than as a token: an attack gathers at
the caster's hand as its element (a fireball, a rolling wave, a thrown
boulder, a gust, an iron dart; a compound has a drawing of its own, an
element from the forge is an orb of its colour) and flies off with a trail;
a ring gathers round its caster, who takes a guard pose, and a mirror stands
up in front of theirs. Two attacks meet in the middle and a named reaction
blooms there (inferno, steam, smothered, fanned, melts, mud, rust, slips,
quake, sparks...); an attack on a mirror meets it at the pane, which flares
or shatters; any other attack flies straight on. Whatever comes out of a
meeting flies on to the caster it lands on and arrives as their badge does,
stopping at the ring's edge, turned aside or bursting through. An
`aria-live` line narrates the round. The shapes are never written down in the game. While drawing, the
sheet glows in proportion to the recogniser's best score without naming the
spell, and sets to brass once a glyph is read; a drawing that is no glyph
fizzles, a blank sheet is a rest. Glyphs the player has made work are written
into a grimoire on the page in their own hand (`localStorage`), and rewritten
whenever a closer drawing of the same glyph is cast.

There are no life points and no marks. A caster stands behind one ring at
most, and a strike that gets through the ring, or finds none, wounds, whatever
its power; the second wound (`round.hits` in the data) kills by the element of
the strike that made it: burnt to ash, cut down, turned to stone, scattered,
drowned. Wounds are scars on the portrait and plain to both sides. A bare circle is a
Ward, a ring of no element that thickens whatever ring stands; an attack glyph
drawn inside a circle is a ring of that element (the recogniser splits off
the one closed, cornerless stroke that encloses the rest and reads the
remainder). The same element thickens the ring, another replaces it, never
beyond three. The other caster sees the ring's thickness, never its element:
their portrait shows a bare ring, the server masks the element in what it
sends, and only a strike reveals it through the badge, which names the pair
of elements that decided it. A strike meets a ring in one of three ways. The
ring turns it aside, untouched, when the ring's element beats or quenches the
striking element. The strike goes straight through, whatever its power, when
it beats or passes the ring's element. Otherwise (a bare Ward always) the ring
wears by the strike's power, and a power as high as the ring breaks it. So a
full bare Ward falls only to a perfect attack, a ring of water shrugs off
every flame, and a ring of stone is paper to the weakest flame.
Precision is power: the recogniser's distance to the glyph makes a spell power
1, 2 or 3 (within 0.9 and 0.5), the sheet says "clean" or "perfect" as the
glyph is read; power decides what happens at a ring, never how deep the wound
is, so a perfect attack on an unguarded caster wounds like a weak one.
The glyphs are Flame (triangle), Iron (a cross), Stone (square), Wind
(spiral), Wave (two crests), Ward (circle), Mirror (one upright stroke), and four compounds that
join two elements: Bolt (lightning stroke, fire and air), Frost (a
three-stroke snow crystal, water and air), Vine (an S, earth and water) and
Magma (triangle apex down, fire and earth). A compound meets everything with
whichever of its elements fares better, so a round has one reaction and one
line: against another attack it overcomes when it beats the other somewhere
and is beaten nowhere (the whole spell goes on), trades when each has the
better of the other somewhere (both go on), and otherwise what is not quenched
goes on; a mirror turns it back only if it reflects both elements. In return
a compound is weaker than a natural element in two ways: against a ring it is
as weak as its weaker element (the ring answers with the better of its
answers: turned aside if either element would be, straight through only if
both would be), and it is cast one power below the hand that drew it
(`round.compoundCost`, never below 1), as an attack and as a ring, so it is
never perfect and cannot break a full ring by force; the cast line says "cast
at 2 as a compound". In the balance sim the compounds win fewer duels than
any natural element. The five elements sit on a
pentagram, and every pair is decided the way the two meet in the world rather
than for symmetry (the balance comes second): Flame melts Iron, Iron splits
Stone, Wind tears Wave to spray, Wave puts out Flame in steam and Stone
smothers Flame (five arrows; the loser of an arrow is struck by the winner's
element); Stone and Wave quench each other in mud, and Wave and Iron in rust
(both spells undone, a ring of either turns the other aside); Flame and Wind
(fanned), Iron and Wind (slips) and Stone and Wind (blows over) pass through
each other (both spells land, a ring of either gives way). No pair is left
undecided, and each kind of relation is used at least once. So a ring of
water turns three elements aside, a ring of stone or of iron two, and a ring
of flame or of wind only one. The mirror
turns the light elements, flame and wind, back into their caster's own ring
and is soaked, shattered or cut by the heavy ones. A ring answers a compound
with its better answer: Frost pierces rings of flame and iron, Bolt a ring of
iron, Vine a ring of flame and Magma a ring of wind. Casting resolves the round at once: the monster has already
chosen, knowing the player's ring only by its thickness until a strike reveals
it. Each caster's portrait shows badges for what happened to them (a ring
raised, a ring that turned a blow aside, took it or gave way, a death) and the
narration ends with an outcome line per caster. The duel waits for the player
to press Begin, against the Salamander or against a friend on another phone:
`glyphs-server.js` (attached in `server.js`) sets a table under a four-letter
code, the other player joins by code or by the `#duel=CODE` link, and the
server keeps the clock, seals both casts with the power each phone read, runs
the rules and sends each side its own perspective of the round with the other
ring masked; the socket.io client is fetched only when asked for. `PORT`
overrides the server's port (default 8080).

`glyphs-data.js` holds the elements (id, name, colour, death), their
relations (`beats` from one to another, or a symmetric `quench` or `pass`),
the spells with their glyph shapes (a shape is a generator name and its
parameters, or recorded strokes) and the reactions written by hand, as JSON
inside a small wrapper. `glyphs-spells.js` builds the rules from it (pure
functions: `reactions`, `applyRound`, `chooseSpell`, the monster profiles)
and is shared by the game, the grimoire, the forge and the Node checks; a pair
of attacks with no written reaction follows from the relations (the winner's
element goes on to the loser, a quench cancels, a pass or nothing lets both
land; a defence reflects the elements it is told to and lets the rest
through), and `build(data)` makes a fresh set of rules from any data.
`glyphs-wheel.js` draws the element wheel (an arrow points at what it beats,
dashed is a quench, dotted a pass) for the duel's "The elements" panel, the
grimoire and the forge. `glyphs-recognizer.js` is the $P
point-cloud recogniser with two cues from the raw strokes (closure and corner
count) that keep a square from reading as a circle; templates are generated
from geometry, not recorded. `glyphs.js` owns the sheet, the clock, the
monster's turn and the arena. The monster scores every option by expected
value (rings kept, kills, its own death) against a belief over the player's
next glyph (half a count per option, one per past cast, three per cast in the
last three rounds), adds its temperament and samples with softmax. A monster
follows its own elements: the Salamander is loyal to fire (`elements`,
`loyalty` 5), so it casts Flame, Bolt and Magma, stands behind a ring of
flame when threatened, and strays to another element when nothing of fire can
get through, as against a known ring of water or stone; flame being the
weakest element on this wheel, it strays almost half the time. It
fumbles 15% of its glyphs and draws them weak, clean or perfect with odds
40/40/20. The unit check prints its cast mix and asserts it keeps to fire at
least half of the time and rings between 15% and 45% (the bound was 55% on
the earlier wheels; the balance is to be revisited).

`/glyphs-grimoire.html` is the designer's grimoire: every glyph drawn from the
templates, the full reaction matrix, deaths, the monster's mind, the
recogniser's thresholds and a test pad that ranks candidates for a drawing. It
is deliberately not linked from the game or the house, and carries a spoiler
banner.

`/glyphs-editor.html` is the forge, linked only from the grimoire: it edits
the data file in forms (elements and deaths, the wheel by clicking two
elements or a line, spells with their shapes and a nearest-other-glyph
readout, reactions in a table where derived pairs are in italics and typing
writes them), tries every change against `validate` and `build` as it is
made, keeps a drawing from its test sheet as a spell's glyph or variant, and
saves with `POST /glyphs/data`. The server checks a token (`GLYPHS_EDIT_TOKEN`
or the `.glyphs-edit-token` file beside `server.js`, read per request),
validates, writes `public/glyphs-data.js` and rebuilds the rules the
two-phone duels run on without a restart; the systemd unit needs
`ReadWritePaths=` for that file since the home directory is mounted
read-only. Download and Load a file cover a server without the token.

Run `node scripts/check-glyphs.cjs --unit` for the rules (symmetric matrix,
the pentagram, guards, two wounds to a death, rings, deaths), the data
(validation, derived reactions, turning a relation, a sixth element with its
spell and ring, `round.hits`, the wheel), the recogniser against a synthetic
hand at two levels of sloppiness plus scribbles and flipped shapes, and a
balance simulation that prints each option's record against a random opponent
and the Salamander's record against players who only ward or only ring water
(read it after a rules change: no option should dominate, no ring should stall). Run
`HOUSE_TEST_TOOLS=/tmp/malik-test-tools/node_modules npm run test:glyphs` with
the server up for the browser check (add `-- --browser` to skip the unit
pass, which takes some minutes because of the balance simulation): a pointer-drawn triangle reads as Flame
and lands, a blank sheet rests, a scribble fizzles without naming anything,
a flame wounds and a second kills, a glyph in a circle raises a ring the
player sees and the monster does not, a strike reveals a ring, the grimoire survives a reload, the forge turns a
relation on the wheel and the matrix follows, adds an element, keeps a drawing
as a shape and is refused a save without the token, two browsers duel
through a server the check starts itself on port 8097, the clock
resolves a round on its own, the grimoire page is complete and its pad reads a
circle as Ward, and a phone viewport has no horizontal overflow.

# Maia

`maia.mottet.xyz` is a private site for Maïa, born on 4 November 2026, served
by the same `server.js` for that host name only (`maia-server.js`, mounted
before the house's static files; `maia.localhost` is accepted too, which
Chromium resolves to the loopback without any DNS, so the checks can reach
it). The files are in `maia/`, outside `public/`, so nothing of them answers
on mottet.xyz and nothing of the house answers there.

Two passwords in `.maia-secrets.json` give two roles through a signed cookie:
`parents` see and write everything, `family` read the news only. Every record
is one JSON line appended to `data/maia/records.jsonl` (`id`, `type`, `rev`,
`at`, `by` and the type's own fields; the latest line per id wins and
`deleted: true` hides one), loaded into memory at start and broadcast on the
socket.io namespace `/maia` as it is written, so the other phone updates at
once. Types: `feed` (side, start, end, note), `care` (vitamin or medicine),
`appointment`, `journal` (a day, text, measurements, photos), `news` (title
and text as `{fr, en, zh}`) and `photo` (shrunk to 1600 px as JPEG on the
phone before upload; `audience` turns to `family` when a news post carries
it, and `/photos/<id>` checks the role).

The page is one `index.html` with hash routes: a trilingual gate (French,
English, Traditional Chinese, from the phone's language, kept in
`localStorage`), then for the parents Today (her age, the running feed with
its clock and Stop, the last feed and the suggested next side, Left / Right /
Both, the vitamin D tick, the next appointment), Feeds, Journal, Care and News
in English, or for the family the news in the chosen language with the first
written language as fallback. The drawings (`maia-art.js`) are the forest
side of the house: boughs, leaves, a wren and a blue tit, the sun by day and
the moon by night (`data-theme`, remembered, from `prefers-color-scheme` at
first), a nest where a list is empty. The tagged css and js carry
`?v=maia-N`; bump it with every change.

Reminders reach the parents' phones by Web Push (`maia-push.js`, the
`web-push` package, `maia/sw.js` as the service worker, which caches nothing).
Each phone turns them on from the Reminders card on Today, and keeps its own
choices on the server (`POST /api/push/state`, `/subscribe`, `/unsubscribe`,
parents only): vitamin D not logged by a chosen hour (then once more three
hours on), an appointment the evening before at seven and an hour before, a
feed still running after 40 minutes, no feed for 2½ hours then every 30
minutes (silent after 12 hours, when nobody is logging), and a new journal
page written on the other phone (the writer's phone is named in the
`X-Maia-Push` header, so it is skipped). The planner `plan()` is pure and
runs every half minute on the server, in her time zone; what was sent is kept
by key in `data/maia/push.json` with the subscriptions and the VAPID key pair
made on first use, so a restart repeats nothing. A phone that answers 404 or
410 is forgotten. Only the systemd service sends (it is known by
`INVOCATION_ID`; `MAIA_PUSH=on` or `off` overrides): a server started by hand
holds a frozen copy of the records and must stay silent. On an iPhone push only works from the home-screen app, and
the card says so.

```sh
node scripts/check-maia.cjs --unit
HOUSE_TEST_TOOLS=/tmp/malik-test-tools/node_modules npm run test:maia
```

The browser check starts its own server on port 8097 with a data folder and
passwords of its own (`MAIA_DATA`, `MAIA_SECRETS`), so it never touches the
live records. Deployment (DNS, Nginx, certificate, the systemd write path and
the secrets file) is in `../deploy/README.md`.

# Flux

`flux.mottet.xyz` shows who pays what into the French public administrations
and who receives what, with the State at the centre: a big picture first,
then drill-down at every node. It is served by the same `server.js` for that
host name only (`flux-server.js`, mounted before the house's static files;
`flux.localhost` is accepted too). The files are in `flux/`, outside
`public/`. Nothing is written at run time.

Every figure comes from an official source and carries a provenance record
(publisher, dataset, the exact cell, query or page, retrieval date, licence).
Nothing is estimated: where a source gives a total but not its parts, the
remainder is a "non détaillé" edge; where it names no counterpart, the
counterpart is a widened node ("acheteurs de biens et services" for VAT,
"créanciers" for interest). The pipeline in `flux-pipeline/` does the work:

- `run.cjs` fetches the files (cached under `data/flux/raw/<source>/` with a
  manifest of URL, date and sha256; the root `.gitignore` ignores any `data/`
  folder, which is why the emitted shards live in `flux/graph/` instead),
  parses them, builds the graph, validates it and emits the shards.
  `--offline` uses the cache only, `--years 2021-2024` limits the years,
  `--out <dir>` writes elsewhere, `--release <id>` names the release.
- `lib/` holds the readers written for the job: `xlsx.cjs` (the zip and the
  cells of an .xlsx, no dependency), `csv.cjs` (streaming, quoted newlines),
  `eurostat.cjs` (JSON-stat), `ods.cjs` (Opendatasoft exports with server
  side `group_by`), `pdf.cjs` (`pdftotext -layout` rows; poppler must be
  installed on the build machine), `units.cjs` (every amount is an integer
  number of thousands of euros, rounded half to even), `provenance.cjs` and
  `graph.cjs`.
- `parsers/` turn one official file into facts; `build/macro.cjs` turns the
  facts into the graph: the sub-sectors of S13 (État, ODAC, communes,
  départements, régions, syndicats, ODAL, régimes sociaux, hôpitaux) and
  every flow in and out of them per year, from the Insee tables 3.201–3.214,
  the Insee TEE (who pays which tax) and Eurostat gov_10a_main (wages vs
  contributions, VAT, household vs corporate income taxes, old-age vs
  unemployment benefits, flows with the EU institutions).

The State budget is a second basis (`budget-plf`, 2025): `parsers/vm-tome1.cjs`
reads the summary of net receipts (income tax, corporate tax, energy excise,
VAT, other taxes, non-tax receipts) and the two prélèvements sur recettes
(local authorities, EU budget) from the text of the Voies et moyens tome I
annex, page and line cited, and refuses a summary that does not add up;
`build/budget.cjs` takes the PLF 2025 dataset by destination and nature
(`plf25-depenses-2025-du-bg-et-des-ba-selon-nomenclatures-destination-et-nature`,
general budget only, without the mission Remboursements et dégrèvements
since receipts are net of it) and hangs every line under the State:
missions, programmes, actions, sous-actions, each line going to the class
of beneficiary its catégorie names (`mappings/titres.json`: rémunérations
to the public employees, subventions pour charges de service public to the
opérateurs, intérêts to the creditors, transferts aux ménages, aux
entreprises, aux collectivités…). The balance is a computed residual
(`SOLDE`, flagged `computed`): the general budget's spending and
prélèvements less its net receipts. Budgets annexes and comptes spéciaux
are not in it, and the index says so.

The local authorities are a third basis (`local-ofgl`, 2024):
`build/local.cjs` reads the OFGL consolidated bases (comptes de gestion of
the communes, intercommunalités à fiscalité propre, départements and
régions, main and annex budgets with cross flows neutralised) through the
portal's server-side sums, and hangs under the OFGL root the four types,
then the départements and régions as entities and the communes and
intercommunalités grouped by département and région. The receipts and
expenses are the OFGL aggregates that partition the totals
(`mappings/ofgl.json`: impôts locaux from the local taxpayers, DGF and
FCTVA from the State, frais de personnel to the public employees, achats
and équipement to the suppliers, intérêts to the creditors, subventions
aux personnes de droit privé…); the fiscal reversals between communes and
their intercommunalité are a signed counterpart; the year's change in
working capital closes the balance. An intercommunalité can sit in two
régions and the portal's group_by counts it twice, so those groups are
summed from the entity rows by the first région named. The 35 000 communes
and 1 300 intercommunalités are entities under their group, emitted as
focus shards (`focus/<year>-<basis>/<group>.json`, nodes and edges
together, named in `index.json.shards.focus`) that the site fetches when
the group opens; a column with more than forty members of one group keeps
its largest and folds the rest into "Autres (n)", a sum of the same
figures.

Social protection is a fourth basis (`cps`, 2021 to 2024, hub `PS`), from
the DREES comptes de la protection sociale, which cover every régime,
public and private (`build/social.cjs`, `mappings/cps.json`). The
workbook attached to the dataset gives the resources (contributions by
payer, earmarked taxes, public contributions…) and the uses other than
benefits, for the total and for four groups of régimes, transfers between
régimes excluded; the open dataset gives the benefits by institutional
sector down to each régime and by risk down to each benefit (about 230
of them). The benefits are a tree on the beneficiary side (`PREST`), split
by risk under the total, each group, each sector and each régime, so the
right column opens whatever the level of the middle one. The balance
(resources minus uses) is a computed residual; per group it also holds the
transfers between régimes, and says so. The builder stops if the lines do
not add up to the published totals or if the dataset and the workbook
disagree on the benefits. The workbook's "ajustement comptable" line is
outside its totals and is not drawn.

The graph model (`flux/graph/r/<release>/`): `nodes.json` (trees of
sectors and counterpart classes, with per-year totals), `provenance.json`,
and one `edges/<year>-<basis>.json` per year and accounting basis (`sna`
for the national accounts with S13 as the hub, `budget-plf` for the State
budget with S13111 as the hub; `index.json.bases` names each basis's root,
years and perimeter).
An edge is one figure (`keur`) between two nodes for one operation (`op`,
ESA codes: D61 cotisations, D62 prestations, D41 intérêts…). A root edge can
be refined by children that split its hub end (`split: to` for a receipt,
`from` for an expense) into the sub-sectors, its counterpart end into the
payer sectors, or its operation (`split: op`); the children of a split sum
to the parent, a residual edge to a `<node>.ND` child making up any gap.
`consolidated` on a parent is what the unconsolidated sub-sector figures
hold of flows between administrations; a child with `sign: -1` runs the
other way (a sub-sector in surplus under a deficit); `alt: tee` marks a
second root for the same flow seen from the TEE, used for the payer split
only; `intra` edges go through the `POOL` node (transfers between
administrations, each level with its own figure); `imputed` edges are
accounting entries with no money behind them. `index.json` names the
release, the years, the shards and the control totals.

The site (`flux/`, plain ES modules, no build step, no dependency) draws
the graph as a sankey of its own: `js/model.js` turns a view (year, basis,
which nodes are open, how fine the administrations column is, whether
operations are shown) into ribbons by walking the splits of every root
edge, the hub end first, then the counterpart, then the operation, and
drawing what the source cannot split as a "non ventilé" block; `js/view.js`
orders the three columns (payers, administrations, beneficiaries) in their
canonical order, so a node keeps its place across years and levels;
`js/layout.js` stacks the columns with one shared scale and slots the
ribbons (left to right everywhere; under 700 px the label gutters go and
the labels sit beside the bars, over the ribbons); `js/interpolate.js`
morphs one layout into the next, new nodes growing out of their parent;
`js/render-ribbons.js` paints the ribbons on a canvas with a hidden picking
canvas for hover, `js/render-nodes.js` draws the nodes as focusable SVG with
labels that hide under 11 px; `js/scene.js` ties them; `js/ui/panels.js`
holds the details (figures, operations, notes and the official sources of
every number), the sources panel, the table and the tooltip; a double
click, the "Isoler" button or `?f=<node>` focuses one node of the hub
tree, which becomes the hub with its own scale (a commune, a mission; in
the State budget its payer is then "budget général : financement non
affecté"), the chips leading back up; the address
bar carries the view (`?a=2024&b=local-ofgl&f=OFGL.COM.D29&h=2&x=S1313&o=1&n=apu:S13111&t=sombre`,
`js/url-state.js`) with a history entry per drill-down. The search box
(`js/search.js`, `/` to reach it) reads `search.json`, a shard of every
hub-tree node (administrations, missions, programmes, actions, and the
36 000 communes and intercommunalités) emitted by the pipeline and loaded
on the first keystroke; a result switches to the node's basis, loads its
focus shard and isolates it. Zoom (`?z=`, 1 to 8)
makes the chart taller rather than scaling it: the page scrolls through it,
the text keeps its size, thin flows get room and a label, and labels of
tall bars follow the part that is on screen. It is driven by the − / % / +
cluster stuck to the bottom of the screen, the + − 0 keys, a two-finger
pinch and ctrl + wheel; the canvas backing store is capped at 12 M pixels. The tagged css and
js carry `?v=flux-N`; bump it together with `TAG` in `sw.js` on every
change (the unit check compares the three).

Benchmark (`flux/bench/`, `scripts/bench-flux-setup.sh` fetches d3-sankey
and ECharts into the gitignored `flux/bench/vendor/`, `npm run bench:flux`
runs every candidate and scenario in Chromium, desktop and a 4× throttled
phone, and writes `scripts/flux-bench-report.json`). On 2026-11-09, with the
real shards, the site's own renderer laid out and painted level 2 (27
nodes, 115 ribbons) in 0.8 + 1.6 ms on the desktop and 3.6 + 8 ms on the
throttled phone, d3-sankey on SVG in 1.6 + 1.9 ms and 4.3 + 6.5 ms, ECharts
in 0.1 + 24 ms and 0.2 + 91 ms. Frames while relaying out every frame were
at the 16.7 ms budget on the desktop for all three up to level 1, ECharts
falling behind from level 2; on the throttled phone none holds 16.7 ms
(d3 33–50 ms, the site 50–117 ms, ECharts 83 ms to 2.8 s). The site's own
engine stays because the drill-down needs what the libraries lack (stable
ordering, splits that sum, "non ventilé" blocks, a vertical layout) and
because its transitions interpolate precomputed layouts, so a frame costs
the paint only (4–8 ms on the throttled phone); the picking canvas is
drawn once the motion settles.

```sh
npm run flux:build              # fetch, build, validate, emit (node --no-warnings flux-pipeline/run.cjs)
node scripts/check-flux.cjs --unit
node scripts/check-flux.cjs --data
HOUSE_TEST_TOOLS=/tmp/malik-test-tools/node_modules npm run test:flux
HOUSE_TEST_TOOLS=/tmp/malik-test-tools/node_modules npm run bench:flux
```

The data check reads `flux/graph` and fails on any non-integer, unsourced
or unbalanced figure, and when the S13 expenses or receipts stray from
Eurostat's totals by more than 0.1 %. The browser check starts its own
server on port 8098 and drives the landing, a drill-down and its address,
the levels, the details and their sources, the panels, the keyboard, the
theme, a shared link and the phone layout. Deployment is in
`../deploy/README.md`.

# Royal Game of Ur artwork and performance

The Brussels Art Nouveau interior is drawn in `public/urGarden.js` as three SVG
layers: timber and stained glass, fitted joinery, and ambient shading.
Substantial walnut stiles and rails support the connected brass tracery. Amber
and moss glass and brass highlights use reusable vector patterns
and gradients. Fine, irregular wood grain is baked into one small, shared WebP
tile at twice its display resolution, avoiding repeated vector grain rendering
on mobile and live noise filters. Geometry is built once and reused at every viewport size; resizing only
updates the viewBox, pattern placement, and dado height.

The board image is transparent around the shell inlays. The table has a walnut
surface, a substantial brass edge, and continuous brass vine borders joined to
arched inset panels, iris inlays, and glass fanlights. The room and table share
the same seeded wood and brass material definitions. These ornaments are inline
vectors; the wood grain, textured board, and counter sprites are pre-rendered.
The room, ornament, and counters stay still while idle. Canvas drawing is requested
only for interaction, shared game updates, or changes to the canvas dimensions.
The animation loop runs only while the dice are rolling, and updates the dice
preview without continually redrawing the canvases.

`ur-artwork.js` contains the inlay and counter artwork source, and `urGarden.js`
contains the shared wood grain source.
`build-ur-artwork.cjs` renders it, compresses it, writes filenames containing
content hashes, and updates the HTML and `ur-artwork-manifest.json`. Keep earlier
published hashes available for clients that still have an older page open.

Install the build and benchmark tools outside the application's runtime dependencies:

```sh
npm install --prefix /tmp/ur-tools playwright@1.51.1 sharp@0.34.4
node /tmp/ur-tools/node_modules/playwright/cli.js install --with-deps chromium
export UR_BUILD_TOOLS=/tmp/ur-tools/node_modules
npm run build:ur-art
npm run test:ur:garden
npm run test:ur:performance
```

Both checks default to the live HTTPS page. To validate working-tree changes,
run `npm start` in another terminal and set
`UR_BASE_URL=http://127.0.0.1:8080/urBoard.html` before running the checks.

The benchmark runs 40 cold-cache loads each on desktop and mobile profiles against
the live HTTPS page. Both profiles use 4 Mbps download, 1 Mbps upload, and 40 ms
simulated request latency. Mobile also uses a 4× CPU slowdown and a retina viewport.
It fails if p95 reaches 1,000 ms or fewer than 95% of loads finish below 1,000 ms.

The `ur-ready` performance mark measures navigation to the first painted,
connected table: board and grain tile decoded, vector room generated and painted, counters
received and painted, and the shared socket connected. Decorative motion begins after this first frame.
The generated `ur-performance-report.json` contains all samples and test settings.
This is a controlled benchmark; actual visitor p95 depends on their devices and
networks and requires visitor measurements.

The garden check covers vector materials, one shared grain download, bounded geometry, geometry reuse,
retina viewports, rapid resizing, reduced motion, and removal of leaf bitmap
requests.

Use `UR_BASE_URL`, `UR_PERF_RUNS`, `UR_PERF_LATENCY`, and `UR_PERF_MBPS` to change
the benchmark target or profile. Run the benchmark without other browser tests
running at the same time.

The tracked nginx configuration serves hashed artwork directly with immutable
one-year caching and configures compression for JavaScript and CSS. Other requests,
including the game HTML, are proxied to the application.
