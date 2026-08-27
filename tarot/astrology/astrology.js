(() => {
  const $=id=>document.getElementById(id);

  async function hydrateFromMember(){
    try{const member=await window.TarotPortal.getMember();if(member?.profile?.birth_date&&!$('#astroBirthDate').value)$('#astroBirthDate').value=member.profile.birth_date;}catch{}
  }

  $('#astroForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const birthDate=$('#astroBirthDate').value;
    const form=$('#astroForm'),button=form.querySelector('button[type="submit"]'),box=$('#astroResult');
    if(!birthDate)return;
    button.disabled=true;const original=button.textContent;button.textContent='กำลังวิเคราะห์…';
    box.hidden=false;box.innerHTML='<h2>กำลังเตรียมภาพรวม…</h2><p>กำลังใช้ AI เพื่อสร้างการอ่านเชิงโหราศาสตร์แบบสะท้อนมุมมอง</p>';
    try{
      const r=await window.TarotPortal.api('/api/fortune/astrology',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({birthDate})});
      const d=await r.json();if(!r.ok)throw new Error(d?.error?.message||'ไม่สามารถวิเคราะห์ได้');
      const x=d.result||{};
      box.innerHTML=`<h2>${escapeHtml(x.title||'ภาพรวมของคุณ')}</h2><p>${escapeHtml(x.summary||'')}</p>${(x.insights||[]).map(v=>`<p>• ${escapeHtml(v)}</p>`).join('')}<h3>คำถามสำหรับคิดต่อ</h3><p>${escapeHtml(x.reflection||'')}</p><button id="astroDeep" type="button">ดูเชิงลึกสำหรับสมาชิก</button><p class="profile-note">ภาพรวมนี้ไม่อ้างตำแหน่งดาว เรือนชะตา หรือ Ascendant ที่ไม่ได้คำนวณทางดาราศาสตร์</p>`;
      $('#astroDeep').onclick=loadDeep;
    }catch(err){box.innerHTML=`<h2>ยังวิเคราะห์ไม่ได้</h2><p>${escapeHtml(err?.message||'กรุณาลองอีกครั้ง')}</p>`;}
    finally{button.disabled=false;button.textContent=original;}
  });

  async function loadDeep(){
    const member=await window.TarotPortal.getMember({refresh:true});
    if(!member){location.assign(`https://api.sorasukt.com/auth/login?returnTo=${encodeURIComponent(location.href)}`);return;}
    const box=$('#astroResult');
    if(!member.completion?.readyForDaily){box.innerHTML='<h2>เพิ่มข้อมูลเกิดก่อน</h2><p>กรุณาบันทึกวันเดือนปีเกิดในหน้า “ฉัน” ก่อนเปิดการอ่านเชิงลึก</p><p><a class="deep-button" href="../me/">ไปที่หน้า ฉัน</a></p>';return;}
    box.innerHTML='<h2>กำลังอ่านเชิงลึก…</h2><p>กำลังเชื่อมโยงข้อมูลที่คุณบันทึกไว้ในบัญชีผ่าน AI</p>';
    try{
      const r=await window.TarotPortal.api('/api/member/astrology');
      const data=await r.json();
      if(r.status===409&&data?.error?.code==='PROFILE_REQUIRED'){box.innerHTML=`<h2>ต้องมีข้อมูลเกิดก่อน</h2><p>${escapeHtml(data.error.message)}</p><p><a class="deep-button" href="../me/">ไปที่หน้า ฉัน</a></p>`;return;}
      if(!r.ok)throw new Error(data?.error?.message||'ไม่สามารถอ่านเชิงลึกได้');
      const x=data.reading||{};
      box.innerHTML=`<h2>${escapeHtml(x.title||'การอ่านเชิงลึก')}</h2><p>${escapeHtml(x.overview||'')}</p><h3>จุดแข็ง</h3><p>${(x.strengths||[]).map(v=>'• '+escapeHtml(v)).join('<br>')}</p><h3>พื้นที่สำหรับเติบโต</h3><p>${(x.growth||[]).map(v=>'• '+escapeHtml(v)).join('<br>')}</p><h3>ความสัมพันธ์</h3><p>${escapeHtml(x.relationships||'')}</p><h3>คำถามสำหรับคิดต่อ</h3><p>${escapeHtml(x.reflection||'')}</p><p class="profile-note">การอ่านนี้เป็นการสะท้อนเชิงโหราศาสตร์ และไม่อ้างตำแหน่งดาวหรือเรือนชะตาที่ไม่ได้คำนวณจริง</p>`;
    }catch(e){box.innerHTML=`<h2>ยังอ่านเชิงลึกไม่ได้</h2><p>${escapeHtml(e?.message||'กรุณาลองอีกครั้ง')}</p>`;}
  }
  function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  addEventListener('DOMContentLoaded',hydrateFromMember);
})();
