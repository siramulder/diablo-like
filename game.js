// ค่าพื้นฐานของพื้นที่วาดเกม
const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;
const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 2000;
const camera = { x: 520, y: 730 };
const CAMERA_FOLLOW_STRENGTH = 8; // ต่อวินาที ยิ่งมากยิ่งตามเร็ว
const CAMERA_SETTLE_DISTANCE = 0.00001;
const GRID_SIZE = 50;
const BACKGROUND_COLOR = "#1b1820";
const ACCELERATION = 1100; // พิกเซลต่อวินาทีกำลังสอง ใช้ทั้งเร่งและเบรกปกติ
const TURN_RATE = 1200 * Math.PI / 180; // เรเดียนต่อวินาที
const MAX_DELTA_TIME = 0.1;

const canvas = document.getElementById("gameCanvas");
const context = canvas.getContext("2d");
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// ตำแหน่งเก็บเป็นพิกัดโลก เริ่มกลางโลกและหันขวา
const player = {
  x: 1000,
  y: 1000,
  radius: 14,
  maxSpeed: 220,
  currentSpeed: 0,
  visualAngle: 0,
  facingAngle: 0
};
let destination = null;
let trip = null;
let previousTime = null;

function worldToScreen(point) {
  return { x: point.x - camera.x, y: point.y - camera.y };
}

function screenToWorld(point) {
  return { x: point.x + camera.x, y: point.y + camera.y };
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(value, maximum));
}

// ตรวจทั้งข้อความก่อนแปลงความกว้างขอบจาก CSS เป็นพิกเซล
function readBorderPixels(value) {
  if (typeof value !== "string" || !/^\+?(?:\d+|\d*\.\d+)(?:[eE][+-]?\d+)?px$/.test(value)) return NaN;
  return Number(value.slice(0, -2));
}

// แปลงตำแหน่งเมาส์เป็นพิกัดเกม โดยไม่นับขอบเส้นของ Canvas
function getCanvasPoint(event) {
  // รับเฉพาะตัวเลขที่มีค่าจำกัด ก่อนนำไปคำนวณพิกัด
  if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return null;
  const rect = canvas.getBoundingClientRect();
  const style = getComputedStyle(canvas);
  const leftBorder = readBorderPixels(style.borderLeftWidth);
  const rightBorder = readBorderPixels(style.borderRightWidth);
  const topBorder = readBorderPixels(style.borderTopWidth);
  const bottomBorder = readBorderPixels(style.borderBottomWidth);
  const borders = [leftBorder, rightBorder, topBorder, bottomBorder];
  if (!borders.every(value => Number.isFinite(value) && value >= 0)) return null;
  if (![rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)) return null;

  const width = rect.width - leftBorder - rightBorder;
  const height = rect.height - topBorder - bottomBorder;
  const x = event.clientX - rect.left - leftBorder;
  const y = event.clientY - rect.top - topBorder;

  // ไม่รับการกดบนเส้นขอบหรือภายนอกพื้นที่วาด
  if (![width, height, x, y].every(Number.isFinite) ||
      width <= 0 || height <= 0 || x < 0 || y < 0 || x >= width || y >= height) {
    return null;
  }
  return { x: (x / width) * CANVAS_WIDTH, y: (y / height) * CANVAS_HEIGHT };
}

// รับคำสั่งเฉพาะจังหวะกดซ้ายครั้งใหม่ ไม่ติดตามการลากหรือการปล่อย
function handlePointerDown(event) {
  if (event.button !== 0) return;
  const point = getCanvasPoint(event);
  if (point === null) return;

  setDestination(screenToWorld(point));
}

