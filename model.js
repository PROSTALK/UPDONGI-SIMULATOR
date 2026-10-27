export const LEG_NAMES=['앞왼쪽 (FL)','앞오른쪽 (FR)','뒤왼쪽 (RL)','뒤오른쪽 (RR)'];
export const TYPES={servo:'서보모터',controller:'제어보드',power:'전원장치',other:'기타'};
export const PART_LIBRARY=[
 {id:'mega2560',name:'Arduino Mega 2560 Rev3',brand:'Arduino',type:'controller',verified:'공식 치수·기본 전기 사양',dim:[101.52,15,53.3],mass:37,source:'https://store.arduino.cc/products/arduino-mega-2560-rev3',notes:'ATmega2560, 5V 논리, I²C SDA 20 / SCL 21. 높이 15 mm는 시각화용 근사값. 실재 CAD 형상 아님.'},
 {id:'pca9685',name:'PCA9685 16채널 PWM 드라이버 (예시 보드)',brand:'PCA9685 계열',type:'controller',verified:'기능 확인 / 외형 미확인',dim:[62,14,26],mass:20,source:'https://learn.adafruit.com/16-channel-pwm-servo-driver/pinouts',notes:'I²C VCC 3~5V, GND, SDA, SCL. V+는 서보 공급 전원. 외형·질량은 예시값이며 판매 보드마다 다름.'},
 {id:'droyuke30',name:'DROYUKE 30kg 270° 서보 (사용자 모델)',brand:'DROYUKE',type:'servo',verified:'사용자 제공 전압·제품 명칭 / 기타 미확인',dim:[40,40,20],mass:70,spec:{voltage:6,stallTorque:30,stallCurrent:3.5,idleCurrent:.12},source:'',notes:'동작 전압 4.8~7.4V(사용자 제공). 30kg·270°는 모델 식별 문자열이며 실측 스톨 토크/전류 확정 아님. 외형·질량은 자리표시용 가정.'},
 {id:'lipo2s',name:'2S LiPo 배터리 3300mAh (범용)',brand:'사용자 설정',type:'power',verified:'공칭 전압 / 제품 미지정',dim:[140,32,45],mass:220,source:'',notes:'공칭 7.4V, 충전 완료 8.4V. 정확한 크기/질량/내부저항/방전 정격은 제품별로 상이함.'},
 {id:'becuser',name:'6V BEC / DC-DC (임시 10A)',brand:'사용자 정의',type:'power',verified:'가정값 / 실물 제품 아님',dim:[42,18,28],mass:35,spec:{voltage:6,limit:10,efficiency:.88},source:'',notes:'10A는 계산 시나리오용 가정값. 실제 구매 전에 지속전류·피크전류·발열·입력범위·효율 확인 필수.'}
];
export function defaultState(){return {
 geometry:{bodyL:430,bodyW:270,bodyH:275,mass:3.5,upper:145,lower:165,comX:0,comZ:0},
 appearance:{body:'#344f63',links:'#8faec2',joints:'#5fd2dc',motors:'#58a8b4',stl:'#e5a66b'},
 gait:{stride:75,lift:48,period:2.8,duty:.75,speed:1},
 power:{batV:7.8,batCap:3300,batR:65,wireAWG:18,wireLen:450,contactR:25,servoRatedV:6,stallTorque:30,stallCurrent:3.5,idleCurrent:.12,becs:Array.from({length:4},()=>({voltage:6,limit:10,efficiency:.88}))},
 activeServoId:'droyuke30',
 calibration:{servoCenter:135,servoMin:95,servoMax:175,pulseMin:1000,pulseMax:2000},
 customParts:[],placedParts:[
   {uid:'P1',catalogId:'mega2560',x:0,y:350,z:-70,ry:0},
   {uid:'P2',catalogId:'pca9685',x:0,y:350,z:65,ry:0},
   {uid:'P3',catalogId:'lipo2s',x:-110,y:353,z:0,ry:0},
   ...Array.from({length:4},(_,i)=>({uid:'B'+i,catalogId:'becuser',x:95,y:347,z:-100+i*65,ry:0}))
 ],
 wires:defaultWires(),
 nextId:5
};}
export function catalog(state){return [...PART_LIBRARY,...state.customParts]}
export function defaultWires(){let edges=[],n=0; const add=(a,b)=>edges.push({id:'W'+(n++),a,b});
 for(let i=0;i<4;i++){
   add('battery.pos',`bec${i}.inpos`);add('battery.neg',`bec${i}.inneg`);
   add(`bec${i}.outneg`,'pca.gnd');
   for(let j=0;j<3;j++){
     const s=i*3+j; add(`bec${i}.outpos`,`servo${s}.pos`);add(`bec${i}.outneg`,`servo${s}.neg`);
   }
 }
 add('mega.v5','pca.vcc');add('mega.gnd','pca.gnd');add('mega.sda','pca.sda');add('mega.scl','pca.scl');
 for(let s=0;s<12;s++)add(`pca.ch${s}`,`servo${s}.signal`);
 return edges;
}
// Shared limits keep typed input and imported projects in the same domain.
export const LIMITS={
 geometry:{bodyL:[100,1500],bodyW:[70,1000],bodyH:[120,650],mass:[.1,100],upper:[50,700],lower:[50,700],comX:[-160,160],comZ:[-110,110]},
 gait:{stride:[0,200],lift:[0,120],period:[.5,10],duty:[.5,.95],speed:[.25,2]},
 power:{batV:[5,8.4],batCap:[100,50000],batR:[0,500],wireLen:[10,10000],contactR:[0,1000],servoRatedV:[.1,100],stallTorque:[.1,150],stallCurrent:[.01,200],idleCurrent:[0,10]},
 calibration:{servoCenter:[0,270],servoMin:[0,269],servoMax:[1,270],pulseMin:[400,1500],pulseMax:[1500,3000]},
 bec:{voltage:[.1,100],limit:[.1,200],efficiency:[.1,1]}
};
export function boundedNumber(value,range,fallback){
 if(value===''||value===null)return fallback;
 const n=Number(value);return Number.isFinite(n)?Math.min(range[1],Math.max(range[0],n)):fallback;
}
function normalizedGroup(source,defaults,ranges){
 const result={...defaults};
 for(const [key,range] of Object.entries(ranges)){
  if(source?.[key]===undefined)continue;
  if(typeof source[key]!=='number'||!Number.isFinite(source[key]))throw Error(key+' 값이 유효한 숫자가 아닙니다');
  result[key]=boundedNumber(source[key],range,defaults[key]);
 }
 return result;
}
const validColor=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
export function validateProject(p){
 if(!p||typeof p!=='object'||!p.geometry||!p.power||!Array.isArray(p.wires)||!Array.isArray(p.placedParts))throw Error('지원하지 않는 프로젝트 형식');
 const out=defaultState();
 for(const key of ['geometry','gait','power','calibration'])out[key]=normalizedGroup(p[key],out[key],LIMITS[key]);
 for(const key of Object.keys(out.appearance))if(validColor(p.appearance?.[key]))out.appearance[key]=p.appearance[key];
 if(!Array.isArray(p.power.becs)||p.power.becs.length!==4)throw Error('BEC가 4개여야 합니다');
 out.power.becs=p.power.becs.map((x,i)=>normalizedGroup(x,out.power.becs[i],LIMITS.bec));
 out.power.wireAWG=[16,18,20,22,24,26].includes(p.power.wireAWG)?p.power.wireAWG:18;
 const c=out.calibration;
 if(c.servoMin>=c.servoMax||c.pulseMin>=c.pulseMax)throw Error('최소각/최소 펄스는 최대값보다 작아야 합니다');
 const ids=new Set(PART_LIBRARY.map(part=>part.id));
 out.customParts=(Array.isArray(p.customParts)?p.customParts:[]).slice(0,200).map(part=>{
  if(!part||typeof part.id!=='string'||ids.has(part.id)||typeof part.name!=='string'||!Array.isArray(part.dim)||part.dim.length!==3||!part.dim.every(n=>Number.isFinite(n)&&n>0&&n<=5000))throw Error('사용자 부품의 ID 또는 치수가 잘못되었습니다');
  ids.add(part.id);
  return {...part,name:part.name.slice(0,120),type:Object.hasOwn(TYPES,part.type)?part.type:'other',mass:boundedNumber(part.mass,[0,100000],0),source:typeof part.source==='string'&&/^https:\/\//i.test(part.source)?part.source:''};
 });
 const uids=new Set();
 out.placedParts=p.placedParts.slice(0,300).map(part=>{
  if(!part||typeof part.uid!=='string'||!part.uid||uids.has(part.uid)||!ids.has(part.catalogId))throw Error('배치 부품의 ID가 중복되었거나 부품 정의가 없습니다');
  uids.add(part.uid);
  const position=normalizedGroup(part,{x:0,y:0,z:0,ry:0},{x:[-3000,3000],y:[-3000,3000],z:[-3000,3000],ry:[-360,360]});
  return {uid:part.uid,catalogId:part.catalogId,...position,...(validColor(part.color)?{color:part.color}:{})};
 });
 out.wires=p.wires.filter(w=>w&&typeof w.a==='string'&&typeof w.b==='string').slice(0,500).map((w,i)=>({id:'W'+i,a:w.a,b:w.b}));
 out.activeServoId=ids.has(p.activeServoId)?p.activeServoId:'droyuke30';
 out.nextId=Math.max(Number.isSafeInteger(p.nextId)&&p.nextId>0&&p.nextId<1e9?p.nextId:1,...out.placedParts.map(part=>/^P[0-9]{1,9}$/.test(part.uid)?Number(part.uid.slice(1))+1:1));
 return out;
}
