// Run: node step2-tests.cjs [project-folder]
// Real game.js runs in Node's VM with simulated input, drawing commands and frame times.
// These tests do NOT prove browser rendering or browser console behavior.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {simulate} = require('./step1-tests.cjs');
const root = path.resolve(process.argv[2] || __dirname);
const results = [];
const digest = name => crypto.createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex');
const files = ['index.html','style.css','game.js'];
const before = files.map(digest);
function test(id,name,run) {
  try { results.push({id,name,method:'Executed JavaScript with simulated Canvas/events/frames',status:'Pass',evidence:run()}); }
  catch (error) { results.push({id,name,method:'Executed assertions',status:'Fail',evidence:error.message}); }
}
function near(actual,expected,tolerance = 1e-8) {
  assert(Math.abs(actual-expected) <= tolerance,`Expected ${expected}, got ${actual}`);
}
function inBounds(player) {
  assert(player.x >= 14 && player.x <= 946,`x out of bounds: ${player.x}`);
  assert(player.y >= 14 && player.y <= 526,`y out of bounds: ${player.y}`);
}
function advanceToArrival(sim,start = 0) {
  for (let i=1;i<=600;i++) {
    sim.frame(start+i*1000/60);
    inBounds(sim.state().player);
    if (sim.state().destination === null) return start+i*1000/60;
  }
  assert.fail('Did not arrive within 600 frames');
}
const markers = sim => sim.calls.filter(c => c.method === 'arc' && c.args[2] === 8);

