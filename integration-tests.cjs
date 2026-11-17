const assert = require('node:assert/strict');
const {simulate} = require('./step1-tests.cjs');
const results = [];

function test(id, name, run) {
  try {
    const evidence = run();
    results.push({id, name, status: 'Pass', evidence});
  } catch (error) {
    results.push({id, name, status: 'Fail', evidence: error.stack});
    process.exitCode = 1;
  }
}

function near(a, b, tolerance = 1e-8) {
  assert(Math.abs(a - b) <= tolerance, a + ' differs from ' + b);
}
function snapshot(sim) {
  return sim.evaluate('({player, camera, destination, trip})');
}
function bounded(value, low, high) {
  assert(Number.isFinite(value) && value >= low && value <= high, 'Out of range: ' + value);
}
function checkState(sim) {
  const {player, camera, destination, trip} = snapshot(sim);
  bounded(player.x, 14, 1986);
  bounded(player.y, 14, 1986);
  bounded(camera.x, 0, 1040);
  bounded(camera.y, 0, 1460);
  bounded(player.currentSpeed, 0, 220);
  assert(Number.isFinite(player.visualAngle) && Number.isFinite(player.facingAngle));
  assert.equal(trip === null, destination === null);
  if (destination) {
    bounded(destination.x, 14, 1986);
    bounded(destination.y, 14, 1986);
    assert(Object.values(trip).every(Number.isFinite));
  } else {
    assert.equal(player.currentSpeed, 0);
  }
  assert.equal(sim.pendingFrames(), 1);
}
function session() {
  const sim = simulate();
  let time = 0;
  sim.frame(time);
  function tick(ms = 100) {
    time += ms;
    sim.frame(time);
    checkState(sim);
  }
  function arrive() {
    for (let i = 0; i < 70 && sim.state().destination; i++) tick();
    assert.equal(sim.state().destination, null, 'Arrival timed out');
  }
  // Each click is limited to the current view; no teleport or camera override.
  function travel(x, y) {
    for (let leg = 0; leg < 16; leg++) {
      const {player, camera} = snapshot(sim);
      if (player.x === x && player.y === y) return;
      sim.click(Math.max(0, Math.min(959, x - camera.x)),
                Math.max(0, Math.min(539, y - camera.y)));
      arrive();
      for (let i = 0; i < 24; i++) tick();
    }
    assert.fail('Could not reach ' + [x,y]);
  }
  return {sim, tick, arrive, travel};
}
function arcs(sim, radius) {
  return sim.calls.filter(c => c.method === 'arc' && c.args[2] === radius);
}
function trims(sim, color) {
  return sim.calls.filter(c => c.method === 'fillRect' && c.color === color);
}
function checkMarker(sim) {
  const {camera, destination} = snapshot(sim);
  const markers = arcs(sim, 8);
  assert.equal(markers.length, destination ? 1 : 0);
  if (destination) {
    near(markers[0].args[0], destination.x - camera.x);
    near(markers[0].args[1], destination.y - camera.y);
  }
}

test('AT-49', 'Cross the world and return to spawn', () => {
  const {sim, travel} = session();
  for (const [x,y] of [[14,1000], [1986,1000], [1986,14], [1986,1986], [1000,1000]]) {
    travel(x,y);
    const {camera, player} = snapshot(sim);
    assert.deepEqual([player.x,player.y], [x,y]);
    assert.deepEqual([camera.x,camera.y], [Math.max(0,Math.min(1040,x-480)), Math.max(0,Math.min(1460,y-270))]);
    checkMarker(sim);
  }
  return 'Reached both ends of each axis and returned to center by clicks';
});

