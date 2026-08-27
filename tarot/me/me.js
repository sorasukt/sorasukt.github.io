(() => {
  const $=id=>document.getElementById(id);
  async function load(){
    try{
      const me=await window.TarotPortal.api('/api/member/me');
      if(!me.ok){ $('#profileStatus').textContent='กรุณาลงชื่อใช้งานก่อนจัดการข้อมูลของคุณ'; $('#profileForm').hidden=true; return; }
      const meData=await me.json();
      const user=meData.user||{};
      $('#accountSummary').hidden=false;
      $('#accountSummary').innerHTML=`<strong>${escapeHtml(user.name||user.nickname||'บัญชีของคุณ')}</strong>${user.email?`<br><span>${escapeHtml(user.email)}</span>`:''}`;
      const r=await window.TarotPortal.api('/api/member/profile');
      const data=await r.json();
      if(!r.ok)throw new Error(data?.error?.message||'โหลดข้อมูลไม่สำเร็จ');
      $('#birthDate').value=data.profile?.birth_date||'';
      $('#birthTime').value=data.profile?.birth_time||'';
      $('#profileStatus').textContent=data.profile?'ข้อมูลของคุณพร้อมใช้งาน':'เพิ่มวันเดือนปีเกิดเพื่อเปิดใช้ดวงประจำวัน';
    }catch(e){ $('#profileStatus').textContent=e?.message||'โหลดข้อมูลไม่สำเร็จ'; }
  }
  async function save(e){
    e.preventDefault(); const btn=$('#saveProfile'); btn.disabled=true; $('#profileStatus').textContent='กำลังบันทึก…';
    try{
      const r=await window.TarotPortal.api('/api/member/profile',{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({birthDate:$('#birthDate').value,birthTime:$('#birthTime').value})});
      const data=await r.json(); if(!r.ok)throw new Error(data?.error?.message||'บันทึกข้อมูลไม่สำเร็จ');
      $('#profileStatus').textContent='บันทึกข้อมูลแล้ว';
    }catch(e){ $('#profileStatus').textContent=e?.message||'บันทึกข้อมูลไม่สำเร็จ'; }finally{btn.disabled=false;}
  }
  function escapeHtml(v){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  addEventListener('DOMContentLoaded',()=>{ $('#profileForm').addEventListener('submit',save); load(); });
})();
