/* GIỜ HỌC — giao diện (web + app Android) */
'use strict';
const $ = s => document.querySelector(s);
const LS = { get: (k, d) => { try { const v = localStorage.getItem('gh_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set: (k, v) => { try { localStorage.setItem('gh_' + k, JSON.stringify(v)); } catch (e) { } }, del: k => localStorage.removeItem('gh_' + k) };
const NATIVE = (() => { try { return window.Native ? JSON.parse(Native.info()) : null; } catch (e) { return null; } })();
const APPV = self.APP_VERSION || '1.0.0';
const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
const ST = HT.STATUS, ROLE = HT.ROLE, money = HT.money;
const WD = ['', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'], WDS = ['', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const MODE = { gio: 'Theo giờ', buoi: 'Theo buổi', thang: 'Trọn gói tháng' };
const COLORS = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];

const S = { token: LS.get('token', ''), me: LS.get('me', null), demo: LS.get('demo', false), tab: LS.get('tab', 'home'),
  month: '', data: null, bill: null, sum: null, pos: null, filter: { c: '', s: '', day: '' }, logView: 'list', timer: null };

const h = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const p2 = n => (n < 10 ? '0' : '') + n;
const ymd = d => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
const today = () => ymd(new Date());
const thisMonth = () => today().slice(0, 7);
const dmy = s => s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '';
const mLabel = m => 'Tháng ' + (+m.slice(5)) + '/' + m.slice(0, 4);
const addMonth = (m, k) => { const d = new Date(+m.slice(0, 4), +m.slice(5) - 1 + k, 1); return d.getFullYear() + '-' + p2(d.getMonth() + 1); };
const dur = m => { m = Math.round(+m || 0); return m >= 60 ? Math.floor(m / 60) + 'g' + (m % 60 ? p2(m % 60) : '') : m + "'"; };
const hours = m => (Math.round((+m || 0) / 6) / 10).toString().replace('.', ',') + ' giờ';
const isT = HT.isT;
S.month = LS.get('month', thisMonth());
if (S.month > thisMonth()) S.month = thisMonth();

function apiUrl() { return LS.get('api', '') || window.API_URL || ''; }
async function api(action, params) {
  const p = Object.assign({ action, token: S.token, appVersion: APPV, device: NATIVE ? NATIVE.model : navigator.userAgent.slice(0, 60) }, params || {});
  let r;
  try {
    if (S.demo) r = await DEMO.call(p);
    else {
      const res = await fetch(apiUrl(), { method: 'POST', body: JSON.stringify(p) });
      r = await res.json();
    }
  } catch (e) { r = { ok: false, error: navigator.onLine === false ? 'Không có mạng Internet' : 'Không kết nối được máy chủ' }; }
  if (!r.ok && r.code === 'AUTH') { logout(true); toast(r.error, 'er'); }
  return r;
}

function toast(m, cls) {
  const d = document.createElement('div'); d.className = cls || ''; d.textContent = m; $('#toast').appendChild(d);
  setTimeout(() => d.remove(), cls === 'er' ? 5200 : 3000);
}
function vib() { if (NATIVE) try { Native.vibrate(); } catch (e) { } else if (navigator.vibrate) navigator.vibrate(100); }
function busy(btn, on) { if (!btn) return; btn.disabled = on; if (on) { btn.dataset.t = btn.innerHTML; btn.innerHTML = '⏳ Đang xử lý…'; } else if (btn.dataset.t) btn.innerHTML = btn.dataset.t; }

/* ---------------- Modal ---------------- */
function modal(html, mount) {
  $('#modal').innerHTML = `<div class="bg"><div class="sh">${html}</div></div>`;
  $('#modal .bg').onclick = e => { if (e.target.classList.contains('bg')) closeModal(); };
  $('#modal').querySelectorAll('[data-x]').forEach(b => b.onclick = closeModal);
  if (mount) mount($('#modal .sh'));
}
function closeModal() { $('#modal').innerHTML = ''; }
function head(t) { return `<h2><span>${t}</span><button class="btn s o" data-x>✕</button></h2>`; }
function confirmBox(msg, okText) {
  return new Promise(res => {
    modal(`${head('Xác nhận')}<p>${msg}</p><div class="row"><button class="btn o f" data-x>Hủy</button><button class="btn er f" id="cfOk">${okText || 'Đồng ý'}</button></div>`,
      el => { el.querySelector('#cfOk').onclick = () => { closeModal(); res(true); }; el.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', () => res(false))); });
  });
}
function val(el, id) { const x = el.querySelector('#' + id); return x ? (x.type === 'checkbox' ? x.checked : x.value.trim()) : ''; }

/* ---------------- Đăng nhập ---------------- */
function viewLogin() {
  stopTimer();
  const noServer = !apiUrl();
  $('#app').innerHTML = `<div class="login">
    <div class="logo"><img src="icons/icon-192.png" alt=""><h1>Giờ học</h1><div class="mu">Điểm danh · Theo dõi giờ học · Tính học phí</div></div>
    <div class="card">
      <label>Tên đăng nhập</label><input id="u" autocomplete="username" autocapitalize="off" value="${h(LS.get('lastUser', ''))}">
      <label>Mật khẩu</label><input id="pw" type="password" autocomplete="current-password">
      <div style="height:14px"></div>
      <button class="btn p big w" id="go">Đăng nhập</button>
      ${noServer ? '<div class="info">Chưa nối máy chủ. Bấm <b>Dùng thử</b> để xem phần mềm với dữ liệu mẫu.</div>' : ''}
    </div>
    <div class="row" style="justify-content:space-between">
      <button class="btn o s" id="demo">👀 Dùng thử (dữ liệu mẫu)</button>
      <button class="btn o s" id="srv">⚙ Máy chủ</button>
    </div>
    ${IOS && !navigator.standalone ? '<div class="info">📱 <b>iPhone:</b> bấm nút Chia sẻ <b>⬆</b> của Safari → <b>Thêm vào MH chính</b> để cài app. App tự cập nhật khi có bản mới.</div>' : ''}
    <p class="mu c" style="margin-top:22px">Phiên bản ${APPV}${NATIVE ? ' · App Android ' + NATIVE.versionName : ''}</p></div>`;
  const go = async () => {
    const u = val(document, 'u'), pw = $('#pw').value;
    if (!u || !pw) return toast('Nhập tên đăng nhập và mật khẩu', 'er');
    if (!apiUrl() && !S.demo) return toast('Chưa có địa chỉ máy chủ. Bấm ⚙ Máy chủ hoặc Dùng thử.', 'er');
    busy($('#go'), true); const r = await api('login', { username: u, password: pw }); busy($('#go'), false);
    if (!r.ok) return toast(r.error, 'er');
    LS.set('lastUser', u); setLogin(r);
  };
  $('#go').onclick = go; $('#pw').onkeydown = e => { if (e.key === 'Enter') go(); };
  $('#demo').onclick = async () => { S.demo = true; LS.set('demo', true); const r = await api('login', { username: 'admin', password: '123456' }); if (r.ok) { setLogin(r); toast('Đang dùng thử — dữ liệu chỉ lưu trên máy này'); } };
  $('#srv').onclick = () => modal(`${head('Địa chỉ máy chủ')}<p class="mu">Dán URL ứng dụng web Google Apps Script (đuôi <b>/exec</b>).</p>
    <input id="url" value="${h(apiUrl())}" placeholder="https://script.google.com/macros/s/…/exec"><div style="height:12px"></div>
    <div class="row"><button class="btn o f" id="tst">Kiểm tra</button><button class="btn p f" id="sv">Lưu</button></div>`, el => {
    el.querySelector('#tst').onclick = async () => { LS.set('api', val(el, 'url')); S.demo = false; const r = await api('ping'); toast(r.ok ? 'Kết nối tốt ✔ (máy chủ ' + r.backend + ')' : r.error, r.ok ? 'ok' : 'er'); };
    el.querySelector('#sv').onclick = () => { LS.set('api', val(el, 'url')); S.demo = false; LS.set('demo', false); closeModal(); viewLogin(); toast('Đã lưu', 'ok'); };
  });
}
function setLogin(r) {
  S.token = r.token; S.me = r.me; LS.set('token', r.token); LS.set('me', r.me); LS.set('demo', S.demo);
  S.tab = 'home'; start();
  if (r.me.mustChange) setTimeout(() => changePass(true), 400);
}
async function logout(silent) {
  if (!silent && S.token) api('logout');
  if (NATIVE) try { Native.clearSession(); } catch (e) { }
  S.token = ''; S.me = null; S.data = null; LS.del('token'); LS.del('me');
  if (S.demo) { S.demo = false; LS.set('demo', false); }
  closeModal(); viewLogin();
}
function changePass(first) {
  modal(`${head(first ? 'Đổi mật khẩu lần đầu' : 'Đổi mật khẩu')}${first ? '<div class="warn">Vì an toàn, hãy đổi mật khẩu mặc định.</div>' : ''}
    <label>Mật khẩu hiện tại</label><input id="o" type="password"><label>Mật khẩu mới (≥ 6 ký tự)</label><input id="n" type="password">
    <label>Nhập lại mật khẩu mới</label><input id="n2" type="password"><div style="height:14px"></div><button class="btn p w" id="sv">Lưu mật khẩu</button>`, el => {
    el.querySelector('#sv').onclick = async e => {
      if (val(el, 'n') !== val(el, 'n2')) return toast('Hai mật khẩu mới không khớp', 'er');
      busy(e.target, true); const r = await api('changePass', { old: val(el, 'o'), pass: val(el, 'n') }); busy(e.target, false);
      if (!r.ok) return toast(r.error, 'er'); closeModal(); toast('Đã đổi mật khẩu', 'ok');
    };
  });
}

/* ---------------- Dữ liệu ---------------- */
async function reload(quiet) {
  const a = S.month < thisMonth() ? S.month : thisMonth(), b = S.month > thisMonth() ? S.month : thisMonth();
  const r = await api('load', { from: a + '-01', to: b + '-31', since: LS.get('seen', '') });
  if (!r.ok) { if (!quiet) toast(r.error, 'er'); return false; }
  S.data = r; S.me = r.me; LS.set('me', r.me);
  S.data.courses.forEach((c, i) => { if (!c.color) c.color = COLORS[i % COLORS.length]; });
  syncNative();
  return true;
}
const C = id => (S.data.courses.find(c => c.id === id) || { name: '(lớp đã xóa)', color: '#94a3b8', schedule: [] });
const SN = id => (S.data.students.find(s => s.id === id) || { name: '?' }).name;
const activeCourses = () => S.data.courses.filter(c => isT(c.active));
const pairs = () => { const o = []; activeCourses().forEach(c => HT.list(c.studentIds).forEach(sid => { if (S.data.students.some(s => s.id === sid) && (S.me.role !== 'hs' || S.me.studentId === sid)) o.push({ c, sid }); })); return o; };
const openSessions = () => S.data.sessions.filter(s => s.start && !s.end && (s.status === 'co_mat' || s.status === 'hoc_bu'));
const multiStudent = () => S.data.students.length > 1;

function syncNative() {
  if (!NATIVE) return;
  try {
    const sched = [];
    activeCourses().forEach(c => (c.schedule || []).forEach(sl => sched.push({ title: c.name, d: +sl.d, t: sl.t, m: +sl.m || 90, id: c.id })));
    Native.setSession(S.demo ? '' : apiUrl(), S.token, JSON.stringify({ enabled: LS.get('remind', true), before: LS.get('remindBefore', 15), slots: sched }));
    Native.setToday(today(), openSessions().filter(s => s.date === today()).map(s => s.courseId).join(','));
  } catch (e) { }
}

/* ---------------- Khung ứng dụng ---------------- */
const TABS = [['home', '✅', 'Điểm danh'], ['tkb', '📅', 'Lịch'], ['log', '📒', 'Nhật ký'], ['fee', '💰', 'Học phí'], ['more', '⚙', 'Khác']];
async function start() {
  $('#app').innerHTML = `<header><h1 id="ttl">Giờ học</h1><button class="ib" id="bell">🔔</button><button class="ib" id="rf">⟳</button></header><main id="v"><div class="empty">Đang tải dữ liệu…</div></main>
    <nav>${TABS.map(t => `<button data-t="${t[0]}"><i>${t[1]}</i>${t[2]}</button>`).join('')}</nav>`;
  document.querySelectorAll('nav button').forEach(b => b.onclick = () => go(b.dataset.t));
  $('#rf').onclick = async () => { $('#rf').textContent = '⏳'; await reload(); S.bill = S.sum = null; render(); $('#rf').textContent = '⟳'; };
  $('#bell').onclick = showNotifs;
  if (await reload()) render(); else $('#v').innerHTML = `<div class="empty">Không tải được dữ liệu.<br><br><button class="btn p" onclick="start()">Thử lại</button></div>`;
}
function go(t) { S.tab = t; LS.set('tab', t); render(); scrollTo(0, 0); }
function render() {
  if (!S.data) return;
  stopTimer();
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.t === (S.tab === 'stat' ? 'fee' : S.tab)));
  $('#ttl').textContent = (S.data.appName || 'Giờ học') + (S.demo ? ' · Dùng thử' : '');
  const u = S.data.unread || 0; $('#bell').innerHTML = '🔔' + (u ? `<b>${u > 9 ? '9+' : u}</b>` : '');
  ({ home: vHome, tkb: vTkb, log: vLog, stat: vStat, fee: vFee, more: vMore }[S.tab] || vHome)();
}
function feeToggle() { return `<div class="tabs"><button data-ft="fee" class="${S.tab === 'fee' ? 'on' : ''}">💰 Học phí</button><button data-ft="stat" class="${S.tab === 'stat' ? 'on' : ''}">📊 Thống kê</button></div>`; }
function bindFeeToggle() { document.querySelectorAll('[data-ft]').forEach(b => b.onclick = () => { S.tab = b.dataset.ft; LS.set('tab', S.tab); render(); }); }
function monthNav(cb) {
  return (S.tab === 'fee' || S.tab === 'stat' ? feeToggle() : '') + `<div class="mnav"><button class="btn o" data-m="-1">‹</button><b>${mLabel(S.month)}</b><button class="btn o" data-m="1" ${S.month >= thisMonth() ? 'disabled' : ''}>›</button></div>`;
}
function bindMonth(cb) {
  bindFeeToggle();
  document.querySelectorAll('[data-m]').forEach(b => b.onclick = async () => {
    S.month = addMonth(S.month, +b.dataset.m); LS.set('month', S.month); S.filter.day = ''; S.bill = null;
    $('#v').style.opacity = .5; await reload(); $('#v').style.opacity = 1; cb();
  });
}
function stopTimer() { if (S.timer) clearInterval(S.timer); S.timer = null; }

/* ---------------- TAB 1: ĐIỂM DANH ---------------- */
function vHome() {
  const d = today(), w = HT.dow(d), open = openSessions(), P = pairs();
  const todayS = S.data.sessions.filter(s => s.date === d);
  const planned = [], others = [];
  P.forEach(x => { const sl = (x.c.schedule || []).filter(z => +z.d === w); (sl.length ? planned : others).push(Object.assign({ sl }, x)); });
  planned.sort((a, b) => a.sl[0].t < b.sl[0].t ? -1 : 1);
  const now = new Date();
  let html = `<div class="card row"><div class="f"><div class="mu">${WD[w]}, ${dmy(d)}</div><div class="clock" id="clk">${p2(now.getHours())}:${p2(now.getMinutes())}</div>
    <div class="sm">Xin chào <b>${h(S.me.name)}</b> · ${ROLE[S.me.role]}</div></div>
    <button class="btn o" id="add">＋ Ghi buổi</button></div>`;
  if (S.me.role !== 'gv') html += whereCard();
  open.forEach(s => {
    const c = C(s.course || s.courseId), stale = s.date !== d;
    html += `<div class="card live"><div class="row"><div class="bar" style="background:${c.color}"></div><div class="f">
      <div class="b">${h(c.name)}${multiStudent() ? ' · ' + h(SN(s.studentId)) : ''}</div>
      <div class="mu">Bắt đầu ${s.start}${stale ? ' ngày ' + dmy(s.date) : ''} · ${h(c.teacher)}</div>
      ${stale ? '<div class="warn">Quên bấm kết thúc. Bấm “Sửa giờ” để nhập giờ kết thúc.</div>' : `<div class="timer" data-start="${s.start}">00:00:00</div>`}</div></div>
      <div style="height:8px"></div>${stale ? `<button class="btn p w" data-edit="${s.id}">✎ Sửa giờ kết thúc</button>`
        : `<button class="btn er big w" data-out="${s.id}">■ KẾT THÚC BUỔI HỌC</button>`}</div>`;
  });
  const card = (x, sch) => {
    const done = todayS.filter(s => s.courseId === x.c.id && s.studentId === x.sid);
    const isOpen = open.some(s => s.courseId === x.c.id && s.studentId === x.sid);
    const st = done.map(s => `<span class="chip st-${s.end || !s.start ? s.status : 'open'}">${s.end || !s.start ? ST[s.status] : 'Đang học'}${s.start ? ' ' + s.start + (s.end ? '–' + s.end : '') : ''}</span>`).join(' ');
    return `<div class="item"><div class="bar" style="background:${x.c.color}"></div><div class="f">
      <div class="b">${h(x.c.name)}${multiStudent() ? ' · ' + h(SN(x.sid)) : ''}</div>
      <div class="mu">${sch ? x.sl.map(z => z.t + ' (' + dur(z.m) + ')').join(', ') + ' · ' : ''}${h(x.c.teacher || '')}${x.c.place ? ' · ' + h(x.c.place) : ''}</div>
      ${st ? '<div style="margin-top:4px">' + st + '</div>' : ''}</div>
      <div class="row gap" style="flex-direction:column;align-items:stretch">${isOpen ? '' : `<button class="btn ok" data-in="${x.c.id}|${x.sid}">▶ Bắt đầu</button>`}
      ${S.me.role !== 'hs' && !isOpen ? `<button class="btn o s" data-abs="${x.c.id}|${x.sid}">Vắng…</button>` : ''}</div></div>`;
  };
  html += `<div class="card"><h3>📅 Lịch học hôm nay</h3>${planned.length ? planned.map(x => card(x, true)).join('') : '<div class="empty">Hôm nay không có lịch học</div>'}</div>`;
  if (others.length) html += `<div class="card"><h3>➕ Học thêm / học bù</h3>${others.map(x => card(x, false)).join('')}</div>`;
  if (!P.length) html += `<div class="card empty">Chưa có lớp học nào${S.me.role === 'ph' ? '. Vào <b>Khác → Lớp học</b> để tạo lớp.' : ''}</div>`;
  // Lịch 7 ngày tới
  let up = '';
  for (let k = 1; k <= 7; k++) {
    const t = new Date(); t.setDate(t.getDate() + k); const dd = ymd(t), ww = HT.dow(dd);
    const l = []; P.forEach(x => (x.c.schedule || []).filter(z => +z.d === ww).forEach(z => l.push({ t: z.t, x, m: z.m })));
    l.sort((a, b) => a.t < b.t ? -1 : 1);
    if (l.length) up += `<div class="item"><div style="width:68px" class="b sm">${WDS[ww]} ${dmy(dd).slice(0, 5)}</div><div class="f sm">${l.map(z => `<div><span style="color:${z.x.c.color}">●</span> ${z.t} ${h(z.x.c.name)}${multiStudent() ? ' · ' + h(SN(z.x.sid)) : ''}</div>`).join('')}</div></div>`;
  }
  if (up) html += `<div class="card"><h3>🗓 7 ngày tới</h3>${up}</div>`;
  $('#v').innerHTML = html;
  $('#add').onclick = () => sessionForm(null);
  document.querySelectorAll('[data-in]').forEach(b => b.onclick = () => { const [cid, sid] = b.dataset.in.split('|'); checkIn(cid, sid, b); });
  document.querySelectorAll('[data-out]').forEach(b => b.onclick = () => checkOut(b.dataset.out, b));
  document.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => sessionForm(S.data.sessions.find(s => s.id === b.dataset.edit)));
  document.querySelectorAll('[data-abs]').forEach(b => b.onclick = () => { const [cid, sid] = b.dataset.abs.split('|'); absentForm(cid, sid); });
  const tick = () => {
    const n = new Date(), c = $('#clk'); if (!c) return stopTimer();
    c.textContent = p2(n.getHours()) + ':' + p2(n.getMinutes());
    document.querySelectorAll('.timer').forEach(t => { const [a, b] = t.dataset.start.split(':'); let sec = Math.max(0, (n.getHours() * 60 + n.getMinutes() - a * 60 - b) * 60 + n.getSeconds()); t.textContent = p2(Math.floor(sec / 3600)) + ':' + p2(Math.floor(sec / 60) % 60) + ':' + p2(sec % 60); });
  };
  tick(); S.timer = setInterval(tick, 1000);
}

function getPos() {
  return new Promise(res => {
    if (NATIVE) {
      S.pos = null; window.__nativeLoc = p => { S.pos = p; }; Native.startLocation(); const t0 = Date.now();
      const k = () => { if (S.pos && S.pos.acc < 80) { Native.stopLocation(); return res(S.pos); } if (Date.now() - t0 > 12000) { Native.stopLocation(); return res(S.pos); } setTimeout(k, 400); }; k(); return;
    }
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }), () => res(null), { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  });
}
async function checkIn(cid, sid, btn) {
  const c = C(cid); busy(btn, true);
  let pos = null;
  if (+c.lat && +c.radius) { btn.innerHTML = '📍 Đang lấy vị trí…'; pos = await getPos(); if (pos && pos.mock) { busy(btn, false); return toast('Phát hiện vị trí giả lập (Fake GPS). Tắt ứng dụng giả lập rồi thử lại.', 'er'); } }
  const r = await api('checkin', { courseId: cid, studentId: sid, lat: pos ? pos.lat : '', lng: pos ? pos.lng : '' });
  busy(btn, false);
  if (!r.ok) return toast(r.error, 'er');
  vib(); toast('✔ ' + r.msg, 'ok'); await reload(); render();
}
async function checkOut(id, btn) {
  const s = S.data.sessions.find(x => x.id === id), c = C(s.courseId);
  if (!(await confirmBox(`Kết thúc buổi <b>${h(c.name)}</b> (bắt đầu ${s.start})?`, 'Kết thúc'))) return;
  busy(btn, true); const r = await api('checkout', { id }); busy(btn, false);
  if (!r.ok) return toast(r.error, 'er');
  vib(); toast('✔ ' + r.msg, 'ok'); await reload(); render();
}
function absentForm(cid, sid) {
  const c = C(cid);
  modal(`${head('Ghi vắng · ' + h(c.name))}<div class="mu">${multiStudent() ? h(SN(sid)) + ' · ' : ''}${dmy(today())}</div>
    <div class="list-a" style="margin-top:8px">${['vang_phep', 'vang_kp', 'gv_nghi'].map(k => `<div data-st="${k}"><span class="chip st-${k}">${ST[k]}</span><span class="f mu sm">${k === 'gv_nghi' ? 'Không tính tiền' : (k === 'vang_phep' ? isT(c.chargeExcused) : isT(c.chargeUnexcused)) ? 'Vẫn tính tiền' : 'Không tính tiền'}</span></div>`).join('')}</div>
    <label>Ghi chú</label><input id="nt" placeholder="Lý do (không bắt buộc)">`, el => {
    el.querySelectorAll('[data-st]').forEach(d => d.onclick = async () => {
      const r = await api('saveSession', { session: { courseId: cid, studentId: sid, date: today(), status: d.dataset.st, note: val(el, 'nt') } });
      if (!r.ok) return toast(r.error, 'er'); closeModal(); toast('Đã ghi: ' + ST[d.dataset.st], 'ok'); await reload(); render();
    });
  });
}

/* Ghi / sửa buổi học */
function sessionForm(s) {
  const P = pairs(), me = S.me, isNew = !s;
  if (!P.length) return toast('Chưa có lớp học', 'er');
  s = s || { courseId: P[0].c.id, studentId: P[0].sid, date: today(), start: '', end: '', status: me.role === 'hs' ? 'vang_phep' : 'co_mat', note: '' };
  const ro = !isNew && me.role === 'hs' && isT(s.confirmed);
  const cOpts = activeCourses().concat(S.data.courses.filter(c => c.id === s.courseId && !isT(c.active))).map(c => `<option value="${c.id}" ${c.id === s.courseId ? 'selected' : ''}>${h(c.name)}</option>`).join('');
  const stOpts = Object.keys(ST).filter(k => me.role !== 'hs' || !isNew || (k !== 'co_mat' && k !== 'hoc_bu')).map(k => `<option value="${k}" ${k === s.status ? 'selected' : ''}>${ST[k]}</option>`).join('');
  modal(`${head(isNew ? 'Ghi buổi học' : 'Sửa buổi học')}
    ${me.role === 'hs' && isNew ? '<div class="info">Học sinh dùng nút ▶ Bắt đầu / ■ Kết thúc để điểm danh. Ở đây chỉ báo vắng.</div>' : ''}
    ${ro ? '<div class="warn">Buổi đã được giáo viên xác nhận — chỉ xem.</div>' : ''}
    <label>Lớp</label><select id="c">${cOpts}</select>
    <div id="sw"></div>
    <div class="g2"><div><label>Ngày</label><input id="d" type="date" value="${s.date}" max="${today()}"></div><div><label>Trạng thái</label><select id="st">${stOpts}</select></div></div>
    <div class="g2" id="tm"><div><label>Bắt đầu</label><input id="a" type="time" value="${s.start || ''}"></div><div><label>Kết thúc</label><input id="b" type="time" value="${s.end || ''}"></div></div>
    ${me.role === 'ph' ? `<label>Đơn giá áp dụng cho buổi này (đ) — để trống = theo lớp</label><input id="rt" inputmode="numeric" value="${s.rate != null && s.rate !== '' ? s.rate : ''}">` : ''}
    <label>Ghi chú</label><input id="nt" value="${h(s.note || '')}">
    ${!isNew ? `<p class="mu sm">Tạo: ${h((s.createdAt || '').replace('T', ' '))}${s.inDist !== '' && s.inDist != null ? ' · cách nơi học ' + s.inDist + ' m' : ''}${isT(s.confirmed) ? ' · ✔ GV đã xác nhận' : ''}</p>` : ''}
    <div style="height:12px"></div>
    ${ro ? '' : `<div class="row">${!isNew && me.role !== 'hs' ? '<button class="btn er" id="del">Xóa</button>' : ''}<button class="btn p f" id="sv">Lưu</button></div>`}`, el => {
    const sw = () => {
      const c = C(val(el, 'c')), ids = HT.list(c.studentIds).filter(x => me.role !== 'hs' || x === me.studentId);
      el.querySelector('#sw').innerHTML = ids.length > 1 || multiStudent() ? `<label>Học sinh</label><select id="s">${ids.map(x => `<option value="${x}" ${x === s.studentId ? 'selected' : ''}>${h(SN(x))}</option>`).join('')}</select>` : `<input type="hidden" id="s" value="${ids[0] || ''}">`;
    };
    const tm = () => { el.querySelector('#tm').style.display = ['co_mat', 'hoc_bu'].includes(val(el, 'st')) ? '' : 'none'; };
    sw(); tm(); el.querySelector('#c').onchange = sw; el.querySelector('#st').onchange = tm;
    if (ro) el.querySelectorAll('input,select').forEach(i => i.disabled = true);
    const sv = el.querySelector('#sv');
    if (sv) sv.onclick = async () => {
      const x = { id: s.id, courseId: val(el, 'c'), studentId: val(el, 's'), date: val(el, 'd'), status: val(el, 'st'), start: val(el, 'a'), end: val(el, 'b'), note: val(el, 'nt') };
      if (me.role === 'ph') x.rate = val(el, 'rt').replace(/\D/g, '');
      busy(sv, true); const r = await api('saveSession', { session: x }); busy(sv, false);
      if (!r.ok) return toast(r.error, 'er'); closeModal(); toast('Đã lưu', 'ok'); S.bill = S.sum = null; await reload(); render();
    };
    const del = el.querySelector('#del');
    if (del) del.onclick = async () => { if (!(await confirmBox('Xóa buổi học này?', 'Xóa'))) return; const r = await api('deleteSession', { id: s.id }); if (!r.ok) return toast(r.error, 'er'); toast('Đã xóa', 'ok'); S.bill = S.sum = null; await reload(); render(); };
  });
}

/* ---------------- TAB LỊCH: TKB chính khóa + học thêm, thực đơn, tra cứu ---------------- */
const nowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };
const mapLink = (lat, lng) => +lat && +lng ? `<a href="https://maps.google.com/?q=${lat},${lng}" target="_blank" rel="noopener">📍 Bản đồ</a>` : '';
const Stu = id => S.data.students.find(s => s.id === id) || {};
const myStudents = () => S.data.students.filter(s => isT(s.active) && (S.me.role !== 'hs' || s.id === S.me.studentId));

/* Mọi lịch của 1 học sinh trong 1 thứ: chính khóa + học thêm */
function dayItems(sid, d) {
  const o = [];
  (S.data.timetable || []).filter(t => t.studentId === sid && +t.d === d).forEach(t => o.push({ kind: 'ck', start: t.start, end: t.end, title: t.subject, who: t.teacher, where: [t.room, Stu(sid).school].filter(Boolean).join(' · '), lat: Stu(sid).schoolLat, lng: Stu(sid).schoolLng, color: '#64748b', t }));
  activeCourses().filter(c => HT.list(c.studentIds).includes(sid)).forEach(c => (c.schedule || []).filter(z => +z.d === d).forEach(z =>
    o.push({ kind: 'ht', start: z.t, end: HT.hhmm(HT.min(z.t) + (+z.m || 90)), title: c.name, who: c.teacher, where: c.place, lat: c.lat, lng: c.lng, color: c.color, c })));
  return o.sort((a, b) => a.start < b.start ? -1 : 1);
}

/* Học sinh đang ở đâu lúc này */
function whereNow(sid) {
  const op = openSessions().find(s => s.studentId === sid && s.date === today());
  if (op) { const c = C(op.courseId); return { icon: '🟢', text: `Đang học thêm <b>${h(c.name)}</b> · ${h(c.teacher || '')} · từ ${op.start}`, where: c.place, lat: op.inLat || c.lat, lng: op.inLng || c.lng }; }
  const n = nowMin(), d = HT.dow(today()), items = dayItems(sid, d);
  const cur = items.find(x => HT.min(x.start) <= n && n < HT.min(x.end));
  if (cur) return { icon: cur.kind === 'ck' ? '🏫' : '🟡', text: cur.kind === 'ck' ? `Đang học chính khóa <b>${h(cur.title)}</b>${cur.who ? ' · ' + h(cur.who) : ''} (${cur.start}–${cur.end})` : `Theo lịch đang học <b>${h(cur.title)}</b> nhưng <b>chưa điểm danh</b>`, where: cur.where, lat: cur.lat, lng: cur.lng };
  const nx = items.find(x => HT.min(x.start) > n);
  return { icon: '⚪', text: nx ? `Không có giờ học · tiếp theo ${nx.start} <b>${h(nx.title)}</b>` : 'Hôm nay đã hết giờ học', where: nx ? nx.where : '', lat: nx && nx.lat, lng: nx && nx.lng };
}
function whereCard() {
  const st = myStudents(); if (!st.length) return '';
  return `<div class="card"><h3>📍 ${st.length > 1 || S.me.role === 'ph' ? 'Con đang ở đâu' : 'Lúc này'}</h3>${st.map(s => { const w = whereNow(s.id);
    return `<div class="item"><div style="font-size:20px">${w.icon}</div><div class="f">${st.length > 1 || S.me.role === 'ph' ? `<b>${h(s.name)}</b> · ` : ''}${w.text}<div class="mu">${h(w.where || '')} ${mapLink(w.lat, w.lng)}</div></div></div>`; }).join('')}</div>`;
}

function vTkb() {
  S.tk = S.tk || { view: 'week', d: HT.dow(today()), s: '', q: '' };
  const V = S.tk, st = myStudents(), gv = S.me.role === 'gv';
  if (!V.s || !st.some(x => x.id === V.s)) V.s = st[0] ? st[0].id : '';
  const views = gv ? [['week', '🗓 Lịch dạy']] : [['week', '🗓 Thời khóa biểu'], ['menu', '🍱 Thực đơn'], ['find', '🔎 Tra cứu']];
  let html = `<div class="tabs">${views.map(v => `<button data-v="${v[0]}" class="${V.view === v[0] ? 'on' : ''}">${v[1]}</button>`).join('')}</div>`;
  if (V.view !== 'find') {
    if (st.length > 1 && V.view === 'week') html += `<div class="tabs">${st.map(x => `<button data-st="${x.id}" class="${V.s === x.id ? 'on' : ''}">${h(x.name)}</button>`).join('')}</div>`;
    html += `<div class="tabs">${[1, 2, 3, 4, 5, 6, 7].map(d => `<button data-d="${d}" class="${V.d === d ? 'on' : ''}">${WDS[d]}${d === HT.dow(today()) ? ' •' : ''}</button>`).join('')}</div>`;
  }
  if (V.view === 'week') {
    const items = gv ? pairs().flatMap(x => (x.c.schedule || []).filter(z => +z.d === V.d).map(z => ({ kind: 'ht', start: z.t, end: HT.hhmm(HT.min(z.t) + (+z.m || 90)), title: x.c.name, who: SN(x.sid), where: x.c.place, lat: x.c.lat, lng: x.c.lng, color: x.c.color }))).sort((a, b) => a.start < b.start ? -1 : 1) : dayItems(V.s, V.d);
    html += `<div class="card"><h3>${WD[V.d]}${gv ? '' : ' · ' + h(Stu(V.s).name || '')}</h3>${items.length ? items.map(x => `<div class="item" ${x.t ? `data-tt="${x.t.id}" style="cursor:pointer"` : ''}><div class="bar" style="background:${x.color}"></div>
      <div style="width:84px" class="sm"><b>${x.start}</b><br><span class="mu">${x.end}</span></div><div class="f"><div class="row"><b class="f">${h(x.title)}</b><span class="chip" style="background:${x.kind === 'ck' ? '#e2e8f0' : '#ccfbf1'}">${x.kind === 'ck' ? 'Chính khóa' : 'Học thêm'}</span></div>
      <div class="mu">${[x.who, x.where].filter(Boolean).map(h).join(' · ')} ${mapLink(x.lat, x.lng)}</div></div></div>`).join('') : '<div class="empty">Không có lịch học</div>'}</div>`;
    if (!gv && V.s) html += `<button class="btn p w" id="addTT">＋ Thêm tiết học chính khóa</button><p class="mu sm c">Lịch học thêm lấy từ mục Lớp học (Khác → Lớp học).</p>`;
  } else if (V.view === 'menu') {
    const ms = (S.data.menus || []).filter(m => +m.d === V.d && (!m.studentId || st.some(x => x.id === m.studentId)));
    html += `<div class="card"><h3>🍱 Thực đơn ${WD[V.d]}</h3>${Object.keys(HT.MEAL).map(k => { const l = ms.filter(m => m.meal === k);
      return `<div class="item"><div style="width:84px" class="b sm">${HT.MEAL[k]}</div><div class="f">${l.length ? l.map(m => `<div ${S.me.role === 'ph' ? `data-mn="${m.id}" style="cursor:pointer"` : ''}>${h(m.dishes)}${m.studentId && st.length > 1 ? ` <span class="chip">${h(SN(m.studentId))}</span>` : ''}${m.note ? `<div class="mu">${h(m.note)}</div>` : ''}</div>`).join('') : '<span class="mu">—</span>'}</div></div>`; }).join('')}</div>
      ${S.me.role === 'ph' ? '<button class="btn p w" id="addMn">＋ Thêm món</button>' : ''}`;
  } else {
    html += whereCard() + `<div class="card"><input id="q" placeholder="🔎 Tìm theo môn, thầy cô, lớp, nơi học…" value="${h(V.q)}"><div id="res"></div></div>`;
  }
  $('#v').innerHTML = html;
  document.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { V.view = b.dataset.v; vTkb(); });
  document.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { V.d = +b.dataset.d; vTkb(); });
  document.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { V.s = b.dataset.st; vTkb(); });
  document.querySelectorAll('[data-tt]').forEach(b => b.onclick = () => ttForm(S.data.timetable.find(t => t.id === b.dataset.tt)));
  document.querySelectorAll('[data-mn]').forEach(b => b.onclick = () => menuForm(S.data.menus.find(m => m.id === b.dataset.mn)));
  const a = $('#addTT'); if (a) a.onclick = () => ttForm({ studentId: V.s, d: V.d, start: '07:00', end: '07:45' });
  const m = $('#addMn'); if (m) m.onclick = () => menuForm({ d: V.d, meal: 'trua', studentId: '' });
  const q = $('#q');
  if (q) {
    const run = () => {
      V.q = q.value.trim(); const k = V.q.toLowerCase(), out = [];
      st.forEach(s => { for (let d = 1; d <= 7; d++) dayItems(s.id, d).forEach(x => { const txt = [x.title, x.who, x.where, s.name].join(' ').toLowerCase(); if (!k || txt.includes(k)) out.push(Object.assign({ d, sn: s.name }, x)); }); });
      $('#res').innerHTML = out.length ? out.slice(0, 80).map(x => `<div class="item"><div class="bar" style="background:${x.color}"></div><div style="width:84px" class="sm"><b>${WDS[x.d]}</b> ${x.start}<br><span class="mu">→ ${x.end}</span></div>
        <div class="f"><b>${h(x.title)}</b> <span class="chip">${x.kind === 'ck' ? 'Chính khóa' : 'Học thêm'}</span>${st.length > 1 ? ' · ' + h(x.sn) : ''}<div class="mu">${[x.who, x.where].filter(Boolean).map(h).join(' · ')} ${mapLink(x.lat, x.lng)}</div></div></div>`).join('') : '<div class="empty">Không tìm thấy</div>';
    };
    q.oninput = run; run();
  }
}
function ttForm(t) {
  const st = myStudents();
  modal(`${head(t.id ? 'Sửa tiết học' : 'Thêm tiết chính khóa')}
    ${st.length > 1 ? `<label>Học sinh</label><select id="sid">${st.map(s => `<option value="${s.id}" ${s.id === t.studentId ? 'selected' : ''}>${h(s.name)}</option>`).join('')}</select>` : `<input type="hidden" id="sid" value="${t.studentId}">`}
    <div class="g2"><div><label>Thứ</label><select id="d">${[1, 2, 3, 4, 5, 6, 7].map(d => `<option value="${d}" ${+t.d === d ? 'selected' : ''}>${WD[d]}</option>`).join('')}</select></div><div><label>Môn học</label><input id="subject" value="${h(t.subject || '')}"></div></div>
    <div class="g2"><div><label>Bắt đầu</label><input id="start" type="time" value="${t.start}"></div><div><label>Kết thúc</label><input id="end" type="time" value="${t.end}"></div></div>
    <div class="g2"><div><label>Giáo viên</label><input id="teacher" value="${h(t.teacher || '')}"></div><div><label>Phòng / lớp</label><input id="room" value="${h(t.room || '')}"></div></div>
    <label>Ghi chú</label><input id="note" value="${h(t.note || '')}">
    ${t.id ? '' : '<label class="chk"><input type="checkbox" id="rep">Lặp lại cho các ngày Thứ 2 – Thứ 6</label>'}
    <div style="height:12px"></div><div class="row">${t.id ? '<button class="btn er" id="del">Xóa</button>' : ''}<button class="btn p f" id="sv">Lưu</button></div>`, el => {
    el.querySelector('#sv').onclick = async e => {
      const x = { id: t.id, studentId: val(el, 'sid'), d: +val(el, 'd'), subject: val(el, 'subject'), start: val(el, 'start'), end: val(el, 'end'), teacher: val(el, 'teacher'), room: val(el, 'room'), note: val(el, 'note') };
      const days = val(el, 'rep') ? [1, 2, 3, 4, 5] : [x.d];
      busy(e.target, true);
      for (const d of days) { const r = await api('saveTT', { item: Object.assign({}, x, { d }) }); if (!r.ok) { busy(e.target, false); return toast(r.error, 'er'); } }
      busy(e.target, false); closeModal(); toast('Đã lưu', 'ok'); await reload(); vTkb();
    };
    const d = el.querySelector('#del'); if (d) d.onclick = async () => { await api('deleteTT', { id: t.id }); closeModal(); await reload(); vTkb(); };
  });
}
function menuForm(m) {
  const st = S.data.students;
  modal(`${head(m.id ? 'Sửa thực đơn' : 'Thêm món')}
    <div class="g2"><div><label>Thứ</label><select id="d">${[1, 2, 3, 4, 5, 6, 7].map(d => `<option value="${d}" ${+m.d === d ? 'selected' : ''}>${WD[d]}</option>`).join('')}</select></div>
    <div><label>Bữa</label><select id="meal">${Object.keys(HT.MEAL).map(k => `<option value="${k}" ${m.meal === k ? 'selected' : ''}>${HT.MEAL[k]}</option>`).join('')}</select></div></div>
    <label>Món ăn</label><input id="dishes" value="${h(m.dishes || '')}" placeholder="VD: Cơm, cá kho, canh chua">
    ${st.length > 1 ? `<label>Cho học sinh</label><select id="sid"><option value="">Tất cả</option>${st.map(s => `<option value="${s.id}" ${s.id === m.studentId ? 'selected' : ''}>${h(s.name)}</option>`).join('')}</select>` : ''}
    <label>Ghi chú (dinh dưỡng, dị ứng…)</label><input id="note" value="${h(m.note || '')}">
    <div style="height:12px"></div><div class="row">${m.id ? '<button class="btn er" id="del">Xóa</button>' : ''}<button class="btn p f" id="sv">Lưu</button></div>`, el => {
    el.querySelector('#sv').onclick = async () => { const r = await api('saveMenu', { item: { id: m.id, d: +val(el, 'd'), meal: val(el, 'meal'), dishes: val(el, 'dishes'), studentId: val(el, 'sid'), note: val(el, 'note') } }); if (!r.ok) return toast(r.error, 'er'); closeModal(); await reload(); vTkb(); };
    const d = el.querySelector('#del'); if (d) d.onclick = async () => { await api('deleteMenu', { id: m.id }); closeModal(); await reload(); vTkb(); };
  });
}

