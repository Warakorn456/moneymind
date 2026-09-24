// admin.js — หน้า Admin Dashboard ของ MoneyMind (เจ้าของคนเดียว)
// 2026-09-19: ย้ายออกจาก index.html (83 KB) เพราะผู้ใช้ทุกคนต้องโหลด/parse โค้ดนี้ทุกครั้งทั้งที่ใช้ได้แค่ owner
// โหลดแบบ on-demand จาก renderAdmin() ใน index.html — ไฟล์นี้อาศัย global ทั้งหมดของ index.html (tr, _fs, Chart, toast ...)
// จึงต้องโหลดหลัง main script เท่านั้น. เพิ่ม/แก้ฟังก์ชัน admin ให้ทำที่ไฟล์นี้
let _adminChart=null;
let _adminNwChart=null;
window._adminMembers=[];

// วาด/redraw กราฟเทรนด์ Net Worth รวมย้อนหลัง — เรียกทุกครั้งที่ #admin-nw-trend-chart ถูกสร้างใหม่
// (ตอน renderAdmin ครั้งแรก และตอน sort ตารางเพราะ innerHTML replace ทำลาย canvas เดิม)
function _drawAdminNwTrendChart(history){
  try{
    if(_adminNwChart){ _adminNwChart.destroy(); _adminNwChart=null; }
    const cv=document.getElementById('admin-nw-trend-chart');
    if(!cv||!window.Chart||!history||!history.length) return;
    const labels=history.map(h=>h.date.slice(5));
    const data=history.map(h=>h.netWorthSum||0);
    _adminNwChart=new Chart(cv,{type:'line',
      data:{labels,datasets:[{label:'Net Worth รวม',data,borderColor:'#10b981',backgroundColor:'rgba(16,185,129,.15)',fill:true,tension:.3,pointRadius:2}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},
        tooltip:{callbacks:{label:c=>'฿'+Math.round(c.parsed.y).toLocaleString('en-US')}}},
        scales:{y:{beginAtZero:false,ticks:{color:_chartTickColor(),callback:v=>'฿'+(v/1000).toLocaleString('en-US')+'k'},grid:{color:_chartGridColor(.1)}},
          x:{ticks:{color:_chartTickColor(),maxTicksLimit:10},grid:{display:false}}}}});
  }catch(e){ console.error('admin nw trend chart',e); }
}
function exportAdminCsv(){
  const ms=window._adminMembers||[]; if(!ms.length){ toast(tr('no_data_yet'),'info'); return; }
  const rows=[['username','email','platform','currentPlatform','isOwner','createdAt','lastSeen']];
  ms.forEach(m=>rows.push([
    m.username,m.email||'',m.platform||'',m.currentPlatform||'',m.isOwner?'yes':'',
    m.createdAt?m.createdAt.toISOString():'',m.lastSeen?m.lastSeen.toISOString():''
  ]));
  const csv='﻿'+rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const fn='moneymind_members_'+new Date().toISOString().slice(0,10)+'.csv';
  if(_nativeSaveFile(blob,fn,'text/csv;charset=utf-8')) return;
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=fn; a.click();
  toast(tr('csv_exported'),'success');
}
function filterAdminTable(q){
  q=(q||'').toLowerCase().trim();
  const showTest=!!window._adminShowTest;
  document.querySelectorAll('#admin-user-tbody tr[data-u]').forEach(tr=>{
    const matchQ=!q||tr.getAttribute('data-u').includes(q);
    const matchTest=showTest||tr.getAttribute('data-test')!=='1';
    tr.style.display=(matchQ&&matchTest)?'':'none';
  });
}
function _adminToggleTestRows(show){
  window._adminShowTest=!!show;
  const searchEl=document.querySelector('input[oninput^="filterAdminTable"]');
  filterAdminTable(searchEl?searchEl.value:'');
}
function _adminUserSortLabel(key){
  const s=window._adminUserSort||{key:'created',dir:'desc'};
  if(s.key!==key) return '<i class="fas fa-sort" style="opacity:.3;margin-left:4px"></i>';
  return s.dir==='desc'?'<i class="fas fa-sort-down" style="margin-left:4px"></i>':'<i class="fas fa-sort-up" style="margin-left:4px"></i>';
}
function _adminSortUsers(key){
  // เรียง <tr> ใน DOM ใหม่จาก data-created / data-seen — ไม่ fetch ใหม่ และแถวที่ filter ซ่อนอยู่ยังซ่อนเหมือนเดิม
  const s=window._adminUserSort||{key:'created',dir:'desc'};
  if(s.key===key){ s.dir=s.dir==='desc'?'asc':'desc'; } else { s.key=key; s.dir='desc'; }
  window._adminUserSort=s;
  const tb=document.getElementById('admin-user-tbody');
  if(!tb) return;
  const rows=Array.from(tb.querySelectorAll('tr[data-u]'));
  const val=tr=>Number(tr.getAttribute('data-'+s.key))||0;
  rows.sort((a,b)=>{
    const va=val(a),vb=val(b);
    if(!va&&!vb) return 0; if(!va) return 1; if(!vb) return -1; // ไม่มีค่า (ไม่เคย/บัญชีเก่า) ไปท้ายสุดเสมอ
    return s.dir==='desc'?vb-va:va-vb;
  });
  rows.forEach(tr=>tb.appendChild(tr));
  const thC=document.getElementById('admin-th-created'), thS=document.getElementById('admin-th-seen');
  if(thC) thC.innerHTML=tr('admin_signup_at')+_adminUserSortLabel('created');
  if(thS) thS.innerHTML=tr('admin_last_seen')+_adminUserSortLabel('seen');
}
function _adminUsageSortLabel(key){
  const s=window._adminUsageSort||{key:'nw',dir:'desc'};
  if(s.key!==key) return '<i class="fas fa-sort" style="opacity:.3;margin-left:4px"></i>';
  return s.dir==='desc'?'<i class="fas fa-sort-down" style="margin-left:4px"></i>':'<i class="fas fa-sort-up" style="margin-left:4px"></i>';
}
function _adminSortUsage(key){
  const s=window._adminUsageSort||{key:'nw',dir:'desc'};
  if(s.key===key){ s.dir=s.dir==='desc'?'asc':'desc'; } else { s.key=key; s.dir='desc'; }
  window._adminUsageSort=s;
  const wrap=document.getElementById('admin-usage-wrap');
  if(wrap&&window._adminSummary){
    wrap.innerHTML=_renderAdminUsageSection(window._adminSummary);
    _drawAdminNwTrendChart(window._adminHistory); // innerHTML replace ทำลาย canvas เดิม ต้องวาดใหม่
  }
}
function _renderAdminUsageSection(summary){
  if(!(summary&&Array.isArray(summary.users))){
    return `<div style="margin:24px 0;padding:16px;background:var(--surface);border:1px dashed var(--border);border-radius:14px;font-size:12px;color:var(--muted);line-height:1.7">
      <i class="fas fa-circle-info" style="color:#a78bfa"></i> ${tr('admin_no_server_usage')}</div>`;
  }
  const statCard=(val,label,color)=>`<div style="background:var(--surface);border:1px solid ${color}33;border-radius:14px;padding:14px;text-align:center">
    <div style="font-size:28px;font-weight:800;color:${color}">${val}</div>
    <div style="font-size:11px;color:var(--muted);margin-top:2px">${label}</div></div>`;
  const t=summary.totals||{};
  const sortSt=window._adminUsageSort||(window._adminUsageSort={key:'nw',dir:'desc'});
  const sortFns={
    user:(a,b)=>a.username.localeCompare(b.username),
    tx:(a,b)=>(a.txCount||0)-(b.txCount||0),
    assets:(a,b)=>(a.totalAssets||0)-(b.totalAssets||0),
    debts:(a,b)=>(a.totalDebts||0)-(b.totalDebts||0),
    nw:(a,b)=>(a.netWorth||0)-(b.netWorth||0),
    age:(a,b)=>(a.age??-1)-(b.age??-1),
    job:(a,b)=>(a.jobTitle||'').localeCompare(b.jobTitle||''),
    last:(a,b)=>(a.lastTxDate||'').localeCompare(b.lastTxDate||''),
    aiquota:(a,b)=>(a.aiMonthlyUsed??-1)-(b.aiMonthlyUsed??-1)
  };
  const su=summary.users.slice().sort(sortFns[sortSt.key]||sortFns.nw);
  if(sortSt.dir==='desc') su.reverse();
  // เหรียญ Top 3 ตาม Net Worth จริง — อิงลำดับคงที่ ไม่ผูกกับ sort ที่แสดงผล
  const byNw=summary.users.slice().sort((a,b)=>(b.netWorth||0)-(a.netWorth||0));
  const medal={}; byNw.slice(0,3).forEach((u,i)=>{ medal[u.username]=['🥇','🥈','🥉'][i]; });
  const fmtB=n=>'฿'+Math.round(n||0).toLocaleString('en-US');
  const upd=summary.updatedAt?new Date(summary.updatedAt).toLocaleString('th-TH'):'-';
  const featChip=(on,label)=>`<span style="font-size:10px;padding:1px 6px;border-radius:8px;margin:1px;display:inline-block;${on?'background:rgba(16,185,129,.15);color:#10b981':'background:rgba(255,255,255,.04);color:#475569'}">${label}</span>`;
  const urows=su.map(u=>{
    const f=u.features||{};
    // Badge อันดับความมั่งคั่ง — ใช้ระบบ Wealth Ranking เดิม (_calcPercentile/_getRank, ขอบเขตไทย) ตัวเดียวกับที่ user เห็นในหน้าตัวเอง
    const rankTier=_calcPercentile(u.netWorth||0,'th').tier;
    const rank=_getRank(rankTier.lv);
    return `<tr style="border-bottom:1px solid rgba(255,255,255,.05)">
      <td style="padding:10px 14px;font-size:12px"><strong>${medal[u.username]?medal[u.username]+' ':''}${u.username}</strong></td>
      <td style="padding:10px 14px;font-size:12px;text-align:right">${(u.txCount||0).toLocaleString()}</td>
      <td style="padding:10px 14px;font-size:12px;text-align:right;color:#10b981">${u.totalAssets!=null?fmtB(u.totalAssets):'-'}</td>
      <td style="padding:10px 14px;font-size:12px;text-align:right;color:#ef4444">${u.totalDebts!=null?fmtB(u.totalDebts):'-'}</td>
      <td style="padding:10px 14px;font-size:12px;text-align:right;white-space:nowrap">
        ${fmtB(u.netWorth)}
        <span style="display:inline-flex;align-items:center;gap:3px;margin-left:6px;font-size:10px;color:${rank.color};background:${rank.color}18;border:1px solid ${rank.color}35;border-radius:8px;padding:1px 6px">
          <i class="fas ${rank.icon}"></i>${rank.th}
        </span>
      </td>
      <td style="padding:10px 14px;font-size:12px;text-align:right;color:var(--muted)">${u.age??'-'}</td>
      <td style="padding:10px 14px;font-size:12px;color:var(--muted);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${u.jobTitle||'-'}</td>
      <td style="padding:10px 14px;font-size:12px;color:var(--muted)">${u.lastTxDate||'-'}</td>
      <td style="padding:10px 14px;font-size:11px">${featChip(f.inv,tr('investments'))}${featChip(f.debt,tr('debts'))}${featChip(f.save,tr('savings'))}${featChip(f.insurance,tr('insurance'))}${featChip(f.travel,tr('travel'))}${featChip(f.sub,'subs')}</td>
      <td style="padding:10px 14px;font-size:12px;text-align:right;white-space:nowrap">${(()=>{
        if(!u.aiTier) return '<span style="color:var(--muted)">-</span>';
        const moPct=(u.aiMonthlyUsed||0)/(u.aiMonthlyLimit||1);
        const color=moPct>=0.9?'#ef4444':moPct>=0.7?'#f59e0b':'var(--muted)';
        return `<span style="color:${color}">${u.aiMonthlyUsed}/${u.aiMonthlyLimit} · ${u.aiDailyUsed}/${u.aiDailyLimit}</span>`;
      })()}</td>
    </tr>`;
  }).join('');
  const th=(key,label,align)=>`<th onclick="_adminSortUsage('${key}')" style="padding:9px 14px;font-size:11px;color:var(--muted);text-align:${align||'left'};cursor:pointer;user-select:none;white-space:nowrap">${label}${_adminUsageSortLabel(key)}</th>`;
  // ── ฟีเจอร์ไหนมีคนใช้จริง ──
  // byFeature ถูกคำนวณใน admin_stats.py ทุกวันอยู่แล้วตั้งแต่แรก แต่ไม่เคยถูกอ่านมาแสดงเลย
  // ส่วนสถานะเชื่อมต่อ (LINE/push/login) นับสดจาก members ที่ renderAdmin โหลดไว้แล้ว
  // ยกเว้น gmailConnected ที่ client อ่าน collection gmailAuth ไม่ได้ (rule ปิดสนิท) ต้องพึ่ง summary
  const adoptionSection=(()=>{
    const rm=window._adminRealMembers||[];
    const n=rm.length;
    const bf=t.byFeature||{};
    // ยอด "เปิดดู" มาจาก beacon ของ nav() (ยอดรวมล้วน ไม่ผูกกับบัญชี) — คู่กับ "มีข้อมูล"
    // แล้วอ่านออกทันทีว่าฟีเจอร์ไหนคนสนใจแต่ใช้ไม่เป็น กับฟีเจอร์ไหนไม่มีใครหาเจอเลย
    const ap=window._adminAppPages||{};
    const rows=[
      [tr('investments'),bf.inv,ap.investments],[tr('debts'),bf.debt,ap.debts],
      [tr('savings'),bf.save,ap.savings],
      [tr('insurance'),bf.insurance,ap.insurance],[tr('travel'),bf.travel,ap.travel],
      ['Subscriptions',bf.sub,ap.subscriptions],
      [tr('admin_adopt_line'),rm.filter(m=>m.lineUserId).length],
      [tr('admin_adopt_line_friend'),rm.filter(m=>m.lineFriend).length],
      [tr('admin_adopt_gmail'),t.gmailConnected],
      [tr('admin_adopt_push'),rm.filter(m=>m.hasPush).length],
    ].filter(r=>r[1]!=null);
    // หน้าที่ไม่มี "ข้อมูล" ให้นับ (เครื่องคิดเลข/ความรู้/ปฏิทิน) — โชว์ยอดเปิดอย่างเดียว เพื่อใช้ตัดสินใจลด/จัดกลุ่มเมนูจากของจริง (2026-09-19)
    const opensOnly=['ot','loan','tax','calendar','retire','balance','learn','catbudget','profile'].filter(k=>ap[k]).map(k=>[tr(k),null,ap[k]]);
    if(!rows.length||!n) return '';
    const base=Math.max(n,1);
    const bar=(label,cnt,opens)=>{
      const pct=Math.round(cnt/base*100);
      const col=cnt===0?'#ef4444':pct>=50?'#10b981':pct>=20?'#f59e0b':'#818cf8';
      return '<div style="margin-top:9px">'
        +'<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">'
        +'<span style="color:var(--muted)">'+label
          +(opens?'<span style="font-size:10px;opacity:.75"> · '+tr('admin_v_opened')+' '+opens+'</span>':'')
        +'</span>'
        +'<span style="font-weight:700;color:'+col+'">'+cnt+' <span style="color:var(--muted);font-weight:400">('+pct+'%)</span></span></div>'
        +'<div class="pbar"><div class="pfill" style="width:'+Math.max(1,pct)+'%;background:'+col+'"></div></div></div>';
    };
    // ── activation (เพิ่ม 2026-08-31) — "มีข้อมูลไหม" ด้านบนเป็นยอดสะสมตลอดกาล ตอบไม่ได้ว่า
    //    onboarding ตอนนี้ดีขึ้นหรือแย่ลง ตัวนี้ดูเฉพาะคนที่สมัครใน 30 วันล่าสุด และดู "เร็วแค่ไหน"
    //    ⚠️ firstTxDate คือวันที่ของรายการที่ user กรอก ไม่ใช่เวลาที่กดบันทึก — ป้ายจึงเขียนว่า
    //    "วันเดียวกับที่สมัคร" ห้ามเขียนว่า "ภายใน 24 ชั่วโมง"
    const act=t.activation;
    const actSection=(act&&act.cohort)?(()=>{
      const abar=(label,cnt,higherIsBetter)=>{
        const pct=Math.round(cnt/Math.max(1,act.cohort)*100);
        const col=higherIsBetter
          ?(pct>=50?'#10b981':pct>=20?'#f59e0b':'#ef4444')
          :(pct>=50?'#ef4444':pct>=20?'#f59e0b':'#10b981');
        return '<div style="margin-top:9px">'
          +'<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">'
          +'<span style="color:var(--muted)">'+label+'</span>'
          +'<span style="font-weight:700;color:'+col+'">'+cnt+' <span style="color:var(--muted);font-weight:400">('+pct+'%)</span></span></div>'
          +'<div class="pbar"><div class="pfill" style="width:'+Math.max(1,pct)+'%;background:'+col+'"></div></div></div>';
      };
      return '<div style="margin-top:13px;padding-top:11px;border-top:1px solid rgba(255,255,255,.07)">'
        +'<div style="font-size:11px;font-weight:700;color:var(--text)">'+tr('admin_act_title')+'</div>'
        +'<div style="font-size:10px;color:var(--muted);margin-top:2px;line-height:1.5">'+tr('admin_act_note').replace('{n}',act.cohort)+'</div>'
        +abar(tr('admin_act_sameday'),act.sameDay||0,true)
        +abar(tr('admin_act_7d'),act.within7d||0,true)
        +abar(tr('admin_act_never'),act.never||0,false)
        +'</div>';
    })():'';

    // ── เปิดหน้าแล้วทำสำเร็จไหม (เพิ่ม 2026-08-31) — ช่องว่างระหว่าง 2 ขั้วที่มีอยู่เดิม
    //    "เปิดหน้ากี่ครั้ง" (ap) กับ "มีข้อมูลจริงกี่คน" (bf) มองไม่เห็นคนที่เปิดแล้วลองแล้วไม่สำเร็จ
    //    ⚠️ ทั้งสองฝั่งเป็นยอดรวมล้วน ไม่ผูกกับบัญชี — เทียบเป็นสัดส่วนคร่าวๆ ได้ แต่ไม่ใช่ funnel
    //    รายคน (คนเดียวเปิด 10 ครั้งแล้วบันทึกครั้งเดียวก็ให้ผลเหมือนคน 10 คนเปิดคนละครั้ง)
    const acts=window._adminActions||{};
    const actDoneSection=Object.keys(acts).length?(()=>{
      const defs=[['tx_add','transactions'],['receipt_scan',''],['maya_ask',''],
                  ['bank_add','banks'],['budget_set','catbudget'],['debt_add','debts'],
                  ['guest_start',''],['guest_convert','']];
      const lines=defs.filter(d=>acts[d[0]]!=null).map(([k,pageKey])=>{
        const done=acts[k]||0, opens=pageKey?(ap[pageKey]||0):0;
        const pct=opens?Math.round(done/opens*100):null;
        const col=pct==null?'#818cf8':pct>=30?'#10b981':pct>=10?'#f59e0b':'#ef4444';
        return '<div style="display:flex;justify-content:space-between;gap:10px;font-size:11px;padding:5px 0;border-top:1px solid rgba(255,255,255,.05)">'
          +'<span style="color:var(--muted)">'+tr('admin_actd_'+k)+'</span>'
          +'<span style="white-space:nowrap">'
          +(opens?'<span style="color:var(--muted)">'+tr('admin_actd_opens')+' '+opens+' · </span>':'')
          +'<span style="font-weight:700;color:'+col+'">'+tr('admin_actd_done')+' '+done+'</span>'
          +(pct!=null?'<span style="color:var(--muted)"> ('+pct+'%)</span>':'')
          +'</span></div>';
      }).join('');
      if(!lines) return '';
      return '<div style="margin-top:13px;padding-top:11px;border-top:1px solid rgba(255,255,255,.07)">'
        +'<div style="font-size:11px;font-weight:700;color:var(--text)">'+tr('admin_actd_title')+'</div>'
        +'<div style="font-size:10px;color:var(--muted);margin-top:2px;line-height:1.5">'+tr('admin_actd_note')+'</div>'
        +'<div style="margin-top:4px">'+lines+'</div></div>';
    })():'';

    // วิธี login — นับเป็นสัดส่วนของ user จริง ไม่ใช่ฟีเจอร์ที่ "ใช้" เลยแยกเป็นแถว chip
    const prov={};
    rm.forEach(m=>{ const k=m.provider||'password'; prov[k]=(prov[k]||0)+1; });
    const provChips=Object.keys(prov).sort((a,b)=>prov[b]-prov[a]).map(k=>
      '<span style="font-size:10px;padding:2px 7px;border-radius:8px;background:rgba(255,255,255,.05);color:var(--muted)">'+k+' '+prov[k]+'</span>').join(' ');
    return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:14px">'
      +'<div style="font-size:10px;font-weight:700;color:#818cf8;text-transform:uppercase;letter-spacing:.6px">'
      +'<i class="fas fa-list-check" style="margin-right:5px"></i>'+tr('admin_adoption')+'</div>'
      +'<div style="font-size:11px;color:var(--muted);margin-top:3px">'+tr('admin_adoption_note').replace('{n}',n)+(Object.keys(window._adminAppPages||{}).length?' · '+tr('admin_v_adopt_note2'):'')+'</div>'
      +rows.map(r=>bar(r[0],r[1],r[2])).join('')
      +(opensOnly.length?'<div style="margin-top:12px;font-size:11px;color:var(--muted)">'+tr('admin_opens_only')+'</div>'
        +'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">'+opensOnly.sort((x,y)=>y[2]-x[2]).map(r=>'<span style="font-size:11px;padding:3px 9px;border-radius:8px;background:rgba(255,255,255,.05)">'+r[0]+' <b>'+r[2]+'</b></span>').join('')+'</div>':'')
      +actDoneSection
      +actSection
      +'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:13px;padding-top:11px;border-top:1px solid rgba(255,255,255,.07)">'
      +'<span style="font-size:11px;color:var(--muted);margin-right:2px">'+tr('admin_adopt_login')+'</span>'+provChips+'</div>'
      +'</div>';
  })();

  // ── cohort retention (admin/retention, เพิ่ม 2026-08-31) — ตัวเดียวที่ตอบว่า "คนหลุดตอนไหน" ──
  // stickiness บอกได้แค่ว่ามีปัญหา แต่หลุดสัปดาห์แรกกับหลุดเดือนที่สองแก้คนละเรื่องกันสิ้นเชิง
  // ⚠️ ช่องว่างมี 2 ความหมาย และทั้งคู่ "ไม่ใช่ 0%":
  //    k < fromWeek = สัปดาห์นั้นผ่านไปก่อนเราเริ่มเก็บ · k > maxWeek = ยังมาไม่ถึง
  const retentionSection=(()=>{
    const R=window._adminRetention;
    const grid=(R&&Array.isArray(R.grid))?R.grid:[];
    if(!grid.length) return '';
    // รุ่นที่ช่องแรกที่วัดได้อยู่เลยคอลัมน์สุดท้าย (W7) จะได้แถวว่างล้วน — ตัดทิ้งไปเลย
    // ไม่งั้นรุ่นเก่าๆ จะกลายเป็นแถวจุดเรียงกันที่ไม่ได้บอกอะไร แล้วกลบรุ่นที่อ่านได้จริง
    const rows=grid.filter(g=>(g.fromWeek||0)<=7).slice(0,8);
    if(!rows.length) return '';
    const maxCol=Math.min(7,Math.max.apply(null,rows.map(g=>g.maxWeek||0)));
    const cols=[]; for(let k=0;k<=maxCol;k++) cols.push(k);
    const blank='<td style="padding:6px 4px;text-align:center;color:#334155">·</td>';
    const body=rows.map(g=>{
      const size=g.size||0;
      let prev=null;
      const tds=cols.map(k=>{
        if(k<(g.fromWeek||0)||k>(g.maxWeek||0)) return blank;
        const n=(g.weeks||{})[String(k)]||0;
        const pct=size?Math.round(n/size*100):0;
        // ตกจากช่องที่วัดได้ก่อนหน้าเกิน 40 จุด = จุดที่คนหลุด (แนวเดียวกับ funnel ของ landing)
        const drop=(prev!=null&&prev-pct>40);
        prev=pct;
        const col=pct>=50?'#10b981':pct>=20?'#f59e0b':pct>0?'#818cf8':'#ef4444';
        return '<td style="padding:6px 4px;text-align:center;font-size:11px;font-weight:700;color:'+col
          +';background:'+col+(drop?'2e':'14')+(drop?';box-shadow:inset 0 0 0 1px rgba(239,68,68,.55)':'')+'">'
          +pct+'%<span style="display:block;font-size:9px;font-weight:400;color:var(--muted)">'+n+'</span></td>';
      }).join('');
      return '<tr><td style="padding:6px 8px;font-size:11px;white-space:nowrap">'+g.cohort
        +'<span style="color:var(--muted);font-size:10px"> · '+size+' '+tr('admin_ret_people')+'</span></td>'+tds+'</tr>';
    }).join('');
    // ทุกแถวมีช่องที่วัดได้แค่ช่องเดียว = เพิ่งเริ่มเก็บ ยังอ่านเทรนด์ไม่ได้ ต้องบอกให้ชัด
    const onlyDiagonal=rows.every(g=>(g.fromWeek||0)>=(g.maxWeek||0));
    return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:14px">'
      +'<div style="font-size:10px;font-weight:700;color:#22d3ee;text-transform:uppercase;letter-spacing:.6px">'
      +'<i class="fas fa-users" style="margin-right:5px"></i>'+tr('admin_ret_title')+'</div>'
      +'<div style="font-size:11px;color:var(--muted);margin-top:3px;line-height:1.5">'+tr('admin_ret_note')
      +(R.since?' · '+tr('admin_ret_since')+' '+R.since:'')+'</div>'
      +(onlyDiagonal?'<div style="font-size:11px;color:#f59e0b;margin-top:7px"><i class="fas fa-hourglass-half" style="margin-right:4px"></i>'+tr('admin_ret_wait')+'</div>':'')
      +'<div style="overflow-x:auto;margin-top:10px"><table style="width:100%;border-collapse:separate;border-spacing:2px;min-width:420px">'
      +'<thead><tr><th style="padding:4px 8px;font-size:10px;color:var(--muted);text-align:left">'+tr('admin_ret_cohort')+'</th>'
      +cols.map(k=>'<th style="padding:4px;font-size:10px;color:var(--muted)">W'+k+'</th>').join('')+'</tr></thead>'
      +'<tbody>'+body+'</tbody></table></div></div>';
  })();

  // ── error ที่เจอบ่อยสุด (admin/errorStats, เพิ่ม 2026-08-31) ──
  // client จับ error/unhandledrejection ส่งเข้า Firestore มาตั้งนานแล้ว แต่ report_relay.py
  // ส่ง Telegram แล้วลบทิ้งทันที → เลื่อนผ่านไปในแชท ไม่มีทางรู้ว่าตัวไหนเกิดบ่อย/กระทบกี่คน
  // ไม่มี error เลย = ซ่อนทั้งบล็อก ห้ามโชว์ "0"
  const errorSection=(()=>{
    const E=window._adminErrors;
    const errs=(E&&E.errors)?E.errors:null;
    if(!errs) return '';
    const cutoff=new Date(Date.now()-7*864e5).toISOString().slice(0,10);
    const list=Object.keys(errs).map(fp=>{
      const e=errs[fp]||{};
      const days=e.days||{};
      const hits=Object.keys(days).reduce((s,d)=>d>=cutoff?s+(days[d]||0):s,0);
      const pages=e.pages||{};
      const topPage=Object.keys(pages).sort((a,b)=>pages[b]-pages[a])[0]||'';
      return {hits,users:(e.users||[]).length,msg:e.msg||'',page:topPage,last:e.last||''};
    }).filter(x=>x.hits>0).sort((a,b)=>b.hits-a.hits).slice(0,5);
    if(!list.length) return '';
    const rows=list.map(x=>'<div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline;padding:7px 0;border-top:1px solid rgba(255,255,255,.05)">'
      +'<div style="min-width:0;flex:1">'
      +'<div style="font-size:11px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+_escHtml(x.msg)+'</div>'
      +'<div style="font-size:10px;color:var(--muted);margin-top:1px">'
      +(x.page?_escHtml(x.page)+' · ':'')+tr('admin_err_last')+' '+x.last+'</div></div>'
      +'<div style="text-align:right;white-space:nowrap">'
      +'<span style="font-size:13px;font-weight:800;color:#ef4444">'+x.hits+'</span>'
      +'<span style="font-size:10px;color:var(--muted)"> '+tr('admin_err_times')+' · '+x.users+' '+tr('admin_err_people')+'</span>'
      +'</div></div>').join('');
    return '<div style="background:var(--surface);border:1px solid rgba(239,68,68,.25);border-radius:14px;padding:16px;margin-bottom:14px">'
      +'<div style="font-size:10px;font-weight:700;color:#ef4444;text-transform:uppercase;letter-spacing:.6px">'
      +'<i class="fas fa-bug" style="margin-right:5px"></i>'+tr('admin_err_title')+'</div>'
      +'<div style="font-size:11px;color:var(--muted);margin-top:3px;line-height:1.5">'+tr('admin_err_note')+'</div>'
      +'<div style="margin-top:6px">'+rows+'</div></div>';
  })();

  return `
  <div style="margin:24px 0 10px;font-size:15px;font-weight:800"><i class="fas fa-database" style="color:#a78bfa"></i> ${tr('admin_server_usage')}</div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:14px">
    ${statCard((t.txCount||0).toLocaleString(),tr('admin_total_tx'),'#a78bfa')}
    ${statCard(fmtB(t.netWorthSum),tr('admin_total_nw'),'#10b981')}
    ${statCard((t.activeUsers||0),tr('admin_has_real_data'),'#06b6d4')}
    ${statCard((t.avgTx||0).toLocaleString(),tr('admin_avg_tx_per_user'),'#f59e0b')}
  </div>
  ${adoptionSection}
  ${retentionSection}
  ${errorSection}
  ${(window._adminHistory&&window._adminHistory.length>1)?`
  <div style="background:linear-gradient(135deg,rgba(16,185,129,.08),rgba(16,185,129,.02));border:1px solid rgba(16,185,129,.22);border-radius:14px;padding:16px;margin-bottom:14px">
    <div style="font-size:10px;font-weight:700;color:#10b981;text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px"><i class="fas fa-chart-area" style="margin-right:5px"></i>${tr('admin_nw_trend')}</div>
    <div style="position:relative;height:140px;width:100%"><canvas id="admin-nw-trend-chart"></canvas></div>
  </div>`:''}
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;margin-bottom:8px">
    <div style="padding:14px 16px;font-size:13px;font-weight:700;border-bottom:1px solid var(--border);display:flex;justify-content:space-between"><span>${tr('admin_usage_per_user')}</span><span style="font-size:11px;color:var(--muted);font-weight:400">${tr('bank_updated')}: ${upd}</span></div>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:rgba(255,255,255,.03)">
        ${th('user',tr('admin_user'))}
        ${th('tx',tr('cal_items'),'right')}
        ${th('assets',tr('bs_total_assets'),'right')}
        ${th('debts',tr('bs_total_debts'),'right')}
        ${th('nw','Net Worth','right')}
        ${th('age',tr('bs_age'),'right')}
        ${th('job',tr('prof_job_title'))}
        ${th('last',tr('admin_last_tx'))}
        <th style="padding:9px 14px;font-size:11px;color:var(--muted);text-align:left">${tr('admin_features_used')}</th>
        ${th('aiquota',tr('admin_ai_quota'),'right')}
      </tr></thead><tbody>${urows}</tbody></table></div>
  </div>`;
}

