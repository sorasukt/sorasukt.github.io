(() => {
  const $=id=>document.getElementById(id);
  function zodiac(day,month){const z=[[[1,20],[2,18],'กุมภ์','คิดอิสระ มองอนาคต และชอบตั้งคำถามกับกรอบเดิม'],[[2,19],[3,20],'มีน','อ่อนไหวต่อบรรยากาศ จินตนาการสูง และรับรู้อารมณ์ได้ดี'],[[3,21],[4,19],'เมษ','กล้าเริ่มต้น ตรงไปตรงมา และมีแรงผลักดันสูง'],[[4,20],[5,20],'พฤษภ','ให้ค่ากับความมั่นคง ความสม่ำเสมอ และสิ่งที่จับต้องได้'],[[5,21],[6,20],'เมถุน','ชอบเรียนรู้ สื่อสารไว และปรับตัวกับข้อมูลใหม่ได้ดี'],[[6,21],[7,22],'กรกฎ','ให้ความสำคัญกับความผูกพัน ความปลอดภัย และความรู้สึก'],[[7,23],[8,22],'สิงห์','ต้องการแสดงออก สร้างสรรค์ และมีพื้นที่ให้ตัวตนได้เปล่งประกาย'],[[8,23],[9,22],'กันย์','ละเอียด ช่างสังเกต และมักมองหาวิธีทำสิ่งต่าง ๆ ให้ดีขึ้น'],[[9,23],[10,22],'ตุล','ให้ความสำคัญกับสมดุล ความสัมพันธ์ และการมองหลายมุม'],[[10,23],[11,21],'พิจิก','ลึกซึ้ง จริงจังกับความรู้สึก และสนใจการเปลี่ยนแปลงจากภายใน'],[[11,22],[12,21],'ธนู','ชอบค้นหา เรียนรู้ และมองชีวิตในภาพกว้าง'],[[12,22],[1,19],'มังกร','มีเป้าหมาย เป็นระบบ และค่อย ๆ สร้างสิ่งที่มั่นคง']];for(const [s,e,n,c] of z){if((month===s[0]&&day>=s[1])||(month===e[0]&&day<=e[1]))return{name:n,copy:c};}}

  $('#astroForm').addEventListener('submit',e=>{e.preventDefault();const d=new Date($('#astroBirthDate').value+'T00:00:00'),z=zodiac(d.getDate(),d.getMonth()+1);$('#astroResult').hidden=false;$('#astroResult').innerHTML=`<h2>ราศีอาทิตย์: ${z.name}</h2><p>${z.copy}</p><p>ภาพรวมนี้ใช้วันเกิดเท่านั้น หากต้องการอ่านเชิงลึกที่เชื่อมโยงข้อมูลสมาชิกและข้อมูลเกิด ให้ลงชื่อใช้งานก่อน</p><button id="astroDeep" type="button">ดูเชิงลึก</button>`;$('#astroDeep').onclick=loadDeep;});

  async function loadDeep(){
    const me=await window.TarotPortal.api('/api/member/me');
    if(!me.ok){location.assign(`https://api.sorasukt.com/auth/login?returnTo=${encodeURIComponent(location.href)}`);return;}
    const box=$('#astroResult');
    box.innerHTML='<h2>กำลังอ่านเชิงลึก…</h2><p>กำลังเชื่อมโยงข้อมูลเกิดของคุณ</p>';
    try{
      const r=await window.TarotPortal.api('/api/member/astrology');
      const data=await r.json();
      if(r.status===409&&data?.error?.code==='PROFILE_REQUIRED'){box.innerHTML=`<h2>ต้องมีข้อมูลเกิดก่อน</h2><p>${data.error.message}</p><p><a class="deep-button" href="../me/">ไปที่หน้า ฉัน</a></p>`;return;}
      if(!r.ok)throw new Error(data?.error?.message||'ไม่สามารถอ่านเชิงลึกได้');
      const x=data.reading||{};
      box.innerHTML=`<h2>${escapeHtml(x.title||'การอ่านเชิงลึก')}</h2><p>${escapeHtml(x.overview||'')}</p><h3>จุดแข็ง</h3><p>${(x.strengths||[]).map(v=>'• '+escapeHtml(v)).join('<br>')}</p><h3>พื้นที่สำหรับเติบโต</h3><p>${(x.growth||[]).map(v=>'• '+escapeHtml(v)).join('<br>')}</p><h3>ความสัมพันธ์</h3><p>${escapeHtml(x.relationships||'')}</p><h3>คำถามสำหรับคิดต่อ</h3><p>${escapeHtml(x.reflection||'')}</p><p class="profile-note">การอ่านนี้เป็นการสะท้อนเชิงโหราศาสตร์ และไม่อ้างตำแหน่งดาวหรือเรือนชะตาที่ไม่ได้คำนวณจริง</p>`;
    }catch(e){box.innerHTML=`<h2>ยังอ่านเชิงลึกไม่ได้</h2><p>${escapeHtml(e?.message||'กรุณาลองอีกครั้ง')}</p>`;}
  }
  function escapeHtml(v){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
})();