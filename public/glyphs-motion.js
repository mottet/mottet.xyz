'use strict';

// Glyphs: motion and sound. A particle canvas over the table, keyed by
// element so a spell added in the forge gets a trail and a burst of its own
// colour; ambient dust and candle light in the arena; shake and flash on the
// clash; and a handful of sounds synthesised on the spot, so nothing is
// fetched. Everything here respects prefers-reduced-motion, and nothing
// here ever draws a glyph shape.
window.GlyphsMotion = (() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const TAU = Math.PI * 2;

  // Element profiles: how its particles look and fall. Unknown elements get
  // a profile built from their colour.
  const PROFILES = {
    fire: { colours: ['#fff1c0', '#ffd27a', '#ffa14a', '#d8632a', '#8a2d12'], gravity: -150, drag: .93, size: [1.5, 4.5], life: [.5, 1.2], shape: 'ember', glow: true },
    water: { colours: ['#e4f3f7', '#b9e2ee', '#6fb0c8', '#4f8aa3', '#2a5b70'], gravity: 460, drag: .992, size: [1.5, 3.5], life: [.5, 1.1], shape: 'drop' },
    earth: { colours: ['#d9d0b8', '#a39a86', '#7a7262', '#4a453a'], gravity: 540, drag: .985, size: [2, 5], life: [.5, 1.1], shape: 'chip' },
    air: { colours: ['#e6f0c8', '#cfe0a8', '#9ec27a', '#6b8a52'], gravity: -30, drag: .988, size: [1, 2.6], life: [.8, 1.6], shape: 'streak', swirl: true },
    metal: { colours: ['#ffffff', '#e6ebf1', '#b4c0cc', '#ffd27a'], gravity: 320, drag: .975, size: [1, 2.4], life: [.25, .65], shape: 'spark', glow: true },
    brass: { colours: ['#fff6d6', '#e2c98a', '#c9ab6a', '#b08f4f'], gravity: 40, drag: .96, size: [1, 2.6], life: [.4, 1], shape: 'spark', glow: true },
    rose: { colours: ['#f1c9c4', '#b98b86', '#8a5f5b'], gravity: 220, drag: .97, size: [1.2, 2.8], life: [.4, .9], shape: 'ember' },
    ink: { colours: ['#1f3329', '#2f4a3c', '#3f5f4e'], gravity: -70, drag: .96, size: [1.2, 2.6], life: [.5, 1], shape: 'ember' },
    ash: { colours: ['#9a9186', '#6f685e', '#4a4540'], gravity: -25, drag: .985, size: [1, 2.4], life: [1.2, 2.6], shape: 'chip', swirl: true },
    dust: { colours: ['#efe2a8', '#d9cfae'], gravity: -6, drag: 1, size: [.6, 1.6], life: [4, 8], shape: 'mote', swirl: true }
  };
  const colours = {};
  const register = (id, colour) => { colours[id] = colour; };
  const shade = (hex, k) => {
    const n = parseInt(hex.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * k + (k > 1 ? (k - 1) * 120 : 0)))));
    return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  };
  const profile = kind => {
    if (PROFILES[kind]) return PROFILES[kind];
    const base = colours[kind] || '#9aa08f';
    return PROFILES[kind] = { colours: [shade(base, 1.6), shade(base, 1.2), base, shade(base, .6)], gravity: 120, drag: .97, size: [1.5, 3.5], life: [.5, 1.1], shape: 'ember', glow: true };
  };

  // The canvas lies over the whole table, so the sheet and the arena share
  // one layer and one loop.
  let host = null, canvas = null, ctx = null, dpr = 1, width = 0, height = 0;
  let particles = [], emitters = [], running = false, last = 0, ambientOn = false, ambientClock = 0;
  const mount = element => {
    host = element;
    canvas = document.createElement('canvas');
    canvas.className = 'motion-layer';
    canvas.setAttribute('aria-hidden', 'true');
    host.append(canvas);
    ctx = canvas.getContext('2d');
    resize();
    if (window.ResizeObserver) new ResizeObserver(resize).observe(host);
    window.addEventListener('resize', resize);
  };
  const resize = () => {
    if (!host) return;
    const box = host.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = box.width; height = box.height;
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
  };
  // A point in the layer, from an element and a fraction of its box.
  const at = (element, fx = .5, fy = .5) => {
    if (!host || !element) return [width / 2, height / 2];
    const r = element.getBoundingClientRect(), h = host.getBoundingClientRect();
    return [r.left - h.left + r.width * fx, r.top - h.top + r.height * fy];
  };
  const radiusOf = element => { const r = element.getBoundingClientRect(); return Math.min(r.width, r.height) / 2; };

  const spawn = (x, y, kind, opts = {}) => {
    const p = profile(kind);
    const angle = opts.angle === undefined ? rand(0, TAU) : opts.angle + rand(-(opts.arc || .4), opts.arc || .4);
    const speed = rand(opts.speed ? opts.speed * .3 : 20, opts.speed || 120);
    const r = opts.radius ? rand(0, opts.radius) : 0, ra = rand(0, TAU);
    particles.push({
      x: x + Math.cos(ra) * r, y: y + Math.sin(ra) * r,
      vx: Math.cos(angle) * speed + (opts.vx || 0), vy: Math.sin(angle) * speed + (opts.vy || 0),
      life: rand(p.life[0], p.life[1]) * (opts.lifeScale || 1), age: 0,
      size: rand(p.size[0], p.size[1]) * (opts.sizeScale || 1), colour: pick(p.colours), p,
      spin: rand(-6, 6), rot: rand(0, TAU), phase: rand(0, TAU)
    });
  };
  const wake = () => { if (!running && !reduced.matches) { running = true; last = performance.now(); requestAnimationFrame(loop); } };
  // A burst: n particles from a point, in every direction or along one.
  const burst = (x, y, kind, n = 24, opts = {}) => {
    if (reduced.matches || !ctx) return;
    for (let i = 0; i < n; i++) spawn(x, y, kind, opts);
    wake();
  };
  // An emitter: a stream from a point or an element, for a while.
  const emit = ({ from, follow, fx = .5, fy = .5, kind, rate = 30, duration = 1, ...opts }) => {
    if (reduced.matches || !ctx) return null;
    const e = { from, follow, fx, fy, kind, rate, left: duration, acc: 0, opts };
    emitters.push(e);
    wake();
    return e;
  };
  const stop = e => { if (e) e.left = 0; };
  const clear = () => { particles = []; emitters = []; if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height); };

  // Ambient: dust drifting through the candle light of the arena.
  let ambientArea = null;
  const ambient = (on, area) => { ambientOn = on; if (area) ambientArea = area; if (on) wake(); };
  const breatheAmbient = dt => {
    if (!ambientOn || !ambientArea || document.hidden || particles.length > 260) return;
    ambientClock += dt;
    if (ambientClock < .18) return;
    ambientClock = 0;
    const [x, y] = at(ambientArea, rand(.08, .92), rand(.2, .95));
    spawn(x, y, 'dust', { speed: 10, lifeScale: 1 });
  };

  const draw = p => {
    const t = p.age / p.life, fade = t < .15 ? t / .15 : 1 - (t - .15) / .85;
    const alpha = Math.max(0, Math.min(1, fade)) * (p.p.shape === 'mote' ? .55 : .95);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.colour; ctx.strokeStyle = p.colour;
    const s = p.size * (p.p.shape === 'ember' ? 1 - t * .5 : 1);
    switch (p.p.shape) {
      case 'drop': {
        const a = Math.atan2(p.vy, p.vx), len = Math.min(4, Math.hypot(p.vx, p.vy) / 90);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(0, 0, s * (1 + len), s, 0, 0, TAU); ctx.fill(); ctx.restore();
        break;
      }
      case 'chip':
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-s, -s * .6, s * 2, s * 1.2); ctx.restore();
        break;
      case 'streak': case 'spark': {
        const k = p.p.shape === 'spark' ? .06 : .05;
        ctx.lineWidth = s; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * k, p.y - p.vy * k); ctx.stroke();
        break;
      }
      case 'mote':
        ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, TAU); ctx.fill();
        break;
      default:
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(.3, s), 0, TAU); ctx.fill();
    }
  };
  const loop = now => {
    if (!running) return;
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    for (const e of emitters) {
      e.left -= dt;
      if (e.left <= 0) continue;
      e.acc += e.rate * dt;
      const [x, y] = e.follow ? at(e.follow, e.fx, e.fy) : (typeof e.from === 'function' ? e.from() : e.from);
      while (e.acc >= 1) { e.acc -= 1; spawn(x, y, e.kind, e.opts); }
    }
    emitters = emitters.filter(e => e.left > 0);
    breatheAmbient(dt);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.scale(dpr, dpr);
    const live = [];
    for (const p of particles) {
      p.age += dt;
      if (p.age >= p.life) continue;
      p.vy += p.p.gravity * dt;
      if (p.p.swirl) { p.vx += Math.sin(now / 400 + p.phase) * 40 * dt; p.vy += Math.cos(now / 530 + p.phase) * 20 * dt; }
      const drag = Math.pow(p.p.drag, dt * 60);
      p.vx *= drag; p.vy *= drag;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt;
      if (p.y > height + 10 || p.x < -10 || p.x > width + 10) continue;
      live.push(p);
    }
    particles = live;
    // Glowing kinds add their light; the rest sit on top of the table.
    ctx.globalCompositeOperation = 'source-over';
    for (const p of particles) if (!p.p.glow) draw(p);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) if (p.p.glow) draw(p);
    ctx.restore();
    if (particles.length || emitters.length || ambientOn) requestAnimationFrame(loop);
    else { running = false; ctx.clearRect(0, 0, canvas.width, canvas.height); }
  };
  reduced.addEventListener('change', () => { if (reduced.matches) { clear(); running = false; } });

  // Shake and flash: the table takes the clash.
  const shake = (element, strength = 6, ms = 320) => {
    if (reduced.matches || !element.animate) return;
    const frames = [];
    for (let i = 0; i <= 8; i++) {
      const k = (1 - i / 8) * strength, a = i % 2 ? 1 : -1;
      frames.push({ transform: i === 8 ? 'translate(0,0)' : `translate(${(a * k).toFixed(1)}px, ${(rand(-.5, .5) * k).toFixed(1)}px)` });
    }
    element.animate(frames, { duration: ms, easing: 'linear' });
  };
  const flash = (element, ms = 260, peak = .9) => {
    if (reduced.matches || !element.animate) return;
    element.animate([{ opacity: 0 }, { opacity: peak, offset: .15 }, { opacity: 0 }], { duration: ms, easing: 'ease-out' });
  };
  const pulse = (element, scale = 1.12, ms = 420) => {
    if (reduced.matches || !element.animate) return;
    element.animate([{ transform: 'scale(1)' }, { transform: `scale(${scale})`, offset: .35 }, { transform: 'scale(1)' }], { duration: ms, easing: 'ease-out' });
  };
  const pop = (element, scale = 1.25, ms = 220) => {
    if (reduced.matches || !element.animate) return;
    element.animate([{ transform: `scale(${scale})` }, { transform: 'scale(1)' }], { duration: ms, easing: 'cubic-bezier(.2,.8,.3,1)' });
  };

  // Sound, synthesised. The context opens on the first gesture; a page
  // without Web Audio stays silent and plays on.
  const SOUND_KEY = 'glyphs-sound';
  let audio = null, master = null, noiseBuffer = null;
  let enabled = (() => { try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; } })();
  const ensureAudio = () => {
    if (audio) { if (audio.state === 'suspended') audio.resume().catch(() => {}); return audio; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audio = new AC();
    master = audio.createGain(); master.gain.value = .5; master.connect(audio.destination);
    noiseBuffer = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return audio;
  };
  const env = (node, start, gain, attack, dur) => {
    node.gain.setValueAtTime(.0001, start);
    node.gain.linearRampToValueAtTime(gain, start + attack);
    node.gain.exponentialRampToValueAtTime(.0001, start + dur);
  };
  const tone = (freq, { type = 'sine', dur = .3, gain = .2, to = freq, delay = 0, attack = .005 } = {}) => {
    const t = audio.currentTime + delay, o = audio.createOscillator(), g = audio.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    env(g, t, gain, attack, dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + .05);
  };
  const noise = ({ dur = .3, gain = .2, type = 'bandpass', freq = 1000, to = freq, q = 1, delay = 0, attack = .01 } = {}) => {
    const t = audio.currentTime + delay, s = audio.createBufferSource(), f = audio.createBiquadFilter(), g = audio.createGain();
    s.buffer = noiseBuffer; s.loop = true;
    f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    env(g, t, gain, attack, dur);
    s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + dur + .05);
  };
  // Each element strikes with its own voice.
  const VOICES = {
    fire: () => { noise({ dur: .45, freq: 900, to: 2600, q: .7, gain: .35 }); noise({ dur: .2, type: 'highpass', freq: 3000, gain: .15, delay: .05 }); },
    water: () => { noise({ dur: .5, freq: 500, to: 180, q: 1.2, gain: .35 }); tone(420, { dur: .35, to: 160, gain: .12, type: 'sine' }); },
    earth: () => { tone(95, { dur: .4, to: 38, gain: .55 }); noise({ dur: .25, type: 'lowpass', freq: 500, to: 120, gain: .4 }); },
    air: () => { noise({ dur: .6, freq: 1600, to: 600, q: 2.5, gain: .3, attack: .08 }); },
    metal: () => { tone(1900, { dur: .35, to: 1500, gain: .12, type: 'triangle' }); tone(2860, { dur: .25, to: 2400, gain: .07, type: 'triangle' }); noise({ dur: .12, type: 'highpass', freq: 4000, gain: .25 }); }
  };
  const SOUNDS = {
    ink: () => { tone(1320, { dur: .18, gain: .05, type: 'sine' }); tone(1980, { dur: .14, gain: .03, delay: .04 }); },
    seal: () => { noise({ dur: .35, freq: 600, to: 2800, q: .8, gain: .22 }); tone(880, { dur: .4, to: 1320, gain: .06, type: 'triangle', delay: .05 }); },
    cast: () => { noise({ dur: .55, freq: 300, to: 1800, q: .6, gain: .25, attack: .12 }); },
    clash: () => { noise({ dur: .22, type: 'lowpass', freq: 1400, to: 200, gain: .5 }); tone(110, { dur: .3, to: 40, gain: .5 }); noise({ dur: .5, type: 'bandpass', freq: 2200, to: 400, q: .5, gain: .18, delay: .03 }); },
    strike: el => { (VOICES[el] || VOICES.earth)(); },
    wound: () => { tone(140, { dur: .28, to: 50, gain: .5 }); noise({ dur: .07, type: 'highpass', freq: 1800, gain: .3 }); },
    aside: () => { tone(988, { dur: .55, gain: .12, type: 'triangle' }); tone(1480, { dur: .45, gain: .08, type: 'triangle', delay: .02 }); tone(2217, { dur: .35, gain: .04, type: 'sine', delay: .03 }); },
    worn: () => { tone(660, { dur: .3, to: 520, gain: .1, type: 'triangle' }); noise({ dur: .15, type: 'bandpass', freq: 900, gain: .2 }); },
    broken: () => { noise({ dur: .35, type: 'highpass', freq: 2400, to: 900, gain: .35 }); tone(740, { dur: .3, to: 300, gain: .12, type: 'square' }); tone(1110, { dur: .2, to: 500, gain: .06, type: 'triangle', delay: .02 }); },
    ring: () => { [523, 659, 784].forEach((f, i) => tone(f, { dur: .35, gain: .09, type: 'triangle', delay: i * .07 })); },
    death: el => { tone(180, { dur: 1.5, to: 28, gain: .4 }); noise({ dur: 1.3, type: 'lowpass', freq: 400, to: 60, gain: .25 }); window.setTimeout(() => { if (audio && VOICES[el]) VOICES[el](); }, 120); },
    tick: () => { tone(1500, { dur: .05, gain: .05, type: 'square' }); },
    win: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, { dur: .5, gain: .1, type: 'triangle', delay: i * .12 })); },
    lose: () => { [392, 330, 262, 196].forEach((f, i) => tone(f, { dur: .6, gain: .1, type: 'triangle', delay: i * .16 })); }
  };
  const play = (name, arg) => {
    if (!enabled || !SOUNDS[name]) return;
    try {
      if (!ensureAudio()) return;
      if (audio.state === 'running') { SOUNDS[name](arg); return; }
      // Just after a gesture the context is still waking; a sound that
      // would arrive much later is dropped instead.
      const asked = performance.now();
      audio.resume().then(() => { if (performance.now() - asked < 400) SOUNDS[name](arg); }).catch(() => {});
    } catch { /* silence is fine */ }
  };
  const unlock = () => { if (enabled) ensureAudio(); };
  const setSound = on => { enabled = on; try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch { /* no memory */ } if (on) ensureAudio(); };
  const soundOn = () => enabled;

  return { reduced, mount, at, radiusOf, burst, emit, stop, clear, ambient, shake, flash, pulse, pop, register, play, unlock, setSound, soundOn };
})();
