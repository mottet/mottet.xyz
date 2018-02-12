const config = require('./config');

const express = require('express');
const enforce = require('express-sslify');
const app = express();

app.use(express.static(__dirname + '/public'));

let server;

if (config.NODE_ENV === 'production') {
	const fs = require('fs');
	const https = require('https');
	const privateKey  = fs.readFileSync(PRIVATE_KEY_PATH);
	const certificate = fs.readFileSync(CERTIFICATE_PATH);
	const credentials = {key: privateKey, cert: certificate};

	app.use(enforce.HTTPS());
	server = https.createServer(credentials, app);
	server.listen(443);
} else {
	const http = require('http');

	server = http.createServer(app);
	server.listen(8001);
}

console.log("Server is running");

const socket = require('socket.io');


const io = socket(server);
io.sockets.on('connection', newConnection);

var pieceArray = [
	{id: 0, x: 100, y:670, w:70, h:70, color:'blue'},
	{id: 1, x: 100, y:590, w:70, h:70, color:'blue'},
	{id: 2, x: 100, y:510, w:70, h:70, color:'blue'},
	{id: 2, x: 140, y:430, w:70, h:70, color:'blue'},
	{id: 2, x: 180, y:670, w:70, h:70, color:'blue'},
	{id: 2, x: 180, y:590, w:70, h:70, color:'blue'},
	{id: 2, x: 180, y:510, w:70, h:70, color:'blue'},
	{id: 3, x: 700, y:670, w:70, h:70, color:'red'},
	{id: 4, x: 700, y:590, w:70, h:70, color:'red'},
	{id: 5, x: 700, y:510, w:70, h:70, color:'red'},
	{id: 5, x: 660, y:430, w:70, h:70, color:'red'},
	{id: 5, x: 620, y:670, w:70, h:70, color:'red'},
	{id: 5, x: 620, y:590, w:70, h:70, color:'red'},
	{id: 5, x: 620, y:510, w:70, h:70, color:'red'}
]

function newConnection(socket) {
	socket.on('mouse', mouseMsg);
	socket.on('movingUrPiece', movingUrPieceMsg);
	socket.on('getUrPieces', getUrPiecesMsg);
	socket.on('rollingUrDices', rollingUrDicesMsg);
	socket.on('camera', cameraImage);
	function cameraImage(data) {
		socket.broadcast.emit('camera', data);
	}
	function mouseMsg(data) {
		socket.broadcast.emit('mouse', data);
	}
	function movingUrPieceMsg(data) {
		//let index = pieceArray.findIndex((elem) => elem.id == data.id);
		if (data.index >= 0 && data.index < pieceArray.length)
		{
			pieceArray[data.index].x = data.x;
			pieceArray[data.index].y = data.y;
			socket.broadcast.emit('movingUrPiece', data);
		}
	}
	function getUrPiecesMsg(){
		socket.emit('getUrPieces', pieceArray);
	}
	function rollingUrDicesMsg(data){
		socket.broadcast.emit('rollingUrDices', data);
	}
}