/* ---------------- TAB 2: NHẬT KÝ ---------------- */
function monthSessions() {
  return S.data.sessions.filter(s => s.date.slice(0, 7) === S.month && (!S.filter.c || s.courseId === S.filter.c) && (!S.filter.s || s.studentId === S.filter.s));
}
function filters() {
  let f = `<div class="tabs"><button data-fc="" class="${!S.filter.c ? 'on' : ''}">Tất cả lớp</button>${S.data.courses.map(c => `<button data-fc="${c.id}" class="${S.filter.c === c.id ? 'on' : ''}"><span style="color:${S.filter.c === c.id ? '#fff' : c.color}">●</span> ${h(c.name)}</button>`).join('')}</div>`;
  if (multiStudent()) f += `<div class="tabs"><button data-fs="" class="${!S.filter.s ? 'on' : ''}">Tất cả học sinh</button>${S.data.students.map(s => `<button data-fs="${s.id}" class="${S.filter.s === s.id ? 'on' : ''}">${h(s.name)}</button>`).join('')}</div>`;
  return f;
}
function bindFilters(cb) {
  document.querySelectorAll('[data-fc]').forEach(b => b.onclick = () => { S.filter.c = b.dataset.fc; cb(); });
  document.querySelectorAll('[data-fs]').forEach(b => b.onclick = () => { S.filter.s = b.dataset.fs; cb(); });
}
function vLog() {
  const ss = monthSessions().sort((a, b) => (b.date + b.start) < (a.date + a.start) ? -1 : 1);
  const att = ss.filter(s => s.status === 'co_mat' || s.status === 'hoc_bu'), mins = att.reduce((t, s) => t + (+s.minutes || 0), 0);
  const unc = ss.filter(s => !isT(s.confirmed));
  let html = monthNav() + filters() + `<div class="row" style="margin-bottom:10px"><div class="f sm"><b>${att.length}</b> buổi học · <b>${hours(mins)}</b> · vắng <b>${ss.filter(s => s.status.startsWith('vang')).length}</b></div>
    <div class="tabs" style="margin:0"><button data-lv="list" class="${S.logView === 'list' ? 'on' : ''}">☰ Danh sách</button><button data-lv="cal" class="${S.logView === 'cal' ? 'on' : ''}">▦ Lịch</button></div></div>`;
  if (S.me.role !== 'hs' && unc.length) html += `<div class="card row"><div class="f sm">⏳ <b>${unc.length}</b> buổi chưa được ${S.me.role === 'gv' ? 'thầy/cô' : 'giáo viên'} xác nhận</div><button class="btn p s" id="cfAll">✔ Xác nhận tất cả</button></div>`;
  if (S.logView === 'cal') html += calendar(ss);
  const shown = S.filter.day ? ss.filter(s => s.date === S.filter.day) : ss;
  let last = '', body = '';
  shown.forEach(s => {
    const c = C(s.courseId);
    if (s.date !== last) { last = s.date; body += `<div class="mu b" style="padding:10px 0 2px">${WD[HT.dow(s.date)]}, ${dmy(s.date)}</div>`; }
    const open = s.start && !s.end && (s.status === 'co_mat' || s.status === 'hoc_bu');
    body += `<div class="item" data-s="${s.id}" style="cursor:pointer"><div class="bar" style="background:${c.color}"></div><div class="f">
      <div class="row"><span class="f b">${h(c.name)}</span><span class="chip st-${open ? 'open' : s.status}">${open ? 'Đang học' : ST[s.status]}</span></div>
      <div class="mu">${multiStudent() ? h(SN(s.studentId)) + ' · ' : ''}${s.start ? s.start + ' – ' + (s.end || '…') + (s.minutes ? ' · ' + dur(s.minutes) : '') : '—'}
      ${isT(s.confirmed) ? ' · <span class="paid">✔ xác nhận</span>' : ''}${s.note ? ' · ' + h(s.note) : ''}</div></div></div>`;
  });
  html += `<div class="card">${S.filter.day ? `<div class="row"><b class="f">Ngày ${dmy(S.filter.day)}</b><button class="btn s o" id="clrDay">Xem cả tháng</button></div>` : ''}${body || '<div class="empty">Chưa có buổi học nào</div>'}</div>
    <button class="btn p w" id="add">＋ Ghi buổi học</button>`;
  $('#v').innerHTML = html;
  bindMonth(vLog); bindFilters(vLog);
  document.querySelectorAll('[data-lv]').forEach(b => b.onclick = () => { S.logView = b.dataset.lv; S.filter.day = ''; vLog(); });
  document.querySelectorAll('[data-s]').forEach(d => d.onclick = () => sessionForm(S.data.sessions.find(s => s.id === d.dataset.s)));
  document.querySelectorAll('[data-day]').forEach(d => d.onclick = () => { S.filter.day = S.filter.day === d.dataset.day ? '' : d.dataset.day; vLog(); });
  const cd = $('#clrDay'); if (cd) cd.onclick = () => { S.filter.day = ''; vLog(); };
  $('#add').onclick = () => sessionForm(null);
  const cf = $('#cfAll'); if (cf) cf.onclick = async () => { const r = await api('confirm', { ids: unc.map(s => s.id) }); if (!r.ok) return toast(r.error, 'er'); toast('Đã xác nhận ' + r.count + ' buổi', 'ok'); await reload(); vLog(); };
}
function calendar(ss) {
  const y = +S.month.slice(0, 4), m = +S.month.slice(5), first = new Date(y, m - 1, 1), n = new Date(y, m, 0).getDate();
  const lead = (first.getDay() + 6) % 7, td = today(), P = pairs();
  let g = `<div class="card"><div class="cal">${WDS.slice(1).map(x => `<div class="h">${x}</div>`).join('')}`;
  for (let i = 0; i < lead; i++) g += '<div class="d x"></div>';
  for (let d = 1; d <= n; d++) {
    const ds = S.month + '-' + p2(d), w = HT.dow(ds), l = ss.filter(s => s.date === ds);
    const plan = ds > td ? P.filter(x => (!S.filter.c || x.c.id === S.filter.c) && (x.c.schedule || []).some(z => +z.d === w)) : [];
    g += `<div class="d ${ds === td ? 't' : ''} ${S.filter.day === ds ? 'sel' : ''}" data-day="${ds}"><div>${d}</div><div class="dots">${l.map(s => `<i title="${ST[s.status]}" style="background:${['co_mat', 'hoc_bu'].includes(s.status) ? C(s.courseId).color : '#fff'};color:${C(s.courseId).color};${['co_mat', 'hoc_bu'].includes(s.status) ? '' : 'outline:1.5px solid'}"></i>`).join('')}${plan.map(x => `<i class="a" style="background:${x.c.color};color:${x.c.color}"></i>`).join('')}</div></div>`;
  }
  return g + `</div><div class="leg"><span>● đã học</span><span>○ vắng / GV nghỉ</span><span style="opacity:.5">● có lịch</span></div></div>`;
}

