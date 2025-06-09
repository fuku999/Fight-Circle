
const area = document.getElementById("Area");
const ctx = area.getContext("2d");
const radius = 10;
const gridSize = 50;
const offset = 25;
const epsilon = 5;
const rematchBtn = document.getElementById('reset');
const scale = 0.67;
let emptyPoints = [];
let points = [];
let gameOver = false;
let isPlayerTurn = false;
let conn = null;

area.width = 600;
area.height = 600;

const peer = new Peer();
peer.on('open', id => {
	document.getElementById('my-id').innerText = id;
});

document.getElementById('connect-btn').addEventListener('click', () => {
	const targetId = document.getElementById('peer-id-input').value;
	conn = peer.connect(targetId);
	setupConnectionHandlers();
	isPlayerTurn = true;
});

peer.on('connection', connection => {
	conn = connection;
	setupConnectionHandlers();
	isPlayerTurn = false;
});

function setupConnectionHandlers() {
	conn.on('open', () => {

		drawGrid();
		getAllGridPoints();


		updateTurnDisplay();
		document.getElementById("boxs").style.display = 'none';
		document.getElementById("my-id").style.display = 'none';
		document.getElementById("peer-id-input").style.display = 'none';
		document.getElementById("connect-btn").style.display = 'none';
		document.getElementById('turnDisplay').style.display = 'block';
		document.getElementById('Area').style.display = 'block';
	});

	conn.on('data', data => {
		if (data.type === 'place') {
			handleReceivedMove(data.gridPoint);
		} else if (data.type === 'gameOver') {
			drawCircleOutline(data.circle);
			gameOver = true;
		} else if (data.type === 'reset') {
			resetGame();
		}
	});
}

function updateTurnDisplay() {
	document.getElementById("turnDisplay").innerText = isPlayerTurn ? "あなたのターンです" : "相手のターンです";
}



area.addEventListener('click', (e) => {
	if (gameOver || !isPlayerTurn || !conn?.open) return;

	const rect = area.getBoundingClientRect();
	// scaleを考慮してクリック座標を補正
	const x = (e.clientX - rect.left) / scale;
	const y = (e.clientY - rect.top) / scale;

	const gridPoint = getNearestGridPoint(x, y);

	if (!emptyPoints.some(p => p.x === gridPoint.x && p.y === gridPoint.y)) return;

	placeDot(gridPoint);
	conn.send({ type: 'place', gridPoint });
	checkAfterMove(gridPoint, true);
	isPlayerTurn = false;
	updateTurnDisplay();
});


function handleReceivedMove(gridPoint) {
	placeDot(gridPoint);
	checkAfterMove(gridPoint, false);
	isPlayerTurn = true;
	updateTurnDisplay();
}

function placeDot(point) {
	ctx.fillStyle = 'black';
	ctx.beginPath();
	ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
	ctx.fill();
	ctx.closePath();
	points.push(point);
	emptyPoints = emptyPoints.filter(p => p.x !== point.x || p.y !== point.y);
}

function checkAfterMove(gridPoint, isLocal) {
	const result = checkConcyclic(points);
	if (result) {
		drawCircleOutline(result.circle);
		gameOver = true;
		if (!isLocal) {
			showGameOverMessage("You Win! Game Over.");
			conn.send({ type: 'gameOver', circle: result.circle });
		} else {
			showGameOverMessage("You Lose! Game Over.");
			rematchBtn.style.display = 'block';
		}
	}
}

function getAllGridPoints() {
	emptyPoints = [];
	for (let x = offset; x <= area.width; x += gridSize) {
		for (let y = offset; y <= area.height; y += gridSize) {
			emptyPoints.push({ x, y });
		}
	}
}

function drawGrid() {
	ctx.strokeStyle = 'black';
	ctx.lineWidth = 1;
	for (let x = offset; x <= area.width; x += gridSize) {
		ctx.beginPath();
		ctx.moveTo(x, 0);
		ctx.lineTo(x, area.height);
		ctx.stroke();
	}
	for (let y = offset; y <= area.height; y += gridSize) {
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(area.width, y);
		ctx.stroke();
	}
}

function getNearestGridPoint(x, y) {
	const gx = Math.round((x - offset) / gridSize) * gridSize + offset;
	const gy = Math.round((y - offset) / gridSize) * gridSize + offset;
	return { x: gx, y: gy };
}

function checkConcyclic(points) {
	const n = points.length;
	if (n < 4) return false;
	for (let i = 0; i < n - 2; i++) {
		for (let j = i + 1; j < n - 1; j++) {
			for (let k = j + 1; k < n; k++) {
				const circle = calcCircleCenterAndRadius(points[i], points[j], points[k]);
				if (!circle) continue;
				let count = 0;
				for (let p of points) {
					const distSq = (p.x - circle.cx) ** 2 + (p.y - circle.cy) ** 2;
					if (Math.abs(distSq - circle.r ** 2) < epsilon * epsilon) {
						count++;
					}
				}
				if (count >= 4) {
					return { circle, pointsOnCircle: count };
				}
			}
		}
	}
	return false;
}

function calcCircleCenterAndRadius(p1, p2, p3) {
	const x1 = p1.x, y1 = p1.y;
	const x2 = p2.x, y2 = p2.y;
	const x3 = p3.x, y3 = p3.y;
	const A = x2 - x1;
	const B = y2 - y1;
	const C = x3 - x1;
	const D = y3 - y1;
	const E = A * (x1 + x2) + B * (y1 + y2);
	const F = C * (x1 + x3) + D * (y1 + y3);
	const G = 2 * (A * (y3 - y2) - B * (x3 - x2));
	if (G === 0) return null;
	const cx = (D * E - B * F) / G;
	const cy = (A * F - C * E) / G;
	const r = Math.sqrt((cx - x1) ** 2 + (cy - y1) ** 2);
	return { cx, cy, r };
}

function drawCircleOutline(circle) {
	ctx.strokeStyle = 'red';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.arc(circle.cx, circle.cy, circle.r, 0, Math.PI * 2);
	ctx.stroke();
}

function showGameOverMessage(message) {
	alert(message);
}

function resetGame() {
	ctx.clearRect(0, 0, area.width, area.height);
	drawGrid();

	emptyPoints = [];
	points = [];
	gameOver = false;
	getAllGridPoints();
	updateTurnDisplay();

	rematchBtn.style.display = 'none';
}

rematchBtn.addEventListener('click', () => {
	resetGame();
	if (conn && conn.open) {
		conn.send({ type: 'reset' });
	}
})

