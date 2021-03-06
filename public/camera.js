'use strict';

let canvas;
let video;
let receiveVideo = null;
let socket;

let camReady = false;

function setup() {
	createCanvas(320, 240);
	video = createCapture(VIDEO, ready);
	video.size(width, height);
	socket = io({secure: true});
	//socket.on('camera', cameraImage);
	console.log(video.get().get());
}

function ready() {
	console.log("coucou");
	socket.on('camera', cameraImage);
	camReady = true;
}

function cameraImage(data) {
	console.log('Boum!');
	receiveVideo = data;
	console.log(receiveVideo);
}

function draw() {
	if (receiveVideo != null)
		image(receiveVideo, 0, 0, width * 2, height);
	if (camReady == true)
	{
		socket.emit('camera', video.get());
		console.log("bim");
	}
}