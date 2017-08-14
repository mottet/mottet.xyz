var fs = require('fs');
var http = require('http');
var https = require('https');

var privateKey  = fs.readFileSync('/etc/letsencrypt/live/www.mottet.xyz/privkey.pem');
var certificate = fs.readFileSync('/etc/letsencrypt/live/www.mottet.xyz/fullchain.pem');
var credentials = {key: privateKey, cert: certificate};

var express = require('express');
var enforce = require('express-sslify');
var app = express();

app.use(enforce.HTTPS());
app.use(express.static(__dirname + '/public'));

app.get('/camera', (req, res) => {
	res.send('camera.html');
});

var httpServer = http.createServer(app);
var httpsServer = https.createServer(credentials, app);

httpServer.listen(80);
httpsServer.listen(443);

console.log("Server is running");

var socket = require('socket.io');


var io = socket(httpsServer);
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
