// The apartment has its own renderer and controls; the original house is independent.
const body = document.body;
const world = document.getElementById('apartment-world');
const links = [...document.querySelectorAll('.apartment-door')];
const plan = document.getElementById('apartment-plan');
const reset = document.getElementById('apartment-reset');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
let requestFloor = () => {};

function floorFromURL() { return location.hash === '#first-floor' ? 'first' : 'ground'; }
function updateFloorControls() {
  const first = floorFromURL() === 'first';
  body.dataset.floor = first ? 'first' : 'ground';
  for (const link of links) {
    if (link.dataset.room) link.hidden = ['music', 'laboratory'].includes(link.dataset.room) !== first;
    else {
      link.href = first ? '#ground-floor' : '#first-floor';
      link.setAttribute('aria-label', first ? 'Go downstairs' : 'Go upstairs');
      link.querySelector('svg').style.transform = first ? 'rotate(180deg)' : '';
    }
  }
  for (const link of document.querySelectorAll('[data-floor-link]')) {
    if (link.dataset.floorLink === body.dataset.floor) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
  // A floor change must never leave keyboard focus on a hidden room.
  if (document.activeElement?.hidden) document.querySelector(`[data-floor-link="${body.dataset.floor}"]`).focus();
}
updateFloorControls();
window.addEventListener('hashchange', () => { updateFloorControls(); requestFloor(); });
document.getElementById('apartment-map').addEventListener('click', () => plan.showModal());
plan.querySelector('button').addEventListener('click', () => plan.close());
plan.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', () => plan.close()));
plan.addEventListener('click', event => {
  if (event.target !== plan) return;
  const r = plan.getBoundingClientRect();
  if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) plan.close();
});
plan.addEventListener('close', () => document.getElementById('apartment-map').focus());
plan.addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const focusable = [...plan.querySelectorAll('button, a[href]')];
  const first = focusable[0], last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});

try {
  const THREE = await import('/libraries/three/three.module.min.js');
  await buildApartment(THREE);
} catch (error) {
  // Icon doors and the floor plan remain usable when WebGL or its module fails.
  world.replaceChildren();
  reset.hidden = true;
  body.dataset.state = 'fallback';
  console.warn('Apartment renderer unavailable:', error.message);
}

