'use strict';

// Six wooden ways connect the hall to the room stations. Keep the board
// static between interactions: only the pawn and camera move during a journey.
(() => {
  const host = document.getElementById('board');
  if (!host) return;
  const WORLD = 4000, C = 2000, hallR = 300, stationR = 230, VIEW = 1150;
  const rooms = [
    { id: 'garden', name: 'Maze garden', href: '/laby.html', icon: 'icon-garden', angle: -90, distance: 1220, floor: 'ground' },
    { id: 'salon', name: 'Games room', href: '/urBoard.html', icon: 'icon-salon', angle: 40, distance: 1280, floor: 'ground' },
    { id: 'studio', name: 'Drawing studio', href: '/drawing.html', icon: 'icon-studio', angle: 140, distance: 1280, floor: 'ground' },
    { id: 'music', name: 'Musical Mining', href: '/musical-mining/', icon: 'icon-music', angle: -35, distance: 1390, floor: 'first' },
    { id: 'laboratory', name: 'Chemical Rakoon', href: '/chemical-rakoon/', icon: 'icon-laboratory', angle: -145, distance: 1390, floor: 'first' },
    { id: 'glyphs', name: 'Glyphs', href: '/glyphs.html', icon: 'icon-glyphs', angle: 90, distance: 1220, floor: 'first' }
  ];
  const rad = a => a * Math.PI / 180;
  const f = n => Number(n.toFixed(1));
  const bezier = ([p0, p1, p2, p3], t) => {
    const s = 1 - t;
    return [0, 1].map(axis => s ** 3 * p0[axis] + 3 * s * s * t * p1[axis] + 3 * s * t * t * p2[axis] + t ** 3 * p3[axis]);
  };
  rooms.forEach((room, i) => {
    const dir = [Math.cos(rad(room.angle)), Math.sin(rad(room.angle))];
    const normal = [-dir[1], dir[0]];
    room.at = [C + dir[0] * room.distance, C + dir[1] * room.distance];
    const p0 = [C + dir[0] * hallR, C + dir[1] * hallR];
    const p3 = [room.at[0] - dir[0] * stationR, room.at[1] - dir[1] * stationR];
    const span = Math.hypot(p3[0] - p0[0], p3[1] - p0[1]);
    const bend = (room.floor === 'first' ? 150 : 230) * (i % 2 ? 1 : -1);
    room.curve = [p0, [p0[0] + dir[0] * span * .35 + normal[0] * bend, p0[1] + dir[1] * span * .35 + normal[1] * bend], [p3[0] - dir[0] * span * .35 - normal[0] * bend, p3[1] - dir[1] * span * .35 - normal[1] * bend], p3];
    // Arc-length samples so the pawn walks at an even pace.
    const samples = Array.from({ length: 241 }, (_, k) => bezier(room.curve, k / 240));
    const lengths = [0];
    samples.slice(1).forEach((p, k) => lengths.push(lengths[k] + Math.hypot(p[0] - samples[k][0], p[1] - samples[k][1])));
    room.length = lengths[240];
    room.samples = samples;
    room.lengths = lengths;
    room.dir = dir;
  });
  const pointAt = (room, fraction) => {
    const target = Math.min(Math.max(fraction, 0), 1) * room.length;
    let k = room.lengths.findIndex(d => d >= target);
    if (k <= 0) return { at: room.samples[0], tangent: room.dir };
    const a = room.samples[k - 1], b = room.samples[k];
    const t = (target - room.lengths[k - 1]) / (room.lengths[k] - room.lengths[k - 1] || 1);
    const at = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return { at, tangent: [(b[0] - a[0]) / len, (b[1] - a[1]) / len] };
  };

  const defs = `<defs>
    <linearGradient id="w-wood" x2="1" y2=".15"><stop stop-color="#3d2b1f"/><stop offset=".25" stop-color="#7d523a"/><stop offset=".5" stop-color="#5a3c2a"/><stop offset=".75" stop-color="#8a6042"/><stop offset="1" stop-color="#34271c"/></linearGradient>
    <linearGradient id="w-brass" x2=".9" y2="1"><stop stop-color="#efe2a8"/><stop offset=".3" stop-color="#b39f62"/><stop offset=".55" stop-color="#7c6539"/><stop offset=".8" stop-color="#d8c07a"/><stop offset="1" stop-color="#8c7349"/></linearGradient>
    <pattern id="w-grain" width="256" height="512" patternUnits="userSpaceOnUse"><image href="/assets/ur/walnut-c5c3c1369b.webp" width="256" height="512" opacity=".5"/></pattern>
    <linearGradient id="w-paper" x2=".7" y2="1"><stop stop-color="#e4deca"/><stop offset=".45" stop-color="#dad7c0"/><stop offset="1" stop-color="#b7bda3"/></linearGradient>
    <linearGradient id="w-sage" x2=".7" y2="1"><stop stop-color="#b7bf9d"/><stop offset="1" stop-color="#778969"/></linearGradient>
    <linearGradient id="w-rose" x2=".6" y2="1"><stop stop-color="#dbc0ae"/><stop offset="1" stop-color="#aa7d7c"/></linearGradient>
    <pattern id="w-linen" width="160" height="160" patternUnits="userSpaceOnUse"><path d="m12 9 3-1m26 19 5 1m41-12 2 1m35 24 4-1m-105 25 3 1m41 9 6-1m40 14 2 1m31-7 4 1m-116 31 5-1m27 18 2 1m39-7 4-1m31 23 5 1m-99 17 3-1m46-2 4 1m39-5 2-1" stroke="#52614b" stroke-width=".8" opacity=".12"/><path d="m23 34 7 1m64 12 5-1m-51 56 8 1m70 12 6-1m-112 33 5 1" stroke="#fff8de" stroke-width="1" opacity=".3"/></pattern>
    <g id="w-sprig" fill="none" stroke="#9c8659" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
      <path d="M0 100C2 66 45 62 38 29C34 11 12 12 13 28C14 40 29 39 27 30M0 100C-2 66-45 62-38 29C-34 11-12 12-13 28C-14 40-29 39-27 30"/>
      <path d="M19 65C10 53 11 43 21 38C30 47 28 56 19 65ZM-19 65C-10 53-11 43-21 38C-30 47-28 56-19 65Z" fill="url(#w-sage)"/>
      <path d="M0 48C-13 34-12 14 0 2C12 14 13 34 0 48Z" fill="url(#w-rose)"/>
      <path d="M0 15V84"/>
    </g>
    <pattern id="w-field" width="320" height="320" patternUnits="userSpaceOnUse">
      <path d="M80 0C20 100 140 220 80 320M240 0C300 100 180 220 240 320" fill="none" stroke="#9fae8d" stroke-width="2.6" opacity=".42"/>
      <path d="M63 58C37 52 30 26 44 14C58 28 66 44 63 58ZM101 132C127 126 134 100 120 88C106 102 98 118 101 132ZM60 214C34 208 27 182 41 170C55 184 63 200 60 214ZM100 290C126 284 133 258 119 246C105 260 97 276 100 290ZM257 58C283 52 290 26 276 14C262 28 254 44 257 58ZM219 132C193 126 186 100 200 88C214 102 222 118 219 132ZM260 214C286 208 293 182 279 170C265 184 257 200 260 214ZM220 290C194 284 187 258 201 246C215 260 223 276 220 290Z" fill="#b8c2a2" stroke="#93a384" stroke-width=".8" opacity=".55"/>
      <path d="M160 70C150 58 150 42 160 34C170 42 170 58 160 70ZM160 70C172 60 188 60 196 70C188 80 172 80 160 70ZM160 70C148 60 132 60 124 70C132 80 148 80 160 70ZM160 70C170 82 170 98 160 106C150 98 150 82 160 70ZM160 230C150 218 150 202 160 194C170 202 170 218 160 230ZM160 230C172 220 188 220 196 230C188 240 172 240 160 230ZM160 230C148 220 132 220 124 230C132 240 148 240 160 230ZM160 230C170 242 170 258 160 266C150 258 150 242 160 230Z" fill="#d6b9ad" stroke="#b59187" stroke-width=".8" opacity=".6"/>
      <path d="M160 70m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0ZM160 230m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0Z" fill="#c9ab6a" opacity=".7"/>
      <path d="M0 150C40 136 60 164 100 150M220 150C260 136 280 164 320 150" fill="none" stroke="#b6bf9e" stroke-width="1.4" opacity=".5"/>
    </pattern>
    <pattern id="w-frieze" width="200" height="74" patternUnits="userSpaceOnUse">
      <rect width="200" height="74" fill="#374f3e"/>
      <path d="M0 37C30 8 70 8 100 37S170 66 200 37M0 37C30 66 70 66 100 37S170 8 200 37M0 5H200M0 69H200" fill="none" stroke="#bfac79" stroke-width="1.7"/>
      <path d="M50 23C34 20 32 7 42 8C53 10 58 15 50 23ZM150 51C134 54 132 67 142 66C153 64 158 59 150 51Z" fill="#93a07c"/>
      <path d="M100 37C86 27 88 13 100 8C112 13 114 27 100 37ZM100 37C86 47 88 61 100 66C112 61 114 47 100 37Z" fill="#b38c81" stroke="#c5b384" stroke-width=".8"/>
    </pattern>
    <g id="w-planter" stroke="#6b7658" stroke-width="2" stroke-linejoin="round">
      <path d="M-40 0H40L29 66H-29Z" fill="url(#w-wood)"/><path d="M-42 0H42M-29 57H29" stroke="#c1ab6e" stroke-width="5"/>
      <path d="M0-4C-5-50-65-62-64-106C-25-93-4-55 0-4ZM0-4C4-55 54-66 64-108C25-99 8-54 0-4ZM0-4C-12-68-28-97-10-148C12-114 4-66 0-4Z" fill="url(#w-sage)"/>
      <path d="M0-5L-9-132M0-5Q-12-63-56-97M0-5Q16-67 57-100" fill="none" stroke="#cfce9f" stroke-width="1.2"/>
    </g>
    <g id="w-branch" stroke="#9c8659" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M0 0C90-5 96-85 187-92C252-97 280-151 260-180C236-215 191-190 204-164C214-145 240-153 233-167" fill="none"/>
      <path d="M54-26C20-28 14-65 23-76C50-64 57-47 54-26ZM105-66C111-104 149-114 166-100C145-76 129-65 105-66ZM187-92C155-104 151-135 164-149C191-135 199-116 187-92Z" fill="url(#w-sage)"/>
      <path d="M218-136C197-145 188-168 195-184C219-178 231-156 218-136Z" fill="url(#w-rose)"/>
      <path d="M37-57L54-26M126-85L105-66M173-128L187-92" fill="none" stroke-width="1"/>
    </g>
    <radialGradient id="w-glow" cx=".5" cy=".5"><stop stop-color="#fff3c4"/><stop offset=".55" stop-color="#f1cf7a"/><stop offset="1" stop-color="#b98b3c"/></radialGradient>
    <radialGradient id="w-halo" cx=".5" cy=".5"><stop offset=".6" stop-color="#f4e9bf" stop-opacity="0"/><stop offset="1" stop-color="#f4e9bf" stop-opacity=".55"/></radialGradient>
    <linearGradient id="w-wing" x2=".8" y2="1"><stop stop-color="#e7dfc3"/><stop offset="1" stop-color="#9fb8ad"/></linearGradient>
    <g id="w-leaf"><path d="M0 0C-15-18-16-48 0-72C16-48 15-18 0 0Z" fill="url(#w-sage)" stroke="#6f7d60" stroke-width="1"/><path d="M0-8V-60" fill="none" stroke="#dde3c3" stroke-width="1"/></g>
    <g id="w-bud"><path d="M0 0C-9-8-9-24 0-32C9-24 9-8 0 0Z" fill="url(#w-rose)" stroke="#8c5b61" stroke-width="1"/><path d="M0-2C-10-6-12-16-6-24M0-2C10-6 12-16 6-24" fill="none" stroke="#6f7d60" stroke-width="1.4" stroke-linecap="round"/></g>
    <g id="w-iris"><path d="M0 0C-20-12-34-42-14-66C-5-56 0-44 0-30C0-44 5-56 14-66C34-42 20-12 0 0Z" fill="url(#w-rose)" stroke="#8c5b61" stroke-width="1.2"/><path d="M0-28C-26-40-40-14-22 2M0-28C26-40 40-14 22 2" fill="none" stroke="#a9696d" stroke-width="2" stroke-linecap="round"/><path d="M-6-14C-2-30 2-30 6-14" fill="#efe2a8" stroke="#8c7349" stroke-width=".8"/></g>
    <g id="w-lamp"><path d="M0 0C-8-40-40-50-44-92" fill="none" stroke="#5a4a2a" stroke-width="4" stroke-linecap="round"/><path d="M0 0c-10-3-10-14 0-14s10 11 0 14Z" fill="#8d825e" stroke="#5a4a2a" stroke-width="1"/><circle cx="-44" cy="-92" r="30" fill="url(#w-halo)"/><path d="M-44-120c18 0 22 24 14 36H-58c-8-12-4-36 14-36Z" fill="url(#w-glow)" stroke="#8c6a2d" stroke-width="1.2"/><path d="M-62-84h36" stroke="#5a4a2a" stroke-width="2.5" stroke-linecap="round"/></g>
    <g id="w-dragonfly"><path d="M0 0C-10 14-18 44-4 52M0 0C10 14 18 44 4 52" fill="none" stroke="#546b60" stroke-width="2" stroke-linecap="round"/><path d="M0 4C-30-12-80-14-82 4C-70 20-30 18 0 4ZM0 4C30-12 80-14 82 4C70 20 30 18 0 4ZM0 10C-24 0-62 4-64 20C-52 32-24 24 0 10ZM0 10C24 0 62 4 64 20C52 32 24 24 0 10Z" fill="url(#w-wing)" fill-opacity=".75" stroke="#7d8c6e" stroke-width="1"/><path d="M0-10V54" stroke="#3e554a" stroke-width="4" stroke-linecap="round"/><circle cy="-8" r="5" fill="#3e554a"/></g>
    <g id="w-butterfly"><path d="M0 0C-16-34-60-42-62-10C-60 10-40 14-6 10ZM0 0C16-34 60-42 62-10C60 10 40 14 6 10ZM0 4C-14 14-46 36-40 48C-28 52-12 30 0 8ZM0 4C14 14 46 36 40 48C28 52 12 30 0 8Z" fill="url(#w-rose)" stroke="#8c5b61" stroke-width="1"/><path d="M-30-14c-8 4-10 10-6 16M30-14c8 4 10 10 6 16" fill="none" stroke="#efe2a8" stroke-width="2" opacity=".8"/><path d="M0-8V22M0-10C-6-18-12-22-14-28M0-10C6-18 12-22 14-28" fill="none" stroke="#3e554a" stroke-width="2.5" stroke-linecap="round"/></g>
    <g id="w-petal"><path d="M0 0C-9-6-10-22-2-30C8-24 10-10 0 0Z" fill="#d9bdb2" stroke="#b58f8a" stroke-width=".8" opacity=".85"/></g>
    <g id="w-spray" fill="none" stroke="#9c8659" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <path d="M0-46C44-46 58-12 36 8C22 20 2 8 14-2M0 46C44 46 58 12 36-8C22-20 2-8 14 2" stroke="#8d825e"/>
      <path d="M24 0C140-6 210-120 330-112C430-106 470-36 500-70C522-96 500-136 468-118C446-106 458-78 482-86"/>
      <path d="M90 2C170 44 230 124 340 114C404 108 432 74 414 52C398 34 370 50 386 66" stroke-width="2.4"/>
      <path d="M200-64C250-82 296-70 318-24M212 72C262 90 300 78 322 34" stroke-width="1.6" stroke="#b39f72"/>
      <use href="#w-leaf" transform="translate(120 -22) rotate(-128) scale(1.1)"/><use href="#w-leaf" transform="translate(212 -92) rotate(-150)"/><use href="#w-leaf" transform="translate(292 -118) rotate(168) scale(.9)"/><use href="#w-leaf" transform="translate(400 -100) rotate(170)"/>
      <use href="#w-leaf" transform="translate(160 44) rotate(136) scale(.95)"/><use href="#w-leaf" transform="translate(262 104) rotate(40) scale(.9)"/><use href="#w-leaf" transform="translate(360 108) rotate(-20) scale(.85)"/>
      <use href="#w-iris" transform="translate(318 -24) rotate(36) scale(1.1)"/><use href="#w-iris" transform="translate(322 34) rotate(-40) scale(.85)"/>
      <use href="#w-bud" transform="translate(482 -86) rotate(130) scale(1.1)"/><use href="#w-bud" transform="translate(386 66) rotate(-60) scale(.9)"/><use href="#w-bud" transform="translate(36 8) rotate(-80) scale(.7)"/><use href="#w-bud" transform="translate(36 -8) rotate(80) scale(.7)"/>
    </g>
    <g id="w-wreath">
      <circle r="478" fill="none" stroke="#b39f72" stroke-width="2"/><circle r="524" fill="none" stroke="#9c8659" stroke-width="1.2" stroke-dasharray="3 14"/>
      ${Array.from({ length: 24 }, (_, i) => `<use href="#w-leaf" transform="rotate(${i * 15}) translate(0 -468) rotate(${i % 2 ? 62 : -62}) scale(1.2)"/>`).join('')}
      ${Array.from({ length: 4 }, (_, i) => `<use href="#w-bud" transform="rotate(${45 + i * 90}) translate(0 -468) rotate(180) scale(1.3)"/>`).join('')}
    </g>
    <pattern id="w-turf" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M4 30l3-8M12 14l2-7M24 28l3-7M30 10l2-6M18 22l-2-6" stroke="#b9c79a" stroke-width="1.6" stroke-linecap="round" opacity=".7"/><path d="M8 8l2-5M26 18l-2-5M14 32l2-5" stroke="#6f865c" stroke-width="1.4" stroke-linecap="round" opacity=".6"/></pattern>
    <pattern id="w-boxwood" width="30" height="30" patternUnits="userSpaceOnUse"><circle cx="7" cy="8" r="6" fill="#7f9a66"/><circle cx="21" cy="5" r="5" fill="#a3b982" opacity=".9"/><circle cx="24" cy="20" r="6.5" fill="#5f7f52"/><circle cx="9" cy="23" r="5" fill="#a3b982" opacity=".8"/><circle cx="16" cy="15" r="4" fill="#4b6a46"/></pattern>
    <pattern id="w-gravel" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M3 4h2v2H3ZM14 2h2v2h-2ZM8 12h2v2H8ZM19 10h2v2h-2ZM4 19h2v2H4ZM15 18h2v2h-2Z" fill="#bfb28a" opacity=".8"/><path d="M10 6h1v1h-1ZM20 16h1v1h-1ZM12 21h1v1h-1Z" fill="#fff8de"/></pattern>
    <pattern id="w-tapestry" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M32 2L62 32L32 62L2 32Z" fill="none" stroke="#d3bd91" stroke-width="1.5" opacity=".55"/><path d="M32 20C28 26 28 36 32 44C36 36 36 26 32 20ZM20 32C26 28 36 28 44 32C36 36 26 36 20 32Z" fill="#b58d83" opacity=".7"/><circle cx="32" cy="32" r="3" fill="#d9b55a" opacity=".8"/><path d="M0 0h8v8H0ZM56 56h8v8h-8ZM0 56h8v8H0ZM56 0h8v8h-8Z" fill="#d3bd91" opacity=".35"/></pattern>
    <pattern id="w-tiles" width="44" height="44" patternUnits="userSpaceOnUse"><rect x="1.5" y="1.5" width="41" height="41" fill="#3f7a73"/><rect x="3" y="3" width="38" height="3" fill="#fff" opacity=".18"/><rect x="3" y="3" width="3" height="38" fill="#fff" opacity=".18"/><path d="M14 14h5v5h-5ZM25 14h5v5h-5ZM14 25h5v5h-5ZM25 25h5v5h-5Z" fill="#1d403d" opacity=".7"/></pattern>
    <pattern id="w-grid" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M0 .5H22M.5 0V22" stroke="#8c7349" stroke-width=".7" opacity=".22"/></pattern>
    <g id="w-scroll" fill="none" stroke="#bea56e" stroke-width="2.2" stroke-linecap="round"><path d="M-30 0C-16-18 0-18 0-4C0 6-10 6-10 0M30 0C16-18 0-18 0-4"/><path d="M-30 0C-24 8-14 10-10 2M30 0C24 8 14 10 10 2"/></g>
    <g id="w-mark"><path d="M0 22V8M0 16C-8 15-9 7-6 6c1 4 6 4 6 10Zm0 0c8-1 9-9 6-10-1 4-6 4-6 10ZM0 10C-9 5-3-2 0-3c3 1 9 8 0 13Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></g>
  </defs>`;

  // Small room emblems identify each destination on its signpost; the station
  // interiors are painted bitmaps from scripts/board-artwork.js.
  const craftDefs = `
    <linearGradient id="c-paper" x2=".3" y2="1"><stop stop-color="#f4ecd6"/><stop offset="1" stop-color="#e2d6b4"/></linearGradient>
    <radialGradient id="c-space" cx=".5" cy=".4"><stop stop-color="#2c2a5c"/><stop offset="1" stop-color="#14132e"/></radialGradient>
    <radialGradient id="c-teal" cx=".5" cy=".4"><stop stop-color="#2f6b68"/><stop offset="1" stop-color="#173a3a"/></radialGradient>
    <linearGradient id="c-fade" x2="0" y2="1"><stop stop-color="#1f3329" stop-opacity="0"/><stop offset=".45" stop-color="#1f3329" stop-opacity=".82"/><stop offset="1" stop-color="#1f3329" stop-opacity=".92"/></linearGradient>
    <g id="c-rose"><circle r="22" fill="#c48f93" stroke="#8a5a60" stroke-width="1.2"/><path d="M0 0c6-1 9 5 4 9c-6 4-14-2-11-9c4-9 17-11 23-3c6 9 0 22-10 24c-12 2-22-9-21-21" fill="none" stroke="#8a5a60" stroke-width="1.6" stroke-linecap="round"/><path d="M-20 10c-14 6-20 2-26-6c10-6 20-4 26 6ZM20 10c14 6 20 2 26-6c-10-6-20-4-26 6Z" fill="#6f8459" stroke="#8c7349" stroke-width="1"/></g>
    <g id="c-ur-tile"><rect x="-22" y="-22" width="44" height="44" rx="4" fill="#efe4c8" stroke="#8c7349" stroke-width="1.6"/><g fill="#3b5a8c">${Array.from({ length: 8 }, (_, i) => `<path d="M0 0C-5-4-5-14 0-17C5-14 5-4 0 0Z" transform="rotate(${i * 45})"/>`).join('')}</g><circle r="3" fill="#d9b55a"/></g>
    <g id="c-ur-die"><path d="M0-20L18 10H-18Z" fill="#efe4c8" stroke="#8c7349" stroke-width="1.4" stroke-linejoin="round"/><path d="M0-20L0 10" stroke="#c9b48a" stroke-width="1"/><circle cy="-14" r="2.4" fill="#3b5a8c"/></g>
    <g id="c-ur-piece-red"><circle r="14" fill="#9e5844" stroke="#5e3326" stroke-width="1.2"/><g fill="#efe4c8"><circle cx="-5" cy="-5" r="2"/><circle cx="5" cy="-5" r="2"/><circle r="2"/><circle cx="-5" cy="5" r="2"/><circle cx="5" cy="5" r="2"/></g></g>
    <g id="c-ur-piece"><circle r="14" fill="#3b5a8c" stroke="#1f3559" stroke-width="1.2"/><g fill="#efe4c8"><circle cx="-5" cy="-5" r="2"/><circle cx="5" cy="-5" r="2"/><circle r="2"/><circle cx="-5" cy="5" r="2"/><circle cx="5" cy="5" r="2"/></g></g>
    <g id="c-sheet"><path d="M-30-36H30V36H-30Z" fill="url(#c-paper)" stroke="#8c7349" stroke-width="1.4" transform="rotate(-6)"/><path d="M0 24V2M0 14C-10 13-11 3-7 2c1 5 7 5 7 12Zm0 0c10-1 11-11 7-12c-1 5-7 5-7 12ZM0 6C-10 0-4-8 0-9c4 1 10 9 0 15Z" fill="none" stroke="#2f3a33" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" transform="rotate(-6) translate(0 -2)"/><path d="M-18 30C-8 26 4 27 16 30" fill="none" stroke="#a9696d" stroke-width="1.4" stroke-linecap="round"/></g>
    <g id="c-pencil"><path d="M-30 10L22-28l8 8L-22 18Z" fill="#d9b55a" stroke="#8c7349" stroke-width="1.2" stroke-linejoin="round"/><path d="M22-28l8 8l6-2l-4-12Z" fill="#efe4c8" stroke="#8c7349" stroke-width="1.2" stroke-linejoin="round"/><path d="M-30 10l-8 8l12-2Z" fill="#2f3a33"/><path d="M-26 6L18-24" stroke="#8c7349" stroke-width=".8" opacity=".6"/></g>
    <g id="c-ink"><path d="M0-18C6-8 12-2 12 6A12 12 0 0 1-12 6C-12-2-6-8 0-18Z" fill="#2f3a33" stroke="#1b2a22" stroke-width="1"/><circle cx="-4" cy="4" r="2.5" fill="#6f8f80" opacity=".8"/></g>
    <g id="c-note"><path d="M-6 14V-18l20-6V8" fill="none" stroke="#e9c75a" stroke-width="4" stroke-linejoin="miter"/><rect x="-16" y="10" width="12" height="8" fill="#e9c75a"/><rect x="4" y="4" width="12" height="8" fill="#e9c75a"/></g>
    <g id="c-pixel-star"><path d="M-2-8h4v6h6v4h-6v6h-4v-6h-6v-4h6Z" fill="#f3e4b2"/></g>
    <g id="c-planet"><circle r="24" fill="#5f9a5a" stroke="#2f5f3a" stroke-width="2"/><path d="M-12-8h6v6h-6ZM4-2h8v8H4ZM-8 10h6v4h-6Z" fill="#2f5f3a"/><path d="M-40 6C-20 20 20 20 40 6" fill="none" stroke="#b7c9e6" stroke-width="2.5" stroke-linecap="round"/><path d="M-40 6C-30-2-16-6 0-6" fill="none" stroke="#b7c9e6" stroke-width="2.5" stroke-linecap="round" opacity=".5"/></g>
    <g id="c-flask"><path d="M-8-30h16v12l16 30q3 8-6 8H-18q-9 0-6-8l16-30Z" fill="#dfe8df" fill-opacity=".55" stroke="#c9ab6a" stroke-width="1.8" stroke-linejoin="round"/><path d="M-14 0l-8 14q-2 6 4 6h36q6 0 4-6L14 0Z" fill="#4fb3a5" opacity=".85"/><path d="M-10-30h20" stroke="#c9ab6a" stroke-width="3" stroke-linecap="round"/><circle cx="-4" cy="8" r="2.4" fill="#e7fff9"/><circle cx="6" cy="2" r="1.8" fill="#e7fff9"/><circle cx="2" cy="-6" r="1.4" fill="#e7fff9"/></g>
    <g id="c-bubble"><circle r="9" fill="#9fe0d4" fill-opacity=".35" stroke="#bff2e8" stroke-width="1.4"/><circle cx="-3" cy="-3" r="2" fill="#e7fff9"/></g>
    <g id="c-hex"><path d="M0-16l14 8v16L0 16l-14-8V-8Z" fill="none" stroke="#9fe0d4" stroke-width="1.6" stroke-linejoin="round"/><circle r="2.5" fill="#9fe0d4"/></g>
    <g id="c-glyph"><circle r="22" fill="url(#c-paper)" stroke="#8c7349" stroke-width="1.4"/><path d="M-11-9h16l5 5v18h-21Z" fill="#f3ecd6" stroke="#8c7349" stroke-width="1.4" stroke-linejoin="round"/><path d="M-14 12C-4 0 6-10 14-16C8-6 2 4-8 14Z" fill="#8c7349"/><path d="M-14 12L-17 16" stroke="#8c7349" stroke-width="1.6" stroke-linecap="round"/></g>`;
  // Painted interiors, built and hashed by scripts/build-board-artwork.cjs.
  const interiors = {
    garden: '/assets/board/garden-78082aa1d5.webp',
    salon: '/assets/board/salon-da7bdb1a42.webp',
    studio: '/assets/board/studio-76e137667d.webp',
    music: '/assets/board/music-ad118c8d97.webp',
    laboratory: '/assets/board/laboratory-8f2439ab94.webp',
    glyphs: '/assets/board/glyphs-3350873c72.webp'
  };
  const crafts = {
    garden: {
      emblem: '<use href="#c-rose" transform="scale(1.35)"/>'
    },
    salon: {
      emblem: '<use href="#c-ur-tile" transform="scale(1.3)"/>'
    },
    studio: {
      emblem: '<use href="#c-sheet" transform="scale(1.05)"/><use href="#c-pencil" transform="translate(16 18) scale(.6)"/>'
    },
    music: {
      emblem: '<circle r="40" fill="url(#c-space)"/><use href="#c-pixel-star" transform="translate(-22 -18) scale(.6)"/><use href="#c-pixel-star" transform="translate(24 14) scale(.5)"/><use href="#c-note" transform="translate(2 2) scale(1.1)"/>'
    },
    laboratory: {
      emblem: '<circle r="40" fill="url(#c-teal)"/><use href="#c-flask" transform="translate(0 6) scale(1.05)"/><use href="#c-bubble" transform="translate(-24 -22) scale(.6)"/>'
    },
    glyphs: {
      emblem: '<use href="#c-glyph" transform="scale(1.6)"/>'
    }
  };

  // A single rosette gives the hall a focal point.
  const rosette = (cx, cy, r, petals = 12) => {
    const at = (a, d) => [f(cx + Math.cos(a) * d), f(cy + Math.sin(a) * d)];
    const petal = (a, d, w, fill) => {
      const tip = at(a, d), l1 = at(a - w, d * .5), l2 = at(a - w * .35, d * .95), r2 = at(a + w * .35, d * .95), r1 = at(a + w, d * .5);
      return `<path d="M${cx} ${cy}C${l1} ${l2} ${tip}C${r2} ${r1} ${cx} ${cy}Z" fill="${fill}" stroke="#44563f" stroke-width="1.2"/>`;
    };
    return `<g><circle cx="${cx}" cy="${cy}" r="${r + 14}" fill="#c9bf9d" stroke="#3c5843" stroke-width="5"/><circle cx="${cx}" cy="${cy}" r="${r + 2}" fill="none" stroke="url(#w-brass)" stroke-width="2.5"/><circle cx="${cx}" cy="${cy}" r="${r - 6}" fill="#d9d0ae" stroke="#5f7051" stroke-width="1"/>
      ${Array.from({ length: petals }, (_, i) => petal(i * Math.PI * 2 / petals, r * .88, .4, i % 2 ? 'url(#w-rose)' : 'url(#w-sage)')).join('')}
      ${Array.from({ length: petals }, (_, i) => petal(i * Math.PI * 2 / petals + Math.PI / petals, r * .5, .32, '#dccfa6')).join('')}
      <circle cx="${cx}" cy="${cy}" r="${r * .14}" fill="url(#w-brass)" stroke="#5a4a2a" stroke-width="1"/></g>`;
  };

  // A simple tapered path retains the curved route, with treads for stairs.
  // Sixty samples keep the edge smooth without hundreds of path segments.
  const way = room => {
    const steps = 60;
    const left = [], right = [], spine = [], treads = [], joints = [], studs = [], rails = [[], []], posts = [];
    for (let k = 0; k <= steps; k++) {
      const fraction = k / steps;
      const { at, tangent } = pointAt(room, fraction);
      const n = [-tangent[1], tangent[0]];
      const half = 31 - 10 * fraction;
      left.push(`${f(at[0] + n[0] * half)} ${f(at[1] + n[1] * half)}`);
      right.push(`${f(at[0] - n[0] * half)} ${f(at[1] - n[1] * half)}`);
      spine.push(`${f(at[0])} ${f(at[1])}`);
      if (k % 9 === 5) {
        joints.push(`M${f(at[0] + n[0] * half)} ${f(at[1] + n[1] * half)}L${f(at[0] - n[0] * half)} ${f(at[1] - n[1] * half)}`);
        for (const side of [-1, 1]) {
          const x = f(at[0] + n[0] * (half - 6) * side), y = f(at[1] + n[1] * (half - 6) * side);
          studs.push(`M${f(x - 2)} ${y}a2 2 0 1 0 4 0a2 2 0 1 0-4 0Z`);
        }
      }
      if (room.floor === 'first') {
        [-1, 1].forEach((side, i) => {
          rails[i].push(`${f(at[0] + n[0] * (half + 14) * side)} ${f(at[1] + n[1] * (half + 14) * side)}`);
          if (k % 12 === 0) posts.push(`M${f(at[0] + n[0] * half * side)} ${f(at[1] + n[1] * half * side)}l${f(n[0] * 14 * side)} ${f(n[1] * 14 * side)}`);
        });
      }
      if (room.floor === 'first' && k % 3 === 1) treads.push(`M${f(at[0] + n[0] * (half - 3))} ${f(at[1] + n[1] * (half - 3))}L${f(at[0] - n[0] * (half - 3))} ${f(at[1] - n[1] * (half - 3))}`);
    }
    const band = `M${left.join('L')}L${right.reverse().join('L')}Z`;
    const mid = pointAt(room, .53);
    // A thinner vine twines across the stem, with leaves and buds on its
    // outside curves and a lamp on a curved stalk at each third.
    const vine = [], sprouts = [];
    const flip = room.id === 'salon' || room.id === 'laboratory' ? -1 : 1;
    for (let k = 0; k <= steps; k++) {
      const fraction = k / steps;
      const { at, tangent } = pointAt(room, fraction);
      const n = [-tangent[1], tangent[0]];
      const swing = Math.sin(fraction * Math.PI * 5) * flip * (26 - 8 * fraction);
      vine.push([f(at[0] + n[0] * swing), f(at[1] + n[1] * swing)]);
      if (k % 12 === 6) {
        const side = Math.sign(swing) || 1;
        const heading = f(Math.atan2(tangent[1], tangent[0]) * 180 / Math.PI + 90 - side * 118);
        sprouts.push(`<use href="#${k % 24 === 6 ? 'w-leaf' : 'w-bud'}" transform="translate(${f(at[0] + n[0] * swing)} ${f(at[1] + n[1] * swing)}) rotate(${heading}) scale(.75)"/>`);
      }
    }
    const vinePath = vine.slice(1).map((p, k) => `Q${vine[k]} ${f((vine[k][0] + p[0]) / 2)} ${f((vine[k][1] + p[1]) / 2)}`).join('');
    const lamps = [.3, .72].map((fraction, i) => {
      const { at, tangent } = pointAt(room, fraction);
      const side = (i ? -1 : 1) * flip;
      const edge = [f(at[0] - tangent[1] * 38 * side), f(at[1] + tangent[0] * 38 * side)];
      return `<use href="#w-lamp" transform="translate(${edge}) rotate(${f(room.angle + 90 - 90 * side)}) scale(${side},1)"/>`;
    }).join('');
    const ornament = `<g aria-hidden="true" pointer-events="none"><path d="M${vine[0]}${vinePath}" fill="none" stroke="#dcc68e" stroke-width="2.2" stroke-opacity=".9" stroke-linecap="round"/>${sprouts.join('')}${lamps}<use href="#w-sprig" transform="translate(${f(mid.at[0] - mid.tangent[1] * 100)} ${f(mid.at[1] + mid.tangent[0] * 100)}) rotate(${f(room.angle + 90)}) scale(1.1)" opacity=".8"/></g>`;
    return `<a class="world-way" href="#${room.id}" data-way="${room.id}" aria-label="Follow the ${room.floor === 'first' ? 'stairs' : 'stem'} to the ${room.name}">
      <path d="M${spine.join('L')}" fill="none" stroke="transparent" stroke-width="150"/>
      <path class="world-way-band" d="${band}" fill="url(#w-wood)" stroke="#c9ab6a" stroke-width="3" stroke-linejoin="round"/>
      <path d="${band}" fill="url(#w-grain)" pointer-events="none"/>
      <path d="M${spine.join('L')}" fill="none" stroke="#d9bd7e" stroke-width="1" opacity=".5" pointer-events="none"/>
      <path d="${joints.join('')}" stroke="#34291f" stroke-width="2" opacity=".7"/>
      <path d="${studs.join('')}" fill="#d5bd79"/>
      ${treads.length ? `<path d="${treads.join('')}" stroke="#d8c07a" stroke-width="2.4" stroke-linecap="round"/><path d="${rails.map(side => 'M' + side.join('L')).join('')}" fill="none" stroke="#687858" stroke-width="4" stroke-linecap="round"/><path d="${posts.join('')}" stroke="#9c9161" stroke-width="3"/>` : ''}
    </a>${ornament}`;
  };

  const station = room => {
    const [x, y] = room.at;
    const inner = stationR - 26;
    return `<g class="world-station" data-station="${room.id}" transform="translate(${f(x)} ${f(y)})">
      <defs><clipPath id="c-clip-${room.id}"><circle r="${inner}"/></clipPath></defs>
      <circle r="${stationR + 24}" fill="none" stroke="#efe2a8" stroke-opacity=".55" stroke-width="6"/>
      <circle r="${stationR + 24}" fill="none" stroke="#5a4421" stroke-width="1.5"/>
      <circle r="${stationR}" fill="url(#w-wood)" stroke="#2a1d14" stroke-width="2"/>
      <circle r="${stationR}" fill="url(#w-grain)"/>
      <circle r="${stationR - 9}" fill="none" stroke="#c9ab6a" stroke-width="1.5"/>
      <g clip-path="url(#c-clip-${room.id})"><image href="${interiors[room.id]}" x="${-inner}" y="${-inner}" width="${inner * 2}" height="${inner * 2}"/><rect x="${-inner}" y="-10" width="${inner * 2}" height="${inner + 10}" fill="url(#c-fade)"/></g>
      <circle class="world-station-ring" r="${inner}" fill="none" stroke="url(#w-brass)" stroke-width="3"/>
      <text class="world-station-name" text-anchor="middle" y="52">${room.name}</text>
      <a class="world-enter" href="${room.href}" data-room="${room.id}" aria-label="Enter the ${room.name}"><rect x="-108" y="72" width="216" height="50" rx="14" fill="url(#w-brass)" stroke="#5a4421" stroke-width="1.5"/><rect x="-102" y="78" width="204" height="38" rx="10" fill="none" stroke="#5a4421" stroke-opacity=".5" stroke-width="1"/><text text-anchor="middle" y="105">Enter</text></a>
      <a class="world-back" href="#hall" aria-label="Back to the hall"><rect x="-60" y="134" width="120" height="36" rx="10" fill="#1f3329" stroke="url(#w-brass)" stroke-width="1.5"/><text text-anchor="middle" y="159">← Hall</text></a>
    </g>`;
  };

  const signpost = room => {
    // The signpost is the room's emblem in a brass ring, pointing down its stem.
    const d = room.dir;
    const [x, y] = [C + d[0] * (hallR + 118), C + d[1] * (hallR + 118)];
    const width = room.name.length * 10.5 + 30;
    return `<a class="world-sign" href="#${room.id}" data-sign="${room.id}" aria-label="Set off for the ${room.name}" transform="translate(${f(x)} ${f(y)})">
      <g transform="rotate(${f(room.angle)})"><path d="M58-10L74 0L58 10" fill="url(#w-brass)" stroke="#5a4421" stroke-width="1.2" stroke-linejoin="round"/></g>
      <circle r="56" fill="#2a1d14" opacity=".35" transform="translate(4 6)"/>
      <circle class="world-sign-ring" r="56" fill="url(#w-brass)" stroke="#5a4421" stroke-width="1.5"/>
      <circle r="47" fill="#1f3329" stroke="#efe2a8" stroke-opacity=".5" stroke-width="1"/>
      <g class="world-sign-emblem">${crafts[room.id].emblem}</g>
      <rect x="${-width / 2}" y="62" width="${width}" height="26" rx="7" fill="#1f3329" stroke="url(#w-brass)" stroke-width="1.2"/>
      <text y="80" text-anchor="middle">${room.name}</text>
    </a>`;
  };

  // Each destination stands in its own surroundings, drawn in its theme and
  // kept inside the leaf wreath. These static groups are baked into the
  // movement cache together with the floor and joinery.
  const ring = (r, from, to, steps = 24) => Array.from({ length: steps }, (_, i) => {
    const t = from + (to - from) * i / (steps - 1);
    return [f(Math.cos(rad(t)) * r), f(Math.sin(rad(t)) * r), t];
  });
  const polygon = (r, sides, turn = 0) => Array.from({ length: sides }, (_, i) => `${f(Math.cos(rad(turn + i * 360 / sides)) * r)} ${f(Math.sin(rad(turn + i * 360 / sides)) * r)}`).join('L');
  const roomSetting = room => {
    let art = '';
    if (room.id === 'garden') {
      // A round parterre: iron railings, a clipped box hedge, gravel walks
      // and four beds of roses, with an arbour at the far end.
      const beds = [45, 135, 225, 315].flatMap(a => [-24, 0, 24].map((d, i) => [a + d, i % 2 ? 300 : 345]));
      art = `<circle r="436" fill="#95a97c"/><circle r="436" fill="url(#w-turf)" stroke="#4a5a48" stroke-width="3"/>
        <circle r="446" fill="none" stroke="#4a5a48" stroke-width="12" stroke-dasharray="2.5 26"/><circle r="454" fill="none" stroke="#4a5a48" stroke-width="2"/>
        <circle r="408" fill="none" stroke="#4f6b4b" stroke-width="38"/><circle r="408" fill="none" stroke="url(#w-boxwood)" stroke-width="38"/>
        <path d="${[45, 135, 225, 315].map(a => `M${f(Math.cos(rad(a)) * 215)} ${f(Math.sin(rad(a)) * 215)}L${f(Math.cos(rad(a)) * 395)} ${f(Math.sin(rad(a)) * 395)}`).join('')}" stroke="#d9cfa8" stroke-width="54" stroke-linecap="round"/>
        <path d="${[45, 135, 225, 315].map(a => `M${f(Math.cos(rad(a)) * 215)} ${f(Math.sin(rad(a)) * 215)}L${f(Math.cos(rad(a)) * 395)} ${f(Math.sin(rad(a)) * 395)}`).join('')}" stroke="url(#w-gravel)" stroke-width="54" stroke-linecap="round"/>
        <circle r="262" fill="none" stroke="#d9cfa8" stroke-width="26"/><circle r="262" fill="none" stroke="url(#w-gravel)" stroke-width="26"/>
        ${[0, 90, 180, 270].flatMap(a => [[a - 12, 320], [a + 12, 320], [a, 355]]).map(([a, r]) => `<use href="#w-leaf" transform="translate(${f(Math.cos(rad(a)) * r)} ${f(Math.sin(rad(a)) * r)}) rotate(${f(a + 90 + (a % 90 ? (a % 90 > 45 ? 40 : -40) : 0))}) scale(.9)"/>`).join('')}
        ${beds.map(([a, r]) => `<use href="#c-rose" transform="translate(${f(Math.cos(rad(a)) * r)} ${f(Math.sin(rad(a)) * r)}) scale(.8)"/>`).join('')}
        <g transform="translate(0 -400)"><path d="M-70 40V-10Q0-80 70-10V40" fill="none" stroke="#5a4a2a" stroke-width="7"/><path d="M-56 40V-4Q0-62 56-4V40M-70 8h14M56 8h14M-62-20l10 6M62-20l-10 6" fill="none" stroke="#8d825e" stroke-width="2.5"/><use href="#c-rose" transform="translate(-52 -22) scale(.55)"/><use href="#c-rose" transform="translate(0 -56) scale(.6)"/><use href="#c-rose" transform="translate(52 -22) scale(.55)"/></g>
        <g transform="translate(0 390)"><path d="M-60 0h120M-50 0v22M50 0v22M-60-6q60-14 120 0" fill="none" stroke="#5a4a2a" stroke-width="5" stroke-linecap="round"/></g>`;
    } else if (room.id === 'salon') {
      // A round tapestry carpet with a knotted fringe, bordered with Ur
      // rosettes, counters and dice ready for a game.
      art = `<circle r="440" fill="none" stroke="#c9b58a" stroke-width="20" stroke-dasharray="3 10"/>
        <circle r="428" fill="#6e565b" stroke="#4e3d41" stroke-width="4"/><circle r="428" fill="url(#w-tapestry)"/>
        <circle r="402" fill="none" stroke="#d3bd91" stroke-width="4"/><circle r="390" fill="none" stroke="#b58d83" stroke-width="1.5"/>
        <circle r="284" fill="#5e4a4e" stroke="#d3bd91" stroke-width="3"/><circle r="300" fill="none" stroke="#d3bd91" stroke-width="1.5" stroke-dasharray="2 12"/>
        ${[0, 90, 180, 270].map(a => `<use href="#c-ur-tile" transform="rotate(${a}) translate(0 -345) scale(1.5)"/>`).join('')}
        ${[45, 135, 225, 315].map(a => `<use href="#w-sprig" transform="rotate(${a}) translate(0 -300) scale(1.25)"/>`).join('')}
        ${[30, 60, 120, 150, 210, 240, 300, 330].map((a, i) => `<use href="#${i % 2 ? 'c-ur-piece-red' : 'c-ur-piece'}" transform="rotate(${a}) translate(0 -345) scale(1.5)"/>`).join('')}
        <use href="#c-ur-die" transform="translate(-330 60) rotate(-20) scale(1.9)"/><use href="#c-ur-die" transform="translate(320 -80) rotate(25) scale(1.9)"/>`;
    } else if (room.id === 'studio') {
      // A round drawing table: carved walnut rim, a sheet under the work, a
      // fan of pencils, the inkpot, a compass and a palette of washes.
      const scrolls = Array.from({ length: 18 }, (_, i) => `<use href="#w-scroll" transform="rotate(${i * 20}) translate(0 -418)"/>`).join('');
      const ticks = Array.from({ length: 29 }, (_, i) => { const a = 118 + i * 2.8; const r1 = 348, r2 = i % 4 ? 358 : 366; return `M${f(Math.cos(rad(a)) * r1)} ${f(Math.sin(rad(a)) * r1)}L${f(Math.cos(rad(a)) * r2)} ${f(Math.sin(rad(a)) * r2)}`; }).join('');
      art = `<circle r="440" fill="url(#w-wood)" stroke="#3f2a1d" stroke-width="4"/><circle r="440" fill="url(#w-grain)"/>
        <circle r="418" fill="none" stroke="#bea56e" stroke-width="2"/><circle r="396" fill="none" stroke="#bea56e" stroke-width="1"/>${scrolls}
        <path d="M-300-250L240-290L290 190L-250 230Z" fill="url(#c-paper)" stroke="#b5aa87" stroke-width="2"/>
        <path d="M-300-250L240-290L290 190L-250 230Z" fill="url(#w-grid)"/>
        <path d="M-258-182Q-210-232-166-186M-250-154Q-210-200-172-156M214 140Q258 112 284 146" fill="none" stroke="#79836a" stroke-width="2"/>
        <ellipse cx="-300" cy="140" rx="70" ry="52" fill="#e9dfc4" stroke="#8c7349" stroke-width="2" transform="rotate(-20 -300 140)"/><circle cx="-330" cy="118" r="12" fill="#c48f93"/><circle cx="-296" cy="104" r="12" fill="#8f9c7a"/><circle cx="-266" cy="122" r="12" fill="#d9b55a"/><circle cx="-312" cy="162" r="12" fill="#3b5a8c"/><circle cx="-262" cy="158" r="11" fill="#1f3329"/>
        <use href="#c-pencil" transform="translate(300 -200) rotate(50) scale(2.2)"/><use href="#c-pencil" transform="translate(330 -150) rotate(70) scale(2.2)"/><use href="#c-pencil" transform="translate(340 -90) rotate(90) scale(2.2)"/>
        <use href="#c-ink" transform="translate(-320 -230) scale(2.4)"/>
        <path d="M300 300l-40-150M300 300l40-150" stroke="#8c7349" stroke-width="5" stroke-linecap="round"/><circle cx="300" cy="300" r="12" fill="url(#w-brass)" stroke="#5a4421" stroke-width="1.5"/><circle cx="300" cy="300" r="4" fill="#5a4421"/>
        <path d="M${f(Math.cos(rad(118)) * 350)} ${f(Math.sin(rad(118)) * 350)}A350 350 0 0 1 ${f(Math.cos(rad(196.4)) * 350)} ${f(Math.sin(rad(196.4)) * 350)}" fill="none" stroke="#c2ab74" stroke-width="30"/><path d="${ticks}" stroke="#68593a" stroke-width="1.5"/>
        <path d="M110 300c-15-12-10-34 8-37c22-3 30 21 17 34c-8 9-15 9-25 3Z" fill="#ae7d7f" opacity=".8"/><path d="M160 330c-17-9-12-29 3-32c19-4 29 16 19 29c-7 8-14 9-22 3Z" fill="#788c6b" opacity=".8"/>`;
    } else if (room.id === 'music') {
      // A night dial: pixel stars and a planet, staves in rings, and a
      // keyboard curving round the near side.
      const keys = ring(395, 124, 56, 17);
      const whites = `M${f(Math.cos(rad(124)) * 395)} ${f(Math.sin(rad(124)) * 395)}A395 395 0 0 0 ${f(Math.cos(rad(56)) * 395)} ${f(Math.sin(rad(56)) * 395)}`;
      const seams = keys.map(([x, y, a]) => `M${f(Math.cos(rad(a)) * 358)} ${f(Math.sin(rad(a)) * 358)}L${f(Math.cos(rad(a)) * 432)} ${f(Math.sin(rad(a)) * 432)}`).join('');
      const blacks = keys.slice(0, -1).filter((_, i) => i % 7 !== 2 && i % 7 !== 6).map(([, , a]) => { const b = a - 1.1, c = a - 3.15; return `M${f(Math.cos(rad(b)) * 385)} ${f(Math.sin(rad(b)) * 385)}L${f(Math.cos(rad(b)) * 432)} ${f(Math.sin(rad(b)) * 432)}L${f(Math.cos(rad(c)) * 432)} ${f(Math.sin(rad(c)) * 432)}L${f(Math.cos(rad(c)) * 385)} ${f(Math.sin(rad(c)) * 385)}Z`; }).join('');
      art = `<circle r="440" fill="url(#c-space)" stroke="#c9ab6a" stroke-width="4"/><circle r="424" fill="none" stroke="#bcb48c" stroke-width="1.5"/>
        ${[[-150, -300], [60, -380], [220, -320], [-330, -160], [330, -120], [-380, 60], [390, 150], [-250, 300], [160, 280]].map(([x, y], i) => `<use href="#c-pixel-star" transform="translate(${x} ${y}) scale(${(1.2 + (i % 3) * .5).toFixed(1)})"/>`).join('')}
        ${[300, 316, 332, 348, 364].map(r => `<circle r="${r}" fill="none" stroke="#d2c69e" stroke-width="2" opacity=".55"/>`).join('')}
        ${[-120, -60, 20, 150, 210].map(a => `<use href="#c-note" transform="rotate(${a}) translate(0 -332) rotate(${-a + 8}) scale(1.6)"/>`).join('')}
        <use href="#c-planet" transform="translate(-230 -210) scale(2.2)"/>
        <path d="${whites}" fill="none" stroke="#e4dcc4" stroke-width="74"/><path d="${seams}" stroke="#8c927a" stroke-width="2"/><path d="${blacks}" fill="#354b40"/>
        <path d="${whites}" fill="none" stroke="#c9ab6a" stroke-width="3"/>
        <path d="M-290 250h14v14h-14ZM280 262h12v12h-12ZM-150 395h10v10h-10ZM120 400h10v10h-10Z" fill="#e9c75a"/>`;
    } else if (room.id === 'glyphs') {
      // A round cloth with a blank sheet pinned on it, a quill, a candle, a
      // sand timer and a crossed-out blot: the tools of the duel, never a glyph.
      art = `<circle r="440" fill="#2f3f33" stroke="#1b2a22" stroke-width="4"/><circle r="440" fill="none" stroke="#c9ab6a" stroke-width="2" stroke-dasharray="4 14"/>
        <circle r="372" fill="url(#w-paper)" stroke="#b5aa87" stroke-width="3"/><circle r="372" fill="url(#w-grid)"/>
        <circle r="340" fill="none" stroke="#8c7349" stroke-width="1.5" opacity=".6"/><circle r="326" fill="none" stroke="#8c7349" stroke-width=".8" opacity=".5"/>
        <g transform="rotate(-6)"><path d="M-150-190H130L170-150V150H-150Z" fill="#f3ecd6" stroke="#b5a37a" stroke-width="3" stroke-linejoin="round"/><path d="M130-190V-150H170" fill="#e2d6b4" stroke="#b5a37a" stroke-width="3" stroke-linejoin="round"/></g>
        <path d="M-70 40C-10-30 50-80 120-120C70-60 20 0-50 50Z" fill="url(#w-brass)" stroke="#5a4426" stroke-width="2"/><path d="M-70 40L-110 86" stroke="#5a4426" stroke-width="5" stroke-linecap="round"/>
        <path d="M-90-60C-70-70-50-50-70-40C-90-30-110-50-90-60Z" fill="#2f3a33"/><path d="M-100-52L-62-72M-66-44L-104-66" stroke="#a9696d" stroke-width="5" stroke-linecap="round"/>
        <g transform="translate(250 -40)"><rect x="-18" y="0" width="36" height="110" rx="6" fill="#efe2a8" stroke="#8c7349" stroke-width="3"/><path d="M-18 0C-18-40 18-40 18 0" fill="#f6edc6" stroke="#8c7349" stroke-width="3"/><path d="M0-40V-110" stroke="#8c7349" stroke-width="6" stroke-linecap="round"/><path d="M0-128C-14-116 12-104-2-92" fill="none" stroke="#b5b7a5" stroke-width="3" stroke-linecap="round" opacity=".8"/></g>
        <g transform="translate(-240 -40)"><path d="M-30-60H30M-30 60H30" stroke="#8c7349" stroke-width="7" stroke-linecap="round"/><path d="M-24-56C-24-20 24-20 24 0C24 20-24 20-24 56H24C24 20-24 20-24 0C-24-20 24-20 24-56Z" fill="#f6edc6" stroke="#8c7349" stroke-width="3"/><path d="M-12-46C-12-30 12-30 12-46Z M-8 50C-8 36 8 36 8 50Z" fill="#c9ab6a"/></g>
        <use href="#c-ink" transform="translate(-300 250) scale(2.4)"/><use href="#c-ink" transform="translate(316 232) rotate(8) scale(2)"/>
        <path d="M-280 300C-250 320-200 318-170 300M250 300c20 16 60 14 80-4" fill="none" stroke="#a9696d" stroke-width="3" stroke-linecap="round"/>
        ${[[-330, -180, 40], [330, -200, -35], [-150, -330, -20], [180, 350, 160], [-340, 60, 100]].map(([x, y, a]) => `<use href="#w-leaf" transform="translate(${x} ${y}) rotate(${a}) scale(.9)"/>`).join('')}
        <use href="#w-bud" transform="translate(300 -150) rotate(-60) scale(.9)"/><use href="#w-bud" transform="translate(-320 20) rotate(70) scale(.9)"/>`;
    } else if (room.id === 'laboratory') {
      // A hexagonal tiled bench: glazed Secession tiles, copper pipework, a
      // shelf of glass, and a molecule drawn over the wall.
      const hex = polygon(440, 6, 30), inner = polygon(404, 6, 30);
      art = `<path d="M${hex}Z" fill="#9db7a8" stroke="#4f6b60" stroke-width="5" stroke-linejoin="round"/><path d="M${hex}Z" fill="url(#w-tiles)"/>
        <path d="M${inner}Z" fill="none" stroke="#dce0bf" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M-330-100V-250Q-330-290-290-290H-120M330-100V-250Q330-290 290-290H120M-120-290v-50M120-290v-50M-330-100v40M330-100v40" fill="none" stroke="#b9743f" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M-334-104V-250Q-334-294-290-294H-120M326-104V-250Q326-294 290-294H120" fill="none" stroke="#f0c9a0" stroke-width="2" stroke-linecap="round"/>
        ${[[-330, -100], [330, -100], [-120, -290], [120, -290]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="13" fill="#8a4f2c" stroke="#f0c9a0" stroke-width="1.5"/>`).join('')}
        <rect x="-360" y="250" width="720" height="60" rx="8" fill="url(#w-wood)" stroke="#a59361" stroke-width="3"/><rect x="-360" y="250" width="720" height="60" rx="8" fill="url(#w-grain)"/>
        <use href="#c-flask" transform="translate(-300 220) scale(2.2)"/><use href="#c-flask" transform="translate(300 214) rotate(-6) scale(2.4)"/>
        <path d="M-250 250V150h100v100M-250 170h100M-250 205h100" fill="none" stroke="#5a4a2a" stroke-width="5" stroke-linejoin="round"/>
        <path d="M-236 120v120a11 11 0 0 0 22 0V120ZM-186 120v120a11 11 0 0 0 22 0V120Z" fill="#dfe8df" fill-opacity=".5" stroke="#dff2ee" stroke-width="2"/>
        <path d="M-234 190v50a9 9 0 0 0 18 0v-50ZM-184 210v30a9 9 0 0 0 18 0v-30Z" fill="#a9696d" opacity=".85"/><path d="M-184 210v30a9 9 0 0 0 18 0v-30Z" fill="#5f9a5a" opacity=".9"/>
        ${[[-250, -40], [-190, -140], [-100, -60], [240, -120], [180, -40], [300, 60]].map(([x, y]) => `<use href="#c-hex" transform="translate(${x} ${y}) scale(1.9)"/>`).join('')}
        <path d="M-250-40L-190-140L-100-60L-250-40M240-120L180-40L300 60" fill="none" stroke="#9fe0d4" stroke-width="2.5" opacity=".7"/>
        ${[[-60, -330], [-20, -360], [20, -330], [50, -370], [-10, -300]].map(([x, y], i) => `<use href="#c-bubble" transform="translate(${x} ${y}) scale(${(1.2 + (i % 3) * .6).toFixed(1)})"/>`).join('')}`;
    }
    return `<g class="world-room-setting" data-setting="${room.id}" transform="translate(${f(room.at[0])} ${f(room.at[1])})" aria-hidden="true" pointer-events="none">${art}</g>`;
  };

  const floorMosaic = (() => {
    const motifs = [[], []];
    for (let i = 0; i < 36; i++) {
      const angle = i * Math.PI / 18;
      const at = (r, turn = 0) => `${f(C + Math.cos(angle + turn) * r)} ${f(C + Math.sin(angle + turn) * r)}`;
      motifs[i % 2].push(`M${at(345)}Q${at(362, -.024)} ${at(380)}Q${at(362, .024)} ${at(345)}Z`);
    }
    return `<g aria-hidden="true" pointer-events="none"><circle cx="${C}" cy="${C}" r="390" fill="#e4dcc1" stroke="#7b8b68" stroke-width="6"/><circle cx="${C}" cy="${C}" r="362" fill="none" stroke="#7c8f71" stroke-width="42"/><path d="${motifs[0].join('')}" fill="#c2ad90" stroke="#d5c998" stroke-width="1"/><path d="${motifs[1].join('')}" fill="#d9d2ab" stroke="#b4b48a" stroke-width="1"/><circle cx="${C}" cy="${C}" r="333" fill="none" stroke="#a99a6b" stroke-width="3"/></g>`;
  })();

  const cartouche = `<g class="world-cartouche" transform="translate(3120 3500) scale(.78)" aria-hidden="true" pointer-events="none">
    <path d="M-510-120H510Q520-70 565-60V60Q520 70 510 120H-510Q-520 70-565 60V-60Q-520-70-510-120Z" fill="#334e3f" stroke="url(#w-brass)" stroke-width="4"/>
    <path d="M-492-101H492Q506-58 546-46V46Q506 58 492 101H-492Q-506 58-546 46V-46Q-506-58-492-101Z" fill="none" stroke="#bbac78" stroke-width="1.5"/>
    <use href="#w-sprig" transform="translate(0 -112) scale(1.1)"/>
    <path d="M-470 2H-350M350 2H470" fill="none" stroke="#c4ad79" stroke-width="1.8"/>
    <use href="#w-bud" transform="translate(-336 18) rotate(-90) scale(.8)"/><use href="#w-bud" transform="translate(336 18) rotate(90) scale(.8)"/>
    <text class="world-cartouche-title" y="22" text-anchor="middle">Maison Mottet</text>
    <text class="world-cartouche-sub" y="74" text-anchor="middle">Six rooms about one hall · the house laid flat as a board</text>
  </g>`;

  const hall = `<g class="world-hall">
    <circle cx="${C}" cy="${C}" r="${hallR}" fill="url(#w-wood)" stroke="#c9ab6a" stroke-width="3"/>
    <circle cx="${C}" cy="${C}" r="${hallR}" fill="url(#w-grain)"/>
    <circle cx="${C}" cy="${C}" r="${hallR + 18}" fill="none" stroke="#8d825e" stroke-width="1.5"/>
    <circle cx="${C}" cy="${C}" r="${hallR - 30}" fill="#e9e2c8" stroke="#c9ab6a" stroke-width="3"/>
    ${rosette(C, C, 210, 12)}
    <circle cx="${C}" cy="${C}" r="96" fill="#2e4c3d" stroke="#c9ab6a" stroke-width="3"/>
    <g transform="translate(${C} ${C - 44}) scale(3.4)" color="#efe2a8"><use href="#w-mark"/></g>
    <text class="world-hall-name" x="${C}" y="${C + 58}" text-anchor="middle">Hall</text>
  </g>`;

  // Whiplash sprays grow from the hall ring into the six gaps between the
  // stems, scaled to each gap; alternate ones are mirrored.
  const sprays = rooms.map((room, i) => {
    // Rooms are listed clockwise from the garden except the two upper ones.
    const order = ['garden', 'music', 'salon', 'glyphs', 'studio', 'laboratory'];
    const a = rooms.find(r => r.id === order[i]).angle, b = rooms.find(r => r.id === order[(i + 1) % order.length]).angle;
    const gap = ((b - a) % 360 + 360) % 360;
    const scale = (.62 + gap / 170).toFixed(2);
    return `<use href="#w-spray" transform="translate(${C} ${C}) rotate(${f(a + gap / 2)}) translate(436 0) scale(${scale} ${i % 2 ? -scale : scale})"/>`;
  }).join('');
  const wreaths = rooms.map(room => `<use href="#w-wreath" transform="translate(${f(room.at[0])} ${f(room.at[1])}) rotate(${f(room.angle)})"/>`).join('');
  const fauna = [
    ['w-dragonfly', 1120, 1500, 34, 1], ['w-dragonfly', 2960, 2620, -140, .9], ['w-dragonfly', 2250, 760, 112, .85], ['w-dragonfly', 760, 3000, -48, .95],
    ['w-butterfly', 2860, 1250, 20, 1], ['w-butterfly', 1040, 2440, -24, .9], ['w-butterfly', 2600, 3560, 160, .85], ['w-butterfly', 1600, 560, -150, .8],
    ['w-petal', 1500, 1000, 30, 1.6], ['w-petal', 2560, 1120, -60, 1.4], ['w-petal', 2700, 2900, 120, 1.5], ['w-petal', 1300, 2800, 200, 1.3], ['w-petal', 1420, 3540, 80, 1.5], ['w-petal', 3120, 2040, -110, 1.4], ['w-petal', 880, 1960, 150, 1.4], ['w-petal', 2080, 1500, 10, 1.2]
  ].map(([id, x, y, angle, scale]) => `<use href="#${id}" transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})"/>`).join('');
  const inlay = `<g fill="none"><circle cx="${C}" cy="${C}" r="940" stroke="#b39f72" stroke-width="2" opacity=".55"/><circle cx="${C}" cy="${C}" r="954" stroke="#9c8659" stroke-width="5" stroke-dasharray="0 36" stroke-linecap="round" opacity=".7"/><circle cx="${C}" cy="${C}" r="1330" stroke="#a89a6c" stroke-width="1.5" stroke-dasharray="3 18" opacity=".6"/><circle cx="${C}" cy="${C}" r="1700" stroke="#b39f72" stroke-width="1.5" opacity=".35"/></g>`;

  const corners = [[210, 210, -45], [3790, 210, 45], [3790, 3790, 135], [210, 3790, 225]]
    .map(([x, y, angle]) => `<use href="#w-sprig" transform="translate(${x} ${y}) rotate(${angle}) scale(2.5)"/>`).join('');

  host.innerHTML = `<div class="world" id="board-world"><svg viewBox="0 0 ${WORLD} ${WORLD}" width="${WORLD}" height="${WORLD}" role="img" aria-label="A huge board: the hall at the centre with wooden ways and stairs leading out to the six rooms" focusable="false">${defs}<defs>${craftDefs}</defs>
    <rect width="${WORLD}" height="${WORLD}" rx="90" fill="url(#w-wood)"/>
    <rect width="${WORLD}" height="${WORLD}" rx="90" fill="url(#w-grain)"/>
    <rect x="36" y="36" width="${WORLD - 72}" height="${WORLD - 72}" rx="70" fill="none" stroke="url(#w-brass)" stroke-width="5"/>
    <rect x="94" y="94" width="${WORLD - 188}" height="${WORLD - 188}" rx="52" fill="#314d3e" stroke="#c9ab6a" stroke-width="2"/>
    <rect x="134" y="134" width="${WORLD - 268}" height="${WORLD - 268}" rx="26" fill="url(#w-paper)" stroke="#b39f72" stroke-width="3"/>
    <rect x="134" y="134" width="${WORLD - 268}" height="${WORLD - 268}" rx="26" fill="url(#w-field)"/>
    <rect x="134" y="134" width="${WORLD - 268}" height="${WORLD - 268}" rx="26" fill="url(#w-linen)"/>
    <path d="M174 174H3826V3826H174ZM248 248V3752H3752V248Z" fill="url(#w-frieze)" fill-rule="evenodd"/>
    <rect x="248" y="248" width="3504" height="3504" rx="12" fill="none" stroke="#a89a6c" stroke-width="2"/>
    <rect x="167" y="167" width="${WORLD - 334}" height="${WORLD - 334}" rx="16" fill="none" stroke="#8d936f" stroke-width="1.5"/>
    ${inlay}
    ${corners}
    <g class="world-sprays" aria-hidden="true" pointer-events="none">${sprays}</g>
    ${floorMosaic}
    <g class="world-wreaths" aria-hidden="true" pointer-events="none">${wreaths}</g>
    <g class="world-ways">${rooms.map(way).join('')}</g>
    <g class="world-room-settings">${rooms.map(roomSetting).join('')}</g>
    <g class="world-fauna" aria-hidden="true" pointer-events="none">${fauna}</g>
    ${hall}
    ${cartouche}
    <g class="world-signs">${rooms.map(signpost).join('')}</g>
    <g class="world-stations">${rooms.map(station).join('')}</g>
  </svg><div class="world-pawn" id="board-pawn" aria-hidden="true"><svg viewBox="-32 -32 64 64" width="64" height="64" focusable="false"><ellipse cy="8" rx="22" ry="9" fill="#1b2a22" opacity=".35"/><circle r="20" fill="url(#w-brass)" stroke="#5a4421" stroke-width="1.5"/><circle r="12" fill="#2e4c3d" stroke="#efe2a8" stroke-width="1"/><g transform="translate(0 -12)" color="#efe2a8"><use href="#w-mark"/></g></svg></div></div>`;

  // The camera is a translate and scale on the world. One easing drives walks,
  // recentring, and the whole-board view; dragging moves it by hand.
  const world = document.getElementById('board-world');
  const svg = world.querySelector('svg');
  const pawn = document.getElementById('board-pawn');
  const status = document.getElementById('board-status');
  const overviewButton = document.getElementById('board-overview');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const camera = { x: C, y: C, scale: 1 };
  let pawnAt = [C, C + 150], location = 'hall', busy = false, overview = false, frame = 0, flightId = 0;
  const homeScale = () => Math.min(innerWidth, innerHeight) / VIEW;
  // Stations are seen closer than the hall.
  const scaleFor = place => byId(place) ? homeScale() * 1.4 : homeScale();
  const wholeScale = () => Math.min(innerWidth, innerHeight) / (WORLD + 120);
  // Cache the artwork once for flights and dragging. Inline SVG can repaint
  // on every scale change even when its parent is a compositor animation.
  // The original vector links and crisp lettering return as soon as we stop.
  const cacheArtwork = async () => {
    if (reduceMotion.matches) return;
    try {
      await document.fonts.ready;
      const inline = async url => {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Artwork resource unavailable');
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      };
      const snapshot = svg.cloneNode(true);
      snapshot.querySelectorAll('.is-here').forEach(node => node.classList.remove('is-here'));
      const [font] = await Promise.all([
        inline('/assets/fonts/federo-regular.woff2'),
        ...Array.from(snapshot.querySelectorAll('image'), async node => {
          node.setAttribute('href', await inline(node.getAttribute('href')));
        })
      ]);
      const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
      const sheet = Array.from(document.styleSheets).find(sheet => sheet.href?.endsWith('/board.css'));
      style.textContent = `@font-face { font-family: Federo; src: url("${font}") format("woff2"); }
`
        + Array.from(sheet.cssRules, rule => rule.cssText).join('\n');
      snapshot.prepend(style);
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(snapshot)], { type: 'image/svg+xml' }));
      try {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.className = 'world-cache';
        canvas.setAttribute('aria-hidden', 'true');
        // Match the journey's display resolution; cap the allocation at 64 MB.
        canvas.width = canvas.height = Math.ceil(WORLD * Math.min(1, homeScale() * 1.4 * devicePixelRatio));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        world.insertBefore(canvas, pawn);
        host.classList.add('has-cache');
      } finally { URL.revokeObjectURL(url); }
    } catch { /* Vector artwork remains available if caching is unavailable. */ }
  };
  const constrainCamera = view => {
    const w = innerWidth / view.scale, h = innerHeight / view.scale;
    return { ...view,
      x: w >= WORLD ? C : Math.min(Math.max(view.x, w / 2), WORLD - w / 2),
      y: h >= WORLD ? C : Math.min(Math.max(view.y, h / 2), WORLD - h / 2)
    };
  };
  const cameraTransform = view => `translate3d(${innerWidth / 2 - view.x * view.scale}px, ${innerHeight / 2 - view.y * view.scale}px, 0) scale(${view.scale})`;
  const pawnTransform = ([x, y]) => `translate3d(${x}px, ${y}px, 0)`;
  const reportCamera = () => {
    const w = innerWidth / camera.scale, h = innerHeight / camera.scale;
    host.dataset.view = `${f(camera.x - w / 2)} ${f(camera.y - h / 2)} ${f(w)} ${f(h)}`;
  };
  const applyCamera = () => {
    Object.assign(camera, constrainCamera(camera));
    world.style.transform = cameraTransform(camera);
    reportCamera();
  };
  const placePawn = ([x, y]) => { pawnAt = [x, y]; pawn.style.transform = pawnTransform(pawnAt); };
  // Zero velocity and acceleration at both ends, including zoom transitions.
  const ease = t => t * t * t * (t * (t * 6 - 15) + 10);
  const mix = (a, b, t) => a + (b - a) * t;
  const blend = t => ease(Math.min(Math.max(t, 0), 1));
  const mixScale = (a, b, t) => a * Math.pow(b / a, t);
  // Precompute a continuous flight, then let the compositor interpolate it.
  // Updating a parent scale from JS would repaint the SVG at every frame.
  const animate = async (duration, sample) => {
    await artworkReady;
    const id = ++frame;
    flightId = id;
    host.classList.add('is-moving');
    // Paint the cached layer before starting the clock for a flight.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (id !== frame) {
      if (flightId === id) host.classList.remove('is-moving');
      return false;
    }
    return new Promise(resolve => {
      const samples = Array.from({ length: 121 }, (_, i) => {
        const next = sample(ease(i / 120));
        return { ...next, view: constrainCamera(next.view) };
      });
      const options = { duration, fill: 'both', easing: 'linear' };
      const flight = world.animate(samples.map(next => ({ transform: cameraTransform(next.view) })), options);
      const token = samples[0].pawn
        ? pawn.animate(samples.map(next => ({ transform: pawnTransform(next.pawn) })), options) : null;
      const start = document.timeline.currentTime;
      flight.startTime = start;
      if (token) token.startTime = start;
      const tick = () => {
        if (id !== frame || flight.playState === 'idle') {
          // Preserve the last reported view before handing control to dragging.
          applyCamera(); placePawn(pawnAt);
          flight.cancel(); token?.cancel();
          if (flightId === id) host.classList.remove('is-moving');
          return resolve(false);
        }
        // Browsers may round currentTime below a fractional duration even
        // after finishing. Trust the playback state so input always unlocks.
        const t = flight.playState === 'finished' ? 1
          : Math.min(Math.max((flight.currentTime || 0) / duration, 0), 1);
        const next = sample(ease(t));
        Object.assign(camera, constrainCamera(next.view));
        if (next.pawn) pawnAt = next.pawn;
        reportCamera();
        if (t < 1) requestAnimationFrame(tick);
        else {
          applyCamera(); placePawn(pawnAt);
          flight.cancel(); token?.cancel();
          host.classList.remove('is-moving');
          resolve(true);
        }
      };
      requestAnimationFrame(tick);
    });
  };
  const glide = (to, duration = 700) => {
    const from = { ...camera };
    if (reduceMotion.matches) { Object.assign(camera, to); applyCamera(); return Promise.resolve(true); }
    return animate(duration, e => ({ view: {
      x: mix(from.x, to.x, e), y: mix(from.y, to.y, e), scale: mixScale(from.scale, to.scale, e)
    } }));
  };
  const walk = (room, reverse) => {
    const from = { ...camera }, startPawn = [...pawnAt];
    const endCamera = reverse ? [C, C] : room.at;
    const cameraCurve = reverse
      ? [[from.x, from.y], room.curve[2], room.curve[1], endCamera]
      : [[from.x, from.y], room.curve[1], room.curve[2], endCamera];
    const endPawn = reverse ? [C, C + 150] : pointAt(room, 1).at;
    const targetScale = reverse ? homeScale() : homeScale() * 1.4;
    if (reduceMotion.matches) {
      placePawn(endPawn);
      Object.assign(camera, { x: endCamera[0], y: endCamera[1], scale: targetScale });
      applyCamera();
      return Promise.resolve(true);
    }
    return animate(2400 + room.length * .4, e => {
      const { at } = pointAt(room, reverse ? 1 - e : e);
      // Join the hall to the path, and let the camera ease into following it.
      // The departure begins at the current view, including a dragged/overview view.
      const departure = blend(e / .2), arrival = blend((e - .8) / .2);
      const position = at.map((v, axis) => mix(mix(startPawn[axis], v, departure), endPawn[axis], arrival));
      const view = bezier(cameraCurve, e);
      return { pawn: position, view: { x: view[0], y: view[1], scale: mixScale(from.scale, targetScale, e) } };
    });
  };
  const byId = id => rooms.find(room => room.id === id);
  const say = text => { if (status) status.textContent = text; };
  const standAt = place => {
    const room = byId(place);
    placePawn(room ? pointAt(room, 1).at : [C, C + 150]);
    location = place;
    return room ? [room.at[0], room.at[1]] : [C, C];
  };
  async function travel(place) {
    if (place === location || busy) return;
    busy = true; overview = false; overviewButton?.setAttribute('aria-pressed', 'false');
    const destination = byId(place);
    say(destination ? `Setting off for the ${destination.name}.` : 'Heading back to the hall.');
    let ok = true;
    if (byId(location)) ok = await walk(byId(location), true);
    if (ok && destination) ok = await walk(destination, false);
    if (!ok) { busy = false; return; }
    standAt(place);
    say(destination ? `You are at the ${destination.name}. The brass plate enters it.` : 'You are in the hall. Choose a way.');
    document.querySelectorAll('.world-station').forEach(node => node.classList.toggle('is-here', node.dataset.station === place));
    busy = false;
  }
  const placeFromHash = () => { const id = window.location.hash.replace('#', ''); return byId(id) ? id : 'hall'; };

  // Start where the URL says, without a journey.
  const first = placeFromHash();
  const rest = standAt(first);
  Object.assign(camera, { x: rest[0], y: rest[1], scale: scaleFor(first) });
  applyCamera();
  document.querySelectorAll('.world-station').forEach(node => node.classList.toggle('is-here', node.dataset.station === first));
  const artworkReady = cacheArtwork();
  window.addEventListener('hashchange', () => travel(placeFromHash()));
  window.addEventListener('resize', () => { if (!busy) camera.scale = overview ? wholeScale() : scaleFor(location); applyCamera(); });
  // The hall button in the header walks back, or simply recentres when already home.
  document.getElementById('board-hall')?.addEventListener('click', event => {
    if (location !== 'hall' || busy) return;
    event.preventDefault();
    overview = false; overviewButton?.setAttribute('aria-pressed', 'false');
    glide({ x: C, y: C, scale: homeScale() }, 700);
  });
  window.addEventListener('pageshow', event => { if (event.persisted) { busy = false; frame++; } });

  overviewButton?.addEventListener('click', () => {
    if (busy) return;
    overview = !overview;
    overviewButton.setAttribute('aria-pressed', String(overview));
    const rest = byId(location) ? byId(location).at : [C, C];
    const target = overview ? { x: C, y: C, scale: wholeScale() } : { x: rest[0], y: rest[1], scale: scaleFor(location) };
    say(overview ? 'The whole board. Choose a station or a way.' : '');
    glide(target, 900);
  });

  // Entering a room remembers the board as the place to come back to.
  host.querySelectorAll('.world-enter').forEach(link => link.addEventListener('click', () => {
    try { sessionStorage.setItem('mottet-apartment-return', JSON.stringify({ room: link.getAttribute('href'), hall: '/board.html#' + link.dataset.room })); } catch { /* The room then returns to the house. */ }
  }));

  // Dragging pans the board; a short press is a click on whatever it touched.
  let drag = null, panFrame = 0;
  const paintPan = () => { panFrame = 0; applyCamera(); };
  host.addEventListener('pointerdown', event => {
    if (event.button !== 0 || busy) return;
    drag = { x: event.clientX, y: event.clientY, cx: camera.x, cy: camera.y, moved: false, id: event.pointerId };
  });
  host.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    if (!drag.moved) { drag.moved = true; host.setPointerCapture(drag.id); host.classList.add('is-dragging'); frame++; }
    camera.x = drag.cx - dx / camera.scale; camera.y = drag.cy - dy / camera.scale;
    if (!panFrame) panFrame = requestAnimationFrame(paintPan);
  });
  const endDrag = event => {
    if (!drag || event.pointerId !== drag.id) return;
    if (drag.moved) { if (panFrame) { cancelAnimationFrame(panFrame); paintPan(); } host.classList.remove('is-dragging'); host.addEventListener('click', e => e.preventDefault(), { once: true, capture: true }); }
    drag = null;
  };
  host.addEventListener('pointerup', endDrag);
  host.addEventListener('pointercancel', endDrag);
})();
