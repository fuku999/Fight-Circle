/**
 * 
 */
const peer = new Peer(); // 自動ID生成
let conn;

peer.on('open', id => {
  document.getElementById('my-id').textContent = id;
});

document.getElementById('connect-btn').onclick = () => {
  const peerId = document.getElementById('peer-id-input').value;
  conn = peer.connect(peerId);
  setupConnectionHandlers();
};

peer.on('connection', connection => {
  conn = connection;
  setupConnectionHandlers();
});

function setupConnectionHandlers() {
  conn.on('open', () => {
    console.log("接続成功！");
  });

  conn.on('data', data => {
    if (data.type === 'move') {
      drawPoint(data.point, 'black'); // 相手の点を描画
    }
  });
}

// プレイヤーがクリックしたとき送信
area.addEventListener('click', (e) => {
  if (!conn || conn.open === false) return;

  const x = e.clientX - area.getBoundingClientRect().left;
  const y = e.clientY - area.getBoundingClientRect().top;
  const gridPoint = getNearestGridPoint(x, y);

  drawPoint(gridPoint, 'black'); // 自分の点を描画
  conn.send({ type: 'move', point: gridPoint }); // 相手に送信
});
