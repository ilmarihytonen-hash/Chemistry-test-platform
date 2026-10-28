// SPDX-License-Identifier: GPL-3.0-or-later
// Live competition over WebRTC (PeerJS). The host owns the roster; players only talk to the host.
(function (root) {
  const PEERJS = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
  const loadPeer = () => root.Peer ? Promise.resolve() : new Promise((ok, no) => { const s = document.createElement('script'); s.src = PEERJS; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  const pid = code => 'fgq1-' + code.split('-')[0].toLowerCase();
  const clean = n => String(n || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);
  const num = v => Math.max(0, Math.min(99999, Math.floor(+v) || 0));

  async function host(code, minutes, ev) {
    await loadPeer();
    const peer = new root.Peer(pid(code)), P = new Map(), H = { started: false, ended: false, endAt: 0 };
    const send = (e, m) => { try { if (e.on) e.conn.send(m); } catch (x) {} };
    const find = n => P.get(String(n).toLowerCase());
    H.rows = () => [...P.values()].filter(e => !e.kicked).map(e => ({ n: e.name, role: e.role, s: e.s, a: e.a, k: e.k, on: e.on }))
      .sort((x, y) => (x.role === 'observer') - (y.role === 'observer') || y.s - x.s || y.k - x.k || x.a - y.a);
    peer.on('error', e => ev.error(e.type));
    peer.on('open', () => ev.open());
    peer.on('connection', conn => {
      let me = null;
      conn.on('data', m => {
        if (!m) return;
        if (m.t === 'hello' && !me) {
          const name = clean(m.name), key = name.toLowerCase(), old = P.get(key);
          const no = why => { conn.send({ t: 'no', why }); setTimeout(() => conn.close(), 200); };
          if (!name) return no('name');
          if (old && old.kicked) return no('kicked');
          if (old && (old.on || H.started)) return no('taken');   // names are single-use per competition
          if (!old && H.started) return no('started');
          me = old || { name, role: 'player', s: 0, a: 0, k: 0 }; me.conn = conn; me.on = true; P.set(key, me);
          conn.send({ t: 'welcome', role: me.role }); ev.change();
        } else if (m.t === 'score' && me && me.role === 'player' && H.started && (!H.ended || m.f)) {
          me.s = num(m.s); me.a = num(m.a); me.k = num(m.k); ev.change();
        }
      });
      conn.on('close', () => { if (me && me.conn === conn) { me.on = false; ev.change(); } });
    });
    H.start = () => { if (H.started) return; H.started = true; H.endAt = Date.now() + minutes * 60000; P.forEach(e => e.role === 'player' && send(e, { t: 'start' })); ev.change(); };
    H.end = () => { if (H.ended) return; H.ended = true; P.forEach(e => send(e, { t: 'end' })); ev.change(); };
    H.kick = n => { const e = find(n); if (!e) return; e.kicked = true; send(e, { t: 'kick' }); const c = e.conn; e.on = false; setTimeout(() => { try { c.close(); } catch (x) {} }, 200); ev.change(); };
    H.setRole = (n, role) => { const e = find(n); if (!e || e.kicked || (H.started && role === 'player')) return; e.role = role; send(e, { t: 'role', role }); ev.change(); };
    H.pushBoard = () => { const rows = H.rows().filter(r => r.role === 'player'); P.forEach(e => e.role === 'observer' && send(e, { t: 'board', rows })); };
    const iv = setInterval(H.pushBoard, 2000);
    H.close = () => { clearInterval(iv); try { peer.destroy(); } catch (x) {} };
    return H;
  }

  async function join(code, name, ev) {
    await loadPeer();
    const peer = new root.Peer(); let conn = null;
    peer.on('error', e => ev.no(e.type));
    peer.on('open', () => {
      conn = peer.connect(pid(code), { reliable: true });
      conn.on('open', () => conn.send({ t: 'hello', name }));
      conn.on('data', m => {
        if (!m) return;
        const f = { welcome: () => ev.welcome(m.role), no: () => ev.no(m.why), start: () => ev.start(), end: () => ev.end(), kick: () => ev.kick(), role: () => ev.role(m.role), board: () => ev.board(m.rows) }[m.t];
        if (f) f();
      });
      conn.on('close', () => ev.close());
    });
    return { send: m => { try { if (conn) conn.send(m); } catch (x) {} }, leave: () => { try { peer.destroy(); } catch (x) {} } };
  }
  root.Live = { host, join, clean };
  if (typeof module !== 'undefined') module.exports = root.Live;
})(typeof window !== 'undefined' ? window : globalThis);
