import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {defaultState,validateProject} from '../model.js';
import {calculateLegs,evaluateMechanics,evaluatePower,checkWires} from '../engineering.js';
import {generateArduino} from '../codegen.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<=1e-10*Math.max(1,Math.abs(a)),String(a)+' / '+String(b));
test('power model preserves reference outputs from unmodified v0.2',async()=>{
 const fixtures=JSON.parse(await readFile(new URL('./power-reference.json',import.meta.url),'utf8'));
 for(const item of fixtures){const m=evaluateMechanics(item.state,calculateLegs(item.state,item.t));const actual=evaluatePower(item.state,m);for(const key in item.expected)close(actual[key],item.expected[key]);}
});
test('reachable IK poses preserve both link lengths; default crawl has at least 3 supports',()=>{
 const s=defaultState();for(let i=0;i<100;i++)for(const leg of calculateLegs(s,i*s.gait.period/100)){
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
  assert.equal(leg.feasible,true);close(distance(leg.hip,leg.knee),s.geometry.upper);close(distance(leg.knee,leg.foot),s.geometry.lower);
 }
 for(let i=0;i<100;i++)assert.ok(evaluateMechanics(s,calculateLegs(s,i*s.gait.period/100)).supports>=3);
});
test('project round trip and numeric boundaries',()=>{
 const s=defaultState();assert.deepEqual(validateProject(s),s);
 s.gait.duty=5;s.gait.period=0;s.power.becs[0].efficiency=10;const v=validateProject(s);
 assert.equal(v.gait.duty,.95);assert.equal(v.gait.period,.5);assert.equal(v.power.becs[0].efficiency,1);
 s.geometry.bodyH='invalid';assert.throws(()=>validateProject(s));
});
test('loaded part IDs cannot collide; duplicate IDs are rejected',()=>{
 const s=defaultState();s.placedParts.push({uid:'P5',catalogId:'mega2560',x:0,y:0,z:0,ry:0});assert.equal(validateProject(s).nextId,6);
 s.placedParts[1].uid=s.placedParts[0].uid;assert.throws(()=>validateProject(s));
});
test('default wiring passes; missing SDA and short circuit fail',()=>{
 const s=defaultState();assert.equal(checkWires(s.wires).valid,true);
 assert.equal(checkWires(s.wires.filter(w=>w.a!=='mega.sda')).valid,false);
 assert.equal(checkWires([...s.wires,{id:'short',a:'battery.pos',b:'battery.neg'}]).valid,false);
});
test('default generated firmware matches sample; invalid calibration is rejected',async()=>{
 const s=defaultState();assert.equal(generateArduino(s),await readFile(new URL('../quadruped_crawl_mega_example.ino',import.meta.url),'utf8'));
 s.calibration.servoMin=180;assert.throws(()=>generateArduino(s));
});