test('AT-50', 'Retarget burst mixed with rejected input', () => {
  const {sim,tick,arrive} = session();
  sim.click(900,450);
  tick(); tick();
  let target;
  for (let i = 0; i < 24; i++) {
    const {camera,player} = snapshot(sim);
    const x = i % 2 ? 100 : 850;
    sim.click(x,120+i);
    target = {x:camera.x+x, y:camera.y+120+i};
    const active = snapshot(sim);
    assert.deepEqual(active.destination,target);
    assert.equal(active.player.currentSpeed,player.currentSpeed);
    assert.equal(active.player.visualAngle,player.visualAngle);
    sim.dispatch('pointerdown',{clientX:NaN,clientY:100});
    sim.click(100,200,2);
    sim.dispatch('pointermove',{buttons:1,clientX:100,clientY:150});
    sim.dispatch('pointerup',{button:0});
    assert.deepEqual(snapshot(sim),active);
    tick(8);
    checkMarker(sim);
  }
  arrive();
  const {player} = sim.state();
  assert.deepEqual([player.x,player.y],[target.x,target.y]);
  return '24 reversals with invalid coordinates, right clicks, drag and release; latest target reached';
});

test('AT-51', 'Resize during camera follow and click again', () => {
  const {sim,tick,arrive} = session();
  sim.click(900,450);
  const original = sim.state().destination;
  tick(); tick();
  sim.setLayout({left:83,top:29,width:480,height:270,borderLeft:2.5,borderRight:1,borderTop:3,borderBottom:2});
  const before = sim.evaluate('camera');
  tick(40);
  const camera = sim.evaluate('camera');
  assert(camera.x > before.x && camera.y > before.y);
  assert.deepEqual(sim.state().destination, original);
  checkMarker(sim);
  // Raw client coordinates at one quarter of the new drawable area.
  sim.dispatch('pointerdown',{button:0,clientX:83+2.5+120,clientY:29+3+67.5});
  const expected = {x:camera.x+240,y:camera.y+135};
  assert.deepEqual(sim.state().destination,expected);
  assert.deepEqual([sim.canvas.width,sim.canvas.height],[960,540]);
  arrive();
  assert.deepEqual([sim.state().player.x,sim.state().player.y],[expected.x,expected.y]);
  return 'Half-size offset canvas with asymmetric borders preserved the old target and mapped the new click';
});

test('AT-52', 'Equal-time input, turning, camera and marker at four frame rates', () => {
  function sample(fps) {
    const sim = simulate();
    sim.frame(0); sim.click(900,270);
    const samples = [];
    // Common event times; 250 ms may fall between two native frames.
    let frame = 1;
    for (const ms of [100,200,250,300,400,650,1000,2000,3000]) {
      while (frame*1000/fps < ms) sim.frame(frame++*1000/fps);
      if (frame*1000/fps === ms) frame++;
      sim.frame(ms); checkState(sim); checkMarker(sim);
      const {player,camera,destination} = snapshot(sim);
      samples.push([player.x,player.y,player.currentSpeed,player.visualAngle,camera.x,camera.y,Boolean(destination)]);
      if (ms === 250) sim.click(930-camera.x,1020-camera.y);
    }
    assert.equal(sim.state().destination,null);
    return samples;
  }
  const reference = sample(144);
  let maxError = 0;
  for (const fps of [30,60,120]) {
    sample(fps).forEach((row,i) => {
      for (let k=0; k<4; k++) near(row[k],reference[i][k]);
      for (let k=4; k<6; k++) maxError = Math.max(maxError,Math.abs(row[k]-reference[i][k]));
      assert.equal(row[6],reference[i][6]);
    });
  }
  near(maxError,0,0.25);
  return 'Nine samples at 30/60/120/144 FPS; maximum camera difference '+maxError.toFixed(6)+' px';
});

