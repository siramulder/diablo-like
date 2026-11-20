const assert = require('node:assert/strict');
const {simulate} = require('./step1-tests.cjs');
const results = [];
function test(id, name, run) {
  try { results.push({id,name,status:'Pass',evidence:run()}); }
  catch (error) { results.push({id,name,status:'Fail',evidence:error.stack}); }
}
function near(a,b,tolerance=1e-8) { assert(Math.abs(a-b)<=tolerance, a+' differs from '+b); }
function state(sim) { return sim.evaluate('({player,camera,destination,trip})'); }
function blocks(sim) {
  return sim.calls.filter(c=>c.method==='fillRect' && ['#514957','#6b626f'].includes(c.color));
}
function scene() {
  const sim=simulate();
  let time=0;
  sim.frame(0);
  function tick() {
    sim.frame(time+=100);
    const {player,camera}=state(sim);
    assert(player.x>=14 && player.x<=1986 && player.y>=14 && player.y<=1986);
    assert(camera.x>=0 && camera.x<=1040 && camera.y>=0 && camera.y<=1460);
    assert.equal(sim.pendingFrames(),1);
  }
  function travel(x,y) {
    for(let leg=0;leg<20;leg++) {
      const {player,camera}=state(sim);
      if(player.x===x && player.y===y) return;
      sim.click(Math.max(0,Math.min(959,x-camera.x)),Math.max(0,Math.min(539,y-camera.y)));
      for(let i=0;i<70 && sim.state().destination;i++) tick();
      assert.equal(sim.state().destination,null);
      for(let i=0;i<25;i++) tick();
    }
    assert.fail('Travel did not arrive');
  }
  return {sim,tick,travel};
}
test('AT-57','Obstacle data and world bounds',()=>{
  const objects=simulate().evaluate('obstacles');
  // Expected specification is independent of the game's runtime data.
  const expected = [
    {id:'corridor-left',type:'wall',x:700,y:250,width:80,height:450},
    {id:'corridor-right',type:'wall',x:1220,y:250,width:80,height:450},
    {id:'lower-left',type:'wall',x:400,y:1300,width:450,height:80},
    {id:'lower-right',type:'wall',x:1150,y:1300,width:450,height:80},
    {id:'pillar-nw',type:'pillar',x:400,y:500,width:80,height:80},
    {id:'pillar-sw',type:'pillar',x:400,y:900,width:80,height:80},
    {id:'pillar-ne',type:'pillar',x:1520,y:500,width:80,height:80},
    {id:'pillar-se',type:'pillar',x:1520,y:900,width:80,height:80}
  ];
  assert.deepEqual(objects,expected,'Obstacle dataset must match the exact specification');
  assert.equal(objects.length,8);
  assert.equal(new Set(objects.map(o=>o.id)).size,8);
  assert.equal(objects.filter(o=>o.type==='wall').length,4);
  assert.equal(objects.filter(o=>o.type==='pillar').length,4);
  for(const o of objects) {
    assert([o.x,o.y,o.width,o.height].every(Number.isFinite));
    assert(o.width>0 && o.height>0);
    assert(o.x>=150 && o.y>=150 && o.x+o.width<=1850 && o.y+o.height<=1850);
  }
  return 'Eight unique rectangles; four walls, four pillars, clear boundary area';
});
test('AT-58','Spawn and corridor clearance',()=>{
  const sim=simulate(), objects=sim.evaluate('obstacles');
  assert.deepEqual(sim.evaluate('[player.x,player.y,player.radius]'),[1000,1000,14]);
  for(const o of objects) {
    assert(o.x+o.width<=800 || o.x>=1200 || o.y+o.height<=800 || o.y>=1200);
    const dx=Math.max(o.x-1000,0,1000-o.x-o.width);
    const dy=Math.max(o.y-1000,0,1000-o.y-o.height);
    assert(Math.hypot(dx,dy)>14);
  }
  const byId=Object.fromEntries(objects.map(o=>[o.id,o]));
  assert.equal(byId['corridor-right'].x-byId['corridor-left'].x-byId['corridor-left'].width,440);
  assert.equal(byId['lower-right'].x-byId['lower-left'].x-byId['lower-left'].width,300);
  return '400x400 spawn area clear; northern and southern gaps 440/300px';
});
test('AT-59','Connected floor with radius clearance',()=>{
  const objects=simulate().evaluate('obstacles');
  const byId=Object.fromEntries(objects.map(o=>[o.id,o]));
  assert.equal(byId['corridor-right'].x-byId['corridor-left'].x-byId['corridor-left'].width,440);
  assert.equal(byId['lower-right'].x-byId['lower-left'].x-byId['lower-left'].width,300);
  // Conservative expanded rectangles include radius plus half a grid step.
  // Thus adjacent grid samples also leave room along the connecting segment.
  function open(x,y) {
    return x>=20 && y>=20 && x<=1980 && y<=1980 &&
      objects.every(o=>x<o.x-19 || x>o.x+o.width+19 || y<o.y-19 || y>o.y+o.height+19);
  }
  const queue=[[1000,1000]], visited=new Set(['1000,1000']);
  for(let i=0;i<queue.length;i++) {
    const [x,y]=queue[i];
    for(const [dx,dy] of [[10,0],[-10,0],[0,10],[0,-10]]) {
      const nx=x+dx,ny=y+dy,key=nx+','+ny;
      if(open(nx,ny) && !visited.has(key)) { visited.add(key);queue.push([nx,ny]); }
    }
  }
  for(const point of [[1000,150],[1000,1700],[200,500],[1800,500],[20,20],[20,1980],[1980,20],[1980,1980]])
    assert(visited.has(point.join(',')), 'Disconnected '+point);
  return 'Eight destinations connected with conservative radius clearance; '+visited.size+' grid samples';
});
test('AT-60','World anchored rendering while following and resizing',()=>{
  const {sim,tick}=scene(), objects=sim.evaluate('obstacles');
  sim.click(900,450);
  const first=state(sim).camera;
  for(let i=0;i<10;i++) {
    sim.setLayout({width:i%2?480:960,height:i%2?270:540,left:81,top:32});
    tick();
    const camera=state(sim).camera, draws=blocks(sim);
    assert.equal(draws.length,8);
    objects.forEach((o,j)=>{
      near(draws[j].args[0],o.x-camera.x); near(draws[j].args[1],o.y-camera.y);
      assert.deepEqual(draws[j].args.slice(2),[o.width,o.height]);
      const index=sim.calls.indexOf(draws[j]);
      assert.deepEqual(sim.calls[index+1].args,[o.x-camera.x,o.y-camera.y,o.width,3]);
      assert.deepEqual(sim.calls[index+2].args,[o.x-camera.x,o.y-camera.y,3,o.height]);
    });
  }
  assert(state(sim).camera.x>first.x);
  return 'Eight bodies and their internal highlights follow camera across ten resized frames';
});
test('AT-61','Render layering and single loop',()=>{
  const {sim,travel}=scene();
  travel(14,14); sim.click(150,150);
  // Render the new marker at the same clock time, without advancing movement.
  sim.evaluate('(render(),true)');
  const calls=sim.calls;
  const start=calls.map(c=>c.color).lastIndexOf('#1b1820');
  const frame=calls.slice(start);
  const indices=[
    frame.findIndex(c=>c.method==='stroke' && c.strokeColor==='#302b33'),
    frame.findIndex(c=>c.color==='#45404a'),
    frame.findIndex(c=>c.color==='#514957'),
    frame.findIndex(c=>c.method==='arc' && c.args[2]===8),
    frame.findIndex(c=>c.method==='arc' && c.args[2]===13)
  ];
  assert(indices.every((v,i)=>v>=0 && (!i || v>indices[i-1])));
  const obstacleIndices = frame.map((call,index) =>
    call.method==='fillRect' && ['#514957','#6b626f','#918796'].includes(call.color) ? index : -1
  ).filter(index=>index>=0);
  assert.equal(obstacleIndices.length,24);
  const lastEdge = frame.findLastIndex(call =>
    call.method==='fillRect' && ['#45404a','#29252e','#ffdc72','#99815a'].includes(call.color));
  assert(obstacleIndices.every(index=>index>lastEdge && index<indices[3]));
  assert.equal(sim.pendingFrames(),1);
  return 'Floor, world edge, obstacles, marker and warrior ordered; one RAF pending';
});
test('AT-62','Normal pointer clicks reach pillar centers and cross walls',()=>{
  const {sim,travel}=scene();
  travel(440,940); // Center of pillar-sw.
  assert.deepEqual([sim.state().player.x,sim.state().player.y],[440,940]);
  travel(740,750);
  travel(740,200); // Straight through the west wall.
  assert.deepEqual([sim.state().player.x,sim.state().player.y],[740,200]);
  assert.equal(sim.state().destination,null);
  assert(!sim.calls.some(c=>c.method==='arc' && c.args[2]===8));
  return 'Reached pillar center and crossed west wall via real pointer handler; marker cleared';
});
test('AT-63','Retarget and resize at equal times across FPS',()=>{
  function run(fps) {
    const sim=simulate();sim.frame(0);sim.click(900,270);
    let frame=1;
    const samples=[];
    for(const ms of [100,200,250,400,650,1000,2000]) {
      while(frame*1000/fps<ms) sim.frame(frame++*1000/fps);
      if(frame*1000/fps===ms) frame++;
      sim.frame(ms);
      if(ms===250) {
        sim.setLayout({width:480,height:270,left:103,top:77,borderLeft:2.5});
        const before=state(sim);
        sim.click(930-before.camera.x,1020-before.camera.y);
        const active=state(sim);
        near(active.player.currentSpeed,before.player.currentSpeed);
        near(active.player.visualAngle,before.player.visualAngle);
        near(active.destination.x,930);near(active.destination.y,1020);
        sim.dispatch('pointerdown',{clientX:'500',clientY:Infinity});
        sim.dispatch('pointermove',{buttons:1,clientX:200,clientY:200});
        assert.deepEqual(state(sim),active);
      }
      const {player,camera}=state(sim);
      samples.push([player.x,player.y,player.currentSpeed,player.visualAngle,camera.x,camera.y]);
      assert.equal(blocks(sim).length,8);
    }
    return samples;
  }
  const reference=run(144); let error=0;
  for(const fps of [30,60,120]) run(fps).forEach((row,i)=>row.forEach((v,j)=>{
    near(v,reference[i][j],j<4?1e-8:0.25);
    if(j>=4) error=Math.max(error,Math.abs(v-reference[i][j]));
  }));
  return '30/60/120/144 FPS with scaled input; max camera difference '+error.toFixed(6)+'px';
});
test('AT-64','World edge journey with obstacles and stable arrival',()=>{
  const {sim,travel,tick}=scene();
  for(const [x,y] of [[14,14],[1986,14],[1986,1986],[14,1986]]) {
    travel(x,y);
    assert.deepEqual([sim.state().player.x,sim.state().player.y],[x,y]);
    assert.equal(sim.calls.filter(c=>c.method==='fillRect' && c.color==='#ffdc72').length,2);
    assert.equal(blocks(sim).length,8);
    const stopped=state(sim);
    for(let i=0;i<5;i++) {tick();assert.deepEqual(state(sim),stopped);}
  }
  return 'Four corners reached through clicks; edge indicators and idle state correct';
});
const totals=Object.fromEntries(['Pass','Fail','Blocked','Not Run'].map(s=>[s,results.filter(r=>r.status===s).length]));
console.log(JSON.stringify({totals,results},null,2));
process.exitCode=totals.Fail?1:0;
