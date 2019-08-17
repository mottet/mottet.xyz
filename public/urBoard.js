'use strict';

let socket;

const board = [
	{id: 0, x: 360, y:10,  w:80, h:80, color:'white'},
	{id: 1, x: 360, y:100, w:80, h:80, color:'white'},
	{id: 0, x: 270, y:10 , w:80, h:80, color:'white'},
	{id: 1, x: 270, y:100, w:80, h:80, color:'yellow'},
	{id: 0, x: 450, y:10 , w:80, h:80, color:'white'},
	{id: 1, x: 450, y:100, w:80, h:80, color:'yellow'},
	{id: 2, x: 360, y:190, w:80, h:80, color:'white'},
	{id: 3, x: 360, y:280, w:80, h:80, color:'white'},
	{id: 4, x: 360, y:370, w:80, h:80, color:'yellow'},
	{id: 5, x: 360, y:460, w:80, h:80, color:'white'},
	{id: 6, x: 360, y:550, w:80, h:80, color:'white'},
	{id: 7, x: 360, y:640, w:80, h:80, color:'white'},
	{id: 4, x: 270, y:370, w:80, h:80, color:'white'},
	{id: 5, x: 270, y:460, w:80, h:80, color:'white'},
	{id: 6, x: 270, y:550, w:80, h:80, color:'white'},
	{id: 7, x: 270, y:640, w:80, h:80, color:'yellow'},
	{id: 4, x: 450, y:370, w:80, h:80, color:'white'},
	{id: 5, x: 450, y:460, w:80, h:80, color:'white'},
	{id: 6, x: 450, y:550, w:80, h:80, color:'white'},
	{id: 7, x: 450, y:640, w:80, h:80, color:'yellow'}
]

const dices = [
	'0',
	'1','1','1','1',
	'2','2','2','2','2','2',
	'3','3','3','3',
	'4'
];

let pieceArray = [];

let selectPiece = -1;

let button;

let resultDices = '9';
let isRolling = false;

let side;

function setup(){
	side = floor((windowWidth < windowHeight ? windowWidth : windowHeight) * 0.95);
	createCanvas(side, side);
	noStroke();
	textSize(floor(32/800*side));

	button = createButton('Roll the pigs!');
	button.position(19/800*side, 19/800*side);
	button.size(220/800*side,80/800*side);
	button.mousePressed(rollingDices);

	socket = io({secure: true});
	socket.on('movingUrPiece', movingPiece);
	socket.on('getUrPieces', getPieces);
	socket.on('rollingUrDices', getResultDices);
	socket.emit('getUrPieces');
}

function rollingDices()
{
	isRolling = !isRolling;
	let data = {
		isRolling,
	};
	socket.emit('rollingUrDices', data);
}

function getPieces(data)
{
	pieceArray = data;
}

function getResultDices(data)
{
	isRolling = data.isRolling;
	if (!isRolling)
		resultDices = data.resultDices;
}

function draw(){
	background(51);
	board.forEach((elem) =>
	{
		fill(color(elem.color));
		rect(elem.x/800*side, elem.y/800*side, elem.w/800*side, elem.h/800*side);	
	});
	pieceArray.forEach((elem) =>
	{
		fill(color(elem.color));
		ellipse(elem.x/800*side, elem.y/800*side, elem.w/800*side, elem.h/800*side);	
	});
	if (isRolling)
	{
		resultDices = random(dices);
	}
	fill(255);
	text(resultDices, 700/800*side, 60/800*side);
}

function windowResized() {
	side = floor((windowWidth < windowHeight ? windowWidth : windowHeight) * 0.95);

	textSize(floor(32/800*side));
	button.position(19/800*side, 19/800*side);
	button.size(220/800*side,80/800*side);

  	resizeCanvas(side, side);
}

function movingPiece(data){
	pieceArray[data.index].x = data.x;
	pieceArray[data.index].y = data.y;
}



function mousePressed() {
  selectPiece = pieceArray.findIndex((elem) => 
  	abs(elem.x/800*side - mouseX) < elem.w/800*side / 2 && abs(elem.y/800*side - mouseY) < elem.h/800*side / 2
  );
  // prevent default
  return false;
}

function mouseDragged(){
	if (selectPiece >= 0)
	{
		let newX = mouseX/side*800;
		let newY = mouseY/side*800;

		if (newX < 0) {
			newX = 0;
		} else if (newX > 800) {
			newX = 800
		}
		if (newY < 0) {
			newY = 0;
		} else if (newY > 800) {
			newY = 800
		}

		let data = {
			index: selectPiece,
			x: newX,
			y: newY
		}

		socket.emit('movingUrPiece', data);

		pieceArray[selectPiece].x = newX;
		pieceArray[selectPiece].y = newY;
	}
	// prevent default
  	return false;
}



function mouseReleased() {
  	selectPiece = -1;
  	// prevent default
  	return false;
}