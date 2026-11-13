const assert = require('node:assert/strict');
const {simulate} = require('./step1-tests.cjs');
const sim = simulate();
const stone = '#45404a', gold = '#ffdc72', muted = '#99815a';
function rectangles(color) {
  return sim.calls.filter(c => c.method === 'fillRect' && c.color === color);
}
// Stage world coordinates and render without advancing the movement clock.
function scene(x,y,cx,cy) {
  sim.evaluate('(Object.assign(player,{x:'+x+',y:'+y+'}),Object.assign(camera,{x:'+cx+',y:'+cy+'}),true)');
  sim.frame(0);
}
scene(1000,1000,520,730);
assert.equal(rectangles(stone).length,0);
console.log('Pass: center has no edge strip');
scene(480,1000,6,730);
assert.deepEqual(rectangles(stone)[0].args,[-6,-730,12,2000]);
assert.equal(rectangles(muted).length,1);
assert.equal(rectangles(gold).length,0);
console.log('Pass: six pixels of world-anchored stone enter the view before contact');
for (const [x,y,cx,cy,trim] of [
  [14,1000,0,730,[10,-730,2,2000]], [1986,1000,1040,730,[948,-730,2,2000]],
  [1000,14,520,0,[-520,10,2000,2]], [1000,1986,520,1460,[-520,528,2000,2]]
]) {
  scene(x,y,cx,cy);
  for(let frame=0;frame<3;frame++) {
    sim.frame(0);
    assert.deepEqual(rectangles(gold).map(c=>c.args),[trim]);
  }
}
console.log('Pass: contact highlights each correct edge and persists across frames');
scene(14,14,0,0);
assert.equal(rectangles(gold).length,2);
assert.equal(rectangles(muted).length,0);
sim.click(160,14);
sim.frame(0);
const floor=sim.calls.findIndex(c=>c.method==='stroke' && c.strokeColor==='#302b33');
const strip=sim.calls.indexOf(rectangles(stone)[0]);
const trim=sim.calls.indexOf(rectangles(gold).at(-1));
const marker=sim.calls.findIndex(c=>c.method==='arc' && c.args[2]===8);
const body=sim.calls.findIndex(c=>c.method==='arc' && c.args[2]===13);
assert(floor>=0 && floor<strip && strip<trim && trim<marker && marker<body);
console.log('Pass: two highlighted sides at corner, drawn between floor and marker/player');
sim.frame(100);
assert(sim.state().player.x>14);
assert.deepEqual(rectangles(gold).map(c=>c.args),[[0,10,2000,2]]);
assert.equal(rectangles(muted).length,1);
sim.click(200,180); sim.frame(200);
assert.equal(rectangles(gold).length,0);
assert.equal(rectangles(muted).length,2);
console.log('Pass: departing one edge then both immediately restores the corresponding trim');
