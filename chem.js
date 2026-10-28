// SPDX-License-Identifier: GPL-3.0-or-later
/* Funktionaaliset ryhmät – molekyyligeneraattori, tunnistin ja Molfile-vienti */
(function (root) {
  const L = 46, D = Math.PI / 180, VAL = { C: 4, O: 2, N: 3, H: 1 };
  const GROUPS = [ // c = väri vastauksen värikoodauksessa
    { id: 'OH', c: '#ff9f43' }, { id: 'PHENOL', c: '#fb7185' }, { id: 'COOH', c: '#ef4444' },
    { id: 'CC_DOUBLE', c: '#c3f26b' }, { id: 'CC_TRIPLE', c: '#7ee787' }, { id: 'BENZENE', c: '#2dd4bf' },
    { id: 'ETHER', c: '#38bdf8' }, { id: 'ESTER', c: '#6c8cff' }, { id: 'AMINE', c: '#a78bfa' },
    { id: 'AMIDE', c: '#e879f9' }, { id: 'ALDEHYDE', c: '#ffd93d' }, { id: 'KETONE', c: '#d4a373' }
  ];
  const ALL = GROUPS.map(g => g.id), BASIC = ['OH', 'AMINE', 'COOH', 'CC_DOUBLE', 'BENZENE'];
  const MID = BASIC.concat('ALDEHYDE', 'KETONE', 'ETHER', 'CC_TRIPLE');
  // Vaikeustasot: ketjun pituus, ryhmien määrä, sallitut ryhmät, bentseenin sivuryhmä (tasot 3–4: vaihtoehtoja ei näytetä)
  const LEVELS = [
    { n: [3, 4], k: [1, 1], pool: BASIC, para: 0 },
    { n: [4, 5], k: [2, 2], pool: MID, para: 0 },
    { n: [5, 7], k: [3, 3], pool: ALL, para: 0.4 },
    { n: [6, 8], k: [4, 4], pool: ALL, para: 0.8 }
  ];
  const ri = ([a, b], r) => a + Math.floor(r() * (b - a + 1));
  const shuffle = (a, r) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  function hc(m, i) { // implisiittisten vetyjen määrä
    return VAL[m.atoms[i].e] - m.bonds.reduce((s, b) => s + (b[0] === i || b[1] === i ? b[2] : 0), 0);
  }

  // Tunnistaa ryhmät graafista ja palauttaa ryhmä → [atomijoukot] (käytetään myös värikoodaukseen)
  function groupsOf(m) {
    const A = m.atoms, B = m.bonds, G = {};
    const put = (id, ...a) => (G[id] = G[id] || []).push(a);
    const nb = i => B.filter(b => b[0] === i || b[1] === i).map(b => ({ j: b[0] === i ? b[1] : b[0], o: b[2], ar: b[3] }));
    const ar = i => nb(i).some(n => n.ar);
    const co = i => A[i].e === 'C' && nb(i).some(n => n.o === 2 && A[n.j].e === 'O');
    const plainC = n => n.o === 1 && A[n.j].e === 'C' && !co(n.j);
    A.forEach((a, i) => {
      const N = nb(i);
      if (co(i)) {
        const dO = N.find(n => n.o === 2 && A[n.j].e === 'O').j, O = N.find(n => n.o === 1 && A[n.j].e === 'O');
        const Nn = N.find(n => A[n.j].e === 'N'), H = N.find(n => A[n.j].e === 'H'), Cs = N.filter(n => A[n.j].e === 'C').length;
        if (Nn) put('AMIDE', i, dO, Nn.j);
        else if (O) put(nb(O.j).length === 1 ? 'COOH' : 'ESTER', i, dO, O.j);
        else if (Cs === 1) put('ALDEHYDE', ...[i, dO].concat(H ? [H.j] : []));
        else put('KETONE', i, dO);
      }
      if (a.e === 'O' && N.length === 1 && plainC(N[0])) put(ar(N[0].j) ? 'PHENOL' : 'OH', i, N[0].j);
      if (a.e === 'O' && N.length === 2 && N.every(plainC)) put('ETHER', i, N[0].j, N[1].j);
      if (a.e === 'N' && N.every(plainC)) put('AMINE', i, ...N.map(n => n.j));
    });
    B.forEach(b => {
      if (!b[3] && A[b[0]].e === 'C' && A[b[1]].e === 'C') { if (b[2] === 2) put('CC_DOUBLE', b[0], b[1]); if (b[2] === 3) put('CC_TRIPLE', b[0], b[1]); }
    });
    const seen = new Set();
    A.forEach((_, i) => {
      if (seen.has(i) || !ar(i)) return;
      const st = [i], set = []; seen.add(i);
      while (st.length) { const x = st.pop(); set.push(x); nb(x).forEach(n => { if (n.ar && !seen.has(n.j)) { seen.add(n.j); st.push(n.j); } }); }
      put('BENZENE', ...set);
    });
    return G;
  }
  const detect = m => new Set(Object.keys(groupsOf(m)));

  function segDist(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
  }

  function valid(m) { // valenssit, päällekkäisyydet
    const A = m.atoms;
    if (A.some((a, i) => hc(m, i) < 0)) return false;
    const bonded = new Set(); m.bonds.forEach(b => { bonded.add(b[0] + ',' + b[1]); bonded.add(b[1] + ',' + b[0]); });
    for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++)
      if (!bonded.has(i + ',' + j) && Math.hypot(A[i].x - A[j].x, A[i].y - A[j].y) < 0.8 * L) return false;
    for (let i = 0; i < A.length; i++) for (const b of m.bonds)
      if (b[0] !== i && b[1] !== i && segDist(A[i], A[b[0]], A[b[1]]) < 0.4 * L) return false;
    for (const r of m.rings) A.forEach((a, i) => { if (!r.atoms.includes(i) && Math.hypot(a.x - r.cx, a.y - r.cy) < 1.25 * L) m.bad = true; });
    return !m.bad;
  }

  function build(ids, n, paraId, r) {
    const atoms = [], bonds = [], rings = [];
    const add = (e, x, y) => atoms.push({ e, x, y }) - 1;
    const bond = (a, b, o = 1, ar = false) => bonds.push([a, b, o, ar]);
    const grow = (i, e, t, o = 1, len = L) => { const j = add(e, atoms[i].x + len * Math.cos(t * D), atoms[i].y + len * Math.sin(t * D)); bond(i, j, o); return j; };
    const slots = shuffle(Array.from({ length: n }, (_, i) => ({ i, k: i === 0 ? 'h' : i === n - 1 ? 't' : 's' })), r);
    const take = pred => { const j = slots.findIndex(pred); return j < 0 ? null : slots.splice(j, 1)[0]; };
    const used = [], plan = [], order = new Array(n - 1).fill(1);
    for (const id of ids) {
      if (id === 'CC_DOUBLE' || id === 'CC_TRIPLE') continue;
      const sl = id === 'BENZENE' ? take(x => x.k !== 's') : id === 'KETONE' ? take(x => x.k === 's') : take(() => true);
      if (!sl) return null; used.push(sl.i); plan.push([id, sl]);
    }
    for (const id of ids) { // moninkertaiset sidokset vain hiileille, joilla ei ole muuta ryhmää
      if (id !== 'CC_DOUBLE' && id !== 'CC_TRIPLE') continue;
      const c = []; for (let b = 0; b < n - 1; b++) if (!used.includes(b) && !used.includes(b + 1)) c.push(b);
      if (!c.length) return null;
      const b = c[Math.floor(r() * c.length)]; order[b] = id === 'CC_TRIPLE' ? 3 : 2; used.push(b, b + 1);
    }
    // Ketju: siksak ±30°; kolmoissidoksen atomit ovat suoraan linjassa naapureidensa kanssa
    const lin = i => (i > 0 && order[i - 1] === 3) || (i < n - 1 && order[i] === 3);
    const dirs = [-30]; let sg = 1;
    for (let j = 1; j < n - 1; j++) { if (lin(j)) dirs.push(dirs[j - 1]); else { dirs.push(dirs[j - 1] + 60 * sg); sg = -sg; } }
    add('C', 0, 0); for (let i = 0; i < n - 1; i++) grow(i, 'C', dirs[i], order[i]);
    const tOf = sl => sl.k === 'h' ? dirs[0] + 240 : sl.k === 't' ? dirs[n - 2] + 60 * sg
      : Math.atan2(Math.sin(dirs[sl.i - 1] * D) - Math.sin(dirs[sl.i] * D), Math.cos(dirs[sl.i - 1] * D) - Math.cos(dirs[sl.i] * D)) / D;
    const frag = (id, i, t, s) => {
      switch (id) {
        case 'OH': grow(i, 'O', t); break;
        case 'AMINE': grow(i, 'N', t); break;
        case 'KETONE': grow(i, 'O', t, 2); break;
        case 'COOH': { const c = grow(i, 'C', t); grow(c, 'O', t + 60 * s, 2); grow(c, 'O', t - 60 * s); break; }
        case 'ALDEHYDE': { const c = grow(i, 'C', t); grow(c, 'O', t + 60 * s, 2); grow(c, 'H', t - 60 * s, 1, L * 0.6); break; }
        case 'AMIDE': { const c = grow(i, 'C', t); grow(c, 'O', t + 60 * s, 2); grow(c, 'N', t - 60 * s); break; }
        case 'ESTER': { const c = grow(i, 'C', t); grow(c, 'O', t + 60 * s, 2); const o = grow(c, 'O', t - 60 * s); const e = grow(o, 'C', t); if (r() < 0.4) grow(e, 'C', t - 60 * s); break; }
        case 'ETHER': { const o = grow(i, 'O', t), c = grow(o, 'C', t + 60 * s); if (r() < 0.5) grow(c, 'C', t); break; }
        case 'BENZENE': {
          const a = grow(i, 'C', t), cx = atoms[a].x + L * Math.cos(t * D), cy = atoms[a].y + L * Math.sin(t * D), ring = [a];
          for (let k = 1; k < 6; k++) ring.push(add('C', cx + L * Math.cos((t + 180 + 60 * k) * D), cy + L * Math.sin((t + 180 + 60 * k) * D)));
          for (let k = 0; k < 6; k++) bond(ring[k], ring[(k + 1) % 6], k % 2 ? 1 : 2, true);
          rings.push({ cx, cy, atoms: ring });
          if (paraId) frag(paraId, ring[3], t, s);
        }
      }
    };
    plan.forEach(([id, sl]) => frag(id, sl.i, tOf(sl), r() < 0.5 ? 1 : -1));
    return { atoms, bonds, rings };
  }

  // Satunnainen molekyyli annetulle tasolle. Palautetaan vain molekyyli, jonka tunnistettu ryhmäjoukko täsmää
  // tarkoitettuihin ryhmiin ja jossa ei ole päällekkäisyyksiä tai väärää valenssia.
  function generate(level, r = Math.random) {
    const Lv = LEVELS[level - 1];
    for (let t = 0; t < 1500; t++) {
      let ids = shuffle(Lv.pool, r).slice(0, ri(Lv.k, r)), para = null; const want = new Set();
      if (ids.includes('PHENOL')) { ids = ids.filter(x => x !== 'PHENOL' && x !== 'BENZENE').concat('BENZENE'); para = 'OH'; want.add('PHENOL'); }
      else if (ids.includes('BENZENE') && ids.length > 2 && r() < Lv.para) {
        para = ids.find(x => !['BENZENE', 'CC_DOUBLE', 'CC_TRIPLE', 'OH'].includes(x)) || null;
        if (para) ids = ids.filter(x => x !== para);
      }
      ids.forEach(x => want.add(x)); if (para && para !== 'OH') want.add(para);
      const m = build(ids, ri(Lv.n, r), para, r);
      if (!m || !valid(m)) continue;
      const got = detect(m);
      if (want.size === got.size && [...want].every(x => got.has(x))) { m.groups = [...got]; m.level = level; return m; }
    }
    throw new Error('Molekyylin luonti epäonnistui');
  }

  function molfile(m) {
    const f = v => v.toFixed(4).padStart(10), p = v => String(v).padStart(3);
    const o = ['', '  FunktionaalisetRyhmat', '', p(m.atoms.length) + p(m.bonds.length) + '  0  0  0  0  0  0  0  0999 V2000'];
    m.atoms.forEach(a => o.push(f(a.x / L * 1.5) + f(-a.y / L * 1.5) + f(0) + ' ' + a.e.padEnd(3) + ' 0' + '  0'.repeat(11)));
    m.bonds.forEach(b => o.push(p(b[0] + 1) + p(b[1] + 1) + p(b[2]) + '  0  0  0  0'));
    o.push('M  END'); return o.join('\n');
  }

  root.Chem = { GROUPS, LEVELS, L, generate, detect, groupsOf, hc, molfile };
  if (typeof module !== 'undefined') module.exports = root.Chem;
})(typeof window !== 'undefined' ? window : globalThis);
