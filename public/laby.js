'use strict';

const garden = { width: 1200, height: 820, x: 116, y: 118, columns: 44, rows: 26, cell: 22, growthDuration: 2400 };
const gardenColours = { stone: '#d3c9ac', hedge: '#52684b', shadow: '#304b39', brass: '#baa477' };
const reducedGardenMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let cases = [], walls = [], gardenPassages = [], gardenPassage = 0;
let gardenStems = [], gardenRoseEnds = new Set(), gardenBlooms = new Set();
let gardenStemNeighbours = [];
let gardenRoses = new Map(), gardenOpeningBlooms = new Set();
let gardenBloomTime = 0, gardenFlowersDirty = true;
let gardenCanvas, gardenBackdrop, gardenFrame, gardenPlants, gardenFlowers, visitedGardenCells = 0;
let gardenGrowthTime = 0, pendingGardenSteps = 0;
let gardenDirty = true, gardenAnimating = true, gardenResizeTimer;
let gardenDamage = null;

function gardenBuffer() {
  const canvas = document.createElement('canvas'), density = pixelDensity();
  canvas.width = garden.width * density;
  canvas.height = garden.height * density;
  canvas.getContext('2d').scale(density, density);
  return canvas;
}

function fitGarden() {
  const bounds = gardenCanvas.elt.getBoundingClientRect();
  const w = Math.round(bounds.width), h = Math.round(bounds.height);
  if (gardenFrame && garden.width === w && garden.height === h) return;
  garden.width = w;
  garden.height = h;
  garden.ornamentScale = Math.max(.2, Math.min(.8, Math.min(w, h) / 1000));
  garden.cell = Math.max(14, Math.min(24, Math.round(Math.min(w, h) / 22)));
  garden.columns = Math.max(4, Math.floor((w - 232 * garden.ornamentScale) / garden.cell));
  garden.rows = Math.max(4, Math.floor((h - 236 * garden.ornamentScale) / garden.cell));
  garden.x = (w - garden.columns * garden.cell) / 2;
  garden.y = (h - garden.rows * garden.cell) / 2;
  resizeCanvas(w, h, true);
  gardenBackdrop = createGardenBackdrop();
  gardenFrame = gardenBuffer();
  resetGarden();
}

function windowResized() {
  clearTimeout(gardenResizeTimer);
  gardenResizeTimer = setTimeout(fitGarden, 100);
}

function roundedGardenRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function gardenLeaf(ctx, x, y, angle, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(size, size);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-.8, -.4, -.5, -1.3, 0, -1.8);
  ctx.bezierCurveTo(.5, -1.3, .8, -.4, 0, 0);
  ctx.fillStyle = '#82906b';
  ctx.fill();
  ctx.strokeStyle = '#687954';
  ctx.lineWidth = .065;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -.12);
  ctx.lineTo(0, -1.55);
  ctx.strokeStyle = '#bdba8b';
  ctx.lineWidth = .045;
  ctx.stroke();
  ctx.restore();
}

function gardenIris(ctx, x, y, scale, angle = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#9a8358';
  const flower = new Path2D('M0 3C-14-12-10-33 0-42C10-33 14-12 0 3ZM0-5C-8-30-29-28-33-14C-36-2-18-9-16 5C-12 15-3 7 0-5ZM0-5C8-30 29-28 33-14C36-2 18-9 16 5C12 15 3 7 0-5Z');
  ctx.fillStyle = '#b8a087';
  ctx.fill(flower);
  ctx.stroke(flower);
  const sepals = new Path2D('M0 1C-13 14-4 24-19 29C-7 34 0 17 0 10C0 17 7 34 19 29C4 24 13 14 0 1Z');
  ctx.fillStyle = '#86966c';
  ctx.fill(sepals);
  ctx.stroke(sepals);
  ctx.stroke(new Path2D('M0-34V30M-25-12Q-12-15-5 0M25-12Q12-15 5 0'));
  ctx.restore();
}

