(function(){
'use strict';
var clamp=function(x,a,b){a=a===undefined?0:a;b=b===undefined?1:b;return Math.min(b,Math.max(a,x));};
var sm=function(x){x=clamp(x);return x*x*(3-2*x);};
var lerp=function(a,b,t){return a+(b-a)*t;};
var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
var html=document.documentElement;
html.classList.add('locked');

var glOK=true,renderer,scene,camera;
try{
  renderer=new THREE.WebGLRenderer({canvas:document.getElementById('gl'),antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.outputEncoding=THREE.sRGBEncoding;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.15;
  renderer.setClearColor(0x000000,0);
  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(35,1,0.1,100);
}catch(e){glOK=false;}

if(glOK){
  /* studio environment: dark room with soft boxes, for perfume-ad highlights */
  var envScene=new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(20,32,16),new THREE.MeshBasicMaterial({side:THREE.BackSide,color:0x1a0e12})));
  var softbox=function(c,i,pos,s){
    var m=new THREE.Mesh(new THREE.PlaneGeometry(s[0],s[1]),new THREE.MeshBasicMaterial({color:new THREE.Color(c).multiplyScalar(i),side:THREE.DoubleSide}));
    m.position.set(pos[0],pos[1],pos[2]);m.lookAt(0,0,0);envScene.add(m);
  };
  softbox(0xfff1e6,6,[6,6,6],[6,8]);softbox(0xffc9d4,3,[-8,2,4],[4,10]);softbox(0xffffff,2,[0,10,-4],[10,4]);softbox(0xffd7b8,2,[0,-6,6],[8,2]);
  var pm=new THREE.PMREMGenerator(renderer);
  scene.environment=pm.fromScene(envScene,0.04).texture;

  scene.add(new THREE.HemisphereLight(0xffe9ee,0x1a0a10,0.35));
  var key=new THREE.DirectionalLight(0xfff0e6,2.0);key.position.set(3,5,4);scene.add(key);
  var rim=new THREE.DirectionalLight(0xffb3c4,2.6);rim.position.set(-4,2,-3);scene.add(rim);
  var glow=new THREE.PointLight(0xff9aa8,0.0,12,2);glow.position.set(0,0.4,2);scene.add(glow);
}

/* ---------- procedural petals ---------- */
var geoCache={};
function petalGeo(w,l,o,c1,c2){
  var k=[w,l,JSON.stringify(o),c1,c2].join('|');
  if(geoCache[k])return geoCache[k];
  var g=new THREE.PlaneGeometry(1,1,14,20),p=g.attributes.position,col=new Float32Array(p.count*3);
  var A=new THREE.Color(c1),B=new THREE.Color(c2),t=new THREE.Color();
  var round=o.round!==undefined?o.round:0.55,shape=o.shape!==undefined?o.shape:0.75,cup=o.cup!==undefined?o.cup:0.3,lean=o.lean!==undefined?o.lean:0.25,notch=o.notch||0;
  for(var i=0;i<p.count;i++){
    var s=p.getX(i)*2,v=p.getY(i)+0.5;
    var prof=Math.pow(Math.max(0,Math.sin(Math.PI*Math.pow(v,shape))),round);
    var X=s*0.5*w*prof;
    var Y=v*l-notch*l*Math.exp(-Math.pow(s*3.2,2))*Math.pow(v,8);
    var edge=Math.pow(Math.abs(s),1.6);
    var ripple=0.025*w*Math.sin(v*19+s*3)*edge*prof;
    var vein=0.025*w*Math.exp(-Math.pow(s*9,2))*Math.sin(Math.PI*v);
    var Z=-cup*w*s*s*0.5*prof+lean*l*v*v+ripple+vein;
    p.setXYZ(i,X,Y,Z);
    t.copy(A).lerp(B,Math.pow(v,0.9));
    t.multiplyScalar(0.9+0.12*edge-0.07*Math.exp(-Math.pow(s*9,2))*Math.sin(Math.PI*v));
    col[i*3]=t.r;col[i*3+1]=t.g;col[i*3+2]=t.b;
  }
  g.setAttribute('color',new THREE.BufferAttribute(col,3));
  g.computeVertexNormals();
  geoCache[k]=g;
  return g;
}

function discTexture(base,dot,n){
  var c=document.createElement('canvas');c.width=c.height=256;
  var x=c.getContext('2d');x.fillStyle=base;x.fillRect(0,0,256,256);
  var ga=Math.PI*(3-Math.sqrt(5));
  for(var i=0;i<n;i++){
    var r=Math.sqrt(i/n)*124,a=i*ga;
    x.fillStyle=dot;x.globalAlpha=0.35+0.5*(i%3)/2;
    x.beginPath();x.arc(128+Math.cos(a)*r,128+Math.sin(a)*r,2+r/60,0,6.283);x.fill();
  }
  var tex=new THREE.CanvasTexture(c);tex.encoding=THREE.sRGBEncoding;return tex;
}

function makeFlower(cfg){
  var root=new THREE.Group();
  root.userData.petals=[];
  var mat=new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:cfg.rough!==undefined?cfg.rough:0.44,sheen:1,sheenColor:new THREE.Color(cfg.sheen||0xffd6dd),sheenRoughness:0.28,clearcoat:cfg.coat!==undefined?cfg.coat:0.3,clearcoatRoughness:0.32,side:THREE.DoubleSide});
  cfg.layers.forEach(function(L,li){
    var geo=petalGeo(L.w,L.l,cfg.shape||{},cfg.c1,cfg.c2);
    for(var k=0;k<L.n;k++){
      var pivot=new THREE.Group();
      pivot.rotation.y=(k/L.n)*Math.PI*2+li*(L.twist!==undefined?L.twist:0.7)+(Math.random()-0.5)*0.12;
      pivot.position.y=L.y||0;
      var m=new THREE.Mesh(geo,mat);pivot.add(m);root.add(pivot);
      root.userData.petals.push({m:m,L:L,li:li,rand:Math.random()});
    }
  });
  if(cfg.center){
    var c=cfg.center,cm;
    if(c.type==='disc'){
      cm=new THREE.Mesh(new THREE.CylinderGeometry(c.r,c.r*0.92,c.h,48),new THREE.MeshStandardMaterial({map:discTexture(c.base,c.dot,c.n||400),roughness:0.8}));
      cm.position.y=c.y||0.05;
    }else{
      cm=new THREE.Group();
      var sm1=new THREE.MeshStandardMaterial({color:c.stem,roughness:0.6}),sm2=new THREE.MeshStandardMaterial({color:c.tip,roughness:0.5});
      for(var j=0;j<16;j++){
        var a=j/16*Math.PI*2+Math.random(),tl=0.1+Math.random()*0.25;
        var h=new THREE.Group();h.rotation.y=a;
        var st=new THREE.Mesh(new THREE.CylinderGeometry(0.006,0.006,0.5,5),sm1);st.position.y=0.25;
        var arm=new THREE.Group();arm.rotation.x=tl;arm.add(st);
        var tip=new THREE.Mesh(new THREE.SphereGeometry(0.028,8,8),sm2);tip.position.y=0.5;arm.add(tip);
        h.add(arm);cm.add(h);
      }
    }
    root.add(cm);root.userData.center=cm;
  }
  return root;
}

