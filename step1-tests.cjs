// Run: node step1-tests.cjs [project-folder]
// Built-in Node.js modules only. Application files are read, never written.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const root = path.resolve(process.argv[2] || __dirname);
const names = ['index.html', 'style.css', 'game.js'];
const results = [];
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const digest = name => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex');
const before = Object.fromEntries(names.filter(n => fs.existsSync(path.join(root,n))).map(n => [n,digest(n)]));
function test(id, name, method, run, notes = '') {
  try { results.push({id, name, method, status:'Pass', evidence:run(), notes}); }
  catch (error) { results.push({id, name, method, status:'Fail', evidence:error.message, notes}); }
}
function attributes(tag) {
  const values = {};
  for (const m of tag.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) values[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4];
  return values;
}
function cleanHtml() { return read('index.html').replace(/<!--[\s\S]*?-->/g, ''); }
function canvasAttributes() {
  const tags = cleanHtml().match(/<canvas\b[^>]*>/gi) || [];
  assert.equal(tags.length, 1, 'Expected one canvas');
  return attributes(tags[0]);
}
function cssRules() {
  const css = read('style.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert(!css.includes('@'), 'Advanced CSS needs browser/manual review');
  const rules = {};
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declarations = {};
    for (const declaration of m[2].split(';').filter(s => s.trim())) {
      const colon = declaration.indexOf(':');
      assert(colon > 0, 'Malformed CSS declaration');
      declarations[declaration.slice(0,colon).trim()] = declaration.slice(colon+1).trim();
    }
    for (const selector of m[1].split(',')) Object.assign(rules[selector.trim()] ||= {}, declarations);
  }
  return rules;
}
// Shared deterministic Canvas/event/frame harness. This is not a browser renderer.
function simulate(layout = {}) {
  const attrs = canvasAttributes();
  const calls = [], frames = [], listeners = {}, documentListeners = {};
  const geometry = {left:40, top:70, width:960, height:540,
    borderLeft:1, borderRight:1, borderTop:1, borderBottom:1, ...layout};
  let transform = {x:0, y:0, angle:0};
  const stack = [];
  const context = {fillStyle:'#000000', strokeStyle:'#000000', lineWidth:1};
  for (const method of ['fillRect','beginPath','arc','moveTo','lineTo','closePath','fill','stroke']) {
    context[method] = (...args) => calls.push({method, args, color:context.fillStyle,
      strokeColor:context.strokeStyle, lineWidth:context.lineWidth, transform:{...transform}});
  }
  context.save = () => {
    stack.push({transform:{...transform},fillStyle:context.fillStyle,strokeStyle:context.strokeStyle,lineWidth:context.lineWidth});
  };
  context.restore = () => {
    assert(stack.length > 0,'Unbalanced Canvas restore');
    const saved = stack.pop(); transform = saved.transform;
    Object.assign(context,{fillStyle:saved.fillStyle,strokeStyle:saved.strokeStyle,lineWidth:saved.lineWidth});
  };
  context.translate = (x,y) => { transform.x += x; transform.y += y; };
  context.rotate = angle => { transform.angle += angle; };
  const add = (target,type,handler) => (target[type] ||= []).push(handler);
  const canvas = {width:Number(attrs.width), height:Number(attrs.height),
    getContext(type) { assert.equal(type,'2d'); calls.push({context:type}); return context; },
    getBoundingClientRect() { return {left:geometry.left,top:geometry.top,
      width:geometry.width+geometry.borderLeft+geometry.borderRight,
      height:geometry.height+geometry.borderTop+geometry.borderBottom}; },
    addEventListener(type,handler) { add(listeners,type,handler); }
  };
  const sandbox = {
    document:{getElementById(id) { assert.equal(id,attrs.id); return canvas; },
      addEventListener(type,handler) { add(documentListeners,type,handler); }},
    getComputedStyle(element) {
      assert.equal(element,canvas);
      return {borderLeftWidth:geometry.borderLeft+'px',borderRightWidth:geometry.borderRight+'px',
        borderTopWidth:geometry.borderTop+'px',borderBottomWidth:geometry.borderBottom+'px'};
    },
    requestAnimationFrame(callback) { frames.push(callback); return frames.length; }
  };
  const realm = vm.createContext(sandbox);
  vm.runInContext(read('game.js'),realm,{timeout:1000,filename:'game.js'});
  function invoke(callback,argument) {
    sandbox.testCallback = callback; sandbox.testArgument = argument;
    try { vm.runInContext('testCallback(testArgument)',realm,{timeout:1000}); }
    finally { delete sandbox.testCallback; delete sandbox.testArgument; }
  }
  function dispatch(type,fields = {},outside = false) {
    const event = {button:0,clientX:0,clientY:0,defaultPrevented:false,
      preventDefault() { this.defaultPrevented = true; },...fields};
    for (const callback of (outside ? documentListeners : listeners)[type] || []) invoke(callback,event);
    return event;
  }
  return {canvas,calls,listeners,documentListeners,
    evaluate(code) { return JSON.parse(vm.runInContext("JSON.stringify(" + code + ")",realm)); },
    state() { return JSON.parse(vm.runInContext('JSON.stringify({player,destination})',realm)); },
    frame(timestamp) {
      assert.equal(frames.length,1,'Exactly one frame must be scheduled');
      calls.length = 0; invoke(frames.shift(),timestamp);
      assert.equal(stack.length,0,'Canvas transform must be restored each frame');
      return calls;
    },
    pendingFrames() { return frames.length; },
    dispatch,
    click(x,y,button = 0) {
      return dispatch('pointerdown',{button,
        clientX:geometry.left+geometry.borderLeft+x*geometry.width/960,
        clientY:geometry.top+geometry.borderTop+y*geometry.height/540});
    },
    setLayout(changes) { Object.assign(geometry,changes); }
  };
}

