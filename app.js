import {defaultState,catalog,LEG_NAMES,validateProject,defaultWires,TYPES,LIMITS,boundedNumber} from './model.js';
import {clamp,calculateLegs,evaluateMechanics,evaluatePower,checkWires} from './engineering.js';
import {generateArduino} from './codegen.js';
import {RobotScene} from './scene.js';
import {buildSchematic,portExists} from './wiring-ui.js';
import {PORTS,canonicalPort,describePort} from './pinout.js';
import {searchParts,relatedSearches,normalizeSearch} from './part-search.js';
let state=defaultState();let scene;let currentTab='design',running=false,simT=0,lastT=0,selectedPart=null,selectedIds=[],marqueeMode=false,simActive=false,chosenId='droyuke30',pickedPort=null,wireSeq=1000,lastUi=0;
let frameId=null,needsRefresh=true,pendingRebuild=false,wiringReport=null,wiringEditor=null,wiringVisited=false;
let suggestionParts=[],suggestionIndex=-1,searchComposing=false;
function requestFrame(){if(frameId===null&&!document.hidden)frameId=requestAnimationFrame(animate);}
function invalidate(){needsRefresh=true;requestFrame();}
const $=x=>document.getElementById(x);
const fmt=(n,d=1)=>Number.isFinite(n)?n.toFixed(d):'—';
let toastTimer;
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3200)}
function download(name,content,type='text/plain'){const a=document.createElement('a');let url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2500)}
function safeText(x){return String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
function configNumber(v,min,max,defaultVal){const n=Number(v);return Number.isFinite(n)?clamp(n,min,max):defaultVal}
function onChange(rebuild=false){pendingRebuild||=rebuild;if(currentTab==='code')updateCode();invalidate();}
function populateControls(){
 for(const k of ['bodyL','bodyW','bodyH','mass','upper','lower','comX','comZ'])$(k).value=state.geometry[k];
 for(const k of ['stride','lift','period','duty'])$(k).value=state.gait[k];
 for(const k of ['batV','batCap','batR','wireAWG','wireLen','contactR','servoRatedV','stallTorque','stallCurrent','idleCurrent'])$(k).value=state.power[k];
 for(const k of ['servoCenter','servoMin','servoMax','pulseMin','pulseMax'])$(k).value=state.calibration[k];
 $('speed').value=state.gait.speed||1;
 $('comXLabel').textContent=state.geometry.comX+' mm';$('comZLabel').textContent=state.geometry.comZ+' mm';
 $('speedLabel').textContent=(state.gait.speed||1).toFixed(2)+'×';
 $('simSpeed').value=state.gait.speed||1;$('simSpeedLabel').textContent=(state.gait.speed||1).toFixed(2)+'×';
 scene.applyAppearance(state.appearance);for(const [key,id] of [['body','bodyColor'],['links','linkColor'],['joints','jointColor'],['motors','motorColor'],['stl','stlColor']])$(id).value=state.appearance[key];
 renderBEC();renderParts();renderPlaced();renderChannels();updateCode();
}
function registerControls(){
 for(const k of ['bodyL','bodyW','bodyH','mass','upper','lower','comX','comZ']){
  const el=$(k);el.addEventListener('input',()=>{
   state.geometry[k]=boundedNumber(el.value,LIMITS.geometry[k],state.geometry[k]);
   if(k.startsWith('com'))$(k+'Label').textContent=state.geometry[k]+' mm';
   onChange(['bodyL','bodyW','bodyH','upper','lower'].includes(k));
  });
 }
 for(const k of ['stride','lift','period','duty'])$(k).addEventListener('input',()=>{state.gait[k]=boundedNumber($(k).value,LIMITS.gait[k],state.gait[k]);onChange()});
 for(const k of ['batV','batCap','batR','wireLen','contactR','servoRatedV','stallTorque','stallCurrent','idleCurrent'])$(k).addEventListener('input',()=>{state.power[k]=boundedNumber($(k).value,LIMITS.power[k],state.power[k]);onChange()});
 $('wireAWG').addEventListener('change',()=>{state.power.wireAWG=Number($('wireAWG').value);onChange()});
 for(const k of ['servoCenter','servoMin','servoMax','pulseMin','pulseMax'])$(k).addEventListener('input',()=>{state.calibration[k]=boundedNumber($(k).value,LIMITS.calibration[k],state.calibration[k]);onChange()});
 $('speed').addEventListener('input',()=>setSpeed(Number($('speed').value)));
 $('simSpeed').addEventListener('input',()=>setSpeed(Number($('simSpeed').value)));
 $('playBtn').addEventListener('click',openSimulation);
 $('simToggle').addEventListener('click',()=>{running=!running;setRunningButton()});
 $('simRestart').addEventListener('click',()=>{simT=0;running=true;setRunningButton();invalidate()});
 $('simStop').addEventListener('click',closeSimulation);
 $('simClose').addEventListener('click',closeSimulation);
 $('resetBtn').addEventListener('click',()=>{running=false;simT=0;setRunningButton();invalidate();toast('설계 기본 자세로 초기화했습니다.')});
 for(const [key,id] of [['body','bodyColor'],['links','linkColor'],['joints','jointColor'],['motors','motorColor'],['stl','stlColor']])$(id).addEventListener('input',()=>{state.appearance[key]=$(id).value;scene.applyAppearance(state.appearance)});
 $('marqueeToggle').addEventListener('click',()=>setMarqueeMode(!marqueeMode));
 $('marqueeViewport').addEventListener('click',()=>setMarqueeMode(!marqueeMode));
 $('selectAllParts').addEventListener('click',()=>setPartSelection(state.placedParts.map(p=>p.uid)));
 $('clearSelection').addEventListener('click',()=>setPartSelection([]));
 $('removeSelected').addEventListener('click',removeSelection);
 $('applySelectionColor').addEventListener('click',()=>{
   if(!selectedIds.length)return toast('3D 화면에서 부품을 먼저 선택하세요.');
   const color=$('selectionColor').value;
   for(const p of state.placedParts)if(selectedIds.includes(p.uid))p.color=color;
   scene.syncParts(state);invalidate();toast(`${selectedIds.length}개 부품 색상을 변경했습니다.`);
 });
 $('applyBulk').addEventListener('click',()=>{
   if(!selectedIds.length)return toast('부품을 먼저 선택하세요.');
   const dx=configNumber($('bulkX').value,-3000,3000,0),dy=configNumber($('bulkY').value,-3000,3000,0),dz=configNumber($('bulkZ').value,-3000,3000,0),dry=configNumber($('bulkRY').value,-360,360,0);
   for(const p of state.placedParts)if(selectedIds.includes(p.uid)){p.x+=dx;p.y+=dy;p.z+=dz;p.ry=((p.ry||0)+dry)%360;}
   scene.syncParts(state);setPartSelection(selectedIds);invalidate();toast(`${selectedIds.length}개 부품을 한꺼번에 수정했습니다.`);
 });
 $('resetBulk').addEventListener('click',()=>{for(const id of ['bulkX','bulkY','bulkZ','bulkRY'])$(id).value=0;});
 document.addEventListener('keydown',e=>{
   if(e.key==='Escape'&&currentTab==='wiring'&&pickedPort){e.preventDefault();pickedPort=null;renderWires();return;}
   if(e.key==='Escape'){if(simActive){closeSimulation();return;}if(marqueeMode)setMarqueeMode(false);else setPartSelection([]);}
   if(simActive)return;
   if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
   if(e.key==='Delete'||e.key==='Backspace'){if(selectedIds.length){e.preventDefault();removeSelection();}}
   if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'&&['parts','design'].includes(currentTab)){e.preventDefault();setPartSelection(state.placedParts.map(p=>p.uid));}
 });
 for(const b of document.querySelectorAll('[data-tab]'))b.addEventListener('click',()=>setTab(b.dataset.tab));
 $('viewIso').addEventListener('click',()=>scene.setView('iso'));$('viewTop').addEventListener('click',()=>scene.setView('top'));$('viewSide').addEventListener('click',()=>scene.setView('side'));$('viewGrid').addEventListener('click',()=>{scene.grid.visible=!scene.grid.visible;requestFrame()});
 $('stlInput').addEventListener('change',async e=>{let f=e.target.files[0];if(!f)return;if(f.size>80*1024*1024){toast('80MB 이하 STL을 선택하세요.');return}try{let size=await scene.loadSTL(f);scene.applyAppearance(state.appearance);$('stlInfo').textContent=`${f.name} / 크기 ${size.toArray().map(x=>x.toFixed(1)).join(' × ')} (원본 단위가 mm라고 가정)`;toast('STL 3D 모양을 불러왔습니다. 관절 정보는 자동 생성되지 않습니다.')}catch(err){toast('STL 파싱 실패: '+err.message)}e.target.value=''});
 $('clearStl').addEventListener('click',()=>{scene.clearSTL();$('stlInfo').textContent='업로드된 모델 없음'});
 $('help').addEventListener('click',()=>{$('helpModal').hidden=false});$('closeHelp').addEventListener('click',()=>{$('helpModal').hidden=true});$('okHelp').addEventListener('click',()=>{$('helpModal').hidden=true});
 $('exportProject').addEventListener('click',()=>download('quadlab-project.json',JSON.stringify(state,null,2),'application/json'));
 $('loadProject').addEventListener('change',async e=>{let f=e.target.files?.[0];if(!f)return;try{if(f.size>2*1024*1024)throw Error('프로젝트 JSON은 2MB 이하여야 합니다');const loaded=validateProject(JSON.parse(await f.text()));state=loaded;pickedPort=null;chosenId=catalog(state).some(p=>p.id===chosenId)?chosenId:'droyuke30';running=false;simT=0;lastT=0;selectedPart=null;selectedIds=[];scene.syncParts(state);scene.setSelection([]);scene.rebuildRobot(state);populateControls();updateSelectionUI();renderWires();invalidate();toast('프로젝트 불러오기 완료')}catch(err){toast('프로젝트 형식 오류: '+err.message)}e.target.value=''});
 $('partSearch').addEventListener('input',()=>{if(!searchComposing)renderParts();});
 $('partSearch').addEventListener('compositionstart',()=>{searchComposing=true;});
 $('partSearch').addEventListener('compositionend',()=>{searchComposing=false;renderParts();});
 $('partSearch').addEventListener('focus',renderParts);
 $('partSearch').addEventListener('keydown',e=>{
  if(e.isComposing||searchComposing)return;
  if(e.key==='Escape'){e.stopPropagation();closeSuggestions();return;}
  if((e.key==='ArrowDown'||e.key==='ArrowUp')&&suggestionParts.length){
   e.preventDefault();$('partSuggestions').hidden=false;$('partSearch').setAttribute('aria-expanded','true');
   suggestionIndex=suggestionIndex<0?(e.key==='ArrowDown'?0:suggestionParts.length-1):(suggestionIndex+(e.key==='ArrowDown'?1:-1)+suggestionParts.length)%suggestionParts.length;
   updateSuggestionFocus();
  }else if(e.key==='Enter'&&!$('partSuggestions').hidden&&suggestionParts.length){e.preventDefault();selectSearchPart(suggestionParts[Math.max(0,suggestionIndex)].id,true);}
 });
 document.addEventListener('pointerdown',e=>{if(!e.target.closest('.part-search-wrap'))closeSuggestions();});
 $('addPart').addEventListener('click',addPart);
 $('createPart').addEventListener('click',createPart);
 $('applyServo').addEventListener('click',applyServo);
 $('applyBec').addEventListener('click',applyBec);
 $('specInput').addEventListener('change',importSpec);
 $('placedPart').addEventListener('change',()=>setPartSelection($('placedPart').value?[$('placedPart').value]:[]));
 for(const [key,id] of [['x','partX'],['y','partY'],['z','partZ'],['ry','partRY']])$(id).addEventListener('input',()=>{if(!selectedPart)return;let p=state.placedParts.find(x=>x.uid===selectedPart);if(p){p[key]=configNumber($(id).value,-3000,3000,p[key]);scene.syncParts(state);onChange()}});
 $('partFocus').addEventListener('click',()=>{if(selectedPart)scene.focus(selectedPart)});
 $('removePart').addEventListener('click',()=>removeSelection());
 $('wireReset').addEventListener('click',()=>{state.wires=defaultWires();pickedPort=null;renderWires();toast('기준 배선 복원')});
 $('wireCancel').addEventListener('click',()=>{pickedPort=null;renderWires()});
 $('wireClear').addEventListener('click',()=>{state.wires=[];pickedPort=null;renderWires();toast('모든 전선을 지웠습니다. 표준 배선 복구로 다시 연결할 수 있습니다.');});
 $('wireLayoutReset').addEventListener('click',()=>{state.wiringLayout={};renderWires();wiringEditor.fit();});
 $('wireFit').addEventListener('click',()=>wiringEditor.fit());
 $('wireMega').addEventListener('click',()=>wiringEditor.focus('mega'));
 $('wirePca').addEventListener('click',()=>wiringEditor.focus('pca'));
 $('wireZoomIn').addEventListener('click',()=>wiringEditor.setZoom(wiringEditor.zoom*1.2));
 $('wireZoomOut').addEventListener('click',()=>wiringEditor.setZoom(wiringEditor.zoom/1.2));
 $('wireFullscreen').addEventListener('click',async()=>{
  try{if(document.fullscreenElement)await document.exitFullscreen();else await $('viewport').requestFullscreen();}
  catch{toast('이 브라우저에서는 전체화면을 사용할 수 없습니다.');}
 });
 document.addEventListener('fullscreenchange',()=>{$('wireFullscreen').textContent=document.fullscreenElement?'전체화면 종료':'전체화면';wiringEditor?.syncView();});
 $('wirePinSearch').addEventListener('input',renderPinMatches);
 $('downloadIno').addEventListener('click',()=>{download('quadruped_crawl_mega.ino',generateArduino(state));toast('Arduino 스케치 내려받기 완료')});
 $('copyCode').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(generateArduino(state));toast('코드 복사 완료')}catch(e){$('codePreview').select();document.execCommand('copy');toast('코드를 선택했어요')}});
}
function setRunningButton(){
 lastT=0;invalidate();
 $('simToggle').textContent=running?'Ⅱ 일시정지':'▶ 이어서 구동';
 $('simStatus').textContent=running?'● 구동 중':'Ⅱ 일시정지';
}
function setSpeed(speed){state.gait.speed=speed;for(const id of ['speed','simSpeed'])$(id).value=speed;for(const id of ['speedLabel','simSpeedLabel'])$(id).textContent=speed.toFixed(2)+'×';}
function openSimulation(){
 if(simActive)return;
 simActive=true;simT=0;running=true;setMarqueeMode(false);
 $('simOverlay').hidden=false;
 scene.setSelection([]);scene.trans.enabled=false;
 scene.setHost($('simCanvas'));
 scene.setView('iso');
 setRunningButton();invalidate();
 requestAnimationFrame(()=>scene.resize());
}
function closeSimulation(){
 if(!simActive)return;
 running=false;simActive=false;simT=0;
 scene.setHost($('renderHost'));$('simOverlay').hidden=true;
 scene.trans.enabled=true;setPartSelection(selectedIds);setRunningButton();invalidate();
 requestAnimationFrame(()=>scene.resize());
}
function setMarqueeMode(yes){
 marqueeMode=!!yes&&!simActive&&currentTab!=='wiring';
 scene.setMarquee(marqueeMode);
 $('marqueeToggle').classList.toggle('enabled',marqueeMode);$('marqueeViewport').classList.toggle('enabled',marqueeMode);
 $('marqueeToggle').textContent=marqueeMode?'▧ 영역 선택 끄기':'▧ 영역 선택 켜기';
 $('marqueeViewport').textContent=marqueeMode?'▧ 영역 선택: 켜짐':'▧ 영역 선택: 꺼짐';
 $('viewportHint').textContent=marqueeMode?'영역 선택: 드래그 선택 / Shift+드래그 추가 / Esc 종료':'설계 모드: 드래그 카메라 회전 / 휠 확대 · 영역 선택으로 다중 선택';
 if(marqueeMode)scene.trans.detach();else scene.setSelection(selectedIds);
}
function setPartSelection(ids){
 selectedIds=[...new Set(ids)].filter(uid=>state.placedParts.some(p=>p.uid===uid));
 selectedPart=selectedIds.length===1?selectedIds[0]:null;
 scene.setSelection(selectedIds);
 renderPlaced();updateSelectionUI();
 if(selectedPart){const p=state.placedParts.find(x=>x.uid===selectedPart);if(p)for(const [key,id] of [['x','partX'],['y','partY'],['z','partZ'],['ry','partRY']])$(id).value=fmt(p[key],0);}
}
function updateSelectionUI(){
 const n=selectedIds.length;
 $('selectedCount').textContent=`선택된 부품: ${n}개`;
 $('selectionLabel').textContent=n?`${n} PART${n===1?'':'S'} SELECTED`:'4 Legs / 12 DOF';
 $('removeSelected').disabled=!n;$('applySelectionColor').disabled=!n;$('applyBulk').disabled=!n;
}
function removeSelection(){
 if(!selectedIds.length)return toast('삭제할 부품을 선택하세요.');
 const n=selectedIds.length;state.placedParts=state.placedParts.filter(p=>!selectedIds.includes(p.uid));
 selectedPart=null;selectedIds=[];scene.syncParts(state);setPartSelection([]);invalidate();toast(`${n}개 부품 삭제 완료`);
}
function handleSceneEvent(uid,coords,angle,meta={kind:'pick'}){
 if(simActive)return;
 if(meta.kind==='pick'){if(meta.additive){let next=selectedIds.includes(uid)?selectedIds.filter(x=>x!==uid):[...selectedIds,uid];setPartSelection(next);}else setPartSelection(uid?[uid]:[]);}
 else if(meta.kind==='marquee'){let next=meta.additive?[...selectedIds,...meta.uids]:meta.uids;setPartSelection(next);}
 else if(meta.kind==='clear')setPartSelection([]);
 else if(meta.kind==='move'){
   const p=state.placedParts.find(x=>x.uid===uid);if(!p)return;
   [p.x,p.y,p.z]=coords;p.ry=angle||0;
   if(!selectedIds.includes(uid))setPartSelection([uid]);
   for(const [key,id] of [['x','partX'],['y','partY'],['z','partZ'],['ry','partRY']])$(id).value=fmt(p[key],0);
   scene.syncParts(state);invalidate();
 }
 else if(meta.kind==='multi-move'){
   for(const c of meta.changes){const p=state.placedParts.find(p=>p.uid===c.uid);if(p){p.x=c.x;p.y=c.y;p.z=c.z;}}
   scene.syncParts(state);invalidate();
 }
}
function setTab(tab){if(simActive)closeSimulation();if(tab==='wiring'&&marqueeMode)setMarqueeMode(false);currentTab=tab;document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));document.querySelectorAll('.panel').forEach(x=>x.classList.toggle('active',x.id==='panel-'+tab));const wiring=tab==='wiring';$('wireHost').hidden=!wiring;$('wireToolbar').hidden=!wiring;$('wireHud').hidden=!wiring;$('viewport').classList.toggle('wiring-view',wiring);$('renderHost').style.display=wiring?'none':'block';$('viewButtons').style.display=wiring?'none':'flex';$('modeBadge').textContent=wiring?'WIRING EDITOR':tab==='power'?'CIRCUIT ESTIMATE':tab==='code'?'FIRMWARE OUTPUT':'DESIGN · PAUSED';$('viewName').textContent=({design:'MECHANICAL WORKSPACE',parts:'COMPONENT LIBRARY',wiring:'CIRCUIT NETLIST',power:'POWER ANALYSIS',code:'FIRMWARE WORKBENCH'})[tab];if(wiring){renderWires();if(!wiringVisited){wiringEditor.fit();wiringVisited=true;}}if(tab==='code')updateCode();if(tab==='parts')renderPlaced();scene.resize();invalidate();}
function closeSuggestions(){
 $('partSuggestions').hidden=true;$('partSearch').setAttribute('aria-expanded','false');$('partSearch').removeAttribute('aria-activedescendant');suggestionIndex=-1;
}
function updateSuggestionFocus(){
 $('partSuggestions').querySelectorAll('[role="option"]').forEach((option,i)=>{const active=i===suggestionIndex;option.classList.toggle('active',active);option.setAttribute('aria-selected',String(active));});
 if(suggestionIndex>=0)$('partSearch').setAttribute('aria-activedescendant','part-suggestion-'+suggestionIndex);
}
function selectSearchPart(id,setQuery=false){
 chosenId=id;const part=catalog(state).find(p=>p.id===id);if(setQuery&&part)$('partSearch').value=part.name;
 renderParts();closeSuggestions();
}
function renderParts(){
 const parts=catalog(state),query=$('partSearch').value.trim(),arr=searchParts(parts,query);
 if(!arr.some(p=>p.id===chosenId))chosenId=arr[0]?.id||null;
 $('partResultCount').textContent=query?'검색 결과 '+arr.length+'개':'등록된 부품 '+arr.length+'개';
 $('partList').innerHTML=arr.length?arr.map(p=>`<button class="part-row ${chosenId===p.id?'selected':''}" data-id="${safeText(p.id)}"><span>${safeText(p.name)}<br><small>${safeText(p.brand)}</small></span><small>${safeText(TYPES[p.type]||p.type)}</small></button>`).join(''):'<div class="no-part-result">등록된 부품에 검색 결과가 없습니다.<br>아래에서 제품명과 사양을 직접 등록할 수 있습니다.</div>';
 $('partList').querySelectorAll('.part-row').forEach(b=>b.onclick=()=>selectSearchPart(b.dataset.id));
 suggestionParts=query?arr.slice(0,6):[];suggestionIndex=-1;
 $('partSuggestions').innerHTML=suggestionParts.map((p,i)=>`<button type="button" id="part-suggestion-${i}" role="option" aria-selected="false" data-suggest="${safeText(p.id)}"><span>${safeText(p.name)}</span><small>${safeText(TYPES[p.type]||p.type)}</small></button>`).join('');
 const show=Boolean(query&&suggestionParts.length&&document.activeElement===$('partSearch'));
 $('partSuggestions').hidden=!show;$('partSearch').setAttribute('aria-expanded',String(show));$('partSearch').removeAttribute('aria-activedescendant');
 $('partSuggestions').querySelectorAll('[data-suggest]').forEach(b=>{b.onpointerdown=e=>e.preventDefault();b.onclick=()=>selectSearchPart(b.dataset.suggest,true);});
 $('relatedSearches').replaceChildren();
 for(const term of relatedSearches(query,parts)){const b=document.createElement('button');b.type='button';b.textContent=term;b.onclick=()=>{$('partSearch').value=term;$('partSearch').focus();renderParts();};$('relatedSearches').append(b);}
 const chosen=parts.find(p=>p.id===chosenId);
 $('addPart').disabled=!chosen;$('applyServo').disabled=!chosen||chosen.type!=='servo';$('applyBec').disabled=!chosen||chosen.type!=='power'||!chosen.spec?.limit;
 $('partDetail').innerHTML=chosen?`<b>${safeText(chosen.name)}</b><br>확인 수준: ${safeText(chosen.verified)}<br>크기 X/Y/Z: ${chosen.dim.map(fmt0).join(' × ')} mm<br>질량: ${fmt(chosen.mass,0)}g<br>${safeText(chosen.notes)}${chosen.spec?`<br><b>해석 프로파일:</b> ${safeText(JSON.stringify(chosen.spec))}`:''}${chosen.source?`<br><a href="${safeText(chosen.source)}" rel="noopener noreferrer" target="_blank">공식/참고 자료 보기</a>`:''}`:'부품을 검색하거나 목록에서 선택해 주세요.';
 $('activeMotor').textContent='현재 서보 시뮬레이션: '+(parts.find(x=>x.id===state.activeServoId)?.name||state.activeServoId)+' / 사양의 실측 여부 확인 필요';
}
function fmt0(x){return String(x)}
function addPart(){let part=catalog(state).find(p=>p.id===chosenId);if(!part)return;let uid='P'+state.nextId++;state.placedParts.push({uid,catalogId:part.id,x:0,y:state.geometry.bodyH+70,z:0,ry:0});scene.syncParts(state);setPartSelection([uid]);invalidate();toast('부품을 배치했습니다. 축 핸들 또는 좌표로 이동하세요.')}
function createPart(){let name=$('customName').value.trim();if(!name)return toast('제품명을 입력하세요.');const typ=$('customType').value;const spec=typ==='servo'?{voltage:Number($('customVoltage').value),stallTorque:Number($('customTorque').value),stallCurrent:Number($('customCurrent').value),idleCurrent:Number($('customIdle').value)}:typ==='power'?{voltage:Number($('customVoltage').value),limit:Number($('customCurrent').value),efficiency:Number($('customEff').value)}:null;
 const url=$('customSource').value.trim();if(url&&(!/^https:\/\//i.test(url)))return toast('참고 자료 URL은 https://로 시작해야 합니다.');
 const part={id:'custom-'+Date.now(),name,brand:'사용자 등록',type:typ,verified:'사용자 입력값 / 검증되지 않음',dim:['customX','customY','customZ'].map(k=>clamp(Number($(k).value)||20,1,2000)),mass:clamp(Number($('customMass').value)||0,0,50000),spec,source:url,notes:'사용자 등록 사양입니다. 실제 공식 자료로 검증하세요. 3D 외형은 아직 치수 기반 근사입니다.'};state.customParts.push(part);chosenId=part.id;$('partSearch').value='';renderParts();toast('사용자 부품을 등록했습니다. 구동 사양 적용 버튼을 누르세요.')}

function applyServo(){const part=catalog(state).find(x=>x.id===chosenId);if(!part||part.type!=='servo'||!part.spec)return toast('구동 사양이 등록된 서보모터를 선택하세요.');
 const {voltage,stallTorque,stallCurrent,idleCurrent}=part.spec;
 if(![voltage,stallTorque,stallCurrent,idleCurrent].every(x=>Number.isFinite(x)&&x>=0)||voltage<=0||stallTorque<=0||stallCurrent<=0)return toast('모터 전기 사양이 유효하지 않습니다.');
 Object.assign(state.power,{servoRatedV:voltage,stallTorque,stallCurrent,idleCurrent});state.activeServoId=part.id;populateControls();invalidate();toast('서보 토크·전류 프로파일을 해석에 적용했습니다. 실제 데이터 검증 필수');
}
function applyBec(){const part=catalog(state).find(x=>x.id===chosenId);if(!part||part.type!=='power'||!part.spec?.limit)return toast('BEC 출력 사양이 등록된 전원장치를 선택하세요.');
 const {voltage,limit,efficiency}=part.spec;if(![voltage,limit,efficiency].every(x=>Number.isFinite(x)&&x>0)||efficiency>1)return toast('BEC 사양이 잘못되었습니다.');
 const target=$('becTarget').value;const which=target==='all'?[0,1,2,3]:[Number(target)];for(const i of which)state.power.becs[i]={voltage,limit,efficiency};populateControls();invalidate();toast('BEC 출력 사양을 해석에 적용했습니다. 실제 정격 검증 필수');
}
async function importSpec(e){const file=e.target.files?.[0];if(!file)return;
 try{
  if(file.size>200_000)throw Error('JSON 파일이 너무 큽니다(200KB 제한).');
  const p=JSON.parse(await file.text());if(typeof p.name!=='string'||!p.name.trim()||!['servo','controller','power','other'].includes(p.type)||!Array.isArray(p.dim)||p.dim.length!==3||!p.dim.every(x=>Number.isFinite(x)&&x>0&&x<=5000))throw Error('필수 필드 name, type, dim이 잘못되었습니다.');
  const spec=p.spec&&typeof p.spec==='object'?p.spec:null;
  const part={id:'json-'+Date.now(),name:p.name.slice(0,120),brand:String(p.brand||'사용자 가져오기').slice(0,100),type:p.type,verified:'외부 JSON 입력값 / 제조사 검증 필요',dim:p.dim,mass:Number.isFinite(p.mass)?clamp(p.mass,0,100000):0,spec,source:typeof p.source==='string'&&/^https:\/\//.test(p.source)?p.source:'',notes:String(p.notes||'사용자 등록 JSON').slice(0,350)};
  state.customParts.push(part);chosenId=part.id;$('partSearch').value='';renderParts();toast('제품 사양을 가져왔습니다. 적용 버튼을 누르세요.');
 }catch(err){toast('사양 JSON 오류: '+err.message)}e.target.value='';
}

function renderPlaced(){const defs=catalog(state);$('placedPart').innerHTML='<option value="">— 배치 부품 선택 —</option>'+state.placedParts.map(p=>`<option value="${safeText(p.uid)}">${safeText(p.uid)} · ${safeText(defs.find(x=>x.id===p.catalogId)?.name||'알 수 없는 부품')}</option>`).join('');if(selectedPart)$('placedPart').value=selectedPart;}
function renderBEC(){let html=state.power.becs.map((b,i)=>`<div class="bec-line"><h4>BEC ${i+1} / 서보 채널 ${i*3}–${i*3+2}</h4><div class="field-grid"><label>출력 설정 (V)<input data-bec="${i}" data-key="voltage" type="number" step="0.1" min="3" max="8" value="${b.voltage}"></label><label>연속 전류 한도 (A)<input data-bec="${i}" data-key="limit" type="number" step="0.5" min="0.1" max="150" value="${b.limit}"></label><label>효율 (0~1)<input data-bec="${i}" data-key="efficiency" type="number" step="0.01" min="0.2" max="1" value="${b.efficiency}"></label></div></div>`).join('');$('becFields').innerHTML=html;document.querySelectorAll('[data-bec]').forEach(el=>el.addEventListener('input',()=>{const i=Number(el.dataset.bec);state.power.becs[i][el.dataset.key]=boundedNumber(el.value,LIMITS.bec[el.dataset.key],state.power.becs[i][el.dataset.key]);onChange()}));}
function renderChannels(){$('channels').innerHTML=Array.from({length:12},(_,i)=>`<span>CH ${i} · ${LEG_NAMES[Math.floor(i/3)].split(' ')[0]}<br>${['Hip Roll','Hip Pitch','Knee'][i%3]}</span>`).join('')}
function updateCode(){
 try{$('codePreview').value=generateArduino(state);$('downloadIno').disabled=false;$('copyCode').disabled=false;}
 catch(error){$('codePreview').value='설정 오류: '+error.message;$('downloadIno').disabled=true;$('copyCode').disabled=true;}
}
function renderPinMatches(){
 const query=normalizeSearch($('wirePinSearch').value);$('wirePinMatches').replaceChildren();if(!query)return;
 const matches=PORTS.filter(p=>normalizeSearch(p.id+' '+p.label+' '+describePort(p.id)).includes(query)).slice(0,12);
 if(!matches.length){$('wirePinMatches').textContent='일치하는 핀이 없습니다.';return;}
 for(const p of matches){const b=document.createElement('button');b.type='button';b.textContent=describePort(p.id);b.onclick=()=>{choosePort(p.id);wiringEditor.focus(p.nodeId);};$('wirePinMatches').append(b);}
}
function renderWires(){
 const report=wiringReport=checkWires(state.wires);
 wiringEditor=buildSchematic($('wireSvg'),state.wires,pickedPort,choosePort,removeWire,{
  layout:state.wiringLayout,
  onMove:(id,position)=>{state.wiringLayout[id]=position;},
  onHover:message=>{$('wireHover').textContent=message||(pickedPort?'연결 중: '+describePort(pickedPort):'핀 → 핀 연결 · 부품 드래그 · 휠 확대');},
  onZoom:percent=>{$('wireZoomLabel').textContent=percent+'%';}
 });
 const message=pickedPort?'연결 중: '+describePort(pickedPort)+' → 두 번째 핀을 선택하세요':'실제 핀 위치를 확인하고 두 핀을 순서대로 선택하세요.';
 $('wireSelect').textContent=message;$('wireHover').textContent=message;
 $('wireResults').innerHTML=`<div class="info-line">연결 점검: ${report.good}/${report.total} 통과 · 위험 ${report.errors.length}건</div>`+[...report.errors,...report.missing,...report.checks.filter(x=>x.type==='ok').slice(0,5)].map(i=>`<div class="check-item ${i.type}"><i>${i.type==='ok'?'✓':'!'}</i>${safeText(i.title)}: ${safeText(i.detail)}</div>`).join('');
 $('wireList').innerHTML=state.wires.map(w=>`<div class="wire-item"><span>${safeText(describePort(w.a))} → ${safeText(describePort(w.b))}</span><button data-wire="${safeText(w.id)}" aria-label="전선 삭제">×</button></div>`).join('');
 $('wireList').querySelectorAll('[data-wire]').forEach(b=>b.onclick=()=>removeWire(b.dataset.wire));invalidate();
}
function choosePort(port){
 if(!portExists(port))return;
 if(!pickedPort){pickedPort=port;renderWires();return;}
 if(pickedPort!==port&&!state.wires.some(w=>(canonicalPort(w.a)===canonicalPort(pickedPort)&&canonicalPort(w.b)===canonicalPort(port))||(canonicalPort(w.a)===canonicalPort(port)&&canonicalPort(w.b)===canonicalPort(pickedPort)))){
  while(state.wires.some(w=>w.id==='U'+wireSeq))wireSeq++;
  state.wires.push({id:'U'+wireSeq++,a:pickedPort,b:port});toast('전선 추가: '+describePort(pickedPort)+' → '+describePort(port));
 }
 pickedPort=null;renderWires();
}
function removeWire(id){state.wires=state.wires.filter(w=>w.id!==id);renderWires();}
function diagnosticItems(legs,m,e,w){let arr=[];
 if(!w.valid){arr.push({type:'err',title:'배선 검사 실패',detail:`필수 연결 누락 ${w.missing.length}개, 회로상 심각한 위험 ${w.errors.filter(x=>x.type==='err').length}개. 전압 해석 결과는 실제 배선과 불일치할 수 있습니다.`});}
 arr.push(...w.errors.slice(0,2));
 if(m.supports<3)arr.push({type:'err',title:'지지점 부족',detail:`지면 접촉 ${m.supports}개. 준정적 3점 지지 조건을 만족하지 않습니다.`});
 else if(m.margin<0)arr.push({type:'err',title:'무게중심이 지지다각형 바깥',detail:`안정 여유 ${fmt(m.margin,1)}mm. 정적 전복 위험.`});
 else if(m.margin<18)arr.push({type:'warn',title:'무게중심 안정 여유 작음',detail:`경계까지 약 ${fmt(m.margin,1)}mm. 실제 흔들림/가속 시 전복 가능성.`});
 else arr.push({type:'ok',title:'정적 지지다각형 안쪽',detail:`정적 여유 ${fmt(m.margin,1)}mm. 동적 안정성 보장은 아님.`});
 if(legs.some(l=>!l.feasible))arr.push({type:'err',title:'관절 길이로 도달할 수 없는 발 위치',detail:'다리 길이 및 몸통 높이를 변경하세요. 미도달 관절은 임시로 최대 신장 처리됩니다.'});
 else arr.push({type:'ok',title:'12관절 운동학 계산',detail:'발 목표점 4개가 2링크 길이 범위 내에 있습니다. 기구 간섭은 별도 검토 필요.'});
 arr.push(...e.warnings.slice(0,4));
 if(!e.warnings.length)arr.push({type:'ok',title:'기본 전압·전류 가정상 큰 위반 없음',detail:'실제 부품 정격이 아닌 가정값으로 계산했으므로 실물 안전성 확정 불가.'});
 const intersections=scene.checkIntersections(state);if(intersections.length)arr.push({type:'warn',title:'배치 부품 경계상자 겹침',detail:intersections.slice(0,2).join(', ')+' (회전·홀 위치 무시 근사)'});
 arr.push({type:'warn',title:'데이터 검증 필요',detail:'DROYUKE 실물 스톨전류, 토크 곡선 및 BEC 지속·피크 전류는 아직 확인되지 않았습니다.'});
 arr.push({type:'warn',title:'실제 이동형 로봇 전원 설계 미완성',detail:'현재 Arduino Mega는 USB 전원 사용을 가정합니다. 이동형 구동을 위해 검증된 독립 로직 전원이 필요합니다.'});
 return arr;}
function refresh(drawUI=false){let legs=calculateLegs(state,simT),mech=evaluateMechanics(state,legs);scene.updateRobot(state,legs,mech);if(!drawUI)return;const elec=evaluatePower(state,mech),wiring=wiringReport||(wiringReport=checkWires(state.wires));if(simActive){$('simClock').textContent=fmt(simT,2)+' s';$('simTelemetry').textContent=`전류 ${fmt(elec.current,2)} A · 배터리 ${fmt(elec.batteryV,2)} V · 접지 ${mech.supports}개 · 안정 여유 ${fmt(mech.margin,1)}mm`;}
 if(drawUI){$('totalCurrent').innerHTML=fmt(elec.current,2)+' <span>A</span>';$('batteryVoltage').innerHTML=fmt(elec.batteryV,2)+' <span>V</span>';$('stability').textContent=mech.margin>=18?'정적 안정':mech.margin>=0?'주의':'전복 위험';$('stability').style.color=mech.margin>=18?'#72d0a0':mech.margin>=0?'#e5b674':'#f38f91';$('supportCount').textContent=`접지 ${mech.supports}개 · 여유 ${fmt(mech.margin,1)} mm`;$('peakTorque').innerHTML=fmt(mech.peakTorque,1)+' <span>kgf·cm</span>';let items=diagnosticItems(legs,mech,elec,wiring);$('diagnostics').innerHTML=items.slice(0,10).map(i=>`<div class="diagnostic ${i.type}"><span class="signal">${i.type==='ok'?'✓':i.type==='err'?'✕':'!'}</span><div><b>${safeText(i.title)}</b>${safeText(i.detail)}</div></div>`).join('');let issues=items.filter(x=>x.type!=='ok').length;$('issueCount').textContent=issues?`경고 · 오류 ${issues}개`:'점검 통과';}
}
function animate(ms){
 frameId=null;
 const moving=simActive&&running;
 const dt=lastT?Math.min(.055,(ms-lastT)/1000):0;
 lastT=ms;
 if(moving)simT+=dt*state.gait.speed;
 if(pendingRebuild){scene.rebuildRobot(state);pendingRebuild=false;}
 if(needsRefresh||moving){
  const drawUI=needsRefresh||ms-lastUi>=220;
  refresh(drawUI);if(drawUI)lastUi=ms;needsRefresh=false;
 }
 if(currentTab!=='wiring'||simActive)scene.render();
 if(moving)requestFrame();else lastT=0;
}
function boot(){
 scene=new RobotScene($('renderHost'),handleSceneEvent,requestFrame);
 registerControls();populateControls();scene.syncParts(state);setPartSelection([]);setRunningButton();renderWires();invalidate();
 document.addEventListener('visibilitychange',()=>{
  lastT=0;
  if(document.hidden){if(frameId!==null)cancelAnimationFrame(frameId);frameId=null;}
  else invalidate();
 });
}
boot();
