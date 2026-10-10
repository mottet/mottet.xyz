# House navigation

The five projects are rooms in a two-floor Art Nouveau house. `houseScene.js`
draws the entrance hall and landing with reusable vectors, using the existing
walnut texture. The doors keep the original project URLs. Floor changes use URL
hashes so links, reloads, and browser Back all restore the right floor.
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
HOUSE_TEST_TOOLS=/tmp/ur-tools/node_modules npm run test:house
```

Set `HOUSE_BASE_URL` to check another server. The check covers real journeys
through all five doors, floor history, return routes, current-room indication,
keyboard focus, canvas input isolation, mobile layout, and reduced motion.

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
