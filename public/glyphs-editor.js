'use strict';

// The forge: add and change elements, relations, spells and reactions, try
// every change against the rules at once, and write the data file back.
(() => {
  const Rules = window.GlyphsSpells, R = window.GlyphsRecognizer, W = window.GlyphsWheel;
  if (!Rules || !R || !W) return;
  const el = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const clone = v => JSON.parse(JSON.stringify(v));
  const pathOf = (strokes, size = 100, inset = 8) => strokes.map(s => 'M' + s.map(p => p.map(v => (inset + v * (size - 2 * inset)).toFixed(1)).join(' ')).join('L')).join('');
  const KINDS = ['attack', 'barrier', 'defence'];
  const CYCLE = ['none', 'beats', 'beaten', 'quench', 'pass'];
  const TOKEN_KEY = 'glyphs-edit-token';

  let saved = clone(Rules.data), data = clone(saved), rules = Rules, problems = [], selected = null, padTarget = null;
  const isDirty = () => JSON.stringify(data) !== JSON.stringify(saved);

  // What the wheel needs, read straight from the data so it follows the
  // forms even while the data is not yet valid.
  const view = () => {
    const ELEMENTS = data.elements.map(e => e.id);
    const relations = data.relations.filter(r => ELEMENTS.includes(r.from) && ELEMENTS.includes(r.to));
    const relationKind = (a, b) => {
      if (a === b) return 'same';
      const r = relations.find(r => (r.from === a && r.to === b) || (r.from === b && r.to === a));
      if (!r) return 'none';
      return r.kind === 'beats' ? (r.from === a ? 'beats' : 'beaten') : r.kind;
    };
    return {
      ELEMENTS, relations, relationKind,
      ELEMENT_NAMES: Object.fromEntries(data.elements.map(e => [e.id, e.name || e.id])),
      ELEMENT_COLOURS: Object.fromEntries(data.elements.map(e => [e.id, /^#[0-9a-fA-F]{6}$/.test(e.color) ? e.color : '#777777'])),
      beats: Object.fromEntries(ELEMENTS.map(e => [e, relations.filter(r => r.kind === 'beats' && r.from === e).map(r => r.to)]))
    };
  };
  const simpleIds = () => data.spells.filter(s => (s.kind === 'attack' && (s.elements || []).length === 1) || s.kind === 'defence').map(s => s.id);
  const spellById = id => data.spells.find(s => s.id === id);

  function tryBuild() {
    problems = Rules.validate(data);
    if (!problems.length) { try { rules = Rules.build(data); } catch (e) { problems = e.problems || [e.message]; } }
  }
  // Re-render the live parts; the forms are rebuilt only on structural changes.
  function rebuild(skip = {}) {
    tryBuild();
    renderStatus();
    if (!skip.wheel) renderWheel();
    if (!skip.elements) renderElementRows();
    if (!skip.spells) renderPreviews();
    if (!skip.reactions) renderReactions();
    if (!skip.json) renderJson();
    readPad();
  }
  function renderAll() { renderElements(); renderSpells(); rebuild(); }

  function renderStatus() {
    const status = el('status');
    const dirty = isDirty();
    status.classList.toggle('is-bad', problems.length > 0);
    status.classList.toggle('is-good', !problems.length);
    status.textContent = problems.length ? `Not valid yet: ${problems.length} problem${problems.length > 1 ? 's' : ''}. The pages keep the last valid rules until this is fixed.` : dirty ? 'Valid. Unsaved changes.' : 'Valid. Everything here is saved.';
    el('problems').innerHTML = problems.map(p => `<li>${esc(p)}</li>`).join('');
    el('save').disabled = problems.length > 0 || !dirty;
    el('revert').disabled = !dirty;
  }

  // The wheel: click two elements to turn their relation.
  function renderWheel() {
    const v = view();
    el('wheel').innerHTML = W.svg(v, { id: 'forge-wheel', interactive: true, selected });
    el('wheel-legend').innerHTML = W.legend(v);
  }
  function setRelation(a, b, kind) {
    data.relations = data.relations.filter(r => !((r.from === a && r.to === b) || (r.from === b && r.to === a)));
    if (kind === 'beats') data.relations.push({ kind: 'beats', from: a, to: b });
    else if (kind === 'beaten') data.relations.push({ kind: 'beats', from: b, to: a });
    else if (kind === 'quench' || kind === 'pass') data.relations.push({ kind, from: a, to: b });
  }
  function turnRelation(a, b) {
    const v = view();
    const next = CYCLE[(CYCLE.indexOf(v.relationKind(a, b)) + 1) % CYCLE.length];
    setRelation(a, b, next);
    rebuild();
  }
  el('wheel').addEventListener('click', event => {
    const edge = event.target.closest('[data-pair]');
    if (edge) { const [a, b] = edge.dataset.pair.split(' '); selected = null; turnRelation(a, b); return; }
    const node = event.target.closest('.wheel-node');
    if (!node) return;
    const id = node.dataset.id;
    if (!selected) { selected = id; renderWheel(); return; }
    if (selected === id) { selected = null; renderWheel(); return; }
    const first = selected; selected = null;
    turnRelation(first, id);
  });
  el('wheel').addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const node = event.target.closest('.wheel-node');
    if (!node) return;
    event.preventDefault();
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  // Elements.
  function renderElements() {
    el('elements').innerHTML = `<thead><tr><th>id</th><th>name</th><th>colour</th><th>death</th><th>what is said</th><th></th></tr></thead><tbody>${data.elements.map((e, i) => `<tr data-element="${i}">
      <td><input type="text" data-element-id="${i}" value="${esc(e.id)}" aria-label="id"></td>
      <td><input type="text" data-path="elements.${i}.name" value="${esc(e.name)}" aria-label="name"></td>
      <td><input type="color" data-path="elements.${i}.color" value="${esc(/^#[0-9a-fA-F]{6}$/.test(e.color) ? e.color : '#777777')}" aria-label="colour"></td>
      <td><input type="text" data-path="elements.${i}.death.name" value="${esc(e.death && e.death.name)}" aria-label="death"></td>
      <td><input type="text" data-path="elements.${i}.death.line" value="${esc(e.death && e.death.line)}" aria-label="what is said"></td>
      <td><button type="button" class="control tiny danger" data-action="remove-element" data-index="${i}">Remove</button></td>
    </tr>`).join('')}</tbody>`;
  }
  const renderElementRows = () => {}; // the rows hold the inputs; nothing live to redraw
  function renameElement(from, to) {
    if (from === to) return;
    data.relations.forEach(r => { if (r.from === from) r.from = to; if (r.to === from) r.to = to; });
    data.spells.forEach(s => { s.elements = (s.elements || []).map(e => e === from ? to : e); if (s.reflects) s.reflects = s.reflects.map(e => e === from ? to : e); });
    for (const r of Object.values(data.reactions || {})) for (const side of ['x', 'y']) if (r[side] && from in r[side]) { r[side][to] = r[side][from]; delete r[side][from]; }
  }
  function removeElement(i) {
    const id = data.elements[i].id;
    data.elements.splice(i, 1);
    data.relations = data.relations.filter(r => r.from !== id && r.to !== id);
    data.spells.forEach(s => { s.elements = (s.elements || []).filter(e => e !== id); if (s.reflects) s.reflects = s.reflects.filter(e => e !== id); });
    for (const r of Object.values(data.reactions || {})) for (const side of ['x', 'y']) if (r[side]) delete r[side][id];
  }
  const freshId = (base, taken) => { let n = taken.length + 1; while (taken.includes(`${base}-${n}`)) n++; return `${base}-${n}`; };

  // Spells.
  const shapeFields = (si, hi, shape) => {
    const params = Rules.shapeParams(shape.kind) || {};
    return Object.entries(params).map(([p, dflt]) => {
      const v = shape[p] === undefined ? dflt : shape[p];
      if (typeof dflt === 'number') return `<label>${p} <input type="number" step="any" data-shape="${si}.${hi}.${p}" value="${esc(v)}"></label>`;
      return `<label class="wide">${p} <textarea rows="2" data-shape="${si}.${hi}.${p}" spellcheck="false">${esc(JSON.stringify(v))}</textarea></label>`;
    }).join('');
  };
  const spellForm = (s, i) => `<li class="spell-form" data-spell="${i}">
    <svg viewBox="0 0 100 100" data-preview="${i}" aria-hidden="true"></svg>
    <div class="fields">
      <label>id <input type="text" data-spell-id="${i}" value="${esc(s.id)}"></label>
      <label>name <input type="text" data-path="spells.${i}.name" value="${esc(s.name)}"></label>
      <label>kind <select data-spell-kind="${i}">${KINDS.map(k => `<option value="${k}"${s.kind === k ? ' selected' : ''}>${k}</option>`).join('')}</select></label>
      <div><span class="label">${s.kind === 'defence' ? 'reflects' : 'elements'}</span><div class="checks">${s.kind === 'barrier' ? '<span>none: a bare ring</span>' : data.elements.map(e => `<label><input type="checkbox" data-spell-${s.kind === 'defence' ? 'reflects' : 'element'}="${i}" value="${esc(e.id)}"${(s.kind === 'defence' ? s.reflects || [] : s.elements || []).includes(e.id) ? ' checked' : ''}> ${esc(e.name || e.id)}</label>`).join('')}</div></div>
      <label class="wide">glyph, in words <input type="text" data-path="spells.${i}.glyph" value="${esc(s.glyph)}"></label>
      <label class="wide">flavour <textarea rows="2" data-path="spells.${i}.flavour">${esc(s.flavour)}</textarea></label>
      <p class="nearest" data-nearest="${i}"></p>
    </div>
    <ul class="shapes">${(s.shapes || []).map((shape, hi) => `<li class="shape" data-shape-row="${i}.${hi}"><span class="which">${hi ? `variant ${hi}` : 'glyph'}</span><select data-shape-kind="${i}.${hi}">${Rules.SHAPE_KINDS.map(k => `<option value="${k}"${shape.kind === k ? ' selected' : ''}>${k}</option>`).join('')}</select>${shapeFields(i, hi, shape)}<button type="button" class="control tiny" data-action="remove-shape" data-index="${i}.${hi}">Remove</button></li>`).join('')}</ul>
    <div class="spell-actions"><button type="button" class="control tiny" data-action="add-shape" data-index="${i}">Add a shape</button><button type="button" class="control tiny" data-action="draw-shape" data-index="${i}">Draw one on the test sheet</button><button type="button" class="control tiny danger" data-action="remove-spell" data-index="${i}">Remove the spell</button></div>
  </li>`;
  function renderSpells() {
    el('spells').innerHTML = data.spells.map(spellForm).join('');
    el('pad-spell').innerHTML = data.spells.map(s => `<option value="${esc(s.id)}"${padTarget === s.id ? ' selected' : ''}>${esc(s.name || s.id)}</option>`).join('');
  }
  const safeStrokes = shape => { try { return Rules.strokesOf(shape); } catch { return null; } };
  function renderPreviews() {
    // Templates of everything as it stands, to say what each glyph is closest to.
    const templates = [];
    data.spells.forEach(s => (s.shapes || []).forEach(shape => { const strokes = safeStrokes(shape); if (strokes) templates.push({ id: s.id, strokes }); }));
    const prepared = R.prepare(templates);
    data.spells.forEach((s, i) => {
      const svg = el('spells').querySelector(`[data-preview="${i}"]`), note = el('spells').querySelector(`[data-nearest="${i}"]`);
      if (!svg) return;
      const variants = (s.shapes || []).map(safeStrokes);
      const [first, ...rest] = variants;
      svg.innerHTML = rest.filter(Boolean).map(v => `<path class="variant" d="${pathOf(v)}"/>`).join('') + (first ? `<path d="${pathOf(first)}"/>` : '');
      if (!first) { note.textContent = 'No shape yet.'; note.classList.remove('is-close'); return; }
      const other = R.recognize(first, prepared).find(c => c.id !== s.id);
      note.textContent = other ? `Nearest other glyph: ${(spellById(other.id) || {}).name || other.id} at ${other.distance.toFixed(2)}${other.distance < .5 ? ', too close to tell apart' : ''}.` : 'The only glyph.';
      note.classList.toggle('is-close', Boolean(other && other.distance < .5));
    });
  }
  function renameSpell(from, to) {
    if (from === to) return;
    const next = {};
    for (const [key, r] of Object.entries(data.reactions || {})) next[key.split(' ').map(id => id === from ? to : id).join(' ')] = r;
    data.reactions = next;
    if (padTarget === from) padTarget = to;
  }
  function removeSpell(i) {
    const id = data.spells[i].id;
    data.spells.splice(i, 1);
    for (const key of Object.keys(data.reactions || {})) if (key.split(' ').includes(id)) delete data.reactions[key];
  }

  // Reactions between the simple spells: written by hand, or derived.
  const marksText = marks => Object.entries(marks || {}).filter(([, n]) => n > 0).map(([e, n]) => n > 1 ? `${e} x${n}` : e).join(', ');
  const parseMarks = text => {
    const marks = {};
    for (const part of text.split(',')) {
      const m = part.trim().match(/^([a-z][a-z0-9-]*)(?:\s*[x*]?\s*(\d+))?$/i);
      if (!m) { if (part.trim()) throw new Error(part); continue; }
      marks[m[1].toLowerCase()] = (marks[m[1].toLowerCase()] || 0) + (m[2] ? Number(m[2]) : 1);
    }
    return marks;
  };
  const writtenKey = (a, b) => (data.reactions || {})[`${a} ${b}`] ? `${a} ${b}` : (data.reactions || {})[`${b} ${a}`] ? `${b} ${a}` : null;
  // The reaction as seen from a: written as is, flipped, or derived.
  function reactionView(a, b) {
    const key = writtenKey(a, b);
    if (key) { const r = data.reactions[key]; return key === `${a} ${b}` ? { ...r, derived: false } : { name: r.name, line: r.line, x: r.y, y: r.x, derived: false }; }
    if (rules.byId[a] && rules.byId[b] && rules.SIMPLE.includes(a) && rules.SIMPLE.includes(b)) return rules.derivedReaction(a, b);
    return { name: '', line: 'Save a valid state to derive this.', x: {}, y: {}, derived: true };
  }
  function renderReactions() {
    const ids = simpleIds();
    const pairs = [];
    ids.forEach((a, i) => ids.slice(i).forEach(b => pairs.push([a, b])));
    el('reactions').innerHTML = `<thead><tr><th>pair</th><th>name</th><th>first takes</th><th>second takes</th><th>what is said</th><th></th></tr></thead><tbody>${pairs.map(([a, b]) => {
      const r = reactionView(a, b), key = `${a} ${b}`, cls = r.derived ? ' class="is-derived"' : '';
      const name = id => (spellById(id) || {}).name || id;
      return `<tr data-reaction-row="${esc(key)}">
        <td class="pair">${esc(name(a))} · ${esc(name(b))}</td>
        <td${cls}><input type="text" class="name" data-reaction="${esc(key)}|name" value="${esc(r.name)}" aria-label="name"></td>
        <td${cls}><input type="text" class="marks" data-reaction="${esc(key)}|x" value="${esc(marksText(r.x))}" aria-label="${esc(name(a))} takes"></td>
        <td${cls}><input type="text" class="marks" data-reaction="${esc(key)}|y" value="${esc(marksText(r.y))}" aria-label="${esc(name(b))} takes"></td>
        <td${cls}><textarea rows="2" data-reaction="${esc(key)}|line" aria-label="what is said">${esc(r.line)}</textarea></td>
        <td>${r.derived ? '<span class="tiny">from the wheel</span>' : `<button type="button" class="control tiny" data-action="reset-reaction" data-index="${esc(key)}">Follow the wheel</button>`}</td>
      </tr>`;
    }).join('')}</tbody>`;
  }
  function writeReaction(key, field, value, input) {
    const [a, b] = key.split(' ');
    const existing = writtenKey(a, b);
    if (!existing) {
      const r = reactionView(a, b);
      data.reactions = data.reactions || {};
      data.reactions[key] = { name: r.name, x: clone(r.x), y: clone(r.y), line: r.line };
    }
    const stored = existing || key, r = data.reactions[stored];
    // A pair written the other way round swaps who takes what.
    const side = existing && existing !== key ? { x: 'y', y: 'x' }[field] || field : field;
    if (side === 'x' || side === 'y') { try { r[side] = parseMarks(value); input.classList.remove('is-bad'); } catch { input.classList.add('is-bad'); return; } }
    else r[side] = value;
    const row = el('reactions').querySelector(`[data-reaction-row="${CSS.escape(key)}"]`);
    if (row && !existing) row.querySelectorAll('td.is-derived').forEach(td => td.classList.remove('is-derived'));
    if (row && !existing) row.lastElementChild.innerHTML = `<button type="button" class="control tiny" data-action="reset-reaction" data-index="${esc(key)}">Follow the wheel</button>`;
  }

  // Inputs: a `data-path` writes straight into the data; the rest cascade.
  const setPath = (path, value) => { const keys = path.split('.'); let o = data; for (const k of keys.slice(0, -1)) o = o[k]; o[keys[keys.length - 1]] = value; };
  document.addEventListener('input', event => {
    const t = event.target;
    if (t.dataset.path) { setPath(t.dataset.path, t.value); rebuild({ elements: true, spells: !t.dataset.path.startsWith('spells'), reactions: false, json: false }); if (t.dataset.path.startsWith('spells')) renderPreviews(); renderJson(); return; }
    if (t.dataset.shape) {
      const [si, hi, p] = t.dataset.shape.split('.');
      const shape = data.spells[si].shapes[hi];
      if (t.type === 'number') shape[p] = t.value === '' ? undefined : Number(t.value);
      else { try { shape[p] = JSON.parse(t.value); t.classList.remove('is-bad'); } catch { t.classList.add('is-bad'); return; } }
      rebuild({ elements: true, reactions: true, wheel: true }); return;
    }
    if (t.dataset.reaction) { const [key, field] = t.dataset.reaction.split('|'); writeReaction(key, field, t.value, t); rebuild({ elements: true, spells: true, wheel: true, reactions: true }); return; }
    if (t.dataset.spellElement !== undefined) {
      const s = data.spells[t.dataset.spellElement];
      s.elements = data.elements.map(e => e.id).filter(id => el('spells').querySelector(`[data-spell-element="${t.dataset.spellElement}"][value="${CSS.escape(id)}"]`).checked);
      rebuild({ elements: true, wheel: true }); return;
    }
    if (t.dataset.spellReflects !== undefined) {
      const s = data.spells[t.dataset.spellReflects];
      s.reflects = data.elements.map(e => e.id).filter(id => el('spells').querySelector(`[data-spell-reflects="${t.dataset.spellReflects}"][value="${CSS.escape(id)}"]`).checked);
      rebuild({ elements: true, wheel: true }); return;
    }
  });
  document.addEventListener('change', event => {
    const t = event.target;
    if (t.dataset.elementId !== undefined) { const e = data.elements[t.dataset.elementId]; renameElement(e.id, t.value.trim()); e.id = t.value.trim(); renderAll(); return; }
    if (t.dataset.spellId !== undefined) { const s = data.spells[t.dataset.spellId]; renameSpell(s.id, t.value.trim()); s.id = t.value.trim(); renderAll(); return; }
    if (t.dataset.spellKind !== undefined) {
      const s = data.spells[t.dataset.spellKind];
      s.kind = t.value;
      if (s.kind !== 'attack') s.elements = [];
      if (s.kind === 'defence') s.reflects = s.reflects || []; else delete s.reflects;
      renderAll(); return;
    }
    if (t.dataset.shapeKind !== undefined) {
      const [si, hi] = t.dataset.shapeKind.split('.');
      data.spells[si].shapes[hi] = { kind: t.value, ...clone(Rules.shapeParams(t.value) || {}) };
      renderAll(); return;
    }
  });
  document.addEventListener('click', event => {
    const b = event.target.closest('[data-action]');
    if (!b) return;
    const index = b.dataset.index;
    switch (b.dataset.action) {
      case 'add-element': data.elements.push({ id: freshId('element', data.elements.map(e => e.id)), name: '', color: '#888888', death: { name: '', line: '' } }); break;
      case 'remove-element': if (!confirm(`Remove the element "${data.elements[index].id}"? Its relations, strikes and places in spells go with it.`)) return; removeElement(Number(index)); break;
      case 'add-spell': data.spells.push({ id: freshId('spell', data.spells.map(s => s.id)), name: '', elements: [], kind: 'attack', glyph: '', flavour: '', shapes: [{ kind: 'polyline', points: [[.1, .9], [.9, .1]] }] }); break;
      case 'remove-spell': if (!confirm(`Remove the spell "${data.spells[index].id}" and its reactions?`)) return; removeSpell(Number(index)); break;
      case 'add-shape': data.spells[index].shapes.push({ kind: 'polyline', points: [[.1, .9], [.9, .1]] }); break;
      case 'remove-shape': { const [si, hi] = index.split('.'); data.spells[si].shapes.splice(Number(hi), 1); break; }
      case 'draw-shape': padTarget = data.spells[index].id; el('pad-spell').value = padTarget; el('pad').scrollIntoView({ behavior: 'smooth', block: 'center' }); el('pad').focus(); return;
      case 'reset-reaction': { const [a, b2] = index.split(' '); const key = writtenKey(a, b2); if (key) delete data.reactions[key]; break; }
      default: return;
    }
    renderAll();
  });

  function renderJson() { if (document.activeElement !== el('json')) el('json').value = JSON.stringify(data, null, 2); }
  el('apply-json').addEventListener('click', () => {
    try { data = JSON.parse(el('json').value); } catch (e) { el('status').textContent = `That is not JSON: ${e.message}`; el('status').classList.add('is-bad'); return; }
    renderAll();
  });

  // Saving, downloading, loading.
  async function save() {
    let token = localStorage.getItem(TOKEN_KEY) || '';
    const status = el('status');
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!token) { token = prompt('The forge token (GLYPHS_EDIT_TOKEN on the server, or the .glyphs-edit-token file):') || ''; if (!token) return; }
      status.textContent = 'Saving…';
      let res, body;
      try { res = await fetch('/glyphs/data', { method: 'POST', headers: { 'content-type': 'application/json', 'x-glyphs-token': token }, body: JSON.stringify({ data }) }); body = await res.json(); } catch (e) { status.textContent = `Could not reach the server: ${e.message}. Download the file instead.`; status.classList.add('is-bad'); return; }
      if (res.status === 401) { localStorage.removeItem(TOKEN_KEY); token = ''; status.textContent = 'Wrong token.'; continue; }
      if (!body.ok) { problems = body.problems || [body.message || `The server said ${res.status}.`]; renderStatus(); status.textContent = body.message || 'The server refused it.'; status.classList.add('is-bad'); return; }
      localStorage.setItem(TOKEN_KEY, token);
      saved = clone(data);
      renderStatus();
      status.textContent = `Saved at ${new Date().toLocaleTimeString()}. Two-phone duels use it now; reload the duel or the grimoire to see it there.`;
      return;
    }
  }
  el('save').addEventListener('click', save);
  el('download').addEventListener('click', () => {
    const blob = new Blob([Rules.serialize(data)], { type: 'text/javascript' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'glyphs-data.js'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  el('load').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    const text = await file.text();
    try { data = text.trim().startsWith('{') ? JSON.parse(text) : Rules.parse(text); } catch (e) { el('status').textContent = `Could not read that file: ${e.message}`; el('status').classList.add('is-bad'); return; }
    event.target.value = '';
    renderAll();
  });
  el('revert').addEventListener('click', () => { data = clone(saved); renderAll(); });
  window.addEventListener('beforeunload', event => { if (isDirty()) { event.preventDefault(); event.returnValue = ''; } });

  // The test sheet, reading against the spells as they stand here.
  const pad = el('pad'), ctx = pad.getContext('2d'), frame = el('pad-frame'), reading = el('pad-reading'), list = el('pad-candidates');
  let strokes = [], drawing = false;
  const point = event => { const b = pad.getBoundingClientRect(); return [(event.clientX - b.left) * pad.width / b.width, (event.clientY - b.top) * pad.height / b.height]; };
  const paint = () => {
    ctx.clearRect(0, 0, pad.width, pad.height);
    ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1f3329';
    for (const s of strokes) { if (s.length < 2) continue; ctx.beginPath(); ctx.moveTo(s[0][0], s[0][1]); s.slice(1).forEach(p => ctx.lineTo(p[0], p[1])); ctx.stroke(); }
  };
  function readPad() {
    const live = strokes.filter(s => s.length > 1);
    el('pad-keep-glyph').disabled = el('pad-keep-variant').disabled = !live.length;
    if (!live.length) { reading.textContent = 'Draw on the sheet to see the ranked candidates.'; list.innerHTML = ''; frame.classList.remove('is-set'); return; }
    const templates = rules.spells.flatMap(spell => spell.variants.map(st => ({ id: spell.id, strokes: st })));
    const prepared = R.prepare(templates);
    const split = R.splitRing(live), read = split.ring ? split.inner : live;
    const candidates = R.recognize(read, prepared), best = candidates[0];
    if (!best) { reading.textContent = 'No glyphs to read against.'; list.innerHTML = ''; return; }
    const accepted = best.distance <= R.ACCEPT, spell = rules.byId[best.id];
    const name = accepted ? (split.ring && spell.kind === 'attack' ? `Ring of ${spell.name}` : spell.name) : '';
    reading.innerHTML = `${accepted ? `Reads as <strong>${esc(name)}</strong> at power ${rules.powerFor(best.distance)}` : 'Fizzles'}${split.ring ? ' · in a ring' : ''}${problems.length ? ' · against the last valid rules' : ''}`;
    list.innerHTML = candidates.map(c => `<li class="${c.distance <= R.ACCEPT ? 'accepted' : ''}">${esc(rules.byId[c.id].name)}: ${c.distance.toFixed(2)}</li>`).join('');
    frame.classList.toggle('is-set', accepted);
  }
  pad.addEventListener('pointerdown', e => { e.preventDefault(); pad.setPointerCapture(e.pointerId); drawing = true; strokes.push([point(e)]); });
  pad.addEventListener('pointermove', e => { if (!drawing) return; strokes[strokes.length - 1].push(point(e)); paint(); });
  const up = e => { if (!drawing) return; drawing = false; try { pad.releasePointerCapture(e.pointerId); } catch { /* fine */ } paint(); readPad(); };
  pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
  el('pad-clear').addEventListener('click', () => { strokes = []; paint(); readPad(); });
  // A drawing kept as a shape: fitted into the unit box keeping its aspect,
  // thinned to a few dozen points per stroke.
  const fitted = () => {
    const live = strokes.filter(s => s.length > 1), pts = live.flat();
    const minX = Math.min(...pts.map(p => p[0])), maxX = Math.max(...pts.map(p => p[0])), minY = Math.min(...pts.map(p => p[1])), maxY = Math.max(...pts.map(p => p[1]));
    const size = Math.max(maxX - minX, maxY - minY) || 1, ox = (1 - (maxX - minX) / size) / 2, oy = (1 - (maxY - minY) / size) / 2;
    const round = v => Math.round(v * 1000) / 1000;
    return live.map(s => {
      const step = Math.max(1, Math.floor(s.length / 40));
      const thin = s.filter((_, i) => i % step === 0);
      if (thin[thin.length - 1] !== s[s.length - 1]) thin.push(s[s.length - 1]);
      return thin.map(([x, y]) => [round((x - minX) / size + ox), round((y - minY) / size + oy)]);
    });
  };
  const keep = asGlyph => {
    const s = spellById(el('pad-spell').value);
    if (!s || !strokes.some(st => st.length > 1)) return;
    const shape = { kind: 'strokes', strokes: fitted() };
    if (asGlyph) s.shapes.unshift(shape); else s.shapes.push(shape);
    strokes = []; paint();
    renderAll();
    el('spells').querySelector(`[data-spell="${data.spells.indexOf(s)}"]`).scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  el('pad-keep-glyph').addEventListener('click', () => keep(true));
  el('pad-keep-variant').addEventListener('click', () => keep(false));

  renderAll();
  window.glyphsForge = { get data() { return data; }, set data(v) { data = v; renderAll(); }, get problems() { return problems; }, rebuild: renderAll, setRelation: (a, b, k) => { setRelation(a, b, k); rebuild(); } };
})();
