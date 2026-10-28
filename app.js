// SPDX-License-Identifier: GPL-3.0-or-later
(() => {
  const { GROUPS, LEVELS, L, generate, groupsOf, hc, molfile } = Chem;
  const $ = s => document.querySelector(s);
  const KETCHER = 'https://lifescience.opensource.epam.com/KetcherDemoSA/index.html';
  let S = { level: 1, auto: false, streak: 0, miss: 0, ok: 0, tot: 0 };
  try { Object.assign(S, JSON.parse(localStorage.getItem('fgq') || '{}')); } catch (e) {}
  const save = () => { try { localStorage.setItem('fgq', JSON.stringify(S)); } catch (e) {} };
  let mol, sel = new Set(), done = false, revealed = false;
  const C = { on: false }; // competition state
  const P = { live: null }; let Hs = null; // live player connection / live host session

  const LK = 'fgq-lang', CK = 'fgq-consent-2';
  const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  let lang = ls.get(LK);
  if (!I18N[lang]) lang = ['fi', 'sv'].find(l => (navigator.language || '').startsWith(l)) || 'en';
  const t = (k, v = {}) => (I18N[lang][k] || I18N.en[k] || k).replace(/\{(\w+)\}/g, (_, x) => v[x]);
  let msg = { k: '', note: '', color: '' };
  const setMsg = (k = '', note = '', color = '') => { msg = { k, note, color }; $('#msg').style.color = color; $('#msg').textContent = k ? t(k) + (note ? ' ' + t(note) : '') : ''; };
  const hint = () => { if (mol) $('#hint').textContent = t((recall() ? 'r' : '') + (mol.groups.length === 1 ? 'hint1' : 'hintN'), { n: mol.groups.length }); };
  function applyLang() {
    document.documentElement.lang = lang; document.title = t('title');
    document.querySelectorAll('[data-i18n]').forEach(e => { e.textContent = t(e.dataset.i18n); });
    document.querySelectorAll('.lang').forEach(s => { s.value = lang; });
    document.querySelectorAll('#chips button').forEach(b => { b.textContent = t('g.' + b.dataset.id); });
    ui(); hint(); board(); roster(); setMsg(msg.k, msg.note, msg.color); if (revealed && mol) showAnswer();
  }
  document.querySelectorAll('.lang').forEach(s => { s.onchange = e => { lang = e.target.value; ls.set(LK, lang); applyLang(); }; });

  const dlg = $('#consent');
  dlg.addEventListener('cancel', e => e.preventDefault());
  $('#agree').onclick = () => { ls.set(CK, '1'); $('#declined').hidden = true; dlg.close(); };
  $('#decline').onclick = () => { try { localStorage.removeItem(CK); } catch (e) {} $('#declined').hidden = false; };
  $('#lic').onclick = () => dlg.showModal();

  const sub = n => '₂₃₄'[n - 2] || '';
  const COL = { O: '#ff6b6b', N: '#7c93ff', H: '#cbd5e1' };
  const GC = Object.fromEntries(GROUPS.map(g => [g.id, g.c]));

  function draw(m, hl) { // hl: värikoodaa funktionaaliset ryhmät
    const c = $('#cv'), r = c.getBoundingClientRect(), d = devicePixelRatio || 1;
    c.width = r.width * d; c.height = r.height * d;
    const x = c.getContext('2d'); x.scale(d, d);
    const xs = m.atoms.map(a => a.x), ys = m.atoms.map(a => a.y);
    const x0 = Math.min(...xs) - 26, x1 = Math.max(...xs) + 26, y0 = Math.min(...ys) - 26, y1 = Math.max(...ys) + 26;
    const k = Math.min(r.width / (x1 - x0), r.height / (y1 - y0), 1.25);
    const ox = r.width / 2 - (x0 + x1) / 2 * k, oy = r.height / 2 - (y0 + y1) / 2 * k;
    const P = a => [a.x * k + ox, a.y * k + oy];
    const G = hl ? groupsOf(m) : {}, ac = {}, bc = {};
    Object.keys(G).forEach(id => G[id].forEach(st => {
      st.forEach(a => { if (!ac[a]) ac[a] = GC[id]; });
      m.bonds.forEach(([i, j]) => { if (st.includes(i) && st.includes(j) && !bc[i + ',' + j]) bc[i + ',' + j] = GC[id]; });
    }));
    const label = i => { const a = m.atoms[i]; if (a.e === 'C') return ''; const h = hc(m, i); return a.e === 'H' ? 'H' : a.e + (h ? 'H' + (h > 1 ? sub(h) : '') : ''); };
    x.lineWidth = 2.2 * Math.max(k, .8); x.lineCap = 'round'; x.strokeStyle = '#f8fafc';
    const gap = 13 * Math.max(k, .8), off = 3.4 * Math.max(k, .8);
    m.bonds.forEach(([i, j, o, ar]) => {
      let [x1_, y1_] = P(m.atoms[i]), [x2_, y2_] = P(m.atoms[j]);
      const len = Math.hypot(x2_ - x1_, y2_ - y1_), ux = (x2_ - x1_) / len, uy = (y2_ - y1_) / len;
      if (label(i)) { x1_ += ux * gap; y1_ += uy * gap; }
      if (label(j)) { x2_ -= ux * gap; y2_ -= uy * gap; }
      x.strokeStyle = bc[i + ',' + j] || '#f8fafc';
      const lines = o === 3 ? [-off * 1.3, 0, off * 1.3] : o === 2 && !ar ? [-off, off] : [0];
      lines.forEach(s => { x.beginPath(); x.moveTo(x1_ - uy * s, y1_ + ux * s); x.lineTo(x2_ - uy * s, y2_ + ux * s); x.stroke(); });
      if (ar && o === 2) { /* Kekulé-sidos piirretään ympyränä */ }
    });
    m.rings.forEach(rg => { x.strokeStyle = G.BENZENE && G.BENZENE.some(st => st.includes(rg.atoms[0])) ? GC.BENZENE : '#f8fafc'; x.beginPath(); x.arc(rg.cx * k + ox, rg.cy * k + oy, 0.6 * L * k, 0, 7); x.stroke(); });
    x.font = `600 ${16 * Math.max(k, .85)}px system-ui,sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    m.atoms.forEach((a, i) => { const t = label(i); if (t) { const [px, py] = P(a); x.fillStyle = ac[i] || COL[a.e]; x.fillText(t, px, py); } });
  }

  function chips() {
    $('#chips').innerHTML = '';
    GROUPS.forEach(g => {
      const b = document.createElement('button'); b.textContent = t('g.' + g.id); b.dataset.id = g.id; b.setAttribute('aria-pressed', 'false');
      b.onclick = () => { if (done) return; sel.has(g.id) ? sel.delete(g.id) : sel.add(g.id); b.setAttribute('aria-pressed', sel.has(g.id)); };
      $('#chips').appendChild(b);
    });
  }

  function ui() {
    $('#levels').innerHTML = '';
    LEVELS.forEach((lv, i) => {
      const b = document.createElement('button'); b.textContent = t('lv' + (i + 1)); b.setAttribute('aria-pressed', S.level === i + 1);
      b.disabled = C.on; b.onclick = () => { skip(); S.level = i + 1; S.streak = S.miss = 0; save(); next(); };
      $('#levels').appendChild(b);
    });
    $('#auto').checked = S.auto; $('#auto').disabled = C.on;
    stat();
  }

  // An unanswered molecule can't be replaced for free: leaving it counts as a miss
  function skip() { if (mol && !done) { done = true; score(false); } }

  function next() {
    if (C.on) { C.idx++; mol = Comp.molecule(C, C.idx); mol.id = 'C-' + C.code + '#' + C.idx; }
    else if (forced) { mol = generate(forced.l, Comp.rng(forced.s)); mol.id = forced.l + '-' + forced.s.toString(36); forced = null; }
    else { const seed = (Math.random() * 4294967296) >>> 0; mol = generate(S.level, Comp.rng(seed)); mol.id = S.level + '-' + seed.toString(36); }
    sel = new Set(); done = false;
    revealed = false; setMsg(); chips(); ui(); hint(); draw(mol);
    const rc = recall(); $('#chips').hidden = rc; $('#chk').hidden = rc; $('#sg').hidden = true; $('#ans').disabled = false; $('#ansl').innerHTML = '';
  }

  function showAnswer() { // piirtää ryhmät väreillä ja näyttää ryhmien nimet samoilla väreillä
    revealed = true; draw(mol, true);
    const al = $('#ansl'); al.innerHTML = '';
    mol.groups.forEach(id => { const sp = document.createElement('span'); sp.textContent = t('g.' + id); sp.style.color = GC[id]; al.appendChild(sp); });
  }
  function reveal() {
    done = true; showAnswer();
    document.querySelectorAll('#chips button').forEach(b => {
      const want = mol.groups.includes(b.dataset.id), has = sel.has(b.dataset.id);
      b.className = want && has ? 'hit' : has ? 'miss' : want ? 'want' : '';
      if (want) b.style.color = GC[b.dataset.id];
    });
  }

  function score(good) { // mukautuva vaikeus: 3 oikein putkeen → ylös, 2 väärin → alas
    if (C.on) { C.ans++; if (good) { C.ok++; C.streak++; C.pts += Comp.points(C, C.idx, C.streak); } else C.streak = 0; if (P.live) P.live.send({ t: 'score', s: C.pts, a: C.ans, k: C.ok }); ui(); return ''; }
    S.tot++; if (good) { S.ok++; S.streak++; S.miss = 0; } else { S.streak = 0; S.miss++; }
    let note = '';
    if (S.auto && S.streak >= 3 && S.level < 4) { S.level++; S.streak = 0; note = 'up'; }
    if (S.auto && S.miss >= 2 && S.level > 1) { S.level--; S.miss = 0; note = 'down'; }
    save(); ui(); return note;
  }

  $('#chk').onclick = () => {
    if (done) return;
    const good = sel.size === mol.groups.length && mol.groups.every(g => sel.has(g));
    reveal(); setMsg(good ? 'ok' : 'wrong', score(good), good ? 'var(--ok)' : 'var(--bad)');
  };
  $('#ans').onclick = () => {
    if (done) return;
    if (recall()) { showAnswer(); $('#sg').hidden = false; $('#ans').disabled = true; setMsg('selfgrade'); return; } // taso 3–4: arvioit itse
    reveal(); setMsg('shown', score(false));
  };
  const grade = good => { if (done) return; done = true; $('#sg').hidden = true; setMsg(good ? 'ok' : 'wrong', score(good), good ? 'var(--ok)' : 'var(--bad)'); };
  $('#sgy').onclick = () => grade(true); $('#sgn').onclick = () => grade(false);
  $('#nxt').onclick = () => { skip(); next(); };
  $('#auto').onchange = e => { S.auto = e.target.checked; S.streak = S.miss = 0; save(); ui(); };
  const kd = $('#kd'), kf = $('#kf'), KLOCAL = 'ketcher/index.html';
  let kReady = false, kPending = null;
  const kLoad = mf => kf.contentWindow.ketcher.setMolecule(mf).catch(() => {});
  addEventListener('message', e => {
    if (e.source !== kf.contentWindow || !e.data || e.data.eventType !== 'init') return;
    kReady = true; if (kPending) { kLoad(kPending); kPending = null; }
  });
  $('#kx').onclick = () => kd.close();
  $('#ket').onclick = async () => {
    const mf = molfile(mol);
    let local = false;
    try { local = (await fetch(KLOCAL, { method: 'HEAD' })).ok; } catch (e) {}
    if (local) { // Ketcher on the same site: open it in the page and load the molecule
      kd.showModal();
      if (kReady) kLoad(mf); else { kPending = mf; if (!kf.getAttribute('src')) kf.src = KLOCAL; }
      return;
    }
    try { await navigator.clipboard.writeText(mf); setMsg('copied'); } catch (e) { setMsg('copyfail'); }
    window.open(KETCHER, '_blank', 'noopener');
  };
  // ---------- Competition ----------
  const fmt = ms => { const x = Math.ceil(ms / 1000); return Math.floor(x / 60) + ':' + String(x % 60).padStart(2, '0'); };
  function stat() {
    $('#stat').textContent = C.on ? t('cstat', { time: fmt(Math.max(0, C.end - Date.now())), p: C.pts, k: C.ok, a: C.ans })
      : t('stat', { l: S.level, ok: S.ok, tot: S.tot, s: S.streak });
  }
  const cd = $('#cd'), ed = $('#ed'), cm = (k, v = {}, good = false) => { $('#cm').style.color = good ? 'var(--ok)' : ''; $('#cm').textContent = t(k, v); };
  const tab = h => { $('#pj').hidden = h; $('#ph').hidden = !h; $('#tj').setAttribute('aria-pressed', !h); $('#th').setAttribute('aria-pressed', h); };
  $('#cmp').onclick = () => { if (C.on) return; $('#cm').textContent = ''; cd.showModal(); };
  $('#cx').onclick = () => cd.close();
  $('#tj').onclick = () => tab(false); $('#th').onclick = () => tab(true);
  $('#co').onclick = () => { // offline round: same code, result code instead of a live host
    const name = $('#cn').value.trim().slice(0, 16), p = Comp.parse($('#cc').value);
    if (!name) return cm('needname'); if (!p) return cm('badcode');
    const prev = ls.get('fgq-res-' + p.code); // one attempt per code and device
    if (prev) { if (prev.startsWith('FGQ1.')) showEnd(prev); return cm('used'); }
    ls.set('fgq-res-' + p.code, 'started');
    Object.assign(C, p, { on: true, name, idx: -1, pts: 0, ok: 0, ans: 0, streak: 0, end: Date.now() + p.min * 60000 });
    cd.close(); next(); setMsg('go');
  };
  // ---------- Live competition: host and players connect through PeerJS ----------
  function fillBoard(tb, rows) {
    tb.innerHTML = '';
    const hr = tb.insertRow(); ['rk', 'pl', 'pt', 'cr'].forEach(k => { const th = document.createElement('th'); th.textContent = t(k); hr.appendChild(th); });
    let rk = 0;
    rows.forEach((r, i) => { if (!i || r.s !== rows[i - 1].s) rk = i + 1; const tr = tb.insertRow(); [rk, r.n, r.s, r.k + '/' + r.a].forEach(v => { tr.insertCell().textContent = v; }); });
  }
  function roster() { // host view: live leaderboard + admin actions
    const tb = $('#rs'); tb.innerHTML = '';
    if (!Hs) return;
    const hr = tb.insertRow(); ['rk', 'pl', 'pt', 'rl', ''].forEach(k => { const th = document.createElement('th'); th.textContent = k ? t(k) : ''; hr.appendChild(th); });
    let rk = 0, prev = null;
    Hs.rows().forEach((r, i) => {
      const tr = tb.insertRow(), pl = r.role === 'player';
      if (pl) { if (!prev || r.s !== prev.s) rk = i + 1; prev = r; }
      [pl ? rk : '–', r.n + (r.on ? '' : ' ' + t('away')), pl ? r.s + ' · ' + r.k + '/' + r.a : '', t(pl ? 'rp' : 'ro')].forEach(v => { tr.insertCell().textContent = v; });
      const c = tr.insertCell(), b = (k, f) => { const x = document.createElement('button'); x.textContent = t(k); x.onclick = () => { f(); roster(); }; c.appendChild(x); };
      b('kick', () => Hs.kick(r.n));
      if (pl) b('toobs', () => Hs.setRole(r.n, 'observer')); else if (!Hs.started) b('toplay', () => Hs.setRole(r.n, 'player'));
    });
    $('#hst').disabled = Hs.started; $('#hen').disabled = !Hs.started || Hs.ended;
  }
  async function createLive() {
    if (Hs) { Hs.close(); Hs = null; }
    const code = Comp.newCode($('#hl').value, Math.max(1, Math.min(60, +$('#hm').value || 10)));
    $('#hk').value = code; board(); $('#hs').textContent = '';
    try { Hs = await Live.host(code, Comp.parse(code).min, { open: () => { $('#hs').textContent = t('hopen'); }, change: roster, error: () => { $('#hs').textContent = t('hoff'); } }); }
    catch (e) { $('#hs').textContent = t('hoff'); }
    roster();
  }
  $('#hst').onclick = () => { if (Hs) { Hs.start(); roster(); } };
  $('#hen').onclick = () => { if (Hs) { Hs.end(); $('#hs').textContent = t('hdone'); roster(); } };

  // Player side
  const lobby = on => { $('#cs').hidden = on; $('#co').hidden = on; $('#cl').hidden = !on; $('#cn').disabled = on; $('#cc').disabled = on; };
  const leave = () => { if (P.live) P.live.leave(); P.live = null; lobby(false); };
  const watch = () => { $('#ob').hidden = false; cm('obs', {}, true); if (!cd.open) cd.showModal(); tab(false); };
  const WHY = { name: 'needname', taken: 'taken', kicked: 'kicked', started: 'started', 'peer-unavailable': 'nohost' };
  const lev = {
    welcome: r => { P.role = r; if (r === 'observer') watch(); else cm('wait', { name: P.name }, true); },
    no: why => { leave(); cm(WHY[why] || 'netfail'); },
    start: () => {
      if (P.role !== 'player' || C.on) return;
      Object.assign(C, P.p, { on: true, name: P.name, idx: -1, pts: 0, ok: 0, ans: 0, streak: 0, end: Date.now() + P.p.min * 60000 });
      cd.close(); next(); setMsg('go');
    },
    end: () => { if (C.on) finish(); },
    kick: () => { if (C.on) { C.on = false; done = true; ui(); } leave(); cd.close(); setMsg('kicked', '', 'var(--bad)'); },
    role: r => { P.role = r; if (r === 'observer') { if (C.on) { C.on = false; done = true; ui(); setMsg(); } watch(); } else { $('#ob').hidden = true; cm('wait', { name: P.name }, true); } },
    board: rows => fillBoard($('#ob'), rows),
    close: () => { if (P.live && !C.on) { leave(); cm('lost'); } } // while playing, the result code still works offline
  };
  async function joinLive() {
    const name = Live.clean($('#cn').value), p = Comp.parse($('#cc').value);
    if (!name) return cm('needname'); if (!p) return cm('badcode'); if (P.live) return;
    cm('connecting'); P.p = p; P.name = name; P.role = null;
    try { P.live = await Live.join(p.code, name, lev); lobby(true); } catch (e) { P.live = null; lobby(false); cm('netfail'); }
  }
  $('#cs').onclick = joinLive;
  $('#cl').onclick = () => { leave(); $('#ob').hidden = true; cm(''); };

  setInterval(() => {
    if (Hs && Hs.started && !Hs.ended) {
      $('#hs').textContent = t('hrun', { time: fmt(Math.max(0, Hs.endAt - Date.now())) });
      if (Date.now() > Hs.endAt + 3000) { Hs.end(); $('#hs').textContent = t('hdone'); roster(); }
    }
    if (!C.on) return; stat(); if (C.end - Date.now() <= 0) finish();
  }, 250);
  function finish() {
    const rc = Comp.makeResult(C, C.name, C.pts, C.ans, C.ok);
    if (P.live) P.live.send({ t: 'score', s: C.pts, a: C.ans, k: C.ok, f: 1 });
    ls.set('fgq-res-' + C.code, rc); C.on = false; done = true; ui(); showEnd(rc);
  }
  function showEnd(rc) {
    const d = Comp.readResult(rc);
    $('#es').textContent = t('ends', { p: d.s, k: d.k, a: d.a }); $('#ec').value = rc;
    if (cd.open) cd.close(); ed.showModal();
  }
  $('#ecp').onclick = async () => { $('#ec').select(); try { await navigator.clipboard.writeText($('#ec').value); } catch (e) {} };
  $('#ex').onclick = () => { ed.close(); if (done) next(); }; // back to practice with a fresh molecule

  // Leader: create a code, paste result codes, see the leaderboard (stored only in this browser)
  function board() { // offline leaderboard from pasted result codes
    const p = Comp.parse($('#hk').value), tb = $('#lb'); tb.innerHTML = '';
    if (!p) return;
    fillBoard(tb, JSON.parse(ls.get('fgq-lb-' + p.code) || '[]').map(Comp.readResult).filter(Boolean).sort((a, b) => b.s - a.s || b.k - a.k || a.a - b.a));
  }
  $('#hc').onclick = createLive;
  $('#hk').oninput = board;
  $('#ha').onclick = () => {
    const p = Comp.parse($('#hk').value); if (!p) { $('#hmsg').textContent = t('badcode'); return; }
    const key = 'fgq-lb-' + p.code, list = JSON.parse(ls.get(key) || '[]'); let bad = 0;
    $('#hr').value.split(/\s+/).filter(Boolean).forEach(x => { const r = Comp.readResult(x); if (!r || r.c !== p.code) bad++; else if (!list.includes(x)) list.push(x); });
    ls.set(key, JSON.stringify(list)); $('#hr').value = ''; $('#hmsg').textContent = bad ? t('badrc', { n: bad }) : ''; board();
  };
  $('#hz').onclick = () => { const p = Comp.parse($('#hk').value); if (p) { ls.set('fgq-lb-' + p.code, '[]'); board(); } };

  // ---------- Recall mode, molecule IDs, feedback ----------
  const recall = () => !C.on && !!mol && mol.level >= 3; // levels 3-4: no options, self-graded
  let forced = (() => { const m = /^([1-4])-([0-9a-z]{1,8})$/.exec(new URLSearchParams(location.search).get('mol') || ''); return m ? { l: +m[1], s: parseInt(m[2], 36) >>> 0 } : null; })(); // ?mol=3-abc12 reopens a reported molecule
  const VER = typeof APP_VERSION !== 'undefined' ? String(APP_VERSION) : 'dev';
  const repo = () => {
    if (typeof APP_REPO === 'string' && APP_REPO) return APP_REPO;
    if (!location.hostname.endsWith('.github.io')) return '';
    return location.hostname.split('.')[0] + '/' + (location.pathname.split('/')[1] || location.hostname);
  };
  const issue = tpl => { // opens a pre-filled GitHub issue form; nothing is sent anywhere else
    const r = repo(); if (!r) { $('#fm').textContent = t('fnorepo'); return; }
    const q = new URLSearchParams({ template: tpl, title: tpl === 'bug_report.yml' ? '[Bug] ' : '[Feedback] ', version: VER, molecule: mol ? mol.id : '', env: lang + ' · ' + String(navigator.userAgent).slice(0, 120) });
    window.open('https://github.com/' + r + '/issues/new?' + q, '_blank', 'noopener');
  };
  const fd = $('#fd');
  $('#fbk').onclick = () => { $('#fm').textContent = ''; fd.showModal(); };
  $('#fx').onclick = () => fd.close();
  $('#fbug').onclick = () => issue('bug_report.yml'); $('#fidea').onclick = () => issue('feedback.yml');
  $('#ver').textContent = /^\d/.test(VER) ? 'v' + VER : VER; $('#ver').title = 'Version ' + VER;

  addEventListener('resize', () => mol && draw(mol, revealed));
  applyLang(); next();
  if (!ls.get(CK)) dlg.showModal();
})();