function setBloom(root,b){
  var P=root.userData.petals;
  for(var i=0;i<P.length;i++){
    var q=P[i],d=q.li*0.09+q.rand*0.06;
    var t=sm((b-d)/0.65);
    q.m.rotation.x=lerp(q.L.closed,q.L.open,t);
    q.m.scale.setScalar(Math.max(0.001,sm(b*1.6-d*1.2)));
  }
  if(root.userData.center)root.userData.center.scale.setScalar(Math.max(0.001,sm(b*2-0.2)));
}

/* ---------- flower recipes ---------- */
function roseCfg(c1,c2,sheen){
  return {c1:c1,c2:c2,sheen:sheen||0xff8a9c,shape:{round:0.55,cup:0.4,lean:0.35},layers:[
    {n:3,w:0.55,l:0.8,closed:0.05,open:0.2,y:0,twist:0.5},
    {n:5,w:0.8,l:1.0,closed:0.12,open:0.5,y:0,twist:0.9},
    {n:6,w:1.0,l:1.15,closed:0.22,open:0.8,y:0.03},
    {n:8,w:1.2,l:1.25,closed:0.3,open:1.1,y:0.05},
    {n:10,w:1.35,l:1.3,closed:0.4,open:1.4,y:0.08}]};
}
function peonyCfg(c1,c2){
  return {c1:c1,c2:c2,sheen:0xfff1e8,rough:0.6,shape:{round:0.5,cup:0.55,lean:0.45},layers:[
    {n:5,w:0.8,l:0.8,closed:0.1,open:0.25,y:0,twist:0.4},
    {n:7,w:1.05,l:1.0,closed:0.2,open:0.6,y:0.02},
    {n:9,w:1.3,l:1.2,closed:0.3,open:0.95,y:0.04},
    {n:11,w:1.5,l:1.35,closed:0.4,open:1.25,y:0.06}]};
}
var CFG={
  rose:roseCfg(0x3a0510,0xcf3a52),
  sun:{c1:0xc97c00,c2:0xffd23a,sheen:0xffe08a,rough:0.55,coat:0.1,shape:{round:0.9,shape:0.95,cup:0.1,lean:0.12},
    layers:[{n:21,w:0.4,l:1.15,closed:0.9,open:1.5,y:0,twist:0.15},{n:21,w:0.4,l:1.05,closed:0.9,open:1.38,y:0.03,twist:0.15}],
    center:{type:'disc',r:0.55,h:0.16,y:0.06,base:'#2a170b',dot:'#c28a2a',n:520}},
  cherry:{c1:0xf4a9be,c2:0xfff0f4,sheen:0xffffff,rough:0.6,coat:0.1,shape:{round:0.5,cup:0.35,lean:0.2,notch:0.14},
    layers:[{n:5,w:1.1,l:1.05,closed:0.3,open:1.25,y:0,twist:0.3}],
    center:{type:'stamens',stem:0xf3b5c6,tip:0x8a1030}},
  gerb:{c1:0xff4a2e,c2:0xffb347,sheen:0xffd0a0,rough:0.45,coat:0.3,shape:{round:0.8,shape:0.85,cup:0.15,lean:0.1},
    layers:[{n:18,w:0.34,l:1.25,closed:0.8,open:1.42,y:0,twist:0.1},{n:18,w:0.34,l:1.15,closed:0.8,open:1.3,y:0.03,twist:0.3}],
    center:{type:'disc',r:0.26,h:0.1,y:0.06,base:'#3a1208',dot:'#e0a030',n:160}},
  peony:peonyCfg(0xe8cdbb,0xfffaf4)
};