async function buildApartment(T) {
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.setClearColor('#354d42');
  world.append(renderer.domElement);
  const scene = new T.Scene();
  scene.background = new T.Color('#465e4c');
  scene.fog = new T.Fog('#6c7553', 17, 34);
  const camera = new T.PerspectiveCamera(56, 1, .08, 65);
  const raycaster = new T.Raycaster();
  const pointer = new T.Vector2();
  const targets = [];
  const doors = new Map();
  const v = (x, y, z) => new T.Vector3(x, y, z);
  let seed = 71;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const texture = (width, height, draw) => {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    draw(canvas.getContext('2d'), width, height);
    const result = new T.CanvasTexture(canvas);
    result.colorSpace = T.SRGBColorSpace;
    return result;
  };
  const paper = texture(256, 256, (c, w, h) => {
    c.fillStyle = '#f3ebd6'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 18000; i++) {
      c.fillStyle = random() > .5 ? '#88795b0c' : '#fffaf113';
      c.fillRect(random() * w, random() * h, 1, 1);
    }
  });
  paper.wrapS = paper.wrapT = T.RepeatWrapping;
  const walnut = texture(256, 512, (c, w, h) => {
    c.fillStyle = '#c0a079'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const x = i * w / 90;
      c.beginPath(); c.moveTo(x, 0);
      for (let y = 0; y <= h; y += 8) {
        c.lineTo(x + 2.6 * Math.sin(y / 64 + i * .6) + 1.2 * Math.sin(y / 23 + i), y);
      }
      c.strokeStyle = i % 3 ? '#76553732' : '#f5dab34a'; c.lineWidth = i % 5 ? .7 : 1.5; c.stroke();
    }
    for (let i = 0; i < 5000; i++) {
      c.fillStyle = '#523e2110'; c.fillRect(random() * w, random() * h, .6, 2);
    }
  });
  walnut.wrapS = walnut.wrapT = T.RepeatWrapping;
  const levels = new T.DataTexture(new Uint8Array([88, 153, 205, 255]), 4, 1, T.RedFormat);
  levels.minFilter = levels.magFilter = T.NearestFilter;
  levels.needsUpdate = true;
  const toon = (color, options = {}) => new T.MeshToonMaterial({ color, gradientMap: levels, map: paper, side: T.DoubleSide, ...options });
  const mats = {
    ink: toon('#253f35'), wood: toon('#806342', { map: walnut }), paleWood: toon('#b49561', { map: walnut }),
    gold: toon('#c3aa78'), cream: toon('#d5c8a4'), plaster: toon('#c4bb97'),
    sage: toon('#7f906d'), moss: toon('#526d55'), rose: toon('#ad8679'),
    dark: new T.MeshBasicMaterial({ color: '#233c32' }),
    glass: toon('#a7b38a', { emissive: '#6c713e', emissiveIntensity: .14 }),
    amber: toon('#d1b47b', { emissive: '#be893b', emissiveIntensity: .20 }),
    blushGlass: toon('#b49683', { emissive: '#92634d', emissiveIntensity: .12 }),
    bulb: new T.MeshBasicMaterial({ color: '#ffe3a0' }),
    shadow: new T.MeshBasicMaterial({ color: '#1f392e', transparent: true, opacity: .16, depthWrite: false }),
  };
  const boxGeometry = new T.BoxGeometry(1, 1, 1);
  const sphereGeometry = new T.SphereGeometry(1, 12, 8);
  const mesh = (geometry, material, parent, position) => {
    const object = new T.Mesh(geometry, material);
    if (position) object.position.set(...position);
    parent.add(object); return object;
  };
  const box = (parent, x, y, z, w, h, d, material) => {
    const object = mesh(boxGeometry, material, parent, [x, y, z]); object.scale.set(w, h, d); return object;
  };
  const ball = (parent, x, y, z, radius, material) => {
    const object = mesh(sphereGeometry, material, parent, [x, y, z]); object.scale.setScalar(radius); return object;
  };
  const curve = (points, radius, material, parent, segments = 32) => {
    const path = new T.CatmullRomCurve3(points.map(p => Array.isArray(p) ? v(...p) : p));
    return mesh(new T.TubeGeometry(path, segments, radius, 5, false), material, parent);
  };
  const bezier = (points, radius, material, parent) => {
    const path = new T.CubicBezierCurve3(...points.map(p => v(...p)));
    return mesh(new T.TubeGeometry(path, 24, radius, 5, false), material, parent);
  };
  function archShape(width, height) {
    const s = new T.Shape(), r = width / 2, shoulder = height - r;
    s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, shoulder);
    s.bezierCurveTo(r, shoulder + r * .65, r * .62, height, 0, height);
    s.bezierCurveTo(-r * .62, height, -r, shoulder + r * .65, -r, shoulder);
    s.closePath(); return s;
  }
  function panel(parent, shape, material, depth = .065, position = [0, 0, 0]) {
    const geo = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 20 });
    return mesh(geo, material, parent, position);
  }
  function archBorder(parent, width, height, y, z, material, radius) {
    const r = width / 2, shoulder = height - r;
    const points = [[-r, y, z], [-r, y + shoulder, z]];
    for (let i = 0; i <= 32; i++) {
      const a = Math.PI - i * Math.PI / 32;
      points.push([r * Math.cos(a), y + shoulder + r * Math.sin(a), z]);
    }
    points.push([r, y, z]);
    return curve(points, radius, material, parent, 60);
  }
  function leaf(parent, x, y, z, size, angle, material = mats.sage) {
    const s = new T.Shape();
    s.moveTo(0, 0); s.bezierCurveTo(-.45, .2, -.4, .73, 0, 1);
    s.bezierCurveTo(.28, .62, .24, .2, 0, 0);
    const obj = mesh(new T.ShapeGeometry(s, 12), material, parent, [x, y, z]);
    obj.scale.setScalar(size); obj.rotation.z = angle;
    return obj;
  }
  function iris(parent, x, y, z, size = 1) {
    const flower = new T.Group(); flower.position.set(x, y, z); flower.scale.setScalar(size); parent.add(flower);
    for (const a of [-.72, 0, .72]) leaf(flower, 0, 0, .01, .5, a, a === 0 ? mats.amber : mats.blushGlass);
    for (const a of [-2.3, 2.3]) leaf(flower, 0, .03, .02, .34, a, mats.rose);
    curve([[0, -.48, 0], [.02, -.16, 0], [0, .38, 0]], .013, mats.gold, flower);
    for (const a of [-.72, 0, .72]) {
      const vein = new T.Group(); vein.rotation.z = a; flower.add(vein);
      curve([[0, .035, .025], [-.03, .21, .025], [0, .44, .025]], .007, mats.gold, vein, 10);
    }
    return flower;
  }
  // Draw a half-drop botanical repeat at double resolution. Motifs crossing a
  // tile edge are drawn again on the opposite edge so the print is seamless.
  const wallpaper = texture(1024, 1024, (c, w, h) => {
    c.scale(2, 2);
    c.fillStyle = '#b6b28b'; c.fillRect(0, 0, 512, 512);
    c.lineJoin = c.lineCap = 'round';
    const ink = '#526348';
    const stroke = (draw, color = ink, width = 1.3) => {
      c.beginPath(); draw(); c.strokeStyle = color; c.lineWidth = width; c.stroke();
    };
    // Interlocking ogee vines sit behind the flowers, rather than leaving
    // separate sprigs floating in an otherwise empty repeat.
    for (let row = -1; row < 3; row++) for (let col = -1; col < 3; col++) {
      const x = col * 256 + Math.abs(row % 2) * 128, y = row * 256;
      for (const side of [-1, 1]) {
        const vine = () => {
          c.moveTo(x, y + 256);
          c.bezierCurveTo(x + side * 34, y + 219, x + side * 127, y + 204, x + side * 128, y + 128);
          c.bezierCurveTo(x + side * 127, y + 52, x + side * 34, y + 37, x, y);
        };
        stroke(vine, '#87916b', 2.6); stroke(vine, '#d6c594', .7);
        stroke(() => {
          c.moveTo(x + side * 112, y + 123);
          c.bezierCurveTo(x + side * 89, y + 77, x + side * 55, y + 92, x + side * 64, y + 111);
          c.bezierCurveTo(x + side * 72, y + 126, x + side * 86, y + 111, x + side * 75, y + 106);
        }, '#949c74', 1.2);
        for (let i = 0; i < 3; i++) {
          c.beginPath(); c.arc(x + side * (39 + i * 9), y + 14 + i * 10, 1.3, 0, Math.PI * 2);
          c.fillStyle = '#c9b883'; c.fill();
        }
      }
    }
    const foliage = (x, y, a, size, color) => {
      c.save(); c.translate(x, y); c.rotate(a); c.scale(size, size);
      c.beginPath(); c.moveTo(0, 0);
      c.bezierCurveTo(-8, -12, -28, -18, -19, -39);
      c.bezierCurveTo(-14, -54, -7, -64, 0, -78);
      c.bezierCurveTo(19, -54, 24, -32, 14, -17);
      c.bezierCurveTo(8, -9, 3, -6, 0, 0);
      c.fillStyle = color; c.fill(); c.strokeStyle = ink; c.lineWidth = 1.4; c.stroke();
      stroke(() => { c.moveTo(0, -3); c.bezierCurveTo(-4, -29, -3, -51, 0, -72); }, '#d2c593', 1.1);
      for (let i = 0; i < 5; i++) {
        const yy = -16 - i * 10, spread = i === 4 ? 9 : 16;
        for (const side of [-1, 1]) stroke(() => {
          c.moveTo(-2, yy + 5); c.quadraticCurveTo(side * spread * .65, yy - 1, side * spread, yy - 9);
        }, '#627451', .8);
      }
      c.restore();
    };
    const petal = (a, length, width, color, fall = false) => {
      c.save(); c.rotate(a);
      c.beginPath(); c.moveTo(0, 4);
      c.bezierCurveTo(-width, -length * .28, -width * .8, -length * .9, -4, -length);
      c.bezierCurveTo(width * .45, -length * 1.04, width, -length * .55, 0, 4);
      c.fillStyle = color; c.fill(); c.strokeStyle = ink; c.lineWidth = 1.2; c.stroke();
      for (const offset of [-4, 0, 4]) stroke(() => {
        c.moveTo(0, -2); c.bezierCurveTo(offset, -length * .35, offset - 3, -length * .7, -2, -length + 7);
      }, fall ? '#947f65' : '#a08b6d', .65);
      c.restore();
    };
    const flower = (x, y, mirror) => {
      c.save(); c.translate(x, y); c.scale(mirror, 1);
      petal(-.65, 39, 20, '#c4a59b'); petal(.65, 39, 20, '#c4a59b');
      petal(0, 47, 16, '#e1cf9c');
      petal(-2.08, 37, 25, '#ac8e85', true); petal(2.08, 37, 25, '#ac8e85', true);
      petal(Math.PI, 30, 17, '#d3b397', true);
      stroke(() => { c.moveTo(-6, 8); c.quadraticCurveTo(0, -12, 6, 8); }, '#e7c578', 3);
      for (const side of [-1, 1]) stroke(() => {
        c.moveTo(0, 8); c.quadraticCurveTo(side * 10, 18, side * 12, 30);
      }, ink, 1.5);
      c.restore();
    };
    for (let row = -1; row < 3; row++) for (let col = -1; col < 3; col++) {
      const x = col * 256 + (Math.abs(row % 2) * 128), y = row * 256;
      c.save(); c.translate(x, y);
      const stem = () => {
        c.moveTo(0, 257); c.bezierCurveTo(-48, 204, 49, 155, 7, 61);
      };
      stroke(stem, '#596f4f', 5.5); stroke(stem, '#d3c490', 1.1);
      for (const side of [-1, 1]) {
        stroke(() => {
          c.moveTo(4, 222); c.bezierCurveTo(side * 76, 192, side * 116, 105, side * 74, 94);
          c.bezierCurveTo(side * 44, 86, side * 47, 127, side * 69, 119);
          c.bezierCurveTo(side * 84, 113, side * 75, 101, side * 65, 106);
        }, '#798563', 2.1);
        foliage(side * 33, 191, side * -.95, .92, side < 0 ? '#748664' : '#8d986f');
        foliage(side * 66, 153, side * -.62, .66, '#9ca276');
        foliage(side * 57, 111, side * .6, .42, '#849369');
        // Small seed heads fill the spaces between the larger curling leaves.
        stroke(() => { c.moveTo(side * 104, 210); c.quadraticCurveTo(side * 111, 171, side * 101, 145); }, '#7b8660', 1.2);
        for (let i = 0; i < 5; i++) {
          c.beginPath(); c.ellipse(side * (104 + (i % 2 ? 5 : -3)), 153 + i * 9, 2.3, 4, side * .45, 0, Math.PI * 2);
          c.fillStyle = '#cbb580'; c.fill(); c.strokeStyle = '#7e8055'; c.lineWidth = .8; c.stroke();
        }
      }
      foliage(6, 159, -.48, .85, '#6e805d');
      foliage(9, 119, .55, .66, '#8f9b71');
      flower(7, 65, row % 2 ? -1 : 1);
      for (const side of [-1, 1]) {
        stroke(() => { c.moveTo(side * 94, 31); c.bezierCurveTo(side * 135, 3, side * 141, 56, side * 111, 58); }, '#8e966d', 1.3);
        foliage(side * 112, 56, side * .7, .30, '#a0a578');
        c.beginPath(); c.arc(side * 88, 76, 2, 0, Math.PI * 2); c.fillStyle = '#d9c58e'; c.fill();
      }
      c.restore();
    }
    for (let i = 0; i < 24000; i++) {
      c.fillStyle = i % 2 ? '#f6e4ae15' : '#35523e0b'; c.fillRect(random() * w / 2, random() * h / 2, .5, .5);
    }
  });
  wallpaper.wrapS = wallpaper.wrapT = T.RepeatWrapping;
  wallpaper.repeat.set(9.8, 2);
  wallpaper.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const wallMaterial = toon('#f0dfb0', { map: wallpaper, side: T.DoubleSide });
  const upperWallMaterial = toon('#d3d3b2', { map: wallpaper, side: T.DoubleSide });
  const glowTexture = texture(128, 128, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, '#ffe4a0a0'); g.addColorStop(.15, '#edc87860'); g.addColorStop(.5, '#d8a65720'); g.addColorStop(1, '#d8a65700');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  const glowMaterial = new T.SpriteMaterial({ map: glowTexture, transparent: true, depthWrite: false, blending: T.AdditiveBlending });
  function glow(parent, position, size) {
    const sprite = new T.Sprite(glowMaterial); sprite.position.set(...position); sprite.scale.set(size, size, 1); parent.add(sprite);
  }
  function lamp(parent, x, y, z, wall = false) {
    const g = new T.Group(); g.position.set(x, y, z); parent.add(g);
    if (wall) {
      const plate = ball(g, 0, -.22, .015, .17, mats.wood); plate.scale.set(.13, .28, .055);
      archBorder(g, .20, .46, -.45, .08, mats.gold, .012);
      ball(g, 0, -.25, 0, .10, mats.gold);
      bezier([[0, -.3, 0], [0, -.25, .3], [0, .05, .25], [0, .12, .2]], .027, mats.wood, g);
      for (const side of [-1, 1]) {
        bezier([[0, -.26, .11], [side * .28, -.18, .2], [side * .25, .12, .2], [0, .05, .2]], .012, mats.gold, g);
        leaf(g, side * .08, -.22, .17, .12, side * -.7, mats.gold);
      }
    } else curve([[0, .85, 0], [0, .4, 0], [0, .12, 0]], .018, mats.wood, g);
    const points = [v(.07, .15, 0), v(.12, .12, 0), v(.2, 0, 0), v(.27, -.18, 0), v(.24, -.2, 0)].map(p => new T.Vector2(p.x, p.y));
    mesh(new T.LatheGeometry(points, 16), mats.amber, g, [0, 0, wall ? .2 : 0]);
    ball(g, 0, -.17, wall ? .2 : 0, .14, mats.bulb);
    const ring = mesh(new T.TorusGeometry(.255, .015, 5, 24), mats.gold, g, [0, -.19, wall ? .2 : 0]); ring.rotation.x = Math.PI / 2;
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      curve([[.08 * Math.cos(a), .14, .08 * Math.sin(a)], [.17 * Math.cos(a), .01, .17 * Math.sin(a)], [.25 * Math.cos(a), -.19, .25 * Math.sin(a)]].map(([xx, yy, zz]) => [xx, yy, zz + (wall ? .2 : 0)]), .009, mats.wood, g, 12);
      const petal = new T.Group(); petal.position.set(.19 * Math.cos(a), -.13, .19 * Math.sin(a) + (wall ? .2 : 0)); petal.rotation.y = Math.PI / 2 - a; g.add(petal);
      leaf(petal, 0, 0, .012, .16, 0, i % 2 ? mats.blushGlass : mats.glass);
      curve([[0, 0, .023], [0, .08, .023], [0, .14, .023]], .006, mats.gold, petal, 6);
      ball(g, .255 * Math.cos(a), -.235, .255 * Math.sin(a) + (wall ? .2 : 0), .022, mats.amber);
    }
    glow(g, [0, -.12, wall ? .3 : 0], 1.7);
    const light = new T.PointLight('#ffce7c', 2.8, 7, 1.5); light.position.set(0, -.2, wall ? .4 : 0); g.add(light);
  }
  scene.add(new T.HemisphereLight('#e3d6b5', '#456358', .85));
  scene.add(new T.AmbientLight('#b3b797', .35));
  const sunset = new T.DirectionalLight('#e6c398', .9); sunset.position.set(-4, 7, -5); scene.add(sunset);
  const dusk = new T.DirectionalLight('#94b6ad', .6); dusk.position.set(4, 3, 8); scene.add(dusk);

  const wallX = (side, z) => side * (4.5 + .7 * Math.sin((z + 5.6) / 19.6 * Math.PI));
  // A flat doorway bay joins two exact points on the curved wall. The frame,
  // opening, and wall all use this transform, including their floor datum.
  function sideDoorBay(side) {
    const near = -4.6, far = -1.6;
    const a = wallX(side, near), b = wallX(side, far);
    return { x: (a + b) / 2, z: (near + far) / 2, yaw: -side * Math.atan2(far - near, Math.abs(b - a)), halfWidth: Math.hypot(b - a, far - near) / 2, near, far };
  }
  function doorwayWall(parent, bay, material, left = -bay.halfWidth, right = bay.halfWidth) {
    const group = new T.Group(); group.position.set(bay.x, 0, bay.z); group.rotation.y = bay.yaw; parent.add(group);
    const r = 1.01, top = 3.99, shoulder = top - r, height = 5.04;
    // The opening reaches the floor rather than sitting inside a solid panel.
    const shape = new T.Shape();
    shape.moveTo(left, 0); shape.lineTo(-r, 0); shape.lineTo(-r, shoulder);
    shape.bezierCurveTo(-r, shoulder + r * .65, -r * .62, top, 0, top);
    shape.bezierCurveTo(r * .62, top, r, shoulder + r * .65, r, shoulder);
    shape.lineTo(r, 0); shape.lineTo(right, 0); shape.lineTo(right, height); shape.lineTo(left, height); shape.closePath();
    const geometry = new T.ShapeGeometry(shape, 24), uv = geometry.attributes.uv, pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const horizontal = bay.yaw ? (bay.z - pos.getX(i) * Math.sin(bay.yaw) + 5.6) / 19.6 : (bay.x + pos.getX(i) + 4.5) / 19.6;
      uv.setXY(i, horizontal, (pos.getY(i) - 1) / 4.04);
    }
    mesh(geometry, material, group);
    for (const [a, b] of [[left, -r], [r, right]]) {
      box(group, (a + b) / 2, .48, .01, b - a, .96, .055, mats.wood);
      for (const [y, radius, mat] of [[.15, .10, mats.wood], [.94, .08, mats.wood], [1.04, .026, mats.gold]]) curve([[a, y, .04], [b, y, .04]], radius, mat, group, 4);
    }
    for (const [y, radius, mat] of [[4.4, .12, mats.wood], [4.52, .035, mats.gold]]) curve([[left, y, .04], [right, y, .04]], radius, mat, group, 4);
  }
  function wallSurface(parent, side, material, y0 = 1, height = 4) {
    const bay = sideDoorBay(side);
    for (const [from, to] of [[-5.6, bay.near], [bay.far, 14]]) {
      const positions = [], uvs = [], indices = [], n = Math.max(4, Math.ceil((to - from) * 3));
      for (let i = 0; i <= n; i++) {
        const z = from + (to - from) * i / n, x = wallX(side, z);
        for (const yy of [y0, height]) { positions.push(x, yy, z); uvs.push((z + 5.6) / 19.6, (yy - y0) / (height - y0)); }
        if (i < n) { const j = i * 2; indices.push(j, j + 1, j + 2, j + 1, j + 3, j + 2); }
      }
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2)); geo.setIndex(indices); geo.computeVertexNormals();
      mesh(geo, material, parent);
      for (const [yy, r, mat] of [[.15, .10, mats.wood], [.94, .08, mats.wood], [1.04, .026, mats.gold], [4.4, .12, mats.wood], [4.52, .035, mats.gold]]) {
        curve(Array.from({ length: n + 1 }, (_, i) => { const z = from + (to - from) * i / n; return [wallX(side, z), yy, z]; }), r, mat, parent, n);
      }
      const base = geo.clone(), pos = base.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setY(i, i % 2 ? .95 : 0);
      pos.needsUpdate = true; mesh(base, mats.wood, parent);
    }
    doorwayWall(parent, bay, material);
    for (let i = 0; i < 20; i++) {
      const z = -5.6 + 19.6 * i / 19;
      if (z > bay.near && z < bay.far) continue;
      box(parent, wallX(side, z) - side * .025, .5, z, .07, .78, .07, mats.paleWood);
    }
    for (let z = -4.9; z < 14; z += 1.35) {
      const trim = new T.Group(); trim.position.set(wallX(side, z) - side * .035, 0, z);
      trim.rotation.y = -side * Math.atan2(1, .7 * Math.PI / 19.6 * Math.cos((z + 5.6) / 19.6 * Math.PI)); parent.add(trim);
      // A raised leaf frieze follows the wall above the doorway heads.
      for (const direction of [-1, 1]) {
        bezier([[0, 4.56, .025], [direction * .18, 4.83, .025], [direction * .58, 4.78, .025], [direction * .54, 4.63, .025]], .012, mats.gold, trim);
        leaf(trim, direction * .24, 4.63, .03, .20, direction * -.8, mats.cream);
      }
      ball(trim, 0, 4.64, .03, .026, mats.gold);
      if (z > bay.near - .48 && z < bay.far + .48) continue;
      box(trim, 0, .49, .025, .76, .52, .025, mats.paleWood);
      box(trim, 0, .49, .045, .67, .43, .016, mats.wood);
      curve([[-.30, .30, .065], [-.32, .48, .065], [-.30, .68, .065], [0, .71, .065], [.30, .68, .065], [.32, .48, .065], [.30, .30, .065], [0, .27, .065], [-.30, .30, .065]], .010, mats.gold, trim, 24);
      for (const direction of [-1, 1]) {
        bezier([[0, .32, .08], [direction * .16, .41, .08], [direction * .20, .58, .08], [0, .64, .08]], .011, mats.gold, trim);
        leaf(trim, direction * .08, .40, .09, .16, direction * -.6, mats.paleWood);
      }
    }
  }
  function floor(parent, upstairs) {
    const outline = new T.Shape();
    outline.moveTo(-4.5, -5.6); outline.lineTo(4.5, -5.6);
    outline.bezierCurveTo(5.6, 0, 5.6, 8, 4.5, 14); outline.lineTo(-4.5, 14);
    outline.bezierCurveTo(-5.6, 8, -5.6, 0, -4.5, -5.6);
    if (upstairs) { const hole = new T.Path(); hole.absarc(2.6, -3.65, 1.3, 0, Math.PI * 2, true); outline.holes.push(hole); }
    const geo = new T.ShapeGeometry(outline, 40); geo.rotateX(Math.PI / 2);
    mesh(geo, upstairs ? mats.paleWood : mats.sage, parent);
    const tile = new T.PlaneGeometry(.39, .39); tile.rotateX(-Math.PI / 2);
    const tiles = new T.InstancedMesh(tile, upstairs ? mats.paleWood : mats.cream, 1250);
    const dummy = new T.Object3D(); let count = 0;
    for (let z = -5.4; z < 12; z += .43) for (let x = -4.6; x <= 4.6; x += .43) {
      if (upstairs && Math.hypot(x - 2.6, z + 3.65) < 1.55) continue;
      if (Math.hypot(x, z - 1) < 2.1) continue;
      dummy.position.set(x, .008, z); dummy.rotation.y = 0;
      dummy.updateMatrix(); tiles.setMatrixAt(count, dummy.matrix);
      tiles.setColorAt(count++, new T.Color(upstairs ? ['#b48e5b', '#8f754e', '#c1a06e'][Math.floor(random() * 3)] : ['#bdc09a', '#d1c29a', '#a6b18b'][Math.floor(random() * 3)]));
    }
    tiles.count = count; tiles.instanceMatrix.needsUpdate = true; parent.add(tiles);
    for (const [r, material] of [[2.07, mats.ink], [1.96, mats.gold], [1.90, mats.moss], [1.77, mats.cream]]) {
      const medallion = mesh(new T.CircleGeometry(r, 72), material, parent, [0, .014 + (2.1 - r) * .04, 1]); medallion.rotation.x = -Math.PI / 2;
    }
    const ornament = new T.Group(); ornament.rotation.x = -Math.PI / 2; ornament.position.set(0, .065, 1); parent.add(ornament);
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      leaf(ornament, .75 * Math.sin(a), .75 * Math.cos(a), 0, .75, -a, i % 2 ? mats.sage : mats.rose);
      curve([[0, 0, .015], [.54 * Math.sin(a + .25), .54 * Math.cos(a + .25), .015], [1.46 * Math.sin(a), 1.46 * Math.cos(a), .015]], .012, mats.wood, ornament, 18);
      const inlay = new T.Group(); inlay.rotation.z = -a; ornament.add(inlay);
      curve([[0, .80, .02], [-.035, 1.08, .02], [0, 1.44, .02]], .009, mats.gold, inlay, 12);
      for (const side of [-1, 1]) {
        bezier([[0, 1.47, .018], [side * .36, 1.28, .018], [side * .36, 1.72, .018], [side * .13, 1.65, .018]], .009, mats.moss, inlay);
      }
      mesh(new T.CircleGeometry(.028, 10), mats.gold, ornament, [1.83 * Math.sin(a), 1.83 * Math.cos(a), .012]);
    }
    const center = mesh(new T.CircleGeometry(.30, 32), mats.gold, ornament, [0, 0, .03]);
    iris(ornament, 0, -.06, .05, .7);
    for (const side of [-1, 1]) {
      curve(Array.from({ length: 50 }, (_, i) => [side * (4.13 + .25 * Math.sin(i / 49 * Math.PI)), .02, -5.2 + i * .34]), .023, mats.gold, parent, 50);
      for (let i = 0; i < 12; i++) {
        const leafGroup = new T.Group(); leafGroup.position.set(side * 4.10, .04, -4.6 + i * 1.34); leafGroup.rotation.x = -Math.PI / 2; parent.add(leafGroup);
        leaf(leafGroup, 0, 0, 0, .44, side * .8, mats.moss);
      }
    }
  }
  function ceiling(parent, upstairs) {
    const shape = new T.Shape();
    shape.moveTo(-4.5, -5.6); shape.lineTo(4.5, -5.6);
    shape.bezierCurveTo(5.6, 0, 5.6, 8, 4.5, 14); shape.lineTo(-4.5, 14);
    shape.bezierCurveTo(-5.6, 8, -5.6, 0, -4.5, -5.6);
    if (!upstairs) { const hole = new T.Path(); hole.absarc(2.6, -3.65, 1.35, 0, Math.PI * 2, true); shape.holes.push(hole); }
    const geo = new T.ShapeGeometry(shape, 40); geo.rotateX(Math.PI / 2);
    mesh(geo, toon('#b6b093'), parent, [0, 5.04, 0]);
    for (const z of [-5.35, -.2, 5.2, 10.5]) {
      const path = Array.from({ length: 41 }, (_, i) => { const x = -4.5 + i * 9 / 40; return [x, 4.5 + .42 * Math.cos(x / 4.5 * Math.PI / 2), z]; });
      curve(path, .09, mats.wood, parent, 40);
      curve(path.map(([x, y, zz]) => [x, y - .09, zz]), .021, mats.gold, parent, 40);
      for (const side of [-1, 1]) {
        bezier([[side * 4.4, 4.55, z + .10], [side * 3.5, 4.05, z + .10], [side * 2.6, 4.80, z + .10], [side * 3.2, 4.68, z + .10]], .017, mats.gold, parent);
        leaf(parent, side * 3.7, 4.48, z + .11, .27, side * -1.2, mats.cream);
      }
    }
    for (const z of [2.4, 12.5]) {
      const rose = new T.Group(); rose.position.set(0, 5.015, z); rose.rotation.x = Math.PI / 2; parent.add(rose);
      mesh(new T.CircleGeometry(.59, 48), mats.plaster, rose);
      mesh(new T.TorusGeometry(.55, .018, 5, 40), mats.gold, rose, [0, 0, .012]);
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        leaf(rose, .10 * Math.sin(a), .10 * Math.cos(a), .025, .40, -a, mats.cream);
      }
      mesh(new T.TorusGeometry(.14, .025, 5, 24), mats.gold, rose, [0, 0, .045]);
    }
  }
  function portal(parent, id, x, z, yaw = 0) {
    const group = new T.Group(); group.position.set(x, 0, z); group.rotation.y = yaw; parent.add(group);
    // The casing surrounds an open recess, and its jambs meet the floor.
    const backing = new T.Shape();
    backing.moveTo(-1.175, 0); backing.lineTo(-.95, 0); backing.lineTo(-.95, 2.91);
    backing.absarc(0, 2.91, .95, Math.PI, 0, true);
    backing.lineTo(.95, 0); backing.lineTo(1.175, 0); backing.lineTo(1.175, 3.125);
    backing.absarc(0, 3.125, 1.175, 0, Math.PI, false); backing.closePath();
    panel(group, backing, mats.wood, .24, [0, 0, -.30]);
    box(group, -.975, 1.47, -.36, .07, 2.94, .78, mats.wood);
    box(group, .975, 1.47, -.36, .07, 2.94, .78, mats.wood);
    box(group, 0, .025, -.08, 2.03, .05, .55, mats.paleWood);
    box(group, 0, -.035, -.78, 1.9, .07, 1.56, mats.paleWood);
    archBorder(group, 2.24, 4.18, 0, .03, mats.ink, .14);
    archBorder(group, 2.19, 4.12, .04, .12, mats.paleWood, .10);
    archBorder(group, 2.08, 4.00, .04, .21, mats.gold, .021);
    for (const side of [-1, 1]) {
      bezier([[side * 1.12, .2, .07], [side * 1.8, 1.2, .02], [side * 1.14, 2.5, .04], [side * 1.08, 3.16, .05]], .10, mats.wood, group);
      bezier([[side * 1.12, .2, .17], [side * 1.8, 1.2, .12], [side * 1.14, 2.5, .14], [side * 1.08, 3.16, .15]], .017, mats.gold, group);
      leaf(group, side * 1.35, 1.1, .23, .48, side * -.6, mats.gold);
      iris(group, side * 1.08, 2.9, .25, .32);
      for (let i = 0; i < 4; i++) {
        leaf(group, side * 1.1, .45 + i * .48, .25, .20, side * -.5, mats.paleWood);
      }
    }
    const hinge = new T.Group(); hinge.position.set(-.88, 0, .12); hinge.userData.articulated = true; group.add(hinge);
    panel(hinge, archShape(1.78, 3.74), mats.wood, .105, [.88, .06, 0]);
    panel(hinge, archShape(1.42, 2.87), id === 'studio' || id === 'music' ? mats.blushGlass : mats.glass, .035, [.88, .63, .115]);
    archBorder(hinge, 1.45, 2.91, .60, .16, mats.gold, .025).position.x = .88;
    box(hinge, .88, .48, .135, 1.53, .15, .04, mats.paleWood);
    for (const side of [-1, 1]) {
      bezier([[.88, .64, .17], [.88 + side * .52, 1.12, .17], [.88 + side * .45, 2.11, .17], [.88, 3.45, .17]], .026, mats.ink, hinge);
      bezier([[.88, 1.14, .17], [.88 + side * .73, 1.68, .17], [.88 + side * .45, 2.64, .17], [.88 + side * .66, 2.91, .17]], .021, mats.wood, hinge);
      leaf(hinge, .88 + side * .22, 1.22, .18, .50, side * -.72, mats.amber);
      leaf(hinge, .88 + side * .3, 2.45, .18, .48, side * .55, mats.blushGlass);
      for (let i = 0; i < 3; i++) {
        const y = 1.30 + i * .49;
        bezier([[.88 + side * .08, y, .21], [.88 + side * .26, y + .08, .21], [.88 + side * .62, y + .19, .21], [.88 + side * .52, y + .34, .21]], .010, mats.gold, hinge);
      }
      bezier([[.88, .18, .15], [.88 + side * .40, .20, .15], [.88 + side * .60, .39, .15], [.88 + side * .30, .37, .15]], .014, mats.gold, hinge);
      leaf(hinge, .88 + side * .22, .20, .17, .15, side * -.75, mats.paleWood);
    }
    iris(hinge, .88, 2.54, .21, .8);
    box(hinge, .88, 1.97, .195, 1.37, .05, .03, mats.gold);
    curve([[.88, .63, .19], [.88, 1.35, .19], [.88, 2.20, .19], [.88, 3.45, .19]], .018, mats.gold, hinge);
    const escutcheon = ball(hinge, 1.52, 1.23, .22, .1, mats.gold); escutcheon.scale.set(.070, .17, .025);
    ball(hinge, 1.52, 1.24, .28, .067, mats.gold);
    box(hinge, 1.52, 1.13, .251, .018, .045, .012, mats.ink);
    const hit = mesh(new T.PlaneGeometry(2.25, 4.3), new T.MeshBasicMaterial({ visible: false, side: T.DoubleSide }), group, [0, 2.15, .28]);
    hit.userData.action = id; targets.push(hit);
    const marker = new T.Object3D(); marker.position.set(0, 1.68, .39); group.add(marker);
    const center = new T.Object3D(); center.position.set(0, 1.80, 1.9); group.add(center);
    const aim = new T.Object3D(); aim.position.set(0, 1.78, -.5); group.add(aim);
    // A dim scene behind the leaf gives the opening a real sense of depth.
    box(group, 0, 1.9, -1.5, 1.9, 3.8, .10, mats.moss);
    lamp(group, 0, 3, -.85);
    const shadow = mesh(new T.CircleGeometry(1.45, 32), mats.shadow, group, [0, .018, .55]); shadow.rotation.x = -Math.PI / 2; shadow.scale.y = .6;
    const link = links.find(a => a.dataset.room === id);
    doors.set(id, { group, hinge, marker, center, aim, link });
  }
  function stairs(parent, upstairs) {
    const g = new T.Group(); g.position.set(2.6, 0, -3.65); parent.add(g);
    const count = 26, start = .9, sweep = Math.PI * 2.25, rise = 5.2;
    const treadShape = new T.Shape(); const inner = .14, outer = 1.18, step = sweep / count;
    treadShape.moveTo(inner, 0); treadShape.lineTo(outer, 0); treadShape.absarc(0, 0, outer, 0, step, false);
    treadShape.lineTo(inner * Math.cos(step), inner * Math.sin(step)); treadShape.absarc(0, 0, inner, step, 0, true);
    const geo = new T.ExtrudeGeometry(treadShape, { depth: .07, bevelEnabled: false, curveSegments: 8 }); geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < count; i++) {
      const yy = i * rise / count - (upstairs ? rise : 0);
      const a = start + i * step;
      const tread = mesh(geo, i % 2 ? mats.paleWood : mats.wood, g, [0, yy, 0]); tread.rotation.y = -a;
      const xx = 1.21 * Math.cos(a), zz = -1.21 * Math.sin(a);
      curve([[xx, yy, zz], [xx, yy + .9, zz]], .017, mats.ink, g, 4);
      bezier([[xx, yy + .12, zz], [xx + .16 * Math.cos(a), yy + .35, zz - .16 * Math.sin(a)], [xx - .17 * Math.cos(a), yy + .64, zz + .17 * Math.sin(a)], [xx, yy + .88, zz]], .017, mats.gold, g);
      if (i % 3 === 0) {
        const spray = new T.Group(); spray.position.set(xx, yy + .45, zz); spray.rotation.y = Math.PI / 2 - a; g.add(spray);
        for (const side of [-1, 1]) leaf(spray, 0, 0, .025, .20, side * .72, mats.gold);
        ball(spray, 0, .10, .03, .027, mats.amber);
      }
    }
    const handrail = Array.from({ length: 120 }, (_, i) => {
      const t = i / 119, a = start + t * sweep;
      return [1.22 * Math.cos(a), t * rise + .93 - (upstairs ? rise : 0), -1.22 * Math.sin(a)];
    });
    curve(handrail, .045, mats.wood, g, 120);
    curve(handrail.map(([x, y, z]) => [x, y + .025, z]), .013, mats.gold, g, 120);
    mesh(new T.CylinderGeometry(.055, .095, rise + .6, 12), mats.gold, g, [0, rise / 2 - (upstairs ? rise : 0), 0]);
    if (upstairs) {
      const rim = mesh(new T.TorusGeometry(1.32, .055, 6, 64), mats.wood, g, [0, .02, 0]); rim.rotation.x = Math.PI / 2;
      const balcony = Array.from({ length: 60 }, (_, i) => { const a = .25 + i / 59 * 4.85; return [1.34 * Math.cos(a), .95, -1.34 * Math.sin(a)]; });
      curve(balcony, .048, mats.wood, g, 60);
      for (let i = 0; i < balcony.length; i += 4) {
        const [x, , z] = balcony[i]; curve([[x, .03, z], [x, .95, z]], .018, mats.gold, g, 4);
      }
    }
    const hit = mesh(new T.BoxGeometry(2.75, 3.5, 2.75), new T.MeshBasicMaterial({ visible: false }), g, [0, 1.2, 0]);
    hit.userData.action = 'stairs'; targets.push(hit);
    const marker = new T.Object3D(); marker.position.set(-.1, upstairs ? .9 : 1, 1.4); g.add(marker);
    g.userData.marker = marker; return g;
  }
  function windowArt(parent, x, z) {
    const g = new T.Group(); g.position.set(x, 1, z); parent.add(g);
    panel(g, archShape(2.50, 3.25), mats.wood, .1);
    panel(g, archShape(2.24, 3.06), mats.amber, .06, [0, .09, .12]);
    archBorder(g, 2.28, 3.1, .07, .20, mats.gold, .025);
    for (const side of [-1, 1]) {
      bezier([[0, .1, .23], [side * 1.08, .65, .23], [side * .75, 1.8, .23], [0, 3.1, .23]], .033, mats.wood, g);
      leaf(g, side * .22, .6, .24, .8, side * -.6, mats.glass);
      for (let i = 0; i < 3; i++) {
        bezier([[0, .5 + i * .55, .27], [side * .28, .6 + i * .55, .27], [side * .91, .9 + i * .48, .27], [side * .83, 1.2 + i * .48, .27]], .013, mats.gold, g);
        leaf(g, side * .65, 1.1 + i * .46, .26, .30, side * .62, mats.blushGlass);
      }
    }
    iris(g, 0, 1.8, .24, 1.5);
    curve([[0, .1, .23], [0, 1.55, .23], [0, 3.1, .23]], .028, mats.gold, g);
    glow(g, [0, 1.7, .35], 3.8);
    const light = new T.PointLight('#e6b875', 2.4, 10, 1.5); light.position.set(0, 2, 1); g.add(light);
  }
  function plant(parent, x, z) {
    mesh(new T.CylinderGeometry(.25, .16, .45, 12), mats.rose, parent, [x, .225, z]);
    for (const [y, radius] of [[.07, .176], [.37, .236], [.44, .249]]) {
      const ring = mesh(new T.TorusGeometry(radius, .013, 5, 20), mats.gold, parent, [x, y, z]); ring.rotation.x = Math.PI / 2;
    }
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, ornament = new T.Group();
      ornament.position.set(x + .22 * Math.cos(a), .12, z + .22 * Math.sin(a)); ornament.rotation.y = Math.PI / 2 - a; parent.add(ornament);
      leaf(ornament, 0, 0, 0, .18, 0, mats.cream);
    }
    const g = new T.Group(); g.position.set(x, .43, z); parent.add(g);
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4, h = 1.2 + random() * .5;
      const stem = [[0, 0, 0], [.2 * Math.cos(a), h * .45, .2 * Math.sin(a)], [.43 * Math.cos(a), h, .43 * Math.sin(a)]];
      curve(stem, .014, mats.ink, g, 12);
      const f = leaf(g, .2 * Math.cos(a), h * .45, .2 * Math.sin(a), .7, -.7, mats.moss); f.rotation.y = -a;
      const f2 = leaf(g, .43 * Math.cos(a), h * .8, .43 * Math.sin(a), .55, .3, mats.sage); f2.rotation.y = a;
    }
  }
  const floors = {};
  for (const [id, upstairs] of [['ground', false], ['first', true]]) {
    const group = new T.Group(); group.position.y = upstairs ? 5.2 : 0; scene.add(group);
    floor(group, upstairs); wallSurface(group, -1, upstairs ? upperWallMaterial : wallMaterial, 1, 5.04); wallSurface(group, 1, upstairs ? upperWallMaterial : wallMaterial, 1, 5.04); ceiling(group, upstairs);
    if (upstairs) {
      const backGeometry = new T.PlaneGeometry(9.1, 5.04), uv = backGeometry.attributes.uv, pos = backGeometry.attributes.position;
      for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + 4.5) / 19.6, (pos.getY(i) + 2.52 - 1) / 4.04);
      mesh(backGeometry, upperWallMaterial, group, [0, 2.52, -5.6]);
      box(group, 0, .5, -5.6, 9.1, 1, .12, mats.wood);
      curve([[-4.5, 1.05, -5.5], [0, 1.05, -5.5], [4.5, 1.05, -5.5]], .027, mats.gold, group);
    } else doorwayWall(group, { x: -.95, z: -5.6, yaw: 0 }, wallMaterial, -3.55, 5.45);
    const leftBay = sideDoorBay(-1), rightBay = sideDoorBay(1);
    portal(group, upstairs ? 'music' : 'studio', leftBay.x, leftBay.z, leftBay.yaw);
    portal(group, upstairs ? 'laboratory' : 'salon', rightBay.x, rightBay.z, rightBay.yaw);
    if (upstairs) windowArt(group, -.95, -5.38);
    else portal(group, 'garden', -.95, -5.6);
    const stair = stairs(group, upstairs);
    for (const side of [-1, 1]) {
      const mount = new T.Group(); mount.position.set(wallX(side, 0), 0, 0);
      mount.rotation.y = -side * Math.atan2(1, .7 * Math.PI / 19.6 * Math.cos(5.6 / 19.6 * Math.PI));
      group.add(mount); lamp(mount, 0, 2.9, 0, true);
    }
    lamp(group, 0, 3.6, 2.4); lamp(group, 0, 3.6, 12.5);
    plant(group, -2.23, -4.5); plant(group, 4.02, 1.8);
    // Whiplash ribs sweep from the dados into an airy central arch.
    for (const side of [-1, 1]) {
      bezier([[side * 4.50, .15, 1.4], [side * 4.8, 2.6, 1.4], [side * 4.3, 4.6, 1.4], [side * 1.0, 4.85, 1.4]], .11, mats.wood, group);
      bezier([[side * 4.50, .15, 1.54], [side * 4.8, 2.6, 1.54], [side * 4.3, 4.6, 1.54], [side * 1.0, 4.85, 1.54]], .024, mats.gold, group);
      iris(group, side * 4.32, 3.15, 1.6, .42);
    }
    curve([[-1, 4.85, 1.4], [0, 4.99, 1.4], [1, 4.85, 1.4]], .11, mats.wood, group);
    curve([[-1, 4.85, 1.54], [0, 4.99, 1.54], [1, 4.85, 1.54]], .024, mats.gold, group);
    for (const side of [-1, 1]) {
      bezier([[0, 4.94, 1.58], [side * .55, 4.1, 1.58], [side * 1.4, 4.65, 1.58], [side * .8, 4.76, 1.58]], .024, mats.gold, group);
      leaf(group, side * .64, 4.44, 1.62, .42, side * -.95, mats.gold);
    }
    floors[id] = { group, stair };
  }
  // Combine static ornament by material. Door leaves retain their own hinge.
  function combineStatic(root) {
    root.updateWorldMatrix(true, true);
    const inverse = root.matrixWorld.clone().invert(), buckets = new Map();
    const visit = node => {
      if (node !== root && node.userData.articulated) return;
      if (node.isMesh && !node.isInstancedMesh && node.material.visible && !Array.isArray(node.material)) {
        const key = node.material.uuid;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(node);
      }
      for (const child of node.children) visit(child);
    };
    visit(root);
    for (const objects of buckets.values()) {
      if (objects.length < 2) continue;
      const transformed = objects.map(object => {
        const geo = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
        geo.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse, object.matrixWorld));
        return geo;
      });
      const count = transformed.reduce((sum, geo) => sum + geo.attributes.position.count, 0);
      const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3), uvs = new Float32Array(count * 2);
      let offset = 0;
      for (const geo of transformed) {
        positions.set(geo.attributes.position.array, offset * 3);
        normals.set(geo.attributes.normal.array, offset * 3);
        if (geo.attributes.uv) uvs.set(geo.attributes.uv.array, offset * 2);
        offset += geo.attributes.position.count; geo.dispose();
      }
      const merged = new T.BufferGeometry();
      merged.setAttribute('position', new T.BufferAttribute(positions, 3));
      merged.setAttribute('normal', new T.BufferAttribute(normals, 3));
      merged.setAttribute('uv', new T.BufferAttribute(uvs, 2));
      merged.computeBoundingSphere();
      mesh(merged, objects[0].material, root);
      for (const object of objects) object.removeFromParent();
    }
  }
  for (const { group } of Object.values(floors)) combineStatic(group);
  for (const { hinge } of doors.values()) combineStatic(hinge);
  // A compact public state makes the scene inspectable without exposing mutable objects.
  const state = { floor: floorFromURL(), yaw: 0, pitch: 0, transition: null, frame: 0, lastTime: 0, renders: 0, hovered: null, paused: false };
  let portrait = false, baseZ = 8.1;
  let position = v(0, 1.86, baseZ), lookAt = v(0, 2.0, -3.2);
  const basePosition = floor => v(0, 1.86 + (floor === 'first' ? 5.2 : 0), baseZ);
  const baseAim = floor => v(0, 2.05 + (floor === 'first' ? 5.2 : 0), -3.2);
  function visibleFloor(floor) {
    for (const [id, { group }] of Object.entries(floors)) group.visible = id === floor;
  }
  function applyCamera() {
    camera.position.copy(position);
    const direction = lookAt.clone().sub(position).normalize();
    direction.applyAxisAngle(v(0, 1, 0), state.yaw);
    const right = v(1, 0, 0).applyAxisAngle(v(0, 1, 0), state.yaw);
    direction.applyAxisAngle(right, state.pitch);
    camera.lookAt(position.clone().add(direction));
    camera.updateMatrixWorld();
  }
  function projectedControls() {
    const rect = world.getBoundingClientRect();
    scene.updateMatrixWorld();
    for (const link of links) {
      if (link.hidden) continue;
      const marker = link.dataset.room ? doors.get(link.dataset.room).marker : floors[state.floor].stair.userData.marker;
      const p = marker.getWorldPosition(v(0, 0, 0)).project(camera);
      const onscreen = p.z > -1 && p.z < 1 && Math.abs(p.x) < .95 && Math.abs(p.y) < .92;
      link.style.visibility = onscreen ? '' : 'hidden';
      link.style.setProperty('--x', `${(p.x * .5 + .5) * rect.width}px`);
      link.style.setProperty('--y', `${(-p.y * .5 + .5) * rect.height}px`);
    }
  }
  function render(now = performance.now()) {
    state.frame = 0;
    if (state.paused) return;
    if (state.transition) {
      const tr = state.transition, t = Math.min(1, (now - tr.start) / tr.duration);
      const smooth = value => value * value * (3 - 2 * value);
      const eased = smooth(t);
      position.lerpVectors(tr.from, tr.to, eased); lookAt.lerpVectors(tr.aimFrom, tr.aimTo, eased);
      if (tr.floor && !reduceMotion.matches) {
        const ascending = tr.floor === 'first';
        const point = u => {
          const fraction = ascending ? u : 1 - u;
          const a = .9 + fraction * Math.PI * 2.25;
          return v(2.6 + .82 * Math.cos(a), 1.6 + fraction * 5.2, -3.65 - .82 * Math.sin(a));
        };
        const stairAim = u => v(-.95, point(u).y + .12, -5.5);
        if (t < .25) { position.lerpVectors(tr.from, point(0), smooth(t / .25)); lookAt.lerpVectors(tr.aimFrom, stairAim(0), smooth(t / .25)); }
        else if (t < .75) { const u = smooth((t - .25) / .5); position.copy(point(u)); lookAt.copy(stairAim(u)); }
        else { position.lerpVectors(point(1), tr.to, smooth((t - .75) / .25)); lookAt.lerpVectors(stairAim(1), tr.aimTo, smooth((t - .75) / .25)); }
      }
      if (tr.door) tr.door.hinge.rotation.y = -Math.PI * .48 * Math.min(1, t * 1.4);
      if (tr.floor && t >= .5 && state.floor !== tr.floor) { state.floor = tr.floor; visibleFloor(tr.floor); }
      if (t >= 1) {
        state.transition = null;
        if (tr.floor) { visibleFloor(tr.floor); floors.first.stair.visible = true; }
        if (tr.href) { saveReturn(tr.href); location.assign(tr.href); return; }
        body.dataset.state = 'ready';
      }
    }
    applyCamera(); projectedControls(); renderer.render(scene, camera); state.renders++;
    state.lastTime = now;
    if (state.transition) invalidate();
  }
  function invalidate() { if (!state.frame && !state.paused) state.frame = requestAnimationFrame(render); }
  function transition(to, aimTo, options = {}) {
    state.yaw = state.pitch = 0;
    state.transition = { from: position.clone(), to, aimFrom: lookAt.clone(), aimTo, start: performance.now(), duration: reduceMotion.matches ? 1 : 1100, ...options };
    invalidate();
  }
  requestFloor = () => {
    if (state.paused || body.dataset.state === 'fallback' || body.dataset.state === 'entering') return;
    const floor = floorFromURL();
    if (floor === state.floor && !state.transition) return;
    const first = floor === 'first';
    transition(basePosition(floor), baseAim(floor), { floor, duration: reduceMotion.matches ? 1 : 2400 });
    world.setAttribute('aria-label', first ? 'Art Nouveau upstairs landing at twilight' : 'Art Nouveau entrance hall at twilight');
  };
  function resize() {
    const { width, height } = world.getBoundingClientRect();
    portrait = width / height < .8;
    baseZ = portrait ? 12 : 8.1;
    camera.aspect = width / height;
    camera.fov = portrait ? 78 : 56;
    camera.updateProjectionMatrix(); renderer.setSize(width, height);
    if (!state.transition && body.dataset.state !== 'entering') { position.copy(basePosition(state.floor)); lookAt.copy(baseAim(state.floor)); }
    invalidate();
  }
  function saveReturn(href) {
    const room = new URL(href, location.href).pathname;
    const floor = ['/musical-mining/', '/chemical-rakoon/'].includes(room) ? 'first' : 'ground';
    try { sessionStorage.setItem('mottet-apartment-return', JSON.stringify({ hall: `/apartment.html#${floor}-floor`, room })); } catch { /* Navigation still works without storage. */ }
  }
  function enterDoor(id, event) {
    if (event && (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.button > 0)) return;
    if (state.transition) { event?.preventDefault(); return; }
    if (body.dataset.state !== 'ready') return;
    event?.preventDefault();
    const door = doors.get(id);
    if (reduceMotion.matches) { saveReturn(door.link.href); location.assign(door.link.href); return; }
    body.dataset.state = 'entering';
    scene.updateMatrixWorld();
    transition(door.center.getWorldPosition(v(0, 0, 0)), door.aim.getWorldPosition(v(0, 0, 0)), { door, href: door.link.href, duration: 1000 });
  }
  for (const link of links) {
    const id = link.dataset.room;
    if (!id) continue;
    link.addEventListener('click', event => enterDoor(id, event));
    const hover = active => { state.hovered = active ? id : null; link.classList.toggle('is-hovered', active); };
    link.addEventListener('pointerenter', () => hover(true)); link.addEventListener('pointerleave', () => hover(false));
    link.addEventListener('focus', () => hover(true)); link.addEventListener('blur', () => hover(false));
  }
  plan.querySelectorAll('a:not([href^="#"])').forEach(link => link.addEventListener('click', event => {
    if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) saveReturn(link.href);
  }));
  reset.hidden = false;
  reset.addEventListener('click', () => {
    if (body.dataset.state === 'entering') return;
    transition(basePosition(state.floor), baseAim(state.floor), { duration: reduceMotion.matches ? 1 : 420 });
  });
  function hitAt(x, y) {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set((x - r.left) / r.width * 2 - 1, -(y - r.top) / r.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(targets.filter(object => {
      let parent = object; while (parent) { if (!parent.visible) return false; parent = parent.parent; } return true;
    }), false)[0]?.object.userData.action;
  }
  let drag = null;
  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || state.transition || plan.open) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw: state.yaw, pitch: state.pitch, moved: false };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (drag && drag.id === event.pointerId) {
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (Math.hypot(dx, dy) > 9) drag.moved = true;
      if (drag.moved) {
        state.yaw = T.MathUtils.clamp(drag.yaw - dx * .0024, -.46, .46);
        state.pitch = T.MathUtils.clamp(drag.pitch - dy * .0024, -.18, .24); invalidate();
      }
    } else if (event.pointerType === 'mouse' && !state.transition) {
      const action = hitAt(event.clientX, event.clientY);
      canvas.style.cursor = action ? 'pointer' : 'grab';
      for (const link of links) link.classList.toggle('is-hovered', action === (link.dataset.room || 'stairs'));
    }
  });
  canvas.addEventListener('pointerup', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const moved = drag.moved; drag = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (moved) return;
    const action = hitAt(event.clientX, event.clientY);
    if (action === 'stairs') location.hash = state.floor === 'first' ? 'ground-floor' : 'first-floor';
    else if (action) enterDoor(action, event);
  });
  canvas.addEventListener('pointercancel', () => { drag = null; });
  canvas.addEventListener('lostpointercapture', () => { drag = null; });
  window.addEventListener('keydown', event => {
    if (plan.open || state.transition || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'ArrowLeft') state.yaw = Math.min(.46, state.yaw + .06);
    else if (event.key === 'ArrowRight') state.yaw = Math.max(-.46, state.yaw - .06);
    else if (event.key === 'ArrowUp') state.pitch = Math.min(.24, state.pitch + .04);
    else if (event.key === 'ArrowDown') state.pitch = Math.max(-.18, state.pitch - .04);
    else if (event.key === 'Escape') { state.yaw = state.pitch = 0; }
    else return;
    event.preventDefault(); invalidate();
  });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    state.paused = true;
    if (state.frame) cancelAnimationFrame(state.frame);
    state.frame = 0; state.transition = null;
    body.dataset.state = 'fallback'; reset.hidden = true;
    for (const link of links) { link.style.visibility = ''; link.style.removeProperty('--x'); link.style.removeProperty('--y'); }
  });
  canvas.addEventListener('webglcontextrestored', () => {
    state.paused = false; state.transition = null; state.yaw = state.pitch = 0;
    state.floor = floorFromURL(); visibleFloor(state.floor);
    for (const door of doors.values()) door.hinge.rotation.y = 0;
    position.copy(basePosition(state.floor)); lookAt.copy(baseAim(state.floor));
    body.dataset.state = 'ready'; reset.hidden = false; invalidate();
  });
  document.addEventListener('visibilitychange', () => {
    state.paused = document.hidden;
    if (state.paused) { if (state.frame) cancelAnimationFrame(state.frame); state.frame = 0; }
    else invalidate();
  });
  window.addEventListener('pageshow', () => {
    state.transition = null; body.dataset.state = 'ready'; state.floor = floorFromURL();
    updateFloorControls(); visibleFloor(state.floor);
    for (const door of doors.values()) door.hinge.rotation.y = 0;
    position.copy(basePosition(state.floor)); lookAt.copy(baseAim(state.floor)); invalidate();
  });
  window.addEventListener('resize', resize);
  window.apartmentScene = Object.freeze({
    inspect: () => ({ floor: state.floor, yaw: state.yaw, pitch: state.pitch, moving: !!state.transition, state: body.dataset.state, draws: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, renders: state.renders, framePending: !!state.frame, revision: T.REVISION }),
  });
  visibleFloor(state.floor); resize();
  position.copy(basePosition(state.floor)); lookAt.copy(baseAim(state.floor));
  body.dataset.state = 'ready'; render();
  performance.mark('apartment-ready');
}
