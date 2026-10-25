# GAME DESIGN DOCUMENT (GDD)

## Project: Dark Fantasy RPG

**Version:** MVP 1.0\
**Document Version:** 1.1\
**Status:** Step 1 implemented; browser acceptance pending\
**Platform:** PC / Web Browser\
**Genre:** 2D Top-Down Action RPG\
**Inspiration:** Diablo Series

---

# 1. Game Overview

## 1.1 Game Concept

เกม Action RPG มุมมอง Top-Down ในโลก Dark Fantasy ที่ผู้เล่นรับบทเป็นนักรบออกสำรวจดันเจี้ยน ต่อสู้กับมอนสเตอร์ รวบรวมอุปกรณ์ และพัฒนาความสามารถของตัวละคร

เกมจะใช้ระบบควบคุมแบบ **Mouse Point & Click** โดยผู้เล่นคลิกบนพื้นเพื่อสั่งตัวละครเคลื่อนที่ไปยังตำแหน่งเป้าหมาย

ใน MVP 1.0 จะมุ่งเน้นการพัฒนาระบบเคลื่อนที่ การสำรวจแผนที่ ระบบกล้อง และ Collision Detection ซึ่งเป็นรากฐานของ Gameplay ในเวอร์ชันถัดไป

## 1.2 Game Vision

สร้างเกม Dark Fantasy Action RPG ที่มอบประสบการณ์การต่อสู้แบบ Real-Time Hack & Slash ผสมผสานการสำรวจดันเจี้ยน การเก็บ Loot และการพัฒนาตัวละคร โดยเน้นระบบควบคุมที่เข้าใจง่ายและตอบสนองรวดเร็ว

## 1.3 MVP 1.0 Objective

สร้างเกมต้นแบบที่ผู้เล่นสามารถ:

- ควบคุมตัวละครด้วย Mouse Point & Click
- เดินสำรวจแผนที่ดันเจี้ยน
- เปลี่ยนจุดหมายด้วยการคลิกใหม่
- มองเห็นตัวละครหันตามทิศทางการเคลื่อนที่
- เคลื่อนที่ภายในแผนที่โดยไม่ทะลุกำแพงหรือสิ่งกีดขวาง
- มองเห็นพื้นที่โดยรอบผ่านกล้องที่ติดตามตัวละคร

**Success Criteria:** ผู้เล่นสามารถสำรวจดันเจี้ยนด้วยการคลิกเมาส์ โดยระบบการเคลื่อนไหว กล้อง และการชนทำงานอย่างถูกต้อง

---

# 2. Core Gameplay

## 2.1 Core Gameplay Loop — MVP 1.0

1. ผู้เล่นมองเห็นตัวละครและสภาพแวดล้อม
2. ผู้เล่นคลิกพื้นเพื่อกำหนดจุดหมาย
3. ตัวละครหันหน้าและเคลื่อนที่ไปยังจุดหมาย
4. กล้องติดตามการเคลื่อนที่ของตัวละคร
5. ตัวละครหยุดเมื่อถึงจุดหมายหรือถูกสิ่งกีดขวาง
6. ผู้เล่นคลิกตำแหน่งใหม่เพื่อสำรวจพื้นที่ต่อ

Gameplay Loop นี้จะเป็นพื้นฐานสำหรับการเพิ่ม Combat, Loot และ Exploration Mechanics ในอนาคต

## 2.2 Player Controls

| Input                    | Action                  |
| ------------------------ | ----------------------- |
| Left Click บนพื้น        | กำหนดจุดหมายและสั่งเดิน |
| Left Click ตำแหน่งใหม่   | เปลี่ยนจุดหมายทันที     |
| Release Left Click       | ตัวละครยังเดินต่อ       |
| Hold Left Click          | ไม่มีการอัปเดตจุดหมาย   |
| Mouse Drag               | ไม่มีผลต่อจุดหมาย       |
| Left Click บนสิ่งกีดขวาง | ไม่เปลี่ยนจุดหมายเดิม   |
| Right Click              | ยังไม่มี Action         |

**Control Design Rules**

