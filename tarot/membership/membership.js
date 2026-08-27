(() => {
  const $=id=>document.getElementById(id),periods=["weekly","monthly","yearly"],labels={weekly:"รายสัปดาห์",monthly:"รายเดือน",yearly:"รายปี"};
  let plans=[],member=null;
  addEventListener("DOMContentLoaded",()=>{document.querySelectorAll('input[name="paymentType"]').forEach(input=>input.addEventListener("change",renderPlans));$("portalButton").addEventListener("click",openPortal);load()});
  async function load(){
    member=await window.TarotPortal.getMember();renderStatus(member?.membership||null);
    try{const response=await window.TarotPortal.api("/api/billing/plans",{timeout:15000}),data=await response.json();if(!response.ok)throw window.TarotPortal.apiError(data,"โหลดราคาไม่สำเร็จ");plans=data.plans||[];renderPlans()}catch(error){window.TarotPortal.renderError($("planGrid"),error,{title:"ยังโหลดแผนไม่ได้"})}
    if(new URLSearchParams(location.search).has("canceled"))$("billingMessage").textContent="ยังไม่มีการเรียกเก็บเงิน คุณสามารถเลือกแผนใหม่เมื่อพร้อม";
  }
  function renderStatus(value){
    if(!member?.success){$("membershipTitle").textContent="ลงชื่อใช้งานเพื่อเริ่มสมาชิกพิเศษ";$("membershipDetail").textContent="บัญชีช่วยให้เราบันทึกสิทธิ์และเปิด Customer Portal ให้คุณ";return}
    if(!value){$("membershipTitle").textContent="ยังไม่มีสมาชิกพิเศษ";$("membershipDetail").textContent="เลือกแผนด้านล่างเพื่อเริ่มใช้งาน";return}
    $("membershipTitle").textContent=value.active?"Tarot for your daily กำลังใช้งาน":"สถานะสมาชิก: "+statusLabel(value.status);
    $("membershipDetail").textContent=`${labels[value.period]||"แผนสมาชิก"}${value.currentPeriodEnd?` · ใช้ได้ถึง ${formatDate(value.currentPeriodEnd)}`:""}${value.cancelAtPeriodEnd?" · จะไม่ต่ออายุ":""}`;
    $("portalButton").hidden=false;
  }
  function renderPlans(){
    const type=document.querySelector('input[name="paymentType"]:checked')?.value||"subscription";$("planGrid").replaceChildren();
    periods.forEach(period=>{const plan=plans.find(item=>item.period===period&&item.paymentType===type),card=document.createElement("article");card.className="plan-card";const title=document.createElement("h2");title.textContent=labels[period];const eyebrow=document.createElement("p");eyebrow.className="eyebrow";eyebrow.textContent=period.toUpperCase();const price=document.createElement("p");price.className="plan-price";price.textContent=plan?.amount&&plan.currency?formatMoney(plan.amount,plan.currency):"ยังไม่เปิดขาย";const detail=document.createElement("p");detail.className="plan-detail";detail.textContent=!plan?.configured||!plan.active?"ยังไม่เปิดรับชำระ":type==="subscription"?"ต่ออายุอัตโนมัติ":"ชำระครั้งเดียว ไม่ต่ออายุ";const button=document.createElement("button");button.type="button";button.textContent=type==="subscription"?"สมัครสมาชิก":"ซื้อสิทธิ์ครั้งเดียว";button.disabled=!plan?.configured||!plan.active;button.addEventListener("click",()=>checkout(period,type,button));card.append(eyebrow,title,price,detail,button);$("planGrid").append(card)});
  }
  async function checkout(period,paymentType,button){
    if(!member?.success){location.assign(`https://api.sorasukt.com/auth/login?returnTo=${encodeURIComponent(location.href)}`);return}
    window.TarotPortal.setButtonBusy(button,true,"กำลังเปิด Stripe…");$("billingMessage").textContent="กำลังพาคุณไปยังหน้าชำระเงินที่ปลอดภัย";
    try{const response=await billingApi("/api/billing/checkout/membership",{period,paymentType,requestId:crypto.randomUUID()}),data=await response.json();if(!response.ok)throw window.TarotPortal.apiError(data,"เริ่มชำระเงินไม่สำเร็จ");if(!/^https:\/\/checkout\.stripe\.com\//.test(data.url||""))throw new Error("ลิงก์ชำระเงินไม่ถูกต้อง");location.assign(data.url)}catch(error){window.TarotPortal.renderError($("billingMessage"),error);window.TarotPortal.setButtonBusy(button,false)}
  }
  async function openPortal(){const button=$("portalButton");window.TarotPortal.setButtonBusy(button,true,"กำลังเปิด…");try{const response=await window.TarotPortal.api("/api/billing/portal",{method:"POST",headers:policyHeaders(),timeout:15000}),data=await response.json();if(!response.ok)throw window.TarotPortal.apiError(data,"เปิด Customer Portal ไม่สำเร็จ");if(!/^https:\/\/billing\.stripe\.com\//.test(data.url||""))throw new Error("ลิงก์ Customer Portal ไม่ถูกต้อง");location.assign(data.url)}catch(error){window.TarotPortal.renderError($("billingMessage"),error);window.TarotPortal.setButtonBusy(button,false)}}
  function billingApi(path,body){return window.TarotPortal.api(path,{method:"POST",headers:policyHeaders(),body:JSON.stringify(body),timeout:20000})}
  function policyHeaders(){return {"Content-Type":"application/json","X-Tarot-Policy-Version":window.TarotPortal.policyVersion}}
  function formatMoney(amount,currency){if(!Number.isInteger(amount)||!currency)return "—";return new Intl.NumberFormat("th-TH",{style:"currency",currency:currency.toUpperCase(),maximumFractionDigits:2}).format(amount/100)}
  function formatDate(value){try{return new Intl.DateTimeFormat("th-TH",{dateStyle:"long",timeZone:"Asia/Bangkok"}).format(new Date(value))}catch{return value}}
  function statusLabel(value){return ({active:"กำลังใช้งาน",trialing:"ช่วงทดลอง",past_due:"รอการชำระ",canceled:"ยกเลิกแล้ว",unpaid:"ยังไม่ชำระ",incomplete:"ยังไม่สมบูรณ์"})[value]||"ยังไม่ใช้งาน"}
})();
