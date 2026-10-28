// In-memory stand-in for PeerJS, used by the tests only
const reg = new Map();
class Conn { constructor() { this.h = {}; this.open = true; } on(e, f) { this.h[e] = f; return this; } emit(e, a) { this.h[e] && this.h[e](a); }
  send(m) { const o = this.o, c = JSON.parse(JSON.stringify(m)); setTimeout(() => o.emit('data', c)); }
  close() { const o = this.o; setTimeout(() => { this.emit('close'); o.emit('close'); }); } }
class FakePeer { constructor(id) { this.id = id || 'x' + Math.random().toString(36).slice(2); this.h = {}; reg.set(this.id, this); setTimeout(() => this.emit('open', this.id)); }
  on(e, f) { this.h[e] = f; return this; } emit(e, a) { this.h[e] && this.h[e](a); }
  connect(id) { const to = reg.get(id), a = new Conn(), b = new Conn(); if (!to) { setTimeout(() => this.emit('error', { type: 'peer-unavailable' })); return a; } a.o = b; b.o = a; setTimeout(() => { to.emit('connection', b); a.emit('open'); }); return a; }
  destroy() { reg.delete(this.id); } }
module.exports = FakePeer;
