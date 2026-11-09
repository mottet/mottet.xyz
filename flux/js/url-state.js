// The view in the address bar, so any view can be shared: ?a=2024&b=sna
// &h=1&x=S1313,S14&o=1&n=S13111&t=sombre. Defaults are left out; unknown
// keys are ignored; bad values fall back.

export const DEFAULTS = { year: null, basis: 'sna', hubLevel: 0, expanded: [], ops: false, selected: null, theme: 'auto', focus: null };

export function encode(state, defaults = DEFAULTS) {
  const q = new URLSearchParams();
  if (state.year && state.year !== defaults.year) q.set('a', String(state.year));
  if (state.basis && state.basis !== defaults.basis) q.set('b', state.basis);
  if (state.hubLevel) q.set('h', String(state.hubLevel));
  const x = Array.from(state.expanded || []).sort();
  if (x.length) q.set('x', x.join(','));
  if (state.focus) q.set('f', state.focus);
  if (state.ops) q.set('o', '1');
  if (state.selected) q.set('n', state.selected);
  if (state.theme && state.theme !== 'auto') q.set('t', state.theme);
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function decode(query, { years = [], bases = ['sna'], defaults = DEFAULTS } = {}) {
  const q = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
  const state = { ...defaults, expanded: [] };
  const a = Number(q.get('a'));
  if (years.length) state.year = years.includes(a) ? a : (defaults.year ?? years[years.length - 1]);
  else if (a) state.year = a;
  const b = q.get('b');
  if (b && bases.includes(b)) state.basis = b;
  const h = Number(q.get('h'));
  if (Number.isInteger(h) && h >= 0 && h <= 4) state.hubLevel = h;
  const x = q.get('x');
  if (x) state.expanded = x.split(',').filter(s => /^[A-Za-z0-9_.-]+$/.test(s));
  state.ops = q.get('o') === '1';
  const f = q.get('f');
  state.focus = f && /^[A-Za-z0-9_.:-]+$/.test(f) ? f : null;
  const n = q.get('n');
  if (n && /^[A-Za-z0-9_.:*-]+$/.test(n)) state.selected = n;
  const t = q.get('t');
  if (t === 'clair' || t === 'sombre') state.theme = t;
  return state;
}
