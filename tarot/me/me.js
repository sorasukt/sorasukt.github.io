(() => {
  const $=selector=>document.querySelector(selector);
  let timer=null,selectedPlaceId='',signedIn=false;

  async function load(){
    const status=$('#profileStatus');
    status.textContent='กำลังโหลดข้อมูล…';
    try{
      const member=await window.TarotPortal.getMember();
      signedIn=Boolean(member?.success);
      if(!signedIn){
        $('#accountName').textContent='ยังไม่ได้ลงชื่อใช้งาน';
        $('#accountEmail').textContent='ลงชื่อใช้งานเพื่อดูและจัดการข้อมูลสมาชิกของคุณ';
        $('#accountMembershipTitle').textContent='ลงชื่อใช้งานเพื่อดูสถานะสมาชิก';
        $('#accountMembershipDetail').textContent='สถานะ Tarot for your daily จะแสดงในบัญชีของคุณ';
        $('#accountPortalButton').hidden=true;
        $('#profileForm').hidden=true;
        status.textContent='ข้อมูลส่วนบุคคลจะแสดงหลังจากลงชื่อใช้งาน';
        return;
      }

      renderAccount(member.user||{},member.completion||{});
      renderProfile(member.profile||null);
      renderMembership(member.membership||null);
      $('#profileForm').hidden=false;
      $('#memberBadge').hidden=false;
      status.textContent=member.profile?'ข้อมูลของคุณพร้อมใช้งาน':'เพิ่มวันเดือนปีเกิดเพื่อเริ่มใช้ประสบการณ์สำหรับสมาชิก';
    }catch(e){
      $('#profileForm').hidden=true;
      status.textContent=e?.message||'โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
    }
  }

  function renderAccount(user,completion){
    const name=user.name||user.nickname||'บัญชีของคุณ';
    $('#accountName').textContent=name;
    $('#accountEmail').textContent=user.email||'ไม่มีอีเมลในข้อมูลบัญชี';
    const avatar=$('#accountAvatar'),fallback=$('#accountAvatarFallback');
    if(user.picture){avatar.src=user.picture;avatar.hidden=false;fallback.hidden=true;}else{avatar.hidden=true;fallback.hidden=false;fallback.textContent=(name.trim()[0]||'S').toUpperCase();}
    const health=$('#profileHealth');
    health.hidden=false;
    const badges=[['วันเกิด',completion.hasBirthDate],['เวลาเกิด',completion.hasBirthTime],['สถานที่เกิด',completion.hasBirthPlace]];
    health.innerHTML=badges.map(([label,ok])=>`<span class="health-chip ${ok?'is-ready':''}">${ok?'✓':'○'} ${escapeHtml(label)}</span>`).join('');
  }

  function renderProfile(profile){
    $('#birthDate').value=profile?.birth_date||'';
    $('#birthTime').value=profile?.birth_time||'';
    $('#birthPlace').value=profile?.birth_place||'';
    selectedPlaceId=profile?.birth_place_id||'';
    $('#birthPlaceId').value=selectedPlaceId;
    $('#profileSavedAt').textContent=profile?.updated_at?`อัปเดตล่าสุด ${formatDateTime(profile.updated_at)}`:'';
  }

  function renderMembership(membership){
    const title=$('#accountMembershipTitle'),detail=$('#accountMembershipDetail'),portal=$('#accountPortalButton');
    if(!membership){title.textContent='ยังไม่มีสมาชิกพิเศษ';detail.textContent='เลือก Subscription หรือชำระครั้งเดียวได้จากหน้าแผนสมาชิก';portal.hidden=true;return;}
    title.textContent=membership.active?'Tarot for your daily กำลังใช้งาน':`สถานะสมาชิก: ${membership.status||'ยังไม่ใช้งาน'}`;
    detail.textContent=membership.currentPeriodEnd?`ใช้สิทธิ์ได้ถึง ${new Intl.DateTimeFormat('th-TH',{dateStyle:'long',timeZone:'Asia/Bangkok'}).format(new Date(membership.currentPeriodEnd))}`:'จัดการรายละเอียดผ่าน Customer Portal';
    portal.hidden=false;
  }

  async function openPortal(){
    const button=$('#accountPortalButton');window.TarotPortal.setButtonBusy(button,true,'กำลังเปิด…');
    try{const response=await window.TarotPortal.api('/api/billing/portal',{method:'POST',timeout:15000}),data=await response.json();if(!response.ok)throw window.TarotPortal.apiError(data,'เปิด Customer Portal ไม่สำเร็จ');if(!/^https:\/\/billing\.stripe\.com\//.test(data.url||''))throw new Error('ลิงก์ Customer Portal ไม่ถูกต้อง');location.assign(data.url)}catch(error){$('#profileStatus').textContent=error?.message||'เปิด Customer Portal ไม่สำเร็จ';window.TarotPortal.setButtonBusy(button,false)}
  }

  async function searchPlaces(){
    const q=$('#birthPlace').value.trim();
    selectedPlaceId='';$('#birthPlaceId').value='';
    if(q.length<3){hideSuggestions();return;}
    try{
      const r=await window.TarotPortal.api(`/api/member/places/autocomplete?q=${encodeURIComponent(q)}`);
      const d=await r.json();
      if(!r.ok)throw new Error(d?.error?.message||'ค้นหาสถานที่ไม่สำเร็จ');
      renderSuggestions(d.suggestions||[]);
    }catch{hideSuggestions();}
  }

  function renderSuggestions(items){
    const box=$('#placeSuggestions');box.replaceChildren();
    if(!items.length){hideSuggestions();return;}
    items.forEach(p=>{
      const b=document.createElement('button');b.type='button';b.className='place-option';b.setAttribute('role','option');
      b.innerHTML=`<strong>${escapeHtml(p.mainText||p.text)}</strong>${p.secondaryText?`<span>${escapeHtml(p.secondaryText)}</span>`:''}`;
      b.onclick=()=>{selectedPlaceId=p.placeId;$('#birthPlaceId').value=p.placeId;$('#birthPlace').value=p.text;hideSuggestions();};
      box.append(b);
    });
    box.hidden=false;
    $('#birthPlace').setAttribute('aria-expanded','true');
  }
  function hideSuggestions(){$('#placeSuggestions').hidden=true;$('#birthPlace').setAttribute('aria-expanded','false');}

  async function save(e){
    e.preventDefault();
    if(!signedIn)return;
    const btn=$('#saveProfile'),status=$('#profileStatus');
    window.TarotPortal.setButtonBusy(btn,true,'กำลังบันทึก…');status.textContent='กำลังบันทึกข้อมูลของคุณ';status.dataset.loading='true';
    try{
      const birthPlace=$('#birthPlace').value.trim();
      if(birthPlace&&!selectedPlaceId)throw new Error('กรุณาเลือกสถานที่เกิดจากรายการแนะนำ หรือเว้นช่องนี้ไว้');
      const payload={birthDate:$('#birthDate').value,birthTime:$('#birthTime').value,birthPlace,birthPlaceId:selectedPlaceId};
      const r=await window.TarotPortal.api('/api/member/profile',{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(payload)});
      const d=await r.json();
      if(!r.ok)throw new Error(d?.error?.message||'บันทึกข้อมูลไม่สำเร็จ');
      window.TarotPortal.clearMemberCache();
      const member=await window.TarotPortal.getMember({refresh:true});
      if(member){renderAccount(member.user||{},member.completion||{});renderProfile(member.profile||d.profile||null);}
      else renderProfile(d.profile||null);
      status.textContent='บันทึกข้อมูลเรียบร้อยแล้ว ข้อมูลชุดนี้พร้อมใช้งานในหน้าอื่น';
    }catch(e){status.textContent=e?.message||'บันทึกข้อมูลไม่สำเร็จ';}
    finally{window.TarotPortal.setButtonBusy(btn,false);delete status.dataset.loading;}
  }

  function formatDateTime(value){try{return new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Bangkok'}).format(new Date(value.endsWith('Z')?value:`${value}Z`));}catch{return value;}}
  function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

  addEventListener('DOMContentLoaded',()=>{
    $('#profileForm').addEventListener('submit',save);
    $('#accountPortalButton').addEventListener('click',openPortal);
    $('#birthPlace').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(searchPlaces,350);});
    document.addEventListener('click',e=>{if(!e.target.closest('.place-field'))hideSuggestions();});
    load();
  });
})();