function gardenAcanthus(ctx, x, y, angle, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  const leaf = new Path2D('M0 0C-7-4-22-3-16-12C-31-8-30-24-17-20C-31-32-23-40-11-31C-20-48-7-55 0-48C6-61 15-47 9-38C28-43 29-27 13-27C30-26 27-12 10-18C25-10 17 3 0 0Z');
  ctx.fillStyle = '#8c987b';
  ctx.strokeStyle = '#5d7359';
  ctx.lineWidth = 1.1;
  ctx.fill(leaf);
  ctx.stroke(leaf);
  ctx.strokeStyle = '#c4c5a0';
  ctx.lineWidth = 1;
  ctx.stroke(new Path2D('M0-2C-3-15 7-30 0-46M0-9Q-9-13-17-12M1-19Q-8-26-18-26M2-30Q-6-35-10-40M0-11Q11-13 15-9M2-23Q14-23 20-29M3-34Q11-36 14-41'));
  ctx.restore();
}

function gardenRosette(ctx, x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const petal = new Path2D('M0-3C-7-7-6-15 0-18C6-15 7-7 0-3Z');
  for (let i = 0; i < 10; i++) {
    ctx.save();
    ctx.rotate(i * Math.PI / 5);
    ctx.fillStyle = i % 2 ? '#b6aa7b' : '#c6b98c';
    ctx.strokeStyle = '#7d855f';
    ctx.lineWidth = .8;
    ctx.fill(petal);
    ctx.stroke(petal);
    ctx.strokeStyle = '#e3d8ad';
    ctx.stroke(new Path2D('M0-6V-14'));
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
  ctx.fillStyle = '#a59661';
  ctx.fill();
  ctx.strokeStyle = '#667453';
  ctx.lineWidth = .8;
  ctx.stroke();
  ctx.fillStyle = '#e1d4a4';
  for (const [dx, dy] of [[-2, -2], [2, -2], [0, 1], [-2, 3], [3, 2]]) {
    ctx.beginPath();
    ctx.arc(dx, dy, .7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function gardenBell(ctx, x, y, angle, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  const bud = new Path2D('M-6 5C-8-7-9-13-4-21L0-18L4-21C9-13 8-7 6 5L2 3L0 6L-2 3Z');
  ctx.fillStyle = '#c4b17f';
  ctx.strokeStyle = '#7b8460';
  ctx.lineWidth = .8;
  ctx.fill(bud);
  ctx.stroke(bud);
  ctx.strokeStyle = '#e4d6ac';
  ctx.stroke(new Path2D('M0 2C-4-5-3-10 0-14C3-10 4-5 0 2'));
  ctx.restore();
}

function gardenBotanicalSprig(ctx, x, y, angle = 0, scale = 1, mirror = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale * mirror, scale);
  const stems = new Path2D('M0 70C-27 35 24 7 0-18C-8-38-3-49 5-65M0 70C30 24-23 3-7-27C-22-53-38-28-19-24M1 25C17 13 29 17 20 34M-3-10C12-20 28-30 16-56M9-35Q22-42 26-52M-9 40C-29 38-34 57-19 60C-10 62-10 51-16 52');
  ctx.strokeStyle = '#607557';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.stroke(stems);
  ctx.strokeStyle = '#b8bc93';
  ctx.lineWidth = .7;
  ctx.stroke(stems);
  gardenAcanthus(ctx, -6, 28, -.9, .69);
  gardenAcanthus(ctx, 5, 4, .82, .7);
  gardenAcanthus(ctx, -5, -20, -.55, .52);
  gardenAcanthus(ctx, 3, 53, 1.17, .52);
  gardenLeaf(ctx, -2, -43, -.8, 7);
  gardenLeaf(ctx, 12, 37, .8, 8);
  gardenRosette(ctx, -19, -24, .54);
  gardenRosette(ctx, 20, 34, .61);
  gardenBell(ctx, 16, -56, .5, .66);
  gardenBell(ctx, 26, -52, .9, .5);
  gardenBell(ctx, 5, -65, -.2, .65);
  ctx.restore();
}

function createGardenBackdrop() {
  const canvas = gardenBuffer(), s = garden.ornamentScale;
  const ctx = canvas.getContext('2d');
  const paper = ctx.createLinearGradient(0, 0, 0, garden.height);
  paper.addColorStop(0, '#ded5b9');
  paper.addColorStop(1, '#beb797');
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, garden.width, garden.height);
  // Fixed speckles give the stone a quiet grain without flickering as it grows.
  for (let i = 0; i < 3600; i++) {
    const x = (i * 137.37) % garden.width, y = (i * 89.73) % garden.height;
    ctx.fillStyle = i % 3 ? '#655d4120' : '#fff4d730';
    ctx.fillRect(x, y, 1.1, .7);
  }
  roundedGardenRect(ctx, 23 * s, 23 * s, garden.width - 46 * s, garden.height - 46 * s, 42 * s);
  ctx.strokeStyle = '#415b43';
  ctx.lineWidth = 3 * s;
  ctx.stroke();
  roundedGardenRect(ctx, 31 * s, 31 * s, garden.width - 62 * s, garden.height - 62 * s, 37 * s);
  ctx.strokeStyle = '#a08b5e';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Lobed acanthus, rosettes and bellflowers echo the hall wallpaper.
  const sideCount = Math.max(1, Math.floor(garden.rows * garden.cell / (112 * s)));
  for (const side of [-1, 1]) {
    for (let i = 0; i < sideCount; i++) {
      const y = garden.y + (i + .5) * garden.rows * garden.cell / sideCount + 5 * s;
      gardenBotanicalSprig(ctx, side < 0 ? garden.x * .58 : garden.width - garden.x * .58, y, 0, .9 * s, -side);
    }
  }
  const middle = garden.width / 2, start = garden.x + 22 * s;
  const span = middle - 70 * s - start;
  const topCount = Math.max(1, Math.floor(span / (133 * s)));
  for (const bottom of [false, true]) {
    for (let i = 0; i < topCount; i++) {
      const x = start + (i + .5) * span / topCount;
      for (const px of [x, garden.width - x]) gardenBotanicalSprig(ctx, px, bottom ? garden.height - 70 * s : 68 * s, Math.PI / 2, .86 * s, bottom ? -1 : 1);
    }
  }
  gardenIris(ctx, middle, 72 * s, .95 * s);
  gardenIris(ctx, middle, garden.height - 65 * s, .95 * s);
  for (const x of [78 * s, garden.width - 78 * s]) {
    gardenIris(ctx, x, 80 * s, .72 * s, x < middle ? -.55 : .55);
    gardenIris(ctx, x, garden.height - 74 * s, .72 * s, x < middle ? .55 : -.55);
  }

  const w = garden.columns * garden.cell, h = garden.rows * garden.cell;
  roundedGardenRect(ctx, garden.x - 13 * s, garden.y - 13 * s, w + 26 * s, h + 26 * s, 17 * s);
  ctx.fillStyle = '#51664b';
  ctx.fill();
  ctx.strokeStyle = '#ae9768';
  ctx.lineWidth = 2;
  ctx.stroke();
  roundedGardenRect(ctx, garden.x - 5 * s, garden.y - 5 * s, w + 10 * s, h + 10 * s, 8 * s);
  ctx.fillStyle = gardenColours.stone;
  ctx.fill();
  ctx.strokeStyle = '#dbcc9e';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#766d4b18';
  for (let i = 0; i < 3200; i++) ctx.fillRect(garden.x + (i * 61.37) % w, garden.y + (i * 73.19) % h, 1, 1);
  return canvas;
}

function resetGarden() {
  cases = Array(garden.columns * garden.rows).fill(0);
  walls = Array(cases.length).fill(15); // north, east, south, west
  const startX = floor(random(garden.columns)), startY = floor(random(garden.rows));
  cases[startX + startY * garden.columns] = 1;
  gardenPassages = [];
  // Retry walkers that get trapped near their seed before spreading out.
  // Keep the original branches and pockets while covering most of the grid.
  for (let attempt = 0; attempt < 12; attempt++) {
    const passages = planGardenGrowth(startX, startY);
    if (passages.length > gardenPassages.length) gardenPassages = passages;
    if (gardenPassages.length + 1 >= cases.length * .85) break;
  }
  gardenPassage = 0;
  gardenStems = [];
  gardenBlooms = new Set();
  gardenRoses = new Map();
  gardenOpeningBlooms = new Set();
  gardenBloomTime = 0;
  gardenFlowersDirty = true;
  gardenPlants = gardenBuffer();
  gardenPlants.getContext('2d').translate(garden.x, garden.y);
  gardenFlowers = gardenBuffer();
  gardenFlowers.getContext('2d').translate(garden.x, garden.y);
  const degrees = Array(cases.length).fill(0);
  gardenStemNeighbours = Array.from({ length: cases.length }, () => []);
  for (const [x, y, nx, ny] of gardenPassages) {
    const from = x + y * garden.columns, to = nx + ny * garden.columns;
    degrees[from]++;
    degrees[to]++;
    gardenStemNeighbours[from].push([nx, ny]);
    gardenStemNeighbours[to].push([x, y]);
  }
  const seed = startX + startY * garden.columns;
  gardenRoseEnds = new Set(degrees.flatMap((degree, i) => degree === 1 && i !== seed ? [i] : []));
  for (const i of gardenRoseEnds) {
    const rose = { radius: garden.cell * random(.56, .88), angle: random(Math.PI * 2),
      shape: random(Math.PI * 2), squash: random(.94, 1.06), warmth: random(-4, 4),
      duration: random(520, 820), started: 0, progress: 0 };
    const size = Math.ceil(rose.radius * 2.6 + 4), density = pixelDensity();
    rose.sprite = document.createElement('canvas');
    rose.sprite.width = rose.sprite.height = size * density;
    const ctx = rose.sprite.getContext('2d');
    ctx.scale(density, density);
    gardenRose(ctx, size / 2, size / 2, rose.radius, rose.angle, rose);
    rose.size = size;
    // Align the final sprite to device pixels so fully opened petals stay crisp.
    rose.x = Math.round((garden.x + (i % garden.columns + .5) * garden.cell - size / 2) * density) / density - garden.x + size / 2;
    rose.y = Math.round((garden.y + (Math.floor(i / garden.columns) + .5) * garden.cell - size / 2) * density) / density - garden.y + size / 2;
    gardenRoses.set(i, rose);
  }
  visitedGardenCells = 1;
  gardenGrowthTime = performance.now();
  pendingGardenSteps = 0;
  gardenDirty = true;
  gardenDamage = null;
  gardenCanvas.elt.dataset.gardenState = 'growing';
  if (reducedGardenMotion) {
    while (gardenPassage < gardenPassages.length) growGarden();
    paintGarden();
    gardenAnimating = false;
    noLoop();
  } else {
    paintGarden();
    if (!gardenAnimating) {
      gardenAnimating = true;
      loop();
    }
  }
}

function setup() {
  pixelDensity(Math.min(displayDensity(), 2));
  gardenCanvas = createCanvas(1, 1);
  gardenCanvas.elt.setAttribute('role', 'button');
  gardenCanvas.elt.setAttribute('tabindex', '0');
  gardenCanvas.elt.setAttribute('aria-label', 'Rose maze garden. Branches grow through the maze and bloom at dead ends. Click or press Enter to grow again.');
  gardenCanvas.elt.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      resetGarden();
    }
  });
  frameRate(60);
  fitGarden();
}