var stemMat,leafGeo;
if(glOK){stemMat=new THREE.MeshStandardMaterial({color:0x294a2c,roughness:0.6});leafGeo=petalGeo(0.65,1.5,{round:0.9,shape:0.9,cup:0.3,lean:0.1},0x10281a,0x3d7040);}
function stemBetween(a,b,r){
  var d=new THREE.Vector3().subVectors(b,a);
  var m=new THREE.Mesh(new THREE.CylinderGeometry(r,r*1.25,d.length(),8),stemMat);
  m.position.copy(a).addScaledVector(d,0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize());
  return m;
}

window.__A={clamp:clamp,sm:sm,lerp:lerp,reduce:reduce,glOK:glOK,renderer:renderer,scene:scene,camera:camera,makeFlower:makeFlower,setBloom:setBloom,CFG:CFG,roseCfg:roseCfg,peonyCfg:peonyCfg,petalGeo:petalGeo,stemBetween:stemBetween,leafGeo:leafGeo,glow:glow,discTexture:discTexture};
})();
(function(){
'use strict';
var A=window.__A,clamp=A.clamp,sm=A.sm,lerp=A.lerp,reduce=A.reduce,glOK=A.glOK;
var html=document.documentElement;
var bgEl=document.getElementById('bg'),navEl=document.getElementById('nav'),barEl=document.getElementById('bar');
var hint=document.getElementById('hint'),rail=document.getElementById('rail'),railItems=[].slice.call(rail.children);
var beats=[].slice.call(document.querySelectorAll('.beat')).map(function(el){return {el:el,r:el.dataset.r.split(' ').map(Number)};});
var track=document.getElementById('track');

/* ---------- scroll progress ---------- */
var p=0,ps=0;
function readScroll(){
  var max=track.offsetHeight-window.innerHeight;
  p=clamp(window.scrollY/Math.max(1,max));
  var total=document.documentElement.scrollHeight-window.innerHeight;
  barEl.style.transform='scaleX('+clamp(window.scrollY/Math.max(1,total))+')';
}
window.addEventListener('scroll',readScroll,{passive:true});

/* ---------- background keyframes ---------- */
function hex(h){return [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];}
var bgKeys=[[0,'#000000','#000000'],[0.1,'#050203','#2a1210'],[0.3,'#12060a','#6b1224'],[0.45,'#160810','#7a2a3c'],[0.6,'#0f0708','#401820'],
  [0.665,'#1d0a10','#8c1830'],[0.72,'#201706','#a87a10'],[0.78,'#210f19','#b35c80'],[0.84,'#240e07','#c4552a'],[0.9,'#1b1814','#8a7a68'],[0.97,'#0b0809','#1a1012'],[1,'#0b0809','#0b0809']];
function paintBg(v){
  var i=0;while(i<bgKeys.length-2&&v>bgKeys[i+1][0])i++;
  var a=bgKeys[i],b=bgKeys[i+1],t=clamp((v-a[0])/(b[0]-a[0]));
  var mix=function(x,y){var u=hex(x),w=hex(y);return 'rgb('+[0,1,2].map(function(k){return Math.round(lerp(u[k],w[k],t));}).join(',')+')';};
  bgEl.style.background='radial-gradient(65% 65% at 50% 52%,'+mix(a[2],b[2])+' 0%,transparent 70%),'+mix(a[1],b[1]);
}

/* ---------- 3D objects ---------- */
var S,camera,renderer,scene;
var seed,seedHalo,rose,bouquet,flowersB=[],bouquetMeshes=[],swarm,occ=[],pollen;
var NOCC=5,occStart=[0.665,0.723,0.781,0.839,0.897];
var NP=520,O=[],E=[],B=[],spin=[],dummy;
if(glOK){
  renderer=A.renderer;scene=A.scene;camera=A.camera;
  var rad=function(){var c=document.createElement('canvas');c.width=c.height=128;var x=c.getContext('2d');var g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,230,200,1)');g.addColorStop(0.25,'rgba(255,190,170,.45)');g.addColorStop(1,'rgba(255,170,160,0)');x.fillStyle=g;x.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);};
  var haloTex=rad();

  /* seed */
  seed=new THREE.Group();
  var seedMesh=new THREE.Mesh(new THREE.SphereGeometry(0.2,32,24),new THREE.MeshPhysicalMaterial({color:0x6b4423,roughness:0.35,clearcoat:1,clearcoatRoughness:0.2,sheen:1,sheenColor:new THREE.Color(0xffc080)}));
  seedMesh.scale.set(0.7,1,0.7);seed.add(seedMesh);
  seedHalo=new THREE.Sprite(new THREE.SpriteMaterial({map:haloTex,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:0.8}));
  seedHalo.scale.set(2.2,2.2,1);seed.add(seedHalo);
  scene.add(seed);

  /* hero rose */
  rose=new THREE.Group();
  var rf=A.makeFlower(A.CFG.rose);rf.scale.setScalar(0.85);rose.add(rf);rose.userData.f=rf;rose.position.y=-0.55;
  scene.add(rose);A.setBloom(rf,0);

  /* bouquet */
  bouquet=new THREE.Group();
  var pals=[[0x3a0510,0xcf3a52,0],[0x7a1230,0xe0607a,0],[0xd98aa0,0xfde6ea,0],[0xe8cdbb,0xfffaf4,1],[0xb3203a,0xf0788a,0],[0xe8cdbb,0xfffaf4,1]];
  var NB=11,ga=Math.PI*(3-Math.sqrt(5)),R=1.7,base=new THREE.Vector3(0,-2.6,0);
  var up=new THREE.Vector3(0,1,0);
  for(var i=0;i<NB;i++){
    var t=(i+0.5)/NB,th=Math.acos(1-t*0.78),ph=i*ga;
    var n=new THREE.Vector3(Math.sin(th)*Math.cos(ph),Math.cos(th),Math.sin(th)*Math.sin(ph));
    var pos=n.clone().multiplyScalar(R);
    var pl=pals[i%pals.length];
    var f=A.makeFlower(pl[2]?A.peonyCfg(pl[0],pl[1]):A.roseCfg(pl[0],pl[1]));
    var holder=new THREE.Group();holder.position.copy(pos);holder.quaternion.setFromUnitVectors(up,n);
    var sc=0.5+Math.random()*0.1;f.scale.setScalar(sc);holder.add(f);holder.userData={f:f,base:sc,hover:1};
    bouquet.add(holder);bouquet.add(A.stemBetween(pos,base,0.035));
    f.userData.holder=holder;flowersB.push(holder);
    f.userData.petals.forEach(function(q){bouquetMeshes.push(q.m);});
  }
  for(var j=0;j<14;j++){
    var tt=(j+0.3)/14,th2=Math.acos(1-tt*0.9)*1.0+0.15,ph2=j*ga*1.3;
    var n2=new THREE.Vector3(Math.sin(th2)*Math.cos(ph2),Math.cos(th2),Math.sin(th2)*Math.sin(ph2));
    var leaf=new THREE.Mesh(A.leafGeo,new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:0.55}));
    var h2=new THREE.Group();h2.position.copy(n2.clone().multiplyScalar(R*0.82));h2.quaternion.setFromUnitVectors(up,n2);
    leaf.rotation.x=0.5;h2.add(leaf);bouquet.add(h2);
  }
  var paper=new THREE.MeshStandardMaterial({color:0xefe2d4,roughness:0.85,side:THREE.DoubleSide});
  var cone=new THREE.Mesh(new THREE.CylinderGeometry(1.35,0.14,2.3,48,1,true),paper);cone.position.y=-1.45;bouquet.add(cone);
  var cone2=new THREE.Mesh(new THREE.CylinderGeometry(1.2,0.16,2.0,48,1,true),new THREE.MeshStandardMaterial({color:0xd98aa0,roughness:0.8,side:THREE.DoubleSide}));cone2.position.y=-1.5;bouquet.add(cone2);
  var ribbon=new THREE.Mesh(new THREE.TorusGeometry(0.34,0.05,12,40),new THREE.MeshPhysicalMaterial({color:0xe9b7bf,roughness:0.3,clearcoat:1}));ribbon.rotation.x=Math.PI/2;ribbon.position.y=-2.15;bouquet.add(ribbon);
  scene.add(bouquet);bouquet.scale.setScalar(0.0001);

  /* petal swarm */
  var pg=A.petalGeo(0.3,0.42,{round:0.6,cup:0.5,lean:0.5},0xffffff,0xffffff);
  swarm=new THREE.InstancedMesh(pg,new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:0.5,sheen:1,sheenColor:new THREE.Color(0xffc0cc),side:THREE.DoubleSide}),NP);
  var cols=[0xb3203a,0xe0607a,0xf4b6c2,0xfff0ea,0x8c1830],cc=new THREE.Color();
  dummy=new THREE.Object3D();
  for(var k=0;k<NP;k++){
    O.push(new THREE.Vector3((Math.random()-0.5)*0.4,0.1+(Math.random()-0.5)*0.3,(Math.random()-0.5)*0.4));
    var u=Math.random()*2-1,a=Math.random()*Math.PI*2,r=2.2+Math.random()*4.6,s2=Math.sqrt(1-u*u);
    E.push(new THREE.Vector3(Math.cos(a)*s2*r*1.5,u*r*0.9,Math.sin(a)*s2*r*0.9));
    var tb=Math.random(),thb=Math.acos(1-tb*0.85),phb=Math.random()*Math.PI*2,rb=R*(0.95+Math.random()*0.25);
    B.push(new THREE.Vector3(Math.sin(thb)*Math.cos(phb)*rb,Math.cos(thb)*rb,Math.sin(thb)*Math.sin(phb)*rb));
    spin.push([Math.random()*6,Math.random()*6,Math.random()*6,0.4+Math.random()*1.2]);
    swarm.setColorAt(k,cc.setHex(cols[k%cols.length]));
  }
  swarm.instanceColor.needsUpdate=true;swarm.frustumCulled=false;swarm.visible=false;
  scene.add(swarm);

  /* occasion flowers */
  var order=['rose','sun','cherry','gerb','peony'];
  order.forEach(function(key,idx){
    var cfg=idx===0?A.roseCfg(0x5a0a18,0xe04a62):A.CFG[key];
    var fl=A.makeFlower(cfg),holder=new THREE.Group(),tilt=new THREE.Group();
    tilt.add(fl);tilt.rotation.x=1.05;holder.add(tilt);holder.visible=false;
    holder.userData={f:fl,tilt:tilt};scene.add(holder);occ.push(holder);A.setBloom(fl,0);
  });

  /* pollen */
  var NPO=360,pp=new Float32Array(NPO*3),ps0=[];
  for(var q=0;q<NPO;q++){pp[q*3]=(Math.random()-0.5)*18;pp[q*3+1]=(Math.random()-0.5)*11;pp[q*3+2]=(Math.random()-0.5)*9;ps0.push(Math.random()*6.28);}
  var pgm=new THREE.BufferGeometry();pgm.setAttribute('position',new THREE.BufferAttribute(pp,3));
  pollen=new THREE.Points(pgm,new THREE.PointsMaterial({size:0.12,map:haloTex,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,sizeAttenuation:true}));
  pollen.userData.ph=ps0;scene.add(pollen);
}