test('AT-53', 'Walk into and away from all four illuminated corners', () => {
  const {sim,travel,tick} = session();
  for (const x of [14,1986]) for (const y of [14,1986]) {
    travel(x,y);
    const cx = x === 14 ? 0 : 1040, cy = y === 14 ? 0 : 1460;
    assert.deepEqual(trims(sim,'#ffdc72').map(c=>c.args),[
      [x === 14 ? 10 : 948,-cy || 0,2,2000],[-cx || 0,y === 14 ? 10 : 528,2000,2]
    ]);
    sim.click(480,270); tick();
    assert.equal(trims(sim,'#ffdc72').length,0);
    assert.equal(trims(sim,'#99815a').length,2);
  }
  return 'All four corners reached through input; both correct sides bright on contact and muted after departure';
});

test('AT-54', 'Resume after a long frame and finish the trip', () => {
  const paused = session(), normal = session();
  for (const run of [paused,normal]) {
    run.sim.click(900,450); run.tick(); run.tick();
    run.sim.click(180,100);
  }
  paused.tick(12000); normal.tick(100);
  for (let i=0; i<50; i++) {
    assert.deepEqual(snapshot(paused.sim),snapshot(normal.sim));
    checkMarker(paused.sim);
    paused.tick(50); normal.tick(50);
  }
  assert.equal(paused.sim.state().destination,null);
  return '12-second gap matched a 100 ms frame, followed by 50 matching recovery frames through arrival';
});

test('AT-55', 'Render order and one loop through input and arrival', () => {
  const {sim,travel,tick,arrive} = session();
  travel(14,14);
  for (let i=0;i<12;i++) sim.click(80+i,65);
  tick(0);
  const indices = [
    sim.calls.findIndex(c=>c.method==='fillRect' && c.color==='#1b1820'),
    sim.calls.findIndex(c=>c.method==='stroke' && c.strokeColor==='#302b33'),
    sim.calls.indexOf(trims(sim,'#45404a')[0]),
    sim.calls.indexOf(trims(sim,'#ffdc72').at(-1)),
    sim.calls.indexOf(arcs(sim,8)[0]),
    sim.calls.indexOf(arcs(sim,13)[0])
  ];
  assert(indices.every((index,i)=>index>=0 && (i===0 || indices[i-1]<index)));
  for (let i=0;i<5;i++) {
    tick(40); checkMarker(sim);
    const {camera,player} = snapshot(sim);
    const bodies = arcs(sim,13);
    assert.equal(bodies.length,1);
    near(bodies[0].transform.x,player.x-camera.x);
    near(bodies[0].transform.y,player.y-camera.y);
    near(bodies[0].transform.angle,player.visualAngle);
  }
  arrive(); checkMarker(sim);
  return 'Floor, strips, trim, marker, warrior in order; one warrior and one scheduled frame';
});

test('AT-56', 'Mixed journey preserves state and idle stability', () => {
  const {sim,tick,arrive} = session();
  assert.deepEqual(sim.evaluate('[WORLD_WIDTH,WORLD_HEIGHT,canvas.width,canvas.height,player.radius,player.maxSpeed,ACCELERATION,CAMERA_FOLLOW_STRENGTH]'),
    [2000,2000,960,540,14,220,1100,8]);
  near(sim.evaluate('TURN_RATE'),1200*Math.PI/180);
  for (let i=0;i<100;i++) {
    sim.setLayout({width:i%2 ? 384 : 960,height:i%2 ? 216 : 540});
    sim.click((i*137)%960,(i*73)%540);
    const before = snapshot(sim);
    sim.dispatch('keydown',{key:'w'},true);
    sim.click(-2,300);
    assert.deepEqual(snapshot(sim),before);
    tick(10+i%41); checkMarker(sim);
  }
  const goal = sim.state().destination;
  arrive();
  for (let i=0;i<30;i++) tick();
  const idle = snapshot(sim);
  assert.deepEqual([idle.player.x,idle.player.y],[goal.x,goal.y]);
  for (let i=0;i<20;i++) {
    tick(); checkMarker(sim);
    assert.deepEqual(snapshot(sim),idle);
  }
  return '100 resized retargets with rejected input, bounded finite state, exact arrival and 20 stable idle frames';
});

console.log(JSON.stringify({results},null,2));
