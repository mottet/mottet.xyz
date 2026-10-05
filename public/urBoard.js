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

const canvas = document.getElementById('ur-board');
const ctx = canvas.getContext('2d');
const boardSurface = canvas.parentElement;
const pieceCanvas = document.getElementById('ur-pieces');
const pieceContext = pieceCanvas.getContext('2d');
const rollButton = document.getElementById('roll-button');
const diceTray = document.getElementById('dice-tray');
const diceResult = document.getElementById('dice-result');
const diceAnnouncement = document.getElementById('dice-announcement');
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const TAU = Math.PI * 2;
let pieceArray = [];
let selectedPiece = -1;
let hoveredPiece = -1;
let activePointer = null;
let keyboardSelected = false;
let dragOffset = { x: 0, y: 0 };
let isRolling = false;
let resultDices = null;
let lastDiceTick = 0;
let animationFrame = 0;
let renderPending = false;
let canvasScale = 1;
const scene = document.getElementById('board-artwork');
const shellSprite = document.getElementById('counter-shell');
const lapisSprite = document.getElementById('counter-lapis');
const walnutTexture = document.getElementById('walnut-texture');
let sceneReady = false;
let gardenPainted = false;
let readyRecorded = false;

function circle(context, x, y, radius, fill, stroke) {
	context.beginPath();
	context.arc(x, y, radius, 0, TAU);
	if (fill) { context.fillStyle = fill; context.fill(); }
	if (stroke) { context.strokeStyle = stroke; context.stroke(); }
}

function drawPiece(piece, index) {
	const ctx = pieceContext;
	const sprite = piece.color === 'blue' ? shellSprite : lapisSprite;
	const scale = Math.min(piece.w, piece.h) / 70;
	const radius = 32 * scale;
	const selected = index === selectedPiece;
	const hover = index === hoveredPiece;
	ctx.save();
	ctx.translate(piece.x, piece.y - (selected ? 3 : 0));
	if (selected || hover) {
		const pulse = .65;
		circle(ctx, 0, 0, radius + 6, `rgba(211, 188, 125, ${pulse * .15})`, `rgba(211, 188, 125, ${pulse})`);
	}
	if (selected) {
		ctx.shadowColor = '#020c0c88';
		ctx.shadowBlur = 9;
		ctx.shadowOffsetY = 5;
	}
	ctx.drawImage(sprite, -48 * scale, -44 * scale, 96 * scale, 96 * scale);
	ctx.restore();
}

function render() {
	if (!sceneReady) return;
	ctx.setTransform(canvasScale, 0, 0, canvasScale, 0, 0);
	ctx.clearRect(0, 0, 800, 800);
	// Counters sit above the HTML dice controls, including after a remote move.
	pieceContext.setTransform(canvasScale, 0, 0, canvasScale, 0, 0);
	pieceContext.clearRect(0, 0, 800, 800);
	pieceArray.forEach((piece, index) => { if (index !== selectedPiece) drawPiece(piece, index); });
	if (selectedPiece >= 0 && pieceArray[selectedPiece]) drawPiece(pieceArray[selectedPiece], selectedPiece);
	if (!readyRecorded && sceneReady && gardenPainted && pieceArray.length === 14 && socket.connected) {
		readyRecorded = true;
		// Include the fully drawn room in the first playable frame.
		requestAnimationFrame(() => {
			performance.mark('ur-ready');
			setTimeout(() => document.body.classList.add('ur-ready'), 1000);
		});
	}
}

function previewDice() {
	const faces = Array.from({ length: 4 }, () => Math.random() < .5);
	paintDice(faces);
	if (!motionPreference.matches) diceResult.textContent = faces.filter(Boolean).length;
}

function paintDice(faces) {
	Array.from(diceTray.children).forEach((die, index) => die.classList.toggle('marked', faces[index]));
}

function updateDice() {
	diceTray.classList.toggle('rolling', isRolling);
	rollButton.classList.toggle('rolling', isRolling);
	rollButton.setAttribute('aria-label', isRolling ? 'Stop dice' : 'Roll dice');
	if (isRolling) {
		diceAnnouncement.textContent = 'Rolling';
		if (motionPreference.matches) diceResult.textContent = '…';
	} else if (resultDices !== null) {
		diceResult.textContent = resultDices;
		diceAnnouncement.textContent = `Roll: ${resultDices}`;
		// The server returns a total; show one of the equivalent four-die casts.
		const faces = [0, 1, 2, 3].sort(() => Math.random() - .5).slice(0, resultDices);
		paintDice([0, 1, 2, 3].map(index => faces.includes(index)));
	} else {
		diceResult.textContent = '—';
		paintDice([false, false, false, false]);
	}
	requestRender();
}

