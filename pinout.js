// Original vector drawings use the public pin assignments in Arduino's
// A000067 pinout and Adafruit's PCA9685 pinout. See PINOUT_SOURCES.md.
const pin=(id,label,x,y,kind='signal',net=id,side='up')=>({id,label,x,y,kind,net,side});
const mega=[];
const top1=[['scl_r3','SCL','scl'],['sda_r3','SDA','sda'],['aref','AREF'],['gnd_top','GND','gnd'],...Array.from({length:6},(_,i)=>['d'+(13-i),String(13-i)])];
top1.forEach(([id,label,net],i)=>mega.push(pin('mega.'+id,label,140+i*17,24,id.startsWith('gnd')?'ground':'signal','mega.'+(net||id))));
for(let i=0;i<8;i++)mega.push(pin('mega.d'+(7-i),String(7-i),330+i*17,24));
for(let i=14;i<=21;i++)mega.push(pin('mega.'+(i===20?'sda':i===21?'scl':'d'+i),String(i),490+(i-14)*17,24));
const powers=[['nc','NC'],['ioref','IOREF'],['reset','RESET'],['v33','3.3V'],['v5','5V'],['gnd','GND'],['gnd2','GND'],['vin','VIN']];
powers.forEach(([id,label],i)=>mega.push(pin('mega.'+id,label,140+i*17,356,id.startsWith('gnd')?'ground':['v33','v5','vin','ioref'].includes(id)?'power':'signal','mega.'+(id==='gnd2'?'gnd':id==='ioref'?'v5':id),'down')));
for(let i=0;i<16;i++)mega.push(pin('mega.a'+i,'A'+i,(i<8?330:490)+(i%8)*17,356,'analog','mega.a'+i,'down'));
for(let row=0;row<18;row++)for(let col=0;col<2;col++){
 const n=22+(row-1)*2+col;
 const id=row===0?'v5_right'+col:row===17?'gnd_right'+col:'d'+n;
 const label=row===0?'5V':row===17?'GND':String(n);
 mega.push(pin('mega.'+id,label,653+col*22,35+row*18,row===0?'power':row===17?'ground':'signal','mega.'+(row===0?'v5':row===17?'gnd':id),col?'right':'left'));
}
const pca=[];
// Board orientation: terminal block at the top; signal row nearest the IC.
const control=[['gnd','GND','ground'],['oe','OE','signal'],['scl','SCL','signal'],['sda','SDA','signal'],['vcc','VCC','power'],['vplus','V+','power']];
for(let col=0;col<2;col++)control.forEach(([id,label,kind],i)=>pca.push(pin('pca.'+id+(col?'_right':''),label,col?693:27,55+i*26,kind,'pca.'+id,col?'right':'left')));
pca.push(pin('pca.terminal_neg','GND',322,27,'ground','pca.gnd'));
pca.push(pin('pca.terminal_pos','V+',368,27,'power','pca.vplus'));
for(let ch=0;ch<16;ch++)for(let row=0;row<3;row++){
 const suffix=['','_vplus','_gnd'][row],net=row===0?'pca.ch'+ch:row===1?'pca.vplus':'pca.gnd';
 pca.push(pin('pca.ch'+ch+suffix,row===0?'PWM '+ch:row===1?'V+':'GND',99+ch*34,220+row*23,['signal','power','ground'][row],net,'down'));
}
export const MEGA_PINS=mega;
export const PCA_PINS=pca;
export const CIRCUIT_NODES=[
 {id:'mega',type:'mega',label:'Arduino Mega 2560 Rev3',x:65,y:350,w:720,h:380,pins:mega},
 {id:'pca',type:'pca',label:'PCA9685 · 16 CHANNEL',x:920,y:360,w:720,h:300,pins:pca},
 {id:'battery',type:'battery',label:'2S LiPo · 3300 mAh',x:65,y:80,w:295,h:165,pins:[pin('battery.pos','BAT +',295,45,'power',undefined,'right'),pin('battery.neg','BAT −',295,115,'ground',undefined,'right')]},
 ...Array.from({length:4},(_,i)=>({id:'bec'+i,type:'bec',label:'BEC '+(i+1),x:490+i*285,y:80,w:220,h:155,pins:[pin('bec'+i+'.inpos','IN +',0,55,'power',undefined,'left'),pin('bec'+i+'.inneg','IN −',0,110,'ground',undefined,'left'),pin('bec'+i+'.outpos','OUT +',220,55,'power',undefined,'right'),pin('bec'+i+'.outneg','OUT −',220,110,'ground',undefined,'right')]})),
 ...Array.from({length:12},(_,i)=>({id:'servo'+i,type:'servo',label:['FL','FR','RL','RR'][Math.floor(i/3)]+' · '+['HIP ROLL','HIP PITCH','KNEE'][i%3]+' · CH '+i,x:470+Math.floor(i/3)*305,y:795+(i%3)*145,w:235,h:112,pins:[pin('servo'+i+'.neg','GND',30,92,'ground',undefined,'down'),pin('servo'+i+'.pos','V+',65,92,'power',undefined,'down'),pin('servo'+i+'.signal','SIG',100,92,'signal',undefined,'down')]}))
];
export const PORTS=CIRCUIT_NODES.flatMap(node=>node.pins.map(p=>({...p,nodeId:node.id,nodeLabel:node.label,net:p.net||p.id})));
export const PORT_MAP=new Map(PORTS.map(p=>[p.id,p]));
// Accepted logical names for JSON imports; physical duplicate sockets retain
// their own IDs so wires still attach to the socket the user clicked.
export const PORT_ALIASES=new Map([['mega.d20','mega.sda'],['mega.d21','mega.scl'],...Array.from({length:16},(_,i)=>['mega.d'+(54+i),'mega.a'+i])]);
export const ALL_PIN_IDS=[...PORT_MAP.keys(),...PORT_ALIASES.keys()];
export const INTERNAL_LINKS=[...PORTS.filter(p=>p.id!==p.net).map(p=>[p.id,p.net]),...PORT_ALIASES];
export function canonicalPort(id){return PORT_MAP.get(id)?.net||PORT_ALIASES.get(id)||id;}
export function portExists(id){return PORT_MAP.has(id)||PORT_ALIASES.has(id);}
export function describePort(id){
 const p=PORT_MAP.get(id)||PORT_MAP.get(PORT_ALIASES.get(id));
 if(!p)return String(id);
 const special={'mega.sda':'D20 / SDA','mega.scl':'D21 / SCL'};
 return p.nodeLabel+' · '+(special[p.net]||p.label)+(p.id!==p.net?' (내부 공통 연결)':'');
}
