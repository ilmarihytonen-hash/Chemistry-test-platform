const C = require('./chem.js'); let n = 0; const seen = new Set();
for (let lv = 1; lv <= 4; lv++) {
  const cnt = {};
  for (let i = 0; i < 3000; i++) { const m = C.generate(lv); n++; m.groups.forEach(g => { cnt[g] = (cnt[g] || 0) + 1; seen.add(g); });
    const k0 = C.LEVELS[lv - 1].k[0];
    if (m.groups.length < k0 || m.groups.length > k0 + 1 || Object.values(C.groupsOf(m)).some(v => v.some(st => !st.length || st.some(a => a >= m.atoms.length)))) throw new Error('count/atoms ' + lv + ' ' + m.groups); }
  console.log('level', lv, 'ok', JSON.stringify(cnt));
}
if (seen.size !== C.GROUPS.length) throw new Error('missing groups: ' + C.GROUPS.filter(g => !seen.has(g.id)).map(g => g.id));
console.log(n, 'molecules, all valid, all', seen.size, 'groups generated'); console.log(C.molfile(C.generate(4)).split('\n').slice(0, 8).join('\n'));
const K = require('./comp.js'), p = K.parse(K.newCode('R', 5));
if (!p || p.min !== 5) throw new Error('code');
['', 'ABCDE-5', 'IIIII-1-5', 'ABCDE-1-0', 'ABCDE-1-61'].forEach(c => { if (K.parse(c)) throw new Error('should reject ' + c); });
const m1 = C.molfile(K.molecule(p, 4)); if (m1 !== C.molfile(K.molecule(p, 4)) || m1 === C.molfile(K.molecule(p, 5))) throw new Error('determinism');
const rc = K.makeResult(p, 'Åsa 😀', 120, 9, 7), rr = K.readResult(rc);
if (rr.n !== 'Åsa 😀' || rr.s !== 120 || rr.c !== p.code) throw new Error('result');
if (K.readResult(rc.slice(0, 8) + (rc[8] === 'A' ? 'B' : 'A') + rc.slice(9))) throw new Error('tamper');
console.log('competition logic ok');
(async () => {
  const assert = require('assert'), Live = require('./live.js'), tick = () => new Promise(r => setTimeout(r, 40)), log = [];
  globalThis.Peer = require('./test-fakepeer.js');
  const mkev = n => ({ welcome: r => log.push(n + ':welcome:' + r), no: w => log.push(n + ':no:' + w), start: () => log.push(n + ':start'), end: () => log.push(n + ':end'), kick: () => log.push(n + ':kick'), role: r => log.push(n + ':role:' + r), board: rows => log.push(n + ':board:' + rows.length), close() {} });
  const has = x => assert(log.includes(x), x + ' missing in ' + log);
  const H = await Live.host('ABCDE-1-1', 1, { open() {}, change() {}, error: e => { throw new Error(e); } }); await tick();
  const a = await Live.join('ABCDE-1-1', 'Alice', mkev('A')); await Live.join('ABCDE-1-1', 'alice', mkev('B')); const c = await Live.join('ABCDE-1-1', 'Cara', mkev('C')); await tick();
  has('A:welcome:player'); has('B:no:taken'); has('C:welcome:player'); assert.equal(H.rows().length, 2);
  H.setRole('Cara', 'observer'); await tick(); has('C:role:observer');
  H.start(); await tick(); has('A:start'); assert(!log.includes('C:start'));
  a.send({ t: 'score', s: 30, a: 4, k: 3 }); c.send({ t: 'score', s: 999, a: 1, k: 1 }); await tick();
  assert.equal(H.rows()[0].n, 'Alice'); assert.equal(H.rows()[0].s, 30); assert.equal(H.rows()[1].s, 0, 'observer cannot score');
  H.setRole('Cara', 'player'); assert.equal(H.rows()[1].role, 'observer', 'no observer→player after start');
  H.pushBoard(); await tick(); has('C:board:1');
  await Live.join('ABCDE-1-1', 'Late', mkev('D')); await tick(); has('D:no:started');
  H.kick('Alice'); await tick(); has('A:kick'); assert(!H.rows().some(r => r.n === 'Alice'));
  await Live.join('ABCDE-1-1', 'ALICE', mkev('E')); await tick(); has('E:no:kicked');
  H.end(); await tick(); has('C:end');
  await Live.join('ZZZZZ-1-1', 'X', mkev('F')); await tick(); has('F:no:peer-unavailable');
  H.close(); console.log('live competition ok');
})();
