// Build-time artwork only. This file is never loaded by the game.
'use strict';

// Keep the shared table's original 800 × 800 coordinates and socket protocol.
const board = [
	{ x: 360, y: 10 }, { x: 360, y: 100 },
	{ x: 270, y: 10 }, { x: 270, y: 100, rosette: true },
	{ x: 450, y: 10 }, { x: 450, y: 100, rosette: true },
	{ x: 360, y: 190 }, { x: 360, y: 280 },
	{ x: 360, y: 370, rosette: true }, { x: 360, y: 460 },
	{ x: 360, y: 550 }, { x: 360, y: 640 },
	{ x: 270, y: 370 }, { x: 270, y: 460 },
	{ x: 270, y: 550 }, { x: 270, y: 640, rosette: true },
	{ x: 450, y: 370 }, { x: 450, y: 460 },
	{ x: 450, y: 550 }, { x: 450, y: 640, rosette: true }
];


const TAU = Math.PI * 2;

const palette = { gold: '#bca06d', lapis: '#254c6b', ink: '#213c42', red: '#9e5844', shell: '#e5d9b9' };

function seededRandom(seed) {
	return function () {
		seed = (seed * 1664525 + 1013904223) >>> 0;
		return seed / 4294967296;
	};
}


function circle(context, x, y, radius, fill, stroke) {
	context.beginPath();
	context.arc(x, y, radius, 0, TAU);
	if (fill) { context.fillStyle = fill; context.fill(); }
	if (stroke) { context.strokeStyle = stroke; context.stroke(); }
}


function line(context, points, color, width = 1) {
	context.beginPath();
	context.moveTo(points[0][0], points[0][1]);
	points.slice(1).forEach(point => context.lineTo(point[0], point[1]));
	context.lineWidth = width;
	context.strokeStyle = color;
	context.stroke();
}


function leaf(context, x, y, angle, length, width, color, outline = '#c1ab7460', vein = '#cbb37b50') {
	context.save();
	context.translate(x, y);
	context.rotate(angle);
	context.beginPath();
	context.moveTo(0, 0);
	context.bezierCurveTo(-width, -length * .3, -width * .65, -length * .8, 0, -length);
	context.bezierCurveTo(width * .9, -length * .75, width * .75, -length * .25, 0, 0);
	context.fillStyle = color;
	context.fill();
	context.strokeStyle = outline;
	const lineWidth = Math.min(.65, length * .035);
	context.lineWidth = lineWidth;
	context.stroke();
	line(context, [[0, -length * .1], [0, -length * .9]], vein, lineWidth);
	context.restore();
}


function boardOutline(context, shiftY = 0) {
	const points = [[260, 0], [540, 0], [540, 190], [450, 190], [450, 360], [540, 360], [540, 730], [260, 730], [260, 360], [350, 360], [350, 190], [260, 190]];
	context.beginPath();
	points.forEach(([x, y], i) => i ? context.lineTo(x, y + shiftY) : context.moveTo(x, y + shiftY));
	context.closePath();
	return points;
}


function drawInlayBorder(context) {
	const points = boardOutline(context);
	const random = seededRandom(309);
	points.forEach((point, index) => {
		const end = points[(index + 1) % points.length];
		const dx = end[0] - point[0];
		const dy = end[1] - point[1];
		const distance = Math.hypot(dx, dy);
		const angle = Math.atan2(dy, dx);
		const count = Math.floor(distance / 11);
		for (let i = 0; i < count; i++) {
			context.save();
			context.translate(point[0] + dx * (i + .5) / count, point[1] + dy * (i + .5) / count);
			context.rotate(angle);
			context.fillStyle = i % 4 === 0 ? '#985f49' : i % 2 === 0 ? '#d5c7a8' : '#375876';
			context.globalAlpha = .72 + random() * .25;
			context.fillRect(-4.3, 1.8, 8.6, 5.7);
			context.restore();
		}
	});
}


function rosette(context, x, y, radius, phase = 0) {
	context.save();
	context.translate(x, y);
	circle(context, 0, 0, radius + 4, null, '#9b805f80');
	circle(context, 0, 0, radius + 1, null, '#9b805f55');
	for (let i = 0; i < 8; i++) {
		context.save();
		context.rotate(i * TAU / 8 + phase);
		context.beginPath();
		context.moveTo(0, -3);
		context.bezierCurveTo(-radius * .44, -radius * .5, -radius * .24, -radius * .92, 0, -radius);
		context.bezierCurveTo(radius * .3, -radius * .81, radius * .36, -radius * .37, 0, -3);
		const gradient = context.createLinearGradient(0, -radius, 0, 0);
		gradient.addColorStop(0, '#47738b');
		gradient.addColorStop(.45, palette.lapis);
		gradient.addColorStop(1, '#162e48');
		context.fillStyle = gradient;
		context.fill();
		context.lineWidth = 1;
		context.strokeStyle = '#172d37';
		context.stroke();
		context.beginPath();
		context.moveTo(0, -8);
		context.quadraticCurveTo(2, -radius * .6, 0, -radius + 4);
		context.strokeStyle = '#d0ba7c88';
		context.lineWidth = .8;
		context.stroke();
		circle(context, 0, -radius - 2, 1.6, palette.red);
		context.restore();
	}
	circle(context, 0, 0, 6, '#b29355', '#233c47');
	circle(context, -1, -1, 2.5, '#e8cd8f');
	context.restore();
}


