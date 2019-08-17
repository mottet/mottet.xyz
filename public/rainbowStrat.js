'use strict';

let socket;

let board = [];
let sizeBoard = 7;

let pawns = [
	{'position': {'x':0,'y':3}, 'color':'blue', 'kill':'red'},
	{'position': {'x':3,'y':0}, 'color':'red', 'kill':'yellow'},
	{'position': {'x':6,'y':3}, 'color':'yellow', 'kill':'green'},
	{'position': {'x':3,'y':6}, 'color':'green', 'kill':'blue'}
];
let newPosition = [];
let pawnColor = 0;

let accessibleTales;

let button;

let move = [
	{'x':0,'y':-1},
	{'x':1,'y':0},
	{'x':0,'y':1},
	{'x':-1,'y':0}
];

let side;

function setup(){
	side = floor((windowWidth < windowHeight ? windowWidth : windowHeight) * 0.95);
	createCanvas(side, side);
	fill(51);
	stroke(142);
	strokeWeight(5);
	textSize(32);
	noLoop();

	for (let x = 0; x < sizeBoard; ++x) {
		board[x] = [];
		for (let y = 0; y < sizeBoard; ++y) {
			board[x][y] = 'grey';
		}
	}

	for (let i = 0; i < 0; ++i)
	{
		board[floor(random(sizeBoard))][floor(random(sizeBoard))] = 'blue';
		board[floor(random(sizeBoard))][floor(random(sizeBoard))] = 'red';
		board[floor(random(sizeBoard))][floor(random(sizeBoard))] = 'yellow';
		board[floor(random(sizeBoard))][floor(random(sizeBoard))] = 'green';
	}

	board[0][3] = 'blue';
	board[3][0] = 'red';
	board[6][3] = 'yellow';
	board[3][6] = 'green';

	accessibleTales = whatAccessible(pawns[pawnColor]);

	/*button = createButton('Roll the pigs!');
	button.position(19, 19);
	button.size(220,80);
	button.mousePressed(rollingDices);*/

	/*socket = io('https://mottet.xyz', {secure: true});
	//socket = io('http://localhost');
	socket.on('movingUrPiece', movingPiece);
	socket.on('getUrPieces', getPieces);
	socket.on('rollingUrDices', getResultDices);
	socket.emit('getUrPieces');*/
}



function whatAccessible(pawn) {
	let accessible = [pawn.position];
	//North
	let toTest = [];
	for (let i = 0; i < 4; ++i) {
		if (board[pawn.position.x + move[i].x] != undefined &&
			board[pawn.position.x + move[i].x][pawn.position.y + move[i].y] != undefined) {
			toTest.push({'x':pawn.position.x + move[i].x, 'y':pawn.position.y + move[i].y});
		}
	}
	toTest.forEach((tale) =>
	{
		if (board[tale.x][tale.y] === pawn.kill || board[tale.x][tale.y] === 'grey') {
			accessible.push(tale);
		}
		else if (board[tale.x][tale.y] === pawn.color) {
			accessible = findTerritory(tale, pawn.color, accessible);
		}
	});
	
	return accessible;
}

function findTerritory(position, color, table) {
	table.push(position);

	let toTest = [];
	move.forEach((moveTo)=>{
		if (board[position.x + moveTo.x] != undefined &&
			board[position.x + moveTo.x][position.y + moveTo.y] != undefined) {
			toTest.push({'x':position.x + moveTo.x, 'y':position.y + moveTo.y});
		}
	});
	toTest.forEach((tale) =>
	{
		if (board[tale.x][tale.y] == color &&
			table.find((elem) => elem.x == tale.x && elem.y == tale.y) == undefined) {
			table = findTerritory(tale, color, table);
		}
	});

	return table;
}

function mousePressed() {
	let clickTale = accessibleTales.find((val) => 
		val.x == floor(mouseX * sizeBoard / width) && val.y == floor(mouseY * sizeBoard / height)
	);
	if (clickTale != undefined) {
		newPosition[pawnColor] = clickTale;
		++pawnColor;
	}
	if (pawnColor >= pawns.length) {
		newPosition.forEach((val, index)=>{
			pawns[index].position = val;
		});
		let whoDie = [];
		pawns.forEach((pawn, index) => {
			let toCheck = index == pawns.length - 1 ? 0 : index + 1;
			if (pawn.position.x == pawns[toCheck].position.x && 
				pawn.position.y == pawns[toCheck].position.y) {
				whoDie.push(pawns[toCheck].color);
			}
		});
		whoDie.forEach((dead) => {
			pawns.splice(pawns.findIndex((pawn) => pawn.color === dead), 1);
			board.forEach((columnY) =>
				{
					columnY.forEach((tale, index) =>
					{
						if (tale === dead)
							columnY[index] = 'grey';
					});
				});
		});
		pawns.forEach((pawn, index)=>{
			board[pawn.position.x][pawn.position.y] = pawn.color;
			if (index == pawns.length - 1)
				pawn.kill = pawns[0].color;
			else
				pawn.kill = pawns[index + 1].color;
		});
		pawnColor = 0;
		newPosition = [];
	}
	if (pawns.length > 2) {
		accessibleTales = whatAccessible(pawns[pawnColor]);
	} else {
		accessibleTales = [];
	}
	draw();
  	// prevent default
  	return false;
}

function draw(){
	
	board.forEach((columnY, indexX) =>
	{
		columnY.forEach((tale, indexY) =>
		{
			fill(color(tale));
			rect(
					indexX * width / sizeBoard,
					indexY * height / sizeBoard,
					width / sizeBoard,
					height / sizeBoard
				);
		});
	});
	if (pawns.length > 2) {
		fill(color(pawns[pawnColor].color));
		ellipse(
			(pawns[pawnColor].position.x + 0.5) * width / sizeBoard,
			(pawns[pawnColor].position.y + 0.5) * height / sizeBoard,
			width / sizeBoard,
			height / sizeBoard
		);
	}
	accessibleTales.forEach((elem) =>
	{
		fill(255);
		rect(
				elem.x * width / sizeBoard,
				elem.y * height / sizeBoard,
				width / sizeBoard / 2,
				height / sizeBoard / 2
			);
	});
}

function windowResized() {
	side = floor((windowWidth < windowHeight ? windowWidth : windowHeight) * 0.95);
  	resizeCanvas(side, side);
}