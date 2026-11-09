// A small observable state: set() merges a patch, subscribers run once per
// animation frame with the state and the keys that changed.

export function createStore(initial) {
  let state = { ...initial };
  const subs = new Set();
  let pending = null, changed = new Set();
  const flush = () => { pending = null; const keys = changed; changed = new Set(); for (const fn of subs) fn(state, keys); };
  return {
    get: () => state,
    set(patch) {
      const next = { ...state };
      let any = false;
      for (const [k, v] of Object.entries(patch)) { if (!same(next[k], v)) { next[k] = v; changed.add(k); any = true; } }
      if (!any) return;
      state = next;
      if (!pending) pending = (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : fn => setTimeout(fn, 0))(flush);
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}

function same(a, b) {
  if (a === b) return true;
  if (a instanceof Set && b instanceof Set) { if (a.size !== b.size) return false; for (const x of a) if (!b.has(x)) return false; return true; }
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => same(x, b[i]));
  return false;
}
