// node destination-tests.cjs — actual game.js in the shared Node VM.
// No camera stubs. Browser visuals require separate manual verification.
const assert = require('node:assert/strict');
const {simulate} = require('./step1-tests.cjs');
const results = [];
function test(id,name,run) {
  try { results.push({id,name,method:'Executed game.js in Node VM',status:'Pass',evidence:run()}); }
  catch(error) { results.push({id,name,method:'Executed assertions',status:'Fail',evidence:error.message}); }
}
function near(a,b) { assert(Math.abs(a-b)<1e-8,a+' differs from '+b); }
function snapshot(sim) { return sim.evaluate('({player,destination,camera,trip})'); }
function healthy(sim) {
  // Check in the VM: JSON serialization would turn NaN/Infinity into null.
  assert(sim.evaluate('[player,camera,destination,trip].filter(Boolean).every(object => Object.values(object).every(Number.isFinite))'));
  const {player:p,camera:c}=snapshot(sim);
  assert(p.x>=14 && p.x<=1986 && p.y>=14 && p.y<=1986);
  assert(c.x>=0 && c.x<=1040 && c.y>=0 && c.y<=1460);
  assert.equal(sim.pendingFrames(),1);
}
function moving(layout) {
  const sim=simulate(layout); sim.frame(0); sim.click(900,450);
  for(let i=1;i<=6;i++) sim.frame(i*50);
  return sim;
}
test('AT-41','Clicks during camera movement and settling',()=>{
  const sim=moving();
  for(const time of [300,450,700,1500,4000]) {
    // Advance in small frames so time is not discarded by the normal frame cap.
    let previous=sim.evaluate('previousTime');
    while(previous<time) { previous=Math.min(time,previous+25);sim.frame(previous); }
    const c=sim.evaluate('camera');
    sim.click(200,100);
    near(sim.state().destination.x,c.x+200); near(sim.state().destination.y,c.y+100);
    healthy(sim);
  }
  // Stop exactly at the current player, then let the camera finish settling.
  const p=sim.state().player,c=sim.evaluate('camera');
  sim.click(p.x-c.x,p.y-c.y);
  for(let time=4025;time<=8000;time+=25) sim.frame(time);
  assert.equal(sim.state().destination,null);
  assert.deepEqual(sim.evaluate('camera'),sim.evaluate('getCameraTarget()'));
  sim.click(100,120);
  const settled=sim.evaluate('camera');
  near(sim.state().destination.x,settled.x+100); near(sim.state().destination.y,settled.y+120);
  return 'Five moving-camera clicks and a settled-camera click use displayed offset; exact same-position click stops';
});
test('AT-42','Destination persists across repeated CSS resizing',()=>{
  const sim=moving(), target=sim.state().destination;
  for(const [i,layout] of [
    {left:123.5,top:210.25,width:478,height:268,borderLeft:2.5,borderRight:3.5,borderTop:4.5,borderBottom:5.5},
    {left:-20.25,top:-35.5,width:320,height:180,borderLeft:0,borderRight:0,borderTop:0,borderBottom:0},
    {left:40,top:70,width:960,height:540,borderLeft:1,borderRight:1,borderTop:1,borderBottom:1}
  ].entries()) {
    sim.setLayout(layout); sim.frame(325+i*25);
    assert.deepEqual(sim.state().destination,target);
    const marker=sim.calls.find(c=>c.method==='arc' && c.args[2]===8);
    const c=sim.evaluate('camera');
    near(marker.args[0]+c.x,target.x); near(marker.args[1]+c.y,target.y);
  }
  for(let time=400;time<=4000;time+=25) sim.frame(time);
  near(sim.state().player.x,target.x); near(sim.state().player.y,target.y);
  assert.equal(sim.state().destination,null);
  return 'Three resizes/offset/border changes preserve world target and marker through exact arrival';
});
test('AT-43','Fractional borders and drawable-content edges',()=>{
  const layout={left:120.25,top:75.5,width:478,height:268,borderLeft:2.5,borderRight:3.5,borderTop:4.5,borderBottom:5.5};
  const sim=moving(layout), left=122.75,top=80,right=600.75,bottom=348;
  for(const [x,y] of [[left,top],[right-0.001,bottom-0.001],[left+123.125,top+65.25]]) {
    const c=sim.evaluate('camera');
    sim.dispatch('pointerdown',{button:0,clientX:x,clientY:y});
    near(sim.state().destination.x,c.x+(x-left)*960/478);
    near(sim.state().destination.y,c.y+(y-top)*540/268);
  }
  const before=snapshot(sim);
  for(const [x,y] of [[left-0.001,100],[right,100],[right+1,100],[200,top-0.001],[200,bottom],[200,bottom+1],[-1,-1]]) {
    sim.dispatch('pointerdown',{button:0,clientX:x,clientY:y});
    assert.deepEqual(snapshot(sim),before);
  }
  return 'Three fractional valid content points; seven border/outside points preserve full active trip';
});
test('AT-44','Malformed pointer and direct destination rejection',()=>{
  const invalid=[NaN,Infinity,-Infinity,undefined,null,'500','',true,{},[],1n,Symbol('bad')];
  let checked=0;
  for(const active of [false,true]) {
    const sim=active?moving():simulate(); const before=snapshot(sim);
    for(const value of invalid) for(const axis of ['clientX','clientY']) {
      sim.dispatch('pointerdown',{button:0,clientX:500,clientY:200,[axis]:value});
      assert.deepEqual(snapshot(sim),before); healthy(sim); checked++;
    }
    // Direct setter is the shared entry to movement planning; validate before mutation.
    for(const expression of ['null','undefined','{}','{x:NaN,y:1000}','{x:1000,y:Infinity}','{x:"1000",y:1000}']) {
      sim.evaluate('(setDestination('+expression+'),true)');
      assert.deepEqual(snapshot(sim),before); healthy(sim); checked++;
    }
    const time=active?325:0;sim.frame(time);healthy(sim);
    sim.click(200,150); assert(sim.state().destination);healthy(sim);
  }
  return checked+' malformed requests rejected idle/moving, trip preserved and subsequent valid click works';
});
test('AT-45','Invalid canvas geometry preserves active trip',()=>{
  const sim=moving(),before=snapshot(sim);
  const invalid=[{width:0},{height:0},{width:-10},{height:-10},{width:NaN},{height:Infinity},
    {left:NaN},{top:Infinity},{borderLeft:NaN},{borderTop:Infinity},{borderRight:-2}];
  for(const change of invalid) {
    sim.setLayout({left:40,top:70,width:960,height:540,borderLeft:1,borderRight:1,borderTop:1,borderBottom:1,...change});
    sim.dispatch('pointerdown',{button:0,clientX:500,clientY:200});
    assert.deepEqual(snapshot(sim),before);healthy(sim);
  }
  sim.setLayout({left:40,top:70,width:480,height:270,borderLeft:1,borderRight:1,borderTop:1,borderBottom:1});
  sim.click(100,100);assert.notDeepEqual(sim.state().destination,before.destination);
  sim.frame(325);healthy(sim);
  return '11 zero/negative/non-finite layout cases rejected without altering trip; valid resized layout recovers';
});
test('AT-46','Rapid valid/invalid retargets preserve speed and shortest turn',()=>{
  const sim=moving(); const speed=sim.state().player.currentSpeed;
  const angle=sim.state().player.visualAngle;
  for(let i=0;i<100;i++) {
    const c=sim.evaluate('camera'),x=100+(i*37)%750,y=50+(i*23)%400;
    sim.click(x,y);
    near(sim.state().destination.x,c.x+x);near(sim.state().destination.y,c.y+y);
    near(sim.state().player.currentSpeed,speed);near(sim.state().player.visualAngle,angle);
    const before=snapshot(sim);
    sim.dispatch('pointerdown',{button:0,clientX:NaN,clientY:200});
    sim.click(200,100,2);sim.dispatch('pointermove',{buttons:1,clientX:200,clientY:200});
    assert.deepEqual(snapshot(sim),before);healthy(sim);
  }
  const target=sim.state().destination;
  for(let time=325;time<=4000;time+=25) {sim.frame(time);healthy(sim);}
  near(sim.state().player.x,target.x);near(sim.state().player.y,target.y);
  assert.equal(sim.state().destination,null);
  const p=sim.state().player, c=sim.evaluate('camera');
  function aim(degrees) {
    const radians=degrees*Math.PI/180;
    sim.click(p.x+100*Math.cos(radians)-c.x,p.y+100*Math.sin(radians)-c.y);
  }
  aim(179);
  for(let time=4025;time<=4200;time+=25) sim.frame(time);
  near(sim.state().player.visualAngle,179*Math.PI/180);
  // Use current world position/current displayed camera for the second turn.
  const current=sim.state().player,display=sim.evaluate('camera'),r=-179*Math.PI/180;
  sim.click(current.x+100*Math.cos(r)-display.x,current.y+100*Math.sin(r)-display.y);
  sim.frame(4201);near(sim.state().player.visualAngle,180.2*Math.PI/180);
  sim.frame(4202);near(sim.state().player.visualAngle,r);
  return '100 mixed click bursts keep latest valid target, scalar speed, current visual angle and one RAF; 179 to -179 turns 2 degrees';
});
test('AT-47','Corner clicks clamp at all four world edges',()=>{
  for(const [cx,cy,px,py,sx,sy,tx,ty] of [
    [0,0,100,100,0,0,14,14],[1040,0,1900,100,959.999,0,1986,14],
    [0,1460,100,1900,0,539.999,14,1986],[1040,1460,1900,1900,959.999,539.999,1986,1986]
  ]) {
    const sim=simulate({left:55.5,top:91.25,width:478,height:268,borderLeft:2,borderRight:3,borderTop:4,borderBottom:5});
    // Arrange a valid near-corner scene, then use the actual pointer handler.
    sim.evaluate('(camera.x='+cx+',camera.y='+cy+',player.x='+px+',player.y='+py+',true)');
    sim.frame(0);sim.click(sx,sy);
    assert.deepEqual(sim.state().destination,{x:tx,y:ty});
    sim.frame(0);
    const marker=sim.calls.find(c=>c.method==='arc'&&c.args[2]===8);
    near(marker.args[0]+cx,tx);near(marker.args[1]+cy,ty);
    for(let time=25;time<=2000;time+=25) {sim.frame(time);healthy(sim);}
    near(sim.state().player.x,tx);near(sim.state().player.y,ty);
    assert.equal(sim.state().destination,null);
  }
  return 'Four half-size pointer corner clicks clamp to14/1986, marker matches clamped target; all frames stay in bounds';
});
test('AT-48','Input restrictions and equal-time retarget regression',()=>{
  function run(fps) {
    const sim=simulate();sim.frame(0);sim.click(900,270);
    let next=1;
    function advance(ms) {
      while(next*1000/fps<ms) sim.frame(next++*1000/fps);
      sim.frame(ms);healthy(sim);
    }
    advance(200);
    const before=snapshot(sim);
    for(const type of ['click','mousedown','pointermove','pointerup','mousemove']) sim.dispatch(type,{button:0,buttons:1,clientX:300,clientY:200});
    for(const button of [1,2,-1,undefined,null,'0']) sim.dispatch('pointerdown',{button,clientX:300,clientY:200});
    for(const key of ['w','a','s','d']) sim.dispatch('keydown',{key},true);
    sim.dispatch('pointerdown',{button:0,clientX:300,clientY:200},true);
    assert.deepEqual(snapshot(sim),before);
    const c=sim.evaluate('camera');
    sim.click(900-c.x,1100-c.y);
    const samples=[];
    for(const time of [225,300,450,600,900,1500,3000]) {
      advance(time);
      const state=snapshot(sim);
      samples.push([state.player.x,state.player.y,state.player.currentSpeed,state.player.visualAngle,state.camera.x,state.camera.y]);
    }
    return samples;
  }
  const reference=run(144);let error=0;
  for(const fps of [30,60,120]) run(fps).forEach((row,i)=>row.forEach((v,j)=>{
    const difference=Math.abs(v-reference[i][j]);
    assert(difference<=(j<4?1e-8:0.25));
    if(j>=4)error=Math.max(error,difference);
  }));
  return 'Ignored input preserves full trip; timed retarget at30/60/120/144 FPS agrees within1e-8 movement, max camera error '+error.toFixed(6)+'px';
});
results.push({id:'DEST-BR',name:'Real browser coordinate and destination acceptance',method:'Real browser',status:'Not Run',evidence:'Node VM only; manual Step3.3 verification pending'});
const totals=Object.fromEntries(['Pass','Fail','Blocked','Not Run'].map(status=>[status,results.filter(r=>r.status===status).length]));
console.log(JSON.stringify({totals,results},null,2));
process.exitCode=totals.Fail?1:0;
