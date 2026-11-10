'use strict';

// The drawings of Maïa's site: the forest side of the house. Boughs, leaves
// and two birds across the top, a sprig between sections, a nest for empty
// lists, and the small marks the tools use. All vector, all inked in the
// page's own colours through CSS variables, so day and night paint them.
window.MaiaArt = (function () {
  const leaf = (x, y, r, s = 1) => `<path transform="translate(${x} ${y}) rotate(${r}) scale(${s})" class="leaf" d="M0 0C6-10 18-14 30-8C22 2 10 6 0 0ZM2-1C10-4 18-7 26-8" />`;
  const leaves = list => list.map(a => leaf(...a)).join('');

  // A wren: small, round, tail cocked up, perched and alert.
  const wren = (x, y, s = 1, flip = false) => `<g class="bird wren" transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})">
    <path class="bird-body" d="M-16 2C-18-8-8-16 2-15C10-14 16-8 15 0C14 8 6 12-2 12C-10 12-15 8-16 2Z"/>
    <path class="bird-tail" d="M-14-2C-22-10-24-18-20-24C-16-18-12-10-11-4Z"/>
    <path class="bird-wing" d="M-8 0C-4-8 6-9 11-5C7 1 0 4-8 0Z"/>
    <path class="bird-head" d="M2-15C8-16 14-12 15-6L17-8L20-7L15-3C14 2 8 2 4-2C2-6 0-11 2-15Z"/>
    <circle class="bird-eye" cx="10" cy="-9" r="1.6"/>
    <path class="bird-line" d="M-4 12L-6 19M-4 12L-1 19M-6 19L-9 20M-6 19L-4 21M-1 19L2 20M-1 19L0 22"/>
    <path class="bird-line" d="M-10-2C-5-5 0-5 5-3M-9 3C-4 1 2 1 7 3" opacity=".55"/>
  </g>`;
  // A blue tit: round, a cap and an eye stripe, hanging towards the viewer.
  const tit = (x, y, s = 1, flip = false) => `<g class="bird tit" transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})">
    <path class="bird-belly" d="M-14 0C-14-10-6-16 2-16C12-16 17-8 16 2C15 10 8 14 0 14C-8 14-14 8-14 0Z"/>
    <path class="bird-wing" d="M-13-2C-8-10 2-12 10-8C6-2-2 2-13-2Z"/>
    <path class="bird-cap" d="M-2-16C4-20 12-18 15-12C10-11 4-10 0-11C-3-12-4-14-2-16Z"/>
    <path class="bird-stripe" d="M-1-12C4-12 10-11 14-9C10-7 4-6-1-8Z"/>
    <circle class="bird-eye" cx="8" cy="-10" r="1.6"/>
    <path class="bird-beak" d="M15-11L21-9L15-7Z"/>
    <path class="bird-tail" d="M-14 2C-20 6-24 12-22 18C-18 14-14 10-11 6Z"/>
    <path class="bird-line" d="M0 14L-2 20M3 14L4 20M-2 20L-5 21M-2 20L0 22M4 20L7 21M4 20L4 23"/>
  </g>`;

  // The band across the top: a bough from each side, leaves, the two birds,
  // and the moon or the sun, which the stylesheet shows by theme.
  function header() {
    return `<svg class="art-header" viewBox="0 0 800 170" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="art-sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="var(--sun-core)"/><stop offset=".6" stop-color="var(--sun)"/><stop offset="1" stop-color="var(--sun)" stop-opacity="0"/></radialGradient>
      </defs>
      <g class="sky">
        <circle class="sun" cx="400" cy="74" r="46" fill="url(#art-sun)"/>
        <g class="moon"><path d="M418 50A28 28 0 1 0 428 100A22 22 0 1 1 418 50Z"/><circle cx="372" cy="38" r="1.4"/><circle cx="452" cy="44" r="1.1"/><circle cx="440" cy="110" r="1.2"/><circle cx="352" cy="96" r=".9"/></g>
      </g>
      <g class="bough">
        <path d="M-10 118C60 110 110 120 160 96C200 78 220 60 260 62C290 64 310 86 330 84" stroke-width="5"/>
        <path d="M110 114C130 128 150 134 176 130" stroke-width="2.4"/>
        <path d="M200 78C196 94 206 108 224 112" stroke-width="2.2"/>
        <path d="M260 62C268 48 286 42 306 46" stroke-width="2"/>
        <path d="M40 112C52 100 66 96 84 98" stroke-width="2"/>
        ${leaves([[84, 98, -20], [176, 130, 10, .9], [224, 112, 30, .8], [306, 46, -30, .9], [150, 90, -70, .7], [330, 84, 20, .8], [20, 108, -40, .8], [118, 118, 150, .6]])}
        <path d="M810 124C740 118 690 128 640 104C600 86 580 66 540 68C510 70 490 92 470 90" stroke-width="5"/>
        <path d="M690 122C670 136 650 142 624 138" stroke-width="2.4"/>
        <path d="M600 86C604 102 594 116 576 120" stroke-width="2.2"/>
        <path d="M540 68C532 54 514 48 494 52" stroke-width="2"/>
        <path d="M760 118C748 106 734 102 716 104" stroke-width="2"/>
        ${leaves([[716, 104, 200, 1, true], [624, 138, 170, .9], [576, 120, 150, .8], [494, 52, 210, .9], [650, 96, 250, .7], [470, 90, 160, .8], [780, 114, 220, .8], [682, 126, 30, .6]].map(a => a.length > 4 ? a.slice(0, 4) : a))}
      </g>
      ${wren(150, 78, 1.15)}
      ${tit(650, 84, 1.1, true)}
    </svg>`;
  }
  const sprig = () => `<svg class="art-sprig" viewBox="0 0 120 24" aria-hidden="true" focusable="false"><path d="M0 12C30 10 50 14 60 12C70 10 90 14 120 12" stroke-width="1.4"/>${leaves([[44, 12, -30, .45], [60, 13, 30, .45], [76, 12, 200, .45], [28, 12, 210, .35], [92, 12, -20, .35]])}</svg>`;
  const nest = () => `<svg class="art-nest" viewBox="0 0 120 70" aria-hidden="true" focusable="false"><path d="M14 38C30 30 90 30 106 38C104 56 88 66 60 66C32 66 16 56 14 38Z"/><path d="M18 42C40 48 80 48 102 42M22 50C44 56 76 56 98 50M26 58C44 62 76 62 94 58" opacity=".6"/><ellipse class="egg" cx="60" cy="36" rx="12" ry="9"/><path d="M8 40C4 30 10 22 20 24M112 40C116 30 110 22 100 24" opacity=".7"/></svg>`;

  const ICONS = {
    left: '<path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z"/><circle cx="12" cy="12" r="2.2" class="fill"/><path d="M4 12h5"/>',
    right: '<path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z"/><circle cx="12" cy="12" r="2.2" class="fill"/><path d="M15 12h5"/>',
    both: '<path d="M7.5 6a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM16.5 8a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z"/><circle cx="7.5" cy="11" r="1.4" class="fill"/><circle cx="16.5" cy="13" r="1.4" class="fill"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2" class="fill"/>',
    drop: '<path d="M12 3C9 8 6 11 6 15a6 6 0 0 0 12 0c0-4-3-7-6-12Z"/><path d="M9 15c0 2 1 3 3 3" opacity=".7"/>',
    pill: '<path d="M8.5 4.5h7a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-7a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3Z"/><path d="M5.5 12h13"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>',
    journal: '<path d="M6 4h10a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2V4Z"/><path d="M6 4v14M10 8h5M10 11h5"/>',
    news: '<path d="M4 7h16v11H4Z"/><path d="M4 7l8 6 8-6"/>',
    photo: '<rect x="3" y="6" width="18" height="13" rx="2"/><circle cx="12" cy="12.5" r="3.5"/><path d="M9 6l1.5-2h3L15 6"/>',
    pen: '<path d="M4 20l4-1L19 8a2 2 0 0 0-3-3L5 16l-1 4Z"/><path d="M14 7l3 3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
    moon: '<path d="M14 3a8 8 0 1 0 7 11A9 9 0 0 1 14 3Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    back: '<path d="M14 6l-6 6 6 6"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    today: '<path d="M4 20V10l8-6 8 6v10h-6v-6h-4v6Z"/>',
    care: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z"/>',
    feeds: '<path d="M8 4h8v3a4 4 0 0 1-4 4 4 4 0 0 1-4-4Z"/><path d="M12 11v4M9 20a3 3 0 0 1 6 0"/>',
    leave: '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M14 16l4-4-4-4M18 12H9"/>',
    lang: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16"/>',
    trash: '<path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4Z"/><path d="M10 20a2 2 0 0 0 4 0M12 3v2"/>',
    'bell-off': '<path d="M8 7a6 6 0 0 1 10 4v5l2 2H9M6 11v5l-2 2h3"/><path d="M10 20a2 2 0 0 0 4 0M4 4l16 16"/>',
  };
  const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;

  // The icon for the home screen and the tab: the blue tit on a bough, on moss green.
  const mark = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><radialGradient id="g" cx=".5" cy=".4" r=".75"><stop offset="0" stop-color="#6e8a5e"/><stop offset="1" stop-color="#3f5a39"/></radialGradient></defs><rect width="64" height="64" fill="url(#g)"/><path d="M-2 55C14 51 30 56 44 53C54 51 60 52 66 50" fill="none" stroke="#3b2a17" stroke-width="3.2" stroke-linecap="round"/><path transform="translate(47 52) rotate(-28) scale(.42)" d="M0 0C6-10 18-14 30-8C22 2 10 6 0 0Z" fill="#9fb77a" stroke="#2f4428" stroke-width="2"/><path transform="translate(13 53) rotate(205) scale(.36)" d="M0 0C6-10 18-14 30-8C22 2 10 6 0 0Z" fill="#9fb77a" stroke="#2f4428" stroke-width="2"/><g transform="translate(32 31) scale(1.12)" stroke="#232c3a" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round"><path d="M-14 2C-20 6-24 12-22 18C-18 14-14 10-11 6Z" fill="#5b7fb8"/><path d="M-14 0C-14-10-6-16 2-16C12-16 17-8 16 2C15 10 8 14 0 14C-8 14-14 8-14 0Z" fill="#e9d26a"/><path d="M-13-2C-8-10 2-12 10-8C6-2-2 2-13-2Z" fill="#6f8fbf"/><path d="M-2-16C4-20 12-18 15-12C10-11 4-10 0-11C-3-12-4-14-2-16Z" fill="#5b7fb8"/><path d="M-1-12C4-12 10-11 14-9C10-7 4-6-1-8Z" fill="#f6f1e4"/><circle cx="8" cy="-10" r="1.6" fill="#1d1a14" stroke="none"/><path d="M15-11L21-9L15-7Z" fill="#232c3a"/><path d="M0 14L-2 20M3 14L4 20M-2 20L-5 21M-2 20L0 22M4 20L7 21M4 20L4 23" fill="none"/></g></svg>`;

  return { header, sprig, nest, icon, mark, wren, tit, leaf };
})();
