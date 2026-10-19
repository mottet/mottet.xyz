'use strict';

// A small, reusable vector set: the house stays crisp at every screen size.
// No render loop, WebGL, third-party fonts, or full-size bitmap backgrounds.
// The same world geometry is drawn through two cameras: a landscape view for
// wide screens and a taller portrait view for phones held upright.
(() => {
  const illustration = document.getElementById('house-illustration');
  if (!illustration) return;
  const views = {
    landscape: { width: 1200, height: 680, camera: { x: 600, horizon: 300, focal: 820, eye: 2.1 } },
    portrait: { width: 760, height: 940, camera: { x: 380, horizon: 410, focal: 700, eye: 2.1 } }
  };

  function renderer(view) {
    const { width: W, height: H, camera } = view;
    // All room geometry uses this one camera. World Y is height; Z is depth.
    // Keep the camera fixed when the viewport changes: only the SVG is scaled.
    // The nearest floor edge touches the sides or the bottom of the frame.
    const room = { halfWidth: 2.9, height: 4.1, back: 11.2, front: Math.min(camera.focal * 2.9 / camera.x, camera.focal * camera.eye / (H - camera.horizon)) };
    const timber = { x: 2.62, depth: 10, halfWidth: .085, halfDepth: .09 };
    const project = ([x, y, z]) => [camera.x + camera.focal * x / z, camera.horizon + camera.focal * (camera.eye - y) / z];
    const coords = p => p.map(n => Number(n.toFixed(3))).join(' ');
    const screenPath = points => 'M' + points.map(coords).join('L');
    const worldPath = points => screenPath(points.map(project));
    const polygon = (points, attributes = '') => `<path d="${worldPath(points)}Z" ${attributes}/>`;
    const line = (points, attributes = '') => `<path d="${worldPath(points)}" fill="none" ${attributes}/>`;
    const circlePoints = (x, y, z, radius, start = 0, sweep = Math.PI * 2, segments = 72) => Array.from({ length: segments + 1 }, (_, i) => {
      const a = start + sweep * i / segments;
      return [x + Math.cos(a) * radius, y, z - Math.sin(a) * radius];
    });
    const curvePoints = (points, count = 30) => Array.from({ length: count + 1 }, (_, i) => {
      const t = i / count, s = 1 - t;
      return [0, 1, 2].map(axis => s ** 3 * points[0][axis] + 3 * s ** 2 * t * points[1][axis] + 3 * s * t ** 2 * points[2][axis] + t ** 3 * points[3][axis]);
    });
    const floorOutline = [[-room.halfWidth, 0, room.front], [-room.halfWidth, 0, room.back], [room.halfWidth, 0, room.back], [room.halfWidth, 0, room.front]];
    const ceilingOutline = floorOutline.map(([x, , z]) => [x, room.height, z]);

    // HTML inside foreignObject preserves the perspective divide for SVG art.
    // Every line along a side wall converges on the same horizon as the floor.
    function wallArtwork(markup, { right = false, near, far, height, width = 220, artHeight = 450, className = '', attributes = '' }) {
      const x = (right ? 1 : -1) * room.halfWidth;
      const depth = (far - near) / (width * near);
      const origin = project([x, height, near]);
      const matrix = [camera.x * depth, camera.horizon * depth, 0, depth, 0, camera.focal * height / (artHeight * near), 0, 0, 0, 0, 1, 0, ...origin, 0, 1];
      return `<foreignObject width="${W}" height="${H}" style="overflow:visible"><div xmlns="http://www.w3.org/1999/xhtml" class="${className}" ${attributes} style="position:absolute;left:0;top:0;width:${width}px;height:${artHeight}px;transform-origin:0 0;transform:matrix3d(${matrix.join(',')})"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${artHeight}" width="${width}" height="${artHeight}" style="overflow:visible" focusable="false">${markup}</svg></div></foreignObject>`;
    }

    const defs = `<defs>
    <linearGradient id="h-wall-left" x2="1" y2=".2"><stop stop-color="#6d7560"/><stop offset=".5" stop-color="#9c9d82"/><stop offset="1" stop-color="#bdb797"/></linearGradient>
    <linearGradient id="h-wall-right" x2="1" y2="0"><stop stop-color="#aca98a"/><stop offset="1" stop-color="#4f5e4a"/></linearGradient>
    <linearGradient id="h-wall-back" x2="0" y2="1"><stop stop-color="#c3bfa0"/><stop offset="1" stop-color="#a3a485"/></linearGradient>
    <linearGradient id="h-wood" x2="1" y2=".1"><stop stop-color="#403025"/><stop offset=".25" stop-color="#80543c"/><stop offset=".47" stop-color="#5d3e2c"/><stop offset=".75" stop-color="#896043"/><stop offset="1" stop-color="#362a20"/></linearGradient>
    <pattern id="h-grain" width="256" height="512" patternUnits="userSpaceOnUse"><image href="/assets/ur/walnut-c5c3c1369b.webp" width="256" height="512" opacity=".78"/>
      <path d="M22 0C31 110 8 138 24 252S14 413 22 512M67 0C51 102 80 162 66 261S75 424 67 512M118 0C135 105 110 150 120 267S102 433 118 512M171 0C152 127 188 157 174 269S187 412 171 512M226 0C240 97 213 146 229 273S212 418 226 512" fill="none" stroke="#2d1c13" stroke-width=".8" opacity=".2"/>
      <path d="M26 0C35 110 12 138 28 252S18 413 26 512M122 0C139 105 114 150 124 267S106 433 122 512M230 0C244 97 217 146 233 273S216 418 230 512" fill="none" stroke="#e5ba7b" stroke-width=".7" opacity=".12"/>
    </pattern>
    <linearGradient id="h-brass" x2=".8" y2="1"><stop stop-color="#ede0a6"/><stop offset=".3" stop-color="#af9c61"/><stop offset=".55" stop-color="#796338"/><stop offset=".8" stop-color="#d5bd78"/><stop offset="1" stop-color="#8a7148"/></linearGradient>
    <linearGradient id="h-glass" x2=".6" y2="1"><stop stop-color="#e3d7a4"/><stop offset=".3" stop-color="#c2c49a"/><stop offset=".65" stop-color="#839d7b"/><stop offset="1" stop-color="#45664f"/></linearGradient>
    <linearGradient id="h-dusk" x2="0" y2="1"><stop stop-color="#e9c0ad"/><stop offset=".4" stop-color="#cf9fac"/><stop offset=".75" stop-color="#9a8aa3"/><stop offset="1" stop-color="#6d7691"/></linearGradient>
    <linearGradient id="h-rose" x2=".7" y2="1"><stop stop-color="#e6c6b3"/><stop offset=".5" stop-color="#c58f8c"/><stop offset="1" stop-color="#9c6f72"/></linearGradient>
    <linearGradient id="h-floor" x2="0" y2="1"><stop stop-color="#b6b18d"/><stop offset="1" stop-color="#858669"/></linearGradient>
    <radialGradient id="h-light"><stop stop-color="#fff1c2" stop-opacity=".72"/><stop offset=".5" stop-color="#ffdf9a" stop-opacity=".18"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>
    <radialGradient id="h-warm"><stop stop-color="#ffcf7e" stop-opacity=".34"/><stop offset=".6" stop-color="#f3b76a" stop-opacity=".09"/><stop offset="1" stop-color="#f3b76a" stop-opacity="0"/></radialGradient>
    <radialGradient id="h-shade" cx=".5" cy=".4" r=".72"><stop offset=".18" stop-color="#15261d" stop-opacity="0"/><stop offset=".7" stop-color="#13231b" stop-opacity=".42"/><stop offset="1" stop-color="#0d1a14" stop-opacity=".84"/></radialGradient>
    <filter id="h-wallpaper-palette" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feColorMatrix type="matrix" values="
        .290552 .371904 .037544 0 .12
        .112678 .499056 .038266 0 .16
        .093544 .314688 .151768 0 .10
        0 0 0 1 0"/>
    </filter>
    <pattern id="h-wallpaper" width="160" height="${160 * 1237 / 1233}" patternUnits="userSpaceOnUse">
      <svg width="160" height="${160 * 1237 / 1233}" viewBox="114 0 1233 1237" preserveAspectRatio="xMidYMid meet" overflow="hidden">
        <image href="/assets/house/botanical-wallpaper-adeo.jpeg" width="1347" height="1500" filter="url(#h-wallpaper-palette)"/>
      </svg>
    </pattern>
    <pattern id="h-wallpaper-back" href="#h-wallpaper" patternTransform="scale(${camera.focal / room.back / 100})"/>
    <pattern id="h-landing-wallpaper" width="52" height="97.5" patternUnits="userSpaceOnUse">
      <g transform="scale(.65)">
      <rect width="80" height="150" fill="#d2c9b2"/>
      <path d="M8 0V150M24 0V150M56 0V150M72 0V150" stroke="#eee4cb" stroke-width=".6" opacity=".28"/>
      <path d="M40 0C19 23 61 51 40 75C19 99 61 127 40 150M40 75C10 66 7 37 16 25M40 75C70 66 73 37 64 25" fill="none" stroke="#929582" stroke-width="1.1"/>
      <g fill="#a3ac98" stroke="#8a927e" stroke-width=".7">
        <path d="M30 38C14 40 9 26 16 17C29 22 31 31 30 38ZM49 52C67 49 70 60 65 68C54 66 48 60 49 52ZM30 112C15 110 13 95 21 89C31 94 34 104 30 112ZM47 127C63 123 68 136 60 143C50 140 47 134 47 127Z"/>
      </g>
      <g fill="#c2ac99" stroke="#a3917e" stroke-width=".7">
        <path d="M40 77C26 64 30 52 40 45C50 52 54 64 40 77ZM39 76C24 78 18 67 22 58C33 59 39 67 39 76ZM41 76C56 78 62 67 58 58C47 59 41 67 41 76Z"/>
      </g>
      <path d="M40 53V83M32 68Q40 80 48 68" fill="none" stroke="#aa9671" stroke-width=".8"/>
      <path d="M0 106Q8 101 16 106M64 106Q72 101 80 106" fill="none" stroke="#b6ac92" stroke-width=".6"/>
      </g>
    </pattern>
    <pattern id="h-landing-wallpaper-back" href="#h-landing-wallpaper" patternTransform="scale(${camera.focal / room.back / 100})"/>
    <linearGradient id="h-plaster" x2="0" y2="1"><stop stop-color="#dfd5bd"/><stop offset="1" stop-color="#b6b39a"/></linearGradient>
    <clipPath id="h-back-wallpaper-clip"><path d="${worldPath([[-room.halfWidth, room.height, room.back], [room.halfWidth, room.height, room.back], [room.halfWidth, 1, room.back], [-room.halfWidth, 1, room.back]])}Z"/></clipPath>
    <pattern id="h-tesserae" width="9" height="9" patternUnits="userSpaceOnUse"><path d="M0 0H9V9H0Z" fill="none" stroke="#465442" stroke-width=".5" opacity=".24"/><path d="M2 2h3v3H2Z" fill="#f1e9bb" opacity=".15"/></pattern>
    <pattern id="h-glass-speckle" width="33" height="47" patternUnits="userSpaceOnUse"><path d="m3 7 5-1m11 12 2 2m-13 13 4-2m13 9 4-1m-3-34 1 3" stroke="#fff9d4" stroke-width=".7" opacity=".25"/></pattern>
    <pattern id="h-ripple-glass" width="74" height="112" patternUnits="userSpaceOnUse">
      <path d="M17 0C-3 18 37 30 23 53C5 79 30 86 17 112M52 0C70 21 32 35 49 58C69 81 37 96 52 112" fill="none" stroke="#faf1ce" stroke-width="1.3" opacity=".2"/>
      <path d="M21 0C1 18 41 30 27 53C9 79 34 86 21 112M56 0C74 21 36 35 53 58C73 81 41 96 56 112" fill="none" stroke="#425841" stroke-width=".8" opacity=".12"/>
      <path d="M9 14Q28 12 22 31Q4 33 9 14ZM43 69Q61 57 63 77Q47 86 43 69ZM31 95Q42 82 46 101Q37 109 31 95Z" fill="#fff6d5" opacity=".065"/>
    </pattern>
    <pattern id="h-brass-patina" width="43" height="67" patternUnits="userSpaceOnUse"><path d="m6 12 8-2 4 3m7 25 7-1m-22 20 6-2m15-44 4-1" fill="none" stroke="#62785c" stroke-width="2" opacity=".25"/></pattern>
    <g id="h-iris" stroke="url(#h-brass)" stroke-width="1.5"><path d="M0 3C-14-12-10-33 0-42C10-33 14-12 0 3Z" fill="#bca479"/><path d="M0-5C-8-30-29-28-33-14C-36-2-18-9-16 5C-12 15-3 7 0-5ZM0-5C8-30 29-28 33-14C36-2 18-9 16 5C12 15 3 7 0-5Z" fill="#baa589"/><path d="M0 1C-13 14-4 24-19 29C-7 34 0 17 0 10C0 17 7 34 19 29C4 24 13 14 0 1Z" fill="#6b815a"/><path d="M0-34V30" fill="none"/></g>
    <g id="h-sconce"><ellipse cy="-30" rx="150" ry="160" fill="url(#h-warm)"/><ellipse cy="-34" rx="70" ry="74" fill="url(#h-light)"/><ellipse rx="6" ry="15" fill="url(#h-brass)" stroke="#685737" stroke-width="1"/><path d="M0 8V-27M0-13C-22-15-28-23-23-38M0-13C22-15 28-23 23-38" fill="none" stroke="#665331" stroke-width="3"/><path d="M0 8V-27M0-13C-22-15-28-23-23-38M0-13C22-15 28-23 23-38" fill="none" stroke="#c0ac73" stroke-width="1"/><path d="M-36-36C-31-56-15-56-10-36Q-23-29-36-36ZM10-36C15-56 31-56 36-36Q23-29 10-36Z" fill="#f1e2b4" stroke="#aa975e" stroke-width="1.2"/><path d="M-23-50V-34M23-50V-34" stroke="#b5a472" stroke-width=".7"/></g>
    <g id="h-foliage"><g stroke="#6a7950" stroke-width="3" fill="#415d40"><path d="M0 0C-5-40-50-66-52-100C-25-98-3-54 0 0ZM0 0C3-45 44-64 54-95C25-91 8-55 0 0ZM0 0C-6-66-23-105-5-150C12-121 0-74 0 0ZM0-10C-15-25-76-18-81-53C-37-53-20-32 0-10ZM0-12C19-40 47-37 79-53C70-21 36-23 0-12Z"/><path d="M0 0V-136M0 0Q-6-60-48-94M0 0Q10-54 50-90" fill="none" stroke="#97a476" stroke-width="1"/></g></g>
    <clipPath id="h-floor-clip"><path d="${worldPath(floorOutline)}Z"/></clipPath>
  </defs>`;

    // The rooms differ through fitted joinery and silhouette. Their clues are
    // small engravings in a shared walnut, aged brass, and quiet glass palette.
    const doorPersonalities = {
      studio: {
        glassTones: ['#dbceb0', '#bab098', '#9b9d83'], foliageTone: '#a7ab7f',
        organic: `<path d="M93 187C80 181 73 164 79 151C95 155 99 176 93 187ZM128 181C133 162 154 153 161 159C152 176 140 175 128 181ZM68 146C54 144 49 130 55 119C70 123 75 138 68 146Z"/>
        <path d="M102 74C105 62 119 57 128 64C127 76 112 79 102 74Z" fill="#c6a997"/>`,
        carving: `<path d="M54 406C64 389 52 377 65 362C83 343 68 323 87 305M65 362C80 361 88 350 87 341C73 342 70 352 65 362ZM82 321C70 318 65 309 69 301C81 304 78 314 82 321ZM157 399C147 385 163 378 153 366C141 353 152 344 145 335"/>`,
        frame: 'M0 450V112C0 40 49 16 105 28C159 6 220 49 220 112V450Z',
        leaf: 'M11 450V115C11 51 53 32 106 43C155 23 209 60 209 115V450Z',
        pane: 'M35 227V120C35 74 66 61 106 70C145 54 185 82 185 123V227Z',
        panel: 'M33 263C67 250 79 286 111 269C142 253 164 257 187 271V421H33Z',
        tracery: `<path d="M35 151C72 121 80 211 119 189C152 171 154 113 185 135M35 189C66 164 71 218 105 227"/>
        <path d="M66 94C76 85 89 88 103 99" stroke-width="1.2" opacity=".45"/>`,
        clue: `<path d="M75 207C97 206 85 174 107 169C131 164 123 146 145 139"/>
        <path d="M135 152L143 131Q143 123 149 119Q152 128 148 134L140 154Z" fill="none"/>`,
        joinery: `<path d="M45 407V284C74 275 86 305 112 288C137 274 157 277 175 287V407Z"/>
        <path d="M62 366C91 353 110 381 146 354" opacity=".4"/>`
      },
      salon: {
        glassTones: ['#cbd0bc', '#a3b7aa', '#81978e'], foliageTone: '#a6b89a',
        organic: `<path d="M38 120C35 106 44 93 55 95C60 111 46 115 38 120ZM82 120C96 125 100 144 91 151C80 145 80 132 82 120ZM138 120C124 125 120 144 129 151C140 145 140 132 138 120ZM182 120C185 106 176 93 165 95C160 111 174 115 182 120Z"/>
        <path d="M36 221C53 214 60 225 67 228C55 242 42 238 36 221ZM184 221C167 214 160 225 153 228C165 242 178 238 184 221Z" fill="#c2b38c"/>`,
        carving: `<path d="M46 406C58 387 42 371 55 357C70 341 61 325 77 308M55 357C71 356 79 345 75 336C62 338 61 349 55 357ZM174 406C162 387 178 371 165 357C150 341 159 325 143 308M165 357C149 356 141 345 145 336C158 338 159 349 165 357Z"/>`,
        frame: 'M-12 450V80C-12 18 232 18 232 80V450Z',
        leaf: 'M-1 450V90C-1 38 221 38 221 90V450Z',
        pane: 'M18 254V106C18 79 69 55 104 62V254ZM116 62C151 55 202 79 202 106V254H116Z',
        panel: 'M18 288Q61 273 104 288V419H18ZM116 288Q159 273 202 288V419H116Z',
        tracery: `<path d="M18 116C57 132 70 93 104 115M116 115C150 93 163 132 202 116M18 224C56 206 73 247 104 232M116 232C147 247 164 206 202 224"/>`,
        clue: `<g transform="translate(61 175)">
        ${Array.from({ length: 8 }, (_, i) => `<path d="M0 0C-5-3-5-12 0-16C5-12 5-3 0 0Z" transform="rotate(${i * 45})"/>`).join('')}
        <circle r="3"/></g>
        <path d="m155 160 12 15-12 15-12-15Z"/>`,
        joinery: `<path d="M110 54V450" stroke="#332b22" stroke-width="9"/>
        <path d="M110 55V450" stroke-width="1.5"/>
        <path d="M30 406V302Q61 291 92 302V406ZM128 406V302Q159 291 190 302V406Z"/>`,
        handle: `<path d="M101 266v35M119 266v35" stroke-width="3"/>
        <circle cx="101" cy="277" r="3"/><circle cx="119" cy="277" r="3"/>`
      },
      garden: {
        // A round-headed garden door, with a whiplash stem in the glass.
        glassTones: ['#d7d5af', '#b7c299', '#92a77e'], foliageTone: '#98af79',
        organic: `<path d="M76 197C60 187 58 164 66 152C81 157 85 181 76 197ZM144 197C160 187 162 164 154 152C139 157 135 181 144 197ZM95 269C78 269 71 253 74 244C89 244 97 259 95 269ZM125 269C142 269 149 253 146 244C131 244 123 259 125 269ZM67 307C56 294 58 281 68 278C81 289 77 301 67 307ZM153 307C164 294 162 281 152 278C139 289 143 301 153 307Z"/>
        <use href="#h-iris" transform="translate(110 92) scale(.3)" opacity=".7"/>`,
        carving: `<path d="M62 405C80 387 97 412 110 397C123 412 140 387 158 405M81 399C79 390 89 388 96 395M139 399C141 390 131 388 124 395"/>`,
        frame: 'M12 450V124C12 58 56 10 110 10C164 10 208 58 208 124V450Z',
        leaf: 'M24 450V128C24 72 62 26 110 26C158 26 196 72 196 128V450Z',
        pane: 'M45 356V146C45 96 76 52 110 52C144 52 175 96 175 146V356Z',
        panel: 'M43 385Q110 370 177 385V423H43Z',
        tracery: `<path d="M110 52V120C110 159 72 177 75 213C78 249 110 254 110 290V356M110 120C110 159 148 177 145 213C142 249 110 254 110 290"/>
        <path d="M45 309C72 290 80 321 110 319C140 321 148 290 175 309"/>`,
        clue: `<path d="M84 222C93 205 120 204 126 222C132 241 105 252 98 237C90 222 112 217 114 228"/>
        <path d="M75 213C62 207 60 192 67 185C81 190 78 205 75 213ZM145 213C158 207 160 192 153 185C139 190 142 205 145 213Z"/>`,
        joinery: `<path d="M56 411V395Q110 385 164 395V411Z"/>
        <path d="M110 382V420" stroke-width="1"/>`,
        handle: `<path d="M182 277C196 277 195 300 181 301M182 287C174 282 174 274 177 271" stroke-width="2.5"/>`
      },
      music: {
        glassTones: ['#d6c9b5', '#baaaa4', '#a09399'], foliageTone: '#b5a5a1',
        organic: `<path d="M75 133C59 124 60 103 69 98C83 108 82 123 75 133ZM145 133C161 124 160 103 151 98C137 108 138 123 145 133ZM105 185C92 181 86 167 92 156C107 159 110 176 105 185ZM115 185C128 181 134 167 128 156C113 159 110 176 115 185Z"/>
        <path d="M60 251C75 240 89 244 95 253C81 262 70 258 60 251ZM160 251C145 240 131 244 125 253C139 262 150 258 160 251Z" fill="#baa981"/>`,
        carving: `<path d="M58 403C70 386 55 373 68 359C80 346 85 354 91 339M68 359C56 359 53 347 57 341C69 343 71 352 68 359ZM162 403C150 386 165 373 152 359C140 346 135 354 129 339M152 359C164 359 167 347 163 341C151 343 149 352 152 359Z"/>`,
        frame: 'M0 450V156C-15 126-3 85 18 59C54 9 166 9 202 59C223 85 235 126 220 156V450Z',
        leaf: 'M11 450V159C-2 119 11 89 29 67C62 25 158 25 191 67C209 89 222 119 209 159V450Z',
        pane: 'M58 293V174C33 155 33 105 58 83C88 54 132 54 162 83C187 105 187 155 162 174V293Z',
        panel: 'M35 334C70 307 150 307 185 334V419H35Z',
        tracery: `<path d="M110 63C110 102 75 102 75 133C75 164 110 158 110 199V293M110 199C110 158 145 164 145 133C145 102 110 102 110 63"/>
        <path d="M58 250C85 235 135 265 162 249"/>`,
        clue: `<path d="M104 227C88 211 95 193 112 192C127 191 130 208 118 212C106 218 100 195 108 179"/>
        <path d="M59 256C90 243 130 269 161 258M59 263C90 250 130 276 161 265" stroke-width=".8"/>`,
        joinery: `<path d="M48 405V344C78 327 142 327 172 344V405Z"/>
        <path d="M77 343V405M93 338V405M110 337V405M127 338V405M143 343V405" stroke="#947a52" stroke-opacity=".35" stroke-width="1.3"/>`
      },
      laboratory: {
        glassTones: ['#cbd5be', '#a7bfb0', '#8daaa0'], foliageTone: '#9db6a0',
        organic: `<path d="M75 139C59 144 55 127 64 117C78 120 79 131 75 139ZM145 133C154 118 166 120 169 130C160 143 149 143 145 133Z"/>
        <path d="M110 109C94 107 89 94 96 89C109 91 115 103 110 109Z" fill="#c3b994"/>`,
        carving: `<path d="M95 407C81 384 101 367 91 345C81 323 101 304 91 280C85 261 96 243 91 225M91 345C103 341 110 327 103 320C90 325 91 336 91 345ZM92 283C78 279 75 265 81 259C94 263 96 274 92 283Z"/>`,
        frame: 'M0 450V69Q0 28 41 28H179Q220 28 220 69V450Z',
        leaf: 'M11 450V77Q11 42 48 42H172Q209 42 209 77V450Z',
        pane: 'M47 131C47 67 173 67 173 131C173 195 47 195 47 131Z',
        panel: 'M34 422V259C34 208 83 218 83 258V422ZM104 228H186V422H104Z',
        tracery: `<path d="M48 129C75 146 92 106 110 110C128 106 145 146 172 129"/>
        <path d="M110 84C110 101 106 108 110 126C114 140 111 157 110 178" stroke-width="1.5"/>`,
        clue: `<circle cx="88" cy="136" r="3"/><circle cx="129" cy="120" r="5"/><circle cx="142" cy="140" r="2"/>
        <path d="M119 136Q124 148 136 152"/>`,
        joinery: `<path d="M45 407V264C45 227 72 234 72 264V407ZM116 241H174V407H116Z"/>
        <path d="M34 208C73 207 72 177 104 189C133 201 164 185 186 204" stroke-width="1.5"/>`
      }
    };

    // A carved whiplash surround grows from the floor, over every door head.
    const surround = 'M-8 450V150C-8 80 34 44 70 22C92 8 104-6 110-24C116-6 128 8 150 22C186 44 228 80 228 150V450';
    const surroundCurls = 'M70 22C44 14 34-8 52-24C62-12 60 6 70 22ZM150 22C176 14 186-8 168-24C158-12 160 6 150 22ZM-8 190C-28 176-30 150-14 138C-2 152-2 172-8 190ZM228 190C248 176 250 150 234 138C222 152 222 172 228 190Z';

    function doorFor(roomName, { fine = false } = {}) {
      const art = doorPersonalities[roomName];
      // Clips follow each individual aperture, including the salon's paired panes.
      return `<defs><clipPath id="h-door-pane-${roomName}"><path d="${art.pane}"/></clipPath>
      <clipPath id="h-door-leaf-${roomName}"><path d="${art.leaf}"/></clipPath>
      <linearGradient id="h-door-glass-${roomName}" x2=".6" y2="1"><stop stop-color="${art.glassTones[0]}"/><stop offset=".45" stop-color="${art.glassTones[1]}"/><stop offset="1" stop-color="${art.glassTones[2]}"/></linearGradient></defs>
      <ellipse class="house-door-glow" cx="110" cy="250" rx="190" ry="270" fill="url(#h-light)"/>
      <path d="${surround}" fill="none" stroke="#3a2b20" stroke-width="${fine ? 5 : 7}" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${surround}" fill="none" stroke="url(#h-wood)" stroke-width="${fine ? 3 : 4.5}" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${surround}" fill="none" stroke="url(#h-brass)" stroke-width="${fine ? .8 : 1}" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/>
      <path d="${surroundCurls}" fill="#6a7a52" stroke="url(#h-brass)" stroke-width="${fine ? .8 : 1}" stroke-linejoin="round"/>
      <path d="${art.frame}" fill="#211f18" stroke="#362b20" stroke-width="${fine ? 9 : 18}"/>
      <path d="${art.frame}" fill="none" stroke="url(#h-wood)" stroke-width="${fine ? 6 : 14}"/>
      <path d="${art.frame}" fill="none" stroke="url(#h-brass)" stroke-width="${fine ? 1 : 1.5}"/>
      <path d="${art.frame}" fill="none" stroke="url(#h-brass-patina)" stroke-width="${fine ? 1.2 : 2}"/>
      <g class="house-leaf">
        <path d="${art.leaf}" fill="url(#h-wood)" stroke="#30291f" stroke-width="${fine ? 1.8 : 3}"/>
        <path d="${art.leaf}" fill="url(#h-grain)"/>
        <path d="${art.pane}" fill="url(#h-door-glass-${roomName})" stroke="#342e20" stroke-width="${fine ? 3.5 : 7}"/>
        <g clip-path="url(#h-door-pane-${roomName})">
          <g fill="${art.foliageTone}" fill-opacity=".45" stroke="#73815e" stroke-width="1.1" stroke-opacity=".6" stroke-linejoin="round">${art.organic}</g>
          <g fill="none" stroke="#6b6b56" stroke-width="${fine ? 1.8 : 2.5}" stroke-linecap="round" stroke-linejoin="round">${art.tracery}</g>
          <g fill="none" stroke="#777a63" stroke-opacity=".5" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">${art.clue}</g>
          <path d="M0 0H220V450H0Z" fill="url(#h-ripple-glass)" opacity=".7"/>
          <path d="M0 0H220V450H0Z" fill="url(#h-glass-speckle)" opacity=".8"/>
        </g>
        <path d="${art.pane}" fill="none" stroke="url(#h-brass)" stroke-width="1.2"/>
        <path d="${art.panel}" fill="#352e23" fill-opacity=".35" stroke="#aa8d59" stroke-opacity=".7" stroke-width="1.3"/>
        <g fill="none" stroke="url(#h-brass)" stroke-width="1.5" stroke-opacity=".72" stroke-linecap="round" stroke-linejoin="round">${art.joinery}</g>
        <g clip-path="url(#h-door-leaf-${roomName})" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <g stroke="#251c14" stroke-width="2.3" opacity=".5" transform="translate(0 1.3)">${art.carving}</g>
          <g stroke="#c2a16b" stroke-width="1.1" opacity=".5">${art.carving}</g>
        </g>
        <g fill="none" stroke="url(#h-brass)" stroke-width="2" stroke-linecap="round">${art.handle || '<path d="M186 281c-6 0-8 14-6 22s12 9 14 2c-8 0-10-8-8-16Z"/>'}</g>
      </g>
      `;
    }

    function woodPanelling(width) {
      // Dado panels with ogee heads and a single carved tendril each.
      const panels = Array.from({ length: Math.floor(width / 50) }, (_, i) => {
        const x = i * 50 + 7;
        return `<path d="M${x} 86V38C${x} 22 ${x + 9} 14 ${x + 18} 24C${x + 27} 14 ${x + 36} 22 ${x + 36} 38V86Z"/><path d="M${x + 18} 78C${x + 6} 62 ${x + 30} 50 ${x + 18} 32" stroke-width=".7" opacity=".7"/>`;
      }).join('');
      return `<rect width="${width}" height="100" fill="url(#h-wood)"/>
      <rect width="${width}" height="100" fill="url(#h-grain)"/>
      <rect width="${width}" height="7" fill="#59442f"/>
      <rect y="91" width="${width}" height="9" fill="#3e3225"/>
      <g fill="none" stroke="#aa8d59" stroke-width=".8" stroke-opacity=".55">${panels}</g>
      <g fill="none" stroke="url(#h-brass)" stroke-width="1.2"><path d="M0 1H${width}M0 6H${width}M0 92H${width}"/></g>`;
    }

    function backPanelling() {
      const origin = project([-room.halfWidth, 1, room.back]);
      const scale = camera.focal / room.back / 100;
      return `<g data-house-finish="back-panelling" transform="translate(${coords(origin)}) scale(${scale})">${woodPanelling(room.halfWidth * 2 * 100)}</g>`;
    }

    function sideWall(right, upstairs = false) {
      const width = (room.back - room.front) * 100, height = 410, panelTop = 310;
      return wallArtwork(`<rect width="${width}" height="${height}" fill="url(#h-wall-${right ? 'right' : 'left'})"/>
      <rect width="${width}" height="${panelTop}" fill="url(#${upstairs ? 'h-landing-wallpaper' : 'h-wallpaper'})"/>
      <rect width="${width}" height="${panelTop}" fill="url(#h-wall-${right ? 'right' : 'left'})" opacity="${right ? .34 : .28}"/>
      <g data-house-finish="side-panelling" transform="translate(0 ${panelTop})">${woodPanelling(width)}</g>`,
      { right, near: room.front, far: room.back, height: room.height, width, artHeight: height, attributes: `data-house-plane="${right ? 'right' : 'left'}-wall"` });
    }

    function ceilingMouldings(upstairs = false) {
      // One stepped cornice profile, mitred continuously around the three walls.
      const profile = [
        { drop: 0, inset: 0 }, { drop: .045, inset: .16 },
        { drop: .10, inset: .135 }, { drop: .15, inset: .09 },
        { drop: .225, inset: .04 }, { drop: .265, inset: .04 },
        { drop: .285, inset: 0 }
      ];
      const edge = ({ drop, inset }) => [
        [-room.halfWidth + inset, room.height - drop, room.front],
        [-room.halfWidth + inset, room.height - drop, room.back - inset],
        [room.halfWidth - inset, room.height - drop, room.back - inset],
        [room.halfWidth - inset, room.height - drop, room.front]
      ];
      const tones = upstairs ? ['#b7ad95', '#eee0c4', '#d8c9ac', '#c4baa0', '#e7d8bb', '#aca58b'] : ['#8f937a', '#d4c9ac', '#bcb297', '#aba78e', '#cbbea4', '#8a8e72'];
      const bands = profile.slice(1).map((section, i) => {
        const top = edge(profile[i]), bottom = edge(section);
        return [0, 1, 2].map(wall => polygon([top[wall], top[wall + 1], bottom[wall + 1], bottom[wall]], `fill="${tones[i]}"`)).join('');
      }).join('');
      return `<g data-house-finish="ceiling-mouldings">${bands}
      ${line(edge(profile[1]), 'stroke="#e8daba" stroke-width="1.1"')}
      ${line(edge(profile[4]), 'stroke="#e3d4b2" stroke-width=".9"')}
      ${line(edge(profile[6]), 'stroke="#57634c" stroke-width="1.6"')}
      ${line(edge({ drop: 0, inset: .24 }), 'stroke="#a69a71" stroke-width="1.1"')}
    </g>`;
    }

    function rosette() {
      // A mosaic rosette in the middle of the hall: twelve petals in rose and
      // sage inside a brass ring, with a smaller ring of cream petals.
      const cz = 7.0, R = 1.1;
      const at = (a, r) => [Math.cos(a) * r, 0, cz - Math.sin(a) * r];
      const petal = (a, r, w, fill, stroke) => polygon([...curvePoints([at(a, 0), at(a - w, r * .5), at(a - w * .35, r * .95), at(a, r)], 12), ...curvePoints([at(a, r), at(a + w * .35, r * .95), at(a + w, r * .5), at(a, 0)], 12)], `fill="${fill}" stroke="${stroke}" stroke-width="1.1"`);
      const petals = Array.from({ length: 12 }, (_, i) => petal(i * Math.PI / 6, R * .88, .4, i % 2 ? '#b98b86' : '#8b9b74', '#44563f')).join('');
      const inner = Array.from({ length: 12 }, (_, i) => petal(i * Math.PI / 6 + Math.PI / 12, R * .5, .32, '#dccfa6', '#8a7a52')).join('');
      return `${polygon(circlePoints(0, 0, cz, R + .14), 'fill="#c9bf9d" stroke="#3c5843" stroke-width="5"')}
      ${line(circlePoints(0, 0, cz, R + .02), 'stroke="url(#h-brass)" stroke-width="2.2"')}
      ${polygon(circlePoints(0, 0, cz, R - .06), 'fill="#d9d0ae" stroke="#5f7051" stroke-width="1"')}
      ${petals}${inner}
      ${polygon(circlePoints(0, 0, cz, .16), 'fill="url(#h-brass)" stroke="#5a4a2a" stroke-width="1"')}`;
    }

    function mosaic() {
      const pieces = [];
      const cell = .42;
      for (let z = room.front, row = 0; z < room.back; z += cell, row++) {
        for (let x = -room.halfWidth, col = 0; x < room.halfWidth; x += cell, col++) {
          const far = Math.min(z + cell, room.back), right = Math.min(x + cell, room.halfWidth);
          pieces.push(polygon([[x, 0, z], [right, 0, z], [right, 0, far], [x, 0, far]], `fill="${(row + col) % 2 ? '#969b7b' : '#beb89a'}" stroke="#62694f" stroke-width=".65"`));
        }
      }
      const tesserae = [];
      for (let x = -2.2; x <= 2.2; x += .105) tesserae.push(worldPath([[x, .001, 4.05], [x, .001, 10.85]]));
      for (let z = 4.05; z <= 10.85; z += .105) tesserae.push(worldPath([[-2.2, .001, z], [2.2, .001, z]]));
      return `<g clip-path="url(#h-floor-clip)" data-house-plane="floor" data-floor-finish="mosaic">
      ${pieces.join('')}
      ${polygon([[-2.2, 0, 4.05], [-2.2, 0, 10.85], [2.2, 0, 10.85], [2.2, 0, 4.05]], 'fill="#c6bea0" stroke="#3c5843" stroke-width="7"')}
      ${polygon([[-2.02, 0, 4.05], [-2.02, 0, 10.65], [2.02, 0, 10.65], [2.02, 0, 4.05]], 'fill="none" stroke="#667e56" stroke-width="2.5"')}
      ${[-1, 1].map(side => {
        const stem = curvePoints([[side * 1.6, 0, 10.5], [side * 1.0, 0, 9.3], [side * 2.2, 0, 6.0], [side * 1.6, 0, 4.05]]);
        const blade = curvePoints([[side * 1.85, 0, 6.7], [side * 1.25, 0, 6.55], [side * 1.25, 0, 7.8], [side * 1.6, 0, 8.0]]).concat(curvePoints([[side * 1.6, 0, 8.0], [side * 1.95, 0, 7.75], [side * 1.6, 0, 7.2], [side * 1.85, 0, 6.7]]));
        return line(stem, 'stroke="#678061" stroke-width="6"') + polygon(blade, 'fill="#6f805c"');
      }).join('')}
      ${rosette()}
      <path d="${tesserae.join('')}" fill="none" stroke="#465442" stroke-width=".65" opacity=".2"/>
    </g>`;
    }

    function parquet() {
      const pieces = [], unit = .16, length = 5, gap = .004;
      const centre = (room.front + room.back) / 2;
      const toWorld = (u, v) => [(u - v) / Math.SQRT2, 0, centre + (u + v) / Math.SQRT2];
      const tones = ['#897057', '#95795c', '#a58a68', '#826b51', '#9b8062', '#ad9170'];
      const plank = (u, v, across, index) => {
        const width = across ? length * unit : unit, depth = across ? unit : length * unit;
        const points = [[u + gap, v + gap], [u + width - gap, v + gap], [u + width - gap, v + depth - gap], [u + gap, v + depth - gap]].map(([a, b]) => toWorld(a, b));
        if (points.every(p => p[0] < -room.halfWidth) || points.every(p => p[0] > room.halfWidth) || points.every(p => p[2] < room.front) || points.every(p => p[2] > room.back)) return;
        pieces.push(polygon(points, `fill="${tones[((index % tones.length) + tones.length) % tones.length]}" stroke="#574833" stroke-width=".45"`));
        // Grain follows each board in world space, including its alternating direction.
        for (const offset of [.24, .56, .78]) {
          const grain = Array.from({ length: 9 }, (_, i) => {
            const t = .05 + i * .9 / 8, ripple = Math.sin(t * 9 + index) * .005;
            return across ? toWorld(u + width * t, v + depth * offset + ripple) : toWorld(u + width * offset + ripple, v + depth * t);
          });
          pieces.push(line(grain, `stroke="${offset === .56 ? '#d0b08a' : '#513d2b'}" stroke-width=".55" opacity=".22"`));
        }
      };
      // Interlocking horizontal/vertical boards, rotated 45 degrees into the room.
      const span = Math.ceil((room.back - room.front) / (length * unit)) + 4;
      for (let n = -span; n <= span; n++) {
        for (let m = -24; m <= 24; m++) {
          const u = (n * length - m) * unit, v = (n * length + m) * unit;
          plank(u, v, true, n * 7 + m * 3);
          plank(u + length * unit, v, false, n * 5 + m * 7 + 2);
        }
      }
      const outline = (inset, near, far) => [[-room.halfWidth + inset, 0, near], [-room.halfWidth + inset, 0, far], [room.halfWidth - inset, 0, far], [room.halfWidth - inset, 0, near]];
      const outer = outline(.24, room.front + .12, room.back - .18);
      const inner = outline(.35, room.front + .23, room.back - .29);
      const vines = [-1, 1].map(side => {
        const x = side * 2.44;
        const stem = curvePoints([[x, 0, room.front + .4], [x - side * .14, 0, 6], [x + side * .12, 0, 8.9], [x, 0, room.back - .5]]);
        const leaves = [5.2, 6.8, 8.4, 10].map(z => {
          const leaf = curvePoints([[x, 0, z], [x - side * .22, 0, z + .05], [x - side * .27, 0, z + .27], [x - side * .12, 0, z + .36]])
            .concat(curvePoints([[x - side * .12, 0, z + .36], [x - side * .04, 0, z + .2], [x - side * .06, 0, z + .09], [x, 0, z]]));
          return polygon(leaf, 'fill="#b6a17b" stroke="#62583e" stroke-width=".6"');
        }).join('');
        return line(stem, 'stroke="#b6a17b" stroke-width="1.1"') + leaves;
      }).join('');
      return `<g clip-path="url(#h-floor-clip)" data-house-plane="floor" data-floor-finish="parquet">
      ${polygon(floorOutline, 'fill="#574632"')}${pieces.join('')}
      <path d="${worldPath(outer)}Z${worldPath(inner)}Z" fill="#564631" fill-rule="evenodd"/>
      ${line([...outer, outer[0]], 'stroke="#b6a17b" stroke-width=".9"')}
      ${line([...inner, inner[0]], 'stroke="#b6a17b" stroke-width=".8"')}${vines}
    </g>`;
    }

    function staircase(upstairs = false) {
      // The floor well and ceiling opening are the same circle in world space.
      const center = [1.5, 0, 8.6], radius = 1.02, holeRadius = 1.16;
      const count = 22, turn = Math.PI * 2 / 20, first = 1.9;
      const start = upstairs ? first + (count - 1) * turn : first;
      const railHeight = .7;
      const point = (angle, r, level = 0) => [center[0] + Math.cos(angle) * r, upstairs ? -level * .175 : level * room.height / (count - 1), center[2] - Math.sin(angle) * r];
      const arc = (angle, end, r, level) => Array.from({ length: 8 }, (_, i) => point(angle + (end - angle) * i / 7, r, level));
      const part = (points, markup) => ({ depth: points.reduce((sum, p) => sum + p[2], 0) / points.length, markup });
      const ordered = parts => parts.sort((a, b) => b.depth - a.depth).map(p => p.markup).join('');
      // Nothing below the ceiling plane can be hidden by it, so only the parts
      // that rise through the plane are limited to the opening. Polylines are
      // cut where they cross the ceiling so each piece is drawn in its place.
      const aboveCeiling = p => p[1] > room.height + 1e-9;
      const splitAtCeiling = points => {
        const pieces = [];
        let current;
        points.forEach((p, i) => {
          if (!current) { current = { above: aboveCeiling(p), points: [p] }; return; }
          const prev = points[i - 1];
          if (aboveCeiling(p) === current.above) { current.points.push(p); return; }
          const t = (room.height - prev[1]) / (p[1] - prev[1]);
          const cross = prev.map((n, axis) => n + (p[axis] - n) * t);
          current.points.push(cross);
          pieces.push(current);
          current = { above: aboveCeiling(p), points: [cross, p] };
        });
        if (current) pieces.push(current);
        return pieces.filter(piece => piece.points.length > 1);
      };
      const strokes = (points, attributes, depth) => splitAtCeiling(points).map(piece => ({ ...part(depth === undefined ? piece.points : [[0, 0, depth]], line(piece.points, attributes)), above: piece.above }));
      // Split treads at the centre pole so each half can occlude it correctly.
      const half = (points, back) => {
        const result = [];
        const inside = p => back ? p[2] >= center[2] : p[2] <= center[2];
        for (let i = 0; i < points.length; i++) {
          const a = points[i], b = points[(i + 1) % points.length];
          if (inside(a)) result.push(a);
          if (inside(a) !== inside(b)) {
            const t = (center[2] - a[2]) / (b[2] - a[2]);
            result.push(a.map((n, axis) => n + (b[axis] - n) * t));
          }
        }
        return result;
      };
      const tread = i => {
        const angle = start + i * turn * (upstairs ? -1 : 1), end = angle + turn * (upstairs ? -1 : 1);
        const outer = arc(angle, end, radius, i);
        const inner = arc(end, angle, .09, i);
        const faces = [
          { points: [...outer, ...outer.slice().reverse().map(([x, y, z]) => [x, y - .06, z])], attributes: 'fill="#64523b"' },
          { points: [...outer, ...inner], attributes: `fill="${i % 2 ? '#b1a585' : '#c5b596'}"` }
        ];
        return faces.flatMap(face => [true, false].flatMap(back => {
          const points = half(face.points, back);
          return points.length < 3 ? [] : [part(points, polygon(points, face.attributes))];
        })).concat(outer.slice(1).map((p, j) => {
          const edge = [outer[j], p];
          return part(edge, line(edge, 'stroke="#e0ce9f" stroke-width="1.5"'));
        }));
      };
      const baluster = (angle, level, landing) => {
        const base = point(angle, radius + .025, landing ? 0 : level);
        const elevated = dy => [base[0], base[1] + dy, base[2]];
        const curl = curvePoints([elevated(.08), [base[0] - .14, base[1] + .25, base[2]], [base[0] + .14, base[1] + .43, base[2]], elevated(railHeight - .04)]);
        const leaf = curvePoints([elevated(.32), [base[0] - .16, base[1] + .37, base[2]], [base[0] - .13, base[1] + .57, base[2]], [base[0] - .05, base[1] + .57, base[2]]]);
        return [
          ...strokes([base, elevated(railHeight)], 'stroke="#314b39" stroke-width="2.3" stroke-linecap="round"', base[2]),
          ...strokes(curl, 'stroke="#526b48" stroke-width="1.8"', base[2]),
          ...strokes(leaf, 'stroke="#a89460" stroke-width="1.1"', base[2])
        ];
      };
      const railing = () => {
        const segments = upstairs ? 28 : count - 1;
        const from = upstairs ? 2.4 : start;
        const sweep = upstairs ? Math.PI * 2 - 1.1 : segments * turn;
        return Array.from({ length: segments }, (_, i) => {
          const a = from + sweep * i / segments, b = from + sweep * (i + 1) / segments;
          const points = Array.from({ length: 6 }, (_, j) => {
            const p = point(a + (b - a) * j / 5, radius + .025, upstairs ? 0 : i + j / 5);
            return [p[0], p[1] + railHeight, p[2]];
          });
          return [...baluster(a, i, upstairs), ...points.slice(1).flatMap((p, j) => {
            const edge = [points[j], p];
            return [...strokes(edge, 'stroke="#2e4433" stroke-width="6" stroke-linecap="round"'), ...strokes(edge.map(([x, y, z]) => [x, y + .025, z]), 'stroke="url(#h-brass)" stroke-width="2" stroke-linecap="round"')];
          })];
        }).flat();
      };
      const pole = (bottom, top) => polygon([[center[0] - .065, bottom, center[2]], [center[0] + .065, bottom, center[2]], [center[0] + .065, top, center[2]], [center[0] - .065, top, center[2]]], 'fill="url(#h-brass)" stroke="#536047" stroke-width="1.2"');
      const opening = circlePoints(center[0], upstairs ? 0 : room.height, center[2], holeRadius);
      const treads = Array.from({ length: count }, (_, i) => tread(i)).flat();
      const rails = railing();
      const rim = (back, attributes) => line(circlePoints(center[0], 0, center[2], holeRadius, back ? Math.PI : 0, Math.PI), attributes);
      if (upstairs) {
        return `<g data-stair-art="spiral-down">
        <defs><clipPath id="h-stair-well"><path d="${worldPath(opening)}Z"/></clipPath></defs>
        ${polygon(opening.map(([x, y, z]) => [x, y - .06, z]), 'fill="#756b4d" stroke="#756b4d" stroke-width="7"')}
        ${polygon(opening, 'fill="#26362b"')}
        ${rim(true, 'stroke="url(#h-wood)" stroke-width="7"')}
        ${ordered(rails.filter(p => p.depth > center[2]))}
        <g clip-path="url(#h-stair-well)">
          ${ordered([...treads, { depth: center[2], markup: pole(-3.7, .015) }])}
        </g>
        ${rim(false, 'stroke="url(#h-wood)" stroke-width="7"')}
        ${line(opening.map(([x, y, z]) => [x, y + .015, z]), 'stroke="url(#h-brass)" stroke-width="2"')}
        ${pole(0, .32)}
        ${ordered(rails.filter(p => p.depth <= center[2]))}
      </g>`;
      }
      const firstBase = point(start, radius + .025, 0), firstTop = [firstBase[0], railHeight + .05, firstBase[2]];
      const [knobX, knobY] = project(firstTop);
      const highlight = (bottom, top) => line([[center[0] - .025, bottom, center[2] - .003], [center[0] - .025, top, center[2] - .003]], 'stroke="#e1cea0" stroke-width="1" opacity=".7"');
      const poles = [
        { depth: center[2], above: false, markup: pole(0, room.height) + highlight(.02, room.height) },
        { depth: center[2], above: true, markup: pole(room.height, room.height + .4) + highlight(room.height, room.height + .4) }
      ];
      const parts = [...treads, ...rails, ...poles];
      return `<g data-stair-art="spiral-up">
      <defs><clipPath id="h-stair-ascent"><path d="${worldPath(opening)}Z"/></clipPath></defs>
      ${polygon(circlePoints(center[0], .005, center[2], 1.25), 'fill="#2c3d2b" opacity=".2"')}
      ${polygon(opening, 'data-stair-opening="ceiling" fill="#2b3a2d" stroke="#897a50" stroke-width="3"')}
      ${ordered(parts.filter(p => !p.above))}
      ${polygon(circlePoints(center[0], .012, center[2], .13), 'fill="url(#h-wood)" stroke="url(#h-brass)" stroke-width="2"')}
      ${line([firstBase, firstTop], 'stroke="#334b37" stroke-width="4"')}
      <circle cx="${knobX}" cy="${knobY}" r="4" fill="url(#h-brass)"/>
      <g clip-path="url(#h-stair-ascent)">${ordered(parts.filter(p => p.above))}</g>
    </g>`;
    }

    function skylight() {
      // Dusk shows through the oculus; a leaded flower sits at its centre.
      const cx = 0, cz = 7.3, rx = 2.65, rz = 2.2;
      const p = angle => [cx + rx * Math.cos(angle), room.height, cz - rz * Math.sin(angle)];
      const outline = Array.from({ length: 97 }, (_, i) => p(i * Math.PI * 2 / 96));
      const rings = [.53, .77].map(size => line(Array.from({ length: 97 }, (_, i) => {
        const a = i * Math.PI * 2 / 96;
        return [rx * size * Math.cos(a), room.height, cz - rz * size * Math.sin(a)];
      }), 'stroke="#937a53" stroke-width="3"')).join('');
      const ribs = Array.from({ length: 16 }, (_, i) => line([[0, room.height, cz], p(i * Math.PI / 8)], 'stroke="#6b7653" stroke-width="2.5"')).join('');
      const at = (a, r) => [Math.cos(a) * r, room.height, cz - Math.sin(a) * r * rz / rx];
      const petals = Array.from({ length: 8 }, (_, i) => {
        const a = i * Math.PI / 4;
        return polygon([...curvePoints([at(a, 0), at(a - .55, .5), at(a - .2, 1.0), at(a, 1.08)], 10), ...curvePoints([at(a, 1.08), at(a + .2, 1.0), at(a + .55, .5), at(a, 0)], 10)], 'fill="url(#h-rose)" stroke="#6a7653" stroke-width="2"');
      }).join('');
      const glow = project([0, room.height, cz]);
      return `<g data-house-plane="ceiling">${polygon(outline, 'fill="url(#h-dusk)" stroke="#514936" stroke-width="9"')}${polygon(outline, 'fill="url(#h-glass-speckle)"')}${rings}${ribs}${petals}${polygon(circlePoints(0, room.height, cz, .22), 'fill="#ecd9b6" stroke="#6a7653" stroke-width="2"')}${line(outline, 'stroke="url(#h-brass)" stroke-width="2"')}<ellipse cx="${glow[0].toFixed(1)}" cy="${glow[1].toFixed(1)}" rx="${(camera.focal / cz * 2.9).toFixed(1)}" ry="${(camera.focal / cz * .9).toFixed(1)}" fill="url(#h-light)" opacity=".35"/></g>`;
    }

    function plasterCeiling() {
      const y = room.height;
      const panel = inset => {
        const x = 2.4 - inset, near = 5.05 + inset, far = 9.65 - inset, r = .7;
        return [
          [-x + r, y, near], [x - r, y, near],
          ...curvePoints([[x - r, y, near], [x, y, near], [x, y, near], [x, y, near + r]]),
          [x, y, far - r], ...curvePoints([[x, y, far - r], [x, y, far], [x, y, far], [x - r, y, far]]),
          [-x + r, y, far], ...curvePoints([[-x + r, y, far], [-x, y, far], [-x, y, far], [-x, y, far - r]]),
          [-x, y, near + r], ...curvePoints([[-x, y, near + r], [-x, y, near], [-x, y, near], [-x + r, y, near]])
        ];
      };
      const ornaments = [-1, 1].flatMap(side => [false, true].map(back => {
        const p = (x, z) => [side * x, y - .012, back ? 14.7 - z : z];
        const stem = curvePoints([p(1.9, 5.65), p(1.1, 5.55), p(1.3, 6.3), p(1.7, 6.4)]);
        const leaf = curvePoints([p(1.7, 6.4), p(1.3, 6.3), p(1.1, 6.6), p(1.35, 6.9)])
          .concat(curvePoints([p(1.35, 6.9), p(1.65, 6.75), p(1.5, 6.55), p(1.7, 6.4)]));
        return line(stem, 'stroke="#b2a184" stroke-width="2"') + line(stem.map(([x, yy, z]) => [x, yy + .02, z]), 'stroke="#f0e5cf" stroke-width="1"')
          + polygon(leaf, 'fill="#d0c1a4" stroke="#b4a58b" stroke-width="1.2"');
      })).join('');
      const rosetteOutline = Array.from({ length: 97 }, (_, i) => {
        const a = i * Math.PI * 2 / 96, r = .33 + .065 * Math.cos(a * 8);
        return [Math.cos(a) * r, y - .025, 8.3 - Math.sin(a) * r];
      });
      return `<g data-house-plane="ceiling" data-ceiling-finish="plaster">
      ${polygon(panel(0), 'fill="#d9ceb4" stroke="#a3997e" stroke-width="5"')}
      ${polygon(panel(.065), 'fill="#e3d7be" stroke="#f0e5cf" stroke-width="1.5"')}
      ${polygon(panel(.16), 'fill="none" stroke="#b7a98c" stroke-width="1.1"')}${ornaments}
      ${polygon(rosetteOutline, 'fill="#d0c0a1" stroke="#a89a7e" stroke-width="1.2"')}
      ${polygon(circlePoints(0, y - .03, 8.3, .14), 'fill="#e9dec5" stroke="#b4a587" stroke-width="1"')}
    </g>`;
    }

    function structuralArch() {
      // A bent walnut arch spans the hall in front of the back wall. Its posts
      // rise straight to the springing line, then sweep into a basket arch.
      // Brass tendrils grow along the intrados and a drop hangs from the apex.
      const z = timber.depth - timber.halfDepth, back = timber.depth + timber.halfDepth;
      const xo = timber.x + .08, band = .19, spring = 2.3, apex = room.height - .1;
      const edge = (s, inset) => {
        const x = s * (xo - inset), top = apex - inset * .95, rise = spring - inset * .3;
        return [[x, .08, z], [x, rise, z], ...curvePoints([[x, rise, z], [x, rise + 1.05, z], [s * (1.45 - inset), top, z], [0, top, z]], 26)];
      };
      const ring = [...edge(-1, 0), ...edge(1, 0).reverse(), ...edge(1, band), ...edge(-1, band).reverse()];
      const faces = [-1, 1].map(s => {
        const x = s * (xo - band);
        return polygon([[x, .08, z], [x, .08, back], [x, spring, back], [x, spring, z]], 'fill="#382c22"');
      }).join('');
      const bases = [-1, 1].map(s => {
        const x = s * (xo - band / 2);
        const base = [[x - .15, .08, z - .04], [x + .15, .08, z - .04], [x + .15, .08, back + .04], [x - .15, .08, back + .04]];
        return polygon([base[0], base[1], [base[1][0], 0, base[1][2]], [base[0][0], 0, base[0][2]]], 'fill="#57432e" stroke="#9d885c" stroke-width=".8"') + polygon(base, 'fill="url(#h-wood)" stroke="#b59e6b" stroke-width=".8"');
      }).join('');
      const front = z - .003;
      const tendril = s => {
        const stem = curvePoints([[s * (xo - band), 2.42, front], [s * 2.15, 2.95, front], [s * 1.75, 3.05, front], [s * 1.2, 3.58, front]], 24);
        const curl = curvePoints([[s * 1.2, 3.58, front], [s * 1.0, 3.78, front], [s * 1.32, 3.86, front], [s * 1.36, 3.68, front]], 16);
        const leaf = curvePoints([[s * 1.78, 3.04, front], [s * 1.95, 3.25, front], [s * 1.72, 3.44, front], [s * 1.55, 3.26, front]], 10)
          .concat(curvePoints([[s * 1.55, 3.26, front], [s * 1.6, 3.12, front], [s * 1.7, 3.04, front], [s * 1.78, 3.04, front]], 10));
        const bud = curvePoints([[s * 1.36, 3.68, front], [s * 1.5, 3.62, front], [s * 1.52, 3.5, front], [s * 1.42, 3.46, front]], 10)
          .concat(curvePoints([[s * 1.42, 3.46, front], [s * 1.34, 3.52, front], [s * 1.32, 3.6, front], [s * 1.36, 3.68, front]], 10));
        return line(stem, 'stroke="#3b2b1f" stroke-width="4.5" stroke-linecap="round"') + line(stem, 'stroke="url(#h-brass)" stroke-width="1.8" stroke-linecap="round"')
          + line(curl, 'stroke="#3b2b1f" stroke-width="3.5" stroke-linecap="round"') + line(curl, 'stroke="url(#h-brass)" stroke-width="1.4" stroke-linecap="round"')
          + polygon(leaf, 'fill="#5d7350" stroke="url(#h-brass)" stroke-width="1"') + polygon(bud, 'fill="#b98b86" stroke="url(#h-brass)" stroke-width="1"');
      };
      const drop = [-1, 1].map(s => line(curvePoints([[0, apex - band + .02, front], [s * .28, 3.72, front], [s * .3, 3.46, front], [0, 3.42, front]], 16), 'stroke="url(#h-brass)" stroke-width="1.6" stroke-linecap="round"')).join('');
      return `<g data-house-structure="timber">${faces}
      <g data-house-structure="arch">
        ${polygon(ring, 'fill="url(#h-wood)" stroke="#3a2e22" stroke-width="1.2" stroke-linejoin="round"')}
        ${polygon(ring, 'fill="url(#h-grain)" opacity=".3"')}
        ${line(edge(-1, band), 'stroke="#bca16b" stroke-width="1.1" opacity=".8"')}
        ${line(edge(1, band), 'stroke="#bca16b" stroke-width="1.1" opacity=".8"')}
        ${line(edge(-1, band / 2), 'stroke="#2f241a" stroke-width=".8" opacity=".5"')}
        ${line(edge(1, band / 2), 'stroke="#2f241a" stroke-width=".8" opacity=".5"')}
        ${tendril(-1)}${tendril(1)}${drop}
        ${polygon(circlePoints(0, 3.42, front, .05), 'fill="#b98b86" stroke="url(#h-brass)" stroke-width="1"')}
      </g>${bases}${sconce(false)}${sconce(true)}</g>`;
    }

    function sideDoor(roomName, right = false) {
      const near = 5.45, far = 7.85, x = (right ? 1 : -1) * room.halfWidth;
      const threshold = polygon([[x, .015, near], [x, .015, far], [x + (right ? -.15 : .15), .015, far], [x + (right ? -.15 : .15), .015, near]], 'fill="#686649" stroke="#bcad7d" stroke-width="1.5"');
      return threshold + wallArtwork(doorFor(roomName, { fine: true }), { right, near, far, height: 3.35, className: 'house-door-art', attributes: `data-door-art="${roomName}"` });
    }

    function plant(x, z, height = 1.5, base = 0) {
      const potHeight = height * .26, radius = height * .16;
      const top = circlePoints(x, base + potHeight, z, radius), bottom = circlePoints(x, base, z, radius * .78);
      const back = top.slice(36), front = top.slice(0, 37);
      const pot = polygon([...front, ...bottom.slice(0, 37).reverse()], 'fill="#5e5340" stroke="#b79b68" stroke-width="1.4"');
      const [px, py] = project([x, base + potHeight, z]);
      const scale = camera.focal / z * (height - potHeight) / 150;
      return `<g data-house-object="plant">${polygon(back, 'fill="#7c694b"')}${pot}${polygon(top, 'fill="#494731" stroke="#a18b59" stroke-width="1.5"')}<use href="#h-foliage" transform="translate(${px} ${py}) scale(${scale})"/></g>`;
    }

    function sconce(right) {
      // The mounting plate sits on the front face of its supporting post.
      const x = (right ? 1 : -1) * timber.x, z = timber.depth - timber.halfDepth - .025, y = 2.48;
      const [px, py] = project([x, y, z]);
      const scale = camera.focal / z * .68 / 86;
      return `<g data-house-object="sconce" transform="translate(${px} ${py}) scale(${scale})"><use href="#h-sconce"/></g>`;
    }

    function landingFurniture() {
      const x = -.95, z = 10.45, width = 1.43, depth = .48, height = .58;
      const top = [[x - width / 2, height, z - depth / 2], [x + width / 2, height, z - depth / 2], [x + width / 2, height, z + depth / 2], [x - width / 2, height, z + depth / 2]];
      const legs = top.map(([px, , pz]) => polygon([[px - .025, 0, pz], [px + .025, 0, pz], [px + .025, height, pz], [px - .025, height, pz]], 'fill="url(#h-wood)" stroke="#9d8a5d" stroke-width="1"')).join('');
      const tabletop = polygon(top, 'fill="url(#h-wood)" stroke="#bba06a" stroke-width="2"');
      const fascia = polygon([top[0], top[1], [top[1][0], height - .055, top[1][2]], [top[0][0], height - .055, top[0][2]]], 'fill="#5d4832"');
      return `<g data-house-object="console">${legs}${tabletop}${fascia}${plant(x, z, .48, height)}</g>`;
    }

    function scene(upstairs) {
      const leftRoom = upstairs ? 'music' : 'studio';
      const rightRoom = upstairs ? 'laboratory' : 'salon';
      const backWall = [[-room.halfWidth, room.height, room.back], [room.halfWidth, room.height, room.back], [room.halfWidth, 0, room.back], [-room.halfWidth, 0, room.back]];
      const floorTrim = [-1, 1].map(side => line([[side * room.halfWidth, .025, room.front], [side * room.halfWidth, .025, room.back]], 'stroke="#3c4934" stroke-width="7"')).join('');
      const backScale = camera.focal / room.back * 3.35 / 450;
      const backDoor = project([-.95, 3.35, room.back]);
      const windowScale = camera.focal / room.back * 2.25 / 185;
      const windowOrigin = project([-.95 - 79 * windowScale / (camera.focal / room.back), 3.15, room.back]);
      const window = `<g data-house-object="window" transform="translate(${coords(windowOrigin)}) scale(${windowScale})"><path d="M0 185V58C0-20 158-20 158 58V185Z" fill="url(#h-dusk)" stroke="url(#h-wood)" stroke-width="12"/><path d="M0 185V58C0-20 158-20 158 58V185Z" fill="url(#h-glass-speckle)" stroke="url(#h-brass)" stroke-width="2"/><path d="M79 185V2M0 68C34 69 49 130 79 139C109 130 124 69 158 68M79 14C65 41 35 51 35 90C35 122 79 148 79 185C79 148 123 122 123 90C123 51 93 41 79 14" fill="none" stroke="#526848" stroke-width="3"/><path d="M-11 185H169" stroke="url(#h-wood)" stroke-width="13"/></g>`;
      const lamp = project([0, 3.48, 8.3]), lampScale = camera.focal / 8.3 * .55 / 70;
      const pool = project([0, 0, 7.0]), poolScale = camera.focal / 7.0;
      const backGlow = project([0, 2.2, room.back]);
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" data-vanishing-point="${camera.x} ${camera.horizon}" focusable="false">${defs}
      <rect width="${W}" height="${H}" fill="#5f6a55"/>
      ${polygon(ceilingOutline, `fill="${upstairs ? 'url(#h-plaster)' : '#33463a'}"`)}
      ${polygon(backWall, 'fill="url(#h-wall-back)"')}
      <g clip-path="url(#h-back-wallpaper-clip)">
        ${polygon(backWall, `fill="url(#${upstairs ? 'h-landing-wallpaper-back' : 'h-wallpaper-back'})"`)}
        ${polygon(backWall, 'fill="url(#h-wall-back)" opacity=".3"')}
      </g>
      ${sideWall(false, upstairs)}${sideWall(true, upstairs)}
      ${backPanelling()}
      ${polygon(floorOutline, 'fill="url(#h-floor)"')}${upstairs ? parquet() : mosaic()}
      ${floorTrim}${ceilingMouldings(upstairs)}${upstairs ? plasterCeiling() : skylight()}
      <ellipse cx="${backGlow[0].toFixed(1)}" cy="${backGlow[1].toFixed(1)}" rx="${(camera.focal / room.back * 3.4).toFixed(1)}" ry="${(camera.focal / room.back * 2.6).toFixed(1)}" fill="url(#h-warm)" opacity=".8"/>
      ${upstairs ? window + landingFurniture() : `<g class="house-door-art" data-door-art="garden" transform="translate(${backDoor[0] - 110 * backScale} ${backDoor[1]}) scale(${backScale})">${doorFor('garden')}</g>`}
      ${plant(-2.3, 10.35, 1.5)}${structuralArch()}
      ${sideDoor(leftRoom)}${sideDoor(rightRoom, true)}
      ${staircase(upstairs)}${plant(2.48, 4.8, 1.4)}
      <ellipse cx="${pool[0].toFixed(1)}" cy="${pool[1].toFixed(1)}" rx="${(poolScale * 1.9).toFixed(1)}" ry="${(poolScale * .62).toFixed(1)}" fill="url(#h-warm)"/>
      <ellipse cx="${pool[0].toFixed(1)}" cy="${pool[1].toFixed(1)}" rx="${(poolScale * 1.2).toFixed(1)}" ry="${(poolScale * .4).toFixed(1)}" fill="url(#h-light)" opacity=".55"/>
      <path d="M0 0H${W}V${H}H0Z" fill="url(#h-shade)"/>
      ${line([[0, room.height - .03, 8.3], [0, 3.48, 8.3]], 'stroke="#484a33" stroke-width="1.6"')}
      <g data-house-object="pendant" transform="translate(${coords(lamp)}) scale(${lampScale})"><ellipse cy="30" rx="210" ry="190" fill="url(#h-warm)"/><path d="M-20 0Q0-19 20 0L27 25Q0 42-27 25Z" fill="#e4d79e" stroke="#746644" stroke-width="2"/><path d="M-20 0H20M-27 25H27M0-7V32" fill="none" stroke="#7c7450" stroke-width="1.5"/><path d="M-27 25C-20 36 20 36 27 25" fill="none" stroke="#fff6cf" stroke-width="2" opacity=".8"/><ellipse cy="39" rx="95" ry="90" fill="url(#h-light)"/></g>
    </svg>`;
    }

    return { scene, width: W, height: H };
  }

  const renderers = { landscape: renderer(views.landscape), portrait: renderer(views.portrait) };
  const scenes = {};
  const portraitQuery = window.matchMedia('(orientation: portrait)');
  const orientation = () => portraitQuery.matches ? 'portrait' : 'landscape';
  const visit = illustration.closest('.house-visit');
  const sceneBox = document.getElementById('house-scene');
  let activeKey;
  const groundDoors = document.getElementById('house-doors');
  const upperDoors = document.getElementById('house-upstairs-doors');
  const locationName = document.getElementById('house-location-name');
  locationName.setAttribute('aria-live', 'polite');

  // Door links are placed over the drawn doors, so one geometry serves both
  // cameras. Percentages keep the hit areas aligned while the SVG scales.
  function placeLinks() {
    if (sceneBox.classList.contains('house-entering')) return;
    const frame = illustration.getBoundingClientRect();
    if (!frame.width || !frame.height) return;
    const place = (link, art) => {
      if (!art) return;
      const rect = art.getBoundingClientRect();
      link.style.left = `${((rect.left - frame.left) / frame.width * 100).toFixed(2)}%`;
      link.style.top = `${((rect.top - frame.top) / frame.height * 100).toFixed(2)}%`;
      link.style.width = `${(rect.width / frame.width * 100).toFixed(2)}%`;
      link.style.height = `${(rect.height / frame.height * 100).toFixed(2)}%`;
      // A door against the frame edge keeps its name plate inside the frame.
      link.dataset.edge = rect.left - frame.left < 70 ? 'left' : frame.right - rect.right < 70 ? 'right' : 'middle';
    };
    document.querySelectorAll('.house-doors a[data-room]').forEach(link => place(link, illustration.querySelector(`[data-door-art="${link.dataset.room}"]`)));
    document.querySelectorAll('.house-doors a[data-house-floor]').forEach(link => place(link, illustration.querySelector('[data-stair-art]')));
  }

  function changeFloor() {
    const floor = window.location.hash === '#first-floor' ? 'first' : 'ground';
    const view = orientation();
    const key = `${view}-${floor}`;
    if (key === activeKey) return;
    const moveFocus = (floor === 'first' ? groundDoors : upperDoors).contains(document.activeElement);
    activeKey = key;
    scenes[key] ??= renderers[view].scene(floor === 'first');
    illustration.innerHTML = scenes[key];
    visit?.style.setProperty('--house-ratio', `${renderers[view].width} / ${renderers[view].height}`);
    groundDoors.hidden = floor !== 'ground';
    upperDoors.hidden = floor !== 'first';
    locationName.textContent = floor === 'first' ? 'Landing' : 'Hall';
    document.querySelectorAll('.house-floor-switch [data-house-floor]').forEach(link => {
      if (link.dataset.houseFloor === floor) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    placeLinks();
    if (moveFocus) (floor === 'first' ? upperDoors : groundDoors).querySelector('a').focus({ preventScroll: true });
  }
  window.addEventListener('hashchange', changeFloor);
  portraitQuery.addEventListener('change', changeFloor);
  changeFloor();
  new ResizeObserver(placeLinks).observe(illustration);
  document.fonts?.ready.then(placeLinks);

  const artFor = link => illustration.querySelector(link.dataset.room ? `[data-door-art="${link.dataset.room}"]` : '[data-stair-art]');
  document.querySelectorAll('.house-doors a').forEach(link => {
    const highlight = on => artFor(link)?.classList.toggle('is-hovered', on);
    link.addEventListener('pointerenter', () => highlight(true));
    link.addEventListener('pointerleave', () => highlight(false));
    link.addEventListener('focus', () => highlight(true));
    link.addEventListener('blur', () => highlight(false));
    if (!link.dataset.room) return;
    link.addEventListener('click', event => {
      // Preserve new-tab clicks and follow the link immediately with reduced motion.
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      event.preventDefault();
      const rect = (artFor(link) || link).getBoundingClientRect();
      const sceneRect = illustration.getBoundingClientRect();
      illustration.style.transformOrigin = `${(rect.left + rect.width / 2 - sceneRect.left) / sceneRect.width * 100}% ${(rect.top + rect.height / 2 - sceneRect.top) / sceneRect.height * 100}%`;
      sceneBox.classList.add('house-entering');
      window.setTimeout(() => window.location.assign(link.href), 230);
    });
  });
  window.addEventListener('pageshow', () => sceneBox.classList.remove('house-entering'));
})();