function planGardenGrowth(startX, startY) {
  // The original walkers split occasionally and stop at dead ends. They never
  // backtrack to fill the untouched pockets between their branches.
  const occupied = new Uint8Array(cases.length), tips = [[startX, startY]], passages = [];
  occupied[startX + startY * garden.columns] = 1;
  while (tips.length) {
    for (let i = tips.length - 1; i >= 0; i--) {
      const [x, y] = tips[i];
      const neighbours = [[x, y - 1, 1, 4], [x, y + 1, 4, 1], [x - 1, y, 8, 2], [x + 1, y, 2, 8]]
        .filter(([nx, ny]) => nx >= 0 && nx < garden.columns && ny >= 0 && ny < garden.rows && !occupied[nx + ny * garden.columns]);
      if (!neighbours.length) {
        tips.splice(i, 1);
        continue;
      }
      const advance = () => {
        const next = neighbours.splice(floor(random(neighbours.length)), 1)[0];
        occupied[next[0] + next[1] * garden.columns] = 1;
        passages.push([x, y, ...next]);
        return next.slice(0, 2);
      };
      tips[i] = advance();
      if (neighbours.length && random() < .2) tips.push(advance());
    }
  }
  return passages;
}

function carveGardenPassage(x, y, nx, ny, direction, reverse) {
  const index = x + y * garden.columns;
  const next = nx + ny * garden.columns;
  walls[index] &= ~direction;
  walls[next] &= ~reverse;
  const left = garden.x + (Math.min(x, nx) - 1) * garden.cell;
  const top = garden.y + (Math.min(y, ny) - 1) * garden.cell;
  const right = garden.x + (Math.max(x, nx) + 2) * garden.cell;
  const bottom = garden.y + (Math.max(y, ny) + 2) * garden.cell;
  damageGarden(left, top, right, bottom);
  cases[next] = 1;
  visitedGardenCells++;
  gardenStems.push([x, y, nx, ny]);
  // Draw each new stem once. Cached leaves and petals cannot shimmer as other
  // branches grow or as the grid is repainted underneath them.
  const plantContext = gardenPlants.getContext('2d');
  paintGardenStem(plantContext, x, y, nx, ny);
  if (gardenRoseEnds.has(next)) {
    gardenBlooms.add(next);
    const rose = gardenRoses.get(next);
    rose.started = gardenBloomTime;
    rose.progress = reducedGardenMotion ? 1 : 0;
    if (!reducedGardenMotion) gardenOpeningBlooms.add(next);
    gardenFlowersDirty = true;
  }
}