/* ---------- size & nav mark placement ---------- */
var W=1,H=1,aspect=1,D=9.5,navPos=glOK?new THREE.Vector3():null,bs=1;
var NAVS=0.075;
function resize(){
  W=window.innerWidth;H=window.innerHeight;aspect=W/H;
  if(!glOK)return;
  renderer.setSize(W,H,false);camera.aspect=aspect;camera.updateProjectionMatrix();
  var halfH=Math.tan(camera.fov*Math.PI/360)*D,wpp=2*halfH/H;
  navPos.set((38-W/2)*wpp,(H/2-38)*wpp+0.35*NAVS,0);
  bs=clamp(aspect*6*0.85/4.4,0.45,1);
}
window.addEventListener('resize',resize);resize();

/* ---------- pointer ---------- */
var mouse={x:0,y:0},ndc=glOK?new THREE.Vector2():null,hoverFrame=0;
window.addEventListener('pointermove',function(e){mouse.x=(e.clientX/W-0.5)*2;mouse.y=(e.clientY/H-0.5)*2;if(ndc)ndc.set(mouse.x,-mouse.y);},{passive:true});
var ray=glOK?new THREE.Raycaster():null,hovered=null;

/* ---------- audio ---------- */
var actx=null,master=null,soundOn=false,bellTimer=null,sndBtn=document.getElementById('snd');
function startAudio(){
  try{
    actx=new (window.AudioContext||window.webkitAudioContext)();
    master=actx.createGain();master.gain.value=0;
    var lp=actx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1100;
    master.connect(lp);lp.connect(actx.destination);
    var echo=actx.createDelay(1.5);echo.delayTime.value=0.42;var fb=actx.createGain();fb.gain.value=0.45;echo.connect(fb);fb.connect(echo);echo.connect(master);
    [196,246.94,293.66,369.99,98].forEach(function(f,i){
      [-6,6].forEach(function(dt){
        var o=actx.createOscillator();o.type=i===4?'sine':'triangle';o.frequency.value=f;o.detune.value=dt;
        var g=actx.createGain();g.gain.value=i===4?0.07:0.028;
        var l=actx.createOscillator();l.frequency.value=0.05+i*0.017;var lg=actx.createGain();lg.gain.value=0.014;l.connect(lg);lg.connect(g.gain);l.start();
        o.connect(g);g.connect(master);o.start();
      });
    });
    var notes=[392,493.88,587.33,739.99,880,987.77];
    bellTimer=setInterval(function(){
      if(!soundOn||!actx)return;
      var f=notes[Math.floor(Math.random()*notes.length)],o=actx.createOscillator(),g=actx.createGain(),n=actx.currentTime;
      o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(0,n);g.gain.linearRampToValueAtTime(0.06,n+0.02);g.gain.exponentialRampToValueAtTime(0.0005,n+3.2);
      o.connect(g);g.connect(master);g.connect(echo);o.start(n);o.stop(n+3.4);
    },3600);
    soundOn=true;master.gain.linearRampToValueAtTime(0.9,actx.currentTime+7);
    sndBtn.style.display='block';sndBtn.textContent='Sound on';sndBtn.setAttribute('aria-pressed','true');
  }catch(e){soundOn=false;}
}
sndBtn.addEventListener('click',function(){
  if(!actx)return;soundOn=!soundOn;
  master.gain.cancelScheduledValues(actx.currentTime);
  master.gain.linearRampToValueAtTime(soundOn?0.9:0,actx.currentTime+1.2);
  sndBtn.textContent=soundOn?'Sound on':'Sound off';sndBtn.setAttribute('aria-pressed',String(soundOn));
});

