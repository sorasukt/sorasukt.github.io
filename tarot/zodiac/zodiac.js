(() => {
  const $=id=>document.getElementById(id);
  const form=$('zodiacForm'),result=$('zodiacResult');
  hydrateMember();
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const birthDate=$('zodiacBirthDate').value;
    const button=form.querySelector('button[type="submit"]');
    if(!birthDate)return;
    button.disabled=true;const original=button.textContent;button.textContent='กำลังวิเคราะห์…';
    result.hidden=false;result.innerHTML='<h2>กำลังเตรียมคำอ่าน…</h2><p>กำลังเชื่อมโยงวันเกิดกับบริบทเชิงราศีผ่าน AI</p>';
    try{
      const r=await window.TarotPortal.api('/api/fortune/zodiac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({birthDate})});
      const d=await r.json();if(!r.ok)throw new Error(d?.error?.message||'ไม่สามารถวิเคราะห์ราศีได้');
      render(d.result||{});
    }catch(err){result.innerHTML=`<h2>ยังวิเคราะห์ไม่ได้</h2><p>${esc(err?.message||'กรุณาลองใหม่อีกครั้ง')}</p>`;}
    finally{button.disabled=false;button.textContent=original;}
  });
  function render(x){result.innerHTML=`<h2>${esc(x.title||'คำอ่านราศีของคุณ')}</h2><p>${esc(x.summary||'')}</p>${(x.insights||[]).map(v=>`<p>• ${esc(v)}</p>`).join('')}<h3>คำถามสำหรับคิดต่อ</h3><p>${esc(x.reflection||'')}</p><p class="profile-note">ผลลัพธ์สร้างด้วย AI เพื่อการสะท้อนมุมมองและความบันเทิง ไม่ใช่ข้อสรุปตายตัวเกี่ยวกับบุคลิกหรืออนาคต</p>`;}
  async function hydrateMember(){
    try{const member=await window.TarotPortal.getMember();if(member?.profile?.birth_date&&!$('zodiacBirthDate').value)$('zodiacBirthDate').value=member.profile.birth_date;}catch{}
  }
  function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
})();
