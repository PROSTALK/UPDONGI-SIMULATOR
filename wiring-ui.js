import {CIRCUIT_NODES,PORTS,PORT_MAP,PORT_ALIASES,canonicalPort,describePort,portExists} from './pinout.js';
export {portExists} from './pinout.js';
const NS='http://www.w3.org/2000/svg';
const editors=new WeakMap();
const C={power:'#efad65',ground:'#a7b9d0',signal:'#65d9dd',analog:'#ccb4f8'};
function el(tag,attrs={},text){const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;}
function rect(parent,x,y,w,h,fill,rx=0,stroke='none'){const n=el('rect',{x,y,width:w,height:h,fill,rx,stroke,'stroke-width':1.5});parent.append(n);return n;}
function label(parent,x,y,text,size=13,fill='#e3eff0',attrs={}){const n=el('text',{x,y,'font-size':size,fill,'font-family':'ui-monospace, monospace',...attrs},text);parent.append(n);return n;}
function hole(parent,x,y){parent.append(el('circle',{cx:x,cy:y,r:8,fill:'#0b2228',stroke:'#bba879','stroke-width':4}));}
function chip(parent,x,y,w,h,title){
 for(let i=0;i<10;i++){rect(parent,x-7,y+5+i*(h-10)/10,8,3,'#a2acaf');rect(parent,x+w-1,y+5+i*(h-10)/10,8,3,'#a2acaf');}
 rect(parent,x,y,w,h,'#17252c',3,'#3d5055');label(parent,x+w/2,y+h/2+4,title,10,'#adbdbe',{'text-anchor':'middle'});
}
function drawMega(g){
 g.append(el('path',{d:'M10 0 H701 L720 19 V360 L700 380 H10 Q0 380 0 370 V10 Q0 0 10 0Z',fill:'#087f88',stroke:'#36b0b2','stroke-width':2}));
 for(const [x,y] of [[90,18],[90,362],[699,18],[699,362]])hole(g,x,y);
 // Copper traces and silkscreen are original artwork, not a manufacturer CAD model.
 for(let i=0;i<10;i++)g.append(el('path',{d:`M${327+i*6} 160 V${115-i*4} H${141+i*17} V42`,fill:'none',stroke:'#299b9e','stroke-width':1,opacity:.45}));
 rect(g,-13,70,85,100,'#b9c4c8',5,'#e0e6e6');rect(g,-15,85,17,70,'#344654',2);rect(g,5,93,40,52,'#6a7b83',2);label(g,8,190,'USB-B',12);
 rect(g,-4,263,83,66,'#202a32',5,'#536975');rect(g,-8,277,24,38,'#0e1922',2);label(g,6,347,'DC IN',11);
 rect(g,90,45,34,27,'#a9b7bc',3);rect(g,99,49,15,18,'#bc5554',3);label(g,89,87,'RESET',9);
 chip(g,334,147,104,104,'ATMEGA2560');chip(g,140,118,55,55,'16U2');
 rect(g,217,147,45,16,'#b1b7ae',8);label(g,221,141,'16 MHz',9);
 for(let i=0;i<5;i++){rect(g,117+i*29,215,18,9,i===0?'#78cc6b':'#9caeaa',2);label(g,117+i*29,237,['ON','RX','TX','L','R'][i],8);}
 label(g,306,280,'MEGA 2560',29,'#e0ffff',{'font-weight':'700','letter-spacing':2});label(g,306,295,'REV3 · 5V LOGIC',12,'#a0d5d5');
 label(g,140,103,'DIGITAL 13…8',10,'#b4e5e4');label(g,330,103,'7…0',10,'#b4e5e4');label(g,490,103,'14…21 / UART · I²C',10,'#b4e5e4');
 label(g,140,315,'POWER',11,'#b4e5e4');label(g,330,315,'ANALOG A0…A7',11,'#b4e5e4');label(g,490,315,'A8…A15',11,'#b4e5e4');
 label(g,630,193,'DIGITAL',9,'#b4e5e4',{'transform':'rotate(-90 630 193)'});
}
function drawPCA(g){
 rect(g,0,0,720,300,'#165c91',10,'#5497c0');for(const [x,y] of [[12,12],[708,12],[12,287],[708,287]])hole(g,x,y);
 rect(g,294,4,101,50,'#2d945d',4,'#a2c893');for(const x of [322,368])g.append(el('circle',{cx:x,cy:23,r:11,fill:'#c5c7ba',stroke:'#516a61','stroke-width':2}));
 chip(g,308,107,108,48,'PCA9685');
 g.append(el('circle',{cx:470,cy:82,r:29,fill:'#31414c',stroke:'#b7c4cd','stroke-width':3}));label(g,449,87,'1000µF',9,'#d4dde2');
 label(g,115,71,'16-CHANNEL PWM / SERVO',23,'#e4f4ff',{'font-weight':700});label(g,112,99,'I²C 0x40 · VCC ≠ V+',13,'#add8f3');
 for(let i=0;i<6;i++){rect(g,110+i*27,144,13,8,'#c7ced3',1);label(g,111+i*27,140,'A'+i,8,'#e3f3fc');}
 label(g,92,184,'PWM',11,'#88eff1');label(g,92,202,'V+ = servo rail · GND = common',10,'#a7d0ed');
}
function drawGeneric(g,node){
 if(node.type==='battery'){
  rect(g,0,0,node.w,node.h,'#263b49',13,'#81919e');rect(g,15,10,node.w-30,12,'#859da9',3);rect(g,15,node.h-22,node.w-30,12,'#859da9',3);
  label(g,30,62,'LiPo 2S',32,'#e8f1f5',{'font-weight':700});label(g,30,91,'7.4V NOMINAL',16,'#f1bb7d');label(g,30,118,'3300mAh · max 8.4V',12,'#b2c4d1');
 }else if(node.type==='bec'){
  rect(g,0,0,node.w,node.h,'#28504f',9,'#6fa49c');chip(g,65,50,61,39,'DC / DC');
  rect(g,150,54,37,37,'#a9ae8e',6);label(g,66,28,node.label,16,'#e2f4e8',{'font-weight':700});label(g,54,132,'6V · independent rail',10,'#beddd2');
 }else{
  rect(g,0,8,120,70,'#263b43',6,'#738e9c');rect(g,14,0,94,12,'#334f5e',3);rect(g,115,22,28,18,'#93a3a7',3);
  g.append(el('circle',{cx:60,cy:34,r:16,fill:'#263741',stroke:'#c2c6b4','stroke-width':4}));rect(g,44,29,62,10,'#c5c9ba',4);
  label(g,148,34,'SERVO',16,'#b8cfd9');label(g,148,55,'3-PIN',11,'#83a3b4');
 }
}
function pinLabel(g,p){
 if(p.id.startsWith('mega.')){
  if(p.side==='up')label(g,p.x,p.y+23,p.label,10,'#e3f4f2',{'text-anchor':'end',transform:`rotate(-58 ${p.x} ${p.y+23})`});
  else if(p.side==='down')label(g,p.x,p.y-16,p.label,9,'#e3f4f2',{'text-anchor':'start',transform:`rotate(-58 ${p.x} ${p.y-16})`});
  else label(g,p.x+(p.side==='left'?-11:12),p.y+3,p.label,8,'#e3f4f2',{'text-anchor':p.side==='left'?'end':'start'});
 }else if(p.id.startsWith('pca.ch')){
  if(p.kind==='signal')label(g,p.x,p.y-9,p.label.replace('PWM ',''),10,'#e3f4ff',{'text-anchor':'middle'});
 }else label(g,p.x+(p.side==='left'?13:p.side==='right'?-13:0),p.y+(p.side==='down'?-13:4),p.label,11,'#e8f3f8',{'text-anchor':p.side==='left'?'start':p.side==='right'?'end':'middle'});
}
function pathFor(a,b){
 const direction=p=>({up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]})[p.side]||[1,0];
 const [ax,ay]=direction(a),[bx,by]=direction(b);const d=Math.max(45,Math.min(180,Math.hypot(a.x-b.x,a.y-b.y)*.3));
 return `M${a.x},${a.y} C${a.x+ax*d},${a.y+ay*d} ${b.x+bx*d},${b.y+by*d} ${b.x},${b.y}`;
}
class CircuitEditor{
 constructor(svg){
  this.svg=svg;this.zoom=.6;this.cx=850;this.cy=585;this.wires=[];this.locations={};this.points=new Map();
  svg.setAttribute('preserveAspectRatio','xMidYMid meet');svg.setAttribute('aria-label','실제 핀 배열을 참고한 Mega 2560 / PCA9685 배선 작업대');
  svg.addEventListener('wheel',e=>{e.preventDefault();this.setZoom(this.zoom*(e.deltaY<0?1.12:1/1.12),e.clientX,e.clientY);},{passive:false});
  svg.addEventListener('pointerdown',e=>this.pointerDown(e));
  svg.addEventListener('pointermove',e=>this.pointerMove(e));
  for(const type of ['pointerup','pointercancel'])svg.addEventListener(type,e=>this.pointerUp(e));
  svg.addEventListener('click',e=>{
   if(this.ignoreClick){this.ignoreClick=false;return;}
   const port=e.target.closest('[data-port]');if(port){this.options.onPort(port.dataset.port);return;}
   const wire=e.target.closest('[data-wire]');if(wire)this.options.onRemove(wire.dataset.wire);
  });
  svg.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const port=e.target.closest('[data-port]');if(port){e.preventDefault();this.options.onPort(port.dataset.port);}});
  svg.addEventListener('pointerover',e=>{const p=e.target.closest('[data-port]');if(p)this.options.onHover?.(describePort(p.dataset.port));});
  svg.addEventListener('pointerleave',()=>{if(this.preview)this.preview.setAttribute('visibility','hidden');this.options.onHover?.('');});
  this.resizeObserver=new ResizeObserver(()=>this.syncView());this.resizeObserver.observe(svg.parentElement);
 }
 dimensions(){const r=this.svg.getBoundingClientRect();return {w:r.width||1000,h:r.height||600};}
 syncView(){const {w,h}=this.dimensions();this.box={x:this.cx-w/this.zoom/2,y:this.cy-h/this.zoom/2,w:w/this.zoom,h:h/this.zoom};this.svg.setAttribute('viewBox',`${this.box.x} ${this.box.y} ${this.box.w} ${this.box.h}`);this.options?.onZoom?.(Math.round(this.zoom*100));}
 point(e){const r=this.svg.getBoundingClientRect(),{w,h}=this.dimensions();return {x:this.box.x+(e.clientX-r.left)*this.box.w/w,y:this.box.y+(e.clientY-r.top)*this.box.h/h};}
 setZoom(zoom,clientX,clientY){
  const before=clientX===undefined?null:this.point({clientX,clientY});this.zoom=Math.min(2.5,Math.max(.22,zoom));this.syncView();
  if(before){const after=this.point({clientX,clientY});this.cx+=before.x-after.x;this.cy+=before.y-after.y;this.syncView();}
 }
 fit(){
  const nodes=CIRCUIT_NODES.map(n=>({...n,...this.locations[n.id]}));const x=Math.min(...nodes.map(n=>n.x))-65,y=Math.min(...nodes.map(n=>n.y))-60;
  const width=Math.max(...nodes.map(n=>n.x+n.w))-x+65,height=Math.max(...nodes.map(n=>n.y+n.h))-y+65;
  const {w,h}=this.dimensions();this.cx=x+width/2;this.cy=y+height/2;this.zoom=Math.min(w/width,h/height);this.syncView();
 }
 focus(id){const n=CIRCUIT_NODES.find(n=>n.id===id);if(!n)return;const pos=this.locations[id]||n;const {w,h}=this.dimensions();this.cx=pos.x+n.w/2;this.cy=pos.y+n.h/2;this.zoom=Math.min(w/(n.w+140),h/(n.h+140),1.7);this.syncView();}
 pointerDown(e){
  if(e.button!==0||e.target.closest('[data-port]')||e.target.closest('[data-wire]'))return;
  const node=e.target.closest('[data-node]');const id=node?.dataset.node;const pos=id?this.locations[id]:null;
  this.drag={id,start:this.point(e),clientX:e.clientX,clientY:e.clientY,x:pos?.x,y:pos?.y,cx:this.cx,cy:this.cy,moved:false};
  this.svg.setPointerCapture?.(e.pointerId);e.preventDefault();
 }
 pointerMove(e){
  const point=this.point(e);
  if(this.drag){const d=this.drag;d.moved||=Math.hypot(e.clientX-d.clientX,e.clientY-d.clientY)>4;
   if(!d.moved)return;
   if(d.id){this.locations[d.id]={x:Math.max(-1500,Math.min(4000,d.x+point.x-d.start.x)),y:Math.max(-1000,Math.min(4000,d.y+point.y-d.start.y))};this.moveNode(d.id);}
   else{this.cx=d.cx-(e.clientX-d.clientX)/this.zoom;this.cy=d.cy-(e.clientY-d.clientY)/this.zoom;this.syncView();}
  }else if(this.options.picked&&this.preview){const a=this.points.get(this.options.picked)||this.points.get(PORT_ALIASES.get(this.options.picked));if(a){this.preview.setAttribute('d',pathFor(a,{...point,side:'left'}));this.preview.setAttribute('visibility','visible');}}
 }
 pointerUp(e){if(!this.drag)return;const d=this.drag;this.drag=null;this.ignoreClick=d.moved&&e.type!=='pointercancel';clearTimeout(this.clickTimer);this.clickTimer=setTimeout(()=>{this.ignoreClick=false;},0);if(d.id&&d.moved)this.options.onMove?.(d.id,{...this.locations[d.id]});if(this.svg.hasPointerCapture?.(e.pointerId))this.svg.releasePointerCapture(e.pointerId);}
 moveNode(id){const p=this.locations[id];this.nodeGroups.get(id)?.setAttribute('transform',`translate(${p.x} ${p.y})`);for(const pin of PORTS.filter(p=>p.nodeId===id))this.points.set(pin.id,{...pin,x:p.x+pin.x,y:p.y+pin.y});this.updatePaths();}
 updatePaths(){for(const {wire,path,hit} of this.paths){const a=this.points.get(wire.a)||this.points.get(PORT_ALIASES.get(wire.a)),b=this.points.get(wire.b)||this.points.get(PORT_ALIASES.get(wire.b));if(a&&b){const d=pathFor(a,b);path.setAttribute('d',d);hit.setAttribute('d',d);}}}
 draw(wires,picked,options){
  this.options={...options,picked};this.wires=wires;this.locations={};this.nodeGroups=new Map();this.points.clear();this.paths=[];this.svg.replaceChildren();
  const defs=el('defs');const pattern=el('pattern',{id:'bench-grid',width:24,height:24,patternUnits:'userSpaceOnUse'});pattern.append(el('circle',{cx:1,cy:1,r:1,fill:'#31505e'}));defs.append(pattern);this.svg.append(defs);
  this.svg.append(el('rect',{x:-10000,y:-10000,width:20000,height:20000,fill:'#0b1722'}),el('rect',{x:-10000,y:-10000,width:20000,height:20000,fill:'url(#bench-grid)'}));
  const boards=el('g'),wireLayer=el('g'),ports=el('g');this.svg.append(boards,wireLayer,ports);
  for(const node of CIRCUIT_NODES){
   const pos=options.layout?.[node.id]||node;this.locations[node.id]={x:pos.x,y:pos.y};
   const g=el('g',{'data-node':node.id,transform:`translate(${pos.x} ${pos.y})`,class:'circuit-component'});this.nodeGroups.set(node.id,g);boards.append(g);
   label(g,0,-17,node.label,14,'#bdcfdc',{'font-weight':700});if(node.type==='mega')drawMega(g);else if(node.type==='pca')drawPCA(g);else drawGeneric(g,node);
   const handles=el('g',{'data-node':node.id,transform:`translate(${pos.x} ${pos.y})`});ports.append(handles);
   for(const p of node.pins){
    this.points.set(p.id,{...p,x:pos.x+p.x,y:pos.y+p.y});const same=picked&&canonicalPort(p.id)===canonicalPort(picked);
    const group=el('g',{'data-port':p.id,class:'physical-pin'+(same?' selected':''),tabindex:0,role:'button','aria-label':describePort(p.id)});
    group.append(el('title',{},describePort(p.id)+' · 클릭하여 연결'));
    rect(group,p.x-8,p.y-8,16,16,'#12232c',2,'#6b7f87');
    group.append(el('circle',{cx:p.x,cy:p.y,r:4,fill:C[p.kind]||C.signal,stroke:'#07131b','stroke-width':1}),el('circle',{cx:p.x,cy:p.y,r:10,fill:'transparent',class:'pin-hit'}));
    handles.append(group);pinLabel(handles,p);
   }
  }
  for(const wire of wires){
   const a=PORT_MAP.get(wire.a)||PORT_MAP.get(PORT_ALIASES.get(wire.a));
   const selected=picked&&(canonicalPort(wire.a)===canonicalPort(picked)||canonicalPort(wire.b)===canonicalPort(picked));
   const group=el('g',{'data-wire':wire.id,class:'wire-group'+(picked&&!selected?' muted':'')+(selected?' active':'')});
   const hit=el('path',{fill:'none',stroke:'transparent','stroke-width':15,'pointer-events':'stroke'});
   const path=el('path',{class:'physical-wire',fill:'none',stroke:C[a?.kind]||C.signal,'stroke-width':selected?4:2.6,'stroke-linecap':'round','pointer-events':'none'});
   group.append(el('title',{},describePort(wire.a)+' → '+describePort(wire.b)+' · 클릭하여 삭제'),hit,path);wireLayer.append(group);this.paths.push({wire,path,hit});
  }
  this.preview=el('path',{fill:'none',stroke:'#f3dca3','stroke-width':3,'stroke-dasharray':'8 5','pointer-events':'none',visibility:'hidden'});wireLayer.append(this.preview);this.updatePaths();this.syncView();
 }
}
export function buildSchematic(svg,wires,picked,onPort,onRemove,options={}){
 let editor=editors.get(svg);if(!editor){editor=new CircuitEditor(svg);editors.set(svg,editor);}
 editor.draw(wires,picked,{...options,onPort,onRemove});return editor;
}
