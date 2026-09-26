// ══════════════════════════════════════════
//  CHAR3D — ตัวละครแรงค์ 3D สไตล์ตุ๊กตาไวนิล (Three.js r159 UMD)
//  โหลด on-demand จาก index.html (_loadChar3D) — ไม่มีไฟล์โมเดล สร้างจากรูปทรงพื้นฐาน + หน้าวาดด้วย canvas
//  MMChar3D.mount(el,{lv,gender,color}) → {destroy(),renderer} | null (ไม่มี WebGL)
//  MMChar3D.snapshot({lv,gender,color,w,h}) → dataURL พื้นใส (ใช้สร้าง assets/char3d.webp)
//  loop หยุดและ dispose เองเมื่อ canvas หลุดจาก DOM
// ══════════════════════════════════════════
(function(){
  'use strict';
  if(!window.THREE) return;
  const T=window.THREE;
  const V3=T.Vector3;

  // ชุดตามแรงค์ lv1 Iron → lv8 Legend
  const OUTFIT={
    1:{shirt:'#aab3c2',pants:'#5b6474'},
    2:{shirt:'#f0a45c',pants:'#6b4a36',scarf:'#c2410c'},
    3:{shirt:'#f8fafc',pants:'#475569',vest:'#b8c2d0',belt:'#64748b'},
    4:{shirt:'#ffffff',pants:'#334155',tie:'#f59e0b',belt:'#92400e',coin:true},
    5:{suit:'#7c3aed',pants:'#3b2a86',bowtie:'#e9d5ff',buttons:true},
    6:{suit:'#2563eb',pants:'#1e3a8a',tie:'#bfdbfe',cape:'#1d4ed8',buttons:true,brooch:'#60a5fa'},
    7:{suit:'#0e7490',pants:'#164e63',tie:'#cffafe',cape:'#06b6d4',buttons:true,gem:true},
    8:{suit:'#be185d',pants:'#4a0d2b',tie:'#fde68a',cape:'#db2777',buttons:true,crown:true,sparkle:true},
  };
  const SKIN='#ffcfb3', SHOE='#4a3448';
  const HAIR=['#7a4a33','#3d2b22'];

  function hasWebGL(){
    try{ const c=document.createElement('canvas'); return !!(c.getContext('webgl2')||c.getContext('webgl')); }catch(e){ return false; }
  }
  function mix(a,b,t){ return new T.Color(a).lerp(new T.Color(b),t); }
  function css(c){ return '#'+c.getHexString(); }

  // ── ห้องสตูดิโอจำลองสำหรับ env map (แทน RoomEnvironment ที่ไม่มีใน UMD build)
  function makeEnv(renderer){
    const env=new T.Scene();
    const room=new T.Mesh(new T.BoxGeometry(12,12,12),new T.MeshBasicMaterial({color:0x3a3548,side:T.BackSide}));
    env.add(room);
    const panel=(w,h,x,y,z,ry,rx,c)=>{ const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:c,side:T.DoubleSide})); m.position.set(x,y,z); m.rotation.set(rx||0,ry||0,0); env.add(m); return m; };
    panel(8,3,0,5.5,0,0,Math.PI/2,new T.Color(5,5,5));       // ไฟเพดาน
    panel(3,4,-5.5,1,1,Math.PI/2,0,new T.Color(2.5,2.6,3));   // softbox ซ้าย
    panel(3,4,5.5,1.5,1,-Math.PI/2,0,new T.Color(3.2,3,2.8)); // softbox ขวา
    panel(5,2,0,0.5,5.8,Math.PI,0,new T.Color(1.6,1.6,1.7));  // ด้านหน้า
    const pm=new T.PMREMGenerator(renderer);
    const rt=pm.fromScene(env,0.04);
    env.traverse(o=>{ if(o.geometry) o.geometry.dispose(); if(o.material) o.material.dispose(); });
    pm.dispose();
    return rt;
  }

  // ── หน้า: วาดตา/ปาก/แก้มลง canvas แล้วแปะเป็น decal บนครึ่งหน้า
  const FACE_W=616, FACE_H=512, PHI_LEN=1.8, TH_LEN=1.5; // พิกเซลจัตุรัสบนผิวโค้ง
  function drawFace(closed,irisHex,female,lv){
    const c=document.createElement('canvas'); c.width=FACE_W; c.height=FACE_H;
    const g=c.getContext('2d'); const cx=FACE_W/2;
    const ey=276, ex=112, rx=female?46:43, ry=female?58:54;
    const iris=new T.Color(irisHex);
    const irisTop=css(mix(iris,'#140a1c',0.62)), irisMid=css(mix(iris,'#140a1c',0.25)), irisBot=css(mix(iris,'#ffffff',0.35));
    const INK='#2a1626';
    // แก้ม
    [-1,1].forEach(s=>{
      const bx=cx+s*168, by=348;
      const rg=g.createRadialGradient(bx,by,2,bx,by,46);
      rg.addColorStop(0,'rgba(255,112,138,.55)'); rg.addColorStop(1,'rgba(255,112,138,0)');
      g.fillStyle=rg; g.beginPath(); g.ellipse(bx,by,50,32,0,0,Math.PI*2); g.fill();
      g.strokeStyle='rgba(235,90,120,.55)'; g.lineWidth=3.5; g.lineCap='round';
      for(let i=-1;i<=1;i++){ g.beginPath(); g.moveTo(bx+i*13-5,by+7); g.lineTo(bx+i*13+5,by-7); g.stroke(); }
    });
    // ตา
    [-1,1].forEach(s=>{
      const x=cx+s*ex;
      if(closed){
        g.strokeStyle=INK; g.lineWidth=11; g.lineCap='round';
        g.beginPath(); g.arc(x,ey+ry*0.45,rx*0.95,Math.PI*1.13,Math.PI*1.87); g.stroke();
        if(female){ g.lineWidth=6; g.beginPath(); g.moveTo(x+s*rx*0.82,ey+ry*0.02); g.lineTo(x+s*rx*1.15,ey-ry*0.18); g.stroke(); }
        return;
      }
      g.fillStyle=INK; g.beginPath(); g.ellipse(x,ey,rx,ry,0,0,Math.PI*2); g.fill();
      const lg=g.createLinearGradient(0,ey-ry,0,ey+ry);
      lg.addColorStop(0,irisTop); lg.addColorStop(0.5,irisMid); lg.addColorStop(1,irisBot);
      g.fillStyle=lg; g.beginPath(); g.ellipse(x,ey+ry*0.1,rx*0.8,ry*0.8,0,0,Math.PI*2); g.fill();
      // วงแสงล่างม่านตา
      g.fillStyle='rgba(255,255,255,.22)'; g.beginPath(); g.ellipse(x,ey+ry*0.52,rx*0.5,ry*0.2,0,0,Math.PI*2); g.fill();
      g.fillStyle='#12081a'; g.beginPath(); g.ellipse(x,ey+ry*0.12,rx*0.36,ry*0.42,0,0,Math.PI*2); g.fill();
      g.fillStyle='#ffffff';
      g.beginPath(); g.ellipse(x-rx*0.32,ey-ry*0.38,rx*0.34,ry*0.26,-0.4,0,Math.PI*2); g.fill();
      g.beginPath(); g.arc(x+rx*0.34,ey+ry*0.36,rx*0.14,0,Math.PI*2); g.fill();
      g.globalAlpha=0.85; g.beginPath(); g.arc(x+rx*0.05,ey-ry*0.05,rx*0.07,0,Math.PI*2); g.fill(); g.globalAlpha=1;
      // เส้นขอบตาบน + ขนตา
      g.strokeStyle=INK; g.lineCap='round'; g.lineWidth=female?12:9;
      g.beginPath(); g.ellipse(x,ey,rx*1.02,ry*1.02,0,Math.PI*1.08,Math.PI*1.92); g.stroke();
      if(female){
        g.lineWidth=6;
        g.beginPath(); g.moveTo(x+s*rx*0.92,ey-ry*0.5); g.quadraticCurveTo(x+s*rx*1.25,ey-ry*0.7,x+s*rx*1.38,ey-ry*0.62); g.stroke();
        g.beginPath(); g.moveTo(x+s*rx*0.98,ey-ry*0.22); g.quadraticCurveTo(x+s*rx*1.3,ey-ry*0.3,x+s*rx*1.42,ey-ry*0.18); g.stroke();
      }
    });
    // ปากยิ้ม (อ้าเล็กน้อย + ลิ้น)
    const my=378, mw=female?28:32;
    g.save();
    g.beginPath(); g.moveTo(cx-mw,my); g.quadraticCurveTo(cx,my+(female?38:44),cx+mw,my); g.closePath();
    g.fillStyle='#7c2d3e'; g.fill(); g.clip();
    g.fillStyle='#ff8fa3'; g.beginPath(); g.ellipse(cx,my+(female?28:32),mw*0.62,13,0,0,Math.PI*2); g.fill();
    g.restore();
    g.strokeStyle='#5a1f2e'; g.lineWidth=4; g.lineJoin='round';
    g.beginPath(); g.moveTo(cx-mw,my); g.quadraticCurveTo(cx,my+(female?38:44),cx+mw,my); g.closePath(); g.stroke();
    const tex=new T.CanvasTexture(c); tex.colorSpace=T.SRGBColorSpace; tex.anisotropy=4;
    return tex;
  }

  // ── ประกอบฉาก + ตัวละคร (ใช้ร่วมกันทั้ง mount และ snapshot)
  function build(renderer,opts){
    const lv=Math.max(1,Math.min(8,parseInt(opts.lv)||1));
    const female=(opts.gender!==1);
    const fit=OUTFIT[lv];
    const rankColor=opts.color||'#8b5cf6';
    const disposables=[];
    const track=x=>{ disposables.push(x); return x; };

    const scene=new T.Scene();
    const envRT=makeEnv(renderer); disposables.push(envRT);
    scene.environment=envRT.texture;

    scene.add(new T.HemisphereLight(0xffffff,new T.Color(rankColor).multiplyScalar(0.6),0.55));
    const key=new T.DirectionalLight(0xfff4ea,2.1); key.position.set(2.5,4,4.5); scene.add(key);
    const fill=new T.DirectionalLight(0xdfe8ff,0.55); fill.position.set(-3,1.5,3); scene.add(fill);
    const rim1=new T.DirectionalLight(new T.Color(rankColor),2.6); rim1.position.set(-2.5,3,-4); scene.add(rim1);
    const rim2=new T.DirectionalLight(new T.Color(rankColor),1.6); rim2.position.set(2.8,2,-3); scene.add(rim2);

    const mats={};
    function vinyl(c,o){
      const k=c+JSON.stringify(o||{});
      if(!mats[k]) mats[k]=track(new T.MeshPhysicalMaterial(Object.assign({color:new T.Color(c),roughness:0.42,clearcoat:0.7,clearcoatRoughness:0.25,envMapIntensity:0.9},o||{})));
      return mats[k];
    }
    const cloth=c=>vinyl(c,{roughness:0.62,clearcoat:0.25,sheen:0.6,sheenRoughness:0.5,sheenColor:new T.Color('#ffffff')});
    const gold=vinyl('#ffcf4a',{metalness:1,roughness:0.22,clearcoat:1,envMapIntensity:1.4});
    const geo=g=>track(g);
    const G={
      sph:geo(new T.SphereGeometry(1,32,24)),
      sphHi:geo(new T.SphereGeometry(1,48,32)),
    };
    const root=new T.Group(); scene.add(root);
    function mesh(g,m,x,y,z,parent){ const o=new T.Mesh(g,m); o.position.set(x||0,y||0,z||0); (parent||root).add(o); return o; }
    function ell(m,sx,sy,sz,x,y,z,parent){ const o=mesh(G.sph,m,x,y,z,parent); o.scale.set(sx,sy,sz); return o; }

    // ── แท่นยืน
    const stage=new T.Group(); scene.add(stage);
    const baseCol=mix(rankColor,'#16121f',0.55);
    mesh(geo(new T.CylinderGeometry(0.66,0.74,0.17,64)),vinyl(css(baseCol),{roughness:0.3,clearcoat:1}),0,-0.085,0,stage);
    const top=mesh(geo(new T.CircleGeometry(0.66,64)),vinyl(css(mix(rankColor,'#ffffff',0.15)),{roughness:0.35,clearcoat:1}),0,0.001,0,stage);
    top.rotation.x=-Math.PI/2;
    const glowMat=track(new T.MeshBasicMaterial({color:new T.Color(rankColor).multiplyScalar(1.6)}));
    const rimRing=mesh(geo(new T.TorusGeometry(0.7,0.016,8,96)),glowMat,0,-0.005,0,stage); rimRing.rotation.x=Math.PI/2;
    // เงาสัมผัสพื้นแบบนุ่ม
    const sc=document.createElement('canvas'); sc.width=sc.height=128;
    const sg=sc.getContext('2d'); const grd=sg.createRadialGradient(64,64,4,64,64,62);
    grd.addColorStop(0,'rgba(10,0,20,.62)'); grd.addColorStop(0.55,'rgba(10,0,20,.25)'); grd.addColorStop(1,'rgba(10,0,20,0)');
    sg.fillStyle=grd; sg.fillRect(0,0,128,128);
    const shadowTex=track(new T.CanvasTexture(sc));
    const shadow=mesh(geo(new T.PlaneGeometry(1.05,1.05)),track(new T.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false})),0,0.004,0.02,stage);
    shadow.rotation.x=-Math.PI/2;

    const body=new T.Group(); root.add(body);
    const skinM=vinyl(SKIN,{roughness:0.48,clearcoat:0.45,sheen:0.35,sheenColor:new T.Color('#ffb3a0')});

    // ── ขา + บูท
    [-1,1].forEach(s=>{
      ell(cloth(fit.pants),0.12,0.15,0.12,s*0.13,0.25,0,body);
      ell(vinyl(SHOE,{roughness:0.35,clearcoat:1}),0.14,0.1,0.18,s*0.14,0.09,0.04,body);
    });

    // ── ลำตัวป้อม
    const topCol=fit.suit||fit.shirt;
    const torso=ell(cloth(topCol),0.31,0.33,0.26,0,0.62,0,body);
    if(female){ // ชุดกระโปรงบาน (lathe)
      const pts=[[0.25,0.6],[0.29,0.5],[0.37,0.39],[0.45,0.3],[0.47,0.27],[0.45,0.255]].map(p=>new T.Vector2(p[0],p[1]));
      const dm=track(cloth(fit.suit?fit.pants:css(mix(rankColor,'#ffffff',0.08))).clone()); dm.side=T.DoubleSide;
      mesh(geo(new T.LatheGeometry(pts,40)),dm,0,0,0,body);
    }
    if(fit.vest){ const v=ell(cloth(fit.vest),0.325,0.29,0.27,0,0.6,-0.01,body); v.scale.z=0.265; ell(cloth(fit.shirt),0.1,0.2,0.05,0,0.7,0.245,body); }
    if(fit.suit){ ell(cloth('#ffffff'),0.11,0.17,0.06,0,0.76,0.235,body); }
    if(fit.tie){ const t=mesh(geo(new T.ConeGeometry(0.055,0.26,12)),vinyl(fit.tie,{clearcoat:1}),0,0.72,0.275,body); t.rotation.x=Math.PI+0.18; t.scale.z=0.45; }
    if(fit.bowtie){ [-1,1].forEach(s=>{ const b=mesh(geo(new T.ConeGeometry(0.06,0.12,16)),vinyl(fit.bowtie,{clearcoat:1}),s*0.055,0.9,0.25,body); b.rotation.z=s*Math.PI/2; b.scale.z=0.5; }); ell(vinyl(fit.bowtie),0.03,0.03,0.03,0,0.9,0.265,body); }
    if(fit.buttons){ [0.64,0.54].forEach(y=>ell(gold,0.022,0.022,0.015,0,y,0.265,body)); }
    if(fit.scarf){
      const s=mesh(geo(new T.TorusGeometry(0.19,0.07,12,32)),cloth(fit.scarf),0,0.92,0,body); s.rotation.x=Math.PI/2; s.scale.set(1,1.05,1);
      const tail=ell(cloth(fit.scarf),0.06,0.14,0.04,0.12,0.78,0.22,body); tail.rotation.z=0.25;
    }
    if(fit.belt){ const b=mesh(geo(new T.TorusGeometry(0.285,0.03,8,40)),vinyl(fit.belt,{clearcoat:1}),0,0.46,0,body); b.rotation.x=Math.PI/2; b.scale.y=0.88; ell(gold,0.04,0.035,0.02,0,0.46,0.25,body); }
    if(fit.cape){
      const cp=mesh(geo(new T.CylinderGeometry(0.27,0.52,0.82,32,1,true,Math.PI*0.52,Math.PI*0.96)),cloth(fit.cape).clone(),0,0.5,-0.03,body);
      cp.material.side=T.DoubleSide; track(cp.material);
      const edge=mesh(geo(new T.TorusGeometry(0.52,0.018,6,48,Math.PI*0.96)),gold,0,0.09,-0.03,body);
      edge.rotation.set(-Math.PI/2,0,0);
    }
    if(fit.brooch){ ell(vinyl(fit.brooch,{roughness:0.05,clearcoat:1,iridescence:1}),0.035,0.035,0.02,0.15,0.82,0.23,body); }

    // ── แขน (pivot ไหล่)
    const arms=[-1,1].map(s=>{
      const p=new T.Group(); p.position.set(s*0.3,0.82,0); body.add(p);
      const up=mesh(geo(new T.CapsuleGeometry(0.085,0.14,6,16)),cloth(topCol),0,-0.13,0,p);
      ell(skinM,0.095,0.095,0.095,0,-0.28,0.01,p);
      p.rotation.z=s*0.32; p.userData.rest=s*0.32;
      return p;
    });

    // ── หัว (pivot ที่คอ)
    const head=new T.Group(); head.position.y=0.95; body.add(head);
    const HR=0.64, HY=0.52;
    const hs=new T.Group(); hs.position.y=HY; hs.scale.set(1.08,0.98,1); head.add(hs);
    ell(skinM,HR,HR,HR,0,0,0,hs);
    // หู
    [-1,1].forEach(s=>ell(skinM,0.07,0.1,0.06,s*HR*0.97,-0.06,0,hs));
    // decal หน้า
    const iris=lv===1?'#7d8aa3':rankColor;
    const faceOpen=track(drawFace(false,iris,female,lv)), faceClosed=track(drawFace(true,iris,female,lv));
    const faceMat=track(new T.MeshPhysicalMaterial({map:faceOpen,transparent:true,roughness:0.35,clearcoat:0.8,clearcoatRoughness:0.15,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));
    const face=mesh(geo(new T.SphereGeometry(HR*1.004,64,48,Math.PI/2-PHI_LEN/2,PHI_LEN,Math.PI/2-TH_LEN/2,TH_LEN)),faceMat,0,0,0,hs);
    face.renderOrder=1;

    // ผม: ทรงหลัก + ช่อหน้าม้า + ปอยข้าง
    const hairC=HAIR[female?0:1];
    const hairM=vinyl(hairC,{roughness:0.38,clearcoat:0.9,clearcoatRoughness:0.2,sheen:0.5,sheenColor:new T.Color(css(mix(hairC,'#ffffff',0.5)))});
    ell(hairM,HR*1.07,HR*1.07,HR*1.07,0,0.03,-0.075,hs);
    const C0=new V3(0,0,0);
    function clump(a,e,sx,sy,sz,tilt,R){
      const d=new V3(Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e));
      const o=new T.Mesh(G.sph,hairM); o.position.copy(d).multiplyScalar(R||HR*0.985);
      hs.add(o); hs.updateWorldMatrix(true,false); o.lookAt(hs.localToWorld(d.clone().multiplyScalar(5))); o.rotateZ(tilt||0); o.scale.set(sx,sy,sz); return o;
    }
    const bangs=female
      ? [[-0.78,0.5,0.19,0.27,-0.3],[-0.47,0.55,0.2,0.3,-0.18],[-0.16,0.57,0.2,0.31,-0.06],[0.16,0.57,0.2,0.31,0.06],[0.47,0.55,0.2,0.3,0.18],[0.78,0.5,0.19,0.27,0.3]]
      : [[-0.7,0.56,0.22,0.27,-0.45],[-0.3,0.6,0.23,0.3,-0.45],[0.1,0.62,0.23,0.29,-0.45],[0.5,0.6,0.22,0.27,-0.4],[0.82,0.5,0.18,0.24,-0.2]];
    bangs.forEach(b=>clump(b[0],b[1],b[2],b[3],0.13,b[4]));
    [-1,1].forEach(s=>clump(s*1.18,female?-0.3:-0.05,0.13,female?0.36:0.22,0.08,0,HR*0.96));
    // ปอยชี้ (ahoge)
    const ah=mesh(geo(new T.TorusGeometry(0.13,0.028,8,24,Math.PI*1.1)),hairM,0.04,HR*1.02,-0.05,hs);
    ah.rotation.set(0,Math.PI/2,-0.3);
    if(female){
      // ผมทรงดังโงะ 2 ข้าง + ท้ายทอยยาวลงมาเล็กน้อย
      [-1,1].forEach(s=>{ const d=new V3(Math.sin(s*1.02)*Math.cos(0.72),Math.sin(0.72),Math.cos(s*1.02)*Math.cos(0.72)).multiplyScalar(HR*1.02);
        ell(hairM,0.2,0.2,0.2,d.x*1.08,HY+d.y*0.98,d.z-0.04,head); });
      ell(hairM,0.46,0.34,0.3,0,HY-0.42,-0.3,head);
      if(!fit.crown){ // โบว์สีแรงค์ ติดหน้าผากด้านซ้ายบน
        const bd=new V3(Math.sin(-0.42)*Math.cos(0.78),Math.sin(0.78),Math.cos(-0.42)*Math.cos(0.78)).multiplyScalar(HR*1.17);
        const bow=new T.Group(); bow.position.set(bd.x*1.08,HY+bd.y*0.98,bd.z); head.add(bow);
        head.updateWorldMatrix(true,false); bow.lookAt(head.localToWorld(bd.clone().multiplyScalar(4).setY(HY+bd.y*3))); bow.rotateZ(0.35); bow.scale.setScalar(1.3);
        const bm=vinyl(css(mix(rankColor,'#ffffff',0.1)),{clearcoat:1,roughness:0.3});
        [-1,1].forEach(s=>{ const b=mesh(geo(new T.ConeGeometry(0.13,0.24,20)),bm,s*0.12,0,0,bow); b.rotation.z=-s*Math.PI/2; b.scale.z=0.55; });
        ell(bm,0.06,0.06,0.05,0,0,0.01,bow);
      }
    }

    // ── ของประดับ
    const spinners=[], sparks=[];
    if(fit.crown){
      const cr=new T.Group(); cr.position.set(0,HY+0.64,-0.03); cr.rotation.x=-0.14; head.add(cr);
      mesh(geo(new T.CylinderGeometry(0.29,0.26,0.13,40,1,true)),gold,0,0,0,cr).material.side=T.DoubleSide;
      const gemM=vinyl('#ff4fa3',{roughness:0.05,clearcoat:1,iridescence:0.6});
      for(let i=0;i<7;i++){ const a=i/7*Math.PI*2; mesh(geo(new T.ConeGeometry(0.05,0.15,10)),gold,Math.sin(a)*0.28,0.12,Math.cos(a)*0.28,cr); ell(gold,0.028,0.028,0.028,Math.sin(a)*0.28,0.2,Math.cos(a)*0.28,cr); }
      const g=mesh(geo(new T.OctahedronGeometry(0.055)),gemM,0,0.01,0.29,cr); g.scale.y=1.3;
    }
    if(fit.coin){
      const c=mesh(geo(new T.CylinderGeometry(0.15,0.15,0.035,40)),gold,0.66,1.85,0.1);
      c.rotation.x=Math.PI/2; c.userData={spin:2,fy:1.85,ph:0}; spinners.push(c);
    }
    if(fit.gem){
      const gm=vinyl('#dff9ff',{roughness:0.04,clearcoat:1,iridescence:1,iridescenceIOR:1.4,envMapIntensity:2.2,flatShading:true});
      const g=mesh(geo(new T.OctahedronGeometry(0.15)),gm,0.66,1.9,0.1); g.scale.y=1.4;
      g.userData={spin:1.5,fy:1.9,ph:1}; spinners.push(g);
    }
    if(fit.sparkle){
      const sm=track(new T.MeshBasicMaterial({color:new T.Color('#fff1a8').multiplyScalar(1.3)}));
      const sgeo=geo(new T.OctahedronGeometry(0.04));
      for(let i=0;i<10;i++){
        const s=mesh(sgeo,sm,0,0,0);
        s.scale.y=1.8; s.userData={r:0.78+(i%3)*0.1,a:i/10*Math.PI*2,y:0.3+(i%5)*0.38,sp:0.5+(i%3)*0.25};
        sparks.push(s);
      }
    }

    const camera=new T.PerspectiveCamera(30,1,0.1,50);
    camera.position.set(0,1.25,5.35);
    camera.lookAt(0,1.08,0);

    root.traverse(o=>{ if(o.geometry&&!disposables.includes(o.geometry)) disposables.push(o.geometry); });
    function dispose(){
      const seen=new Set(disposables);
      scene.traverse(o=>{ if(o.material) seen.add(o.material); if(o.geometry) seen.add(o.geometry); });
      seen.forEach(d=>{ try{ d.dispose(); }catch(e){} });
    }
    return {scene,camera,root,body,torso,head,arms,waveArm:arms[1],faceMat,faceOpen,faceClosed,spinners,sparks,shadow,glowMat,dispose};
  }

  function makeRenderer(opts){
    const r=new T.WebGLRenderer(Object.assign({antialias:true,alpha:true,powerPreference:'low-power'},opts||{}));
    r.setClearColor(0x000000,0);
    r.toneMapping=T.ACESFilmicToneMapping; r.toneMappingExposure=1.12;
    r.outputColorSpace=T.SRGBColorSpace;
    return r;
  }

  // ท่าตามเวลา — ใช้ร่วม mount/snapshot
  function pose(rig,t,st){
    const reduce=st.reduce;
    let y=reduce?0:Math.sin(t*2.2)*0.035, squash=1;
    if(st.jumpT>0){
      const p=(st.now-st.jumpT)/0.6;
      if(p>=1) st.jumpT=-1;
      else{ y+=Math.sin(p*Math.PI)*0.38; squash=p<0.12?1-p*0.9:(p>0.9?0.94:1.04); }
    }
    rig.root.position.y=y;
    rig.body.scale.set(2-squash,squash,2-squash);
    rig.torso.scale.y=0.33*(1+(reduce?0:Math.sin(t*2.6)*0.025));
    const ss=Math.max(0.6,1-y*1.1); rig.shadow.scale.set(ss,ss,ss); rig.shadow.material.opacity=Math.max(0.35,1-y*1.6);
    if(!st.dragging) st.spinY*=0.93;
    rig.root.rotation.y=st.spinY+(reduce?0:Math.sin(t*0.7)*0.12);
    st.look.x+=(st.lookT.x-st.look.x)*0.08; st.look.y+=(st.lookT.y-st.look.y)*0.08;
    rig.head.rotation.y=st.look.x*0.4; rig.head.rotation.x=st.look.y*0.18;
    rig.head.rotation.z=reduce?0:Math.sin(t*1.3)*0.06;
    if(!reduce){
      if(st.now>st.blinkAt){ st.blinkUntil=st.now+0.13; st.blinkAt=st.now+2+Math.random()*3; }
      rig.faceMat.map=st.now<st.blinkUntil?rig.faceClosed:rig.faceOpen;
    }
    if(!reduce&&t<1.8){
      const k=Math.sin(Math.min(1,t/0.25)*Math.PI/2)*(t>1.5?(1.8-t)/0.3:1);
      rig.waveArm.rotation.z=rig.waveArm.userData.rest+k*(2.3+Math.sin(t*14)*0.35);
    }else{
      rig.arms.forEach((a,i)=>a.rotation.z=a.userData.rest+(reduce?0:Math.sin(t*2.2+i)*0.05));
    }
    rig.spinners.forEach(s=>{ s.rotation.y=t*s.userData.spin; s.position.y=s.userData.fy+Math.sin(t*2+s.userData.ph)*0.06; });
    rig.sparks.forEach(s=>{ const d=s.userData, a=d.a+t*d.sp; s.position.set(Math.cos(a)*d.r,d.y+Math.sin(t*2+d.a)*0.08,Math.sin(a)*d.r*0.6); s.rotation.y=t*3; s.scale.setScalar(0.7+Math.sin(t*4+d.a)*0.35); s.scale.y*=1.8; });
    rig.glowMat.color.set(0).add(new T.Color(st.color).multiplyScalar(1.4+(reduce?0:Math.sin(t*2)*0.35)));
  }

  function mount(el,opts){
    opts=opts||{};
    if(!el||!hasWebGL()) return null;
    const W=el.clientWidth||158, H=el.clientHeight||250;
    let renderer;
    try{ renderer=makeRenderer(); }catch(e){ return null; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    renderer.setSize(W,H);
    const canvas=renderer.domElement;
    canvas.style.cssText='display:block;width:100%;height:100%;touch-action:pan-y;cursor:grab';
    el.appendChild(canvas);
    const rig=build(renderer,opts);
    rig.camera.aspect=W/H; rig.camera.updateProjectionMatrix();
    const st={reduce:!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches),
      dragging:false,spinY:0,look:{x:0,y:0},lookT:{x:0,y:0},jumpT:-1,blinkAt:0,blinkUntil:0,now:0,color:opts.color||'#8b5cf6'};
    const t0=performance.now()/1000;
    let lastX=0,downX=0,downY=0;
    const draw=()=>{ st.now=performance.now()/1000; pose(rig,st.now-t0,st); renderer.render(rig.scene,rig.camera); };
    const onDown=e=>{ st.dragging=true; lastX=downX=e.clientX; downY=e.clientY; canvas.style.cursor='grabbing'; };
    const onMove=e=>{
      const r=canvas.getBoundingClientRect(); if(!r.width) return;
      st.lookT.x=Math.max(-1,Math.min(1,((e.clientX-r.left)/r.width-0.5)*2));
      st.lookT.y=Math.max(-1,Math.min(1,((e.clientY-r.top)/r.height-0.35)*2));
      if(st.dragging){ st.spinY+=(e.clientX-lastX)*0.012; lastX=e.clientX; if(st.reduce) draw(); }
    };
    const onUp=e=>{
      if(st.dragging&&Math.abs(e.clientX-downX)<6&&Math.abs(e.clientY-downY)<6) st.jumpT=performance.now()/1000;
      st.dragging=false; canvas.style.cursor='grab';
    };
    const onCancel=()=>{ st.dragging=false; canvas.style.cursor='grab'; };
    canvas.addEventListener('pointerdown',onDown);
    window.addEventListener('pointermove',onMove,{passive:true});
    window.addEventListener('pointerup',onUp);
    canvas.addEventListener('pointercancel',onCancel);

    let raf=0,dead=false,iv=0;
    function loop(){
      if(dead) return;
      if(!canvas.isConnected){ destroy(); return; }
      if(!document.hidden) draw();
      raf=requestAnimationFrame(loop);
    }
    function destroy(){
      if(dead) return; dead=true;
      cancelAnimationFrame(raf); clearInterval(iv);
      canvas.removeEventListener('pointerdown',onDown);
      window.removeEventListener('pointermove',onMove);
      window.removeEventListener('pointerup',onUp);
      canvas.removeEventListener('pointercancel',onCancel);
      rig.dispose(); renderer.dispose();
      try{ renderer.forceContextLoss(); }catch(e){}
      if(canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
    draw();
    if(!st.reduce) raf=requestAnimationFrame(loop);
    else iv=setInterval(()=>{ if(!canvas.isConnected) destroy(); },1000);
    return {destroy,renderer};
  }

  // ภาพนิ่งท่ายืนหน้าตรง (ตาเปิด) — ใช้สร้าง sprite sheet สำหรับ sidebar/หน้ารวม
  function snapshot(opts){
    opts=opts||{};
    const w=opts.w||512, h=opts.h||768;
    const renderer=makeRenderer({preserveDrawingBuffer:true});
    renderer.setPixelRatio(1); renderer.setSize(w,h);
    const rig=build(renderer,opts);
    rig.camera.aspect=w/h; rig.camera.updateProjectionMatrix();
    const st={reduce:true,dragging:true,spinY:0,look:{x:0,y:0},lookT:{x:0,y:0},jumpT:-1,blinkAt:1e9,blinkUntil:0,now:0,color:opts.color||'#8b5cf6'};
    pose(rig,0,st);
    rig.spinners.forEach(s=>s.rotation.y=0.6);
    rig.sparks.forEach((s,i)=>{ const d=s.userData; s.position.set(Math.cos(d.a)*d.r,d.y,Math.sin(d.a)*d.r*0.6); s.scale.set(0.9,1.6,0.9); });
    renderer.render(rig.scene,rig.camera);
    const url=renderer.domElement.toDataURL('image/png');
    rig.dispose(); renderer.dispose();
    try{ renderer.forceContextLoss(); }catch(e){}
    return url;
  }

  window.MMChar3D={mount,snapshot};
})();