function runTests() {
test('AT-01','Required files','Filesystem assertions', () => {
  for (const name of names) { assert(fs.statSync(path.join(root,name)).isFile()); assert(read(name).trim().length > 0); }
  return names.map(n => `${n}: ${fs.statSync(path.join(root,n)).size} bytes`).join('; ');
});
test('AT-02','Basic HTML structure','Static tag nesting and required elements', () => {
  const html = cleanHtml();
  assert.match(html, /^\s*<!doctype html>/i);
  const stack = [], counts = {};
  const voids = new Set(['meta','link','br','hr','img','input','source','area','base','col','embed','param','track','wbr']);
  for (const m of html.matchAll(/<(\/?)([a-z][\w-]*)\b[^>]*>/gi)) {
    const tag = m[2].toLowerCase();
    if (m[1]) { assert.equal(stack.pop(),tag,`Mismatched closing tag: ${tag}`); }
    else { counts[tag] = (counts[tag] || 0)+1; if (!voids.has(tag)) stack.push(tag); }
  }
  assert.equal(stack.length,0);
  for (const tag of ['html','head','body','title','h1','canvas']) assert.equal(counts[tag],1,`Expected one ${tag}`);
  assert.match(html, /<html\b[^>]*>\s*<head\b[\s\S]*<\/head>\s*<body\b[\s\S]*<\/body>\s*<\/html>\s*$/i);
  assert.match(html, /<meta\s+charset=["']UTF-8["']/i);
  return 'DOCTYPE, nesting, head/body order and UTF-8 passed';
}, 'Small structural checker, not a complete HTML standards validator.');
test('AT-03','Title and heading','Static HTML/CSS', () => {
  const html = cleanHtml();
  for (const tag of ['title','h1']) assert.equal(html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`,'i'))?.[1].trim(),'เพชรพระอุเเมว');
  assert(!/<h1\b[^>]*\b(?:hidden|style)\b/i.test(html));
  for (const [selector,r] of Object.entries(cssRules())) {
    assert(['body','h1','canvas'].includes(selector),'Review unsupported selector: '+selector);
    assert(!['none'].includes(r.display)); assert(!['hidden','collapse'].includes(r.visibility)); assert(r.opacity !== '0');
  }
  return 'Title and h1 text match; no hiding rules in current source';
}, 'Actual visible heading requires browser verification.');
test('AT-04','Canvas resolution','HTML plus JavaScript with simulated Canvas', () => {
  const attrs = canvasAttributes(); assert.equal(Number(attrs.width),960); assert.equal(Number(attrs.height),540);
  const {canvas} = simulate(); assert.equal(canvas.width,960); assert.equal(canvas.height,540); assert.equal(canvas.width/canvas.height,16/9);
  return 'HTML and executed initialization: 960 x 540; ratio 16:9';
});
test('AT-05','Local CSS/JS references','Resolve paths and check files', () => {
  const html = cleanHtml();
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map(m=>attributes(m[0]));
  const scripts = [...html.matchAll(/<script\b[^>]*>/gi)].map(m=>({tag:m[0],...attributes(m[0])}));
  assert.equal(links.length,1); assert.equal(scripts.length,1);
  assert.equal(links[0].rel,'stylesheet'); assert.equal(links[0].href,'style.css'); assert.equal(scripts[0].src,'game.js'); assert.match(scripts[0].tag,/\sdefer\b/);
  for (const ref of [links[0].href,scripts[0].src]) {
    assert(!/^(?:[a-z]+:|\/\/)/i.test(ref));
    const resolved = path.resolve(root,ref); assert.equal(path.dirname(resolved),root); assert(fs.statSync(resolved).isFile());
  }
  return 'style.css and game.js resolve locally; script uses defer';
});
test('AT-06','2D context and per-frame dark fill','Execute game.js using instrumented Canvas', () => {
  const sim = simulate();
  assert.equal(sim.calls[0].context,'2d');
  for (const timestamp of [0,16,32]) {
    const calls = sim.frame(timestamp);
    assert.equal(calls[0].method,'fillRect','Background must be first draw command');
    assert.deepEqual(calls[0].args,[0,0,960,540]);
    assert.equal(calls[0].color,'#1b1820');
    assert.deepEqual(calls[0].transform,{x:0,y:0,angle:0});
    const backgrounds = calls.filter(c => c.method === 'fillRect' && c.args[2] === 960 && c.args[3] === 540);
    assert.equal(backgrounds.length,1,'Exactly one background fill per frame');
  }
  return "getContext('2d'); #1b1820 full background before player on 3 frames";
}, 'Updated for Step 2 animation. Checks commands, not rendered pixels.');
test('AT-07','JavaScript syntax','Node --check', () => {
  const result = spawnSync(process.execPath,['--check',path.join(root,'game.js')],{encoding:'utf8'});
  if (result.error) throw result.error;
  assert.equal(result.status,0,result.stderr); return 'node --check game.js: exit 0';
});
test('AT-08','Step 3.1 scope','Static screening plus limited runtime environment', () => {
  const js = read('game.js').replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g,'');
  assert(!/\b(camera|collision\w*|combat|enem\w*|inventory|loot|pathfinding|worldMap|obstacles|import|require|fetch|XMLHttpRequest|WebSocket|setInterval|setTimeout)\b/i.test(js),'Out-of-scope identifier or API found');
  assert(!/https?:|@import/i.test(read('style.css')),'External CSS reference found');
  const entries = fs.readdirSync(root); assert(!entries.includes('node_modules')); assert(!entries.includes('package.json'));
  assert.equal((cleanHtml().match(/<script\b/gi)||[]).length,1);
  const sim = simulate();
  assert.deepEqual(Object.keys(sim.listeners).sort(),['contextmenu','pointerdown']);
  assert.deepEqual(Object.keys(sim.documentListeners),[]);
  return 'Only canvas pointerdown/contextmenu handlers; no keyboard, combat markers or external libraries';
}, 'Heuristic source screening; not a proof against arbitrarily disguised code. Reviewed current small source as well.');
test('AT-09','Responsive configuration','Static CSS and HTML; simulated initialization', () => {
  const rules = cssRules(), r = rules.canvas; assert(r,'Missing canvas rule');
  assert.equal(r['max-width'],'100%'); assert.equal(r.height,'auto'); assert.equal(r.display,'block'); assert.equal(r.margin,'0 auto');
  assert.equal(r['box-sizing'],'border-box');
  assert(!r.width && !r['aspect-ratio'] && !r.transform,'Review additional sizing rules');
  assert.match(cleanHtml(),/<meta\b[^>]*name="viewport"[^>]*content="width=device-width, initial-scale=1.0"/i);
  const {canvas} = simulate(); assert.equal(canvas.width/canvas.height,16/9); assert.equal(canvas.width,960); assert.equal(canvas.height,540);
  return 'max-width:100%; height:auto; centered; viewport meta; internal 960x540';
}, 'CSS configuration only. Resize behavior and rendered content ratio need a browser; border is outside drawing content.');
for (const [id,name] of [['BR-01','Visible title and rendered canvas pixels'],['BR-02','Desktop/narrow layout, centering and resize aspect ratio'],['BR-03','Browser console and loading errors']]) {
  results.push({id,name,method:'Real browser',status:'Not Run',evidence:'This Node.js suite does not execute a real browser; earlier file:// browser automation was denied.',notes:'No browser result inferred from static or simulated checks.'});
}
test('QA-01','Application remains unchanged','SHA-256 comparison', () => {
  for (const [name,hash] of Object.entries(before)) assert.equal(digest(name),hash);
  return 'Application file hashes match before and after tests';
});
console.log(JSON.stringify({project:root,node:process.version,results},null,2));
process.exitCode = results.some(r=>r.status==='Fail') ? 1 : 0;

}

module.exports = {simulate};
if (require.main === module) runTests();
