import {ALL_PIN_IDS,INTERNAL_LINKS,canonicalPort} from './pinout.js';
export const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const RAD=180/Math.PI;const TORQUE_UNIT=98.0665; // 1 kgf cm = 98.0665 N mm
export function calculateLegs(state,t){
 const {bodyL,bodyW,bodyH,upper,lower}=state.geometry;
 const {stride,lift,period,duty}=state.gait;
 const spanX=bodyL/2-8,spanZ=bodyW/2+5;
 // diagonal relative phase offsets avoid two feet swinging at the same instant
 const offsets=[0,.5,.75,.25];
 const legs=[];
 for(let i=0;i<4;i++){
   const front=i<2?1:-1,side=i%2===0?1:-1;
   const hip={x:front*spanX,y:bodyH,z:side*spanZ};
   const p=(((t/period+offsets[i])%1)+1)%1;
   let progress,dy=0,stance=p<duty;
   if(stance){progress=0.5-p/duty;}else{
     const u=(p-duty)/(1-duty); const smooth=u*u*(3-2*u);
     progress=-.5+smooth;dy=lift*Math.sin(Math.PI*u);
   }
   const foot={x:front*(spanX+29)+stride*progress,y:Math.max(0,dy),z:side*(spanZ+88)};
   const diffX=foot.x-hip.x,diffY=foot.y-hip.y,diffZ=foot.z-hip.z;
   const vertical=Math.hypot(diffY,diffZ),dist=Math.hypot(diffX,vertical);
   const lo=Math.abs(upper-lower)+1e-6,hi=upper+lower-1e-6;
   const feasible=dist<=hi+1e-6&&dist>=lo-1e-6;
   const d=clamp(dist,lo,hi);
   const k=(upper*upper+d*d-lower*lower)/(2*d);
   const h=Math.sqrt(Math.max(0,upper*upper-k*k));
   const ux=diffX/(dist||1),uv=vertical/(dist||1),bend=front;
   const kx=k*ux+bend*h*uv;
   const kv=k*uv-bend*h*ux;
   const vY=diffY/(vertical||1),vZ=diffZ/(vertical||1);
   const knee={x:hip.x+kx,y:hip.y+kv*vY,z:hip.z+kv*vZ};
   const roll=Math.atan2(diffZ,Math.max(1,hip.y-foot.y))*RAD;
   const pitch=Math.atan2(kx,kv)*RAD;
   const flex=Math.acos(clamp((upper*upper+lower*lower-d*d)/(2*upper*lower),-1,1))*RAD;
   const joints=[roll,pitch,180-flex]; // knee flex is zero when near straight
   legs.push({i,hip,knee,foot,stance,phase:p,feasible,distance:dist,joints});
 }
 return legs;
}
function cross(o,a,b){return (a.x-o.x)*(b.z-o.z)-(a.z-o.z)*(b.x-o.x)}
function hull(points){let a=[...points].sort((x,y)=>x.x-y.x||x.z-y.z);if(a.length<3)return a;
 const l=[],u=[];for(const p of a){while(l.length>=2&&cross(l[l.length-2],l[l.length-1],p)<=0)l.pop();l.push(p);}
 for(const p of a.reverse()){while(u.length>=2&&cross(u[u.length-2],u[u.length-1],p)<=0)u.pop();u.push(p);}
 l.pop();u.pop();return l.concat(u);
}
export function evaluateMechanics(state,legs){
 const supports=legs.filter(x=>x.stance&&x.foot.y<.05);
 const polygon=hull(supports.map(x=>x.foot));
 const COM={x:state.geometry.comX,z:state.geometry.comZ};
 let margin=-Infinity;
 if(polygon.length>=3){const signs=[];
  for(let i=0;i<polygon.length;i++){
   const a=polygon[i],b=polygon[(i+1)%polygon.length];
   const c=cross(a,b,COM),segment=Math.hypot(b.x-a.x,b.z-a.z);signs.push(c/Math.max(.00001,segment));
  }
  margin=Math.min(...signs);
 }
 const mass=state.geometry.mass;
 const force=supports.length>0?mass*9.80665/supports.length:0;
 const torques=[];
 for(const leg of legs){
  if(!leg.stance){torques.push([0,0,0]);continue}
  const s=force/TORQUE_UNIT;
  const hipPitch=Math.abs(leg.foot.x-leg.hip.x)*s;
  const knee=Math.abs(leg.foot.x-leg.knee.x)*s;
  const hipRoll=Math.abs(leg.foot.z-leg.hip.z)*s;
  torques.push([hipRoll,hipPitch,knee]);
 }
 return {supports:supports.length,polygon,margin,com:COM,torques,peakTorque:Math.max(0,...torques.flat()),force};
}
const perMeterOhm={16:.01317,18:.02095,20:.03329,22:.05296,24:.08422,26:.1339};
export function evaluatePower(state,mechanics){
 const p=state.power,servoI=[],servoV=[],branchI=[],branchV=[],branchLoss=[],warnings=[],torqueOver=[];
 const rFeed=(perMeterOhm[p.wireAWG]||.02095)*p.wireLen*.002+p.contactR/1000;
 // Servo pigtail: simplified 0.15m each way, separate from feeder
 const rPigtail=(perMeterOhm[p.wireAWG]||.02095)*.3;
 const inputPowers=[];
 // Branch loads do not depend on batteryV in this approximate model.
 // Calculate them once; only the battery voltage needs iteration.
  for(let b=0;b<4;b++){
   const bec=p.becs[b],vSet=bec.voltage||6;
   let sum=0; const I=[];
   for(let k=0;k<3;k++){
    const id=b*3+k;
    const torque=mechanics.torques[Math.floor(id/3)][id%3]||0;
    const ratio=torque/Math.max(1e-5,p.stallTorque);
    const current=(p.idleCurrent+(p.stallCurrent-p.idleCurrent)*clamp(ratio,0,1.5))*clamp(vSet/p.servoRatedV,.5,1.5);
    I.push(Math.max(0,current));sum+=Math.max(0,current);
    torqueOver.push({id,torque,ratio});
   }
   const limit=Math.max(.01,bec.limit),scale=sum>limit?limit/sum:1;
   const iTotal=sum*scale;
   // The droop law is a demonstration assumption, not an actual BEC's limiting behavior
   const vUnloaded=vSet*(sum>limit?scale:1);
   const vAtBus=Math.max(0,vUnloaded-iTotal*rFeed);
   const voltage=I.map(i=>Math.max(0,vAtBus-i*scale*rPigtail));
   I.forEach((i,j)=>{servoI[b*3+j]=i*scale;servoV[b*3+j]=voltage[j]});
   branchI.push(iTotal);branchV.push(vAtBus);
   branchLoss.push(iTotal*iTotal*rFeed+I.reduce((s,i)=>s+i*i*scale*scale*rPigtail,0));
   const powerOut=voltage.reduce((sum,v,j)=>sum+v*I[j]*scale,0);
   inputPowers.push(powerOut/Math.max(.15,bec.efficiency));
  }
 let batteryV=p.batV,batteryI=0;
 for(let iter=0;iter<8;iter++){
  batteryI=inputPowers.reduce((sum,power)=>sum+power/Math.max(2.0,batteryV),0);
  batteryV=Math.max(0,p.batV-batteryI*p.batR/1000);
 }
 const minV=Math.min(...servoV),maxV=Math.max(...servoV),current=branchI.reduce((a,b)=>a+b,0);
 for(let i=0;i<4;i++){
  const b=p.becs[i];if(branchI[i]>b.limit*.99)warnings.push({type:'warn',title:`BEC ${i+1} 전류 여유 부족`,detail:`출력 ${branchI[i].toFixed(1)}A / 한도 ${b.limit.toFixed(1)}A (설정값) — 실제 제한 동작은 제품별로 다름`});
  if(batteryV<b.voltage+.5)warnings.push({type:'warn',title:`BEC ${i+1} 입력 헤드룸 확인`,detail:`배터리 ${batteryV.toFixed(2)}V, 설정 출력 ${b.voltage}V. 강압형 제품은 이 조건에서 정상 조절 여부 확인 필요`});
 }
 if(minV<4.8)warnings.push({type:'err',title:'서보 저전압 예상',detail:`최저 추정 ${minV.toFixed(2)}V (<4.8V). 전류 부족 또는 긴 배선 문제 가능`});
 if(maxV>7.4)warnings.push({type:'err',title:'서보 과전압 예상',detail:`최고 추정 ${maxV.toFixed(2)}V (>7.4V)`});
 for(const s of torqueOver){if(s.ratio>1)warnings.push({type:'err',title:`서보 채널 ${s.id} 토크 초과`,detail:`추정 요구 ${s.torque.toFixed(1)}kgf·cm / 가정 스톨 ${p.stallTorque}kgf·cm`});}
 const runtime=batteryI>0?(p.batCap/1000*.8/batteryI*60):Infinity;
 return {branchI,branchV,branchLoss,servoI,servoV,current,batteryV,batteryI,minV,maxV,rFeed,runtime,warnings};
}
const ALL_PINS=ALL_PIN_IDS;
export function checkWires(wires){
 const errors=[],checks=[],adj=new Map(ALL_PINS.map(k=>[k,new Set()]));
 for(const [a,b] of INTERNAL_LINKS){adj.get(a).add(b);adj.get(b).add(a);}
 for(const w of wires){if(!adj.has(w.a)||!adj.has(w.b)){errors.push({type:'err',title:'알 수 없는 포트',detail:`${w.a} — ${w.b}`});continue;}
  if(w.a===w.b)continue;adj.get(w.a).add(w.b);adj.get(w.b).add(w.a);
 }
 const component=new Map();let g=0;
 for(const n of ALL_PINS){if(component.has(n))continue;let stack=[n];while(stack.length){let u=stack.pop();if(component.has(u))continue;component.set(u,g);for(const v of adj.get(u))stack.push(v);}g++;}
 const same=(a,b)=>component.get(a)===component.get(b);
 const req=(a,b,msg)=>{let ok=same(a,b);checks.push({type:ok?'ok':'err',title:msg,detail:ok?`${a} ↔ ${b}`:`연결 없음: ${a} ↔ ${b}`});return ok;};
 req('mega.v5','pca.vcc','Arduino 5V → PCA VCC');req('mega.gnd','pca.gnd','Arduino GND → PCA GND');req('mega.sda','pca.sda','Mega D20 SDA → PCA SDA');req('mega.scl','pca.scl','Mega D21 SCL → PCA SCL');
 for(let i=0;i<4;i++){
  req('battery.pos',`bec${i}.inpos`,`BEC ${i+1} 입력 +`);req('battery.neg',`bec${i}.inneg`,`BEC ${i+1} 입력 −`);
  req(`bec${i}.outneg`,'pca.gnd',`BEC ${i+1} 신호 공통 접지`);
  for(let j=0;j<3;j++){let s=i*3+j;
   req(`bec${i}.outpos`,`servo${s}.pos`,`서보 ${s} 전원 +`);
   req(`bec${i}.outneg`,`servo${s}.neg`,`서보 ${s} 전원 −`);
   req(`pca.ch${s}`,`servo${s}.signal`,`서보 ${s} PWM`);
  }
 }
 const posSupplies=['battery.pos','mega.v5','mega.v33',...Array.from({length:4},(_,i)=>`bec${i}.outpos`)];
 const negative=['battery.neg','mega.gnd',...Array.from({length:4},(_,i)=>`bec${i}.outneg`)];
 for(let i=0;i<posSupplies.length;i++){
  for(let j=i+1;j<posSupplies.length;j++){
   if(same(posSupplies[i],posSupplies[j]))errors.push({type:'err',title:'독립 전원 출력 연결 위험',detail:`${posSupplies[i]} 와 ${posSupplies[j]} 가 동일 전기 노드에 연결됨. BEC 출력 임의 병렬 금지`});
  }
  for(let j=0;j<negative.length;j++)if(same(posSupplies[i],negative[j]))errors.push({type:'err',title:'전원 극성 단락 가능성',detail:`${posSupplies[i]} ↔ ${negative[j]} 전기적으로 연결됨`});
 }
 if(wires.some(w=>canonicalPort(w.a)==='pca.vplus'||canonicalPort(w.b)==='pca.vplus'))errors.push({type:'warn',title:'PCA9685 V+ 사용 감지',detail:'서보 전원을 4계통 분리한 구성에서 PCA V+를 연결하면 3핀 헤더의 공통 V+와 충돌 가능. 전력 배선을 확인하세요.'});
 const signals=['mega.sda','mega.scl',...Array.from({length:16},(_,i)=>'pca.ch'+i)];
 for(let i=0;i<signals.length;i++){
  const signal=signals[i];
  if([...posSupplies,...negative,'pca.vplus'].some(rail=>same(signal,rail)))errors.push({type:'err',title:'신호선과 전원 레일 직접 연결',detail:signal+' 이 전원 또는 GND에 직접 연결되어 있습니다.'});
  for(let j=i+1;j<signals.length;j++)if(same(signal,signals[j]))errors.push({type:'err',title:'서로 다른 신호선 연결',detail:signal+' ↔ '+signals[j]+' 연결을 확인하세요.'});
 }
 if(negative.some(rail=>same('pca.vplus',rail)))errors.push({type:'err',title:'PCA9685 공통 V+ 단락',detail:'3핀 헤더의 공통 V+ 레일이 GND에 연결되어 있습니다.'});
 const missing=checks.filter(x=>x.type==='err');
 return {checks,errors,missing,valid:errors.filter(x=>x.type==='err').length===0&&missing.length===0,total:checks.length,good:checks.length-missing.length};
}