function eye(context, x, y, size) {
	context.save();
	context.translate(x, y);
	context.beginPath();
	context.moveTo(-size, 0);
	context.bezierCurveTo(-size * .4, -size * .8, size * .4, -size * .8, size, 0);
	context.bezierCurveTo(size * .4, size * .8, -size * .4, size * .8, -size, 0);
	context.fillStyle = '#e8dcbf';
	context.fill();
	context.lineWidth = 1.5;
	context.strokeStyle = palette.lapis;
	context.stroke();
	circle(context, 0, 0, size * .42, palette.red, palette.ink);
	circle(context, 0, 0, size * .23, palette.lapis);
	circle(context, -1.5, -1.5, 1, '#f0ddb1');
	context.restore();
}


function drawTile(context, tile, index) {
	const random = seededRandom(810 + index * 97);
	const x = tile.x, y = tile.y;
	context.save();
	context.beginPath();
	context.rect(x, y, 80, 80);
	context.clip();
	const shell = context.createLinearGradient(x, y, x + 65, y + 80);
	shell.addColorStop(0, '#f2ead6');
	shell.addColorStop(.35, '#e6dabd');
	shell.addColorStop(.6, '#d6c6a6');
	shell.addColorStop(.85, '#ede0c3');
	shell.addColorStop(1, '#baa580');
	context.fillStyle = shell;
	context.fillRect(x, y, 80, 80);
	// Fine pores and irregular shell strata are baked once into the surface.
	for (let i = 0; i < 280; i++) {
		context.fillStyle = i % 3 ? '#5c513b' : '#fff9e3';
		context.globalAlpha = .025 + random() * .1;
		context.fillRect(x + random() * 80, y + random() * 80, random() * 1.5 + .3, random() * .7 + .3);
	}
	context.globalAlpha = 1;
	for (let i = 0; i < 7; i++) {
		const offset = random() * 80;
		context.beginPath();
		context.moveTo(x - 5, y + offset);
		context.bezierCurveTo(x + 18, y + offset - 8, x + 45, y + offset + 9, x + 86, y + offset - 15);
		context.strokeStyle = i % 2 ? '#fff8df40' : '#8b775418';
		context.lineWidth = .5 + random();
		context.stroke();
	}
	context.strokeStyle = '#8c7754';
	context.lineWidth = 1;
	context.strokeRect(x + 3.5, y + 3.5, 73, 73);
	context.strokeStyle = '#fff3d077';
	context.strokeRect(x + 5.5, y + 5.5, 69, 69);
	[[9, 9], [71, 9], [9, 71], [71, 71]].forEach(([dx, dy]) => circle(context, x + dx, y + dy, 1.5, palette.red));
	const cx = x + 40, cy = y + 40;
	if (tile.rosette) {
		rosette(context, cx, cy, 27);
	} else if (index % 4 === 0) {
		[[0, 0], [-18, -18], [18, -18], [-18, 18], [18, 18]].forEach(([dx, dy]) => {
			circle(context, cx + dx, cy + dy, 8, null, palette.lapis);
			circle(context, cx + dx, cy + dy, 5, palette.lapis);
			circle(context, cx + dx, cy + dy, 2, palette.red);
		});
	} else if (index % 4 === 1) {
		for (let row = -1; row <= 1; row++) {
			for (let col = -1; col <= 1; col++) eye(context, cx + col * 20, cy + row * 18, 8);
		}
	} else if (index % 4 === 2) {
		line(context, [[cx - 29, cy], [cx + 29, cy]], '#7e7259', .7);
		line(context, [[cx, cy - 29], [cx, cy + 29]], '#7e7259', .7);
		for (let row = -1; row <= 1; row += 2) {
			for (let col = -1; col <= 1; col += 2) {
				const px = cx + col * 16, py = cy + row * 16;
				context.fillStyle = row === col ? palette.lapis : palette.red;
				context.fillRect(px - 10, py - 10, 20, 20);
				eye(context, px, py, 7);
			}
		}
	} else {
		for (let i = 0; i < 4; i++) {
			context.save();
			context.translate(cx, cy);
			context.rotate(i * TAU / 4);
			leaf(context, 0, -3, .12, 25, 8, palette.lapis);
			circle(context, 14, -14, 3, palette.red);
			context.restore();
		}
		circle(context, cx, cy, 5, '#ad8d53', palette.ink);
	}
	// Hairline wear stops the inlays looking mechanically perfect.
	context.beginPath();
	context.moveTo(x + 61, y);
	context.lineTo(x + 57, y + 13);
	context.lineTo(x + 59, y + 20);
	context.strokeStyle = '#70593826';
	context.lineWidth = .7;
	context.stroke();
	context.restore();
	line(context, [[x, y + 80], [x + 80, y + 80], [x + 80, y]], '#090f13a0', 1.5);
}


