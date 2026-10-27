// SPDX-License-Identifier: GPL-3.0-or-later
/* Funktionaaliset ryhmät – molekyyligeneraattori, tunnistin ja Molfile-vienti */
(function (root) {
  const L = 46, D = Math.PI / 180, VAL = { C: 4, O: 2, N: 3, H: 1 };
  const GROUPS = [
    { id: 'OH', name: 'Hydroksyyliryhmä' }, { id: 'COOH', name: 'Karboksyylihapporyhmä' },
    { id: 'CC_DOUBLE', name: 'Hiili-hiili -kaksoissidos' }, { id: 'BENZENE', name: 'Bentseenirengas' },
    { id: 'ETHER', name: 'Eetteriryhmä' }, { id: 'ESTER', name: 'Esteriryhmä' },
    { id: 'AMINE', name: 'Aminoryhmä' }, { id: 'AMIDE', name: 'Amidiryhmä' }, { id: 'ALDEHYDE', name: 'Aldehydiryhmä' }
  ];
  const ALL = GROUPS.map(g => g.id), BASIC = ['OH', 'AMINE', 'COOH', 'CC_DOUBLE', 'BENZENE'];
  // Vaikeustasot: ketjun pituus, ryhmien määrä, sallitut ryhmät, bentseenin sivuryhmä
  const LEVELS = [
    { name: 'Helppo', n: [3, 4], k: [1, 1], pool: BASIC, para: 0 },
    { name: 'Keskitaso', n: [4, 5], k: [2, 2], pool: BASIC.concat('ALDEHYDE', 'ETHER'), para: 0 },
    { name: 'Vaikea', n: [5, 7], k: [3, 3], pool: ALL, para: 0.4 },
    { name: 'Asiantuntija', n: [6, 8], k: [4, 4], pool: ALL, para: 0.8 }
  ];
  const ri = ([a, b], r) => a + Math.floor(r() * (b - a + 1));
  const shuffle = (a, r) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  function hc(m, i) { // implisiittisten vetyjen määrä
    return VAL[m.atoms[i].e] - m.bonds.reduce((s, b) => s + (b[0] === i || b[1] === i ? b[2] : 0), 0);
  }

  // Tunnistaa ryhmät pelkästään atomi-/sidosgraafista (vastaus ei riipu siitä, miten molekyyli luotiin)
  function detect(m) {
    const A = m.atoms, B = m.bonds, F = new Set();
    const nb = i => B.filter(b => b[0] === i || b[1] === i).map(b => ({ j: b[0] === i ? b[1] : b[0], o: b[2], ar: b[3] }));
    const co = i => A[i].e === 'C' && nb(i).some(n => n.o === 2 && A[n.j].e === 'O');
    const plainC = n => n.o === 1 && A[n.j].e === 'C' && !co(n.j);
    A.forEach((a, i) => {
      const N = nb(i);
      if (co(i)) {
        const O = N.find(n => n.o === 1 && A[n.j].e === 'O'), Nn = N.find(n => A[n.j].e === 'N');
        const C = N.filter(n => A[n.j].e === 'C').length;
        if (Nn) F.add('AMIDE'); else if (O) F.add(nb(O.j).length === 1 ? 'COOH' : 'ESTER');
        else F.add(C === 1 ? 'ALDEHYDE' : 'KETONE');
      }
      if (a.e === 'O' && N.length === 1 && plainC(N[0])) F.add('OH');
      if (a.e === 'O' && N.length === 2 && N.every(plainC)) F.add('ETHER');
      if (a.e === 'N' && N.every(plainC)) F.add('AMINE');
      if (N.some(n => n.ar)) F.add('BENZENE');
    });
    B.forEach(b => { if (b[2] === 2 && !b[3] && A[b[0]].e === 'C' && A[b[1]].e === 'C') F.add('CC_DOUBLE'); });
    return F;
  }

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
    for (let i = 0; i < n; i++) { add('C', i * L * 0.866, (i % 2) * -L / 2); if (i) bond(i - 1, i); }
    const head = { i: 0, t: -150 }, tail = { i: n - 1, t: (n - 1) % 2 ? 30 : -30 };
    let slots = shuffle([head, tail].concat(Array.from({ length: n - 2 }, (_, k) => ({ i: k + 1, t: (k + 1) % 2 ? -90 : 90 }))), r);
    const take = pred => { const j = slots.findIndex(pred); return j < 0 ? null : slots.splice(j, 1)[0]; };
    const frag = (id, i, t, s) => {
      switch (id) {
        case 'OH': grow(i, 'O', t); break;
        case 'AMINE': grow(i, 'N', t); break;
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
    const used = [], plan = [];
    for (const id of ids) {
      if (id === 'CC_DOUBLE') continue;
      const sl = id === 'BENZENE' ? take(x => x === head || x === tail) : take(() => true);
      if (!sl) return null; used.push(sl.i); plan.push([id, sl]);
    }
    if (ids.includes('CC_DOUBLE')) { // kaksoissidos vain hiileen, jolla ei ole muuta ryhmää
      const c = []; for (let b = 0; b < n - 1; b++) if (!used.includes(b) && !used.includes(b + 1)) c.push(b);
      if (!c.length) return null; bonds[c[Math.floor(r() * c.length)]][2] = 2;
    }
    plan.forEach(([id, sl]) => frag(id, sl.i, sl.t, r() < 0.5 ? 1 : -1));
    return { atoms, bonds, rings };
  }

  // Satunnainen molekyyli annetulle tasolle. Palauttaa vain molekyylin, jonka tunnistettu ryhmäjoukko
  // täsmää tarkoitettuihin ryhmiin ja jossa ei ole päällekkäisyyksiä tai väärää valenssia.
  function generate(level, r = Math.random) {
    const Lv = LEVELS[level - 1];
    for (let t = 0; t < 1000; t++) {
      let ids = shuffle(Lv.pool, r).slice(0, ri(Lv.k, r)), para = null;
      if (ids.includes('BENZENE') && ids.length > 2 && r() < Lv.para) {
        para = ids.find(x => x !== 'BENZENE' && x !== 'CC_DOUBLE'); ids = ids.filter(x => x !== para);
      }
      const m = build(ids, ri(Lv.n, r), para, r);
      if (!m || !valid(m)) continue;
      const want = new Set(ids.concat(para || [])), got = detect(m);
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

  root.Chem = { GROUPS, LEVELS, L, generate, detect, hc, molfile };
  if (typeof module !== 'undefined') module.exports = root.Chem;
})(typeof window !== 'undefined' ? window : globalThis);