test('S2-01','Initial warrior and footprint',() => {
  const sim = simulate();
  assert.deepEqual(sim.state(),{player:{x:480,y:270,radius:14,speed:220,facingAngle:0},destination:null});
  const bodies = sim.calls.filter(c=>c.method==='arc');
  assert.equal(bodies.length,1);
  assert.deepEqual(bodies[0].transform,{x:480,y:270,angle:0});
  assert.equal(bodies[0].args[2]+bodies[0].lineWidth/2,14);
  assert(sim.calls.some(c=>c.method==='moveTo' && c.args[0]===12 && c.args[1]===0));
  assert(sim.calls.some(c=>c.method==='fill' && c.color==='#b7c5d1'));
  return 'One body drawn at (480,270), radius including stroke=14, speed=220, facing right';
});
test('S2-02','One left press and release',() => {
  const sim = simulate(); sim.frame(0); sim.click(800,270);
  assert.deepEqual(sim.state().destination,{x:800,y:270});
  sim.frame(100); near(sim.state().player.x,502);
  sim.dispatch('pointerup',{button:0}); sim.frame(200); near(sim.state().player.x,524);
  sim.dispatch('pointerup',{button:0},true); sim.frame(300); near(sim.state().player.x,546);
  assert.deepEqual(sim.state().destination,{x:800,y:270});
  return 'After one click: x=502,524,546 at 0.1,0.2,0.3s; release inside/outside does not stop';
});
test('S2-03','Holding and dragging do not retarget',() => {
  const sim = simulate(); sim.frame(0); sim.click(800,270);
  for (const buttons of [0,1]) {
    sim.dispatch('pointermove',{clientX:100,clientY:100,buttons});
    sim.dispatch('mousemove',{clientX:100,clientY:100,buttons});
    sim.dispatch('pointermove',{clientX:2000,clientY:2000,buttons},true);
    assert.deepEqual(sim.state().destination,{x:800,y:270});
  }
  sim.frame(100); near(sim.state().player.x,502);
  return 'Hover/drag inside and outside preserve (800,270); movement continues';
});
test('S2-04','New left press replaces active destination',() => {
  const sim = simulate(); sim.frame(0); sim.click(800,270); sim.frame(100);
  sim.click(100,270); assert.deepEqual(sim.state().destination,{x:100,y:270});
  sim.frame(200); near(sim.state().player.x,480); near(sim.state().player.facingAngle,Math.PI);
  return 'Retarget from right to left at x=502; next frame x=480 and facing PI';
});
test('S2-05','Other buttons, outside presses and keyboard ignored',() => {
  const sim = simulate(); sim.frame(0); sim.click(800,270);
  for (const button of [1,2]) sim.click(100,100,button);
  sim.dispatch('pointerdown',{button:0,clientX:100,clientY:100},true);
  for (const key of ['w','a','s','d','ArrowLeft']) sim.dispatch('keydown',{key},true);
  assert.deepEqual(sim.state().destination,{x:800,y:270});
  sim.frame(100); near(sim.state().player.x,502); near(sim.state().player.y,270);
  assert.equal(sim.dispatch('contextmenu').defaultPrevented,true);
  assert.equal(sim.dispatch('contextmenu',{},true).defaultPrevented,false);
  return 'Right/middle/outside/keyboard do not retarget; context menu suppressed only on Canvas';
});
test('S2-06','Constant speed and actual facing at 30/60/120/144 FPS',() => {
  const directions = [[900,270],[60,270],[480,520],[480,20],[800,500]];
  for (const fps of [30,60,120,144]) {
    for (const [x,y] of directions) {
      const sim = simulate(); sim.frame(0); sim.click(x,y);
      for (let frame=1;frame<=fps;frame++) sim.frame(frame*1000/fps);
      const p = sim.state().player;
      near(Math.hypot(p.x-480,p.y-270),220);
      near(p.facingAngle,Math.atan2(y-270,x-480));
      const directionLength = Math.hypot(x-480,y-270);
      near(p.x,480+(x-480)/directionLength*220);
      near(p.y,270+(y-270)/directionLength*220);
    }
  }
  return '20 runs: 30/60/120/144 FPS, horizontal/vertical/diagonal, all travel 220px in 1s with correct angle';
});
test('S2-07','Exact arrival and no oscillation',() => {
  const sim = simulate(); sim.frame(0); sim.click(483,274); sim.frame(100);
  const arrived = sim.state();
  assert.equal(arrived.player.x,483); assert.equal(arrived.player.y,274); assert.equal(arrived.destination,null);
  near(arrived.player.facingAngle,Math.atan2(4,3));
  for (let frame=2;frame<=20;frame++) { sim.frame(frame*100); assert.deepEqual(sim.state(),arrived); }
  return '5px destination reached exactly despite 22px step; next 19 frames remain stationary';
});
test('S2-08','Same-position clicks and tiny distance',() => {
  const sim = simulate(); sim.frame(0); sim.click(480,270); assert.equal(sim.state().destination,null);
  sim.click(800,270); sim.frame(100); sim.click(502,270); assert.equal(sim.state().destination,null);
  sim.frame(200); near(sim.state().player.x,502);
  sim.click(502.0000001,270); const target = sim.state().destination;
  sim.frame(300); assert.equal(sim.state().player.x,target.x); assert.equal(sim.state().destination,null);
  assert(Number.isFinite(sim.state().player.facingAngle));
  return 'Click current position cancels active movement; 0.0000001px move arrives without NaN';
});
test('S2-09','First frame and long frame cap',() => {
  const sim = simulate(); sim.click(900,270); sim.frame(5000); near(sim.state().player.x,480);
  sim.frame(15000); near(sim.state().player.x,502);
  sim.frame(15016); near(sim.state().player.x,505.52);
  return 'First frame=0 movement; 10s gap capped to 22px; following 16ms moves 3.52px';
});
test('S2-10','All corners clamp and remain inside footprint boundaries',() => {
  const cases = [[0,0,14,14],[959.9,0,946,14],[0,539.9,14,526],[959.9,539.9,946,526]];
  for (const [x,y,tx,ty] of cases) {
    const sim = simulate(); sim.frame(0); sim.click(x,y);
    assert.deepEqual(sim.state().destination,{x:tx,y:ty});
    sim.frame(0); assert.deepEqual(markers(sim)[0].args.slice(0,2),[tx,ty]);
    advanceToArrival(sim);
    assert.equal(sim.state().player.x,tx); assert.equal(sim.state().player.y,ty);
    assert.equal(sim.state().destination,null);
  }
  return 'All 4 corners arrive at x=14/946,y=14/526; every intermediate frame stays in bounds';
});
test('S2-11','Scaled coordinates include borders and page offsets',() => {
  const layouts = [
    {left:40,top:70,width:960,height:540},
    {left:125.5,top:230.25,width:480,height:270},
    {left:5,top:9,width:320,height:180,borderLeft:2,borderRight:3,borderTop:4,borderBottom:5}
  ];
  for (const layout of layouts) {
    const sim = simulate(layout);
    for (const [x,y] of [[100,100],[720,405],[900,500]]) {
      const clientX = layout.left+(layout.borderLeft ?? 1)+x*layout.width/960;
      const clientY = layout.top+(layout.borderTop ?? 1)+y*layout.height/540;
      sim.dispatch('pointerdown',{clientX,clientY,button:0});
      near(sim.state().destination.x,x); near(sim.state().destination.y,y);
    }
    assert.equal(sim.canvas.width,960); assert.equal(sim.canvas.height,540);
  }
  return '9 raw pointer cases at full/half/third size with fractional offsets and unequal borders';
});
test('S2-12','Border, outside and zero-size content ignored',() => {
  const sim = simulate(); sim.click(800,270);
  // Content occupies client x=41..1001 and y=71..611 (right/bottom excluded).
  for (const [clientX,clientY] of [[40.5,300],[1001.5,300],[500,70.5],[500,611.5],[-10,-10],[2000,2000]]) {
    sim.dispatch('pointerdown',{button:0,clientX,clientY});
    assert.deepEqual(sim.state().destination,{x:800,y:270});
  }
  sim.setLayout({width:0,height:0});
  sim.dispatch('pointerdown',{button:0,clientX:41,clientY:71});
  assert.deepEqual(sim.state().destination,{x:800,y:270});
  return 'All four border strips, outside points and zero-sized content keep previous target';
});
test('S2-13','Marker appears, changes and disappears',() => {
  const sim = simulate(); assert.equal(markers(sim).length,0);
  sim.click(800,270); sim.frame(0);
  assert.deepEqual(markers(sim)[0].args.slice(0,2),[800,270]);
  sim.click(483,274); sim.frame(0);
  assert.equal(markers(sim).length,1); assert.deepEqual(markers(sim)[0].args.slice(0,2),[483,274]);
  sim.frame(100); assert.equal(markers(sim).length,0);
  const body = sim.calls.find(c=>c.method==='arc');
  assert.deepEqual(body.transform,{x:483,y:274,angle:Math.atan2(4,3)});
  return 'Drawing commands show exactly one current marker, removed at arrival; body rotated to travel angle';
});
test('S2-14','Resize preserves target and internal resolution',() => {
  const sim = simulate(); sim.frame(0); sim.click(800,270); sim.frame(100);
  sim.setLayout({left:150,top:200,width:480,height:270});
  assert.deepEqual(sim.state().destination,{x:800,y:270});
  sim.frame(200); near(sim.state().player.x,524);
  sim.dispatch('pointerdown',{button:0,clientX:151+100,clientY:201+50});
  assert.deepEqual(sim.state().destination,{x:200,y:100});
  assert.equal(sim.canvas.width,960); assert.equal(sim.canvas.height,540);
  return 'Resize retains old target; subsequent half-size click maps to (200,100), internal 960x540';
});
test('S2-15','Single animation loop and draw order',() => {
  const sim = simulate(); assert.equal(sim.pendingFrames(),1);
  for (let i=0;i<50;i++) {
    sim.click(700+i,400); assert.equal(sim.pendingFrames(),1);
    const calls = sim.frame(i*16);
    assert.equal(sim.pendingFrames(),1);
    assert.equal(calls[0].method,'fillRect'); assert.deepEqual(calls[0].args,[0,0,960,540]);
    const arcs = calls.filter(c=>c.method==='arc');
    assert.equal(arcs.length,2); assert.equal(arcs[0].args[2],8); assert.equal(arcs[1].args[2],13);
  }
  return '50 retarget/frame cycles keep one scheduled callback; background -> marker -> one player';
});
test('S2-17','Visual center maps to internal center',() => {
  // width/height in the harness mean the content area, excluding the border.
  const layouts = [
    {left:0,top:0,width:960,height:540},
    {left:125.5,top:230.25,width:480,height:270},
    // Also cover outer border-box display sizes of exactly 960x540 and 480x270.
    {left:40,top:70,width:958,height:538},
    {left:125.5,top:230.25,width:478,height:268}
  ];
  for (const layout of layouts) {
    const sim = simulate(layout); sim.frame(0); sim.click(900,270); sim.frame(100);
    near(sim.state().player.x,502);
    sim.dispatch('pointerdown',{button:0,
      clientX:layout.left+1+layout.width/2,
      clientY:layout.top+1+layout.height/2});
    assert.deepEqual(sim.state().destination,{x:480,y:270});
    sim.frame(200);
    assert.equal(sim.state().player.x,480); assert.equal(sim.state().player.y,270);
    assert.equal(sim.state().destination,null);
  }
  return '4 center clicks with full/half content and border-box sizes, including non-zero offsets, map to (480,270) and arrive';
});
test('S2-18','Negative and out-of-range movement requests are safe',() => {
  const invalid = [[-1,270],[480,-1],[960,270],[480,540],[-10000,-10000],[10000,10000]];
  for (const active of [false,true]) {
    const sim = simulate(); sim.frame(0);
    if (active) sim.click(800,270);
    const state = sim.state();
    for (const [x,y] of invalid) {
      sim.click(x,y); assert.deepEqual(sim.state(),state);
    }
    sim.frame(100);
    inBounds(sim.state().player);
    near(sim.state().player.x,active ? 502 : 480);
    near(sim.state().player.y,270);
  }
  return '12 finite invalid pointer-coordinate requests ignored, both idle and moving; valid movement continues safely';
});
test('S2-19','Only a fresh left pointerdown sets a destination',() => {
  const sim = simulate(); sim.frame(0);
  const initial = sim.state();
  for (const button of [1,2]) sim.click(800,270,button);
  for (const type of ['click','mousedown','pointermove','pointerup']) {
    sim.dispatch(type,{button:0,buttons:1,clientX:800,clientY:300});
  }
  for (const key of ['w','a','s','d']) sim.dispatch('keydown',{key},true);
  sim.frame(100); assert.deepEqual(sim.state(),initial);
  sim.click(800,270); assert.deepEqual(sim.state().destination,{x:800,y:270});
  for (let i=1;i<=5;i++) {
    sim.dispatch('pointermove',{button:-1,buttons:1,clientX:100+i*10,clientY:100});
    sim.frame(100+i*100);
    assert.deepEqual(sim.state().destination,{x:800,y:270});
  }
  near(sim.state().player.x,590);
  sim.dispatch('pointerup',{button:0,clientX:100,clientY:100});
  assert.deepEqual(sim.state().destination,{x:800,y:270});
  sim.click(100,100); assert.deepEqual(sim.state().destination,{x:100,y:100});
  return 'Idle input stays idle; held dragging for 0.5s retains target and moves 110px; only a fresh left pointerdown replaces target';
});
test('S2-16','Game files not modified by tests',() => {
  assert.deepEqual(files.map(digest),before);
  return 'SHA-256 matches before/after for index.html, style.css and game.js';
});
results.push({id:'S2-BR',name:'Actual browser interaction, rendering, scaling and console',
  method:'Real browser',status:'Not Run',evidence:'Node simulation only; earlier local file browser automation was denied. Manual verification required.'});
