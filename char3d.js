// ══════════════════════════════════════════
//  CHAR3D — ตัวละครแรงค์ 3D (Three.js) ในป๊อบอัพอันดับความมั่งคั่ง
//  โหลด on-demand จาก index.html (_loadChar3D) หลัง three.min.js — ไม่มีไฟล์โมเดล สร้างจากรูปทรงพื้นฐานล้วน
//  window.MMChar3D.mount(el,{lv:1..8, gender:0 หญิง|1 ชาย, color:'#hex'}) → {destroy()} หรือ null ถ้าไม่มี WebGL
//  loop หยุดและ dispose เองเมื่อ canvas หลุดจาก DOM (ปิดป๊อบอัพทางไหนก็ได้ ไม่ต้องไล่ hook ทุกจุด)
// ══════════════════════════════════════════
(function(){
  'use strict';
  if(!window.THREE) return;
  const T=window.THREE;

  // ชุดตามแรงค์ — สีหลักของแต่ละแรงค์มาจาก _RANK_TIERS ผ่าน opts.color
  const OUTFIT={
    1:{shirt:'#9ca3af',pants:'#4b5563'},
    2:{shirt:'#e8a05c',pants:'#5b4636',scarf:'#b45309'},
    3:{shirt:'#f1f5f9',pants:'#475569',scarf:'#94a3b8',belt:'#64748b'},
    4:{shirt:'#ffffff',pants:'#374151',tie:'#f59e0b',belt:'#b45309',coin:true},
    5:{suit:'#6d28d9',pants:'#312e81',tie:'#c4b5fd',bowtie:true},
    6:{suit:'#1d4ed8',pants:'#1e3a8a',tie:'#93c5fd',cape:'#2563eb'},
    7:{suit:'#0e7490',pants:'#164e63',tie:'#a5f3fc',cape:'#06b6d4',gem:true},
    8:{suit:'#be185d',pants:'#500724',tie:'#fde68a',cape:'#ec4899',crown:true,sparkle:true},
  };
  const SKIN='#ffe0c8', CHEEK='#ff8fa3', LINE='#2b1b30', SHOE='#3f2a44';
  const HAIR=['#6b3f2a','#3b2a20'];

  function hasWebGL(){
    try{ const c=document.createElement('canvas'); return !!(c.getContext('webgl2')||c.getContext('webgl')); }catch(e){ return false; }
  }

  function mount(el, opts){
    opts=opts||{};
    if(!el||!hasWebGL()) return null;
    const lv=Math.max(1,Math.min(8,parseInt(opts.lv)||1));
    const female=(opts.gender!==1);
    const fit=OUTFIT[lv];
    const rankColor=opts.color||'#8b5cf6';
    const reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const W=el.clientWidth||158, H=el.clientHeight||250;
    let renderer;
    try{ renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'}); }catch(e){ return null; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    renderer.setSize(W,H);
    renderer.setClearColor(0x000000,0);
    const canvas=renderer.domElement;
    canvas.style.cssText='display:block;width:100%;height:100%;touch-action:pan-y;cursor:grab';
    el.appendChild(canvas);

    const scene=new T.Scene();
    const camera=new T.PerspectiveCamera(30,W/H,0.1,50);
    camera.position.set(0,1.2,5.7);
    camera.lookAt(0,1.14,0);

    scene.add(new T.HemisphereLight(0xffffff,0x6b5b7b,1.15));
    const key=new T.DirectionalLight(0xffffff,1.6); key.position.set(2,4,5); scene.add(key);
    const rim=new T.DirectionalLight(new T.Color(rankColor),1.1); rim.position.set(-3,2.5,-4); scene.add(rim);

    // toon ramp 3 ขั้น → ดูเป็นของเล่นการ์ตูน
    const ramp=new T.DataTexture(new Uint8Array([110,110,110,255, 190,190,190,255, 255,255,255,255]),3,1,T.RGBAFormat);
    ramp.minFilter=ramp.magFilter=T.NearestFilter; ramp.needsUpdate=true;
    const mats={};
    function toon(c,extra){
      const k=c+(extra?JSON.stringify(extra):'');
      if(!mats[k]) mats[k]=new T.MeshToonMaterial(Object.assign({color:new T.Color(c),gradientMap:ramp},extra||{}));
      return mats[k];
    }
    const outlineMat=new T.MeshBasicMaterial({color:new T.Color(LINE),side:T.BackSide});
    function mesh(geo,mat,x,y,z,parent){ const m=new T.Mesh(geo,mat); m.position.set(x||0,y||0,z||0); (parent||root).add(m); return m; }
    function outline(m,s){ const o=new T.Mesh(m.geometry,outlineMat); o.scale.setScalar(s||1.045); m.add(o); return o; }

    const root=new T.Group(); scene.add(root);

    // เงาใต้เท้า
    const sc=document.createElement('canvas'); sc.width=sc.height=64;
    const sg=sc.getContext('2d'); const grd=sg.createRadialGradient(32,32,2,32,32,30);
    grd.addColorStop(0,'rgba(0,0,0,.5)'); grd.addColorStop(1,'rgba(0,0,0,0)'); sg.fillStyle=grd; sg.fillRect(0,0,64,64);
    const shadowTex=new T.CanvasTexture(sc);
    const shadow=new T.Mesh(new T.PlaneGeometry(1.3,1.3),new T.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false}));
    shadow.rotation.x=-Math.PI/2; shadow.position.y=0.005; scene.add(shadow);

    const body=new T.Group(); root.add(body);

    // ── ขา + รองเท้า
    const legGeo=new T.CapsuleGeometry(0.115,0.16,4,10);
    [-0.14,0.14].forEach(x=>{
      mesh(legGeo,toon(fit.pants),x,0.24,0,body);
      const s=mesh(new T.SphereGeometry(0.13,14,10),toon(SHOE),x,0.08,0.05,body); s.scale.set(1,0.7,1.35);
    });

    // ── ลำตัว
    const torso=mesh(new T.CapsuleGeometry(0.31,0.14,6,16),toon(fit.suit||fit.shirt),0,0.68,0,body);
    torso.scale.set(1,1,0.85); outline(torso,1.05);
    if(female){ // กระโปรงบาน
      const sk=mesh(new T.CylinderGeometry(0.29,0.47,0.3,22,1,true),toon(fit.suit?fit.pants:rankColor,{side:T.DoubleSide}),0,0.43,0,body);
      sk.scale.z=0.9;
    }
    if(fit.suit){ // อกเสื้อเชิ้ตขาวแบบสูท
      const ch=mesh(new T.SphereGeometry(0.16,14,10),toon('#ffffff'),0,0.8,0.22,body); ch.scale.set(0.8,1.2,0.35);
    }
    if(fit.tie){
      if(fit.bowtie){
        [-1,1].forEach(s=>{ const b=mesh(new T.ConeGeometry(0.07,0.13,10),toon(fit.tie),s*0.06,0.95,0.27,body); b.rotation.z=s*Math.PI/2; });
        mesh(new T.SphereGeometry(0.035,8,6),toon(fit.tie),0,0.95,0.29,body);
      }else{
        const t=mesh(new T.ConeGeometry(0.06,0.3,8),toon(fit.tie),0,0.78,0.27,body); t.rotation.x=Math.PI; t.scale.z=0.4;
      }
    }
    if(fit.scarf){ const s=mesh(new T.TorusGeometry(0.2,0.065,8,20),toon(fit.scarf),0,0.99,0,body); s.rotation.x=Math.PI/2; }
    if(fit.belt){ const b=mesh(new T.TorusGeometry(0.29,0.035,6,24),toon(fit.belt),0,0.52,0,body); b.rotation.x=Math.PI/2; b.scale.y=0.85; }
    if(fit.cape){
      const cp=mesh(new T.CylinderGeometry(0.3,0.55,0.9,20,1,true,Math.PI*0.55,Math.PI*0.9),toon(fit.cape,{side:T.DoubleSide}),0,0.55,-0.04,body);
    }

    // ── แขน (pivot ที่ไหล่ จะได้โบกมือได้)
    const arms=[-1,1].map(s=>{
      const p=new T.Group(); p.position.set(s*0.33,0.9,0); body.add(p);
      mesh(new T.CapsuleGeometry(0.095,0.2,4,10),toon(fit.suit||fit.shirt),0,-0.17,0,p);
      mesh(new T.SphereGeometry(0.1,12,10),toon(SKIN),0,-0.34,0,p);
      p.rotation.z=s*0.28; p.userData.rest=s*0.28;
      return p;
    });
    const waveArm=arms[1];

    // ── หัว (pivot ที่คอ เอียงหัวดูเป็นธรรมชาติ)
    const head=new T.Group(); head.position.y=1.04; body.add(head);
    const HR=0.6, HY=0.5;
    const skull=mesh(new T.SphereGeometry(HR,32,24),toon(SKIN),0,HY,0,head); skull.scale.set(1.05,0.95,1); outline(skull,1.04);
    const hairC=HAIR[female?0:1];
    const hb=mesh(new T.SphereGeometry(HR*1.07,32,24),toon(hairC),0,HY+0.03,-0.09,head); hb.scale.set(1.05,0.97,1); outline(hb,1.035);
    // หน้าม้า = ครึ่งบนของทรงกลมที่เอียงมาข้างหน้า
    const fr=mesh(new T.SphereGeometry(HR*1.06,32,16,0,Math.PI*2,0,1.05),toon(hairC),0,HY+0.02,0.02,head); fr.scale.set(1.05,0.97,1); fr.rotation.x=0.32;
    if(female){
      const lh=mesh(new T.CapsuleGeometry(0.42,0.5,6,16),toon(hairC),0,HY-0.5,-0.3,head); lh.scale.set(1.25,1,0.45);
      if(!fit.crown){ // โบว์
        const bow=new T.Group(); bow.position.set(0.44,HY+0.4,0.3); bow.rotation.set(0,0.5,-0.5); bow.scale.setScalar(1.45); head.add(bow);
        [-1,1].forEach(s=>{ const b=mesh(new T.ConeGeometry(0.12,0.22,12),toon(rankColor),s*0.11,0,0,bow); b.rotation.z=-s*Math.PI/2; b.scale.z=0.5; });
        mesh(new T.SphereGeometry(0.06,10,8),toon(rankColor),0,0,0.02,bow);
      }
    }else{
      [[-0.25,0.2],[0,0.35],[0.25,0.2],[0.12,-0.05],[-0.14,-0.08]].forEach(([x,z])=>{
        const sp=mesh(new T.ConeGeometry(0.13,0.3,8),toon(hairC),x,HY+0.62,z,head); sp.rotation.set(z*0.6,0,-x*1.3);
      });
    }

    // หน้า: ตาโต มีจุดไฮไลต์ แก้มชมพู ปากยิ้ม
    const eyeGeo=new T.SphereGeometry(1,16,12);
    const eyeMat=new T.MeshBasicMaterial({color:new T.Color('#2a1830')});
    const hiMat=new T.MeshBasicMaterial({color:0xffffff});
    const ey=HY-0.04, ez=HR*0.93, esz=female?1.12:1;
    const eyes=[-1,1].map(s=>{
      const g=new T.Group(); g.position.set(s*0.2,ey,ez); g.rotation.y=s*0.22; head.add(g);
      const e=new T.Mesh(eyeGeo,eyeMat); e.scale.set(0.085*esz,0.12*esz,0.05); g.add(e);
      const h1=new T.Mesh(eyeGeo,hiMat); h1.scale.setScalar(0.03*esz); h1.position.set(0.025,0.04,0.045); g.add(h1);
      if(female){ const h2=new T.Mesh(eyeGeo,hiMat); h2.scale.setScalar(0.015); h2.position.set(-0.025,-0.035,0.045); g.add(h2); }
      return g;
    });
    const cheekMat=new T.MeshBasicMaterial({color:new T.Color(CHEEK),transparent:true,opacity:0.55});
    [-1,1].forEach(s=>{ const c=new T.Mesh(eyeGeo,cheekMat); c.scale.set(0.085,0.045,0.02); c.position.set(s*0.33,HY-0.2,HR*0.82); c.rotation.y=s*0.55; head.add(c); });
    const mouth=new T.Mesh(new T.TorusGeometry(0.055,0.014,6,14,Math.PI),eyeMat);
    mouth.position.set(0,HY-0.24,HR*0.96); mouth.rotation.z=Math.PI; head.add(mouth);

    // ── ของประดับตามแรงค์
    const spinners=[];
    if(fit.crown){
      const cr=new T.Group(); cr.position.set(0,HY+0.62,0); cr.rotation.x=-0.12; head.add(cr);
      const gold=toon('#fbbf24',{emissive:new T.Color('#7a4a00'),emissiveIntensity:0.35});
      mesh(new T.CylinderGeometry(0.3,0.27,0.16,20,1,true),toon('#fbbf24',{side:T.DoubleSide,emissive:new T.Color('#7a4a00'),emissiveIntensity:0.35}),0,0,0,cr);
      for(let i=0;i<5;i++){ const a=i/5*Math.PI*2; mesh(new T.ConeGeometry(0.06,0.16,6),gold,Math.sin(a)*0.29,0.14,Math.cos(a)*0.29,cr); }
      mesh(new T.OctahedronGeometry(0.06),toon('#f472b6'),0,0.02,0.3,cr);
    }
    if(fit.coin){
      const c=mesh(new T.CylinderGeometry(0.16,0.16,0.04,20),toon('#fbbf24',{emissive:new T.Color('#7a4a00'),emissiveIntensity:0.4}),0.72,1.75,0,root);
      c.rotation.x=Math.PI/2; c.userData={spin:2,fy:1.75,ph:0}; spinners.push(c);
    }
    if(fit.gem){
      const g=mesh(new T.OctahedronGeometry(0.16),toon('#a5f3fc',{emissive:new T.Color('#0891b2'),emissiveIntensity:0.45}),0.75,1.85,0,root);
      g.scale.y=1.35; g.userData={spin:1.6,fy:1.85,ph:1}; spinners.push(g);
    }
    const sparks=[];
    if(fit.sparkle){
      const sm=new T.MeshBasicMaterial({color:new T.Color('#fde68a')});
      for(let i=0;i<9;i++){
        const s=mesh(new T.OctahedronGeometry(0.045),sm,0,0,0,root);
        s.userData={r:0.85+(i%3)*0.12,a:i/9*Math.PI*2,y:0.35+(i%4)*0.45,sp:0.6+(i%3)*0.25};
        sparks.push(s);
      }
    }

    // ── อินพุต: ลากหมุน / แตะกระโดด / หัวมองตาม
    let dragging=false, lastX=0, downX=0, downY=0, spinY=0, look={x:0,y:0}, lookT={x:0,y:0};
    let jumpT=-1, blinkAt=0, blinkUntil=0;
    const t0=performance.now()/1000;
    const onDown=e=>{ dragging=true; lastX=downX=e.clientX; downY=e.clientY; canvas.style.cursor='grabbing'; };
    const onMove=e=>{
      const r=canvas.getBoundingClientRect();
      lookT.x=Math.max(-1,Math.min(1,((e.clientX-r.left)/r.width-0.5)*2));
      lookT.y=Math.max(-1,Math.min(1,((e.clientY-r.top)/r.height-0.35)*2));
      if(dragging){ spinY+=(e.clientX-lastX)*0.012; lastX=e.clientX; if(reduce) draw(performance.now()/1000); }
    };
    const onUp=e=>{
      if(dragging&&Math.abs(e.clientX-downX)<6&&Math.abs(e.clientY-downY)<6) jumpT=performance.now()/1000;
      dragging=false; canvas.style.cursor='grab';
    };
    const onCancel=()=>{ dragging=false; canvas.style.cursor='grab'; };
    canvas.addEventListener('pointerdown',onDown);
    window.addEventListener('pointermove',onMove,{passive:true});
    window.addEventListener('pointerup',onUp);
    canvas.addEventListener('pointercancel',onCancel);

    function draw(now){
      const t=now-t0;
      // ลอย + หายใจ
      let y=reduce?0:Math.sin(t*2.2)*0.035;
      let squash=1;
      if(jumpT>0){
        const p=(now-jumpT)/0.6;
        if(p>=1) jumpT=-1;
        else{ y+=Math.sin(p*Math.PI)*0.38; squash=p<0.12?1-p*0.9:(p>0.9?0.94:1.04); }
      }
      root.position.y=y;
      body.scale.set(2-squash,squash,2-squash);
      torso.scale.y=1+(reduce?0:Math.sin(t*2.6)*0.025);
      const ss=1-y*0.9; shadow.scale.set(ss,ss,ss); shadow.material.opacity=Math.max(0.3,1-y*1.5);
      // หมุนตามลาก แล้วค่อยๆ หันกลับหน้า
      if(!dragging) spinY*=0.93;
      root.rotation.y=spinY+(reduce?0:Math.sin(t*0.7)*0.12);
      // หัวมองตามนิ้ว/เมาส์
      look.x+=(lookT.x-look.x)*0.08; look.y+=(lookT.y-look.y)*0.08;
      head.rotation.y=look.x*0.4; head.rotation.x=look.y*0.18;
      head.rotation.z=reduce?0:Math.sin(t*1.3)*0.06;
      // กระพริบตา
      if(!reduce){
        if(now>blinkAt){ blinkUntil=now+0.12; blinkAt=now+2+Math.random()*3; }
        const bs=now<blinkUntil?0.12:1; eyes.forEach(g=>g.scale.y=bs);
      }
      // โบกมือทักตอนเปิด 1.8 วิแรก
      if(!reduce&&t<1.8){
        const k=Math.sin(Math.min(1,t/0.25)*Math.PI/2)*(t>1.5?(1.8-t)/0.3:1);
        waveArm.rotation.z=waveArm.userData.rest+k*(2.3+Math.sin(t*14)*0.35);
      }else{
        arms.forEach((a,i)=>a.rotation.z=a.userData.rest+(reduce?0:Math.sin(t*2.2+i)*0.05));
      }
      spinners.forEach(s=>{ s.rotation.y=t*s.userData.spin; s.position.y=s.userData.fy+Math.sin(t*2+s.userData.ph)*0.06; });
      sparks.forEach(s=>{ const d=s.userData, a=d.a+t*d.sp; s.position.set(Math.cos(a)*d.r,d.y+Math.sin(t*2+d.a)*0.08,Math.sin(a)*d.r*0.6); s.rotation.y=t*3; const sc=0.7+Math.sin(t*4+d.a)*0.35; s.scale.setScalar(sc); });
      renderer.render(scene,camera);
    }

    let raf=0, dead=false;
    function loop(){
      if(dead) return;
      if(!canvas.isConnected){ destroy(); return; }
      if(!document.hidden) draw(performance.now()/1000);
      raf=requestAnimationFrame(loop);
    }
    function destroy(){
      if(dead) return; dead=true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown',onDown);
      window.removeEventListener('pointermove',onMove);
      window.removeEventListener('pointerup',onUp);
      canvas.removeEventListener('pointercancel',onCancel);
      const seen=new Set();
      scene.traverse(o=>{
        if(o.geometry&&!seen.has(o.geometry)){ seen.add(o.geometry); o.geometry.dispose(); }
        if(o.material&&!seen.has(o.material)){ seen.add(o.material); o.material.dispose(); }
      });
      ramp.dispose(); shadowTex.dispose();
      renderer.dispose();
      try{ renderer.forceContextLoss(); }catch(e){}
      if(canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }

    draw(performance.now()/1000);
    if(!reduce) raf=requestAnimationFrame(loop);
    else{ // นิ่ง แต่ยังต้องเก็บกวาดเมื่อป๊อบอัพปิด
      const iv=setInterval(()=>{ if(!canvas.isConnected){ clearInterval(iv); destroy(); } },1000);
    }
    return {destroy, renderer};
  }

  window.MMChar3D={mount};
})();