// จำกัดจุดหมายในโลกก่อนคำนวณการเดิน
function setDestination(point) {
  // ข้อมูลผิดรูปต้องไม่เขียนทับจุดหมายและเส้นทางที่กำลังเดิน
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
  destination = {
    x: clamp(point.x, player.radius, WORLD_WIDTH - player.radius),
    y: clamp(point.y, player.radius, WORLD_HEIGHT - player.radius)
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

function getCameraTarget() {
  return {
    x: clamp(player.x - CANVAS_WIDTH / 2, 0, WORLD_WIDTH - CANVAS_WIDTH),
    y: clamp(player.y - CANVAS_HEIGHT / 2, 0, WORLD_HEIGHT - CANVAS_HEIGHT)
  };
}

// ค่อย ๆ ตามเป้าหมายที่เคลื่อนจากต้นเฟรมถึงท้ายเฟรม
// exponential ใช้เวลาจริง ส่วน movingWeight ลดความต่างเมื่อ FPS เปลี่ยน
function followCameraAxis(current, startTarget, endTarget, deltaTime, maximum) {
  const amount = CAMERA_FOLLOW_STRENGTH * deltaTime;
  const blend = -Math.expm1(-amount);
  const movingWeight = amount < 0.0001
    ? amount / 2 - amount * amount / 6
    : 1 - blend / amount;
  const next = current + (startTarget - current) * blend
    + (endTarget - startTarget) * movingWeight;
  if (Math.abs(endTarget - next) < CAMERA_SETTLE_DISTANCE) return endTarget;
  return clamp(next, 0, maximum);
}

function updateCamera(deltaTime, startTarget) {
  if (deltaTime <= 0) return;
  const target = getCameraTarget();
  camera.x = followCameraAxis(camera.x, startTarget.x, target.x, deltaTime, WORLD_WIDTH - CANVAS_WIDTH);
  camera.y = followCameraAxis(camera.y, startTarget.y, target.y, deltaTime, WORLD_HEIGHT - CANVAS_HEIGHT);
}

function drawDestination() {
  if (destination === null) return;
  const point = worldToScreen(destination);
  context.strokeStyle = "#e2bb65";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(point.x, point.y, 8, 0, Math.PI * 2);
  context.moveTo(point.x - 5, point.y);
  context.lineTo(point.x + 5, point.y);
  context.moveTo(point.x, point.y - 5);
  context.lineTo(point.x, point.y + 5);
  context.stroke();
}

function drawPlayer() {
  // เลื่อนจุดวาดไปที่ตัวละคร แล้วหมุนเฉพาะรูปของตัวละคร
  context.save();
  const point = worldToScreen(player);
  context.translate(point.x, point.y);
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

// เส้นพื้นผูกกับพิกัดโลก วาดเฉพาะส่วนในช่องมองปัจจุบัน
function drawFloor() {
  context.strokeStyle = "#302b33";
  context.lineWidth = 1;
  context.beginPath();
  const right = Math.min(WORLD_WIDTH, camera.x + CANVAS_WIDTH);
  const bottom = Math.min(WORLD_HEIGHT, camera.y + CANVAS_HEIGHT);
  for (let x = Math.ceil(camera.x / GRID_SIZE) * GRID_SIZE; x <= right; x += GRID_SIZE) {
    const topPoint = worldToScreen({ x, y: Math.max(0, camera.y) });
    const bottomPoint = worldToScreen({ x, y: bottom });
    context.moveTo(topPoint.x, topPoint.y);
    context.lineTo(bottomPoint.x, bottomPoint.y);
  }
  for (let y = Math.ceil(camera.y / GRID_SIZE) * GRID_SIZE; y <= bottom; y += GRID_SIZE) {
    const leftPoint = worldToScreen({ x: Math.max(0, camera.x), y });
    const rightPoint = worldToScreen({ x: right, y });
    context.moveTo(leftPoint.x, leftPoint.y);
    context.lineTo(rightPoint.x, rightPoint.y);
  }
  context.stroke();
}

// แถบหินอยู่ในพิกัดโลก เส้นทองอยู่ด้านที่หันเข้าหาพื้นเดิน
function drawEdgeStrip(x, y, width, height, vertical, trimOffset, touched) {
  const point = worldToScreen({ x, y });
  context.fillStyle = "#45404a";
  context.fillRect(point.x, point.y, width, height);

  // รอยต่อทุก 50 พิกเซลช่วยให้เห็นแถบเป็นก้อนหิน
  context.fillStyle = "#29252e";
  const start = vertical ? camera.y : camera.x;
  const end = Math.min(vertical ? WORLD_HEIGHT : WORLD_WIDTH,
    start + (vertical ? CANVAS_HEIGHT : CANVAS_WIDTH));
  for (let joint = Math.ceil(start / GRID_SIZE) * GRID_SIZE; joint < end; joint += GRID_SIZE) {
    if (vertical) context.fillRect(point.x, joint - camera.y, width, 2);
    else context.fillRect(joint - camera.x, point.y, 2, height);
  }

  context.fillStyle = touched ? "#ffdc72" : "#99815a";
  if (vertical) context.fillRect(point.x + trimOffset, point.y, 2, height);
  else context.fillRect(point.x, point.y + trimOffset, width, 2);
}

function drawWorldEdges() {
  const size = 12;
  if (camera.x < size)
    drawEdgeStrip(0, 0, size, WORLD_HEIGHT, true, size - 2, player.x <= player.radius);
  if (camera.x + CANVAS_WIDTH > WORLD_WIDTH - size)
    drawEdgeStrip(WORLD_WIDTH - size, 0, size, WORLD_HEIGHT, true, 0, player.x >= WORLD_WIDTH - player.radius);
  if (camera.y < size)
    drawEdgeStrip(0, 0, WORLD_WIDTH, size, false, size - 2, player.y <= player.radius);
  if (camera.y + CANVAS_HEIGHT > WORLD_HEIGHT - size)
    drawEdgeStrip(0, WORLD_HEIGHT - size, WORLD_WIDTH, size, false, 0, player.y >= WORLD_HEIGHT - player.radius);
}

function render() {
  context.fillStyle = BACKGROUND_COLOR;
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawFloor();
  drawWorldEdges();
  drawDestination();
  drawPlayer();
}

function gameLoop(timestamp) {
  // แปลงมิลลิวินาทีเป็นวินาที เฟรมแรกยังไม่ขยับ
  const elapsed = previousTime === null ? 0 : (timestamp - previousTime) / 1000;
  const deltaTime = clamp(elapsed, 0, MAX_DELTA_TIME);
  previousTime = timestamp;
  const startCameraTarget = getCameraTarget();
  updateMovement(deltaTime);
  updateVisualAngle(deltaTime);
  updateCamera(deltaTime, startCameraTarget);
  render();
  requestAnimationFrame(gameLoop);
}

// วาดภาพเริ่มต้นทันที แล้วเริ่มวงรอบเพียงชุดเดียว
render();
requestAnimationFrame(gameLoop);