- ใช้ Single Click-to-Move เท่านั้น
- ไม่ใช้ WASD สำหรับการเดิน
- การลากเมาส์ไม่เปลี่ยนเป้าหมาย
- การคลิกใหม่ยกเลิกจุดหมายเดิมและกำหนดจุดหมายใหม่
- ตัวละครไม่จำเป็นต้องกดเมาส์ค้างเพื่อเดิน
- ยังไม่มีระบบเดินอ้อมสิ่งกีดขวางอัตโนมัติ

---

# 3. Player Character

## 3.1 Character Description

ตัวละครหลักเป็นนักรบในโลก Dark Fantasy

สำหรับ MVP 1.0 ใช้ Placeholder Graphics แทน Character Sprite เพื่อเน้นการพัฒนาระบบ Gameplay

## 3.2 Player Attributes

| Attribute          | Initial Value          |
| ------------------ | ---------------------- |
| Character Count    | 1                      |
| Movement Speed     | 220 pixels/second      |
| Movement Direction | 360°                   |
| Movement Type      | Click-to-Move          |
| Facing Direction   | ตามทิศทางการเคลื่อนที่ |
| Collision Shape    | Circle                 |
| Collision Radius   | 14 pixels              |
| Starting Position  | (1000, 1000)           |

ค่าข้างต้นเป็นค่าเริ่มต้นสำหรับพัฒนาและปรับแต่งระหว่างการทดสอบ

## 3.3 Movement Behavior

เมื่อผู้เล่นคลิกบนพื้นที่เดินได้:

1. ระบบอ่านตำแหน่งเมาส์
2. แปลง Screen Coordinates เป็น World Coordinates
3. ตรวจสอบว่าจุดหมายเดินได้หรือไม่
4. บันทึกจุดหมายใหม่หากตำแหน่งถูกต้อง
5. คำนวณทิศทางจากตัวละครไปยังจุดหมาย
6. หมุนตัวละครให้หันไปในทิศทางการเคลื่อนที่
7. เคลื่อนที่ด้วยความเร็วคงที่
8. หยุดเมื่อถึงจุดหมาย

Movement ต้องใช้ Delta Time เพื่อให้ความเร็วไม่ขึ้นอยู่กับ Frame Rate

## 3.4 Destination Behavior

- แสดงเครื่องหมายบนตำแหน่งเป้าหมาย
- จุดหมายคงอยู่หลังปล่อยเมาส์
- จุดหมายถูกแทนที่เมื่อคลิกจุดใหม่
- เครื่องหมายหายไปเมื่อตัวละครถึงจุดหมาย
- หากเส้นทางถูกกำแพงขวาง ตัวละครจะหยุดและยกเลิกจุดหมาย
- การคลิกตำแหน่งที่เดินไม่ได้จะไม่ลบจุดหมายเดิม

---

# 4. Game World & Level Design

## 4.1 World Specification

| Property      | Value                |
| ------------- | -------------------- |
| World Size    | 2000 × 2000 pixels   |
| Environment   | Dark Fantasy Dungeon |
| Level Count   | 1                    |
| Map Type      | Static               |
| Camera View   | 2D Top-Down          |
| Walkable Area | Dungeon Floor        |
| Obstacles     | Walls, Stone Pillars |

## 4.2 Environment Design

ดันเจี้ยนควรประกอบด้วย:

- พื้นหิน
- กำแพงหิน
- เสาหิน
- ทางเดินและพื้นที่เปิดโล่ง
- รายละเอียดตกแต่ง เช่น คบไฟ

สำหรับ MVP 1.0 ใช้รูปทรงเรขาคณิตและสีแทน Graphics Assets จริง

## 4.3 Level Layout

แผนที่ทดสอบควรมีพื้นที่ดังต่อไปนี้:

**Starting Area:** พื้นที่เปิดโล่งสำหรับทดสอบการเดินและเปลี่ยนจุดหมาย

**Obstacle Area:** พื้นที่ที่มีเสาหินและกำแพงสำหรับทดสอบ Collision Detection

**Corridor Area:** ทางเดินสำหรับทดสอบการเคลื่อนที่ในพื้นที่แคบ

**Boundary Area:** ขอบแผนที่สำหรับทดสอบข้อจำกัดการเคลื่อนที่และกล้อง