function damageGarden(left, top, right, bottom) {
  if (!gardenDirty) gardenDamage = [];
  if (gardenDamage) gardenDamage.push({ left, top, right, bottom });
  gardenDirty = true;
}

function updateGardenBlooms() {
  for (const i of gardenOpeningBlooms) {
    const rose = gardenRoses.get(i);
    rose.progress = Math.min(1, (gardenBloomTime - rose.started) / rose.duration);
    const x = garden.x + (i % garden.columns + .5) * garden.cell;
    const y = garden.y + (Math.floor(i / garden.columns) + .5) * garden.cell;
    const reach = rose.size * .65;
    damageGarden(x - reach, y - reach, x + reach, y + reach);
    gardenFlowersDirty = true;
    if (rose.progress === 1) gardenOpeningBlooms.delete(i);
  }
}

function paintGardenFlowers() {
  if (!gardenFlowersDirty) return;
  const ctx = gardenFlowers.getContext('2d');
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, gardenFlowers.width, gardenFlowers.height);
  ctx.restore();
  // Cached petals keep their details fixed as the bud opens. Rebuild in birth
  // order so overlapping flowers never switch places when they finish blooming.
  for (const i of gardenBlooms) {
    const rose = gardenRoses.get(i), opening = 1 - (1 - rose.progress) ** 3;
    const size = rose.size * (.12 + .88 * opening);
    ctx.save();
    ctx.translate(rose.x, rose.y);
    ctx.rotate(-.18 * (1 - opening));
    ctx.scale(1, .88 + .12 * opening);
    ctx.globalAlpha = Math.min(1, .4 + rose.progress * 2);
    ctx.drawImage(rose.sprite, -size / 2, -size / 2, size, size);
    ctx.restore();
  }
  gardenFlowersDirty = false;
}

