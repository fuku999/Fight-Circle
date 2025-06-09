const area = document.getElementById("Area");
const ctx = area.getContext("2d");
const radius = 10;
const gridSize = 50;
const offset = 25;
const epsilon = 5;
const rematchBtn = document.getElementById('reset');

let emptyPoints = [];
let points = [];
let gameOver = false;
let isPlayerTurn = false;
let conn = null;
let isConnected = false;  // 接続状態を管理

area.width = 600;
area.height = 600;

const peer = new Peer({
	host: 'peerjs-server-n7gf.onrender.com',
	port: 443,
	path: '/myapp',
	secure: true
});

peer.on('open', id => {
	document.getElementById('my-id').innerText = id;
});

document.getElementById('connect-btn').addEventListener('click', () => {
	if (conn && conn.open) {
		alert('既に接続中です。');
		return;
	}
	const targetId = document.getElementById('peer-id-input').value.trim();
	if (!targetId) {
		alert('相手のIDを入力してください');
		return;
	}
	conn = peer.connect(targetId);
	setupConnectionHandlers();
});

peer.on('connection', connection => {
	if (conn && conn.open) {
		// 既に接続済みなら新規接続拒否
		connection.close();
		return;
	}
	conn = connection;
	setupConnectionHandlers();
});

function setupConnectionHandlers() {
	conn.on('open', () => {
		isConnected = true;

		drawGrid();
		getAllGridPoints();

		// ここで先手を決める（ID文字列の大小比較で決める例）
		isPlayerTurn = (peer.id < conn.peer);
		updateTurnDisplay();

		toggleUIOnConnection();
	});

	conn.on('data', data => {
		if (!validateReceivedData(data)) return;

		if (data.type === 'place') {
			handleReceivedMove(data.gridPoint);
		} else if (data.type === 'gameOver') {
			drawCircleOutline(data.circle);
			gameOver = true;
			showGameOverMessage("You Win! Game Over.");
		} else if (data.type === 'reset') {
			resetGame();
		}
	});

	conn.on('error', err => {
		alert('接続エラーが発生しました。再接続してください。');
		console.error(err);
	});

	conn.on('close', () => {
		isConnected = false;
		alert('接続が切断されました。ページをリロードしてください。');
	});
}

function toggleUIOnConnection() {
	document.getElementById("boxs").style.display = 'none';
	document.getElementById("my-id").style.display = 'none';
	document.getElementById("peer-id-input").style.display = 'none';
	document.getElementById("connect-btn").style.display = 'none';
	document.getElementById('turnDisplay').style.display = 'block';
	document.getElementById('Area').style.display = 'block';
	rematchBtn.style.display = 'none';
}

function validateReceivedData(data) {
	if (!data || typeof data.type !== 'string') return false;

	if (data.type === 'place') {
		if (!data.gridPoint || typeof data.gridPoint.x !== 'number' || typeof data.gridPoint.y !== 'number') {
			console.warn('不正な座標データを受信しました。');
			return false;
		}
	}
	if (data.type === 'gameOver') {
		if (!data.circle || typeof data.circle.cx !== 'number' || typeof data.circle.cy !== 'number' || typeof data.circle.r !== 'number') {
			console.warn('不正なゲームオーバーデータを受信しました。');
			return false;
		}
	}
	return true;
}

function updateTurnDisplay() {
	document.getElementById("turnDisplay").innerText = isPlayerTurn ? "あなたのターンです" : "相手のターンです";
}

area.addEventListener('click', (e) => {
	if (gameOver || !isPlayerTurn || !conn?.open) return;

	const rect = area.getBoundingClientRect();

	const x = (e.clientX - rect.left);
	const y = (e.clientY - rect.top);

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
			// 相手が勝った場合
			showGameOverMessage("You Win! Game Over.");
		} else {
			// 自分が勝った場合は相手に通知し、リマッチボタンを表示
			showGameOverMessage("You Lose! Game Over.");
			rematchBtn.style.display = 'block';
			conn.send({ type: 'gameOver', circle: result.circle });
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
	ctx.clearRect(0, 0, area.width, area.height); // グリッド再描画前にクリア
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
});