ผู้เล่นต้องสามารถเดินจาก Starting Area ไปยังพื้นที่ทดสอบอื่นได้ โดยมีเส้นทางที่ไม่ถูกปิดกั้นทั้งหมด

---

# 5. Camera System

## 5.1 Camera Behavior

ใช้ระบบ Smooth Follow Camera

- กล้องติดตามตำแหน่งตัวละคร
- กล้องเลื่อนอย่างนุ่มนวล
- ตัวละครอยู่ใกล้จุดกึ่งกลางหน้าจอเมื่อมีพื้นที่เพียงพอ
- กล้องหยุดเลื่อนเมื่อถึงขอบแผนที่
- การเคลื่อนที่ของกล้องไม่ส่งผลต่อความเร็วของตัวละคร

## 5.2 Camera Specification

| Property         | Value                  |
| ---------------- | ---------------------- |
| Viewport         | 960 × 540 pixels       |
| Tracking Target  | Player                 |
| Camera Type      | Smooth Follow          |
| World Boundaries | Enabled                |
| Smoothing        | Delta-Time Independent |

ระบบแปลงพิกัดเมาส์ต้องคำนึงถึงตำแหน่งกล้องเสมอ เพื่อให้ตัวละครเดินไปยังจุดที่ผู้เล่นคลิกบนแผนที่ได้ถูกต้อง

---

# 6. Collision System

## 6.1 Collision Requirements

ระบบต้องป้องกันไม่ให้ตัวละคร:

- เดินทะลุกำแพง
- เดินทะลุเสาหิน
- ออกนอกขอบแผนที่
- เคลื่อนที่ไปยังตำแหน่งที่ไม่สามารถยืนได้

## 6.2 Collision Behavior

เมื่อพบสิ่งกีดขวางระหว่างเดิน:

1. ตรวจสอบการชนก่อนอัปเดตตำแหน่ง
2. ไม่อนุญาตให้ตัวละครเคลื่อนผ่านสิ่งกีดขวาง
3. หยุดการเคลื่อนที่และยกเลิกจุดหมายที่ไปไม่ถึง
4. รอคำสั่งคลิกใหม่จากผู้เล่น

Collision Detection จะใช้ Circle Collision สำหรับตัวละคร และ Rectangle Collision สำหรับกำแพงและเสาหิน

## 6.3 Pathfinding

**ไม่รวม Pathfinding ใน MVP 1.0**

ตัวละครจะเคลื่อนที่เป็นเส้นตรงไปยังจุดหมายเท่านั้น หากมีกำแพงขวางจะหยุด ไม่พยายามหาเส้นทางอ้อม

ระบบ A\* Pathfinding จะพัฒนาใน MVP 1.1

---

# 7. User Interface (UI)

## 7.1 Game Screen

หน้าจอประกอบด้วย:

- Game Canvas ขนาด 960 × 540 pixels
- Player Character
- Dungeon Environment
- Destination Indicator
- Debug HUD (ถ้าทำได้)

## 7.2 Destination Indicator

แสดงวงกลมหรือเครื่องหมายบนพื้น ณ ตำแหน่งที่ผู้เล่นคลิก

**Behavior:**

- ปรากฏเมื่อคลิกจุดหมายที่เดินได้
- เคลื่อนตำแหน่งเมื่อผู้เล่นคลิกจุดหมายใหม่
- หายไปเมื่อถึงจุดหมายหรือการเคลื่อนที่ถูกขัดขวาง
- ไม่ปรากฏขึ้นใหม่เมื่อคลิกพื้นที่ที่เดินไม่ได้

## 7.3 Debug HUD (Should Have)

แสดงข้อมูล:

- Player X Coordinate
- Player Y Coordinate
- Current FPS

Debug HUD สามารถเปิดใช้เพื่อช่วยทดสอบระบบ Movement และ Camera

---

# 8. Technical Design

## 8.1 Technology Stack

| Component          | Technology          |
| ------------------ | ------------------- |
| Language           | JavaScript          |
| Rendering          | HTML5 Canvas 2D     |
| Web Structure      | HTML5               |
| Styling            | CSS                 |
| Development Tool   | VS Code             |
| Coding Assistant   | Codex               |
| External Libraries | None                |
| Target Platform    | Desktop Web Browser |