/* ---------------- TAB 3: THỐNG KÊ ---------------- */
async function vStat() {
  const y = S.month.slice(0, 4);
  $('#v').innerHTML = monthNav() + '<div class="empty">Đang tính…</div>'; bindMonth(vStat);
  if (!S.bill || S.bill.month !== S.month) { const r = await api('bill', { month: S.month }); if (!r.ok) return toast(r.error, 'er'); S.bill = r; }
  if (!S.sum || S.sum.year !== y) { const r = await api('summary', { year: y }); if (!r.ok) return toast(r.error, 'er'); S.sum = r; }
  if (S.tab !== 'stat') return;
  const B = S.bill.bills, tot = k => B.reduce((t, b) => t + (typeof k === 'function' ? k(b) : b[k]), 0);
  const att = tot('attended'), abs = tot(b => b.count.vang_phep + b.count.vang_kp), planned = att + abs;
  let html = monthNav() + `<div class="kpi"><div><b>${att}</b><span>Buổi đã học</span></div><div><b>${hours(tot('minutes'))}</b><span>Tổng giờ học</span></div>
    <div><b>${planned ? Math.round(att / planned * 100) : 0}%</b><span>Chuyên cần (vắng ${abs})</span></div><div><b>${money(tot('total')).replace(' đ', '')}</b><span>Học phí tháng (đ)</span></div></div>`;
  // Giờ học theo lớp
  const byC = {}; B.forEach(b => { const o = byC[b.courseId] || (byC[b.courseId] = { minutes: 0, fee: 0, att: 0, abs: 0, gv: 0 }); o.minutes += b.minutes; o.fee += b.total; o.att += b.attended; o.abs += b.count.vang_phep + b.count.vang_kp; o.gv += b.count.gv_nghi; });
  const rows = Object.keys(byC).map(id => ({ id, c: C(id), ...byC[id] }));
  html += `<div class="card"><h3>⏱ Giờ học theo lớp</h3>${barsH(rows.map(r => ({ label: r.c.name, v: r.minutes / 60, color: r.c.color, txt: hours(r.minutes) })))}</div>`;
  // Trạng thái
  const cnt = {}; Object.keys(ST).forEach(k => cnt[k] = tot(b => b.count[k] || 0));
  const scol = { co_mat: '#16a34a', hoc_bu: '#2563eb', vang_phep: '#f59e0b', vang_kp: '#dc2626', gv_nghi: '#8b5cf6' };
  html += `<div class="card"><h3>✅ Tình hình điểm danh</h3>${donut(Object.keys(ST).map(k => ({ label: ST[k], v: cnt[k], color: scol[k] })))}</div>`;
  // 12 tháng
  const M = S.sum.months;
  html += `<div class="card"><h3>💰 Học phí 12 tháng năm ${y}</h3>${columns(M.map(r => ({ label: 'T' + (+r.month.slice(5)), v: r.fee, sel: r.month === S.month,
    parts: Object.keys(r.byCourse).map(id => ({ v: r.byCourse[id].fee, color: C(id).color })) })), v => v >= 1e6 ? (Math.round(v / 1e5) / 10).toString().replace('.', ',') + 'tr' : Math.round(v / 1e3) + 'k')}
    <div class="leg">${S.data.courses.map(c => `<span><i style="background:${c.color}"></i>${h(c.name)}</span>`).join('')}</div>
    <div class="sm" style="margin-top:8px">Cả năm: <b>${money(M.reduce((t, r) => t + r.fee, 0))}</b> · đã trả <b class="paid">${money(M.reduce((t, r) => t + r.paid, 0))}</b> · còn <b class="due">${money(M.reduce((t, r) => t + r.due, 0))}</b></div></div>`;
  html += `<div class="card"><h3>📈 Số giờ học 12 tháng</h3>${columns(M.map(r => ({ label: 'T' + (+r.month.slice(5)), v: r.minutes / 60, sel: r.month === S.month,
    parts: Object.keys(r.byCourse).map(id => ({ v: r.byCourse[id].minutes / 60, color: C(id).color })) })), v => (Math.round(v * 10) / 10) + 'g')}</div>`;
  html += `<div class="card"><h3>📋 Bảng tổng hợp ${mLabel(S.month).toLowerCase()}</h3><div style="overflow-x:auto"><table><tr><th>Lớp</th><th class="r">Buổi học</th><th class="r">Vắng</th><th class="r">GV nghỉ</th><th class="r">Giờ</th><th class="r">Học phí</th></tr>
    ${rows.map(r => `<tr><td><span style="color:${r.c.color}">●</span> ${h(r.c.name)}</td><td class="r">${r.att}</td><td class="r">${r.abs}</td><td class="r">${r.gv}</td><td class="r">${dur(r.minutes)}</td><td class="r">${money(r.fee)}</td></tr>`).join('')}
    <tr class="tot"><td>Tổng</td><td class="r">${att}</td><td class="r">${abs}</td><td class="r">${tot(b => b.count.gv_nghi)}</td><td class="r">${dur(tot('minutes'))}</td><td class="r">${money(tot('total'))}</td></tr></table></div></div>`;
  $('#v').innerHTML = html; bindMonth(vStat);
}
function barsH(d) {
  if (!d.length) return '<div class="empty">Chưa có dữ liệu</div>';
  const mx = Math.max(1, ...d.map(x => x.v));
  return d.map(x => `<div style="margin:8px 0"><div class="row sm"><span class="f">${h(x.label)}</span><b>${x.txt}</b></div>
    <div style="background:#f1f5f9;border-radius:8px;height:14px;margin-top:3px"><div style="width:${Math.max(2, x.v / mx * 100)}%;height:100%;background:${x.color};border-radius:8px"></div></div></div>`).join('');
}
function donut(d) {
  const t = d.reduce((a, x) => a + x.v, 0); if (!t) return '<div class="empty">Chưa có dữ liệu</div>';
  let a = -Math.PI / 2, paths = '';
  d.filter(x => x.v).forEach(x => {
    const b = a + x.v / t * Math.PI * 2, L = b - a > Math.PI ? 1 : 0, r = 46, R = 70;
    const P = (ang, rr) => (80 + rr * Math.cos(ang)).toFixed(2) + ' ' + (80 + rr * Math.sin(ang)).toFixed(2);
    paths += x.v === t ? `<circle cx="80" cy="80" r="58" fill="none" stroke="${x.color}" stroke-width="24"/>` :
      `<path d="M${P(a, R)} A${R} ${R} 0 ${L} 1 ${P(b, R)} L${P(b, r)} A${r} ${r} 0 ${L} 0 ${P(a, r)}Z" fill="${x.color}"/>`;
    a = b;
  });
  return `<div class="row wrap"><svg viewBox="0 0 160 160" width="150" height="150">${paths}<text x="80" y="78" text-anchor="middle" font-size="22" font-weight="800">${t}</text><text x="80" y="96" text-anchor="middle" font-size="11" fill="#64748b">buổi</text></svg>
    <div class="f">${d.map(x => `<div class="row sm" style="margin:5px 0"><i style="width:11px;height:11px;border-radius:3px;background:${x.color};display:inline-block"></i><span class="f">${x.label}</span><b>${x.v}</b><span class="mu" style="width:38px;text-align:right">${Math.round(x.v / t * 100)}%</span></div>`).join('')}</div></div>`;
}
function columns(d, fmt) {
  const mx = Math.max(1, ...d.map(x => x.v)), W = 340, H = 170, bw = W / d.length;
  let s = `<svg viewBox="0 0 ${W} ${H + 34}" width="100%">`;
  d.forEach((x, i) => {
    let y = H; const cx = i * bw + bw * 0.18, w = bw * 0.64;
    (x.parts && x.parts.length ? x.parts : [{ v: x.v, color: '#14b8a6' }]).forEach(p => { const hh = p.v / mx * (H - 18); if (hh <= 0) return; y -= hh; s += `<rect x="${cx}" y="${y}" width="${w}" height="${hh}" fill="${p.color}" rx="2"/>`; });
    if (x.v) s += `<text x="${cx + w / 2}" y="${y - 4}" text-anchor="middle" font-size="8.5" fill="#334155">${fmt(x.v)}</text>`;
    s += `<text x="${cx + w / 2}" y="${H + 14}" text-anchor="middle" font-size="10" font-weight="${x.sel ? 800 : 400}" fill="${x.sel ? '#0f766e' : '#64748b'}">${x.label}</text>`;
    if (x.sel) s += `<rect x="${cx - 2}" y="${H + 20}" width="${w + 4}" height="3" fill="#0f766e" rx="1.5"/>`;
  });
  return s + `<line x1="0" y1="${H}" x2="${W}" y2="${H}" stroke="#cbd5e1"/></svg>`;
}

