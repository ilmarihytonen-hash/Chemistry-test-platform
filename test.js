const C = require('./chem.js'); let n = 0;
for (let lv = 1; lv <= 4; lv++) {
  const cnt = {};
  for (let i = 0; i < 3000; i++) { const m = C.generate(lv); n++; m.groups.forEach(g => cnt[g] = (cnt[g] || 0) + 1);
    if (m.groups.length !== C.LEVELS[lv - 1].k[0]) throw new Error('count ' + lv + ' ' + m.groups); }
  console.log('level', lv, 'ok', JSON.stringify(cnt));
}
console.log(n, 'molecules, all valid'); console.log(C.molfile(C.generate(4)).split('\n').slice(0, 8).join('\n'));
const K = require('./comp.js'), p = K.parse(K.newCode('R', 5));
if (!p || p.min !== 5) throw new Error('code');
['', 'ABCDE-5', 'IIIII-1-5', 'ABCDE-1-0', 'ABCDE-1-61'].forEach(c => { if (K.parse(c)) throw new Error('should reject ' + c); });
const m1 = C.molfile(K.molecule(p, 4)); if (m1 !== C.molfile(K.molecule(p, 4)) || m1 === C.molfile(K.molecule(p, 5))) throw new Error('determinism');
const rc = K.makeResult(p, 'Åsa 😀', 120, 9, 7), rr = K.readResult(rc);
if (rr.n !== 'Åsa 😀' || rr.s !== 120 || rr.c !== p.code) throw new Error('result');
if (K.readResult(rc.slice(0, 8) + (rc[8] === 'A' ? 'B' : 'A') + rc.slice(9))) throw new Error('tamper');
console.log('competition logic ok');