## 8.2 Project Structure

```text
dark-fantasy-rpg/
├── index.html
├── style.css
└── game.js
```

## 8.3 Core Systems

**Input System**

- Detect mouse clicks
- Convert Screen to World Coordinates
- Set movement destination

**Player Movement System**

- Calculate movement direction
- Normalize movement vector
- Update player position using Delta Time
- Stop at destination

**Collision System**

- Check wall and obstacle collisions
- Enforce world boundaries

**Camera System**

- Follow player
- Apply smoothing
- Enforce camera boundaries

**Rendering System**

- Draw environment
- Draw player
- Draw destination indicator
- Draw optional debug information

**Game Loop**

- Update game state
- Render frame
- Execute using requestAnimationFrame

---

# 9. MVP 1.0 Feature Scope

## 9.1 Must Have

| ID  | Feature               |
| --- | --------------------- |
| F01 | Game Canvas           |
| F02 | Player Character      |
| F03 | Single Click-to-Move  |
| F04 | Change Destination    |
| F05 | Auto-Facing           |
| F06 | World Map             |
| F07 | Smooth Camera Follow  |
| F08 | Collision Detection   |
| F09 | Destination Indicator |
| F10 | World Boundaries      |
| F11 | Delta-Time Game Loop  |

## 9.2 Should Have

| ID  | Feature                        |
| --- | ------------------------------ |
| F12 | Dungeon Environment Decoration |
| F13 | Debug HUD                      |

## 9.3 Out of Scope

- Keyboard Movement
- Hold-to-Move / Drag-to-Move
- A\* Pathfinding
- Combat System
- Enemy AI
- HP / Damage System
- Loot & Inventory
- Character Leveling
- Skills
- Boss Fight
- Quest System
- Save / Load System
- Multiplayer

---

# 10. Acceptance Criteria

| Test ID | Test Scenario       | Expected Result                |
| ------- | ------------------- | ------------------------------ |
| TC01    | Launch Game         | เกมเปิดและแสดงตัวละครกับแผนที่ |
| TC02    | Left Click          | ตัวละครเดินไปยังจุดที่คลิก     |
| TC03    | Release Mouse       | ตัวละครยังเดินต่อ              |
| TC04    | Hold & Drag         | จุดหมายไม่เปลี่ยน              |
| TC05    | Change Destination  | ตัวละครเปลี่ยนไปยังจุดหมายใหม่ |
| TC06    | Auto-Facing         | ตัวละครหันตามทิศทางการเดิน     |
| TC07    | Destination Reached | ตัวละครหยุดและไม่สั่นไปมา      |
| TC08    | Wall Collision      | ตัวละครเดินทะลุกำแพงไม่ได้     |
| TC09    | Invalid Destination | ไม่เปลี่ยนจุดหมายเดิม          |
| TC10    | Camera Follow       | กล้องติดตามตัวละครอย่างลื่นไหล |
| TC11    | World Boundaries    | ตัวละครและกล้องไม่ออกนอกแผนที่ |
| TC12    | Frame Independence  | ความเร็วไม่เปลี่ยนตาม FPS      |

---

# 11. Non-Functional Requirements

**Performance**

- เป้าหมายการแสดงผล 60 FPS บน Desktop Browser ทั่วไป
- ลดการกระตุกระหว่างเคลื่อนที่
- ความเร็วการเดินต้องไม่ขึ้นอยู่กับ FPS

**Usability**

- ใช้เมาส์ควบคุมได้โดยไม่ต้องเรียนรู้คำสั่งซับซ้อน
- ตัวละครตอบสนองต่อคำสั่งคลิกทันทีในรอบอัปเดตถัดไป
- มองเห็นจุดหมายได้ชัดเจน

**Maintainability**

- แยกความรับผิดชอบของระบบ Input, Movement, Collision, Camera และ Rendering
- ใช้ชื่อตัวแปรและฟังก์ชันที่เข้าใจง่าย
- มี Comment อธิบายส่วนสำคัญของโค้ด

---

# 12. Definition of Done (DoD)

MVP 1.0 จะถือว่าเสร็จสมบูรณ์เมื่อ:

1. ฟีเจอร์ Must Have ทำงานครบทุกข้อ
2. Acceptance Test ทั้ง 12 ข้อผ่าน
3. ไม่มีบั๊กที่ทำให้ตัวละครเดินทะลุกำแพงหรือออกนอกแผนที่
4. Click-to-Move ทำงานตาม Mouse Control Specification
5. Game Loop และ Camera ทำงานอย่างเสถียร
6. เกมสามารถเปิดเล่นได้บน Desktop Web Browser
7. โค้ดสามารถต่อยอดไปยัง MVP 1.1 ได้โดยไม่ต้องเปลี่ยนระบบควบคุมหลัก

---

# 13. Next Milestone

## MVP 1.1 — A\* Pathfinding

**Goal:** ปรับปรุงระบบ Click-to-Move ให้สามารถหาเส้นทางอ้อมสิ่งกีดขวางได้อัตโนมัติ

Planned Features:

- Navigation Grid
- Walkable / Non-Walkable Nodes
- A\* Pathfinding Algorithm
- Waypoint Following
- Path Recalculation เมื่อเปลี่ยนจุดหมาย
- Path Visualization สำหรับ Debugging

**Expected Outcome:** ผู้เล่นสามารถคลิกพื้นที่หลังสิ่งกีดขวาง และตัวละครสามารถคำนวณเส้นทางเพื่อเดินอ้อมไปยังจุดหมายนั้นได้

---

# 14. Development Progress — Step 1

**Updated:** 2026-10-26 (Asia/Bangkok)

## 14.1 Current Status

Step 1 — Project Setup & Game Canvas เขียนโค้ดเสร็จแล้ว ผลตรวจโค้ดและการรัน JavaScript กับ Canvas จำลองผ่าน แต่ยังไม่ได้ยืนยันผลในเบราว์เซอร์จริง จึงยังไม่ถือว่า Step 1 ผ่านการยอมรับครบทุกข้อ และ MVP 1.0 โดยรวมยังไม่เสร็จ

รายละเอียดระบบและเกณฑ์ทดสอบในหัวข้อ 1–13 เป็นเป้าหมายสำหรับ MVP 1.0 ทั้งหมด ไม่ใช่รายการฟีเจอร์ที่ทำเสร็จแล้วใน Step 1

## 14.2 Implemented

- index.html: ชื่อแท็บและหัวเรื่อง Dark Fantasy RPG; Canvas ภายใน 960 × 540; เชื่อม CSS และ JavaScript แบบ defer
- style.css: หน้าเว็บสีเข้ม หัวเรื่องสีทองหม่น Canvas จัดกลางพร้อมขอบบาง; max-width: 100% และ height: auto สำหรับหน้าต่างขนาดเล็ก
- game.js: ค่าคงที่ขนาด Canvas และสีพื้นหลัง; ขอ context แบบ 2d; ระบายสี #1b1820 เต็มพื้นที่หนึ่งครั้ง
- ยังไม่มีตัวละคร การเคลื่อนที่ เมาส์ควบคุม แผนที่ กล้อง การชน การต่อสู้ ศัตรู ช่องเก็บของ หรือไลบรารีภายนอก

## 14.3 Project Files and Local Launch

ไฟล์โค้ดเกม: index.html, style.css, game.js

ไฟล์สนับสนุนการพัฒนา: GAME DESIGN DOCUMENT (GDD).md และ step1-tests.cjs

เปิดเกมโดยดับเบิลคลิก index.html ในโฟลเดอร์โปรเจกต์ ไม่ต้องติดตั้งไลบรารีหรือเปิดเซิร์ฟเวอร์

รันทดสอบซ้ำจากโฟลเดอร์โปรเจกต์ด้วย Node.js:

```powershell
node .\step1-tests.cjs
```

สคริปต์ใช้เฉพาะโมดูลที่มากับ Node.js อ่านไฟล์เกมโดยไม่เขียนทับ และแสดงผลแต่ละรายการ หากมี Fail จะจบด้วยรหัส 1 รายการเบราว์เซอร์ยังเป็น Not Run และต้องตรวจเองแยกต่างหาก

## 14.4 Automated Test Evidence

