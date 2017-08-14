
var nbXCases;
var nbYCases;

var cases = [];
var xPos = [];
var yPos = [];

function setup(){
	createCanvas(windowWidth * 0.95, windowHeight * 0.95);
	nbXCases = floor(100 / displayDensity());
	nbYCases = floor(nbXCases * height / width);
	background(51);

	stroke(255, 0 , 100);
	strokeWeight(5);
	
	for (var x = 0; x < nbXCases; ++x) {
		for (var y = 0; y < nbYCases; ++y) {
			cases[x + y * nbXCases] = 0;
			rect(x * width / nbXCases, y * height / nbYCases, width / nbXCases, height / nbYCases);
		}
	}

	xPos[0] = floor(random(0, nbXCases));
	yPos[0] = floor(random(0, nbYCases));
	cases[xPos[0] + yPos[0] * nbXCases] = 1;

	fill(51);
	rect(xPos[0] * width / nbXCases, yPos[0] * height / nbYCases, width / nbXCases, height / nbYCases);
	stroke(51);
	strokeWeight(width / nbXCases * 0.8);

	frameRate(30);
}

function draw(){
	for (var i = xPos.length - 1; i >= 0; i--) {
		//console.log();
		var possible = [];
		if (yPos[i] > 0 && cases[xPos[i] + (yPos[i] - 1) * nbXCases] == 0)
			possible.push([xPos[i], (yPos[i] - 1)]);
		if (yPos[i] < nbYCases - 1 && cases[xPos[i] + (yPos[i] + 1) * nbXCases] == 0)
			possible.push([xPos[i], (yPos[i] + 1)]);
		if (xPos[i] > 0 && cases[(xPos[i] - 1) + yPos[i] * nbXCases] == 0)
			possible.push([(xPos[i] - 1), yPos[i]]);
		if (xPos[i] < nbXCases - 1 && cases[(xPos[i] + 1) + yPos[i]  * nbXCases] == 0)
			possible.push([(xPos[i] + 1), yPos[i]]);
		if (possible.length == 0)
		{
			xPos.slice(i, 1);
			yPos.slice(i, 1);
		}
		else
		{
			var pick = floor(random(0, possible.length));
			var prevX = xPos[i];
			var prevY = yPos[i];
			xPos[i] = possible[pick][0];
			yPos[i] = possible[pick][1];
			cases[xPos[i] + yPos[i] * nbXCases] = 1;
			//rect(xPos[i] * width / nbXCases, yPos[i] * height / nbYCases, width / nbXCases, height / nbYCases);
			line((prevX + 0.5) * width / nbXCases, (prevY + 0.5) * height / nbYCases,
				(possible[pick][0] + 0.5) * width / nbXCases, (possible[pick][1] + 0.5) * height / nbYCases);
			possible.slice(pick, 1);
			if (possible.length != 0 && random() < 0.2)
			{
 				pick = floor(random(0, possible.length));
 				cases[possible[pick][0] + possible[pick][1] * nbXCases] = 1;
				//rect(possible[pick][0] * width / nbXCases, possible[pick][1] * height / nbYCases, width / nbXCases, height / nbYCases);
				line((prevX + 0.5) * width / nbXCases, (prevY + 0.5) * height / nbYCases,
				(possible[pick][0] + 0.5) * width / nbXCases, (possible[pick][1] + 0.5) * height / nbYCases);
 				xPos.push(possible[pick][0]);
 				yPos.push(possible[pick][1]);
			}
		}
	}
}
