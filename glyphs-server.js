'use strict';

// Glyphs duels between two players. A room is a four-letter code; the server
// runs the clock and the rules, so neither phone sees the other's glyph until
// the reaction is sent to both.
const S = require('./public/glyphs-spells.js');

const ROUND_MS = S.ROUND_SECONDS * 1000 + 1200; // the clock plus a grace for slow links
const BETWEEN_MS = 4600; // time for the battlefield to play before the next sheet
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const VALID = new Set(S.OPTIONS.concat('fizzle'));

module.exports = function attachGlyphs(io) {
  const rooms = new Map();
  const newCode = () => {
    let code;
    do { code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join(''); } while (rooms.has(code));
    return code;
  };
  const roomOf = socket => rooms.get(socket.data.glyphsRoom);
  const swapPair = pair => [pair[1], pair[0]];
  // Each player receives the round from their own side: index 0 is always "you".
  const perspective = (result, side) => side === 0 ? result : {
    bodies: swapPair(result.bodies), heals: swapPair(result.heals), cancellations: swapPair(result.cancellations), deaths: swapPair(result.deaths),
    reaction: { ...result.reaction, marks: { a: result.reaction.marks.b, b: result.reaction.marks.a }, powers: swapPair(result.reaction.powers) }
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
    room.streaks = [null, null];
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
    room.timer = setTimeout(() => resolve(room), ROUND_MS);
  }
  function resolve(room) {
    if (room.phase !== 'drawing') return;
    room.phase = 'resolving';
    clearTimeout(room.timer);
    const ids = room.casts.map(id => id || 'rest');
    room.streaks = room.streaks.map((streak, i) => S.nextStreak(streak, ids[i]));
    const powers = room.streaks.map(S.powerOf);
    const result = S.applyRound(room.bodies[0], room.bodies[1], ids[0], ids[1], powers);
    room.bodies = result.bodies;
    const ended = result.deaths.some(Boolean);
    room.players.forEach((p, side) => p.emit('glyphs:result', { round: room.round, yours: ids[side], theirs: ids[1 - side], powers: side === 0 ? powers : swapPair(powers), result: perspective(result, side), ended }));
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
    socket.on('glyphs:cast', id => {
      const room = roomOf(socket);
      if (!room || room.phase !== 'drawing') return;
      const side = room.players.indexOf(socket);
      if (side < 0 || room.casts[side]) return;
      room.casts[side] = VALID.has(id) ? id : 'fizzle';
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

  return { rooms };
};