// Acceptance rows summarize executed subtests; do not count these rows twice.
const groups = [
  ['AT-10','Player Initialization',['S2-01']],
  ['AT-11','Movement Calculation',['S2-06']],
  ['AT-12','Destination Replacement & Input Behavior',['S2-02','S2-03','S2-04','S2-05','S2-19']],
  ['AT-13','Arrival, Stop & Facing',['S2-07','S2-08','S2-09','S2-13','S2-15']],
  ['AT-14','Canvas Boundaries',['S2-10','S2-12','S2-18']],
  ['AT-15','Pointer Coordinate Conversion',['S2-11','S2-14','S2-17']]
];
const acceptance = groups.map(([id,name,ids]) => {
  const checks = ids.map(id => {
    const check = results.find(result=>result.id===id);
    assert(check,'Missing executed subtest: '+id); return check;
  });
  return {id,name,method:'Actual game.js executed in Node VM; mocked Canvas/input/clock',
    status:checks.every(check=>check.status==='Pass') ? 'Pass' : 'Fail',
    evidence:checks.map(check=>check.id+': '+check.evidence).join('; '),
    notes:'Not a real-browser rendering check.',checks:ids};
});
const assigned = groups.flatMap(group=>group[2]);
assert.equal(new Set(assigned).size,assigned.length,'A subtest was counted twice');
assert.deepEqual(assigned.slice().sort(),results.filter(r=>!['S2-16','S2-BR'].includes(r.id)).map(r=>r.id).sort(),'Acceptance mapping omitted coverage');
const totals = Object.fromEntries(['Pass','Fail','Blocked','Not Run'].map(status=>[status,results.filter(r=>r.status===status).length]));
console.log(JSON.stringify({project:root,node:process.version,totals,acceptance,results},null,2));
process.exitCode = results.some(result=>result.status==='Fail') ? 1 : 0;