function growGarden() {
  if (gardenPassage >= gardenPassages.length) return;
  carveGardenPassage(...gardenPassages[gardenPassage++]);
}

function gardenWallPath(ctx) {
  // Each surviving edge stays at the same grid coordinate throughout growth.
  // Draw shared walls once so junctions cannot shift when a passage opens.
  const cell = garden.cell;
  ctx.beginPath();
  for (let y = 0; y < garden.rows; y++) {
    for (let x = 0; x < garden.columns; x++) {
      const wall = walls[x + y * garden.columns], left = x * cell, top = y * cell;
      if (wall & 1) { ctx.moveTo(left, top); ctx.lineTo(left + cell, top); }
      if (wall & 8) { ctx.moveTo(left, top); ctx.lineTo(left, top + cell); }
      if (y === garden.rows - 1 && wall & 4) { ctx.moveTo(left, top + cell); ctx.lineTo(left + cell, top + cell); }
      if (x === garden.columns - 1 && wall & 2) { ctx.moveTo(left + cell, top); ctx.lineTo(left + cell, top + cell); }
    }
  }
}

function gardenRose(ctx, x, y, radius, angle, variant) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(radius, radius * variant.squash);
  ctx.fillStyle = '#526f49';
  for (let i = 0; i < 5; i++) {
    ctx.save();
    ctx.rotate(i * Math.PI * 2 / 5);
    ctx.fill(new Path2D('M-.2 0Q-.4-.7 0-1.16Q.4-.7.2 0Z'));
    ctx.restore();
  }
  // Broad outer petals fold around progressively tighter, offset inner cups.
  const petal = new Path2D('M-.62.12C-1.03-.08-1.09-.63-.76-.81C-.47-1.13.08-1.08.39-.77C.8-.66.88-.23.55.04C.22.32-.23.4-.62.12Z');
  const lip = new Path2D('M-.75-.79C-.43-1.01.04-1 .37-.77C.05-.9-.27-.84-.47-.61Q-.63-.59-.75-.79Z');
  const layers = [
    [5, 1, .12, '#dfada8', '#b97583', '#8f4b60'],
    [5, .76, .69, '#e4b5ae', '#c48290', '#984e65'],
    [4, .52, .28, '#e8b9b2', '#cf8c98', '#9b4e68'],
    [3, .3, 1.04, '#e4b1ae', '#c78392', '#853e59']
  ];
  for (const [count, size, rotation, light, pink, shade] of layers) {
    for (let i = 0; i < count; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI * 2 / count + rotation + .06 * Math.sin(variant.shape + i * 2.3 + size));
      ctx.scale(size * (1 + .045 * Math.cos(variant.shape + i)), size * (i % 2 ? .94 : 1));
      const colour = ctx.createLinearGradient(-.2, -1, .2, .35);
      colour.addColorStop(0, gardenRoseTone(light, variant.warmth));
      colour.addColorStop(.35, gardenRoseTone(pink, variant.warmth));
      colour.addColorStop(1, gardenRoseTone(shade, variant.warmth));
      ctx.fillStyle = colour;
      ctx.fill(petal);
      ctx.strokeStyle = shade;
      ctx.lineWidth = .032;
      ctx.stroke(petal);
      ctx.fillStyle = light;
      ctx.fill(lip);
      ctx.strokeStyle = '#a45f73';
      ctx.lineWidth = .022;
      ctx.stroke(new Path2D('M-.55-.55C-.37-.23-.09-.1.27-.12'));
      ctx.restore();
    }
  }
  // A dark curled heart reads as a rose bud rather than a daisy centre.
  ctx.fillStyle = '#93445f';
  ctx.fill(new Path2D('M-.12-.14C.09-.29.29-.07.15.12C-.04.31-.27.1-.12-.14Z'));
  ctx.strokeStyle = '#edb9b2';
  ctx.lineWidth = .035;
  ctx.stroke(new Path2D('M-.1-.12C.05-.22.19-.06.09.07C-.02.17-.12.06-.04-.03'));
  ctx.restore();
}