function animate(time) {
	animationFrame = 0;
	if (document.hidden) return;
	if (renderPending) {
		renderPending = false;
		render();
	}
	if (isRolling && !motionPreference.matches && time - lastDiceTick > 130) {
		previewDice();
		lastDiceTick = time;
	}
	if (isRolling && !motionPreference.matches) animationFrame = requestAnimationFrame(animate);
}

function requestRender() {
	// Avoid starting the animation loop while artwork or the shared counters
	// are still arriving; those empty frames otherwise delay the first paint.
	if (!sceneReady || !gardenPainted || pieceArray.length !== 14) return;
	renderPending = true;
	if (!animationFrame && !document.hidden) animationFrame = requestAnimationFrame(animate);
}

function resizeCanvas() {
	const size = canvas.getBoundingClientRect().width;
	const resolution = Math.min(window.devicePixelRatio || 1, 1.5);
	const pixels = Math.round(size * resolution);
	if (canvas.width === pixels && pieceCanvas.width === pixels) return;
	canvas.width = canvas.height = pixels;
	pieceCanvas.width = pieceCanvas.height = canvas.width;
	canvasScale = canvas.width / 800;
	requestRender();
}

function boardPoint(event) {
	const rect = canvas.getBoundingClientRect();
	return { x: (event.clientX - rect.left) * 800 / rect.width, y: (event.clientY - rect.top) * 800 / rect.height };
}

function pieceAt(point) {
	// Pick the topmost counter when players stack them.
	if (selectedPiece >= 0) {
		const piece = pieceArray[selectedPiece];
		if (piece && Math.hypot(piece.x - point.x, piece.y - point.y) <= piece.w / 2) return selectedPiece;
	}
	for (let index = pieceArray.length - 1; index >= 0; index--) {
		const piece = pieceArray[index];
		if (Math.hypot(piece.x - point.x, piece.y - point.y) <= piece.w / 2) return index;
	}
	return -1;
}

function moveSelected(x, y) {
	if (selectedPiece < 0 || !pieceArray[selectedPiece] || !socket.connected) return;
	const piece = pieceArray[selectedPiece];
	piece.x = Math.max(0, Math.min(800, x));
	piece.y = Math.max(0, Math.min(800, y));
	socket.emit('movingUrPiece', { index: selectedPiece, x: piece.x, y: piece.y });
	requestRender();
}

boardSurface.addEventListener('pointerdown', event => {
	if (!socket.connected || (event.pointerType === 'mouse' && event.button !== 0) || activePointer !== null) return;
	const point = boardPoint(event);
	const piece = pieceAt(point);
	if (piece < 0 && rollButton.contains(event.target)) return;
	selectedPiece = piece;
	keyboardSelected = false;
	canvas.focus({ preventScroll: true });
	if (selectedPiece >= 0) {
		activePointer = event.pointerId;
		dragOffset = { x: pieceArray[selectedPiece].x - point.x, y: pieceArray[selectedPiece].y - point.y };
		canvas.setPointerCapture(event.pointerId);
		canvas.style.cursor = 'grabbing';
		event.preventDefault();
		// Capture a counter even when the pointer landed on the button beneath it.
		event.stopPropagation();
	}
	requestRender();
}, true);

boardSurface.addEventListener('pointermove', event => {
	const point = boardPoint(event);
	if (event.pointerId === activePointer) moveSelected(point.x + dragOffset.x, point.y + dragOffset.y);
	else {
		const nextHoveredPiece = pieceAt(point);
		const hoverChanged = nextHoveredPiece !== hoveredPiece;
		hoveredPiece = nextHoveredPiece;
		canvas.style.cursor = hoveredPiece >= 0 && socket.connected ? 'grab' : 'default';
		rollButton.style.cursor = hoveredPiece >= 0 && socket.connected ? 'grab' : 'pointer';
		if (hoverChanged) requestRender();
	}
});

function releasePointer(event) {
	if (event.pointerId !== activePointer) return;
	if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
	activePointer = null;
	selectedPiece = -1;
	canvas.style.cursor = hoveredPiece >= 0 ? 'grab' : 'default';
	requestRender();
}

canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointercancel', releasePointer);
canvas.addEventListener('lostpointercapture', releasePointer);
boardSurface.addEventListener('pointerleave', () => { hoveredPiece = -1; requestRender(); });
canvas.addEventListener('blur', () => { if (keyboardSelected) { selectedPiece = -1; keyboardSelected = false; requestRender(); } });
canvas.addEventListener('keydown', event => {
	if (activePointer !== null) return;
	if (event.key === 'Tab' && pieceArray.length && socket.connected) {
		const next = selectedPiece + (event.shiftKey ? -1 : 1);
		if (next >= 0 && next < pieceArray.length) {
			event.preventDefault();
			selectedPiece = next;
			keyboardSelected = true;
			diceAnnouncement.textContent = `${pieceArray[next].color === 'blue' ? 'Shell' : 'Lapis'} counter ${next % 7 + 1} selected. Use arrow keys to move.`;
			requestRender();
		} else { selectedPiece = -1; keyboardSelected = false; requestRender(); }
	} else if ((event.key === 'Escape' || event.key === 'Enter') && selectedPiece >= 0) {
		event.preventDefault();
		selectedPiece = -1;
		keyboardSelected = false;
		requestRender();
	} else if (selectedPiece >= 0 && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
		event.preventDefault();
		const step = event.shiftKey ? 90 : 10;
		const piece = pieceArray[selectedPiece];
		moveSelected(piece.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0), piece.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0));
	}
});

const socket = io({ transports: ['websocket', 'polling'], tryAllTransports: true });
socket.on('connect', () => {
	document.getElementById('connection-dot').classList.add('connected');
	document.getElementById('connection-dot').setAttribute('aria-label', 'Connected');
	rollButton.disabled = false;
	socket.emit('getUrPieces');
});
socket.on('disconnect', () => {
	document.getElementById('connection-dot').classList.remove('connected');
	document.getElementById('connection-dot').setAttribute('aria-label', 'Reconnecting');
	rollButton.disabled = true;
	isRolling = false;
	updateDice();
});
socket.on('connect_error', () => {
	document.getElementById('connection-dot').setAttribute('aria-label', 'Connecting');
});
socket.on('getUrPieces', data => {
	pieceArray = data;
	requestRender();
});
socket.on('movingUrPiece', data => {
	if (!pieceArray[data.index]) return;
	pieceArray[data.index].x = data.x;
	pieceArray[data.index].y = data.y;
	requestRender();
});
socket.on('rollingUrDices', data => {
	isRolling = data.isRolling;
	if (!isRolling && data.resultDices !== undefined) resultDices = Number(data.resultDices);
	updateDice();
});
rollButton.addEventListener('click', event => {
	if (!socket.connected) return;
	// Pointer clicks on a covering counter move that counter; keyboard activation
	// still lets players roll while the button is covered.
	if (event.detail > 0 && pieceAt(boardPoint(event)) >= 0) return;
	isRolling = !isRolling;
	socket.emit('rollingUrDices', { isRolling });
	updateDice();
});

function paintGardenBackground() {
	const started = performance.now();
	const garden = document.getElementById('garden-background');
	if (gardenPainted && garden.viewBox.baseVal.width === innerWidth && garden.viewBox.baseVal.height === innerHeight) return;
	const details = UrGarden.paint(garden, innerWidth, innerHeight);
	garden.dataset.depth = String(details.depth);
	garden.dataset.layers = String(details.layers);
	garden.dataset.leaves = String(details.leaves);
	performance.measure('ur-garden', { start: started, end: performance.now() });
	gardenPainted = true;
	requestRender();
}

// Decode the grain tile as well, so the first playable frame includes all materials.
Promise.all([scene.decode(), shellSprite.decode(), lapisSprite.decode(), walnutTexture.decode()]).then(() => {
	sceneReady = true;
	requestRender();
}).catch(error => console.error('Unable to load Ur artwork', error));
let gardenResizeFrame = 0;
window.addEventListener('resize', () => {
	cancelAnimationFrame(gardenResizeFrame);
	gardenResizeFrame = requestAnimationFrame(paintGardenBackground);
});
new ResizeObserver(resizeCanvas).observe(canvas);
motionPreference.addEventListener('change', () => { updateDice(); requestRender(); });
document.addEventListener('visibilitychange', requestRender);
resizeCanvas();
paintGardenBackground();
