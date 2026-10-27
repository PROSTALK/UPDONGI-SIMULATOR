const NS='http://www.w3.org/2000/svg';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nodes=(()=>{
 let n=[{id:'battery',label:'2S LiPo 7.4V nominal',sub:'실제 충전 전압은 최대 8.4V',x:40,y:100,w:230,pins:['pos','neg']},
 {id:'mega',label:'ARDUINO MEGA 2560',sub:'USB 5V 전원 가정 (시험용)',x:40,y:740,w:250,pins:['v5','gnd','sda','scl']},
 {id:'pca',label:'PCA9685 • 16CH',sub:'VCC 논리 전원 / V+ 미사용',x:720,y:54,w:255,pins:['vcc','gnd','sda','scl','vplus',...Array.from({length:12},(_,i)=>'ch'+i)]}];
 for(let i=0;i<4;i++)n.push({id:'bec'+i,label:`BEC ${i+1} • 6V`,sub:'전원 분배 (사용자 정의)',x:355,y:72+228*i,w:225,pins:['inpos','inneg','outpos','outneg']});
 for(let i=0;i<12;i++)n.push({id:'servo'+i,label:`SERVO ${i} • ${Math.floor(i/3)===0?'FL':Math.floor(i/3)===1?'FR':Math.floor(i/3)===2?'RL':'RR'}`,sub:'3핀: 전원+, GND, SIG',x:1130,y:62+82*i,w:260,pins:['pos','neg','signal']});
 return n;
})();
const pretty={pos:'+',neg:'−',v5:'5V',gnd:'GND',sda:'SDA D20',scl:'SCL D21',vcc:'VCC',vplus:'V+ (미사용)',inpos:'IN+',inneg:'IN−',outpos:'OUT+',outneg:'OUT−',signal:'SIG'};
function pinLabel(pin){return pin.startsWith('ch')?'PWM '+pin.slice(2):pretty[pin]||pin}
function portRight(n,p){if(n.id==='battery'||n.id==='mega')return true;
 if(n.id.startsWith('bec'))return p.startsWith('out');
 if(n.id==='pca')return p.startsWith('ch');
 return false;
}
export function buildSchematic(svg,wires,picked,onPort,onRemove){
 svg.replaceChildren();let pmap=new Map();
 const wireLayer=document.createElementNS(NS,'g');svg.append(wireLayer);
 const portLayer=document.createElementNS(NS,'g');
 for(const n of nodes){
  const maxY=n.id==='pca'?840:n.id.startsWith('servo')?74:n.id.startsWith('bec')?126: n.id==='mega'?140:100;
  let rect=document.createElementNS(NS,'rect');rect.setAttribute('x',n.x);rect.setAttribute('y',n.y);rect.setAttribute('width',n.w);rect.setAttribute('height',maxY);rect.setAttribute('rx',12);rect.setAttribute('class','node');svg.append(rect);
  let tx=document.createElementNS(NS,'text');tx.setAttribute('x',n.x+14);tx.setAttribute('y',n.y+22);tx.setAttribute('class','node-title');tx.textContent=n.label;svg.append(tx);
  let sub=document.createElementNS(NS,'text');sub.setAttribute('x',n.x+14);sub.setAttribute('y',n.y+37);sub.setAttribute('class','node-sub');sub.textContent=n.sub;svg.append(sub);
  n.pins.forEach((p,i)=>{
   const right=portRight(n,p),port=`${n.id}.${p}`;
   const y=n.y+(n.id==='pca'?62+i*42:n.id.startsWith('bec')?64+i*19:n.id.startsWith('servo')?51+i*8: n.id==='mega'?66+i*19:65+i*19);
   const x=n.x+(right?n.w:0);pmap.set(port,{x,y,right});
   const group=document.createElementNS(NS,'g');const c=document.createElementNS(NS,'circle');c.setAttribute('cx',x);c.setAttribute('cy',y);c.setAttribute('r',6);c.setAttribute('class','port'+(picked===port?' pick':''));c.setAttribute('fill',p.endsWith('pos')||p==='pos'||p==='v5'||p==='vcc'||p==='vplus'?'#e7b579':p.endsWith('neg')||p==='neg'||p==='gnd'?'#879cad':'#69d8d8');group.append(c);
   const text=document.createElementNS(NS,'text');text.setAttribute('x',x+(right?-13:13));text.setAttribute('y',y+4);text.setAttribute('text-anchor',right?'end':'start');text.setAttribute('class','port-label');text.textContent=pinLabel(p);group.append(text);group.style.cursor='crosshair';group.addEventListener('click',e=>{e.stopPropagation();onPort(port)});portLayer.append(group);
  });
 }
 for(const wire of wires){const a=pmap.get(wire.a),b=pmap.get(wire.b);if(!a||!b)continue;
  const path=document.createElementNS(NS,'path');let dx=Math.max(45,Math.abs(b.x-a.x)*.4);
  path.setAttribute('d',`M${a.x},${a.y} C${a.x+(a.right?dx:-dx)},${a.y} ${b.x+(b.right?dx:-dx)},${b.y} ${b.x},${b.y}`);
  path.setAttribute('class','wire');path.setAttribute('stroke',wire.a.endsWith('pos')||wire.a.endsWith('v5')?'#e7b579':wire.a.endsWith('neg')||wire.a.endsWith('gnd')?'#a5a8bd':'#50c7ce');
  const title=document.createElementNS(NS,'title');title.textContent=`${wire.a} → ${wire.b} | 클릭하여 삭제`;path.append(title);
  path.addEventListener('click',e=>{e.stopPropagation();onRemove(wire.id)});
  wireLayer.append(path);
 }
 svg.append(portLayer);
}
export function portExists(id){return nodes.some(n=>n.pins.some(p=>`${n.id}.${p}`===id));}