function gardenRoseTone(hex, warmth) {
  const channels = [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16));
  return `rgb(${Math.round(channels[0] + warmth)}, ${Math.round(channels[1] + warmth * .4)}, ${Math.round(channels[2] - warmth)})`;
}

function gardenThorn(ctx, x, y, angle, cell, side) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(cell, cell * side);
  // A broad attachment tapers to a sharp, backward-hooked point.
  const thorn = new Path2D('M-.1.09Q-.04.16.075.12L-.13.33Q-.12.19-.1.09Z');
  ctx.fillStyle = '#7a6748';
  ctx.strokeStyle = '#3b5038';
  ctx.lineWidth = .025;
  ctx.fill(thorn);
  ctx.stroke(thorn);
  ctx.strokeStyle = '#bab184';
  ctx.lineWidth = .018;
  ctx.stroke(new Path2D('M.025.15L-.115.3'));
  ctx.restore();
}

function gardenStemPoint(x, y) {
  return [(x + .5 + .09 * Math.sin(x * .73 + y * .49)) * garden.cell,
    (y + .5 + .09 * Math.cos(x * .59 + y * .81)) * garden.cell];
}

function gardenStemTangent(x, y, vx, vy) {
  const neighbours = gardenStemNeighbours[x + y * garden.columns];
  if (neighbours.length === 2) {
    const a = gardenStemPoint(...neighbours[0]), b = gardenStemPoint(...neighbours[1]);
    let dx = b[0] - a[0], dy = b[1] - a[1];
    if (dx * vx + dy * vy < 0) { dx = -dx; dy = -dy; }
    const length = Math.hypot(dx, dy);
    return [dx / length, dy / length];
  }
  const length = Math.hypot(vx, vy);
  return [vx / length, vy / length];
}

