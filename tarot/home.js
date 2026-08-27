(() => {
  const $=id=>document.getElementById(id);
  async function load(){
    const status=$("memberStatus"), shell=$("dailyMember"), guest=$("dailyGuest");
    try{
      const me=await window.TarotPortal.api("/api/member/me");
      if(!me.ok){ shell.hidden=true; guest.hidden=false; return; }
      shell.hidden=false; guest.hidden=true;
      let r=await window.TarotPortal.api("/api/member/daily");
      if(r.status===202){ status.textContent="กำลังเตรียมข้อความประจำวันของคุณ…"; await new Promise(x=>setTimeout(x,1800)); r=await window.TarotPortal.api("/api/member/daily"); }
      const data=await r.json();
      if(r.status===409&&data?.error?.code==="PROFILE_REQUIRED"){
        status.innerHTML='เพิ่มวันเดือนปีเกิดในหน้า <a href="./me/">ฉัน</a> เพื่อเริ่มดูดวงประจำวัน';
        $("dailyContent").hidden=true; return;
      }
      if(!r.ok){ status.textContent=data?.error?.message||"ไม่สามารถโหลดดวงวันนี้ได้"; return; }
      $("dailyDate").textContent=data.date||"";
      $("dailyCard").textContent=data.card?.name||"";
      $("dailyTitle").textContent=data.horoscope?.title||"ดวงของคุณวันนี้";
      $("dailySummary").textContent=data.horoscope?.summary||"";
      $("dailyEnergy").textContent=data.horoscope?.energy||"";
      $("dailyFocus").textContent=data.horoscope?.focus||"";
      $("dailyAvoid").textContent=data.horoscope?.avoid||"";
      $("dailyAdvice").textContent=data.horoscope?.advice||"";
      $("dailyContent").hidden=false; status.textContent="";
    }catch(e){ status.textContent="เชื่อมต่อดวงประจำวันไม่สำเร็จ กรุณาลองอีกครั้ง"; }
  }
  addEventListener("DOMContentLoaded",load);
})();
