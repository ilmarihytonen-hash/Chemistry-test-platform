// SPDX-License-Identifier: GPL-3.0-or-later
// Serverless competition logic: the code fixes seed, difficulty and time; results travel as signed text codes.
(function (root) {
  const Chem = root.Chem || require('./chem.js');
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', SALT = 'fgq-v1';
  const rng = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const hash = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0'); };
  const b64 = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const d64 = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

  const newCode = (mode, min, r = Math.random) => { let s = ''; for (let i = 0; i < 5; i++) s += ALPHA[Math.floor(r() * 32)]; return `${s}-${mode}-${min}`; };
  function parse(c) { // XXXXX-L-MM, L = 1..4 or R (rising), MM = minutes 1..60
    const m = /^([A-HJ-NP-Z2-9]{5})-?([1-4R])-?(\d{1,2})$/.exec(String(c).toUpperCase().replace(/\s/g, ''));
    if (!m || +m[3] < 1 || +m[3] > 60) return null;
    return { code: `${m[1]}-${m[2]}-${+m[3]}`, seed: [...m[1]].reduce((a, ch) => a * 32 + ALPHA.indexOf(ch), 0), mode: m[2], min: +m[3] };
  }
  const level = (p, i) => p.mode === 'R' ? Math.min(4, 1 + Math.floor(i / 3)) : +p.mode;
  // Same code → the same molecule at position i for every player
  const molecule = (p, i) => Chem.generate(level(p, i), rng((p.seed ^ Math.imul(i + 1, 0x9E3779B1)) >>> 0));
  const points = (p, i, streak) => 10 * level(p, i) + 2 * Math.min(streak - 1, 5);

  function makeResult(p, name, s, a, k) {
    const j = JSON.stringify({ c: p.code, n: String(name).slice(0, 16), s, a, k });
    return 'FGQ1.' + b64(j) + '.' + hash(j + SALT);
  }
  function readResult(s) { // null if malformed or edited
    const m = /^FGQ1\.([\w-]+)\.([0-9a-f]{8})$/.exec(String(s).trim()); if (!m) return null;
    try {
      const j = d64(m[1]); if (hash(j + SALT) !== m[2]) return null;
      const o = JSON.parse(j), n = v => Math.max(0, Math.min(99999, Math.floor(+v) || 0));
      return { c: String(o.c), n: String(o.n).slice(0, 16), s: n(o.s), a: n(o.a), k: n(o.k) };
    } catch (e) { return null; }
  }
  root.Comp = { newCode, parse, level, molecule, points, makeResult, readResult };
  if (typeof module !== 'undefined') module.exports = root.Comp;
})(typeof window !== 'undefined' ? window : globalThis);