function paintGardenStem(ctx, x, y, nx, ny) {
  const cell = garden.cell;
  ctx.lineCap = 'round';
  const [ax, ay] = gardenStemPoint(x, y), [bx, by] = gardenStemPoint(nx, ny);
  const angle = Math.atan2(ny - y, nx - x), key = nx + ny * garden.columns;
  // Shared tangents make adjoining segments flow smoothly around maze corners.
  const outgoing = gardenStemTangent(x, y, bx - ax, by - ay);
  const incoming = gardenStemTangent(nx, ny, bx - ax, by - ay);
  const handle = cell * .38;
  const cx = ax + outgoing[0] * handle, cy = ay + outgoing[1] * handle;
  const dx = bx - incoming[0] * handle, dy = by - incoming[1] * handle;
  for (const [t, side] of [[.27, key % 2 ? 1 : -1], [.76, key % 2 ? -1 : 1]]) {
    const u = 1 - t;
    const px = u ** 3 * ax + 3 * u ** 2 * t * cx + 3 * u * t ** 2 * dx + t ** 3 * bx;
    const py = u ** 3 * ay + 3 * u ** 2 * t * cy + 3 * u * t ** 2 * dy + t ** 3 * by;
    const vx = 3 * u ** 2 * (cx - ax) + 6 * u * t * (dx - cx) + 3 * t ** 2 * (bx - dx);
    const vy = 3 * u ** 2 * (cy - ay) + 6 * u * t * (dy - cy) + 3 * t ** 2 * (by - dy);
    gardenThorn(ctx, px, py, Math.atan2(vy, vx), cell, side);
  }
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.bezierCurveTo(cx, cy, dx, dy, bx, by);
  ctx.strokeStyle = '#344f38';
  ctx.lineWidth = Math.max(3.5, cell * .27);
  ctx.stroke();
  ctx.strokeStyle = '#456345';
  ctx.lineWidth = Math.max(2.8, cell * .21);
  ctx.stroke();
  ctx.strokeStyle = '#95a571';
  ctx.lineWidth = Math.max(.7, cell * .045);
  ctx.stroke();
  if (key % 3 !== 0) {
    // Attach leaves to the curved stem rather than the straight grid axis.
    const t = .58, u = 1 - t;
    const leafX = u ** 3 * ax + 3 * u ** 2 * t * cx + 3 * u * t ** 2 * dx + t ** 3 * bx;
    const leafY = u ** 3 * ay + 3 * u ** 2 * t * cy + 3 * u * t ** 2 * dy + t ** 3 * by;
    const leafAngle = angle + (key % 2 ? .65 : -.65);
    gardenLeaf(ctx, leafX, leafY, leafAngle, cell * .14);
  }
}

