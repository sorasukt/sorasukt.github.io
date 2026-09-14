const API = "https://api.sorasukt.com";

const labels = {
  operational: "ปกติ",
  degraded: "ทำงานช้าลง",
  partial_outage: "ไม่พร้อมใช้งานบางส่วน",
  major_outage: "ขัดข้อง",
  maintenance: "บำรุงรักษา"
};

const overallLabels = {
  operational: "ระบบทั้งหมดทำงานปกติ",
  degraded: "บางบริการทำงานช้าลง",
  partial_outage: "บางบริการไม่พร้อมใช้งาน",
  major_outage: "ระบบขัดข้อง",
  maintenance: "อยู่ระหว่างการบำรุงรักษา"
};

document.getElementById("refresh").onclick = load;
load();

async function load() {
  try {
    const response = await fetch(API + "/api/status", { headers: { Accept: "application/json" } });
    const data = await response.json();
    if (!response.ok) throw new Error();

    const bySlug = Object.fromEntries((data.services || []).map(s => [s.slug, s.name]));
    const byIncident = Object.fromEntries((data.incidents || []).map(i => [i.id, i]));

    document.getElementById("overall").textContent = overallLabels[data.overall] || "กำลังตรวจสอบสถานะ";
    document.getElementById("banner-mark").className = "banner-mark " + esc(data.overall || "");
    document.getElementById("updated").textContent = "อัปเดตล่าสุด " + date(data.updatedAt);

    document.getElementById("services").innerHTML = data.services.map(s => `
      <div class="service">
        <div>
          <div class="service-name">${esc(s.name)}</div>
          ${s.description ? `<div class="service-desc">${esc(s.description)}</div>` : ""}
        </div>
        <span class="status-pill ${esc(s.status)}">${esc(labels[s.status] || s.status)}</span>
      </div>
    `).join("");

    document.getElementById("incidents").innerHTML = data.incidents.length
      ? data.incidents.map(i => {
          const names = (i.affected_services || [])
            .map(slug => bySlug[slug] || slug)
            .filter(Boolean)
            .join(", ");
          const meta = names
            ? `${esc(date(i.updated_at))} | ${esc(names)}`
            : esc(date(i.updated_at));
          return `
        <article>
          <div class="event-head">
            <h3>${esc(i.title)}</h3>
            <span class="badge">${esc(cap(i.status))}</span>
          </div>
          <div class="incident-meta">${meta}</div>
          <p>${esc(i.message)}</p>
        </article>`;
        }).join("")
      : '<p class="empty">ยังไม่มีเหตุการณ์ที่รายงาน</p>';

    document.getElementById("events").innerHTML = data.events.length
      ? data.events.map(e => {
          const incident = e.incident_id != null ? byIncident[e.incident_id] : null;
          const title = incident?.title || e.message || e.status || "";
          const body = incident ? e.message : "";
          const showBody = body && body !== title;
          return `
        <article>
          <h3>${esc(title)}</h3>
          ${showBody ? `<p>${esc(body)}</p>` : ""}
          <time>${esc(date(e.created_at))}</time>
        </article>`;
        }).join("")
      : '<p class="empty">ยังไม่มีประวัติสถานะ</p>';

  } catch {
    document.getElementById("overall").textContent = "ไม่สามารถโหลดสถานะได้";
    document.getElementById("updated").textContent = "โปรดลองอีกครั้ง";
    document.getElementById("banner-mark").className = "banner-mark";
  }
}

function date(v) {
  return new Date(String(v).includes("T") ? v : String(v).replace(" ", "T") + "Z")
    .toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });
}

function cap(v) {
  const s = String(v ?? "");
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function esc(v) {
  return String(v ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
}
