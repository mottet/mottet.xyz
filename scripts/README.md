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
tokens cross, the reaction blooms and the rings answer one badge at a time;
against the monster the next sheet waits for a Next round button, between
phones the server allows fourteen seconds and the page counts them down, and
the end of a duel is a card inside the battlefield rather than an overlay
(reduced motion swaps without animating).
Only the reaction is shown:
tokens for what each side cast slide to the centre and a named reaction blooms
(inferno, steam, lava, fanned, reflected, mud, rain, quake, pass, breaks back,
leaps the ring...), marks land on the two bodies, and an `aria-live` line
narrates it. The shapes are never written down in the game. While drawing, the
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
any natural element. The five elements form a
pentagram, the one arrangement of five in which every element beats two and
is beaten by two: round the rim Flame > Iron > Stone > Wind > Wave > Flame
(melts, split, breaks, spray, steam) and across the star Flame > Stone, Iron >
Wind, Stone > Wave, Wind > Flame, Wave > Iron (lava, cleft, mud, fanned,
rust); the loser of any arrow is struck by the winner's element, and no pair
is left undecided. The engine still understands a quench (both spells undone,
both rings strong) and a pass (both land, both rings weak) for the forge. The
mirror turns the light elements, flame and wind, back into their caster's own
ring and is soaked, shattered or cut by the heavy ones. A ring answers a
compound with its better answer, so on this wheel only Frost pierces a ring
(a ring of flame, which both water and wind beat). Casting resolves the round at once: the monster has already
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
`loyalty` 3, less than a wound), so it casts Flame, Bolt and Magma, stands
behind a ring of flame when threatened, and strays to another element only
when nothing of fire can get through, as against a known ring of water. It
fumbles 15% of its glyphs and draws them weak, clean or perfect with odds
40/40/20. The unit check prints its cast mix and asserts it keeps to fire at
least 55% of the time and rings between 15% and 45%.

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