function paintGarden() {
  gardenCanvas.elt.dataset.gardenState = gardenPassage < gardenPassages.length || gardenOpeningBlooms.size ? 'growing' : 'complete';
  if (!gardenDirty) return;
  paintGardenFlowers();
  const ctx = gardenFrame.getContext('2d'), cell = garden.cell, s = cell / 22;
  ctx.save();
  if (gardenDamage) {
    // Keep unchanged pixels intact while several branches grow together.
    const density = pixelDensity();
    ctx.beginPath();
    for (const damage of gardenDamage) {
      const left = Math.floor(damage.left * density) / density;
      const top = Math.floor(damage.top * density) / density;
      const right = Math.ceil(damage.right * density) / density;
      const bottom = Math.ceil(damage.bottom * density) / density;
      ctx.rect(left, top, right - left, bottom - top);
    }
    ctx.clip();
  }
  ctx.drawImage(gardenBackdrop, 0, 0, garden.width, garden.height);
  ctx.save();
  ctx.translate(garden.x, garden.y);
  gardenWallPath(ctx);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#8f997a';
  ctx.lineWidth = Math.max(1, 1.3 * s);
  ctx.stroke();
  ctx.restore();
  ctx.drawImage(gardenPlants, 0, 0, garden.width, garden.height);
  // Oversized blooms always sit above new stems and the underlying grid.
  ctx.drawImage(gardenFlowers, 0, 0, garden.width, garden.height);
  ctx.restore();
  // Display one complete frame. The ornament and stone never disappear between updates.
  drawingContext.save();
  drawingContext.setTransform(pixelDensity(), 0, 0, pixelDensity(), 0, 0);
  drawingContext.globalCompositeOperation = 'source-over';
  drawingContext.drawImage(gardenFrame, 0, 0, garden.width, garden.height);
  drawingContext.restore();
  gardenDirty = false;
}

function draw() {
  const now = performance.now();
  // Cap long gaps so returning to the page cannot finish the maze at once.
  const elapsed = Math.min(now - gardenGrowthTime, 100);
  gardenGrowthTime = now;
  gardenBloomTime += elapsed;
  // Reveal passages at a steady rate, including the first few branches.
  pendingGardenSteps += elapsed * gardenPassages.length / garden.growthDuration;
  while (pendingGardenSteps >= 1 && gardenPassage < gardenPassages.length) {
    growGarden();
    pendingGardenSteps--;
  }
  updateGardenBlooms();
  paintGarden();
  if (gardenPassage >= gardenPassages.length && !gardenOpeningBlooms.size) {
    gardenAnimating = false;
    noLoop();
  }
}

function mousePressed(event) {
  if (event && event.target !== gardenCanvas.elt) return;
  if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return;
  resetGarden();
  return false;
}

function touchStarted(event) {
  return mousePressed(event);
}
