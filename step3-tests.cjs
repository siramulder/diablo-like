// node step3-tests.cjs — Node assertions with simulated Canvas, input and time.
const assert = require('node:assert/strict');
const {simulate} = require('./step1-tests.cjs');
const results = [];
function test(id,name,run) {
  try { results.push({id,name,status:'Pass',evidence:run()}); }
  catch(error) { results.push({id,name,status:'Fail',evidence:error.message}); }
}
function near(a,b) { assert(Math.abs(a-b)<1e-8,a+' differs from '+b); }
function arrive(sim) {
  for(let i=1;i<=1200;i++) {
    sim.frame(i*1000/60);
    const p=sim.state().player;
    assert(p.x>=14 && p.x<=1986 && p.y>=14 && p.y<=1986);
    if(sim.state().destination===null) return;
  }
  assert.fail('Arrival timeout');
}
test('AT-25','World and player initialization',()=>{
  const sim=simulate(), p=sim.state().player;
  assert.deepEqual(sim.evaluate('[WORLD_WIDTH,WORLD_HEIGHT]'),[2000,2000]);
  assert.deepEqual([p.x,p.y,p.radius,p.maxSpeed,p.currentSpeed],[1000,1000,14,220,0]);
  assert.deepEqual([sim.canvas.width,sim.canvas.height],[960,540]);
  return 'World 2000x2000, canvas 960x540, player (1000,1000), radius14';
});
test('AT-26','Fixed viewport and conversions',()=>{
  const sim=simulate();
  assert.deepEqual(sim.evaluate('viewport'),{x:520,y:730});
  assert.deepEqual(sim.evaluate('worldToScreen(player)'),{x:480,y:270});
  for(const p of [{x:0,y:0},{x:1000,y:1000},{x:2000,y:2000},{x:17.25,y:1990.5}])
    assert.deepEqual(sim.evaluate('screenToWorld(worldToScreen('+JSON.stringify(p)+'))'),p);
  sim.frame(0); sim.click(900,500); arrive(sim);
  assert.deepEqual(sim.evaluate('viewport'),{x:520,y:730});
  return 'Four round trips, initial screen center, offset fixed after movement';
});
test('AT-27','Scaled pointer to world and marker',()=>{
  for(const layout of [{width:960,height:540},{left:123.5,top:45.25,width:480,height:270,borderLeft:3,borderRight:2,borderTop:4,borderBottom:5}]) {
    const sim=simulate(layout); sim.click(100,150);
    assert.deepEqual(sim.state().destination,{x:620,y:880}); sim.frame(0);
    const marker=sim.calls.find(c=>c.method==='arc' && c.args[2]===8);
    assert.deepEqual(marker.args.slice(0,2),[100,150]);
  }
  return 'Full/half-size clicks map to world (620,880), marker screen (100,150)';
});
test('AT-28','World boundaries',()=>{
  // World corners are outside the fixed view. Call the same setter used by
  // pointerdown directly to test boundaries, without adding a test UI to the game.
  for(const [x,y,tx,ty] of [[-100,-100,14,14],[2100,-100,1986,14],[-100,2100,14,1986],[2100,2100,1986,1986]]) {
    const sim=simulate(); sim.frame(0);
    sim.evaluate('(setDestination({x:'+x+',y:'+y+'}),true)');
    assert.deepEqual(sim.state().destination,{x:tx,y:ty}); arrive(sim);
    assert.deepEqual([sim.state().player.x,sim.state().player.y],[tx,ty]);
    assert.equal(sim.state().player.currentSpeed,0);
  }
  return 'Four corners clamp to 14/1986; every intermediate frame stays inside world';
});
test('AT-29','Dungeon grid and draw order',()=>{
  const sim=simulate(); sim.click(800,270); const calls=sim.frame(0);
  assert.deepEqual(calls[0].args,[0,0,960,540]);
  const grid=calls.filter(c=>c.method==='moveTo' && c.strokeColor==='#302b33');
  assert.deepEqual(grid.filter(c=>c.args[1]===0).map(c=>c.args[0]),Array.from({length:19},(_,i)=>30+50*i));
  assert.deepEqual(grid.filter(c=>c.args[0]===0).map(c=>c.args[1]),Array.from({length:11},(_,i)=>20+50*i));
  const floor=calls.findIndex(c=>c.method==='stroke' && c.strokeColor==='#302b33');
  const marker=calls.findIndex(c=>c.method==='arc' && c.args[2]===8);
  const body=calls.findIndex(c=>c.method==='arc' && c.args[2]===13);
  assert(floor<marker && marker<body);
  assert.deepEqual(calls[body].transform,{x:480,y:270,angle:0});
  return '19 vertical + 11 horizontal world-aligned lines; floor, marker, player draw order';
});
test('AT-30','Movement and input in world coordinates',()=>{
  const sim=simulate(); sim.frame(0); sim.click(900,270);
  sim.frame(100); near(sim.state().player.x,1005.5); near(sim.state().player.currentSpeed,110);
  sim.frame(200); near(sim.state().player.x,1022); near(sim.state().player.currentSpeed,220);
  sim.click(496.5,270); near(sim.state().player.currentSpeed,220);
  sim.dispatch('pointermove',{buttons:1,clientX:500,clientY:500}); sim.dispatch('pointerup'); sim.click(100,100,2);
  assert.deepEqual(sim.state().destination,{x:1016.5,y:1000});
  sim.frame(225); near(sim.state().player.currentSpeed,110);
  sim.frame(250); near(sim.state().player.x,1016.5); near(sim.state().player.currentSpeed,0);
  assert.equal(sim.state().destination,null); near(sim.state().player.visualAngle,Math.PI/3);
  return '5.5/22px ramp, continuous-speed reversal, stronger short brake, smooth turn, drag/release/right-click ignored';
});
test('AT-31','Equal-time samples at four frame rates',()=>{
  function sample(fps) {
    const sim=simulate(); sim.frame(0); sim.click(410,270); let frame=1;
    return [75,191,219,340,410,519,600].map(ms=>{
      while(frame*1000/fps<ms) sim.frame(frame++*1000/fps);
      sim.frame(ms); const p=sim.state().player;
      return [p.x,p.y,p.currentSpeed,p.visualAngle];
    });
  }
  const reference=sample(30);
  for(const fps of [60,120,144]) sample(fps).forEach((row,i)=>row.forEach((v,j)=>near(v,reference[i][j])));
  near(reference[6][0],930); near(reference[6][1],1000); near(reference[6][2],0);
  return 'Seven equal-time samples at 30/60/120/144 FPS agree within 1e-8, including arrival';
});
test('AT-32','Offscreen travel with fixed viewport',()=>{
  const sim=simulate(); sim.frame(0);
  sim.evaluate('(setDestination({x:1986,y:1000}),true)'); arrive(sim);
  assert.deepEqual(sim.evaluate('worldToScreen(player)'),{x:1466,y:270});
  const body=sim.calls.find(c=>c.method==='arc' && c.args[2]===13);
  assert.equal(body.transform.x,1466); assert.equal(sim.pendingFrames(),1);
  assert.deepEqual(sim.evaluate('viewport'),{x:520,y:730});
  assert.equal(sim.state().destination,null);
  return 'Direct world command arrives offscreen at world x1986 / screen x1466, fixed view and one RAF';
});
results.push({id:'S3-BR',name:'Actual browser rendering, resize and console',status:'Not Run',evidence:'Node VM checks only; browser verification pending.'});
console.log(JSON.stringify({results},null,2));
process.exitCode=results.some(r=>r.status==='Fail')?1:0;