// ── การ์ด "ยอดเข้าชมเว็บ" ในหน้า Admin (ข้อมูลจาก GoatCounter ผ่าน /v1/sitestats) ──
// ⚠️ ตัวเลขเป็น pageviews ไม่ใช่จำนวนคน — GoatCounter v2.7 ล้างตาราง hits (ที่มี first_visit)
// ทิ้งหลัง aggregate เหลือแค่ยอดรวมต่อ path ต่อชั่วโมง จึงนับ unique visitor ย้อนหลังไม่ได้
// ห้ามเปลี่ยนป้ายเป็น "คน" จนกว่าจะมีแหล่งข้อมูลที่นับ unique ได้จริง
let _adminVisitorsChart=null;
const _ADMIN_PATH_LABEL={'/':'admin_views_app','/landing.html':'admin_views_landing_th','/landing-en.html':'admin_views_landing_en'};
function _renderAdminSiteStats(st,signups){
  const box=inner=>'<div style="background:linear-gradient(135deg,rgba(6,182,212,.1),rgba(6,182,212,.03));border:1px solid rgba(6,182,212,.22);border-radius:14px;padding:16px;margin-bottom:16px">'
    +'<div style="font-size:10px;font-weight:700;color:#06b6d4;text-transform:uppercase;letter-spacing:.6px"><i class="fas fa-globe" style="margin-right:5px"></i>'+tr('admin_web_views')+'</div>'
    +inner+'</div>';
  if(!st||!Array.isArray(st.days)||!st.days.length)
    return box('<div style="font-size:12px;color:var(--muted);margin-top:9px"><i class="fas fa-triangle-exclamation" style="margin-right:5px"></i>'+tr('admin_views_unavailable')+'</div>');
  const nf=n=>Number(n||0).toLocaleString('en-US');
  const chip=(label,val)=>'<span style="color:var(--muted)">'+label+' <b style="color:var(--text);font-weight:800">'+nf(val)+'</b></span>';
  const chipEl=(txt,strong)=>'<span style="font-size:10px;padding:2px 8px;border-radius:8px;background:rgba(255,255,255,.05);color:'
    +(strong?'var(--text)':'var(--muted)')+'">'+txt+'</span>';
  // ── เทียบกับ 7 วันก่อนหน้า — ตัวเลขเดี่ยวๆ ตอบไม่ได้ว่า "ที่แก้ไปได้ผลไหม" ──
  // ⚠️ lowerBetter ต้องส่งให้ถูก: bounce rate ลดลง = ดี ถ้าลืมสีจะกลับด้านและอ่านผิดทันที
  // prev = 0 หรือไม่มี = ไม่มีฐานเทียบ ต้องไม่แสดงอะไรเลย ห้ามโชว์ 100% หรือ ∞
  const pv=st.prev||null;
  const delta=(cur,prv,lowerBetter)=>{
    if(prv===null||prv===undefined||!isFinite(prv)||prv===0||cur===null||cur===undefined) return '';
    const pct=Math.round((cur-prv)/prv*1000)/10;
    if(pct===0) return '<span style="font-size:10px;color:var(--muted);margin-left:4px">–</span>';
    const up=pct>0, good=lowerBetter?!up:up;
    return '<span style="font-size:10px;font-weight:800;margin-left:4px;color:'+(good?'#34d399':'#f87171')+'">'
      +(up?'\u25b2':'\u25bc')+Math.abs(pct)+'%</span>';
  };
  const pages=(st.byPage||[]).slice(0,4);
  const maxPage=pages.length?Math.max(...pages.map(r=>r.views||0),1):1;
  const pageRows=pages.map(r=>{
    const key=_ADMIN_PATH_LABEL[r.path];
    const label=key?tr(key):r.path;
    const w=Math.max(2,Math.round((r.views||0)/maxPage*100));
    return '<div style="margin-top:8px">'
      +'<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">'
      +'<span style="color:var(--muted)">'+label+'</span><span style="font-weight:700">'+nf(r.views)+'</span></div>'
      +'<div class="pbar"><div class="pfill" style="width:'+w+'%;background:#06b6d4"></div></div></div>';
  }).join('');
  // ── อยู่บนเว็บนานแค่ไหน (จาก beacon ของเราเอง /v1/visit — GoatCounter ไม่มีข้อมูลนี้เลย) ──
  // ⚠️ session ที่เปิดแล้วปิดเลยมี duration 0 และถูกนับรวมด้วยโดยตั้งใจ (คือคนที่เด้งออก)
  // ถ้าตัดทิ้งเพราะดู "ไม่สมบูรณ์" ตัวเลขจะสวยเกินจริงทันที
  const vis=Array.isArray(st.visitors)?st.visitors:[];
  const hasPeople=vis.some(v=>(v.people||0)>0);
  const fmtDur=sec=>{ sec=Math.round(sec||0);
    return sec<60?sec+' '+tr('admin_v_sec'):Math.floor(sec/60)+' '+tr('admin_v_min')+(sec%60?' '+(sec%60)+' '+tr('admin_v_sec'):''); };
  const dur=st.dur;
  const durSection=(dur&&dur.n)?(function(){
    const labels=[tr('admin_v_b1'),tr('admin_v_b2'),tr('admin_v_b3'),tr('admin_v_b4')];
    const colors=['#f87171','#fbbf24','#34d399','#06b6d4'];
    const bmax=Math.max(...dur.buckets,1);
    return '<div style="margin-top:16px;padding-top:13px;border-top:1px solid rgba(255,255,255,.07)">'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:10px;flex-wrap:wrap">'
      +'<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.6px">'
        +'<i class="fas fa-hourglass-half" style="margin-right:5px"></i>'+tr('admin_v_dur_title')+'</div>'
      +'<div style="font-size:11px;color:var(--muted)">'+tr('admin_v_dur_avg')+' '+fmtDur(dur.avgSec)
        +(st.bounceRate===null||st.bounceRate===undefined?'':' · '+tr('admin_v_bounce')+' <b style="color:#f87171;font-weight:800">'+st.bounceRate+'%</b>'
          +delta(st.bounceRate,pv&&pv.bounceRate,true))
      +'</div></div>'
      +'<div style="display:flex;align-items:baseline;gap:8px;margin-top:6px">'
      +'<span style="font-size:22px;font-weight:900;color:#34d399;line-height:1.1">'+fmtDur(dur.medianSec)+'</span>'
      +delta(dur.medianSec,pv&&pv.medianSec,false)
      +'<span style="font-size:11px;color:var(--muted)">'+tr('admin_v_dur_median')+'</span></div>'
      +dur.buckets.map(function(b,i){
        const w=Math.max(2,Math.round(b/bmax*100));
        return '<div style="margin-top:7px">'
          +'<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">'
          +'<span style="color:var(--muted)">'+labels[i]+'</span><span style="font-weight:700">'+nf(b)+'</span></div>'
          +'<div class="pbar"><div class="pfill" style="width:'+w+'%;background:'+colors[i]+'"></div></div></div>';
      }).join('')
      +'<div style="font-size:10px;color:var(--muted);margin-top:7px;line-height:1.6">'+tr('admin_v_dur_note')+'</div>'
      +'</div>';
  })():'';

  // ── อ่านหน้าแนะนำถึงตรงไหนแล้วเลิก ──
  // funnel = "เลื่อนถึงอย่างน้อยส่วนนี้" ตัวเลขจึงลดหลั่นเสมอ ส่วนที่ตกแรงที่สุด = จุดที่ควรไปแก้
  // ⚠️ ลำดับมาจาก LANDING_SECTIONS ฝั่ง server แล้ว ห้ามเรียงใหม่ที่นี่
  const fn=Array.isArray(st.funnel)?st.funnel:[];
  const funnelSection=fn.length?(function(){
    const labels=tr('admin_v_sec_labels').split(',');
    const top=fn[0].sessions||1;
    const ctaLabels=tr('admin_v_cta_labels').split(',');
    const ctaKey={app:0,ios:1,android:2};
    const cta=(st.ctaClicks||[]).filter(c=>ctaKey[c.cta]!==undefined);
    return '<div style="margin-top:16px;padding-top:13px;border-top:1px solid rgba(255,255,255,.07)">'
      +'<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:2px">'
      +'<i class="fas fa-arrow-down-wide-short" style="margin-right:5px"></i>'+tr('admin_v_funnel')+'</div>'
      +fn.map(function(r,i){
        const pct=Math.round((r.sessions||0)/top*100);
        // ตกจากขั้นก่อนหน้าเกิน 25% = จุดที่คนเลิกอ่านจริงจัง ทำให้เห็นด้วยตาทันที
        const drop=i>0?((fn[i-1].sessions||0)-(r.sessions||0))/Math.max(1,fn[i-1].sessions||1):0;
        return '<div style="margin-top:7px">'
          +'<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">'
          +'<span style="color:var(--muted)">'+(labels[i]||r.section)+'</span>'
          +'<span style="font-weight:700">'+pct+'% <span style="color:var(--muted);font-weight:400;font-size:10px">('+nf(r.sessions)+')</span></span></div>'
          +'<div class="pbar"><div class="pfill" style="width:'+Math.max(2,pct)+'%;background:'
          +(drop>0.25?'#f87171':'#34d399')+'"></div></div></div>';
      }).join('')
      +(cta.length?'<div style="margin-top:11px;font-size:10px;color:var(--muted)">'+tr('admin_v_cta')+'</div>'
        +'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:5px">'
        +cta.map(c=>chipEl(ctaLabels[ctaKey[c.cta]]+' '+nf(c.sessions),true)).join('')+'</div>':'')
      +'<div style="font-size:10px;color:var(--muted);margin-top:7px;line-height:1.6">'+tr('admin_v_funnel_note')+'</div>'
      +'</div>';
  })():'';

  // ── แหล่งที่มาของทราฟฟิก — ไม่มีข้อมูลก็ซ่อนทั้งก้อน ไม่โชว์หัวข้อว่างๆ ──
  // 'เข้าตรง' แยกออกมาต่อท้ายเป็นสีจาง เพราะเป็นก้อนใหญ่สุดเสมอ ถ้าเอาไปเรียงปนกับช่องทางจริง
  // จะกินพื้นที่อันดับ 1 ตลอดโดยไม่บอกอะไรเลย
  // ── ผู้เข้าชมใช้เครื่องอะไร / มาจากไหน ──
  // จงใจไม่ทำกราฟ: ข้อมูลชุดนี้ดูครั้งเดียวก็ตัดสินใจได้ (mobile-first ไหม, ควรดูแล landing EN ต่อไหม)
  // ไม่ใช่ตัวเลขที่ต้องเฝ้าดูรายวัน — chip แถวเดียวพอ
  const ff=st.formFactor||{};
  const ffTotal=(ff.mobile||0)+(ff.desktop||0);
  // แถบ 24 ชั่วโมง — มาจาก hit_counts ที่เก็บเป็นราย "ชั่วโมง" อยู่แล้ว ไม่ต้องเก็บอะไรใหม่
  const hrs=Array.isArray(st.hours)&&st.hours.length===24?st.hours:null;
  const hoursStrip=hrs&&hrs.some(x=>x>0)?(function(){
    const hmax=Math.max(...hrs,1);
    return '<div style="margin-top:12px"><div style="font-size:10px;color:var(--muted);margin-bottom:5px">'+tr('admin_v_hours')+'</div>'
      +'<div style="display:flex;align-items:flex-end;gap:2px;height:34px">'
      +hrs.map(function(v,h){
        return '<div title="'+h+':00 — '+nf(v)+'" style="flex:1;min-width:0;height:'+Math.max(4,Math.round(v/hmax*100))+'%;'
          +'background:'+(v?'rgba(6,182,212,.55)':'rgba(255,255,255,.06)')+';border-radius:2px"></div>';
      }).join('')+'</div>'
      +'<div style="display:flex;justify-content:space-between;font-size:9px;color:var(--muted);margin-top:3px">'
      +'<span>0</span><span>6</span><span>12</span><span>18</span><span>23</span></div></div>';
  })():'';
  const devParts=[];
  if(ffTotal) devParts.push(chipEl(tr('admin_dev_mobile')+' '+Math.round((ff.mobile||0)/ffTotal*100)+'%',true),
                             chipEl(tr('admin_dev_desktop')+' '+Math.round((ff.desktop||0)/ffTotal*100)+'%'));
  (st.os||[]).slice(0,4).forEach(o=>devParts.push(chipEl(o.name+' '+nf(o.views))));
  (st.countries||[]).slice(0,3).forEach(c=>devParts.push(chipEl('🌏 '+c.code+' '+nf(c.views))));
  const devSection=devParts.length?(
    '<div style="margin-top:16px;padding-top:13px;border-top:1px solid rgba(255,255,255,.07)">'
    +'<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px">'
    +'<i class="fas fa-mobile-screen" style="margin-right:5px"></i>'+tr('admin_dev_title')+'</div>'
    +'<div style="display:flex;gap:6px;flex-wrap:wrap">'+devParts.join('')+'</div>'+hoursStrip+'</div>'):'';

  // ── conversion: เข้าหน้าแนะนำ -> สมัคร ──
  // ตั้งใจไม่ทำเป็นกราฟรายวัน: ยอด landing จริงต่อวันเป็นหลักหน่วย (0-27) กราฟ % รายวัน
  // จะแกว่ง 0%/100% เป็นสัญญาณรบกวนล้วนๆ ดูเป็นช่วง 7/30 วันมีความหมายกว่ามาก
  const convRow=(label,views,signed,signedPrev)=>{
    const pct=views>0?Math.round(signed/views*1000)/10:null;
    return '<div style="display:flex;justify-content:space-between;gap:10px;font-size:11px;margin-top:5px">'
      +'<span style="color:var(--muted)">'+label+'</span>'
      +'<span><b style="font-weight:800">'+nf(views)+'</b> <span style="color:var(--muted)">'+tr('admin_conv_views')+'</span>'
      +' <i class="fas fa-arrow-right" style="font-size:9px;color:var(--muted);margin:0 3px"></i> '
      +'<b style="font-weight:800">'+nf(signed)+'</b> <span style="color:var(--muted)">'+tr('admin_conv_signups')+'</span>'
      +delta(signed,signedPrev,false)
      +(pct===null?'':' <span style="color:#f59e0b;font-weight:800">('+pct+'%)</span>')+'</span></div>';
  };
  const convSection=(signups&&(st.landingD30||st.landingD7))?(
    '<div style="margin-top:16px;padding-top:13px;border-top:1px solid rgba(255,255,255,.07)">'
    +'<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.6px">'
    +'<i class="fas fa-filter" style="margin-right:5px"></i>'+tr('admin_conv_title')+'</div>'
    +convRow(tr('admin_views_7d'),st.landingD7||0,signups.d7||0,signups.prev7)
    +convRow(tr('admin_views_30d'),st.landingD30||0,signups.d30||0)
    +'<div style="font-size:10px;color:var(--muted);margin-top:7px;line-height:1.6">'+tr('admin_conv_note')+'</div>'
    +'</div>'):'';
  const srcs=st.refs||[];
  const srcMax=srcs.length?Math.max(...srcs.map(x=>x.views||0),1):1;
  const refQ={}; (st.refQuality||[]).forEach(q=>{ refQ[String(q.source||'').toLowerCase()]=q; });
  const camps=(st.campaigns||[]).slice(0,6);
  const srcSection=(srcs.length||st.direct)?(
    '<div style="margin-top:16px;padding-top:13px;border-top:1px solid rgba(255,255,255,.07)">'
    +'<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:2px">'
    +'<i class="fas fa-diagram-project" style="margin-right:5px"></i>'+tr('admin_views_sources')+'</div>'
    +srcs.map(r=>{
      const w=Math.max(2,Math.round((r.views||0)/srcMax*100));
      // ต่อท้ายด้วย "กี่คน · อยู่นานเท่าไร" ถ้ามีข้อมูลจาก beacon — ตอบว่าช่องทางไหนได้คน
      // ที่อยู่จริง ไม่ใช่แค่ยอดคลิกเยอะแล้วเด้งออกทันที (ไม่มีข้อมูลก็ไม่ขึ้นบรรทัดนี้)
      const q=refQ[String(r.source||'').toLowerCase()];
      return '<div style="margin-top:8px">'
        +'<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">'
        +'<span style="color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60%">'+r.source+'</span>'
        +'<span style="font-weight:700">'+nf(r.views)
        +(q?'<span style="color:var(--muted);font-weight:400;font-size:10px"> · '+nf(q.people)+' '+tr('admin_v_people')
            +' · '+fmtDur(q.avgSec)+'</span>':'')
        +'</span></div>'
        +'<div class="pbar"><div class="pfill" style="width:'+w+'%;background:#818cf8"></div></div></div>';
    }).join('')
    +(st.direct?'<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-top:10px">'
      +'<span>'+tr('admin_views_direct')+'</span><span>'+nf(st.direct)+'</span></div>':'')
    +(camps.length?'<div style="margin-top:11px;font-size:10px;color:var(--muted)">'+tr('admin_v_campaign')+'</div>'
      +'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:5px">'
      +camps.map(c=>chipEl(c.utm+' '+nf(c.people)+' '+tr('admin_v_people'),true)).join('')+'</div>':'')
    // ── ช่องทางไหนได้ "คนที่สมัครแล้วอยู่ยาว" (เพิ่ม 2026-08-31) ──
    // แถวด้านบนมาจาก visit_sessions ที่ไม่ผูกกับใคร ตอบได้แค่ "คนเข้าเว็บมาจากไหน"
    // ส่วนตรงนี้ผูกกับบัญชีจริง (members.acqSource) จึงตอบต่อได้ว่าสมัครกี่คน ยังใช้อยู่กี่คน
    // ⚠️ นับเฉพาะคนที่สมัครหลังวันเริ่มเก็บ — บัญชีเก่าไม่มี field นี้และย้อนหลังไม่ได้
    +(()=>{
      const acq=((window._adminSummary||{}).totals||{}).acquisition||[];
      if(!acq.length) return '';
      return '<div style="margin-top:13px;padding-top:11px;border-top:1px solid rgba(255,255,255,.07)">'
        +'<div style="font-size:10px;color:var(--muted);line-height:1.5">'+tr('admin_acq_note')+'</div>'
        +acq.slice(0,8).map(a=>{
          const col=a.activePct>=50?'#10b981':a.activePct>=20?'#f59e0b':'#ef4444';
          return '<div style="display:flex;justify-content:space-between;gap:10px;font-size:11px;margin-top:6px">'
            +'<span style="color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:55%">'+_escHtml(a.source)+'</span>'
            +'<span style="white-space:nowrap"><span style="font-weight:700">'+a.signups+'</span>'
            +'<span style="color:var(--muted)"> '+tr('admin_acq_signups')+' · </span>'
            +'<span style="font-weight:700;color:'+col+'">'+a.active7d+'</span>'
            +'<span style="color:var(--muted)"> '+tr('admin_acq_still')+' ('+a.activePct+'%)</span></span></div>';
        }).join('')+'</div>';
    })()
    +'</div>'):'';
  // หัวการ์ด: ตัวใหญ่ = "คน" (สิ่งที่อยากรู้จริง) ตัวรอง = ยอดเปิดหน้าแบบเดิม
  // ⚠️ beacon เพิ่งเริ่มเก็บ 2026-08-27 — วันก่อนหน้านั้นไม่มีข้อมูลคนเลย ถ้ายังไม่มีข้อมูล
  // ต้องถอยไปโชว์ยอดเปิดหน้าเป็นตัวใหญ่เหมือนเดิม ห้ามโชว์ '0 คน' ให้เข้าใจผิดว่าไม่มีใครเข้า
  const todayPeople=vis.length?(vis[vis.length-1].people||0):0;
  const bigNum=hasPeople?todayPeople:st.today;
  const bigLbl=hasPeople?tr('admin_v_people'):tr('admin_v_pageviews');
  const headChips=[chip(tr('admin_views_yesterday'),st.yesterday),chip(tr('admin_views_7d'),st.d7),chip(tr('admin_views_30d'),st.d30)];
  if(hasPeople) headChips.unshift(chip(tr('admin_v_people_7d'),st.peopleD7)
    +delta(st.peopleD7,pv&&pv.people,false)
    +(pv?'<span style="font-size:10px;color:var(--muted);margin-left:4px">('+tr('admin_v_vs_prev')+')</span>':''));
  return box(
     '<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-top:6px">'
    +'<div style="font-size:11px;color:var(--muted);max-width:320px;line-height:1.6">'
      +tr(hasPeople?'admin_views_note':'admin_v_people_note')+'</div>'
    +'<div style="text-align:right"><div style="font-size:26px;font-weight:900;color:#06b6d4;line-height:1.1">'+nf(bigNum)+'</div>'
    +'<div style="font-size:11px;color:var(--muted)">'+bigLbl+' · '+tr('admin_views_today')+'</div>'
    +(hasPeople?'<div style="font-size:10px;color:var(--muted);margin-top:2px">'+tr('admin_v_pageviews')+' '+nf(st.today)+'</div>':'')
    +'</div></div>'
    +'<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:11px;margin:10px 0 12px">'+headChips.join('')+'</div>'
    +'<div style="position:relative;height:120px;width:100%"><canvas id="admin-visitors-chart"></canvas></div>'
    +pageRows+durSection+funnelSection+convSection+srcSection+devSection);
}
// กราฟแท่ง 30 วัน — ต้อง destroy ตัวเดิมก่อนเสมอ เพราะ renderAdmin() แทน innerHTML ทั้งก้อน
// (canvas เดิมถูกทิ้ง แต่ instance ของ Chart.js ยังอ้าง context เก่าค้างอยู่ ทำให้กราฟไม่ขึ้น/ซ้อน)
function _drawAdminVisitorsChart(st){
  try{
    if(_adminVisitorsChart){ _adminVisitorsChart.destroy(); _adminVisitorsChart=null; }
    const cv=document.getElementById('admin-visitors-chart');
    if(!cv||!window.Chart||!st||!Array.isArray(st.days)||!st.days.length) return;
    // เส้น "คน" ขึ้นเฉพาะเมื่อมีข้อมูลจริง — beacon เพิ่งเริ่มเก็บ ถ้าใส่ตลอดจะได้เส้นแบน 0
    // ทอดยาวตลอดกราฟ ซึ่งอ่านผิดเป็น "ไม่มีคนเข้าเลย" ทั้งที่แค่ยังไม่ได้เก็บ
    const vis=Array.isArray(st.visitors)?st.visitors:[];
    const hasPeople=vis.some(v=>(v.people||0)>0);
    const dsets=[{label:tr('admin_v_pageviews'),data:st.days.map(d=>d.views),backgroundColor:'rgba(6,182,212,.55)',borderRadius:3,order:2}];
    // วันก่อนที่ beacon จะเริ่มเก็บ = "ไม่มีข้อมูล" ไม่ใช่ "0 คน" — ส่ง null ให้ Chart.js เว้นช่วง
    // ไม่งั้นจะได้เส้นแบนติดพื้นทอดยาว ซึ่งอ่านผิดเป็นไม่มีใครเข้าเลยทั้งเดือน
    const firstReal=vis.findIndex(v=>(v.people||0)>0);
    if(hasPeople) dsets.push({label:tr('admin_v_people'),
      data:vis.map((v,i)=>i<firstReal?null:(v.people||0)),type:'line',spanGaps:false,
      borderColor:'#f59e0b',backgroundColor:'#f59e0b',borderWidth:2,pointRadius:0,tension:.3,order:1});
    _adminVisitorsChart=new Chart(cv,{type:'bar',
      data:{labels:st.days.map(d=>d.date.slice(5)),datasets:dsets},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:hasPeople,labels:{color:_chartTickColor(),boxWidth:10,font:{size:10}}}},
        scales:{y:{beginAtZero:true,ticks:{color:_chartTickColor(),precision:0},grid:{color:_chartGridColor(.1)}},
                x:{ticks:{color:_chartTickColor(),maxTicksLimit:8},grid:{display:false}}}}});
  }catch(e){ console.error('admin visitors chart',e); }
}

