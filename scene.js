import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {catalog} from './model.js';
function disposeObject(root){
 const geometries=new Set(),materials=new Set();
 root.traverse(obj=>{
  if(obj.geometry)geometries.add(obj.geometry);
  for(const mat of (Array.isArray(obj.material)?obj.material:[obj.material]))if(mat)materials.add(mat);
 });
 for(const geometry of geometries)geometry.dispose();
 for(const material of materials)material.dispose();
}
export class RobotScene{
 constructor(host,selected,invalidate=()=>{}){this.host=host;this.selected=selected;this.invalidate=invalidate;
   this.linkDirection=new THREE.Vector3();this.upAxis=new THREE.Vector3(0,1,0);
   this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#111d2b');
   this.camera=new THREE.PerspectiveCamera(43,1,1,14000);this.camera.position.set(900,700,1050);this.camera.lookAt(0,180,0);
   this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});this.renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.setSize(host.clientWidth||1200,host.clientHeight||700);host.appendChild(this.renderer.domElement);
   this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.target.set(0,150,0);this.controls.maxDistance=3600;this.controls.minDistance=140;
   this.controls.addEventListener('change',invalidate);
   this.scene.add(new THREE.HemisphereLight(0xcfefff,0x304257,2.8));
   const key=new THREE.DirectionalLight('#def7ff',3);key.position.set(400,800,600);this.scene.add(key);
   const edge=new THREE.DirectionalLight('#5bb3cf',1.8);edge.position.set(-450,440,-500);this.scene.add(edge);
   this.grid=new THREE.GridHelper(3200,32,0x32616a,0x283849);this.grid.position.y=-3;this.scene.add(this.grid);
   const floor=new THREE.Mesh(new THREE.PlaneGeometry(3400,3400),new THREE.MeshStandardMaterial({color:'#142335',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-5;this.scene.add(floor);
   const axes=new THREE.AxesHelper(180);axes.position.set(-680,4,-500);this.scene.add(axes);
   this.root=new THREE.Group();this.scene.add(this.root);
   this.robot=new THREE.Group();this.root.add(this.robot);
   this.attachments=new THREE.Group();this.root.add(this.attachments);
   this.stanceMaterial=new THREE.MeshStandardMaterial({color:0x61e2b5,roughness:.35,metalness:.3});
   this.swingMaterial=new THREE.MeshStandardMaterial({color:0xefb873,roughness:.35,metalness:.3});
   this.linkMaterial=new THREE.MeshStandardMaterial({color:0x8faec2,metalness:.62,roughness:.33});
   this.bodyMat=new THREE.MeshStandardMaterial({color:0x344f63,metalness:.48,roughness:.4});
   this.jointMaterial=new THREE.MeshStandardMaterial({color:0x5fd2dc,metalness:.54,roughness:.26});
   this.motorMaterial=new THREE.MeshStandardMaterial({color:0x58a8b4,metalness:.52,roughness:.36});
   this.trans=new TransformControls(this.camera,this.renderer.domElement);this.trans.setMode('translate');this.trans.showY=true;
   this.trans.addEventListener('change',invalidate);
   this.trans.addEventListener('dragging-changed',e=>this.controls.enabled=!e.value&&!this.marqueeEnabled);
   this.trans.addEventListener('objectChange',()=>{
     let o=this.trans.object;
     if(o===this.multiPivot){
       const delta=o.position.clone().sub(this.lastPivot);
       if(delta.lengthSq()<1e-10)return;
       const changes=[];
       for(const uid of this.selectedIds){const obj=this.partObjects.get(uid);if(!obj)continue;obj.position.add(delta);changes.push({uid,x:obj.position.x,y:obj.position.y,z:obj.position.z});}
       this.lastPivot.copy(o.position);
       this.selected(null,null,null,{kind:'multi-move',changes});
     }else if(o?.userData.uid){this.selected(o.userData.uid,[o.position.x,o.position.y,o.position.z],o.rotation.y*180/Math.PI,{kind:'move'});}
   });
   this.scene.add(this.trans.getHelper());
   this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();
   this.selectedIds=[];this.selectionBoxes=[];this.marqueeEnabled=false;this.marqueeNode=document.getElementById('marqueeBox');
   this.multiPivot=new THREE.Group();this.scene.add(this.multiPivot);this.lastPivot=new THREE.Vector3();
   this.renderer.domElement.addEventListener('pointerdown',e=>{
     if(e.button!==0)return;
     if(this.marqueeEnabled){
       e.preventDefault();const r=this.renderer.domElement.getBoundingClientRect();
       this.dragStart={x:e.clientX-r.left,y:e.clientY-r.top,shift:e.shiftKey};
       this.marqueeNode.hidden=false;this.updateMarquee(this.dragStart.x,this.dragStart.y,this.dragStart.x,this.dragStart.y);
       this.renderer.domElement.setPointerCapture(e.pointerId);return;
     }
     const uid=this.pickPart(e.clientX,e.clientY);
     if(uid)this.selected(uid,null,null,{kind:'pick',additive:e.shiftKey});
     else if(!e.shiftKey&&!this.trans.dragging)this.selected(null,null,null,{kind:'clear'});
   });
   this.renderer.domElement.addEventListener('pointermove',e=>{
     if(!this.dragStart)return;
     const r=this.renderer.domElement.getBoundingClientRect();
     this.updateMarquee(this.dragStart.x,this.dragStart.y,e.clientX-r.left,e.clientY-r.top);
   });
   this.renderer.domElement.addEventListener('pointerup',e=>{
     if(!this.dragStart)return;
     const start=this.dragStart;this.dragStart=null;this.marqueeNode.hidden=true;
     const r=this.renderer.domElement.getBoundingClientRect();
     const end={x:e.clientX-r.left,y:e.clientY-r.top};
     const minx=Math.min(start.x,end.x),maxx=Math.max(start.x,end.x),miny=Math.min(start.y,end.y),maxy=Math.max(start.y,end.y);
     let uids=[];
     if(maxx-minx<5&&maxy-miny<5){const id=this.pickPart(e.clientX,e.clientY);if(id)uids=[id];}
     else for(const [uid,obj] of this.partObjects){
       const bb=new THREE.Box3().setFromObject(obj);
       if(bb.isEmpty())continue;
       // Project all 8 corners so large items partially overlapping the box can be selected.
       let ox=Infinity,oy=Infinity,px=-Infinity,py=-Infinity;
       for(const x of [bb.min.x,bb.max.x])for(const y of [bb.min.y,bb.max.y])for(const z of [bb.min.z,bb.max.z]){
         const ndc=new THREE.Vector3(x,y,z).project(this.camera);
         if(ndc.z>1||ndc.z< -1)continue;
         const sx=(ndc.x+1)*r.width/2,sy=(1-ndc.y)*r.height/2;
         ox=Math.min(ox,sx);px=Math.max(px,sx);oy=Math.min(oy,sy);py=Math.max(py,sy);
       }
       if(ox<=maxx&&px>=minx&&oy<=maxy&&py>=miny)uids.push(uid);
     }
     this.selected(null,null,null,{kind:'marquee',uids,additive:start.shift});
   });
   this.renderer.domElement.addEventListener('pointercancel',()=>{this.dragStart=null;this.marqueeNode.hidden=true});
   this.partObjects=new Map();this.stl=null;this.stlBounds=null;this.rebuildRobot({geometry:{bodyL:430,bodyW:270,bodyH:275}});
   this.com=new THREE.Mesh(new THREE.SphereGeometry(13,12,8),new THREE.MeshBasicMaterial({color:0xffbe70}));this.scene.add(this.com);
   const supportGeometry=new THREE.BufferGeometry();
   supportGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(12),3));
   supportGeometry.setDrawRange(0,0);
   this.supportShape=new THREE.LineLoop(supportGeometry,new THREE.LineBasicMaterial({color:0x78df9e,linewidth:2}));this.scene.add(this.supportShape);
   this.supportShape.frustumCulled=false;
   this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);
 }
 setHost(host){this.resizeObserver.unobserve(this.host);this.host=host;host.appendChild(this.renderer.domElement);this.resizeObserver.observe(host);this.resize();this.invalidate();}
 setMarquee(active){this.marqueeEnabled=active;this.controls.enabled=!active;this.trans.enabled=!active;this.renderer.domElement.parentElement.classList.toggle('marquee-mode',active);this.marqueeNode.hidden=true;this.dragStart=null;}
 updateMarquee(x1,y1,x2,y2){Object.assign(this.marqueeNode.style,{left:Math.min(x1,x2)+'px',top:Math.min(y1,y2)+'px',width:Math.abs(x2-x1)+'px',height:Math.abs(y2-y1)+'px'});}
 pickPart(clientX,clientY){const r=this.renderer.domElement.getBoundingClientRect();this.pointer.set(((clientX-r.left)/r.width)*2-1,-((clientY-r.top)/r.height)*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);
   const hits=this.raycaster.intersectObjects([...this.partObjects.values()],true);
   for(const hit of hits){let o=hit.object;while(o&&!o.userData.uid)o=o.parent;if(o?.userData.uid)return o.userData.uid;}return null;
 }
 setSelection(uids){this.selectedIds=uids.filter(uid=>this.partObjects.has(uid));for(const box of this.selectionBoxes){this.scene.remove(box);disposeObject(box);}this.selectionBoxes=[];this.invalidate();
   for(const uid of this.selectedIds){const obj=this.partObjects.get(uid);const b=new THREE.BoxHelper(obj,0x5affdf);this.scene.add(b);this.selectionBoxes.push(b)}
   if(this.marqueeEnabled||!this.trans.enabled){this.trans.detach();return;}
   if(this.selectedIds.length===1)this.attach(this.selectedIds[0]);
   else if(this.selectedIds.length>1){const center=new THREE.Vector3();for(const uid of this.selectedIds)center.add(this.partObjects.get(uid).position);center.multiplyScalar(1/this.selectedIds.length);
     this.multiPivot.position.copy(center);this.lastPivot.copy(center);this.trans.attach(this.multiPivot);this.trans.setTranslationSnap(1);
   }else this.trans.detach();
 }
 updateSelectionBoxes(){this.selectionBoxes.forEach(b=>b.update());}
 applyAppearance(appearance){if(!appearance)return;
   this.invalidate();
   const hex=v=>/^#[0-9a-f]{6}$/i.test(v||'');
   if(hex(appearance.body))this.bodyMat.color.set(appearance.body);
   if(hex(appearance.links))this.linkMaterial.color.set(appearance.links);
   if(hex(appearance.joints))this.jointMaterial.color.set(appearance.joints);
   if(hex(appearance.motors))this.motorMaterial.color.set(appearance.motors);
   if(hex(appearance.stl)&&this.stl)this.stl.material.color.set(appearance.stl);
 }
 resize(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);this.invalidate();}
 makeBall(radius,mat,parent){let m=new THREE.Mesh(new THREE.SphereGeometry(radius,16,12),mat);parent.add(m);return m;}
 rebuildRobot(state){
  const g=state.geometry;
  // Link lengths are controlled by transforms, so editing dimensions does
  // not require recreating all four legs and their GPU resources.
  if(this.body){
   if(this.bodyL!==g.bodyL||this.bodyW!==g.bodyW){
    this.body.geometry.dispose();this.body.geometry=new THREE.BoxGeometry(g.bodyL,80,g.bodyW);
    this.bodyEdge.geometry.dispose();this.bodyEdge.geometry=new THREE.EdgesGeometry(this.body.geometry);
   }
   this.bodyL=g.bodyL;this.bodyW=g.bodyW;
   this.body.position.y=g.bodyH;this.bodyEdge.position.copy(this.body.position);this.invalidate();return;
  }
  this.legs=[];this.bodyL=g.bodyL;this.bodyW=g.bodyW;
  this.body=new THREE.Mesh(new THREE.BoxGeometry(g.bodyL,80,g.bodyW),this.bodyMat);this.body.position.y=g.bodyH;this.robot.add(this.body);
  const edge=new THREE.LineSegments(new THREE.EdgesGeometry(this.body.geometry),new THREE.LineBasicMaterial({color:0x74bfce,transparent:true,opacity:.75}));edge.position.copy(this.body.position);this.robot.add(edge);
  this.bodyEdge=edge;
  for(let i=0;i<4;i++){
   const parts=new THREE.Group();this.robot.add(parts);
   const shoulder=this.makeBall(25,this.jointMaterial,parts);
   const knee=this.makeBall(19,this.jointMaterial,parts);
   const foot=this.makeBall(16,this.stanceMaterial,parts);
   const links=[];
   for(let j=0;j<2;j++){
    const m=new THREE.Mesh(new THREE.CylinderGeometry(13+j*2,17+j*2,1,10),this.linkMaterial);parts.add(m);links.push(m);
   }
   const motorMaterial=this.motorMaterial;
   const motors=[];
   for(let j=0;j<3;j++){const motor=new THREE.Mesh(new THREE.BoxGeometry(32,28,39),motorMaterial);parts.add(motor);motors.push(motor)}
   this.legs.push({shoulder,knee,foot,links,motors});
  }
  this.invalidate();
 }
 updateRobot(state,legs,mechanics){
  for(let i=0;i<4;i++){
   const model=this.legs[i],leg=legs[i];
   model.shoulder.position.copy(leg.hip);model.knee.position.copy(leg.knee);model.foot.position.copy(leg.foot);
   const side=i%2===0?1:-1;
   model.motors[0].position.set(leg.hip.x,leg.hip.y+25,leg.hip.z+side*27);
   model.motors[1].position.set(leg.hip.x+19,leg.hip.y-20,leg.hip.z-side*20);
   model.motors[2].position.copy(leg.knee);
   model.foot.material=leg.stance?this.stanceMaterial:this.swingMaterial;
   [[leg.hip,leg.knee],[leg.knee,leg.foot]].forEach(([a,b],j)=>this.placeLink(model.links[j],a,b));
  }
  this.com.position.set(mechanics.com.x,Math.max(60,state.geometry.bodyH+70),mechanics.com.z);
  if(mechanics.polygon.length>=3){const attr=this.supportShape.geometry.getAttribute('position');
   mechanics.polygon.forEach((p,i)=>attr.setXYZ(i,p.x,3,p.z));attr.needsUpdate=true;
   this.supportShape.geometry.setDrawRange(0,mechanics.polygon.length);
   this.supportShape.visible=true;
  } else this.supportShape.visible=false;
 }
 placeLink(mesh,a,b){const diff=this.linkDirection.set(b.x-a.x,b.y-a.y,b.z-a.z);mesh.position.copy(a).addScaledVector(diff,.5);mesh.scale.y=diff.length();mesh.quaternion.setFromUnitVectors(this.upAxis,diff.normalize());}
 syncParts(state){const entries=new Map(catalog(state).map(def=>[def.id,def]));const seen=new Set();this.intersectionsDirty=true;this.invalidate();
  for(const p of state.placedParts){let def=entries.get(p.catalogId);if(!def)continue;seen.add(p.uid);let obj=this.partObjects.get(p.uid);
   const shapeKey=def.id+':'+def.dim.join(',');
   if(obj&&obj.userData.shapeKey!==shapeKey){if(this.trans.object===obj)this.trans.detach();this.attachments.remove(obj);disposeObject(obj);this.partObjects.delete(p.uid);obj=null;}
   if(!obj){obj=new THREE.Group();obj.userData.uid=p.uid;const c=def.type==='power'?0xdfb877:def.type==='servo'?0x58b1a5:0x5c90bd;
    obj.userData.shapeKey=shapeKey;
    const mat=new THREE.MeshStandardMaterial({color:c,metalness:.43,roughness:.4});
    const main=new THREE.Mesh(new THREE.BoxGeometry(...def.dim),mat);obj.add(main);
    let border=new THREE.LineSegments(new THREE.EdgesGeometry(main.geometry),new THREE.LineBasicMaterial({color:0xd3e5f0,transparent:true,opacity:.48}));obj.add(border);
    this.attachments.add(obj);this.partObjects.set(p.uid,obj);
   }
   obj.position.set(p.x,p.y,p.z);obj.rotation.y=(p.ry||0)*Math.PI/180;
   if(obj.children[0]?.material?.color)obj.children[0].material.color.set(/^#[0-9a-f]{6}$/i.test(p.color||'')?p.color:(def.type==='power'?'#dfb877':def.type==='servo'?'#58b1a5':'#5c90bd'));
  }
  for(const [id,obj] of this.partObjects){if(!seen.has(id)){if(this.trans.object===obj)this.trans.detach();this.attachments.remove(obj);disposeObject(obj);this.partObjects.delete(id)}}
 }
 attach(uid){let o=this.partObjects.get(uid);if(o){this.trans.attach(o);this.trans.setSize(.7);this.trans.setTranslationSnap(1)}else this.trans.detach()}
 focus(uid){let o=this.partObjects.get(uid);if(!o)return;this.controls.target.copy(o.position);this.camera.position.copy(o.position).add(new THREE.Vector3(270,230,320));this.controls.update();this.attach(uid)}
 setView(v){if(v==='iso'){this.camera.position.set(900,700,1050);this.controls.target.set(0,130,0)}if(v==='top'){this.camera.position.set(0,1300,10);this.controls.target.set(0,0,0)}if(v==='side'){this.camera.position.set(1050,370,0);this.controls.target.set(0,170,0)}this.controls.update()}
 loadSTL(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>{try{let geo=new STLLoader().parse(reader.result);geo.computeVertexNormals();geo.computeBoundingBox();let bounds=geo.boundingBox;const size=new THREE.Vector3();bounds.getSize(size);
      this.clearSTL();
      geo.translate(-(bounds.min.x+bounds.max.x)/2,-bounds.min.y,-(bounds.min.z+bounds.max.z)/2);
      this.stl=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0xe5a66b,transparent:true,opacity:.8,metalness:.25,roughness:.53,side:THREE.DoubleSide}));
      this.stl.position.set(0,330,0);this.attachments.add(this.stl);this.stlBounds=size;
      this.invalidate();
      resolve(size);
    }catch(e){reject(e)}};reader.onerror=()=>reject(Error('파일 읽기 실패'));reader.readAsArrayBuffer(file)})}
 clearSTL(){if(this.stl){this.attachments.remove(this.stl);disposeObject(this.stl);this.stl=null;this.stlBounds=null;this.invalidate();}}
 checkIntersections(state){if(!this.intersectionsDirty&&this.intersectionCache)return this.intersectionCache;const defs=new Map(catalog(state).map(d=>[d.id,d]));const out=[];const parts=state.placedParts.map(p=>({...p,def:defs.get(p.catalogId)})).filter(x=>x.def);
  for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){let a=parts[i],b=parts[j];if(Math.abs(a.x-b.x)<(a.def.dim[0]+b.def.dim[0])*.5&&Math.abs(a.y-b.y)<(a.def.dim[1]+b.def.dim[1])*.5&&Math.abs(a.z-b.z)<(a.def.dim[2]+b.def.dim[2])*.5)out.push(`${a.def.name} ↔ ${b.def.name}`)}this.intersectionsDirty=false;this.intersectionCache=out;return out;
 }
 render(){this.updateSelectionBoxes();this.controls.update();this.renderer.render(this.scene,this.camera)}
}
