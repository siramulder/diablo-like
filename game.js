// ค่าพื้นฐานของพื้นที่วาดเกม
const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;
const BACKGROUND_COLOR = "#1b1820";
const MAX_DELTA_TIME = 0.1;

const canvas = document.getElementById("gameCanvas");
const context = canvas.getContext("2d");
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// Step 2 ใช้พิกัดบน Canvas โดยเริ่มตรงกลางและหันขวา
const player = {
  x: 480,
  y: 270,
  radius: 14,
  speed: 220,
  facingAngle: 0
};
let destination = null;
let previousTime = null;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(value, maximum));
}

// แปลงตำแหน่งเมาส์เป็นพิกัดเกม โดยไม่นับขอบเส้นของ Canvas
function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const style = getComputedStyle(canvas);
  const leftBorder = parseFloat(style.borderLeftWidth);
  const rightBorder = parseFloat(style.borderRightWidth);
  const topBorder = parseFloat(style.borderTopWidth);
  const bottomBorder = parseFloat(style.borderBottomWidth);
  const width = rect.width - leftBorder - rightBorder;
  const height = rect.height - topBorder - bottomBorder;
  const x = event.clientX - rect.left - leftBorder;
  const y = event.clientY - rect.top - topBorder;

  // ไม่รับการกดบนเส้นขอบหรือภายนอกพื้นที่วาด
  if (width <= 0 || height <= 0 || x < 0 || y < 0 || x >= width || y >= height) {
    return null;
  }
  return { x: x * CANVAS_WIDTH / width, y: y * CANVAS_HEIGHT / height };
}

// รับคำสั่งเฉพาะจังหวะกดซ้ายครั้งใหม่ ไม่ติดตามการลากหรือการปล่อย
function handlePointerDown(event) {
  if (event.button !== 0) return;
  const point = getCanvasPoint(event);
  if (point === null) return;

  destination = {
    x: clamp(point.x, player.radius, CANVAS_WIDTH - player.radius),
    y: clamp(point.y, player.radius, CANVAS_HEIGHT - player.radius)
  };
  if (destination.x === player.x && destination.y === player.y) {
    destination = null;
  }
}

canvas.addEventListener("pointerdown", handlePointerDown);
canvas.addEventListener("contextmenu", function (event) {
  event.preventDefault();
});

function updateMovement(deltaTime) {
  if (destination === null || deltaTime <= 0) return;

  const dx = destination.x - player.x;
  const dy = destination.y - player.y;
  const distance = Math.hypot(dx, dy);
  const step = player.speed * deltaTime;

  // หันตามทิศที่เดิน และเก็บมุมล่าสุดไว้เมื่อหยุด
  if (distance > 0) player.facingAngle = Math.atan2(dy, dx);

  // ก้าวสุดท้ายไปถึงพอดี ป้องกันการเดินเลยและสั่นไปมา
  if (distance <= step) {
    player.x = destination.x;
    player.y = destination.y;
    destination = null;
    return;
  }
  player.x += dx / distance * step;
  player.y += dy / distance * step;
}

function drawDestination() {
  if (destination === null) return;
  context.strokeStyle = "#e2bb65";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(destination.x, destination.y, 8, 0, Math.PI * 2);
  context.moveTo(destination.x - 5, destination.y);
  context.lineTo(destination.x + 5, destination.y);
  context.moveTo(destination.x, destination.y - 5);
  context.lineTo(destination.x, destination.y + 5);
  context.stroke();
}

function drawPlayer() {
  // เลื่อนจุดวาดไปที่ตัวละคร แล้วหมุนเฉพาะรูปของตัวละคร
  context.save();
  context.translate(player.x, player.y);
  context.rotate(player.facingAngle);

  context.fillStyle = "#b7c5d1";
  context.strokeStyle = "#e2bb65";
  context.lineWidth = 2;
  context.beginPath();
  // เส้นขอบกว้าง 2 จึงวาดวงกลมเล็กลง 1 เพื่อไม่เกินรัศมี 14
  context.arc(0, 0, player.radius - 1, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  // แถบหมวกเหล็กและปลายสามเหลี่ยมแสดงด้านหน้า
  context.fillStyle = "#344153";
  context.fillRect(-7, -8, 4, 16);
  context.fillStyle = "#fff0bb";
  context.beginPath();
  context.moveTo(12, 0);
  context.lineTo(2, -6);
  context.lineTo(2, 6);
  context.closePath();
  context.fill();
  context.restore();
}

function render() {
  context.fillStyle = BACKGROUND_COLOR;
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawDestination();
  drawPlayer();
}

function gameLoop(timestamp) {
  // แปลงมิลลิวินาทีเป็นวินาที เฟรมแรกยังไม่ขยับ
  const elapsed = previousTime === null ? 0 : (timestamp - previousTime) / 1000;
  const deltaTime = clamp(elapsed, 0, MAX_DELTA_TIME);
  previousTime = timestamp;
  updateMovement(deltaTime);
  render();
  requestAnimationFrame(gameLoop);
}

// วาดภาพเริ่มต้นทันที แล้วเริ่มวงรอบเพียงชุดเดียว
render();
requestAnimationFrame(gameLoop);