async function _renderAdminReal(){
  const el=document.getElementById('admin-content');
  if(!el) return;
  window._adminUserSort={key:'created',dir:'desc'}; // เรียงเริ่มต้น: วันสมัคร ใหม่ → เก่า (ตรงกับ members.sort ด้านล่าง)
  window._adminShowTest=false; // reset ทุกครั้งที่ render ใหม่ ให้ตรงกับ checkbox ที่วาดใหม่ (unchecked เสมอ)
  // เฉพาะ owner เท่านั้น
  if(!_ENC||currentUser!==_ENC.user){
    el.innerHTML='<div style="padding:40px;text-align:center;color:var(--muted)"><i class="fas fa-lock" style="font-size:48px;margin-bottom:16px;display:block"></i>'+tr('admin_no_access')+'</div>';
    return;
  }
  el.innerHTML='<div style="padding:20px 0"><div class="spinner" style="margin:0 auto 12px"></div><div style="text-align:center;color:var(--muted);font-size:13px">'+tr('admin_loading')+'</div></div>';
  if(!_fs){ el.innerHTML='<div style="padding:20px;color:var(--red)">'+tr('admin_fb_not_ready')+'</div>'; return; }
  try{
    const _sitePendingStats=_fetchSiteStats(); // ยิงทันที รอผลทีหลัง (ไม่บล็อก Firestore)
    // ดึง members ทั้งหมด
    const snap=await _fs.collection('members').get();
    // expoPushToken ย้ายไป memberPrivate (2026-09-19) — owner อ่านได้ตาม rules; ของเก่าใน members ยังนับเป็น fallback
    const _pushSet=new Set();
    try{ (await _fs.collection('memberPrivate').get()).forEach(function(pd){ if(pd.data()&&pd.data().expoPushToken) _pushSet.add(pd.id); }); }catch(e){}
    const now=Date.now();
    const members=[];
    snap.forEach(doc=>{
      const d=doc.data();
      members.push({
        id:doc.id,
        username:d.username||doc.id,
        email:d.email||'',
        createdAt:d.createdAt?.toDate?.()||null,
        lastSeen:d.lastSeen?.toDate?.()||null,
        isOwner:d.isOwner||false,
        platform:d.platform||'web',
        currentPlatform:d.currentPlatform||'',
        // field เพิ่ม (2026-08-25) สำหรับแถบ "ฟีเจอร์ไหนมีคนใช้จริง" — อยู่ใน doc อยู่แล้ว
        // แค่ไม่เคย map ออกมา ไม่ต้องยิง Firestore เพิ่มเลยสักครั้ง
        lineUserId:d.lineUserId||'',
        lineFriend:d.lineFriend===true,
        provider:d.provider||'',
        hasPush:_pushSet.has(doc.id)||!!d.expoPushToken,
        subActive:d.subscriptionActive===true
      });
    });
    // เรียงจากใหม่ → เก่า
    members.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    // 🐛 2026-08-07: ตรวจ churn/stickiness จริงแล้วพบว่า 14/21 บัญชีเป็นบัญชีทดสอบ/เดโม่ที่สร้างไว้
    // ระหว่างพัฒนา (test1-5, testuser, demo ฯลฯ) ปนอยู่กับ user จริง ทำให้สถิติเพี้ยนหนัก — ตรวจ userdata
    // จริงยืนยันแล้วว่า best_05/warakorn_k มีข้อมูล 0 รายการเหมือนบัญชีทดสอบอื่นๆ (ต่างจาก yok07 ที่ไม่มีรูปแบบ
    // ชื่อคล้าย test เลยแต่มี 31 transaction จริง — ไม่ใช่บัญชีทดสอบ ไม่กรองออก) ใช้ pattern ชื่อ/อีเมลเป็นหลัก
    // ไม่ใช้ "ไม่มี transaction" เป็นเกณฑ์กรอง เพราะ user ใหม่จริงที่ยังไม่ activate ก็มี 0 tx เหมือนกัน
    // (อยากเห็นคนกลุ่มนี้ในสถิติต่อ ไม่อยากให้หายไปเงียบๆ)
    const _isTestAccount=m=>{
      const u=(m.username||'').toLowerCase(), e=(m.email||'').toLowerCase();
      if(_ENC&&u===_ENC.user.toLowerCase()) return true; // owner
      if(/test|demo/.test(u)||/test|demo/.test(e)) return true; // test1-5, testuser, testerios, traveltestuser, demo, demo_6815
      if(/warakorn/.test(u)) return true; // warakorn_k — บัญชี Google สำรองของ owner
      if(u==='best_05') return true; // ตรวจ userdata แล้ว 0 รายการ + อีเมลโยงกับ owner — เข้าข่ายบัญชีทดสอบ
      if(/^[a-z]+\.\d{5}@gmail\.com$/.test(e)) return true; // บัญชีรีวิว Google Play (14 บัญชี ชื่อนามสกุล.เลข5หลัก) — ต้องตรงกับ admin_stats.is_test_account()
      return false;
    };
    members.forEach(m=>{ m.isTest=_isTestAccount(m); });
    const realMembers=members.filter(m=>!m.isTest);
    window._adminMembers=members; // เก็บ list เต็มไว้ให้ตาราง/ค้นหา/export CSV เห็นครบทุกบัญชี

    // ── Part C: usage รวมจากฝั่งเซิร์ฟเวอร์ (admin/summary เขียนโดย admin_stats.py ผ่าน SA) ──
    let summary=null;
    try{ const sd=await _fs.collection('admin').doc('summary').get(); if(sd.exists){ const raw=sd.data()||{}; summary=raw.json?JSON.parse(raw.json):raw; } }catch(e){}

    // ── snapshot รายวัน Net Worth รวม (adminHistory/{YYYY-MM-DD} เขียนโดย admin_stats.py ผ่าน SA) → กราฟเทรนด์ ──
    let history=[];
    try{
      const hs=await _fs.collection('adminHistory').orderBy('date','desc').limit(90).get();
      hs.forEach(d=>history.push(d.data()));
      history.reverse(); // เรียงเก่า→ใหม่ สำหรับกราฟ
    }catch(e){}
    window._adminHistory=history;

    // ── cohort retention + สถิติ error (เขียนโดย admin_stats.py / report_relay.py ผ่าน SA, 2026-08-31) ──
    // ยังไม่มี doc = cron รอบใหม่ยังไม่วิ่ง ไม่ใช่ error → แต่ละ section ซ่อนตัวเองไป
    window._adminRetention=null; window._adminErrors=null;
    try{
      const rd=await _fs.collection('admin').doc('retention').get();
      if(rd.exists){ const raw=rd.data()||{}; window._adminRetention=raw.json?JSON.parse(raw.json):raw; }
    }catch(e){}
    try{
      const ed=await _fs.collection('admin').doc('errorStats').get();
      if(ed.exists){ const raw=ed.data()||{}; window._adminErrors=raw.json?JSON.parse(raw.json):raw; }
    }catch(e){}

    // ── ยอดเข้าชมเว็บรายวันจาก GoatCounter (/v1/sitestats บน VM) — ยิงคู่ขนาน ไม่ต่อคิวกับ Firestore ──
    // คืน null ถ้าดึงไม่ได้ (VM ล่ม/ไม่ใช่ owner) → การ์ดโชว์สถานะแทน ไม่ทำให้หน้าทั้งหน้าล้ม
    const siteStats=await _sitePendingStats;

    const onlineMs=10*60*1000; // ออนไลน์ถ้า lastSeen ≤ 10 นาทีที่แล้ว
    const dayMs=24*3600*1000;
    const todayStart=new Date(); todayStart.setHours(0,0,0,0);
    const d7=now-7*dayMs, d30=now-30*dayMs;

    // สถิติทั้งหมดคำนวณจาก realMembers (กรองบัญชีทดสอบ/เดโม่ออกแล้ว) ให้ DAU/MAU/churn/stickiness สะท้อน user จริง
    const total=realMembers.length;
    const testCount=members.length-realMembers.length;
    const online=realMembers.filter(m=>m.lastSeen&&(now-m.lastSeen.getTime())<onlineMs).length;
    const dau=realMembers.filter(m=>m.lastSeen&&m.lastSeen.getTime()>=todayStart.getTime()).length;
    const wau=realMembers.filter(m=>m.lastSeen&&m.lastSeen.getTime()>=d7).length;
    const mau=realMembers.filter(m=>m.lastSeen&&m.lastSeen.getTime()>=d30).length;
    const newToday=realMembers.filter(m=>m.createdAt&&m.createdAt>=todayStart).length;
    const new7=realMembers.filter(m=>m.createdAt&&m.createdAt.getTime()>=d7).length;
    const new30=realMembers.filter(m=>m.createdAt&&m.createdAt.getTime()>=d30).length;
    const churn=realMembers.filter(m=>m.lastSeen&&m.lastSeen.getTime()<d30).length;
    const never=realMembers.filter(m=>!m.lastSeen).length;
    // ── lifecycle (เพิ่ม 2026-08-31) — การ์ดเดิมโชว์แค่ "เงียบ >30 วัน" ซึ่งคือคนที่หลุดไปแล้ว
    //    กลุ่มที่ทำอะไรได้จริงคือ "เงียบ 8–30 วัน" (ยังดึงกลับได้ และส่ง LINE หาได้เพราะมี lineUserId)
    //    ⚠️ นิยามต้องตรงกับ member_stats() ใน admin_stats.py เป๊ะ — สมัครใหม่ ≤7 วันนับเป็น "ใหม่"
    //    ก่อนเสมอ เพราะยังเร็วเกินกว่าจะตัดสินว่าอยู่หรือไป (ไม่งั้นจะไปโป่งอยู่ในกลุ่ม "ใช้อยู่")
    //    คำนวณสดฝั่งนี้ ไม่ใช้ค่าจาก summary เพื่อให้ขอบเวลาตรงกับ dau/wau/mau บนการ์ดข้างกัน
    let lcNew=0,lcActive=0,lcAtRisk=0;
    realMembers.forEach(m=>{
      if(!m.lastSeen) return;                                  // never — นับแยกอยู่แล้ว
      const seen=m.lastSeen.getTime();
      if(m.createdAt&&m.createdAt.getTime()>=d7) lcNew++;
      else if(seen>=d7) lcActive++;
      else if(seen>=d30) lcAtRisk++;                           // churn นับ <d30 ไปแล้ว
    });
    const withEmail=realMembers.filter(m=>m.email&&!/@moneymind\.local$/i.test(m.email)).length;
    const stickiness=mau?Math.round(dau/mau*100):0;

    const fmtAgo=d=>{ if(!d) return '<span style="color:#475569">'+tr('admin_never')+'</span>'; const s=Math.floor((now-d.getTime())/1000); if(s<60) return '<span style="color:#10b981">'+tr('admin_just_now')+'</span>'; if(s<3600) return `<span style="color:#10b981">${Math.floor(s/60)} ${tr('admin_min_ago')}</span>`; if(s<86400) return `${Math.floor(s/3600)} ${tr('admin_hr_ago')}`; return `${Math.floor(s/86400)} ${tr('admin_day_ago')}`; };
    const onlineBadge=m=>{ if(!m.lastSeen) return ''; const ms=now-m.lastSeen.getTime(); if(ms<onlineMs) return '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981;margin-right:5px;box-shadow:0 0 6px #10b981"></span>'; return ''; };
    const platformIcon=p=>{ const mp={'web':'<i class="fas fa-globe" title="Web" style="color:#06b6d4"></i>','android':'<i class="fab fa-android" title="Android" style="color:#10b981"></i>','ios':'<i class="fab fa-apple" title="iOS" style="color:#94a3b8"></i>'}; return mp[p]||`<i class="fas fa-question-circle" style="color:#475569"></i>`; };
    const platformLabel=p=>({'web':'Web','android':'Android','ios':'iOS'}[p]||p||'-');

    // stats platform
    const webCount=realMembers.filter(m=>m.platform==='web').length;
    const androidCount=realMembers.filter(m=>m.platform==='android').length;
    const iosCount=realMembers.filter(m=>m.platform==='ios').length;
    const platMax=Math.max(webCount,androidCount,iosCount,1);
    const platRow=(label,icon,n,color)=>`<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <div style="width:30px;height:30px;border-radius:8px;background:${color}18;border:1px solid ${color}30;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <i class="${icon}" style="color:${color};font-size:13px"></i></div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
          <span style="font-size:11px;font-weight:600">${label}</span>
          <span style="font-size:13px;font-weight:800;color:${color}">${n}<span style="font-size:9px;color:var(--muted);font-weight:400;margin-left:3px">${total?Math.round(n/total*100):0}%</span></span>
        </div>
        <div style="height:4px;background:rgba(255,255,255,.06);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${n/platMax*100}%;background:linear-gradient(90deg,${color},${color}66);border-radius:4px;box-shadow:0 0 6px ${color}50"></div>
        </div>
      </div></div>`;
    const platBar=(label,n,color,icon)=>platRow(label,icon,n,color);

    // สมัครมาด้วยวิธีไหน — นับสดจาก realMembers ที่โหลดมาแล้ว ไม่ยิง Firestore เพิ่มสักครั้ง
    const loginMix={};
    realMembers.forEach(m=>{ const k=m.provider||'password'; loginMix[k]=(loginMix[k]||0)+1; });
    const loginKeys=Object.keys(loginMix).sort((a,b)=>loginMix[b]-loginMix[a]);
    const loginMixRow=loginKeys.length?`<div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.07)">
      <div style="font-size:10px;color:var(--muted);margin-bottom:7px">${tr('admin_v_signup_how')}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${loginKeys.map(k=>`<span style="font-size:10px;padding:2px 8px;border-radius:8px;background:rgba(255,255,255,.05);color:var(--text)">${k} ${loginMix[k]}</span>`).join('')}</div>
    </div>`:'';

    // growth (สมัครรายวัน → สะสม)
    const growth={};
    realMembers.forEach(m=>{ if(m.createdAt){ const k=m.createdAt.toISOString().slice(0,10); growth[k]=(growth[k]||0)+1; }});
    // แกน x = วันที่มีคนสมัคร ∪ วันที่มี snapshot รายวัน — ต้องรวมกันไม่งั้น DAU ของวันที่ไม่มีใคร
    // สมัครจะไม่มีที่ลง (และเส้นสะสมเดิมก็ได้แกนที่ต่อเนื่องขึ้นเป็นผลพลอยได้)
    const histByDate={}; (history||[]).forEach(h=>{ if(h&&h.date) histByDate[h.date]=h; });
    const gkeys=Array.from(new Set(Object.keys(growth).concat(Object.keys(histByDate)))).sort();
    let cum=0; const gcum=gkeys.map(k=>{cum+=(growth[k]||0); return cum;});
    // DAU ย้อนหลัง — เริ่มเก็บ 2026-08-31 วันก่อนหน้าต้องเป็น null ให้ Chart.js เว้นช่วง
    // (spanGaps:false) ห้าม plot 0 ไม่งั้นได้เส้นแบนติดพื้นทอดยาวซึ่งอ่านผิดเป็น "ไม่มีใครเข้าเลย"
    const gdau=gkeys.map(k=>{ const h=histByDate[k]; return (h&&h.dau!=null)?h.dau:null; });
    const hasDauHistory=gdau.some(v=>v!=null);

    const statCard=(val,label,color,sub='')=>`<div style="background:var(--surface);border:1px solid ${color}33;border-radius:14px;padding:14px;text-align:center">
      <div style="font-size:28px;font-weight:800;color:${color}">${val}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:2px">${label}</div>${sub?`<div style="font-size:10px;color:#475569;margin-top:1px">${sub}</div>`:''}</div>`;
    const statCardSm=(val,label,color,sub='',icon='')=>`<div style="background:linear-gradient(135deg,${color}18,${color}06);border:1px solid ${color}35;border-radius:12px;padding:11px 6px 9px;text-align:center;box-shadow:0 4px 18px ${color}12;transition:transform .18s,box-shadow .18s;cursor:default" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 28px ${color}28'" onmouseout="this.style.transform='';this.style.boxShadow='0 4px 18px ${color}12'">
      ${icon?`<i class="fas ${icon}" style="font-size:11px;color:${color}70;display:block;margin-bottom:3px"></i>`:''}
      <div style="font-size:21px;font-weight:900;color:${color};letter-spacing:-0.5px;line-height:1">${val}</div>
      <div style="font-size:10px;color:var(--muted);margin-top:3px;line-height:1.3">${label}</div>${sub?`<div style="font-size:9px;color:${color}99;margin-top:2px;font-weight:600">${sub}</div>`:''}</div>`;

    const avatarColors=['#a78bfa','#10b981','#06b6d4','#f59e0b','#ef4444','#34d399','#818cf8','#fbbf24'];
    const avatarColor=u=>avatarColors[u.charCodeAt(0)%avatarColors.length];
    const rows=members.map(m=>{
      const isOnline=m.lastSeen&&(now-m.lastSeen.getTime())<onlineMs;
      const curPlat=m.currentPlatform||m.platform||'web';
      const ac=avatarColor(m.username);
      const platCell=isOnline
        ?`<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.35);border-radius:20px;padding:2px 8px;font-size:10px;color:#10b981;font-weight:600">${platformIcon(curPlat)} ${platformLabel(curPlat)}</span>`
        :`<span style="display:inline-flex;align-items:center;gap:4px;color:#475569;font-size:11px">${platformIcon(m.platform)} ${platformLabel(m.platform)}</span>`;
      return `
      <tr data-u="${(m.username+' '+(m.email||'')).toLowerCase()}" data-test="${m.isTest?'1':'0'}" data-created="${m.createdAt?m.createdAt.getTime():0}" data-seen="${m.lastSeen?m.lastSeen.getTime():0}" style="border-bottom:1px solid rgba(255,255,255,.04);transition:background .15s${m.isTest?';display:none':''}" onmouseover="this.style.background='rgba(255,255,255,.025)'" onmouseout="this.style.background=''">
        <td style="padding:10px 14px">
          <div style="display:flex;align-items:center;gap:9px">
            <div style="width:30px;height:30px;border-radius:9px;background:${ac}20;border:1px solid ${ac}35;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:${ac};flex-shrink:0;position:relative">
              ${m.username[0].toUpperCase()}
              ${isOnline?`<span style="position:absolute;bottom:-2px;right:-2px;width:8px;height:8px;border-radius:50%;background:#10b981;border:1.5px solid var(--surface);box-shadow:0 0 5px #10b981"></span>`:''}
            </div>
            <div>
              <div style="font-size:12px;font-weight:700;white-space:nowrap">${m.username}${m.isOwner?' <span style="font-size:9px;background:rgba(245,158,11,.2);color:#f59e0b;padding:1px 5px;border-radius:6px">owner</span>':''}${m.isTest?' <span style="font-size:9px;background:rgba(148,163,184,.18);color:#94a3b8;padding:1px 5px;border-radius:6px">'+tr('admin_test_account')+'</span>':''}</div>
            </div>
          </div>
        </td>
        <td style="padding:10px 14px;font-size:11px;color:var(--muted);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.email||'<span style="color:#334155">—</span>'}</td>
        <td style="padding:10px 14px">${platCell}</td>
        <td style="padding:10px 14px;font-size:11px;color:var(--muted);white-space:nowrap">${m.createdAt?fmtD(m.createdAt):'<span style="color:#334155">—</span>'}</td>
        <td style="padding:10px 14px;font-size:11px;white-space:nowrap">${fmtAgo(m.lastSeen)}</td>
      </tr>`;
    }).join('');

    // ── Part C usage section — sortable table + wealth-rank badges, ห่อ id ไว้ re-render ตอน sort โดยไม่ fetch ใหม่ ──
    window._adminSummary=summary;
    window._adminRealMembers=realMembers;
    const usageSection=`<div id="admin-usage-wrap">${_renderAdminUsageSection(summary)}</div>`;
    // ยอดสมัครช่วงเทียบ = 7 วันก่อนหน้า 7 วันล่าสุด — realMembers โหลดมาแล้ว ไม่ต้องยิง Firestore เพิ่ม
    // ⚠️ ฝั่งนี้เป็นหน้าต่างแบบ rolling (นับถอยหลังจากตอนนี้) ส่วน prev ฝั่ง server เป็นราย
    // "วันปฏิทิน" — ขอบต่างกันได้ไม่เกิน 1 วัน แต่ ▲▼ ของสมัครเทียบกับ new7 ที่เป็น rolling
    // เหมือนกัน จึงยังสอดคล้องกันในตัวเอง (อย่าเอาไปเทียบข้ามกับตัวเลขคนเข้าเว็บตรงๆ)
    const prev7=realMembers.filter(m=>m.createdAt&&m.createdAt.getTime()<d7&&m.createdAt.getTime()>=d7-7*864e5).length;
    // เก็บไว้ให้ _renderAdminUsageSection ใช้ — และให้ค้างอยู่ตอน _adminSortUsage re-render ตาราง
    window._adminAppPages=(siteStats&&siteStats.appPages)||{};
    window._adminActions=(siteStats&&siteStats.actions)||{};
    const siteStatsSection=_renderAdminSiteStats(siteStats,{d7:new7,d30:new30,prev7:prev7});

    el.innerHTML=`
    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap;gap:12px">
      <div>
        <div style="font-size:24px;font-weight:900;background:linear-gradient(135deg,#f59e0b,#fcd34d);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;letter-spacing:-0.5px">⚡ Admin Dashboard</div>
        <div style="font-size:12px;color:var(--muted);margin-top:3px">
          <span style="color:#10b981;font-weight:700">${online} ${tr('admin_online')}</span>
          <span style="color:rgba(255,255,255,.15);margin:0 6px">·</span>
          ${total} ${tr('admin_users')}
          <span style="color:rgba(255,255,255,.15);margin:0 6px">·</span>
          <span style="color:#a78bfa">stickiness ${stickiness}%</span>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="renderAdmin()" style="background:rgba(167,139,250,.12);border:1px solid rgba(167,139,250,.3);color:#a78bfa;cursor:pointer;font-size:11px;font-family:Sarabun,sans-serif;padding:7px 14px;border-radius:9px;transition:background .2s" onmouseover="this.style.background='rgba(167,139,250,.22)'" onmouseout="this.style.background='rgba(167,139,250,.12)'"><i class="fas fa-sync-alt"></i> ${tr('update')}</button>
        <button onclick="exportAdminCsv()" style="background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.3);color:#10b981;cursor:pointer;font-size:11px;font-family:Sarabun,sans-serif;padding:7px 14px;border-radius:9px;transition:background .2s" onmouseover="this.style.background='rgba(16,185,129,.22)'" onmouseout="this.style.background='rgba(16,185,129,.12)'"><i class="fas fa-file-csv"></i> CSV</button>
      </div>
    </div>

    <!-- Stats cards: 4 per row -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">
      ${statCardSm(total,tr('admin_total_users'),'#a78bfa',new7?('+'+new7+' '+tr('admin_in_7_days')):'','fa-users')}
      ${statCardSm(online,tr('admin_online_now'),'#10b981','','fa-circle')}
      ${statCardSm(dau,tr('admin_dau_today'),'#06b6d4','stickiness '+stickiness+'%','fa-sun')}
      ${statCardSm(wau,tr('admin_wau_7d'),'#22d3ee','','fa-calendar-week')}
      ${statCardSm(mau,tr('admin_mau_30d'),'#818cf8','','fa-calendar')}
      ${statCardSm(newToday,tr('admin_signup_today'),'#f59e0b','','fa-user-plus')}
      ${statCardSm(lcAtRisk,tr('admin_lc_atrisk'),'#f59e0b',
        tr('admin_lc_active')+' '+lcActive+' · '+tr('admin_lc_dormant')+' '+churn
        +(never?(' · '+tr('admin_lc_never')+' '+never):''),'fa-user-clock')}
      ${statCardSm(withEmail,tr('admin_has_real_email'),'#34d399',total?Math.round(withEmail/total*100)+'%':'','fa-envelope')}
    </div>

    <!-- Growth chart + Platform side by side -->
    <div class="admin-growth-grid" style="display:grid;grid-template-columns:1fr 260px;gap:14px;margin-bottom:16px">
      <div style="background:linear-gradient(135deg,rgba(167,139,250,.1),rgba(99,102,241,.04));border:1px solid rgba(167,139,250,.22);border-radius:14px;padding:16px;box-shadow:0 4px 24px rgba(167,139,250,.1)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div style="font-size:10px;font-weight:700;color:#a78bfa;text-transform:uppercase;letter-spacing:.6px"><i class="fas fa-chart-line" style="margin-right:5px"></i>${tr('admin_cumulative_users')}</div>
          <div style="font-size:20px;font-weight:900;color:#a78bfa">${total}</div>
        </div>
        <div style="position:relative;height:140px;width:100%"><canvas id="admin-growth-chart"></canvas></div>
      </div>
      <div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:16px">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:14px"><i class="fas fa-mobile-alt" style="margin-right:5px"></i>${tr('admin_platform')}</div>
        ${platRow('Web','fas fa-globe',webCount,'#06b6d4')}
        ${platRow('Android','fab fa-android',androidCount,'#10b981')}
        ${platRow('iOS','fab fa-apple',iosCount,'#94a3b8')}
        ${loginMixRow}
      </div>
    </div>

    <!-- Website views (GoatCounter) -->
    ${siteStatsSection}

    <!-- User table full width -->
    <div style="background:linear-gradient(180deg,rgba(255,255,255,.025),rgba(255,255,255,.015));border:1px solid rgba(255,255,255,.08);border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.25);margin-bottom:20px">
      <div style="padding:14px 16px;background:linear-gradient(135deg,rgba(167,139,250,.12),rgba(6,182,212,.07));border-bottom:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
        <div>
          <span style="font-size:15px;font-weight:800">${tr('admin_total_users')}</span>
          <span style="font-size:11px;color:var(--muted);margin-left:7px">${total} accounts</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          ${testCount?`<label style="font-size:11px;color:var(--muted);display:flex;align-items:center;gap:5px;cursor:pointer;user-select:none"><input type="checkbox" onchange="_adminToggleTestRows(this.checked)" style="cursor:pointer;accent-color:#a78bfa"> ${tr('admin_show_test_accounts')} (${testCount})</label>`:''}
          <input type="text" oninput="filterAdminTable(this.value)" placeholder="🔍 ${tr('admin_search')}..." class="finput" style="width:180px;font-size:12px;padding:5px 10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1)">
        </div>
      </div>
      <div style="overflow-x:auto;max-height:420px;overflow-y:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead style="position:sticky;top:0;z-index:1">
            <tr style="background:rgba(10,10,25,.85);backdrop-filter:blur(8px)">
              <th style="padding:9px 14px;font-size:10px;color:var(--muted);font-weight:700;text-align:left;text-transform:uppercase;letter-spacing:.4px">${tr('admin_user')}</th>
              <th style="padding:9px 14px;font-size:10px;color:var(--muted);font-weight:700;text-align:left;text-transform:uppercase;letter-spacing:.4px">Email</th>
              <th style="padding:9px 14px;font-size:10px;color:var(--muted);font-weight:700;text-align:left;text-transform:uppercase;letter-spacing:.4px">${tr('admin_platform')}</th>
              <th id="admin-th-created" onclick="_adminSortUsers('created')" style="padding:9px 14px;font-size:10px;color:var(--muted);font-weight:700;text-align:left;text-transform:uppercase;letter-spacing:.4px;cursor:pointer;user-select:none;white-space:nowrap">${tr('admin_signup_at')}${_adminUserSortLabel('created')}</th>
              <th id="admin-th-seen" onclick="_adminSortUsers('seen')" style="padding:9px 14px;font-size:10px;color:var(--muted);font-weight:700;text-align:left;text-transform:uppercase;letter-spacing:.4px;cursor:pointer;user-select:none;white-space:nowrap">${tr('admin_last_seen')}${_adminUserSortLabel('seen')}</th>
            </tr>
          </thead>
          <tbody id="admin-user-tbody">${rows||'<tr><td colspan="5" style="padding:24px;text-align:center;color:var(--muted)">'+tr('no_data_yet')+'</td></tr>'}</tbody>
        </table>
      </div>
      ${total===0?'':'<div style="padding:9px 16px;font-size:11px;color:var(--muted);border-top:1px solid rgba(255,255,255,.06);display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#10b981;box-shadow:0 0 6px #10b981"></span> '+tr('admin_online_within_10min')+'</div>'}
    </div>

    ${usageSection}`;

    // growth chart
    try{
      if(_adminChart){ _adminChart.destroy(); _adminChart=null; }
      const cv=document.getElementById('admin-growth-chart');
      if(cv&&window.Chart&&gkeys.length){
        // เส้นสะสมเดิม + แท่งสมัครรายวันบนกราฟเดียวกัน (คนละแกน y — ยอดรายวันเป็นหลักหน่วย
        // ถ้าใช้แกนเดียวกับยอดสะสมหลักสิบจะแบนติดพื้นจนมองไม่เห็น) แกนขวาซ่อนไว้ไม่ให้รก
        _adminChart=new Chart(cv,{type:'line',
          data:{labels:gkeys.map(k=>k.slice(5)),datasets:[
            {label:tr('admin_cumulative_users'),data:gcum,borderColor:'#a78bfa',backgroundColor:'rgba(167,139,250,.15)',fill:true,tension:.3,pointRadius:2,yAxisID:'y',order:1},
            {label:tr('admin_v_signup_daily'),type:'bar',data:gkeys.map(k=>growth[k]||0),backgroundColor:'rgba(52,211,153,.45)',borderRadius:2,yAxisID:'y2',order:2},
            ...(hasDauHistory?[{label:tr('admin_hist_dau'),data:gdau,borderColor:'#06b6d4',backgroundColor:'transparent',fill:false,tension:.3,pointRadius:2,borderWidth:2,spanGaps:false,yAxisID:'y2',order:0}]:[])]},
          options:{responsive:true,maintainAspectRatio:false,
            plugins:{legend:{display:true,labels:{color:_chartTickColor(),boxWidth:10,font:{size:10}}}},
            scales:{y:{beginAtZero:true,ticks:{color:_chartTickColor(),precision:0},grid:{color:_chartGridColor(.1)}},
                    y2:{beginAtZero:true,position:'right',display:false,grid:{display:false}},
                    x:{ticks:{color:_chartTickColor(),maxTicksLimit:8},grid:{display:false}}}}});
      }
    }catch(e){ console.error('admin chart',e); }
    _drawAdminNwTrendChart(history);
    _drawAdminVisitorsChart(siteStats);
  }catch(e){
    el.innerHTML=`<div style="padding:20px;color:var(--red)"><i class="fas fa-exclamation-triangle"></i> ${tr('admin_load_failed')}: ${e.message}</div>`;
  }
}
window._renderAdminReal=_renderAdminReal;
