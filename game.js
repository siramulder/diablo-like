// ค่าพื้นฐานของพื้นที่วาดเกม
const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;
const BACKGROUND_COLOR = "#1b1820";
const ACCELERATION = 1100; // พิกเซลต่อวินาทีกำลังสอง ใช้ทั้งเร่งและเบรกปกติ
const TURN_RATE = 1200 * Math.PI / 180; // เรเดียนต่อวินาที
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
  maxSpeed: 220,
  currentSpeed: 0,
  visualAngle: 0,
  facingAngle: 0
};
let destination = null;
let trip = null;
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
  planMovement();
}

canvas.addEventListener("pointerdown", handlePointerDown);
canvas.addEventListener("contextmenu", function (event) {
  event.preventDefault();
});

// เตรียมการเดินหนึ่งครั้งต่อคลิก โดยใช้ความเร็วที่มีอยู่ตอนรับคำสั่ง
function planMovement() {
  const dx = destination.x - player.x;
  const dy = destination.y - player.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) {
    destination = null;
    trip = null;
    player.currentSpeed = 0;
    return;
  }

  const startSpeed = player.currentSpeed;
  const normalBrakeDistance = startSpeed ** 2 / (2 * ACCELERATION);
  let brakeRate = ACCELERATION;
  // จาก v² = u² + 2as: เลือกความเร็วสูงสุดที่ยังเหลือทางให้เบรกทัน
  let peakSpeed = Math.min(player.maxSpeed, Math.sqrt(ACCELERATION * distance + startSpeed ** 2 / 2));
  if (distance < normalBrakeDistance) {
    peakSpeed = startSpeed;
    brakeRate = startSpeed ** 2 / (2 * distance);
  }
  const accelTime = (peakSpeed - startSpeed) / ACCELERATION;
  const accelDistance = (startSpeed + peakSpeed) * accelTime / 2;
  const brakeDistance = peakSpeed ** 2 / (2 * brakeRate);
  const cruiseDistance = Math.max(0, distance - accelDistance - brakeDistance);
  const brakeStart = accelTime + cruiseDistance / peakSpeed;

  player.facingAngle = Math.atan2(dy, dx);
  trip = {
    startX: player.x, startY: player.y, unitX: dx / distance, unitY: dy / distance,
    distance, startSpeed, peakSpeed, accelTime, accelDistance, brakeRate, brakeStart,
    endTime: brakeStart + peakSpeed / brakeRate, elapsed: 0
  };
}

function updateMovement(deltaTime) {
  if (trip === null) return;
  trip.elapsed += deltaTime;
  const t = trip.elapsed;
  if (t >= trip.endTime - 1e-12) {
    player.x = destination.x;
    player.y = destination.y;
    player.currentSpeed = 0;
    destination = null;
    trip = null;
    return;
  }

  // ใช้เวลารวมตั้งแต่คลิก จึงข้ามจากช่วงเร่งไปช่วงเบรกกลางเฟรมได้
  let travelled;
  if (t < trip.accelTime) {
    player.currentSpeed = trip.startSpeed + ACCELERATION * t;
    travelled = (trip.startSpeed + player.currentSpeed) * t / 2;
  } else if (t < trip.brakeStart) {
    player.currentSpeed = trip.peakSpeed;
    travelled = trip.accelDistance + trip.peakSpeed * (t - trip.accelTime);
  } else {
    const timeLeft = trip.endTime - t;
    player.currentSpeed = trip.brakeRate * timeLeft;
    travelled = trip.distance - player.currentSpeed * timeLeft / 2;
  }
  player.x = trip.startX + trip.unitX * travelled;
  player.y = trip.startY + trip.unitY * travelled;
}

function updateVisualAngle(deltaTime) {
  const difference = player.facingAngle - player.visualAngle;
  let turn = Math.atan2(Math.sin(difference), Math.cos(difference));
  // กลับตัวครึ่งรอบพอดีให้หมุนตามเข็มนาฬิกาบน Canvas
  if (Math.abs(Math.abs(turn) - Math.PI) < 1e-12) turn = Math.PI;
  const maxTurn = TURN_RATE * deltaTime;
  if (Math.abs(turn) <= maxTurn) {
    player.visualAngle = player.facingAngle;
  } else {
    player.visualAngle += Math.sign(turn) * maxTurn;
  }
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
  context.rotate(player.visualAngle);

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
  updateVisualAngle(deltaTime);
  render();
  requestAnimationFrame(gameLoop);
}

// วาดภาพเริ่มต้นทันที แล้วเริ่มวงรอบเพียงชุดเดียว
render();
requestAnimationFrame(gameLoop);
