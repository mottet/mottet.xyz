// Build-time artwork only: the painted interiors of the five board stations.
// Each is a 408-unit square drawn through a seeded random source, so the same
// source produces the same picture. Run through build-board-artwork.cjs.
'use strict';

const TAU = Math.PI * 2;
const SIZE = 408;

function seededRandom(seed) {
	return function () {
		seed = (seed * 1664525 + 1013904223) >>> 0;
		return seed / 4294967296;
	};
}

// A soft-edged irregular blob: a few stacked make a gouache dab.
function dab(context, rand, x, y, radius, color, alpha = 1, points = 9) {
	context.save();
	context.globalAlpha = alpha;
	context.fillStyle = color;
	context.beginPath();
	for (let i = 0; i < points; i++) {
		const angle = i / points * TAU;
		const r = radius * (.78 + rand() * .44);
		const px = x + Math.cos(angle) * r, py = y + Math.sin(angle) * r;
		if (i) context.quadraticCurveTo(x + Math.cos(angle - TAU / points / 2) * r * 1.08, y + Math.sin(angle - TAU / points / 2) * r * 1.08, px, py);
		else context.moveTo(px, py);
	}
	context.closePath();
	context.fill();
	context.restore();
}

// Paper and cloth: short fibres and specks in two tones.
function fibres(context, rand, count, light, dark, length = 6) {
	context.save();
	context.lineWidth = .8;
	for (let i = 0; i < count; i++) {
		const x = rand() * SIZE - SIZE / 2, y = rand() * SIZE - SIZE / 2, a = rand() * TAU, l = rand() * length;
		context.strokeStyle = rand() < .5 ? light : dark;
		context.globalAlpha = .08 + rand() * .14;
		context.beginPath();
		context.moveTo(x, y);
		context.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
		context.stroke();
	}
	context.restore();
}

// Woodcut hatching inside the current clip, angled, with slight wobble.
function hatch(context, rand, angle, spacing, color, alpha = .25, width = 1) {
	context.save();
	context.rotate(angle);
	context.strokeStyle = color;
	context.globalAlpha = alpha;
	context.lineWidth = width;
	for (let y = -SIZE; y < SIZE; y += spacing) {
		context.beginPath();
		context.moveTo(-SIZE, y + rand());
		for (let x = -SIZE; x <= SIZE; x += 40) context.lineTo(x, y + (rand() - .5) * 1.6);
		context.stroke();
	}
	context.restore();
}

function grain(context, rand, amount) {
	const image = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
	const data = image.data;
	for (let i = 0; i < data.length; i += 4) {
		const n = (rand() - .5) * amount;
		data[i] += n; data[i + 1] += n; data[i + 2] += n;
	}
	context.putImageData(image, 0, 0);
}

function vignette(context, inner, color = '#1f3329', alpha = .5) {
	const g = context.createRadialGradient(0, 0, inner, 0, 0, SIZE * .72);
	g.addColorStop(0, 'rgba(0,0,0,0)');
	g.addColorStop(1, color);
	context.save();
	context.globalAlpha = alpha;
	context.fillStyle = g;
	context.fillRect(-SIZE / 2, -SIZE / 2, SIZE, SIZE);
	context.restore();
}

function wood(context, rand, base, light, dark) {
	context.fillStyle = base;
	context.fillRect(-SIZE / 2, -SIZE / 2, SIZE, SIZE);
	for (let i = 0; i < 70; i++) {
		const y = -SIZE / 2 + rand() * SIZE, amp = 4 + rand() * 10, w = .6 + rand() * 2.2;
		context.strokeStyle = rand() < .5 ? light : dark;
		context.globalAlpha = .12 + rand() * .22;
		context.lineWidth = w;
		context.beginPath();
		for (let x = -SIZE / 2; x <= SIZE / 2; x += 8) context.lineTo(x, y + Math.sin(x / 60 + i) * amp + Math.sin(x / 13 + i * 3) * 1.5);
		context.stroke();
	}
	context.globalAlpha = 1;
}

function rose(context, rand, x, y, r, petal, deep, light) {
	for (let i = 0; i < 3; i++) dab(context, rand, x + (rand() - .5) * r * .4, y + (rand() - .5) * r * .4, r * (1 - i * .18), i ? light : petal, .85, 8);
	context.save();
	context.translate(x, y);
	context.strokeStyle = deep;
	context.lineWidth = r * .12;
	context.lineCap = 'round';
	context.beginPath();
	for (let t = 0; t < TAU * 2.4; t += .2) {
		const d = r * .1 + t * r * .055;
		context.lineTo(Math.cos(t) * d, Math.sin(t) * d);
	}
	context.stroke();
	context.restore();
}

