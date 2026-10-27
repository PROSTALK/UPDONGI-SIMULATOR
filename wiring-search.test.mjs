import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PART_LIBRARY,defaultState,validateProject} from '../model.js';
import {searchParts,relatedSearches} from '../part-search.js';
import {MEGA_PINS,PCA_PINS,PORT_MAP,canonicalPort,portExists} from '../pinout.js';
import {checkWires} from '../engineering.js';
test('Korean, English aliases, Hangul initials and multiword searches',()=>{
 for(const query of ['아두이노','메가','mega','메가2560','ㅇㄷㅇㄴ'])assert.equal(searchParts(PART_LIBRARY,query)[0].id,'mega2560');
 for(const query of ['서보 드라이버','서보드라이버','pca','16채널'])assert.equal(searchParts(PART_LIBRARY,query)[0].id,'pca9685');
 assert.ok(searchParts(PART_LIBRARY,'ㅅㅂ').some(p=>p.id==='droyuke30'));
 assert.equal(searchParts(PART_LIBRARY,'서보 전원')[0].id,'becuser');
 assert.equal(searchParts(PART_LIBRARY,'리포')[0].id,'lipo2s');assert.equal(searchParts(PART_LIBRARY,'없는제품명').length,0);
 assert.ok(relatedSearches('서보',PART_LIBRARY).includes('서보 전원'));
 const custom={id:'custom',name:'테스트 센서',brand:'사용자',type:'other'};assert.equal(searchParts([...PART_LIBRARY,custom],'ㅌㅅㅌ')[0].id,'custom');
});
test('all main Mega IO and all 16 three-pin PCA9685 channels are connectable',()=>{
 for(let i=0;i<54;i++)assert.equal(portExists('mega.d'+i),true,'D'+i);
 for(let i=0;i<16;i++)assert.equal(portExists('mega.a'+i),true,'A'+i);
 for(let i=0;i<16;i++)for(const suffix of ['','_vplus','_gnd'])assert.equal(PORT_MAP.has('pca.ch'+i+suffix),true);
 assert.equal(new Set(MEGA_PINS.map(p=>p.id)).size,MEGA_PINS.length);assert.equal(new Set(PCA_PINS.map(p=>p.id)).size,PCA_PINS.length);
});
test('alternate Mega I2C sockets and ground sockets satisfy the same circuit nets',()=>{
 const s=defaultState();s.wires=s.wires.map(w=>({...w,a:w.a==='mega.sda'?'mega.sda_r3':w.a==='mega.scl'?'mega.scl_r3':w.a==='mega.gnd'?'mega.gnd2':w.a}));
 assert.equal(checkWires(s.wires).valid,true);
 assert.equal(canonicalPort('mega.d20'),'mega.sda');assert.equal(canonicalPort('mega.d21'),'mega.scl');
});
test('PCA9685 common V+ joins supply rails; logic VCC stays separate',()=>{
 const s=defaultState();const r=checkWires([...s.wires,{a:'bec0.outpos',b:'pca.ch0_vplus'},{a:'bec1.outpos',b:'pca.ch15_vplus'}]);
 assert.ok(r.errors.some(e=>e.title==='독립 전원 출력 연결 위험'));assert.notEqual(canonicalPort('pca.vcc'),canonicalPort('pca.vplus'));
 const short=checkWires([...s.wires,{a:'pca.ch0_vplus',b:'pca.ch15_gnd'}]);assert.ok(short.errors.some(e=>e.title==='PCA9685 공통 V+ 단락'));
});
test('wrong I2C/PWM to supply or other signal is detected',()=>{
 const s=defaultState();assert.equal(checkWires([...s.wires,{a:'mega.sda_r3',b:'mega.gnd_right1'}]).valid,false);
 assert.equal(checkWires([...s.wires,{a:'pca.ch0',b:'pca.ch1'}]).valid,false);
 assert.equal(checkWires([...s.wires,{a:'pca.ch0',b:'pca.ch0_vplus'}]).valid,false);
});
test('wiring layout persists in project JSON with bounded coordinates',()=>{
 const s=defaultState();s.wiringLayout={mega:{x:180,y:320},pca:{x:20000,y:-2000}};
 const loaded=validateProject(JSON.parse(JSON.stringify(s)));assert.deepEqual(loaded.wiringLayout.mega,{x:180,y:320});assert.deepEqual(loaded.wiringLayout.pca,{x:4000,y:-1000});
});