/* ---------------- TAB 4: HỌC PHÍ ---------------- */
function modeText(c) {
  if (c.mode === 'gio') return money(c.rate) + '/giờ' + (+c.roundMin ? ' · làm tròn ' + c.roundMin + "'" : '');
  if (c.mode === 'buoi') return money(c.rate) + '/buổi';
  return money(c.monthlyFee) + '/tháng';
}
async function vFee() {
  $('#v').innerHTML = monthNav() + '<div class="empty">Đang tính học phí…</div>'; bindMonth(vFee);
  if (!S.bill || S.bill.month !== S.month) { const r = await api('bill', { month: S.month }); if (!r.ok) return toast(r.error, 'er'); S.bill = r; }
  if (S.tab !== 'fee') return;
  const B = S.bill.bills.filter(b => (!S.filter.s || b.studentId === S.filter.s));
  const T = k => B.reduce((t, b) => t + b[k], 0);
  let html = monthNav() + (multiStudent() ? `<div class="tabs"><button data-fs="" class="${!S.filter.s ? 'on' : ''}">Tất cả</button>${S.data.students.map(s => `<button data-fs="${s.id}" class="${S.filter.s === s.id ? 'on' : ''}">${h(s.name)}</button>`).join('')}</div>` : '');
  html += `<div class="card"><div class="row"><div class="f"><div class="mu">Tổng học phí ${mLabel(S.month).toLowerCase()}</div><div class="big-money">${money(T('total'))}</div></div>
    <div class="r sm">Đã trả <b class="paid">${money(T('paid'))}</b><br>Còn lại <b class="${T('due') > 0 ? 'due' : 'paid'}">${money(T('due'))}</b></div></div>
    <div class="row" style="margin-top:10px"><button class="btn o s f" id="csv">⬇ Xuất Excel (CSV)</button><button class="btn o s f" id="shAll">📤 Gửi tổng hợp</button></div></div>`;
  B.forEach((b, i) => {
    const c = C(b.courseId);
    html += `<div class="card"><h3><span class="bar" style="background:${c.color};height:20px"></span><span class="f">${h(c.name)}${multiStudent() ? ' · ' + h(SN(b.studentId)) : ''}</span></h3>
      <div class="mu" style="margin-top:-6px">${h(c.teacher || '')} · ${MODE[c.mode]}: ${modeText(c)}</div>
      ${b.unconfirmed ? `<div class="warn">⏳ ${b.unconfirmed} buổi chưa được giáo viên xác nhận</div>` : ''}${b.open ? `<div class="warn">⚠ ${b.open} buổi chưa bấm kết thúc</div>` : ''}
      <table><tr><td>Có mặt / học bù</td><td class="r">${b.attended} buổi · ${dur(b.minutes)}</td></tr>
      <tr><td>Vắng có phép / không phép</td><td class="r">${b.count.vang_phep} / ${b.count.vang_kp}</td></tr>
      ${b.count.gv_nghi ? `<tr><td>Giáo viên nghỉ</td><td class="r">${b.count.gv_nghi}</td></tr>` : ''}
      ${c.mode !== 'thang' ? `<tr><td>Tính tiền</td><td class="r">${b.billCount} buổi${c.mode === 'gio' ? ' · ' + hours(b.billMin) : ''}</td></tr>` : ''}
      <tr><td>Thành tiền</td><td class="r b">${money(b.fee)}</td></tr>
      ${b.adjust ? `<tr><td>Điều chỉnh</td><td class="r">${b.adjust > 0 ? '+' : ''}${money(b.adjust)}</td></tr>` : ''}
      <tr><td>Đã thanh toán</td><td class="r paid">${money(b.paid)}</td></tr>
      <tr class="tot"><td>Còn phải trả</td><td class="r ${b.due > 0 ? 'due' : 'paid'}" style="font-size:17px">${money(b.due)}</td></tr></table>
      <div class="row wrap gap" style="margin-top:8px"><button class="btn o s" data-view="${i}">📄 Phiếu học phí</button><button class="btn o s" data-share="${i}">📤 Gửi Zalo</button>
      ${S.me.role === 'ph' ? `<button class="btn ok s" data-pay="${i}">💵 Thanh toán</button><button class="btn o s" data-adj="${i}">± Điều chỉnh</button>` : ''}</div>
      ${b.pays.length ? `<div class="sm" style="margin-top:8px">${b.pays.map(p => `<div class="row"><span class="f">${p.type === 'dc' ? '± ' + h(p.note || 'Điều chỉnh') : '💵 ' + dmy(p.date) + (p.method ? ' · ' + h(p.method) : '')}${p.type !== 'dc' && p.note ? ' · ' + h(p.note) : ''}</span><b>${money(p.amount)}</b>${S.me.role === 'ph' ? `<button class="btn s o" data-dp="${p.id}">✕</button>` : ''}</div>`).join('')}</div>` : ''}</div>`;
  });
  if (!B.length) html += '<div class="card empty">Chưa có lớp học</div>';
  $('#v').innerHTML = html; bindMonth(vFee); bindFilters(vFee);
  document.querySelectorAll('[data-view]').forEach(x => x.onclick = () => viewBill(B[+x.dataset.view]));
  document.querySelectorAll('[data-share]').forEach(x => x.onclick = () => share(billText(B[+x.dataset.share])));
  document.querySelectorAll('[data-pay]').forEach(x => x.onclick = () => payForm(B[+x.dataset.pay], 'tt'));
  document.querySelectorAll('[data-adj]').forEach(x => x.onclick = () => payForm(B[+x.dataset.adj], 'dc'));
  document.querySelectorAll('[data-dp]').forEach(x => x.onclick = async () => { if (!(await confirmBox('Xóa khoản này?', 'Xóa'))) return; const r = await api('deletePayment', { id: x.dataset.dp }); if (!r.ok) return toast(r.error, 'er'); S.bill = S.sum = null; vFee(); });
  $('#csv').onclick = () => exportCsv(B);
  $('#shAll').onclick = () => share(`HỌC PHÍ ${mLabel(S.month).toUpperCase()}\n` + B.map(b => `• ${C(b.courseId).name}${multiStudent() ? ' (' + SN(b.studentId) + ')' : ''}: ${b.attended} buổi, ${hours(b.minutes)} → ${money(b.total)}${b.paid ? ', đã trả ' + money(b.paid) : ''}, còn ${money(b.due)}`).join('\n') + `\nTỔNG: ${money(T('total'))} · còn lại ${money(T('due'))}`);
}
function billText(b) {
  const c = C(b.courseId);
  return `PHIẾU HỌC PHÍ ${mLabel(S.month).toUpperCase()}\nLớp: ${c.name} – ${c.teacher || ''}\nHọc sinh: ${SN(b.studentId)}\n` +
    b.items.map(i => `${dmy(i.date).slice(0, 5)} ${ST[i.status]}${i.start ? ' ' + i.start + '-' + (i.end || '') : ''}${i.fee ? ': ' + money(i.fee) : ''}`).join('\n') +
    `\n—\nSố buổi có mặt: ${b.attended} (${hours(b.minutes)})\nThành tiền: ${money(b.fee)}${b.adjust ? '\nĐiều chỉnh: ' + money(b.adjust) : ''}${b.paid ? '\nĐã thanh toán: ' + money(b.paid) : ''}\nCÒN PHẢI TRẢ: ${money(b.due)}`;
}
function share(t) {
  if (NATIVE && Native.share) Native.share(t);
  else if (navigator.share) navigator.share({ text: t }).catch(() => { });
  else navigator.clipboard.writeText(t).then(() => toast('Đã chép — dán vào Zalo để gửi', 'ok'));
}
function billHtml(b) {
  const c = C(b.courseId);
  return `<div class="pr"><div class="mu c">${h(S.data.appName || 'Giờ học')}</div><h2>PHIẾU HỌC PHÍ ${mLabel(S.month).toUpperCase()}</h2>
    <p>Lớp: <b>${h(c.name)}</b> · Giáo viên: <b>${h(c.teacher || '')}</b><br>Học sinh: <b>${h(SN(b.studentId))}</b> · Cách tính: ${MODE[c.mode]} (${modeText(c)})</p>
    <table><tr><th>#</th><th>Ngày</th><th>Giờ học</th><th>Trạng thái</th>${c.mode === 'gio' ? '<th class="r">Giờ tính</th>' : ''}<th class="r">Tiền</th><th>XN</th></tr>
    ${b.items.map((i, k) => `<tr><td>${k + 1}</td><td>${dmy(i.date)}</td><td>${i.start ? i.start + '–' + (i.end || '…') + ' (' + dur(i.minutes) + ')' : ''}</td><td>${ST[i.status]}</td>${c.mode === 'gio' ? `<td class="r">${i.billMin ? dur(i.billMin) : ''}</td>` : ''}<td class="r">${i.fee ? money(i.fee) : ''}</td><td>${i.confirmed ? '✔' : ''}</td></tr>`).join('')}
    <tr class="tot"><td colspan="${c.mode === 'gio' ? 5 : 4}">Thành tiền (${b.attended} buổi có mặt, ${hours(b.minutes)})</td><td class="r">${money(b.fee)}</td><td></td></tr>
    ${b.pays.map(p => `<tr><td colspan="${c.mode === 'gio' ? 5 : 4}">${p.type === 'dc' ? 'Điều chỉnh: ' + h(p.note || '') : 'Đã thanh toán ' + dmy(p.date) + (p.method ? ' (' + h(p.method) + ')' : '')}</td><td class="r">${p.type === 'dc' ? money(p.amount) : '−' + money(p.amount)}</td><td></td></tr>`).join('')}
    <tr class="tot"><td colspan="${c.mode === 'gio' ? 5 : 4}">CÒN PHẢI TRẢ</td><td class="r">${money(b.due)}</td><td></td></tr></table>
    <div class="sig"><div><b>Phụ huynh</b><br><br><br></div><div><b>Giáo viên</b><br><br><br>${h(c.teacher || '')}</div></div></div>`;
}
function viewBill(b) {
  modal(`${head('Phiếu học phí')}<div style="overflow-x:auto">${billHtml(b)}</div><div style="height:12px"></div>
    <div class="row"><button class="btn o f" id="pr">🖨 In / Lưu PDF</button><button class="btn p f" id="sh">📤 Gửi Zalo</button></div>`, el => {
    el.querySelector('#sh').onclick = () => share(billText(b));
    el.querySelector('#pr').onclick = () => { $('#print').innerHTML = billHtml(b); window.print(); };
  });
}
function payForm(b, type) {
  const c = C(b.courseId);
  modal(`${head(type === 'dc' ? 'Điều chỉnh học phí' : 'Ghi nhận thanh toán')}<div class="mu">${h(c.name)} · ${h(SN(b.studentId))} · ${mLabel(S.month)}</div>
    <label>${type === 'dc' ? 'Số tiền (+ thu thêm, − giảm trừ)' : 'Số tiền (đ)'}</label><input id="am" inputmode="numeric" value="${type === 'tt' && b.due > 0 ? b.due : ''}">
    ${type === 'tt' ? `<div class="g2"><div><label>Ngày trả</label><input id="dt" type="date" value="${today()}"></div><div><label>Hình thức</label><select id="me"><option>Chuyển khoản</option><option>Tiền mặt</option></select></div></div>` : ''}
    <label>Ghi chú</label><input id="nt" placeholder="${type === 'dc' ? 'VD: tiền tài liệu, giảm giá…' : ''}"><div style="height:14px"></div><button class="btn p w" id="sv">Lưu</button>`, el => {
    el.querySelector('#sv').onclick = async e => {
      const am = Number(val(el, 'am').replace(/[^\d-]/g, ''));
      busy(e.target, true);
      const r = await api('savePayment', { payment: { courseId: b.courseId, studentId: b.studentId, month: S.month, type, amount: am, date: val(el, 'dt'), method: val(el, 'me'), note: val(el, 'nt') } });
      busy(e.target, false); if (!r.ok) return toast(r.error, 'er');
      closeModal(); toast('Đã lưu', 'ok'); S.bill = S.sum = null; vFee();
    };
  });
}
function download(name, text, mime) {
  if (NATIVE) { const x = Native.saveFile(name, mime, text, false); if (x !== 'OK') toast(x, 'er'); return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name; a.click();
}
function exportCsv(B) {
  const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const L = [['Lớp', 'Giáo viên', 'Học sinh', 'Ngày', 'Bắt đầu', 'Kết thúc', 'Số phút', 'Trạng thái', 'Phút tính tiền', 'Tiền (đ)', 'GV xác nhận', 'Ghi chú']];
  B.forEach(b => { const c = C(b.courseId); b.items.forEach(i => L.push([c.name, c.teacher, SN(b.studentId), dmy(i.date), i.start, i.end, i.minutes, ST[i.status], i.billMin, i.fee, i.confirmed ? 'x' : '', i.note])); });
  L.push([]); L.push(['TỔNG HỢP', '', '', '', '', '', '', '', '', '', '', '']);
  B.forEach(b => { const c = C(b.courseId); L.push([c.name, c.teacher, SN(b.studentId), 'Thành tiền', b.fee, 'Điều chỉnh', b.adjust, 'Đã trả', b.paid, 'Còn lại', b.due]); });
  download('HocPhi_' + S.month + '.csv', '﻿' + L.map(r => r.map(q).join(',')).join('\r\n'), 'text/csv');
}

/* ---------------- TAB 5: KHÁC / QUẢN LÝ ---------------- */
function vMore() {
  const ph = S.me.role === 'ph';
  let html = `<div class="card row"><div class="f"><b>${h(S.me.name)}</b><div class="mu">${ROLE[S.me.role]} · ${h(S.me.username)}</div></div></div>`;
  if (ph) html += `<div class="card"><h3>Quản lý</h3><div class="list-a">
      <div id="mCourse">📚 <span class="f">Lớp học, lịch học, đơn giá</span><span class="mu">${S.data.courses.length} ›</span></div>
      <div id="mStud">🧒 <span class="f">Học sinh</span><span class="mu">${S.data.students.length} ›</span></div>
      <div id="mUser">👤 <span class="f">Tài khoản (giáo viên, học sinh)</span><span class="mu">${S.data.users.length} ›</span></div>
      <div id="mBak">💾 <span class="f">Sao lưu dữ liệu (JSON)</span></div>
      <div id="mName">✏ <span class="f">Tên phần mềm</span><span class="mu">${h(S.data.appName)}</span></div></div></div>`;
  html += `<div class="card"><h3>Cài đặt</h3><div class="list-a">
      ${NATIVE ? `<div id="mRem">⏰ <span class="f">Nhắc giờ học trước</span><span class="mu">${LS.get('remind', true) ? LS.get('remindBefore', 15) + ' phút' : 'Tắt'}</span></div>` : ''}
      <div id="mPass">🔑 <span class="f">Đổi mật khẩu</span></div>
      ${NATIVE ? '<div id="mUpd">⬆ <span class="f">Kiểm tra cập nhật</span><span class="mu">' + NATIVE.versionName + '</span></div>' : `<div id="mApk">📱 <span class="f">Cài app (Android / iPhone)</span></div>`}
      ${S.demo ? '<div id="mReset">♻ <span class="f">Xóa dữ liệu dùng thử</span></div>' : ''}
      <div id="mOut" style="color:var(--er)">⎋ <span class="f">Đăng xuất</span></div></div></div>
    <p class="mu c">Giờ học · giao diện ${APPV}${S.demo ? ' · chế độ dùng thử' : ''}</p>`;
  $('#v').innerHTML = html;
  const on = (id, f) => { const e = $('#' + id); if (e) e.onclick = f; };
  on('mCourse', courseList); on('mStud', studentList); on('mUser', userList); on('mPass', () => changePass(false)); on('mOut', () => logout());
  on('mUpd', () => Native.checkUpdate(true)); on('mApk', () => location.href = 'download/');
  on('mReset', async () => { if (await confirmBox('Xóa toàn bộ dữ liệu dùng thử?', 'Xóa')) { DEMO.reset(); logout(true); } });
  on('mBak', async () => { const r = await api('backup'); if (!r.ok) return toast(r.error, 'er'); download('GioHoc_saoluu_' + today() + '.json', JSON.stringify(r.data, null, 1), 'application/json'); });
  on('mName', () => modal(`${head('Tên phần mềm')}<input id="n" value="${h(S.data.appName)}"><div style="height:12px"></div><button class="btn p w" id="sv">Lưu</button>`, el => el.querySelector('#sv').onclick = async () => { const r = await api('saveConfig', { appName: val(el, 'n') }); if (!r.ok) return toast(r.error, 'er'); closeModal(); await reload(); render(); }));
  on('mRem', () => modal(`${head('Nhắc giờ học')}<label class="chk"><input type="checkbox" id="on" ${LS.get('remind', true) ? 'checked' : ''}>Bật thông báo nhắc giờ học</label>
    <label>Nhắc trước giờ học (phút)</label><select id="bf">${[5, 10, 15, 30, 60].map(x => `<option ${x === LS.get('remindBefore', 15) ? 'selected' : ''}>${x}</option>`).join('')}</select>
    <p class="mu sm">Ngoài ra, khi hết giờ học mà chưa bấm Kết thúc, app sẽ nhắc.</p><button class="btn p w" id="sv">Lưu</button>`, el => el.querySelector('#sv').onclick = () => { LS.set('remind', val(el, 'on')); LS.set('remindBefore', +val(el, 'bf')); syncNative(); closeModal(); vMore(); toast('Đã lưu', 'ok'); }));
}

function courseList() {
  modal(`${head('Lớp học')}<div class="list-a">${S.data.courses.map(c => `<div data-c="${c.id}"><span class="bar" style="background:${c.color};height:34px"></span><div class="f"><b>${h(c.name)}</b>${isT(c.active) ? '' : ' <span class="chip">Ngừng</span>'}<div class="mu">${h(c.teacher || '')} · ${MODE[c.mode]} ${modeText(c)}<br>${(c.schedule || []).map(z => WDS[z.d] + ' ' + z.t).join(', ') || 'Chưa có lịch'}</div></div>›</div>`).join('')}</div>
    <div style="height:10px"></div><button class="btn p w" id="nw">＋ Thêm lớp học</button>`, el => {
    el.querySelectorAll('[data-c]').forEach(d => d.onclick = () => courseForm(S.data.courses.find(c => c.id === d.dataset.c)));
    el.querySelector('#nw').onclick = () => courseForm(null);
  });
}
function courseForm(c) {
  const isNew = !c;
  c = c || { name: '', teacher: '', mode: 'gio', rate: '', monthlyFee: '', roundMin: 15, minMin: 0, defaultMin: 90, schedule: [], studentIds: S.data.students.map(s => s.id).join(','),
    chargeExcused: '0', chargeUnexcused: '1', radius: 150, requireGps: '0', active: '1', color: COLORS[S.data.courses.length % COLORS.length] };
  const sch = (c.schedule || []).slice(), sids = HT.list(c.studentIds);
  modal(`${head(isNew ? 'Thêm lớp học' : 'Sửa lớp học')}
    <label>Tên lớp / môn</label><input id="name" value="${h(c.name)}" placeholder="VD: Tiếng Anh">
    <div class="g2"><div><label>Giáo viên</label><input id="teacher" value="${h(c.teacher || '')}"></div><div><label>SĐT giáo viên</label><input id="teacherPhone" inputmode="tel" value="${h(c.teacherPhone || '')}"></div></div>
    <div class="g2"><div><label>Nơi học</label><input id="place" value="${h(c.place || '')}"></div><div><label>Màu</label><input id="color" type="color" value="${c.color || '#2563eb'}" style="height:44px;padding:4px"></div></div>
    <label>Cách tính học phí</label><select id="mode">${Object.keys(MODE).map(k => `<option value="${k}" ${c.mode === k ? 'selected' : ''}>${MODE[k]}</option>`).join('')}</select>
    <div id="mw"></div>
    <label class="chk"><input type="checkbox" id="chargeExcused" ${isT(c.chargeExcused) ? 'checked' : ''}>Vắng CÓ phép vẫn tính tiền</label>
    <label class="chk"><input type="checkbox" id="chargeUnexcused" ${isT(c.chargeUnexcused) ? 'checked' : ''}>Vắng KHÔNG phép vẫn tính tiền</label>
    <label>Lịch học hằng tuần</label><div id="sch"></div><button class="btn o s" id="addS">＋ Thêm buổi trong tuần</button>
    <label>Học sinh học lớp này</label>${S.data.students.map(s => `<label class="chk"><input type="checkbox" class="sid" value="${s.id}" ${sids.includes(s.id) ? 'checked' : ''}>${h(s.name)}</label>`).join('') || '<div class="mu">Chưa có học sinh</div>'}
    <label>📍 Vị trí nơi học (để kiểm tra điểm danh bằng GPS — không bắt buộc)</label>
    <div class="g2"><input id="lat" placeholder="Vĩ độ" value="${h(c.lat || '')}"><input id="lng" placeholder="Kinh độ" value="${h(c.lng || '')}"></div>
    <div class="row" style="margin-top:6px"><button class="btn o s" id="here">📍 Lấy vị trí hiện tại</button><span class="f"></span><span class="sm">Bán kính</span><input id="radius" style="width:80px" inputmode="numeric" value="${c.radius || 150}"><span class="sm">m</span></div>
    <label class="chk"><input type="checkbox" id="requireGps" ${isT(c.requireGps) ? 'checked' : ''}>Bắt buộc ở đúng nơi học mới được bấm Bắt đầu</label>
    <label class="chk"><input type="checkbox" id="active" ${isT(c.active) ? 'checked' : ''}>Đang học (bỏ chọn khi nghỉ hẳn lớp)</label>
    <label>Ghi chú</label><input id="note" value="${h(c.note || '')}">
    <div style="height:14px"></div><div class="row">${isNew ? '' : '<button class="btn er" id="del">Xóa</button>'}<button class="btn p f" id="sv">Lưu lớp học</button></div>`, el => {
    const mw = () => {
      const m = val(el, 'mode');
      el.querySelector('#mw').innerHTML = m === 'thang' ? `<label>Học phí trọn gói / tháng (đ)</label><input id="monthlyFee" inputmode="numeric" value="${h(c.monthlyFee || '')}">` :
        `<label>Đơn giá ${m === 'gio' ? 'mỗi giờ' : 'mỗi buổi'} (đ)</label><input id="rate" inputmode="numeric" value="${h(c.rate || '')}">` +
        (m === 'gio' ? `<div class="g3" style="grid-template-columns:1fr 1fr 1fr"><div><label>Làm tròn (phút)</label><select id="roundMin">${[0, 5, 10, 15, 30].map(x => `<option ${+c.roundMin === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
          <div><label>Tối thiểu (phút)</label><input id="minMin" inputmode="numeric" value="${c.minMin || 0}"></div><div><label>Buổi vắng tính (phút)</label><input id="defaultMin" inputmode="numeric" value="${c.defaultMin || 90}"></div></div>` : '');
    };
    const drawS = () => {
      el.querySelector('#sch').innerHTML = sch.map((z, i) => `<div class="g3" style="margin-bottom:6px"><select data-i="${i}" data-k="d">${WD.slice(1).map((w, k) => `<option value="${k + 1}" ${+z.d === k + 1 ? 'selected' : ''}>${w}</option>`).join('')}</select>
        <input type="time" data-i="${i}" data-k="t" value="${z.t}"><select data-i="${i}" data-k="m">${[45, 60, 75, 90, 105, 120, 150, 180].map(m => `<option value="${m}" ${+z.m === m ? 'selected' : ''}>${dur(m)}</option>`).join('')}</select><button class="btn s o" data-rm="${i}">✕</button></div>`).join('');
      el.querySelectorAll('#sch [data-k]').forEach(x => x.onchange = () => { sch[+x.dataset.i][x.dataset.k] = x.dataset.k === 't' ? x.value : +x.value; });
      el.querySelectorAll('[data-rm]').forEach(x => x.onclick = () => { sch.splice(+x.dataset.rm, 1); drawS(); });
    };
    mw(); drawS(); el.querySelector('#mode').onchange = mw;
    el.querySelector('#addS').onclick = () => { sch.push({ d: 1, t: '18:00', m: 90 }); drawS(); };
    el.querySelector('#here').onclick = async e => { busy(e.target, true); const p = await getPos(); busy(e.target, false); if (!p) return toast('Không lấy được vị trí. Bật GPS và cho phép quyền vị trí.', 'er'); el.querySelector('#lat').value = p.lat.toFixed(6); el.querySelector('#lng').value = p.lng.toFixed(6); toast('Đã lấy vị trí (sai số ~' + Math.round(p.acc) + ' m)', 'ok'); };
    el.querySelector('#sv').onclick = async e => {
      const x = { id: c.id, schedule: sch.filter(z => z.t), studentIds: [...el.querySelectorAll('.sid:checked')].map(i => i.value) };
      ['name', 'teacher', 'teacherPhone', 'place', 'color', 'mode', 'rate', 'monthlyFee', 'roundMin', 'minMin', 'defaultMin', 'chargeExcused', 'chargeUnexcused', 'lat', 'lng', 'radius', 'requireGps', 'active', 'note'].forEach(k => { const v = val(el, k); if (el.querySelector('#' + k)) x[k] = typeof v === 'string' && ['rate', 'monthlyFee'].includes(k) ? v.replace(/\D/g, '') : v; });
      if (x.mode !== 'thang' && !+x.rate && !(await confirmBox('Chưa nhập đơn giá — học phí sẽ tính bằng 0 đ. Vẫn lưu?', 'Vẫn lưu'))) return;
      busy(e.target, true); const r = await api('saveCourse', { course: x }); busy(e.target, false);
      if (!r.ok) return toast(r.error, 'er'); toast('Đã lưu lớp học', 'ok'); S.bill = S.sum = null; await reload(); render(); courseList();
    };
    const del = el.querySelector('#del');
    if (del) del.onclick = async () => { if (!(await confirmBox(`Xóa lớp <b>${h(c.name)}</b>? (Nếu đã có buổi học, lớp chỉ chuyển sang “Ngừng” để giữ lịch sử.)`, 'Xóa'))) return; const r = await api('deleteCourse', { id: c.id }); if (!r.ok) return toast(r.error, 'er'); toast(r.archived ? 'Đã chuyển lớp sang Ngừng' : 'Đã xóa', 'ok'); await reload(); render(); courseList(); };
  });
}
function studentList() {
  modal(`${head('Học sinh')}<div class="list-a">${S.data.students.map(s => `<div data-s="${s.id}">🧒 <div class="f"><b>${h(s.name)}</b><div class="mu">${h(s.grade || '')} ${h(s.note || '')}</div></div>›</div>`).join('')}</div>
    <div style="height:10px"></div><button class="btn p w" id="nw">＋ Thêm học sinh</button>`, el => {
    const form = s => {
      s = s || { name: '', grade: '', note: '' };
      modal(`${head(s.id ? 'Sửa học sinh' : 'Thêm học sinh')}<label>Họ tên</label><input id="name" value="${h(s.name)}"><label>Lớp (ở trường)</label><input id="grade" value="${h(s.grade || '')}" placeholder="VD: Lớp 8A">
        <label>Trường học</label><input id="school" value="${h(s.school || '')}">
        <label>📍 Vị trí trường (để tra cứu)</label><div class="g2"><input id="schoolLat" placeholder="Vĩ độ" value="${h(s.schoolLat || '')}"><input id="schoolLng" placeholder="Kinh độ" value="${h(s.schoolLng || '')}"></div>
        <button class="btn o s" id="here" style="margin-top:6px">📍 Lấy vị trí hiện tại</button>
        <label>Ghi chú</label><input id="note" value="${h(s.note || '')}"><div style="height:14px"></div><button class="btn p w" id="sv">Lưu</button>`, e2 => {
        e2.querySelector('#here').onclick = async () => { const q = await getPos(); if (!q) return toast('Không lấy được vị trí', 'er'); e2.querySelector('#schoolLat').value = q.lat.toFixed(6); e2.querySelector('#schoolLng').value = q.lng.toFixed(6); };
        e2.querySelector('#sv').onclick = async () => { const r = await api('saveStudent', { student: { id: s.id, name: val(e2, 'name'), grade: val(e2, 'grade'), note: val(e2, 'note'), school: val(e2, 'school'), schoolLat: val(e2, 'schoolLat'), schoolLng: val(e2, 'schoolLng') } }); if (!r.ok) return toast(r.error, 'er'); await reload(); render(); studentList(); toast('Đã lưu', 'ok'); };
      });
    };
    el.querySelectorAll('[data-s]').forEach(d => d.onclick = () => form(S.data.students.find(s => s.id === d.dataset.s)));
    el.querySelector('#nw').onclick = () => form(null);
  });
}
function userList() {
  modal(`${head('Tài khoản')}<p class="mu sm">Tạo tài khoản cho giáo viên (xem & xác nhận buổi học, xem học phí lớp mình) và cho con (tự bấm Bắt đầu / Kết thúc).</p>
    <div class="list-a">${S.data.users.map(u => `<div data-u="${u.id}">${u.role === 'ph' ? '👨‍👩‍👧' : u.role === 'gv' ? '👩‍🏫' : '🧒'} <div class="f"><b>${h(u.name)}</b>${u.active ? '' : ' <span class="chip">Khóa</span>'}<div class="mu">${h(u.username)} · ${ROLE[u.role]}${u.role === 'gv' ? ' · ' + HT.list(u.courseIds).map(id => C(id).name).join(', ') : ''}${u.role === 'hs' ? ' · ' + h(SN(u.studentId)) : ''}</div></div>›</div>`).join('')}</div>
    <div style="height:10px"></div><button class="btn p w" id="nw">＋ Thêm tài khoản</button>`, el => {
    el.querySelectorAll('[data-u]').forEach(d => d.onclick = () => userForm(S.data.users.find(u => u.id === d.dataset.u)));
    el.querySelector('#nw').onclick = () => userForm(null);
  });
}
function userForm(u) {
  const isNew = !u; u = u || { username: '', name: '', role: 'gv', courseIds: '', studentId: '', phone: '', active: true };
  const cids = HT.list(u.courseIds);
  modal(`${head(isNew ? 'Thêm tài khoản' : 'Sửa tài khoản')}
    <label>Vai trò</label><select id="role">${Object.keys(ROLE).map(k => `<option value="${k}" ${u.role === k ? 'selected' : ''}>${ROLE[k]}</option>`).join('')}</select>
    <label>Họ tên</label><input id="name" value="${h(u.name)}"><label>Tên đăng nhập (không dấu)</label><input id="username" autocapitalize="off" value="${h(u.username)}">
    <label>Số điện thoại</label><input id="phone" inputmode="tel" value="${h(u.phone || '')}">
    <div id="rx"></div>
    <label>${isNew ? 'Mật khẩu ban đầu (để trống = 123456)' : 'Đặt lại mật khẩu (để trống = giữ nguyên)'}</label><input id="password" type="text" autocomplete="off">
    <label class="chk"><input type="checkbox" id="active" ${u.active ? 'checked' : ''}>Đang hoạt động</label>
    <div style="height:14px"></div><button class="btn p w" id="sv">Lưu</button>`, el => {
    const rx = () => {
      const r = val(el, 'role');
      el.querySelector('#rx').innerHTML = r === 'gv' ? `<label>Phụ trách lớp</label>${S.data.courses.map(c => `<label class="chk"><input type="checkbox" class="cid" value="${c.id}" ${cids.includes(c.id) ? 'checked' : ''}>${h(c.name)}</label>`).join('')}`
        : r === 'hs' ? `<label>Là học sinh</label><select id="studentId">${S.data.students.map(s => `<option value="${s.id}" ${u.studentId === s.id ? 'selected' : ''}>${h(s.name)}</option>`).join('')}</select>` : '';
    };
    rx(); el.querySelector('#role').onchange = rx;
    el.querySelector('#sv').onclick = async e => {
      const x = { id: u.id, role: val(el, 'role'), name: val(el, 'name'), username: val(el, 'username'), phone: val(el, 'phone'), password: val(el, 'password'), active: val(el, 'active') ? 1 : 0,
        courseIds: [...el.querySelectorAll('.cid:checked')].map(i => i.value), studentId: val(el, 'studentId') };
      busy(e.target, true); const r = await api('saveUser', { user: x }); busy(e.target, false);
      if (!r.ok) return toast(r.error, 'er'); await reload(); userList();
      toast(isNew ? `Đã tạo: ${x.username} / ${x.password || '123456'}` : 'Đã lưu', 'ok');
    };
  });
}

/* ---------------- Thông báo ---------------- */
function showNotifs() {
  const l = S.data.notifs || [];
  LS.set('seen', (S.data.now && S.data.now.iso) || ''); S.data.unread = 0; render();
  modal(`${head('Thông báo')}${l.length ? `<div class="list-a">${l.map(n => `<div style="cursor:default"><div class="f"><b>${h(n.title)}</b><div class="sm">${h(n.body)}</div><div class="mu">${h(n.at.replace('T', ' ').slice(0, 16))}</div></div></div>`).join('')}</div>` : '<div class="empty">Chưa có thông báo</div>'}`);
}

/* ---------------- Cầu nối app Android ---------------- */
window.__nativeBack = () => { if ($('#modal').innerHTML) { closeModal(); return 'ok'; } if (S.tab !== 'home' && S.token) { go('home'); return 'ok'; } return 'exit'; };
window.__nativeResume = () => { if (S.token && S.data) reload(true).then(ok => { if (ok && !$('#modal').innerHTML && (S.tab === 'home' || S.tab === 'log')) render(); }); };
window.__nativeOpen = k => { if (k === 'notifs' && S.data) showNotifs(); };

if ('serviceWorker' in navigator && !NATIVE && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
if (S.token && S.me) start(); else viewLogin();
