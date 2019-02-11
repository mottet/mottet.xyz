var socket;

var prevMouseX;
var prevMouseY;
var side;
var canvas;

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
	var newSide = floor((windowWidth < windowHeight ? windowWidth : windowHeight) * 0.95);
	if (newSide === side)
		return;
	
	loadPixels();
	var d = pixelDensity();
	var lengthNew = 4 * newSide * d * newSide * d;
	var newPixels = new Uint8ClampedArray(lengthNew);
	var lengthOld = 4 * side * d * side * d;
	var ratio = newSide / side;
	var ligneNew = 0;
	var ligneOld = 0;
	var nbCopyLigne = ratio;

	var newWidth = 4 * newSide * d * d;
	var oldWidth = 4 * side * d * d;

	while (ligneOld < side && ligneNew < newSide)
	{
		while (nbCopyLigne >= 1 && ligneNew < newSide)
		{
			var indexOld = ligneOld * oldWidth;
			var indexNew = ligneNew * newWidth;
			var nbCopyCol = ratio;
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
		var indexOld = (side - 1) * oldWidth;
		var indexNew = ligneNew * newWidth;
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

	var data = {
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

	var data = {
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