function leafDab(context, rand, x, y, len, angle, fill, vein) {
	context.save();
	context.translate(x, y);
	context.rotate(angle);
	context.fillStyle = fill;
	context.beginPath();
	context.moveTo(0, 0);
	context.quadraticCurveTo(len * .38, -len * .32, len, 0);
	context.quadraticCurveTo(len * .38, len * .32, 0, 0);
	context.fill();
	context.strokeStyle = vein;
	context.lineWidth = .8;
	context.beginPath();
	context.moveTo(len * .1, 0);
	context.lineTo(len * .9, 0);
	context.stroke();
	context.restore();
}

const scenes = {
	// A hedge maze from above: gravel, clipped box walls, roses at the dead ends.
	garden(context, rand) {
		context.fillStyle = '#d8cea8';
		context.fillRect(-SIZE / 2, -SIZE / 2, SIZE, SIZE);
		fibres(context, rand, 5000, '#f2ead0', '#a99c74', 3);
		for (let i = 0; i < 700; i++) dab(context, rand, rand() * SIZE - SIZE / 2, rand() * SIZE - SIZE / 2, 1 + rand() * 1.6, rand() < .5 ? '#bfb28a' : '#e9e0c0', .5, 6);
		const walls = [[[-150, -90], [-30, -90], [-30, -30], [-90, -30], [-90, 30], [-30, 30]], [[-150, -30], [-110, -30]], [[-90, -150], [-90, -90]], [[-30, -150], [-30, -90], [30, -90], [30, -30]], [[90, -150], [90, -90], [150, -90]], [[90, -30], [30, -30], [30, 90], [-30, 90], [-30, 150]], [[90, 30], [150, 30]], [[90, 30], [90, 90], [150, 90]], [[-150, 30], [-110, 30], [-110, 90], [-90, 90]], [[-150, 90], [-130, 90]], [[-90, 150], [-90, 90]], [[30, 150], [30, 110]], [[90, 150], [90, 110]]];
		const draw = (offset, color, width) => {
			context.strokeStyle = color;
			context.lineWidth = width;
			context.lineCap = 'round';
			context.lineJoin = 'round';
			for (const wall of walls) {
				context.beginPath();
				wall.forEach(([x, y], i) => context[i ? 'lineTo' : 'moveTo'](x + offset, y + offset));
				context.stroke();
			}
		};
		context.globalAlpha = .35;
		draw(7, '#5f5a3e', 24);
		context.globalAlpha = 1;
		draw(0, '#3f5c3d', 22);
		for (const wall of walls) {
			for (let i = 1; i < wall.length; i++) {
				const [ax, ay] = wall[i - 1], [bx, by] = wall[i];
				const steps = Math.hypot(bx - ax, by - ay) / 5;
				for (let s = 0; s <= steps; s++) {
					const t = s / steps, x = ax + (bx - ax) * t + (rand() - .5) * 14, y = ay + (by - ay) * t + (rand() - .5) * 14;
					dab(context, rand, x, y, 3 + rand() * 3.5, ['#5f7f52', '#7f9a66', '#a3b982', '#4b6a46'][Math.floor(rand() * 4)], .85, 6);
				}
			}
		}
		for (const [x, y] of [[-110, -30], [150, -90], [30, -30], [-130, 90], [90, 30], [-90, 150], [30, 110], [-150, -90], [150, 90]]) {
			for (let k = 0; k < 4; k++) leafDab(context, rand, x, y, 14, rand() * TAU, '#6f8f5e', '#a8c08c');
			rose(context, rand, x + (rand() - .5) * 6, y + (rand() - .5) * 6, 10 + rand() * 4, '#c48f93', '#8a5a60', '#e3bcbd');
		}
		// A small basin at the heart of the maze.
		dab(context, rand, 0, 2, 20, '#9a9a84', 1, 12);
		context.fillStyle = '#b9c9c6';
		context.beginPath(); context.arc(0, 0, 15, 0, TAU); context.fill();
		context.strokeStyle = '#e4ecea'; context.lineWidth = 1.2;
		context.beginPath(); context.arc(-3, -3, 7, 0, TAU); context.stroke();
		context.save();
		context.beginPath(); context.arc(0, 0, SIZE / 2, 0, TAU); context.clip();
		hatch(context, rand, .7, 5, '#6d6a4c', .07);
		context.restore();
		vignette(context, 120, '#2f4a2c', .45);
	},

	// The Royal Game of Ur laid on a walnut table under a warm lamp.
	salon(context, rand) {
		wood(context, rand, '#5c3f2d', '#8a6042', '#36241a');
		const lamp = context.createRadialGradient(-80, -120, 10, -80, -120, 360);
		lamp.addColorStop(0, 'rgba(255,225,160,.45)'); lamp.addColorStop(1, 'rgba(255,225,160,0)');
		context.fillStyle = lamp; context.fillRect(-SIZE / 2, -SIZE / 2, SIZE, SIZE);
		const tiles = [];
		for (let row = 0; row < 8; row++) for (let col = 0; col < 3; col++) {
			if (col !== 1 && (row === 4 || row === 5)) continue;
			tiles.push({ x: (col - 1) * 46, y: (row - 3.5) * 46 - 14, rosette: (row === 0 && col !== 1) || (row === 3 && col === 1) || (row === 6 && col !== 1) });
		}
		for (const tile of tiles) {
			context.save();
			context.translate(tile.x, tile.y);
			context.fillStyle = 'rgba(20,10,5,.4)';
			context.fillRect(-20, -17, 42, 42);
			const shell = context.createLinearGradient(-21, -21, 21, 21);
			shell.addColorStop(0, '#f5ecd2'); shell.addColorStop(1, '#d9c89c');
			context.fillStyle = shell;
			context.fillRect(-21, -21, 42, 42);
			context.strokeStyle = '#8c7349'; context.lineWidth = 1.4; context.strokeRect(-21, -21, 42, 42);
			context.strokeStyle = 'rgba(255,255,255,.7)'; context.lineWidth = 1;
			context.beginPath(); context.moveTo(-19, 19); context.lineTo(-19, -19); context.lineTo(19, -19); context.stroke();
			for (let i = 0; i < 40; i++) { context.fillStyle = rand() < .5 ? 'rgba(140,115,73,.18)' : 'rgba(255,255,255,.25)'; context.fillRect(-20 + rand() * 40, -20 + rand() * 40, 1.2, 1.2); }
			if (tile.rosette) {
				context.fillStyle = '#2f4f80';
				for (let i = 0; i < 8; i++) {
					context.save(); context.rotate(i * TAU / 8);
					context.beginPath(); context.moveTo(0, 0); context.bezierCurveTo(-5, -4, -5, -14, 0, -17); context.bezierCurveTo(5, -14, 5, -4, 0, 0); context.fill();
					context.restore();
				}
				context.fillStyle = '#d9b55a'; context.beginPath(); context.arc(0, 0, 3.2, 0, TAU); context.fill();
			} else {
				for (const [dx, dy, c] of [[-9, -9, '#2f4f80'], [9, -9, '#a0565c'], [-9, 9, '#a0565c'], [9, 9, '#2f4f80']]) { context.fillStyle = c; context.beginPath(); context.arc(dx, dy, 3.2, 0, TAU); context.fill(); }
				context.strokeStyle = 'rgba(47,79,128,.5)'; context.lineWidth = 1; context.strokeRect(-13, -13, 26, 26);
			}
			context.restore();
		}
		const counter = (x, y, color, edge) => {
			context.fillStyle = 'rgba(0,0,0,.35)'; context.beginPath(); context.arc(x + 2, y + 3, 14, 0, TAU); context.fill();
			const g = context.createRadialGradient(x - 5, y - 5, 2, x, y, 15);
			g.addColorStop(0, edge); g.addColorStop(1, color);
			context.fillStyle = g; context.beginPath(); context.arc(x, y, 14, 0, TAU); context.fill();
			context.strokeStyle = 'rgba(0,0,0,.4)'; context.lineWidth = 1; context.stroke();
			context.fillStyle = '#efe4c8';
			for (const [dx, dy] of [[-5, -5], [5, -5], [0, 0], [-5, 5], [5, 5]]) { context.beginPath(); context.arc(x + dx, y + dy, 2, 0, TAU); context.fill(); }
		};
		for (let i = 0; i < 3; i++) { counter(-120, -60 + i * 36, '#254c6b', '#6f93b5'); counter(120, -60 + i * 36, '#9e5844', '#d4927c'); }
		for (const [x, y, a] of [[-118, 75, 0], [118, 75, .4]]) {
			context.save(); context.translate(x, y); context.rotate(a);
			context.fillStyle = 'rgba(0,0,0,.3)'; context.beginPath(); context.moveTo(2, -18); context.lineTo(20, 12); context.lineTo(-16, 12); context.fill();
			const g = context.createLinearGradient(-18, 0, 18, 0); g.addColorStop(0, '#f3e9cf'); g.addColorStop(1, '#cdb98c');
			context.fillStyle = g; context.beginPath(); context.moveTo(0, -20); context.lineTo(18, 10); context.lineTo(-18, 10); context.closePath(); context.fill();
			context.strokeStyle = '#8c7349'; context.lineWidth = 1.2; context.stroke();
			context.strokeStyle = 'rgba(140,115,73,.6)'; context.beginPath(); context.moveTo(0, -20); context.lineTo(0, 10); context.stroke();
			context.fillStyle = '#2f4f80'; context.beginPath(); context.arc(0, -13, 2.4, 0, TAU); context.fill();
			context.restore();
		}
		vignette(context, 110, '#1a0f08', .6);
	},

	// A sheet pinned to the drawing board: an iris in ink, washed with colour.
	studio(context, rand) {
		wood(context, rand, '#6b4a33', '#9a6f4c', '#3f2a1d');
		context.save();
		context.rotate(-.06);
		context.fillStyle = 'rgba(0,0,0,.35)'; context.fillRect(-176, -166, 352, 352);
		context.fillStyle = '#f1e9d3'; context.fillRect(-180, -172, 352, 352);
		context.save(); context.beginPath(); context.rect(-180, -172, 352, 352); context.clip();
		fibres(context, rand, 7000, '#fffaf0', '#c9bb96', 4);
		context.strokeStyle = 'rgba(140,115,73,.14)'; context.lineWidth = .6;
		for (let x = -180; x <= 172; x += 22) { context.beginPath(); context.moveTo(x, -172); context.lineTo(x, 180); context.stroke(); }
		for (let y = -172; y <= 180; y += 22) { context.beginPath(); context.moveTo(-180, y); context.lineTo(172, y); context.stroke(); }
		// Washes under the drawing first.
		for (let i = 0; i < 5; i++) dab(context, rand, -8 + (rand() - .5) * 20, -80 + (rand() - .5) * 20, 44, '#c99aa0', .22, 10);
		for (let i = 0; i < 4; i++) dab(context, rand, -40 + rand() * 30, 30 + rand() * 60, 40, '#9fb08a', .2, 10);
		for (let i = 0; i < 3; i++) dab(context, rand, 30 + rand() * 20, 40 + rand() * 50, 34, '#9fb08a', .2, 10);
		context.strokeStyle = '#2b3a33'; context.lineCap = 'round'; context.lineJoin = 'round';
		const stroke = (points, width) => {
			context.lineWidth = width;
			context.beginPath();
			points.forEach((p, i) => i ? context.quadraticCurveTo(p[0], p[1], (p[0] + (points[i + 1] || p)[0]) / 2, (p[1] + (points[i + 1] || p)[1]) / 2) : context.moveTo(p[0], p[1]));
			context.stroke();
		};
		stroke([[-6, 150], [-4, 90], [-2, 20], [-4, -40]], 2.6);
		stroke([[-6, 140], [-40, 100], [-70, 40], [-60, 0], [-30, 30], [-8, 90]], 2);
		stroke([[0, 130], [40, 90], [70, 20], [55, -10], [30, 40], [4, 100]], 2);
		// The three falls and three standards of the iris.
		for (const s of [-1, 1]) stroke([[-4 * s, -40], [-50 * s, -20], [-80 * s, -60], [-60 * s, -100], [-20 * s, -70], [-4 * s, -44]], 2.2);
		stroke([[-4, -42], [-36, -110], [-10, -150], [16, -150], [40, -110], [0, -44]], 2.2);
		stroke([[-4, -50], [-30, -70], [-44, -60], [-24, -40]], 1.6);
		stroke([[0, -50], [26, -70], [40, -60], [20, -40]], 1.6);
		for (let i = 0; i < 14; i++) { context.lineWidth = 1; context.beginPath(); context.moveTo(-70 + i * 4, -62 + i * 2); context.lineTo(-56 + i * 3, -96 + i * 2.5); context.stroke(); }
		for (let i = 0; i < 14; i++) { context.lineWidth = 1; context.beginPath(); context.moveTo(70 - i * 4, -62 + i * 2); context.lineTo(56 - i * 3, -96 + i * 2.5); context.stroke(); }
		for (let i = 0; i < 10; i++) { context.lineWidth = .9; context.beginPath(); context.moveTo(-26 + i * 5, -126 + (i % 2) * 6); context.lineTo(-22 + i * 5, -80 + (i % 3) * 4); context.stroke(); }
		context.fillStyle = '#c9a44a'; dab(context, rand, -2, -62, 6, '#d9b55a', 1, 7);
		context.strokeStyle = 'rgba(169,105,109,.9)'; context.lineWidth = 1.4;
		for (const line of [[-150, 120, -120, 150], [-150, 140, -124, 160]]) { context.beginPath(); context.moveTo(line[0], line[1]); context.lineTo(line[2], line[3]); context.stroke(); }
		// A note in the margin: the iris named in a loose hand.
		context.strokeStyle = '#2b3a33'; context.lineWidth = 1.1;
		for (let i = 0; i < 40; i++) { context.beginPath(); context.moveTo(-150 + i * 2.6, 144 + Math.sin(i * 1.7) * 3); context.lineTo(-148 + i * 2.6, 146 + Math.cos(i * 1.3) * 3); context.stroke(); }
		context.restore();
		for (const [x, y] of [[-168, -160], [160, -164], [-164, 168], [164, 164]]) { context.fillStyle = '#b89650'; context.beginPath(); context.arc(x, y, 4, 0, TAU); context.fill(); context.fillStyle = 'rgba(255,255,255,.5)'; context.beginPath(); context.arc(x - 1, y - 1, 1.5, 0, TAU); context.fill(); }
		context.restore();
		// Pencil and ink across the corner of the sheet.
		context.save(); context.translate(118, -118); context.rotate(.6);
		context.fillStyle = 'rgba(0,0,0,.3)'; context.fillRect(-70, -4, 140, 14);
		const pencil = context.createLinearGradient(0, -8, 0, 8); pencil.addColorStop(0, '#e6c56a'); pencil.addColorStop(.5, '#c9a44a'); pencil.addColorStop(1, '#8c6a2d');
		context.fillStyle = pencil; context.fillRect(-72, -8, 128, 16);
		context.fillStyle = '#efe4c8'; context.beginPath(); context.moveTo(56, -8); context.lineTo(80, 0); context.lineTo(56, 8); context.fill();
		context.fillStyle = '#2b3a33'; context.beginPath(); context.moveTo(72, -3); context.lineTo(80, 0); context.lineTo(72, 3); context.fill();
		context.fillStyle = '#b98b86'; context.fillRect(-80, -8, 10, 16);
		context.restore();
		context.save(); context.translate(-130, 118);
		context.fillStyle = 'rgba(0,0,0,.35)'; context.beginPath(); context.ellipse(4, 26, 26, 8, 0, 0, TAU); context.fill();
		const ink = context.createLinearGradient(-24, 0, 24, 0); ink.addColorStop(0, '#223730'); ink.addColorStop(.4, '#4b6a60'); ink.addColorStop(1, '#1b2a22');
		context.fillStyle = ink; context.beginPath(); context.moveTo(-10, -30); context.lineTo(10, -30); context.lineTo(12, -18); context.quadraticCurveTo(26, -8, 24, 14); context.quadraticCurveTo(22, 28, 0, 28); context.quadraticCurveTo(-22, 28, -24, 14); context.quadraticCurveTo(-26, -8, -12, -18); context.fill();
		context.fillStyle = '#c9ab6a'; context.fillRect(-11, -34, 22, 6);
		context.fillStyle = 'rgba(255,255,255,.35)'; context.beginPath(); context.ellipse(-10, 0, 4, 12, .2, 0, TAU); context.fill();
		context.restore();
		for (let i = 0; i < 12; i++) dab(context, rand, -100 + rand() * 30, 100 + rand() * 24, 1 + rand() * 2.5, '#2b3a33', .8, 6);
		vignette(context, 150, '#2a1a10', .5);
	},

	// Deep space over a pixel mine: nebula washes, stars, a ringed planet.
	music(context, rand) {
		const sky = context.createRadialGradient(40, -60, 10, 0, 0, 300);
		sky.addColorStop(0, '#36336c'); sky.addColorStop(.6, '#1c1b40'); sky.addColorStop(1, '#0d0c22');
		context.fillStyle = sky; context.fillRect(-SIZE / 2, -SIZE / 2, SIZE, SIZE);
		for (let i = 0; i < 40; i++) dab(context, rand, -120 + rand() * 240, -140 + rand() * 200, 30 + rand() * 50, rand() < .5 ? '#5a3f7a' : '#2f6b68', .07, 10);
		for (let i = 0; i < 260; i++) { context.fillStyle = `rgba(243,228,178,${.3 + rand() * .7})`; const s = rand() < .8 ? 1.2 : 2.2; context.fillRect(Math.floor(rand() * SIZE - SIZE / 2), Math.floor(rand() * SIZE - SIZE / 2), s, s); }
		for (const [x, y, s] of [[-150, -120, 5], [-60, -170, 4], [40, -150, 6], [140, -130, 4], [-170, -20, 5], [170, 20, 4], [-120, 60, 3], [100, 90, 5], [-40, 120, 3], [60, -60, 3], [-100, -60, 4]]) {
			context.fillStyle = '#f3e4b2'; context.fillRect(x - s / 2, y - s * 1.5, s, s * 3); context.fillRect(x - s * 1.5, y - s / 2, s * 3, s);
			context.fillStyle = 'rgba(243,228,178,.35)'; context.fillRect(x - s * 2.5, y - s / 2, s * 5, s); context.fillRect(x - s / 2, y - s * 2.5, s, s * 5);
		}
		// The planet: a pixel world with a dusty ring.
		context.save(); context.translate(70, -70);
		context.fillStyle = 'rgba(0,0,0,.4)'; context.beginPath(); context.arc(5, 6, 40, 0, TAU); context.fill();
		const planet = context.createRadialGradient(-12, -14, 4, 0, 0, 40); planet.addColorStop(0, '#8ec27a'); planet.addColorStop(.7, '#4f8a4c'); planet.addColorStop(1, '#2a4f33');
		context.fillStyle = planet; context.beginPath(); context.arc(0, 0, 40, 0, TAU); context.fill();
		context.save(); context.beginPath(); context.arc(0, 0, 40, 0, TAU); context.clip();
		context.fillStyle = '#2f5f3a';
		for (const [x, y, w, h] of [[-30, -14, 14, 10], [-12, -2, 20, 12], [10, 12, 12, 8], [-24, 10, 10, 6], [18, -22, 10, 10], [4, -30, 8, 6]]) context.fillRect(x, y, w, h);
		context.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i < 90; i++) context.fillRect(-40 + rand() * 80, -40 + rand() * 80, 2, 2);
		context.restore();
		context.strokeStyle = '#b7c9e6'; context.lineWidth = 5; context.lineCap = 'round';
		context.beginPath(); context.ellipse(0, 4, 66, 16, -.25, .25, Math.PI - .25); context.stroke();
		context.globalAlpha = .45; context.beginPath(); context.ellipse(0, 4, 66, 16, -.25, Math.PI - .2, TAU + .2); context.stroke(); context.globalAlpha = 1;
		context.restore();
		// Brass notes, bevelled.
		for (const [x, y, a, s] of [[-90, -90, -.15, 1.8], [-30, -20, .1, 1.2]]) {
			context.save(); context.translate(x, y); context.rotate(a); context.scale(s, s);
			context.fillStyle = 'rgba(0,0,0,.4)'; context.fillRect(-4, -16, 4, 32); context.fillRect(-14, 12, 12, 8);
			const brass = context.createLinearGradient(-16, -20, 16, 20); brass.addColorStop(0, '#f1dc8e'); brass.addColorStop(.5, '#c9a44a'); brass.addColorStop(1, '#8c6a2d');
			context.fillStyle = brass; context.strokeStyle = brass; context.lineWidth = 4; context.lineJoin = 'miter';
			context.beginPath(); context.moveTo(-6, 14); context.lineTo(-6, -18); context.lineTo(14, -24); context.lineTo(14, 8); context.stroke();
			context.fillRect(-16, 10, 12, 8); context.fillRect(4, 4, 12, 8);
			context.restore();
		}
		// A mined hillside of pixel rock along the bottom, with a shaft.
		const rock = (x, y, w, h, c) => { context.fillStyle = c; context.fillRect(x, y, w, h); };
		for (let x = -204; x < 204; x += 12) {
			const top = 120 + Math.round(Math.sin(x / 50) * 14 + Math.sin(x / 17) * 6);
			for (let y = top; y < 204; y += 12) rock(x, y, 12, 12, rand() < .12 ? '#8a6042' : y < top + 12 ? '#5f9a5a' : rand() < .5 ? '#3d4a3f' : '#4a5a4a');
			if (rand() < .1) rock(x + 3, top + 20 + rand() * 50, 6, 6, '#e9c75a');
		}
		rock(-24, 142, 48, 62, '#120f1a'); rock(-28, 138, 56, 8, '#8a6042'); rock(-28, 138, 8, 66, '#8a6042'); rock(20, 138, 8, 66, '#8a6042');
		context.save(); context.beginPath(); context.arc(0, 0, SIZE / 2, 0, TAU); context.clip(); context.restore();
		vignette(context, 130, '#07060f', .55);
	},

	// Glass on a tiled bench: flasks and retorts, copper, bubbles.
	laboratory(context, rand) {
		context.fillStyle = '#2b5553'; context.fillRect(-SIZE / 2, -SIZE / 2, SIZE, SIZE);
		for (let x = -204; x < 204; x += 34) for (let y = -204; y < 100; y += 34) {
			const tone = 40 + rand() * 18;
			context.fillStyle = `hsl(176 ${tone}% ${22 + rand() * 7}%)`;
			context.fillRect(x + 1.5, y + 1.5, 31, 31);
			context.fillStyle = 'rgba(255,255,255,.12)'; context.fillRect(x + 3, y + 3, 28, 3); context.fillRect(x + 3, y + 3, 3, 28);
			if ((x / 34 + y / 34) % 3 === 0) { context.fillStyle = 'rgba(15,40,40,.5)'; for (const [dx, dy] of [[9, 9], [19, 9], [9, 19], [19, 19]]) context.fillRect(x + dx, y + dy, 5, 5); }
		}
		context.save(); context.translate(0, 100); context.beginPath(); context.rect(-SIZE / 2, 0, SIZE, 110); context.clip(); context.translate(0, -100); wood(context, rand, '#6b4a33', '#9a6f4c', '#3f2a1d'); context.restore();
		context.fillStyle = '#c9ab6a'; context.fillRect(-SIZE / 2, 100, SIZE, 4); context.fillStyle = 'rgba(0,0,0,.35)'; context.fillRect(-SIZE / 2, 104, SIZE, 5);
		// Copper coil behind the glass.
		context.strokeStyle = '#b9743f'; context.lineWidth = 5; context.lineCap = 'round';
		context.beginPath(); for (let t = 0; t < 7; t += .05) context.lineTo(120 + Math.cos(t * TAU) * 16, -150 + t * 26); context.stroke();
		context.strokeStyle = 'rgba(255,220,170,.5)'; context.lineWidth = 1.5; context.beginPath(); for (let t = 0; t < 7; t += .05) context.lineTo(118 + Math.cos(t * TAU) * 16, -152 + t * 26); context.stroke();
		const glass = (draw, liquid, level, color) => {
			context.save();
			context.fillStyle = 'rgba(0,0,0,.35)'; context.save(); context.translate(5, 6); draw(); context.fill(); context.restore();
			draw(); context.save(); context.clip();
			context.fillStyle = 'rgba(225,240,236,.42)'; context.fillRect(-SIZE / 2, -SIZE / 2, SIZE, SIZE);
			context.fillStyle = color; context.fillRect(-SIZE / 2, level, SIZE, 300);
			context.fillStyle = 'rgba(255,255,255,.35)'; context.fillRect(-SIZE / 2, level - 2, SIZE, 3);
			for (let i = 0; i < 14; i++) { const r = 1 + rand() * 3, bx = liquid[0] + (rand() - .5) * liquid[1], by = level + rand() * liquid[2]; context.strokeStyle = 'rgba(255,255,255,.7)'; context.lineWidth = .8; context.beginPath(); context.arc(bx, by, r, 0, TAU); context.stroke(); }
			context.restore();
			context.strokeStyle = 'rgba(240,250,248,.85)'; context.lineWidth = 2; draw(); context.stroke();
			context.restore();
		};
		glass(() => { context.beginPath(); context.moveTo(-60, -60); context.lineTo(-30, -60); context.lineTo(-30, -20); context.lineTo(0, 86); context.quadraticCurveTo(4, 100, -10, 100); context.lineTo(-80, 100); context.quadraticCurveTo(-94, 100, -90, 86); context.lineTo(-60, -20); context.closePath(); }, [-45, 60, 60], 40, 'rgba(79,179,165,.85)');
		glass(() => { context.beginPath(); context.arc(70, 50, 44, 0, TAU); context.rect(60, -64, 20, 70); }, [70, 60, 50], 30, 'rgba(217,181,90,.8)');
		glass(() => { context.beginPath(); context.rect(-150, -40, 18, 130); context.arc(-141, 90, 9, 0, Math.PI); }, [-141, 12, 60], 10, 'rgba(169,105,109,.8)');
		glass(() => { context.beginPath(); context.rect(-122, -10, 14, 100); context.arc(-115, 90, 7, 0, Math.PI); }, [-115, 10, 50], 30, 'rgba(95,154,90,.8)');
		context.fillStyle = '#c9ab6a'; context.fillRect(-62, -64, 34, 6); context.fillRect(58, -66, 24, 6);
		context.fillStyle = '#5a4a2a'; context.fillRect(-156, -46, 54, 5); context.fillRect(-156, 60, 54, 5);
		// Vapour rising from the Erlenmeyer, and a glint on each vessel.
		for (let i = 0; i < 18; i++) dab(context, rand, -45 + (rand() - .5) * 30, -80 - i * 7 + (rand() - .5) * 10, 5 + rand() * 8, '#dff2ee', .09, 8);
		context.fillStyle = 'rgba(255,255,255,.5)'; context.beginPath(); context.ellipse(-70, 40, 4, 26, .25, 0, TAU); context.fill(); context.beginPath(); context.ellipse(52, 38, 4, 16, .4, 0, TAU); context.fill();
		vignette(context, 130, '#0d2524', .55);
	},

	// A sheet of parchment under lamplight with the tools of the duel: a lit
	// candle, a sand timer, grey scrawls, a crossed-out blot, ink and quill.
	// No glyph is shown; the spells are for players to discover.
	glyphs(context, rand) {
		context.fillStyle = '#2a2f2a'; context.fillRect(-SIZE / 2, -SIZE / 2, SIZE, SIZE);
		wood(context, rand, '#4a3a2b', '#6b5440', '#2d2118');
		// Parchment, slightly turned, with fibres and a soft tide line.
		context.save(); context.rotate(-.06);
		context.fillStyle = 'rgba(0,0,0,.45)'; context.fillRect(-150, -150, 300, 300);
		context.fillStyle = '#e8dcb8'; context.fillRect(-156, -158, 300, 300);
		context.save(); context.beginPath(); context.rect(-156, -158, 300, 300); context.clip();
		for (let i = 0; i < 70; i++) dab(context, rand, -156 + rand() * 300, -158 + rand() * 300, 10 + rand() * 24, rand() < .5 ? '#d9c79a' : '#f1e8cc', .16, 8);
		fibres(context, rand, 900, '#fff8e2', '#9c8659', 7);
		hatch(context, rand, .35, 9, '#8c7349', .08, .8);
		context.restore();
		context.strokeStyle = '#b5a37a'; context.lineWidth = 1.5; context.strokeRect(-156, -158, 300, 300);
		// Faint scrawls in grey ink: open scribbles and a crossed-out blot,
		// never a figure that could be mistaken for a glyph.
		context.strokeStyle = 'rgba(60,70,60,.35)'; context.lineWidth = 2.5; context.lineCap = 'round';
		for (let i = 0; i < 7; i++) {
			const x = -120 + rand() * 240, y = -130 + rand() * 250, r = 12 + rand() * 20;
			context.beginPath(); context.moveTo(x - r, y);
			context.bezierCurveTo(x - r * .3, y - r * (1 + rand()), x + r * .3, y + r * (1 + rand()), x + r, y + (rand() - .5) * r);
			context.stroke();
		}
		context.fillStyle = 'rgba(40,50,45,.5)'; context.beginPath(); context.ellipse(60, -90, 16, 11, .4, 0, TAU); context.fill();
		context.strokeStyle = 'rgba(169,105,109,.8)'; context.lineWidth = 4; context.beginPath(); context.moveTo(40, -108); context.lineTo(82, -72); context.moveTo(82, -108); context.lineTo(40, -72); context.stroke();
		// A lit candle in a brass dish, with a curl of smoke.
		const brass = context.createLinearGradient(-120, -120, 120, 120); brass.addColorStop(0, '#f1dc8e'); brass.addColorStop(.5, '#c9a44a'); brass.addColorStop(1, '#8c6a2d');
		context.fillStyle = brass; context.beginPath(); context.ellipse(-70, 40, 36, 12, 0, 0, TAU); context.fill();
		context.fillStyle = '#f3e9c6'; context.fillRect(-82, -70, 24, 108);
		context.strokeStyle = 'rgba(0,0,0,.25)'; context.lineWidth = 2; context.strokeRect(-82, -70, 24, 108);
		context.fillStyle = '#5a4426'; context.fillRect(-71, -82, 2, 14);
		const flame = context.createRadialGradient(-70, -94, 2, -70, -94, 22); flame.addColorStop(0, '#fff4c0'); flame.addColorStop(.5, '#f0a640'); flame.addColorStop(1, 'rgba(216,99,42,0)');
		context.fillStyle = flame; context.beginPath(); context.ellipse(-70, -96, 14, 24, 0, 0, TAU); context.fill();
		context.strokeStyle = 'rgba(200,200,190,.5)'; context.lineWidth = 2.5; context.beginPath(); context.moveTo(-70, -118); context.bezierCurveTo(-90, -134, -56, -146, -72, -164); context.stroke();
		// A sand timer, half run.
		context.save(); context.translate(70, 50);
		context.fillStyle = brass; context.fillRect(-30, -74, 60, 8); context.fillRect(-30, 66, 60, 8);
		context.fillStyle = 'rgba(246,237,198,.85)'; context.beginPath(); context.moveTo(-24, -66); context.bezierCurveTo(-24, -20, 22, -20, 22, 0); context.bezierCurveTo(22, 20, -24, 20, -24, 66); context.lineTo(24, 66); context.bezierCurveTo(24, 20, -22, 20, -22, 0); context.bezierCurveTo(-22, -20, 24, -20, 24, -66); context.closePath(); context.fill();
		context.strokeStyle = '#8c7349'; context.lineWidth = 2; context.stroke();
		context.fillStyle = '#c9a44a'; context.beginPath(); context.moveTo(-12, -50); context.lineTo(12, -50); context.lineTo(0, -10); context.closePath(); context.fill();
		context.beginPath(); context.moveTo(-18, 62); context.lineTo(18, 62); context.lineTo(0, 40); context.closePath(); context.fill();
		context.restore();
		context.restore();
		// Ink pot with a glint, and a quill laid across the corner.
		context.fillStyle = 'rgba(0,0,0,.4)'; context.beginPath(); context.ellipse(150, 142, 28, 12, 0, 0, TAU); context.fill();
		context.fillStyle = '#1f2a24'; context.beginPath(); context.moveTo(128, 134); context.quadraticCurveTo(128, 96, 142, 92); context.lineTo(158, 92); context.quadraticCurveTo(172, 96, 172, 134); context.quadraticCurveTo(150, 146, 128, 134); context.fill();
		context.fillStyle = '#c9ab6a'; context.fillRect(140, 86, 20, 7);
		context.fillStyle = 'rgba(159,224,212,.6)'; context.beginPath(); context.ellipse(140, 108, 4, 10, -.3, 0, TAU); context.fill();
		context.save(); context.translate(-120, 120); context.rotate(-.55);
		context.fillStyle = '#e7dcc2'; context.beginPath(); context.moveTo(-70, 0); context.quadraticCurveTo(-20, -26, 70, -6); context.quadraticCurveTo(-10, 10, -70, 0); context.fill();
		context.strokeStyle = '#8c7349'; context.lineWidth = 1.6; context.beginPath(); context.moveTo(-70, 0); context.lineTo(70, -5); context.stroke();
		context.restore();
		for (let i = 0; i < 14; i++) dab(context, rand, (rand() - .5) * 380, (rand() - .5) * 380, 4 + rand() * 7, '#a9696d', .25, 7);
		vignette(context, 120, '#120e0a', .6);
	}
};

function drawStation(name, canvas, pixels = 1024) {
	canvas.width = canvas.height = pixels;
	const context = canvas.getContext('2d');
	const rand = seededRandom(Object.keys(scenes).indexOf(name) * 7919 + 17);
	context.save();
	context.scale(pixels / SIZE, pixels / SIZE);
	context.translate(SIZE / 2, SIZE / 2);
	scenes[name](context, rand);
	context.restore();
	grain(context, rand, 14);
	return canvas;
}

const boardArtwork = { drawStation, scenes: Object.keys(scenes) };
if (typeof module !== 'undefined') module.exports = boardArtwork;