function buildScene() {
	const surface = document.createElement('canvas');
	surface.width = surface.height = 1600;
	const context = surface.getContext('2d');
	context.scale(2, 2);
	// Transparent around the inlays; the fitted table ornament is native SVG.
	// The board body has a deep wood edge, a dark setting, and tiny stone mosaics.
	context.save();
	context.shadowColor = '#020b0b';
	context.shadowBlur = 25;
	context.shadowOffsetX = 7;
	context.shadowOffsetY = 15;
	boardOutline(context, 8);
	context.fillStyle = '#3c3024';
	context.fill();
	context.restore();
	boardOutline(context, 5);
	context.strokeStyle = '#a18453';
	context.lineWidth = 2;
	context.stroke();
	boardOutline(context);
	context.fillStyle = '#182936';
	context.fill();
	context.strokeStyle = '#a59062';
	context.lineWidth = 1.5;
	context.stroke();
	drawInlayBorder(context);
	board.forEach((tile, index) => drawTile(context, tile, index));
	return surface;
}

function drawCounterArtwork(ctx, color) {
	const piece = { x: 48, y: 44, w: 70, h: 70, color };
	const index = color === 'blue' ? 0 : 7;
	const shell = piece.color === 'blue';
	const x = piece.x, y = piece.y;
	const radius = Math.min(piece.w, piece.h) / 2 - 3;
	const selected = false;
	const hover = false;
	ctx.save();
	ctx.translate(x, y - (selected ? 3 : 0));
	if (selected || hover) {
		const pulse = motionPreference.matches ? .65 : .6 + Math.sin(time / 700) * .15;
		circle(ctx, 0, 0, radius + 6, `rgba(211, 188, 125, ${pulse * .15})`, `rgba(211, 188, 125, ${pulse})`);
	}
	ctx.shadowColor = '#020c0caa';
	ctx.shadowBlur = selected ? 16 : 7;
	ctx.shadowOffsetY = selected ? 9 : 4;
	circle(ctx, 0, 3, radius, shell ? '#9c8967' : '#102436');
	ctx.shadowColor = 'transparent';
	const gradient = ctx.createRadialGradient(-12, -14, 2, 0, 0, radius + 7);
	gradient.addColorStop(0, shell ? '#faf2d8' : '#4c7490');
	gradient.addColorStop(.48, shell ? '#e2d5b5' : '#2c526e');
	gradient.addColorStop(1, shell ? '#a69773' : '#152d48');
	circle(ctx, 0, 0, radius, gradient, '#cab788');
	ctx.lineWidth = .7;
	circle(ctx, 0, 0, radius - 3, null, shell ? '#a9967080' : '#92a2a075');
	circle(ctx, 0, 0, radius - 5, null, shell ? '#fff6d860' : '#0e253999');
	const random = seededRandom(index + 97);
	for (let i = 0; i < 65; i++) {
		const angle = random() * TAU;
		const r = Math.sqrt(random()) * (radius - 4);
		ctx.globalAlpha = random() * .18;
		circle(ctx, Math.cos(angle) * r, Math.sin(angle) * r, random() * .8 + .2, i % 2 ? '#e3d39a' : '#071823');
	}
	ctx.globalAlpha = 1;
	[[0, 0], [-11, -11], [11, -11], [-11, 11], [11, 11]].forEach(([dx, dy]) => {
		circle(ctx, dx, dy, 4.2, shell ? '#254864' : '#e1d6b5', shell ? '#9c8c6880' : '#ad976a');
		circle(ctx, dx - .7, dy - .7, 1.3, shell ? '#557c95' : '#fff6dc');
	});
	ctx.beginPath();
	ctx.arc(0, 0, radius - 1, Math.PI * 1.12, Math.PI * 1.8);
	ctx.strokeStyle = shell ? '#fff9e0aa' : '#b4cad177';
	ctx.lineWidth = 1.2;
	ctx.stroke();
	ctx.restore();
}
