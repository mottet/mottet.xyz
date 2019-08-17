'use strict';

let socket;

let prevMouseX;
let prevMouseY;
let side;
let canvas;

function setup(){
	side = floor((windowWidth < windowHeight ? windowWidth : windowHeight) * 0.95);
	canvas = createCanvas(side, side);
	background(51);

	strokeWeight(side / 80);
	noLoop();
	
	socket = io();
	socket.on('mouse', newDrawing);
}

function windowResized() {
	let newSide = floor((windowWidth < windowHeight ? windowWidth : windowHeight) * 0.95);
	if (newSide === side)
		return;
	
	loadPixels();
	let d = pixelDensity();
	let lengthNew = 4 * newSide * d * newSide * d;
	let newPixels = new Uint8ClampedArray(lengthNew);
	let lengthOld = 4 * side * d * side * d;
	let ratio = newSide / side;
	let ligneNew = 0;
	let ligneOld = 0;
	let nbCopyLigne = ratio;
	let nbCopyCol = ratio;

	let newWidth = 4 * newSide * d * d;
	let oldWidth = 4 * side * d * d;

	while (ligneOld < side && ligneNew < newSide)
	{
		while (nbCopyLigne >= 1 && ligneNew < newSide)
		{
			let indexOld = ligneOld * oldWidth;
			let indexNew = ligneNew * newWidth;
			let nbCopyCol = ratio;
			while (indexOld < (ligneOld + 1) * oldWidth && indexNew < (ligneNew + 1) * newWidth)
			{
				while (nbCopyCol >= 1 && indexNew < (ligneNew + 1) * newWidth)
				{
					newPixels[indexNew] = pixels[indexOld];
					newPixels[indexNew + 1] = pixels[indexOld + 1];
					newPixels[indexNew + 2] = pixels[indexOld + 2];
					newPixels[indexNew + 3] = pixels[indexOld + 3];
					indexNew += 4;
					nbCopyCol -= 1;
				}
				nbCopyCol += ratio;
				indexOld += 4;
			}
			while (indexNew < (ligneNew + 1) * newWidth)
			{
				newPixels[indexNew] = pixels[lengthOld - 4];
				newPixels[indexNew + 1] = pixels[lengthOld - 3];
				newPixels[indexNew + 2] = pixels[lengthOld - 2];
				newPixels[indexNew + 3] = pixels[lengthOld - 1];
				indexNew += 4;
			}
			nbCopyLigne -= 1;
			++ligneNew;
		}
		nbCopyLigne += ratio;
		++ligneOld
	}
	while(ligneNew < newSide)
	{
		let indexOld = (side - 1) * oldWidth;
		let indexNew = ligneNew * newWidth;
		while (indexOld < (ligneOld + 1) * oldWidth && indexNew < (ligneNew + 1) * newWidth)
		{
			while (nbCopyCol >= 1 && indexNew < (ligneNew + 1) * newWidth)
			{
				newPixels[indexNew] = pixels[indexOld];
				newPixels[indexNew + 1] = pixels[indexOld + 1];
				newPixels[indexNew + 2] = pixels[indexOld + 2];
				newPixels[indexNew + 3] = pixels[indexOld + 3];
				indexNew += 4;
				nbCopyCol -= 1;
			}
			nbCopyCol += ratio;
			indexOld += 4;
		}
		while (indexNew < (ligneNew + 1) * newWidth)
		{
			newPixels[indexNew] = pixels[lengthOld - 4];
			newPixels[indexNew + 1] = pixels[lengthOld - 3];
			newPixels[indexNew + 2] = pixels[lengthOld - 2];
			newPixels[indexNew + 3] = pixels[lengthOld - 1];
			indexNew += 4;
		}
		++ligneNew;
	}

	side = newSide;
  	resizeCanvas(side, side);
  	loadPixels();
  	newPixels.forEach((val, index) => {
  		pixels[index] = val;
  	});
  	updatePixels();
}

function newDrawing(data){
	stroke(255, 0 , 100);
	line(data.prevX * side, data.prevY * side, data.x * side, data.y * side);
}

function mousePressed(){
	prevMouseX = mouseX;
	prevMouseY = mouseY;

	return false;
}

function mouseDragged(){

	let data = {
		prevX: prevMouseX / side,
		prevY: prevMouseY / side,
		x: mouseX / side,
		y: mouseY / side
	}

	socket.emit('mouse', data);

	stroke(255);
	line(prevMouseX, prevMouseY, mouseX, mouseY);

	prevMouseX = mouseX;
	prevMouseY = mouseY;

	return false;
}

function mouseReleased(){

	let data = {
		prevX: prevMouseX / side,
		prevY: prevMouseY / side,
		x: mouseX / side,
		y: mouseY / side
	}

	socket.emit('mouse', data);

	stroke(255);
	line(prevMouseX, prevMouseY, mouseX, mouseY);

	prevMouseX = mouseX;
	prevMouseY = mouseY;

	return false;
}