'use strict';

const express = require('express');
const app = express();

app.use(express.static(__dirname + '/public', {
	setHeaders: (res, path) => {
		if (path.includes("chemical-rakoon")) {
			res.header("Cross-Origin-Embedder-Policy", "require-corp");
			res.header("Cross-Origin-Opener-Policy", "same-origin");
		}
		else if (path.endsWith('.gz')) {
			res.header("Content-Encoding", "gzip");
		}
	}
}));

app.get('/log', (req, res) => {
	console.log(req.query);
	res.send();
})
let server;

const http = require('http');

server = http.createServer(app);
const port = Number(process.env.PORT) || 8080;
server.listen(port, '127.0.0.1', () => {
	console.log("Server is running");
});

const socket = require('socket.io');
const io = socket(server);
io.sockets.on('connection', newConnection);
const glyphs = require('./glyphs-server.js')(io);

// The forge (/glyphs-editor.html) writes the glyphs data file back. It needs
// the token in GLYPHS_EDIT_TOKEN or in a .glyphs-edit-token file beside this
// file (read on each request, so it can be set without a restart), and the
// service needs write access to public/glyphs-data.js.
const fs = require('fs');
const crypto = require('crypto');
const GlyphsRules = require('./public/glyphs-spells.js');
const GLYPHS_DATA = __dirname + '/public/glyphs-data.js';
const glyphsToken = () => {
	if (process.env.GLYPHS_EDIT_TOKEN) return process.env.GLYPHS_EDIT_TOKEN.trim();
	try { return fs.readFileSync(__dirname + '/.glyphs-edit-token', 'utf8').trim(); } catch { return ''; }
};
const sameToken = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
app.post('/glyphs/data', express.json({ limit: '4mb' }), (req, res) => {
	const token = glyphsToken();
	if (!token) return res.status(503).json({ ok: false, message: 'Saving is off on this server: set GLYPHS_EDIT_TOKEN or write a .glyphs-edit-token file beside server.js. Download the file instead.' });
	if (!sameToken(String(req.get('x-glyphs-token') || ''), token)) return res.status(401).json({ ok: false, message: 'Wrong token.' });
	const data = req.body && req.body.data;
	const problems = GlyphsRules.validate(data);
	if (problems.length) return res.status(400).json({ ok: false, problems });
	try { fs.writeFileSync(GLYPHS_DATA, GlyphsRules.serialize(data)); } catch (error) { return res.status(500).json({ ok: false, message: `Could not write the data file: ${error.message}` }); }
	glyphs.reload(data);
	res.json({ ok: true });
});

const pieceArray = [
	{ id: 0, x: 100, y: 670, w: 70, h: 70, color: 'blue' },
	{ id: 1, x: 100, y: 590, w: 70, h: 70, color: 'blue' },
	{ id: 2, x: 100, y: 510, w: 70, h: 70, color: 'blue' },
	{ id: 2, x: 140, y: 430, w: 70, h: 70, color: 'blue' },
	{ id: 2, x: 180, y: 670, w: 70, h: 70, color: 'blue' },
	{ id: 2, x: 180, y: 590, w: 70, h: 70, color: 'blue' },
	{ id: 2, x: 180, y: 510, w: 70, h: 70, color: 'blue' },
	{ id: 3, x: 700, y: 670, w: 70, h: 70, color: 'red' },
	{ id: 4, x: 700, y: 590, w: 70, h: 70, color: 'red' },
	{ id: 5, x: 700, y: 510, w: 70, h: 70, color: 'red' },
	{ id: 5, x: 660, y: 430, w: 70, h: 70, color: 'red' },
	{ id: 5, x: 620, y: 670, w: 70, h: 70, color: 'red' },
	{ id: 5, x: 620, y: 590, w: 70, h: 70, color: 'red' },
	{ id: 5, x: 620, y: 510, w: 70, h: 70, color: 'red' }
];

const dices = [
	'0',
	'1', '1', '1', '1',
	'2', '2', '2', '2', '2', '2',
	'3', '3', '3', '3',
	'4'
];

function newConnection(socket) {
	socket.on('mouse', mouseMsg);
	socket.on('movingUrPiece', movingUrPieceMsg);
	socket.on('getUrPieces', getUrPiecesMsg);
	socket.on('rollingUrDices', rollingUrDicesMsg);
	socket.on('camera', cameraImage);

	socket.on('marvinMove', marvinMove);
	function marvinMove(data) {
		socket.broadcast.emit('marvinMove', data);
	}

	socket.on('jocelynMove', jocelynMove);
	function jocelynMove(data) {
		socket.broadcast.emit('jocelynMove', data);
	}

	function cameraImage(data) {
		socket.broadcast.emit('camera', data);
	}
	function mouseMsg(data) {
		socket.broadcast.emit('mouse', data);
	}
	function movingUrPieceMsg(data) {
		if (data.index >= 0 && data.index < pieceArray.length) {
			if (data.x < 0) {
				data.x = 0;
			} else if (data.x > 800) {
				data.x = 800
			}
			if (data.y < 0) {
				data.y = 0;
			} else if (data.y > 800) {
				data.y = 800
			}
			pieceArray[data.index].x = data.x;
			pieceArray[data.index].y = data.y;
			socket.broadcast.emit('movingUrPiece', data);
		}
	}
	function getUrPiecesMsg() {
		socket.emit('getUrPieces', pieceArray);
	}
	function rollingUrDicesMsg(data) {
		let resultDices;
		if (!data.isRolling)
			resultDices = dices[Math.floor(Math.random() * dices.length)];;
		data = {
			isRolling: data.isRolling,
			resultDices
		};

		socket.broadcast.emit('rollingUrDices', data);
		socket.emit('rollingUrDices', data);
	}
}
