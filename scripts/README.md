# House navigation

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

The five projects are rooms in a two-floor Art Nouveau house. `houseScene.js`
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
through all five doors, floor history, return routes, current-room indication,
keyboard focus, canvas input isolation, mobile layout, and reduced motion.
It also verifies uniform SVG scaling, stable object placement, a shared vanishing
point, and mobile touch targets across portrait, landscape, and wide viewports.

The tooling path above is where Playwright 1.51.1 currently lives on this
machine (the earlier `/tmp/ur-tools` and `/tmp/ur-visual-check` are gone).

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
