// Run: node camera-tests.cjs. Built-in Node, simulated Canvas/events/RAF.
// Equal-time moving-target tolerance is 0.25px, stationary target is 1e-8px.
const assert = require('node:assert/strict');
const {simulate} = require('./step1-tests.cjs');
const results = [];
function test(id, name, run) {
  try { results.push({id,name,status:'Pass',evidence:run()}); }
  catch (error) { results.push({id,name,status:'Fail',evidence:error.stack}); }
}
function near(actual,expected,tolerance=1e-8) {
  assert(Math.abs(actual-expected)<=tolerance, actual+' differs from '+expected);
}
function camera(sim) { return sim.evaluate('camera'); }
function bounds(sim) {
  const c=camera(sim), p=sim.state().player;
  assert(c.x>=0 && c.x<=1040 && c.y>=0 && c.y<=1460);
  assert(c.x+960<=2000 && c.y+540<=2000);
  assert(p.x>=14 && p.x<=1986 && p.y>=14 && p.y<=1986);
}
function worldClick(sim,x,y) {
  const c=camera(sim); sim.click(x-c.x,y-c.y);
}
test('AT-33','Initial camera, settings and target clamps',()=>{
  const sim=simulate();
  assert.deepEqual(camera(sim),{x:520,y:730});
  assert.deepEqual(sim.evaluate('[CANVAS_WIDTH,CANVAS_HEIGHT,WORLD_WIDTH,WORLD_HEIGHT,CAMERA_FOLLOW_STRENGTH]'),[960,540,2000,2000,8]);
  assert.deepEqual(sim.evaluate('getCameraTarget()'),{x:520,y:730});
  assert.deepEqual(sim.evaluate('worldToScreen(player)'),{x:480,y:270});
  for(const [x,y,tx,ty] of [[14,14,0,0],[1986,14,1040,0],[14,1986,0,1460],[1986,1986,1040,1460],[1200,1100,720,830]]) {
    sim.evaluate('(player.x='+x+',player.y='+y+',true)');
    assert.deepEqual(sim.evaluate('getCameraTarget()'),{x:tx,y:ty});
  }
  return 'Initial (520,730), strength8/s, correct centered/clamped targets at all corners and interior';
});
test('AT-34','Exponential smoothing and stationary settling',()=>{
  const values=[];
  for(const fps of [30,60,120,144]) {
    const sim=simulate(); sim.frame(0);
    sim.evaluate('(player.x=1200,player.y=1100,true)');
    let previous=camera(sim);
    for(let i=1;i<=fps*4;i++) {
      sim.frame(i*1000/fps); const c=camera(sim);
      assert(c.x>=previous.x && c.x<=720 && c.y>=previous.y && c.y<=830);
      if(i===fps) {
        near(c.x,720-200*Math.exp(-8)); near(c.y,830-100*Math.exp(-8));
        values.push(c.x);
      }
      previous=c;
    }
    assert.deepEqual(camera(sim),{x:720,y:830});
    for(let i=1;i<=10;i++) sim.frame(4000+i*16);
    assert.deepEqual(camera(sim),{x:720,y:830});
  }
  return 'Stationary-target response matches exp(-8t) within 1e-8 at all FPS; exact settled position stays still';
});
test('AT-35','Travel to four world corners and camera bounds',()=>{
  for(const [x,y,cx,cy] of [[14,14,0,0],[1986,14,1040,0],[14,1986,0,1460],[1986,1986,1040,1460]]) {
    const sim=simulate(); sim.frame(0);
    sim.evaluate('(setDestination({x:'+x+',y:'+y+'}),true)');
    for(let frame=1;frame<=720;frame++) {
      sim.frame(frame*1000/60); bounds(sim);
    }
    assert.deepEqual(camera(sim),{x:cx,y:cy});
    assert.deepEqual([sim.state().player.x,sim.state().player.y],[x,y]);
    assert.equal(sim.state().destination,null);
  }
  return '2880 frames checked: camera stays inside x0–1040/y0–1460, world remains covered, player inside radius bounds';
});
test('AT-36','Equal-time moving camera at 30/60/120/144 FPS',()=>{
  function sample(fps,point) {
    const sim=simulate(); sim.frame(0);
    sim.evaluate('(setDestination('+JSON.stringify(point)+'),true)');
    let frame=1;
    return [75,191,219,340,519,1000,2300,4700,6500,8500,10000].map(ms=>{
      while(frame*1000/fps<ms) sim.frame(frame++*1000/fps);
      sim.frame(ms); bounds(sim);
      const c=camera(sim), p=sim.state().player;
      return [c.x,c.y,p.x,p.y,p.currentSpeed,p.visualAngle];
    });
  }
  let maximum=0;
  for(const point of [{x:930,y:1000},{x:1400,y:1200},{x:1986,y:1986},{x:14,y:14}]) {
    const reference=sample(144,point);
    for(const fps of [30,60,120]) {
      sample(fps,point).forEach((row,i)=>row.forEach((v,j)=>{
        near(v,reference[i][j],j<2?0.25:1e-8);
        if(j<2) maximum=Math.max(maximum,Math.abs(v-reference[i][j]));
      }));
    }
  }
  return '44 sample points per FPS over short/diagonal/edge trips; maximum camera difference '+maximum.toFixed(6)+'px (limit0.25); movement agrees within1e-8';
});
test('AT-37','Pointer uses displayed camera under scaling and offsets',()=>{
  for(const layout of [{left:40,top:70,width:960,height:540},{left:123.5,top:210.25,width:478,height:268,borderLeft:2,borderRight:3,borderTop:4,borderBottom:5}]) {
    const sim=simulate(layout); sim.frame(0); sim.click(900,450);
    for(let i=1;i<=6;i++) sim.frame(i*50);
    const c=camera(sim), desired=sim.evaluate('getCameraTarget()');
    assert(Math.abs(c.x-desired.x)>1);
    const speed=sim.state().player.currentSpeed;
    const clientX=layout.left+(layout.borderLeft||1)+200*layout.width/960;
    const clientY=layout.top+(layout.borderTop||1)+150*layout.height/540;
    sim.dispatch('pointerdown',{button:0,clientX,clientY});
    const dest=sim.state().destination;
    near(dest.x,c.x+200); near(dest.y,c.y+150);
    near(sim.state().player.currentSpeed,speed);
    sim.frame(300);
    const marker=sim.calls.find(c=>c.method==='arc' && c.args[2]===8);
    near(marker.args[0],200); near(marker.args[1],150);
    sim.setLayout({width:320,height:180});
    sim.frame(350); const resizedCamera=camera(sim);
    sim.click(300,200);
    near(sim.state().destination.x,resizedCamera.x+300);
    near(sim.state().destination.y,resizedCamera.y+200);
  }
  return 'Raw pointer coordinates at full/narrow sizes and after resize use displayed camera, not target; speed preserved';
});
test('AT-38','World-fixed marker/grid, transforms and draw order',()=>{
  const sim=simulate(); sim.frame(0); sim.click(900,450);
  const dest=sim.state().destination;
  let initialMarker;
  for(let i=1;i<=20;i++) {
    sim.frame(i*25); const c=camera(sim), p=sim.state().player;
    assert.deepEqual(sim.state().destination,dest);
    const calls=sim.calls;
    const markerIndex=calls.findIndex(c=>c.method==='arc' && c.args[2]===8);
    const bodyIndex=calls.findIndex(c=>c.method==='arc' && c.args[2]===13);
    const floorIndex=calls.findIndex(c=>c.method==='stroke' && c.strokeColor==='#302b33');
    assert(floorIndex<markerIndex && markerIndex<bodyIndex);
    const marker=calls[markerIndex],body=calls[bodyIndex];
    near(marker.args[0]+c.x,dest.x); near(marker.args[1]+c.y,dest.y);
    near(body.transform.x+c.x,p.x); near(body.transform.y+c.y,p.y);
    near(body.transform.angle,p.visualAngle);
    if(i===1) initialMarker=marker.args[0];
    if(i===20) assert(marker.args[0]<initialMarker);
    const lines=calls.filter(c=>c.method==='moveTo' && c.strokeColor==='#302b33');
    for(const line of lines) {
      if(line.args[1]===0) near((line.args[0]+c.x)/50,Math.round((line.args[0]+c.x)/50));
      if(line.args[0]===0) near((line.args[1]+c.y)/50,Math.round((line.args[1]+c.y)/50));
    }
    assert.equal(calls[0].method,'fillRect');
    assert.deepEqual(calls[0].args,[0,0,960,540]); assert.equal(sim.pendingFrames(),1);
  }
  return '20 moving-camera frames keep marker/grid world-fixed, body transform correct, background/grid/marker/player order and one RAF';
});
test('AT-39','Input, close retarget, frame cap and turning with real camera',()=>{
  const sim=simulate(); sim.click(900,270); sim.frame(5000);
  assert.deepEqual(camera(sim),{x:520,y:730});
  sim.frame(15000); near(sim.state().player.x,1005.5);
  sim.frame(15100); near(sim.state().player.currentSpeed,220);
  const before=sim.state().destination;
  sim.dispatch('pointermove',{buttons:1,clientX:200,clientY:200});
  sim.dispatch('pointerup'); sim.click(100,100,2);
  sim.dispatch('pointerdown',{button:0,clientX:0,clientY:0},true);
  assert.deepEqual(sim.state().destination,before);
  worldClick(sim,1016.5,1000);
  near(sim.state().player.currentSpeed,220);
  sim.frame(15125); near(sim.state().player.currentSpeed,110);
  sim.frame(15150); near(sim.state().player.x,1016.5);
  assert.equal(sim.state().destination,null); near(sim.state().player.visualAngle,Math.PI/3);
  sim.frame(15250); near(sim.state().player.visualAngle,Math.PI);
  const p=sim.state().player;
  worldClick(sim,p.x,p.y); assert.equal(sim.state().destination,null);
  assert.equal(sim.pendingFrames(),1); bounds(sim);
  return 'Real camera preserves release/drag/right/outside rules, 0.1s cap, 220→110→0 short reversal, clockwise turn and same-position stop';
});
test('AT-40','Explore to both world edges through normal clicks',()=>{
  const sim=simulate(); sim.frame(0); let time=0;
  for(const [sx,sy,x,y,cx,cy] of [[959,539,1986,1986,1040,1460],[0,0,14,14,0,0]]) {
    for(let click=0;click<8;click++) {
      sim.click(sx,sy);
      for(let frame=0;frame<180;frame++) {
        time+=1000/60; sim.frame(time); bounds(sim);
      }
    }
    for(let i=0;i<180;i++) { time+=1000/60; sim.frame(time); }
    near(sim.state().player.x,x); near(sim.state().player.y,y);
    near(camera(sim).x,cx); near(camera(sim).y,cy);
  }
  assert.equal(sim.pendingFrames(),1);
  return 'Repeated left clicks traverse from center to bottom-right then top-left; both player and camera stop at proper world limits';
});
results.push({id:'CAM-BR',name:'Real browser follow, visual jitter, pointer accuracy and console',status:'Not Run',evidence:'Node simulation only; manual browser checks pending'});
console.log(JSON.stringify({results},null,2));
process.exitCode=results.some(r=>r.status==='Fail')?1:0;
