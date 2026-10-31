'use strict';

// Glyphs duels between two players. A room is a four-letter code; the server
// runs the clock and the rules, so neither phone sees the other's glyph until
// the reaction is sent to both.
const Rules = require('./public/glyphs-spells.js');
// The rules in play; the forge swaps them when it saves new data.
let S = Rules;

const roundMs = () => S.ROUND_SECONDS * 1000 + 1200; // the clock plus a grace for slow links
const BETWEEN_MS = 14000; // time to read the battlefield before the next sheet
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

module.exports = function attachGlyphs(io) {
  const rooms = new Map();
  const newCode = () => {
    let code;
    do { code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join(''); } while (rooms.has(code));
    return code;
  };
  const roomOf = socket => rooms.get(socket.data.glyphsRoom);
  const swapPair = pair => [pair[1], pair[0]];
  // Each player receives the round from their own side: index 0 is always
  // "you", and the other caster's ring is masked to its thickness.
  const perspective = (result, side) => {
    const ordered = side === 0 ? result : {
      bodies: swapPair(result.bodies), raised: swapPair(result.raised), blows: swapPair(result.blows), deaths: swapPair(result.deaths),
      reaction: { ...result.reaction, strikes: { a: result.reaction.strikes.b, b: result.reaction.strikes.a }, powers: swapPair(result.reaction.powers) }
    };
    const maskRaised = r => r && { before: S.maskBody({ ring: r.before }).ring, after: S.maskBody({ ring: r.after }).ring };
    return { ...ordered, bodies: [ordered.bodies[0], S.maskBody(ordered.bodies[1])], raised: [ordered.raised[0], maskRaised(ordered.raised[1])] };
  };

  function leave(socket, reason = 'left') {
    const room = roomOf(socket);
    delete socket.data.glyphsRoom;
    if (!room) return;
    clearTimeout(room.timer);
    room.players = room.players.filter(p => p !== socket);
    room.players.forEach(p => { p.emit('glyphs:left', { reason }); delete p.data.glyphsRoom; });
    rooms.delete(room.code);
  }
  function start(room) {
    room.bodies = [S.emptyBody(), S.emptyBody()];
    room.round = 0;
    room.again = [false, false];
    room.phase = 'starting';
    room.players.forEach((p, side) => p.emit('glyphs:start', { code: room.code, side }));
    room.timer = setTimeout(() => nextRound(room), 1500);
  }
  function nextRound(room) {
    room.round += 1;
    room.phase = 'drawing';
    room.casts = [null, null];
    room.players.forEach(p => p.emit('glyphs:round', { round: room.round, seconds: S.ROUND_SECONDS }));
    room.timer = setTimeout(() => resolve(room), roundMs());
  }
  function resolve(room) {
    if (room.phase !== 'drawing') return;
    room.phase = 'resolving';
    clearTimeout(room.timer);
    const ids = room.casts.map(cast => cast ? cast.id : 'blank');
    const powers = room.casts.map(cast => cast ? cast.power : 1);
    const result = S.applyRound(room.bodies[0], room.bodies[1], ids[0], ids[1], powers);
    room.bodies = result.bodies;
    const ended = result.deaths.some(Boolean);
    room.players.forEach((p, side) => p.emit('glyphs:result', { round: room.round, yours: ids[side], theirs: S.maskCast(ids[1 - side]), powers: side === 0 ? powers : swapPair(powers), result: perspective(result, side), ended, nextIn: ended ? 0 : BETWEEN_MS }));
    if (ended) { room.phase = 'ended'; return; }
    room.timer = setTimeout(() => nextRound(room), BETWEEN_MS);
  }

  io.on('connection', socket => {
    socket.on('glyphs:create', ack => {
      leave(socket);
      const room = { code: newCode(), players: [socket], phase: 'waiting', timer: null };
      rooms.set(room.code, room);
      socket.data.glyphsRoom = room.code;
      if (typeof ack === 'function') ack({ code: room.code });
    });
    socket.on('glyphs:join', (code, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      const room = rooms.get(String(code || '').trim().toUpperCase());
      if (!room) return reply({ error: 'No duel is waiting under that code.' });
      if (room.players.includes(socket)) return reply({ error: 'You are already at that table.' });
      if (room.players.length >= 2) return reply({ error: 'That table already has two casters.' });
      leave(socket);
      room.players.push(socket);
      socket.data.glyphsRoom = room.code;
      reply({ code: room.code });
      start(room);
    });
    // A cast is the glyph the phone read and how cleanly it was drawn.
    socket.on('glyphs:cast', cast => {
      const room = roomOf(socket);
      if (!room || room.phase !== 'drawing') return;
      const side = room.players.indexOf(socket);
      if (side < 0 || room.casts[side]) return;
      const id = cast && typeof cast === 'object' ? cast.id : cast;
      const power = Math.min(S.MAX_POWER, Math.max(1, Math.round(Number(cast && cast.power) || 1)));
      room.casts[side] = { id: id in S.byId ? id : 'fizzle', power };
      room.players.forEach((p, i) => { if (i !== side) p.emit('glyphs:sealed'); });
      if (room.casts.every(Boolean)) resolve(room);
    });
    socket.on('glyphs:again', () => {
      const room = roomOf(socket);
      if (!room || room.phase !== 'ended') return;
      room.again[room.players.indexOf(socket)] = true;
      room.players.forEach((p, i) => { if (!room.again[i]) p.emit('glyphs:again-asked'); });
      if (room.players.length === 2 && room.again.every(Boolean)) start(room);
    });
    socket.on('glyphs:leave', () => leave(socket));
    socket.on('disconnect', () => leave(socket, 'disconnected'));
  });

  // New data from the forge takes effect for the next round of every table.
  const reload = data => { S = Rules.build(data); };
  return { rooms, reload, get rules() { return S; } };
};