/* ---------- gate ---------- */
var tBegin=-1,started=false,clock0=performance.now();
function begin(withSound){
  if(started)return;started=true;
  document.getElementById('gate').classList.add('gone');
  html.classList.remove('locked');
  tBegin=(performance.now()-clock0)/1000;
  if(withSound)startAudio();
  readScroll();
}
document.getElementById('go-sound').addEventListener('click',function(){begin(true);});
document.getElementById('go-quiet').addEventListener('click',function(){begin(false);});

/* ripple on buttons */
document.addEventListener('pointerdown',function(e){
  var b=e.target.closest&&e.target.closest('.btn');if(!b)return;
  var r=b.getBoundingClientRect(),d=Math.max(r.width,r.height),s=document.createElement('span');
  s.className='rip';s.style.cssText='width:'+d+'px;height:'+d+'px;left:'+(e.clientX-r.left-d/2)+'px;top:'+(e.clientY-r.top-d/2)+'px';
  b.appendChild(s);setTimeout(function(){s.remove();},700);
});

window.__B={get ps(){return ps;},set p(v){p=v;},state:function(){return {p:p,ps:ps};}};

/* ---------- frame ---------- */
var lastT=0;
function frame(now){
  requestAnimationFrame(frame);
  var time=(now-clock0)/1000,dt=Math.min(0.05,time-lastT);lastT=time;
  readScrollIfNeeded();
  ps+= (p-ps)*(reduce?1:Math.min(1,dt*4.2));
  var v=ps;

  /* text beats */
  for(var i=0;i<beats.length;i++){
    var r=beats[i].r,fi=sm((v-r[0])/(r[1]-r[0])),fo=sm((v-r[2])/(r[3]-r[2])),o=fi*(1-fo),el=beats[i].el;
    el.style.opacity=o.toFixed(3);el.style.visibility=o>0.01?'visible':'hidden';
    el.style.transform='translateY('+((1-fi)*30-fo*30).toFixed(1)+'px)';
  }
  hint.style.opacity=started?String(1-sm(v/0.03)):'0';
  var ro=sm((v-0.64)/0.02)*(1-sm((v-0.965)/0.015));rail.style.opacity=ro.toFixed(3);
  var activeOcc=-1;for(var k=0;k<NOCC;k++){if(v>=occStart[k]&&v<occStart[k]+0.058)activeOcc=k;}
  railItems.forEach(function(el,idx){el.classList.toggle('on',idx===activeOcc);});
  var navO=sm((v-0.6)/0.05);navEl.style.opacity=navO.toFixed(3);navEl.style.visibility=navO>0.01?'visible':'hidden';
  paintBg(v);

  if(!glOK)return;

  /* camera */
  var mNav=sm((v-0.58)/0.07);
  D=lerp(6,9.5,sm((v-0.26)/0.1));
  var ang=(time*0.1+v*2.2)*(1-mNav);
  var camY=lerp(1.0,0,mNav);
  camera.position.set(Math.sin(ang)*D+mouse.x*0.35*(1-mNav),camY-mouse.y*0.25*(1-mNav),Math.cos(ang)*D);
  camera.lookAt(0,lerp(0.3,0,mNav),0);
  if(mNav>0.999){camera.position.set(0,0,9.5);camera.lookAt(0,0,0);}

  /* seed */
  var seedIn=started?sm((time-tBegin-0.6)/3.2):0;
  var seedS=seedIn*(1-sm((v-0.1)/0.06));
  seed.visible=seedS>0.002;seed.scale.setScalar(Math.max(0.001,seedS));
  seed.position.y=Math.sin(time*0.9)*0.06;seed.rotation.y=time*0.5;
  seedHalo.material.opacity=0.55+0.25*Math.sin(time*1.6);

  /* rose */
  var roseS=sm((v-0.1)/0.06)*(1-sm((v-0.285)/0.035));
  rose.visible=roseS>0.002;rose.scale.setScalar(Math.max(0.001,roseS)*1.5);
  A.setBloom(rose.userData.f,sm((v-0.12)/0.15));
  rose.rotation.y=time*0.25;

  /* swarm */
  var e=sm((v-0.28)/0.1),a=sm((v-0.4)/0.14),sv=1-sm((v-0.53)/0.04);
  swarm.visible=v>0.28&&sv>0.003;
  if(swarm.visible){
    var bsw=bs,by=0.35*bs;
    for(var n=0;n<NP;n++){
      var sp=spin[n];
      var x=lerp(O[n].x,E[n].x,e),y=lerp(O[n].y,E[n].y,e),z=lerp(O[n].z,E[n].z,e);
      var sw=e*(1-a);
      x+=Math.sin(time*0.7+sp[0])*0.35*sw;y+=Math.cos(time*0.6+sp[1])*0.3*sw-(1-a)*Math.max(0,e-0.6)*Math.sin(time+sp[2])*0.1;z+=Math.sin(time*0.5+sp[2])*0.3*sw;
      x=lerp(x,B[n].x*bsw,a);y=lerp(y,B[n].y*bsw+by,a);z=lerp(z,B[n].z*bsw,a);
      dummy.position.set(x,y,z);
      dummy.rotation.set(sp[0]+time*sp[3]*(1-a),sp[1]+time*sp[3]*0.7*(1-a),sp[2]);
      dummy.scale.setScalar(Math.max(0.001,sm(e*4)*sv*(1-0.3*a)));
      dummy.updateMatrix();swarm.setMatrixAt(n,dummy.matrix);
    }
    swarm.instanceMatrix.needsUpdate=true;
  }

  /* bouquet */
  var bAppear=sm((v-0.52)/0.05);
  bouquet.visible=bAppear>0.002;
  if(bouquet.visible){
    var sc=lerp(bs,NAVS,mNav)*Math.max(0.001,bAppear);
    bouquet.scale.setScalar(sc);
    bouquet.position.set(lerp(0,navPos.x,mNav),lerp(0.35*bs,navPos.y,mNav),0);
    var bb=sm((v-0.52)/0.08);
    for(var f=0;f<flowersB.length;f++){
      var h=flowersB[f],ud=h.userData;
      A.setBloom(ud.f,bb);
      var target=(hovered===h?1.16:1);ud.hover+=(target-ud.hover)*Math.min(1,dt*8);
      ud.f.scale.setScalar(ud.base*ud.hover);
      ud.f.rotation.z=Math.sin(time*0.9+f)*0.05*(1-mNav);ud.f.rotation.x=Math.cos(time*0.7+f*1.3)*0.04*(1-mNav);
    }
    var tgt=mNav>0.5?time*0.35:mouse.x*0.6+Math.sin(time*0.3)*0.15;
    bouquet.rotation.y+=(tgt-bouquet.rotation.y)*Math.min(1,dt*3);
    bouquet.rotation.z=Math.sin(time*0.8)*0.025;
    hoverFrame++;
    if(hoverFrame%4===0&&mNav<0.2&&v>0.56){
      ray.setFromCamera(ndc,camera);var hit=ray.intersectObjects(bouquetMeshes,false)[0];
      hovered=hit?hit.object.parent.parent.userData.holder:null;
      if(hit){var fl=hit.object.parent.parent;hovered=fl.userData.holder||null;}
    }else if(mNav>=0.2){hovered=null;}
  }

  /* occasion flowers */
  var cx=aspect>1.15?Math.min(aspect*3.0*0.42,5.2):0,cy=aspect>1.15?0.1:1.25,fscale=aspect>1.15?1.55:1.15;
  for(var oi=0;oi<NOCC;oi++){
    var h2=occ[oi],st=occStart[oi];
    var sIn=sm((v-st)/0.02),sOut=sm((v-(st+0.046))/0.012);
    var os=sIn*(1-sOut);
    h2.visible=os>0.002;
    if(h2.visible){
      h2.scale.setScalar(Math.max(0.001,os)*fscale);
      h2.position.set(cx+mouse.x*0.2,cy-mouse.y*0.15,0);
      var tilt=h2.userData.tilt;tilt.rotation.x=1.05-mouse.y*0.18;tilt.rotation.z=Math.sin(time*0.7)*0.04+mouse.x*0.12;
      h2.userData.f.rotation.y=time*0.25+oi;
      A.setBloom(h2.userData.f,sm((v-st)/0.03));
    }
  }

  /* pollen */
  var pa=pollen.geometry.attributes.position,phs=pollen.userData.ph;
  for(var q=0;q<phs.length;q++){
    pa.array[q*3+1]+=dt*(0.08+0.05*Math.sin(phs[q]));pa.array[q*3]+=Math.sin(time*0.3+phs[q])*dt*0.08;
    if(pa.array[q*3+1]>5.5)pa.array[q*3+1]=-5.5;
  }
  pa.needsUpdate=true;
  pollen.material.opacity=(started?0.75:0)*sm((time-tBegin)/4)*(1-0.4*mNav);
  pollen.rotation.y=time*0.01;

  /* glow light */
  A.glow.intensity=lerp(0,18,clamp(roseS+bAppear*(1-mNav)));
  renderer.render(scene,camera);
}
var lastY=-1;function readScrollIfNeeded(){if(window.scrollY!==lastY){lastY=window.scrollY;readScroll();}}
readScroll();
requestAnimationFrame(frame);
})();