ผลรันด้วย Node.js v24.19.0 เมื่อ 2026-10-26:

| Test ID | Test Name | Test Method | Status | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| AT-01 | ไฟล์ครบและไม่ว่าง | ตรวจไฟล์จริง | Pass | HTML 748, CSS 480, JS 764 ไบต์ | ครบสามไฟล์ |
| AT-02 | โครงสร้าง HTML | ตรวจแท็กและลำดับ | Pass | DOCTYPE, head/body, UTF-8 และแท็กซ้อนถูกต้อง | ไม่ใช่ตัวตรวจมาตรฐานแบบเต็ม |
| AT-03 | ชื่อหน้าและหัวเรื่อง | ตรวจ HTML/CSS | Pass | Dark Fantasy RPG ทั้งสองตำแหน่ง; ไม่พบการซ่อน | การมองเห็นจริงยัง Not Run |
| AT-04 | ความละเอียด Canvas | HTML และรัน JS จำลอง | Pass | 960 × 540; 16:9 | ไม่ใช่เบราว์เซอร์จริง |
| AT-05 | การเชื่อมไฟล์ | ตรวจตำแหน่งไฟล์ | Pass | style.css และ game.js อยู่ในเครื่อง; defer | ไม่ใช่การตรวจโหลดในเบราว์เซอร์ |
| AT-06 | Context และพื้นหลัง | รัน JS กับ Canvas จำลอง | Pass | 2d; fillRect เต็มพื้นที่หนึ่งครั้ง; #1b1820 | ตรวจคำสั่ง ไม่ใช่พิกเซลจริง |
| AT-07 | รูปแบบ JavaScript | node --check | Pass | รหัสจบ 0 | ไม่มีข้อผิดพลาดทางไวยากรณ์ |
| AT-08 | ขอบเขต Step 1 | ค้นหารูปแบบโค้ดและตรวจโค้ดปัจจุบัน | Pass | ไม่พบระบบต้องห้ามหรือไลบรารีภายนอก | การค้นหารูปแบบไม่ใช่หลักฐานสมบูรณ์สำหรับโค้ดทุกแบบ |
| AT-09 | การตั้งค่า responsive | ตรวจ CSS/HTML และรัน JS จำลอง | Pass | max-width:100%; height:auto; ภายใน 960 × 540 | การย่อหน้าต่างจริงยัง Not Run |
| BR-01 | หัวเรื่องและภาพ Canvas จริง | เบราว์เซอร์ | Not Run | เครื่องมือปฏิเสธ file:// ตามนโยบายความปลอดภัย | ต้องตรวจด้วยตนเอง |
| BR-02 | การจัดกลางและย่อหน้าต่าง | เบราว์เซอร์ | Not Run | ยังไม่มีผลจากเบราว์เซอร์ | ต้องตรวจด้วยตนเอง |
| BR-03 | Console และการโหลดไฟล์ | เบราว์เซอร์ | Not Run | ยังไม่มีผลจากเบราว์เซอร์ | ต้องตรวจด้วยตนเอง |
| QA-01 | เนื้อหาเกมไม่เปลี่ยนระหว่างทดสอบ | SHA-256 ก่อนและหลัง | Pass | ค่าตรงกันทั้งสามไฟล์ | สคริปต์ไม่แก้เกม |

## 14.5 Pending Acceptance and Next Step

- [ ] เปิด index.html แล้วเห็นชื่อเกมและ Canvas สีเข้มพร้อมขอบบาง
- [ ] ย่อและขยายหน้าต่าง: Canvas อยู่กลาง ไม่ล้นแนวนอน และพื้นที่วาดคงสัดส่วน 16:9
- [ ] ตรวจ document.querySelector('canvas').width ได้ 960 และ document.querySelector('canvas').height ได้ 540 แม้ย่อหน้าต่าง
- [ ] เปิด F12 → Console และรีโหลดหน้า: ไม่มีข้อผิดพลาดสีแดง
- [ ] ผู้ใช้ยืนยันว่า Step 1 ผ่านทั้งหมด

หยุดที่ Step 1 และรอผู้ใช้ยืนยันก่อนเริ่ม Step 2

---

**End of Document — MVP 1.0 GDD (Document Version 1.1)**
