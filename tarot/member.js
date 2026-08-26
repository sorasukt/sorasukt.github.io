(() => {
  const API="https://api.sorasukt.com";
  const $=id=>document.getElementById(id);

  async function init(){
    await window.SorasuktAuth.init();
    const authenticated=await window.SorasuktAuth.isAuthenticated();
    $("loginButton").hidden=authenticated;
    $("signupButton").hidden=authenticated;
    $("logoutButton").hidden=!authenticated;
    $("userButton").hidden=!authenticated;
    $("memberPanel").hidden=!authenticated;
    if(!authenticated)return;

    const user=await window.SorasuktAuth.getUser();
    $("userName").textContent=user?.name||user?.nickname||user?.email||"บัญชี";
    if(user?.picture){$("userAvatar").src=user.picture;$("userAvatar").alt=$("userName").textContent;$("userAvatar").hidden=false;}
    await loadProfileAndDaily();
  }

  async function api(path,options={}){
    return window.SorasuktAuth.authorizedFetch(`${API}${path}`,options);
  }

  async function runAuthAction(action,button,label){
    const original=button.textContent;
    button.disabled=true;
    button.textContent=label;
    setStatus("");
    try{
      await action();
    }catch(error){
      console.error("Auth action failed",error);
      setStatus("ไม่สามารถเชื่อมต่อระบบเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง");
      button.disabled=false;
      button.textContent=original;
    }
  }

  async function loadProfileAndDaily(){
    setStatus("กำลังโหลดข้อมูลสมาชิก...");
    const response=await api("/api/member/profile");
    const data=await response.json();
    if(!response.ok)throw new Error(data?.error?.message||"โหลดโปรไฟล์ไม่สำเร็จ");
    if(!data.profile){
      $("profileForm").hidden=false;
      $("dailyContent").hidden=true;
      setStatus("ระบุวันเดือนปีเกิดเพื่อเปิดใช้งานดวงประจำวัน");
      return;
    }
    $("birthDate").value=data.profile.birth_date||"";
    $("birthTime").value=data.profile.birth_time||"";
    $("profileForm").hidden=true;
    await loadDaily();
  }

  async function loadDaily(){
    $("dailyContent").hidden=true;
    setStatus("กำลังเปิดดวงประจำวันของคุณ...");
    let response=await api("/api/member/daily");
    if(response.status===202){
      await new Promise(r=>setTimeout(r,1800));
      response=await api("/api/member/daily");
    }
    const data=await response.json();
    if(response.status===409&&data?.error?.code==="PROFILE_REQUIRED"){$("profileForm").hidden=false;setStatus(data.error.message);return;}
    if(!response.ok){setStatus(data?.error?.message||"ไม่สามารถโหลดดวงประจำวันได้");return;}
    $("dailyDate").textContent=data.date;
    $("dailyCard").textContent=data.card?.name||"";
    $("dailyTitle").textContent=data.horoscope?.title||"ดวงประจำวัน";
    $("dailySummary").textContent=data.horoscope?.summary||"";
    $("dailyEnergy").textContent=data.horoscope?.energy||"";
    $("dailyFocus").textContent=data.horoscope?.focus||"";
    $("dailyAvoid").textContent=data.horoscope?.avoid||"";
    $("dailyAdvice").textContent=data.horoscope?.advice||"";
    $("dailyContent").hidden=false;
    setStatus(data.cached?"ดวงวันนี้ถูกบันทึกไว้แล้ว จะรีเซ็ตเมื่อเข้าสู่วันใหม่ตามเวลาไทย":"สร้างดวงวันนี้เรียบร้อยแล้ว");
  }

  async function saveProfile(event){
    event.preventDefault();
    const birthDate=$("birthDate").value;
    const birthTime=$("birthTime").value;
    if(!birthDate){setStatus("กรุณาระบุวันเดือนปีเกิด");return;}
    $("saveProfile").disabled=true;
    try{
      const response=await api("/api/member/profile",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({birthDate,birthTime})});
      const data=await response.json(); if(!response.ok)throw new Error(data?.error?.message||"บันทึกข้อมูลไม่สำเร็จ");
      $("profileForm").hidden=true; await loadDaily();
    }catch(error){setStatus(error.message);}finally{$("saveProfile").disabled=false;}
  }

  function setStatus(text){$("memberStatus").textContent=text||"";}

  window.addEventListener("DOMContentLoaded",()=>{
    const loginButton=$("loginButton");
    const signupButton=$("signupButton");
    const logoutButton=$("logoutButton");
    loginButton.addEventListener("click",()=>runAuthAction(()=>window.SorasuktAuth.login(),loginButton,"กำลังเข้าสู่ระบบ…"));
    signupButton.addEventListener("click",()=>runAuthAction(()=>window.SorasuktAuth.signup(),signupButton,"กำลังเปิดหน้าสมัคร…"));
    logoutButton.addEventListener("click",()=>runAuthAction(()=>window.SorasuktAuth.logout(),logoutButton,"กำลังออกจากระบบ…"));
    $("profileForm").addEventListener("submit",saveProfile);
    $("editProfile").addEventListener("click",()=>{$("profileForm").hidden=false;});
    init().catch(error=>{console.error("Member initialization failed",error);setStatus("ไม่สามารถโหลดระบบสมาชิกได้");});
  });
})();
