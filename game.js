// ค่าพื้นฐานของพื้นที่วาดเกม
const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;
const BACKGROUND_COLOR = "#1b1820";

// หา Canvas ใน HTML และเตรียมเครื่องมือวาดภาพแบบ 2 มิติ
const canvas = document.getElementById("gameCanvas");
const context = canvas.getContext("2d");

// กำหนดขนาดพื้นที่วาดจริงเป็นพิกเซล
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// ระบายสีพื้นหลังเต็มพื้นที่หนึ่งครั้ง
context.fillStyle = BACKGROUND_COLOR;
context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
