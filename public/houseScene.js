'use strict';

// A small, reusable vector set: the house stays crisp at every screen size.
// No render loop, WebGL, remote fonts, or full-size bitmap backgrounds.
(() => {
  const illustration = document.getElementById('house-illustration');
  if (!illustration) return;
  const defs = `<defs>
    <linearGradient id="h-wall-left" x2="1" y2=".2"><stop stop-color="#788065"/><stop offset=".5" stop-color="#a1a286"/><stop offset="1" stop-color="#c0ba99"/></linearGradient>
    <linearGradient id="h-wall-right" x2="1" y2="0"><stop stop-color="#b0ae8c"/><stop offset="1" stop-color="#586851"/></linearGradient>
    <linearGradient id="h-wall-back" x2="0" y2="1"><stop stop-color="#c3bfa0"/><stop offset="1" stop-color="#a3a485"/></linearGradient>
    <linearGradient id="h-wood" x2="1" y2=".1"><stop stop-color="#403025"/><stop offset=".25" stop-color="#80543c"/><stop offset=".47" stop-color="#5d3e2c"/><stop offset=".75" stop-color="#896043"/><stop offset="1" stop-color="#362a20"/></linearGradient>
    <pattern id="h-grain" width="256" height="512" patternUnits="userSpaceOnUse"><image href="/assets/ur/walnut-c5c3c1369b.webp" width="256" height="512" opacity=".78"/>
      <path d="M22 0C31 110 8 138 24 252S14 413 22 512M67 0C51 102 80 162 66 261S75 424 67 512M118 0C135 105 110 150 120 267S102 433 118 512M171 0C152 127 188 157 174 269S187 412 171 512M226 0C240 97 213 146 229 273S212 418 226 512" fill="none" stroke="#2d1c13" stroke-width=".8" opacity=".2"/>
      <path d="M26 0C35 110 12 138 28 252S18 413 26 512M122 0C139 105 114 150 124 267S106 433 122 512M230 0C244 97 217 146 233 273S216 418 230 512" fill="none" stroke="#e5ba7b" stroke-width=".7" opacity=".12"/>
    </pattern>
    <linearGradient id="h-brass" x2=".8" y2="1"><stop stop-color="#ede0a6"/><stop offset=".3" stop-color="#af9c61"/><stop offset=".55" stop-color="#796338"/><stop offset=".8" stop-color="#d5bd78"/><stop offset="1" stop-color="#8a7148"/></linearGradient>
    <linearGradient id="h-glass" x2=".6" y2="1"><stop stop-color="#e3d7a4"/><stop offset=".3" stop-color="#c2c49a"/><stop offset=".65" stop-color="#839d7b"/><stop offset="1" stop-color="#45664f"/></linearGradient>
    <linearGradient id="h-rose" x2=".7" y2="1"><stop stop-color="#e2c9a3"/><stop offset=".5" stop-color="#bf927b"/><stop offset="1" stop-color="#987965"/></linearGradient>
    <linearGradient id="h-floor" x2="0" y2="1"><stop stop-color="#b6b18d"/><stop offset="1" stop-color="#858669"/></linearGradient>
    <radialGradient id="h-light"><stop stop-color="#fff4cd" stop-opacity=".6"/><stop offset=".55" stop-color="#ffe9ac" stop-opacity=".12"/><stop offset="1" stop-color="#fff4cd" stop-opacity="0"/></radialGradient>
    <radialGradient id="h-shade" cx=".48" cy=".35" r=".75"><stop offset=".25" stop-color="#18291f" stop-opacity="0"/><stop offset="1" stop-color="#15251d" stop-opacity=".65"/></radialGradient>
    <pattern id="h-wallpaper" width="90" height="130" patternUnits="userSpaceOnUse"><path d="M45 130V78C45 44 14 32 14 15C14-4 45 2 45 25C45 2 76-4 76 15C76 32 45 44 45 78M45 104C21 104 13 85 17 79C38 83 33 101 45 104M45 66C63 66 74 54 70 47C52 50 55 63 45 66" fill="none" stroke="#4e6949" stroke-width=".8" opacity=".23"/></pattern>
    <pattern id="h-tesserae" width="9" height="9" patternUnits="userSpaceOnUse"><path d="M0 0H9V9H0Z" fill="none" stroke="#465442" stroke-width=".5" opacity=".24"/><path d="M2 2h3v3H2Z" fill="#f1e9bb" opacity=".15"/></pattern>
    <pattern id="h-glass-speckle" width="33" height="47" patternUnits="userSpaceOnUse"><path d="m3 7 5-1m11 12 2 2m-13 13 4-2m13 9 4-1m-3-34 1 3" stroke="#fff9d4" stroke-width=".7" opacity=".25"/></pattern>
    <pattern id="h-ripple-glass" width="74" height="112" patternUnits="userSpaceOnUse">
      <path d="M17 0C-3 18 37 30 23 53C5 79 30 86 17 112M52 0C70 21 32 35 49 58C69 81 37 96 52 112" fill="none" stroke="#faf1ce" stroke-width="1.3" opacity=".2"/>
      <path d="M21 0C1 18 41 30 27 53C9 79 34 86 21 112M56 0C74 21 36 35 53 58C73 81 41 96 56 112" fill="none" stroke="#425841" stroke-width=".8" opacity=".12"/>
      <path d="M9 14Q28 12 22 31Q4 33 9 14ZM43 69Q61 57 63 77Q47 86 43 69ZM31 95Q42 82 46 101Q37 109 31 95Z" fill="#fff6d5" opacity=".065"/>
    </pattern>
    <pattern id="h-brass-patina" width="43" height="67" patternUnits="userSpaceOnUse"><path d="m6 12 8-2 4 3m7 25 7-1m-22 20 6-2m15-44 4-1" fill="none" stroke="#62785c" stroke-width="2" opacity=".25"/></pattern>
    <g id="h-iris" stroke="url(#h-brass)" stroke-width="1.5"><path d="M0 3C-14-12-10-33 0-42C10-33 14-12 0 3Z" fill="#bca479"/><path d="M0-5C-8-30-29-28-33-14C-36-2-18-9-16 5C-12 15-3 7 0-5ZM0-5C8-30 29-28 33-14C36-2 18-9 16 5C12 15 3 7 0-5Z" fill="#baa589"/><path d="M0 1C-13 14-4 24-19 29C-7 34 0 17 0 10C0 17 7 34 19 29C4 24 13 14 0 1Z" fill="#6b815a"/><path d="M0-34V30" fill="none"/></g>
    <g id="h-column"><path d="M-14 525-9 60Q-28 49-34 22L-21 9Q-15 47 0 51Q15 47 21 9L34 22Q28 49 9 60L14 525Z" fill="url(#h-wood)" stroke="#293124" stroke-width="3"/><path d="M0 521V67C-17 59-32 41-27 15M0 67C17 59 32 41 27 15" fill="none" stroke="url(#h-brass)" stroke-width="3"/><path d="M-19 520H19V539H-19Z" fill="url(#h-brass)"/><path d="M-13 92H13M-13 101H13" stroke="#bba066" stroke-width="2"/></g>
    <g id="h-sconce"><ellipse cy="8" rx="65" ry="75" fill="url(#h-light)"/><path d="M0 57V6M0 28C-26 25-28 10-21 0M0 28C26 25 28 10 21 0" fill="none" stroke="#665331" stroke-width="4"/><path d="M-34 2C-28-18-14-18-8 2Q-21 12-34 2ZM8 2C14-18 28-18 34 2Q21 12 8 2Z" fill="#e2d9a0" stroke="#aa975e" stroke-width="1"/><ellipse cy="58" rx="8" ry="12" fill="url(#h-brass)"/></g>
    <g id="h-plant"><path d="M-32 0h64l-7 52h-50Z" fill="#5e5340" stroke="#c0a16b" stroke-width="2"/><path d="M-35-3h70v10h-70Z" fill="#8a7150"/><g stroke="#6a7950" stroke-width="3" fill="#415d40"><path d="M0 0C-5-40-50-66-52-100C-25-98-3-54 0 0ZM0 0C3-45 44-64 54-95C25-91 8-55 0 0ZM0 0C-6-66-23-105-5-150C12-121 0-74 0 0ZM0-10C-15-25-76-18-81-53C-37-53-20-32 0-10ZM0-12C19-40 47-37 79-53C70-21 36-23 0-12Z"/><path d="M0 0V-136M0 0Q-6-60-48-94M0 0Q10-54 50-90" fill="none" stroke="#97a476" stroke-width="1"/></g></g>
    <clipPath id="h-floor-clip"><path d="M0 680V646L389 454H811L1200 646V680Z"/></clipPath>
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
        ${Array.from({length:8},(_,i)=>`<path d="M0 0C-5-3-5-12 0-16C5-12 5-3 0 0Z" transform="rotate(${i*45})"/>`).join('')}
        <circle r="3"/></g>
        <path d="m155 160 12 15-12 15-12-15Z"/>`,
      joinery: `<path d="M110 54V450" stroke="#332b22" stroke-width="9"/>
        <path d="M110 55V450" stroke-width="1.5"/>
        <path d="M30 406V302Q61 291 92 302V406ZM128 406V302Q159 291 190 302V406Z"/>`,
      handle: `<path d="M101 266v35M119 266v35" stroke-width="3"/>
        <circle cx="101" cy="277" r="3"/><circle cx="119" cy="277" r="3"/>`
    },
    garden: {
      glassTones: ['#d7d5af', '#b7c299', '#92a77e'], foliageTone: '#98af79',
      organic: `<path d="M76 197C60 187 58 164 66 152C81 157 85 181 76 197ZM144 197C160 187 162 164 154 152C139 157 135 181 144 197ZM95 269C78 269 71 253 74 244C89 244 97 259 95 269ZM125 269C142 269 149 253 146 244C131 244 123 259 125 269ZM67 307C56 294 58 281 68 278C81 289 77 301 67 307ZM153 307C164 294 162 281 152 278C139 289 143 301 153 307Z"/>
        <use href="#h-iris" transform="translate(110 88) scale(.27)" opacity=".65"/>`,
      carving: `<path d="M62 405C80 387 97 412 110 397C123 412 140 387 158 405M81 399C79 390 89 388 96 395M139 399C141 390 131 388 124 395"/>`,
      frame: 'M18 450V133C18 70 79 23 110 7C141 23 202 70 202 133V450Z',
      leaf: 'M29 450V136C29 81 82 40 110 25C138 40 191 81 191 136V450Z',
      pane: 'M45 356V151C45 99 89 64 110 48C131 64 175 99 175 151V356Z',
      panel: 'M43 385Q110 370 177 385V423H43Z',
      tracery: `<path d="M110 48V120C110 159 72 177 75 213C78 249 110 254 110 290V356M110 120C110 159 148 177 145 213C142 249 110 254 110 290"/>
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

  function doorFor(room) {
    const art = doorPersonalities[room];
    // Clips follow each individual aperture, including the salon's paired panes.
    return `<defs><clipPath id="h-door-pane-${room}"><path d="${art.pane}"/></clipPath>
      <clipPath id="h-door-leaf-${room}"><path d="${art.leaf}"/></clipPath>
      <linearGradient id="h-door-glass-${room}" x2=".6" y2="1"><stop stop-color="${art.glassTones[0]}"/><stop offset=".45" stop-color="${art.glassTones[1]}"/><stop offset="1" stop-color="${art.glassTones[2]}"/></linearGradient></defs>
      <path d="${art.frame}" fill="#211f18" stroke="#362b20" stroke-width="18"/>
      <path d="${art.frame}" fill="none" stroke="url(#h-wood)" stroke-width="14"/>
      <path d="${art.frame}" fill="none" stroke="url(#h-brass)" stroke-width="1.5"/>
      <path d="${art.frame}" fill="none" stroke="url(#h-brass-patina)" stroke-width="2"/>
      <g class="house-leaf">
        <path d="${art.leaf}" fill="url(#h-wood)" stroke="#30291f" stroke-width="3"/>
        <path d="${art.leaf}" fill="url(#h-grain)"/>
        <path d="${art.pane}" fill="url(#h-door-glass-${room})" stroke="#342e20" stroke-width="7"/>
        <g clip-path="url(#h-door-pane-${room})">
          <g fill="${art.foliageTone}" fill-opacity=".45" stroke="#73815e" stroke-width="1.1" stroke-opacity=".6" stroke-linejoin="round">${art.organic}</g>
          <g fill="none" stroke="#6b6b56" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${art.tracery}</g>
          <g fill="none" stroke="#777a63" stroke-opacity=".5" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">${art.clue}</g>
          <path d="M0 0H220V450H0Z" fill="url(#h-ripple-glass)" opacity=".7"/>
          <path d="M0 0H220V450H0Z" fill="url(#h-glass-speckle)" opacity=".8"/>
        </g>
        <path d="${art.pane}" fill="none" stroke="url(#h-brass)" stroke-width="1.2"/>
        <path d="${art.panel}" fill="#352e23" fill-opacity=".35" stroke="#aa8d59" stroke-opacity=".7" stroke-width="1.3"/>
        <g fill="none" stroke="url(#h-brass)" stroke-width="1.5" stroke-opacity=".72" stroke-linecap="round" stroke-linejoin="round">${art.joinery}</g>
        <g clip-path="url(#h-door-leaf-${room})" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <g stroke="#251c14" stroke-width="2.3" opacity=".5" transform="translate(0 1.3)">${art.carving}</g>
          <g stroke="#c2a16b" stroke-width="1.1" opacity=".5">${art.carving}</g>
        </g>
        <g fill="none" stroke="url(#h-brass)" stroke-width="2" stroke-linecap="round">${art.handle || '<path d="M186 281c-6 0-8 14-6 22s12 9 14 2c-8 0-10-8-8-16Z"/>'}</g>
      </g>
      <path d="M-15 452H235l11 13H-25Z" fill="#686649" stroke="#bcad7d" stroke-width="2"/>`;
  }

  function mosaic() {
    const pieces = [];
    const rows = [454, 463, 477, 496, 520, 552, 593, 641, 700];
    for (let r = 0; r < rows.length - 1; r++) {
      const y = rows[r], nextY = rows[r + 1];
      for (let c = -15; c < 15; c++) {
        const x = 600 + c * (y - 340) * .18;
        const x2 = 600 + (c + 1) * (y - 340) * .18;
        const nx = 600 + c * (nextY - 340) * .18;
        const nx2 = 600 + (c + 1) * (nextY - 340) * .18;
        pieces.push(`<path d="M${x} ${y}H${x2}L${nx2} ${nextY}H${nx}Z" fill="${(c + r) % 2 === 0 ? '#bfb99a' : '#8f9475'}" stroke="#62694f" stroke-width=".6"/>`);
      }
    }
    return `<g clip-path="url(#h-floor-clip)">${pieces.join('')}<path d="M441 457H759L1072 680H128Z" fill="#c6bea0" stroke="#3c5843" stroke-width="10"/><path d="M461 464H739L1007 680H193Z" fill="none" stroke="#667e56" stroke-width="3"/><path d="M484 474C513 514 425 572 397 590C353 618 308 650 319 680M716 474C687 514 775 572 803 590C847 618 892 650 881 680" fill="none" stroke="#678061" stroke-width="7"/><path d="M397 590C490 616 521 560 491 538C455 550 455 580 397 590ZM803 590C710 616 679 560 709 538C745 550 745 580 803 590Z" fill="#6f805c"/><ellipse cx="600" cy="604" rx="70" ry="30" fill="none" stroke="#9d8967" stroke-width="3"/><path d="M600 629C595 607 554 609 547 590C575 584 595 597 600 609C605 597 625 584 653 590C646 609 605 607 600 629Z" fill="#8a9770" stroke="#607751" stroke-width="2"/><path d="M600 623V585" stroke="#56714d" stroke-width="2"/><path d="M0 450H1200V700H0Z" fill="url(#h-tesserae)"/></g>`;
  }

  // Wedge-shaped treads and the handrail share one helix on each floor.
  function staircase(upstairs = false) {
    const cx = 754;
    const radius = upstairs ? 117 : 103;
    const depth = upstairs ? .5 : .32;
    const count = upstairs ? 18 : 22;
    const turn = (upstairs ? -1 : 1) * Math.PI * 2 / 20;
    const start = upstairs ? 1.9 + 21 * Math.PI * 2 / 20 : 1.9;
    const floorY = upstairs ? 508 : 488;
    // Keep the opening inside the ceiling plane, above the back-wall cornice.
    const ceilingY = 108;
    const openingDepth = 34;
    const rise = upstairs ? -3.4 : (floorY - ceilingY) / (count - 1);
    const railHeight = upstairs ? 59 : 62;
    const point = (angle, r, level = 0) => [cx + Math.cos(angle) * r, floorY - level * rise + Math.sin(angle) * r * depth];
    const xy = p => p.map(n => n.toFixed(2)).join(' ');
    const arc = (angle, end, r, level) => Array.from({ length: 7 }, (_, i) => point(angle + (end - angle) * i / 6, r, level));
    const path = points => 'M' + points.map(xy).join('L');
    const tread = i => {
      const angle = start + i * turn;
      const end = angle + turn;
      const treadRadius = upstairs ? radius * (1 - i * .012) : radius;
      const outer = arc(angle, end, treadRadius, i);
      const inner = arc(end, angle, 12, i);
      const face = [...outer, ...outer.slice().reverse().map(([x, y]) => [x, y + 7])];
      return `<g><path d="${path(face)}Z" fill="#64523b" stroke="#433e2c" stroke-width=".8"/>
        <path d="${path([...outer, ...inner])}Z" fill="${i % 2 ? '#b1a585' : '#c5b596'}" stroke="#74664a" stroke-width="1"/>
        <path d="${path(outer)}" fill="none" stroke="#e0ce9f" stroke-width="2"/>
        <path d="${path([point(angle + .05, 25, i), point(angle + .05, treadRadius - 8, i)])}" stroke="#8e7c57" stroke-opacity=".45" stroke-width="1"/></g>`;
    };
    const baluster = (angle, level) => {
      const [x, y] = point(angle, radius + 3, level);
      return `<g fill="none" stroke-linecap="round">
        <path d="M${x} ${y}V${y - railHeight}" stroke="#314b39" stroke-width="2.5"/>
        <path d="M${x} ${y - 8}C${x - 15} ${y - 21} ${x + 14} ${y - 34} ${x} ${y - railHeight + 6}" stroke="#526b48" stroke-width="2"/>
        <path d="M${x} ${y - 31}C${x - 12} ${y - 35} ${x - 13} ${y - 47} ${x - 6} ${y - 49}C${x + 1} ${y - 45} ${x - 3} ${y - 36} ${x} ${y - 31}Z" stroke="#a89460" stroke-width="1"/>
      </g>`;
    };
    const railing = (back, landing = false) => {
      const parts = [];
      const segments = landing ? 26 : count - 1;
      const from = landing ? 2.4 : start;
      const sweep = landing ? Math.PI * 2 - 1.1 : segments * turn;
      for (let i = 0; i < segments; i++) {
        const angle = from + sweep * i / segments;
        const end = from + sweep * (i + 1) / segments;
        if ((Math.sin((angle + end) / 2) < 0) !== back) continue;
        const level = landing ? 0 : i;
        const rail = Array.from({ length: 5 }, (_, j) => {
          const [x, y] = point(angle + (end - angle) * j / 4, radius + 3, landing ? 0 : i + j / 4);
          return [x, y - railHeight];
        });
        parts.push(baluster(angle, level), `<path d="${path(rail)}" fill="none" stroke="#2e4433" stroke-width="7" stroke-linecap="round"/>
          <path d="${path(rail.map(([x, y]) => [x, y - 2]))}" fill="none" stroke="url(#h-brass)" stroke-width="2.2" stroke-linecap="round"/>`);
      }
      return parts.join('');
    };
    if (upstairs) {
      return `<g data-stair-art="spiral-down">
        <defs><clipPath id="h-stair-well"><ellipse cx="${cx}" cy="${floorY}" rx="${radius + 4}" ry="${(radius + 4) * depth}"/></clipPath></defs>
        <ellipse cx="${cx}" cy="${floorY + 6}" rx="${radius + 11}" ry="${radius * depth + 7}" fill="#756b4d"/>
        <ellipse cx="${cx}" cy="${floorY}" rx="${radius + 4}" ry="${(radius + 4) * depth}" fill="#26362b"/>
        ${railing(true, true)}
        <g clip-path="url(#h-stair-well)">
          ${Array.from({ length: count }, (_, i) => tread(count - 1 - i)).join('')}
          <path d="M${cx - 7} ${floorY - 5}V${floorY + 140}H${cx + 7}V${floorY - 5}Z" fill="url(#h-brass)"/>
          <ellipse cx="${cx}" cy="${floorY + 41}" rx="${radius}" ry="${radius * depth}" fill="#203428" opacity=".2"/>
        </g>
        <ellipse cx="${cx}" cy="${floorY}" rx="${radius + 5}" ry="${(radius + 5) * depth}" fill="none" stroke="url(#h-wood)" stroke-width="7"/>
        <ellipse cx="${cx}" cy="${floorY - 2}" rx="${radius + 7}" ry="${(radius + 5) * depth}" fill="none" stroke="url(#h-brass)" stroke-width="2"/>
        ${railing(false, true)}
        <path d="M${cx - 7} ${floorY}V${floorY - 31}Q${cx} ${floorY - 40} ${cx + 7} ${floorY - 31}V${floorY}" fill="url(#h-brass)" stroke="#6e683e" stroke-width="1"/>
      </g>`;
    }
    return `<g data-stair-art="spiral-up">
      <defs><clipPath id="h-stair-ascent"><path d="M638 ${ceilingY + openingDepth}H869V540H638Z"/><ellipse cx="${cx}" cy="${ceilingY}" rx="111" ry="${openingDepth}"/></clipPath></defs>
      <ellipse cx="${cx}" cy="${floorY + 16}" rx="118" ry="30" fill="#2c3d2b" opacity=".2"/>
      <ellipse data-stair-opening="ceiling" cx="${cx}" cy="${ceilingY}" rx="111" ry="${openingDepth}" fill="#3e4a35" stroke="#897a50" stroke-width="3"/>
      <g clip-path="url(#h-stair-ascent)">
      ${railing(true)}
      ${Array.from({ length: count }, (_, i) => tread(i)).join('')}
      <path d="M${cx - 7} ${ceilingY - openingDepth}V${floorY + 11}Q${cx} ${floorY + 19} ${cx + 7} ${floorY + 11}V${ceilingY - openingDepth}Z" fill="url(#h-brass)" stroke="#536047" stroke-width="1.5"/>
      <path d="M${cx - 3} ${ceilingY - openingDepth + 4}V${floorY + 10}" stroke="#e1cea0" stroke-width="1.2" opacity=".7"/>
      <ellipse cx="${cx}" cy="${floorY + 12}" rx="15" ry="6" fill="url(#h-wood)" stroke="url(#h-brass)" stroke-width="2"/>
      ${railing(false)}
      <path d="M${xy(point(start, radius + 3))}v-68" stroke="#334b37" stroke-width="5"/>
      <circle cx="${point(start, radius + 3)[0]}" cy="${point(start, radius + 3)[1] - 68}" r="5" fill="url(#h-brass)"/>
      </g>
    </g>`;
  }

  function skylight() {
    const ribs = [];
    for (let i = -5; i <= 5; i++) ribs.push(`<path d="M600 137Q${600 + i * 47} 66 ${600 + i * 100}-26" fill="none" stroke="#6b7653" stroke-width="3"/>`);
    return `<g><path d="M244 0Q600 257 956 0Z" fill="url(#h-glass)" stroke="#514936" stroke-width="12"/><path d="M244 0Q600 257 956 0Z" fill="url(#h-glass-speckle)"/>${ribs.join('')}<path d="M337 0Q600 173 863 0M414 0Q600 108 786 0" fill="none" stroke="#937a53" stroke-width="4"/><path d="M244 0Q600 257 956 0" fill="none" stroke="url(#h-brass)" stroke-width="4"/><path d="M600 0C553 16 535 44 600 82C665 44 647 16 600 0Z" fill="url(#h-rose)" stroke="#6a7653" stroke-width="3"/><path d="M600 2V82" stroke="#6a7653" stroke-width="2"/></g>`;
  }

  function sideDoor(room, right = false) {
    // Project the door into the wall: its top and sill converge into the hall.
    // An HTML wrapper preserves perspective division; SVG groups flatten it.
    const depth = 1 / 304;
    const matrix = [600 * depth, 350 * depth, 0, depth, 0, 520 / 450, 0, 0, 0, 0, 1, 0, right ? 1124 : 76, 89, 0, 1];
    return `<foreignObject width="1200" height="680" style="overflow:visible"><div xmlns="http://www.w3.org/1999/xhtml" class="house-door-art" data-door-art="${room}" style="position:absolute;left:0;top:0;width:220px;height:465px;transform-origin:0 0;transform:matrix3d(${matrix.join(',')})"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 465" width="220" height="465" style="overflow:visible" focusable="false">${doorFor(room)}</svg></div></foreignObject>`;
  }

  function scene(upstairs) {
    const leftRoom = upstairs ? 'music' : 'studio';
    const rightRoom = upstairs ? 'laboratory' : 'salon';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 680" preserveAspectRatio="none" focusable="false">${defs}
      <rect width="1200" height="680" fill="#90987a"/>
      <path d="M0 0H1200L811 152H389Z" fill="#485b43"/>
      <path d="M0 0 389 152V454L0 646Z" fill="url(#h-wall-left)"/>
      <path d="M1200 0 811 152V454L1200 646Z" fill="url(#h-wall-right)"/>
      <path d="M389 152H811V454H389Z" fill="url(#h-wall-back)"/>
      <path d="M0 0 389 152V454L0 646ZM1200 0 811 152V454L1200 646Z" fill="url(#h-wallpaper)"/>
      <path d="M0 445 389 378V454L0 646ZM1200 445 811 378V454L1200 646Z" fill="url(#h-wood)"/>
      <path d="M0 445 389 378V454L0 646ZM1200 445 811 378V454L1200 646Z" fill="url(#h-grain)"/>
      <g stroke="#a8915a" stroke-width="2" fill="none"><path d="M0 444 389 377M0 453 389 384M1200 444 811 377M1200 453 811 384"/><path d="M20 460v167m54-177v152m268-198v72m-44-63v86m881-41v168m-54-178v152m-266-198v72m44-63v86"/></g>
      <path d="M0 680V646L389 454H811L1200 646V680Z" fill="url(#h-floor)"/>
      ${mosaic()}
      <path d="M0 36 389 176H811L1200 36" fill="none" stroke="#4c4d36" stroke-width="12"/><path d="M0 29 389 166H811L1200 29" fill="none" stroke="url(#h-brass)" stroke-width="3"/>
      <path d="M0 646 389 454H811L1200 646" fill="none" stroke="#3c4934" stroke-width="9"/>
      ${skylight()}
      <g data-house-structure="timber">
        <use href="#h-column" transform="translate(361 109) scale(.7 .7)"/><use href="#h-column" transform="translate(861 109) scale(.7 .7)"/>
        <path d="M361 150C404 124 399 51 460 42Q600 17 740 42C801 51 796 124 861 150" fill="none" stroke="#394b35" stroke-width="12"/><path d="M361 146C404 120 399 47 460 38Q600 13 740 38C801 47 796 120 861 146" fill="none" stroke="url(#h-brass)" stroke-width="3"/>
      </g>
      ${sideDoor(leftRoom)}
      ${sideDoor(rightRoom, true)}
      ${upstairs ? `<g transform="translate(467 202)"><path d="M0 185V58C0-20 158-20 158 58V185Z" fill="url(#h-glass)" stroke="url(#h-wood)" stroke-width="12"/><path d="M0 185V58C0-20 158-20 158 58V185Z" fill="url(#h-glass-speckle)" stroke="url(#h-brass)" stroke-width="2"/><path d="M79 185V2M0 68C34 69 49 130 79 139C109 130 124 69 158 68M79 14C65 41 35 51 35 90C35 122 79 148 79 185C79 148 123 122 123 90C123 51 93 41 79 14" fill="none" stroke="#526848" stroke-width="3"/><path d="M-11 185H169" stroke="url(#h-wood)" stroke-width="13"/></g><path d="M491 423H602V434H491ZM500 434V471M593 434V471" fill="url(#h-wood)" stroke="#6d6041" stroke-width="3"/><use href="#h-plant" transform="translate(546 421) scale(.22)"/>${staircase(true)}` : `<g class="house-door-art" data-door-art="garden" transform="translate(453 208) scale(.72 .57)">${doorFor('garden')}</g>${staircase()}`}
      <path d="M0 81C79 88 36 205 69 266M1200 81C1121 88 1164 205 1131 266" fill="none" stroke="#667c53" stroke-width="5"/>
      <use href="#h-sconce" transform="translate(331 251) scale(.67)"/><use href="#h-sconce" transform="translate(875 251) scale(.67)"/>
      <use href="#h-plant" transform="translate(408 473) scale(.56)"/><use href="#h-plant" transform="translate(1121 568) scale(.9)"/>
      <ellipse cx="550" cy="461" rx="139" ry="64" fill="url(#h-light)"/>
      <path d="M0 0H1200V680H0Z" fill="url(#h-shade)"/>
      <g transform="translate(600 159)"><path d="M0-31v32" stroke="#484a33" stroke-width="3"/><path d="M-20 0Q0-19 20 0L27 25Q0 42-27 25Z" fill="#d2c794" stroke="#746644" stroke-width="2"/><path d="M-20 0H20M-27 25H27M0-7V32" fill="none" stroke="#7c7450" stroke-width="1.5"/><ellipse cy="39" rx="80" ry="77" fill="url(#h-light)"/></g>
    </svg>`;
  }

  const scenes = { ground: scene(false), first: scene(true) };
  let activeFloor;
  const groundDoors = document.getElementById('house-doors');
  const upperDoors = document.getElementById('house-upstairs-doors');
  const locationName = document.getElementById('house-location-name');
  locationName.setAttribute('aria-live', 'polite');
  function changeFloor() {
    const floor = window.location.hash === '#first-floor' ? 'first' : 'ground';
    if (floor === activeFloor) return;
    const moveFocus = (floor === 'first' ? groundDoors : upperDoors).contains(document.activeElement);
    activeFloor = floor;
    illustration.innerHTML = scenes[floor];
    groundDoors.hidden = floor !== 'ground';
    upperDoors.hidden = floor !== 'first';
    locationName.textContent = floor === 'first' ? 'Landing' : 'Hall';
    document.querySelectorAll('.house-floor-switch [data-house-floor]').forEach(link => {
      if (link.dataset.houseFloor === floor) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    if (moveFocus) (floor === 'first' ? upperDoors : groundDoors).querySelector('a').focus({ preventScroll: true });
  }
  window.addEventListener('hashchange', changeFloor);
  changeFloor();
  document.querySelectorAll('[data-room]').forEach(link => {
    const highlight = on => illustration.querySelector(`[data-door-art="${link.dataset.room}"]`)?.classList.toggle('is-hovered', on);
    link.addEventListener('pointerenter', () => highlight(true));
    link.addEventListener('pointerleave', () => highlight(false));
    link.addEventListener('focus', () => highlight(true));
    link.addEventListener('blur', () => highlight(false));
    link.addEventListener('click', event => {
      // Preserve new-tab clicks and follow the link immediately with reduced motion.
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      event.preventDefault();
      const rect = link.getBoundingClientRect();
      const sceneRect = illustration.getBoundingClientRect();
      illustration.style.transformOrigin = `${(rect.left + rect.width / 2 - sceneRect.left) / sceneRect.width * 100}% ${(rect.top + rect.height / 2 - sceneRect.top) / sceneRect.height * 100}%`;
      document.getElementById('house-scene').classList.add('house-entering');
      window.setTimeout(() => window.location.assign(link.href), 230);
    });
  });
  window.addEventListener('pageshow', () => document.getElementById('house-scene').classList.remove('house-entering'));
})();
