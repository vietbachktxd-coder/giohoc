/* GIỜ HỌC 2.0 — giao diện hiện đại, thao tác 1 chạm, nhắc & chia sẻ học phí */
'use strict';

/* ---------- Chế độ sáng / tối ---------- */
function applyTheme() {
  const t = LS.get('theme', 'auto'), dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = dark ? '#0b1f1d' : '#0f766e';
}
applyTheme(); matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

/* ---------- Gắn thêm vào các màn hình ---------- */
const _render = render;
render = function () {
  _render();
  const v = $('#v'); if (v) { v.classList.remove('fade'); void v.offsetWidth; v.classList.add('fade'); }
  fab(); headerExtras();
};
const _vHome = vHome;
vHome = function (hdr) { _vHome(hdr); heroCard(); feeBanner(); };
const _vMore = vMore;
vMore = function () {
  _vMore();
  const c = document.querySelector('#v .card:nth-of-type(2) .list-a') || document.querySelector('#v .list-a');
  const t = LS.get('theme', 'auto');
  if (c) c.insertAdjacentHTML('afterbegin', `<div id="mTheme">🌓 <span class="f">Giao diện</span><span class="mu">${{ auto: 'Tự động', light: 'Sáng', dark: 'Tối' }[t]} ›</span></div>`);
  const b = $('#mTheme'); if (b) b.onclick = () => { LS.set('theme', { auto: 'light', light: 'dark', dark: 'auto' }[LS.get('theme', 'auto')]); applyTheme(); vMore(); };
};

/* ---------- Nút ＋ nổi: ghi nhanh 1 chạm ---------- */
function fab() {
  let f = $('#fab'); if (!f) { f = document.createElement('button'); f.id = 'fab'; f.textContent = '＋'; document.body.appendChild(f); f.onclick = quickMenu; }
  f.style.display = S.token && S.data && ['home', 'log', 'fee', 'school'].includes(S.tab) ? '' : 'none';
}
function quickMenu() {
  const nx = nextLessons()[0], ph = S.me.role === 'ph';
  modal(`${head('Ghi nhanh')}<div class="list-a">
    ${nx && !nx.open ? `<div id="qIn">▶ <span class="f"><b>Bắt đầu ${h(nx.c.name)}</b>${multiStudent() ? ' · ' + h(SN(nx.sid)) : ''}<div class="mu">Lịch ${nx.t}</div></span></div>` : ''}
    ${openSessions().length ? `<div id="qOut">■ <span class="f"><b>Kết thúc buổi đang học</b></span></div>` : ''}
    <div id="qAdd">✎ <span class="f">Ghi buổi học (quên điểm danh)</span></div>
    ${S.me.role !== 'hs' ? '<div id="qAbs">🚫 <span class="f">Báo vắng hôm nay</span></div>' : ''}
    ${ph ? '<div id="qPay">💵 <span class="f">Ghi nộp học phí</span></div>' : ''}
    ${ph ? '<div id="qRep">📊 <span class="f">Gửi báo cáo học phí tháng</span></div>' : ''}</div>`, el => {
    const on = (id, f) => { const e = el.querySelector('#' + id); if (e) e.onclick = () => { closeModal(); f(); }; };
    on('qIn', () => checkIn(nx.c.id, nx.sid, document.createElement('button')));
    on('qOut', () => { const s = openSessions()[0]; checkOut(s.id, document.createElement('button')); });
    on('qAdd', () => sessionForm(null));
    on('qAbs', () => { const x = nx || (pairs()[0] && { c: pairs()[0].c, sid: pairs()[0].sid }); if (x) absentForm(x.c.id, x.sid); });
    on('qPay', async () => { S.tab = 'fee'; render(); });
    on('qRep', monthReport);
  });
}

/* ---------- Buổi học sắp tới / đang diễn ra ---------- */
function nextLessons() {
  const d = today(), w = HT.dow(d), n = nowMin(), out = [];
  pairs().forEach(x => (x.c.schedule || []).filter(z => +z.d === w).forEach(z => {
    const done = S.data.sessions.some(s => s.date === d && s.courseId === x.c.id && s.studentId === x.sid);
    const open = openSessions().some(s => s.courseId === x.c.id && s.studentId === x.sid);
    const end = HT.min(z.t) + (+z.m || 90);
    if (!done || open) if (end + 30 > n) out.push({ c: x.c, sid: x.sid, t: z.t, m: +z.m || 90, open, diff: HT.min(z.t) - n });
  }));
  return out.sort((a, b) => a.t < b.t ? -1 : 1);
}
function heroCard() {
  if (S.me.role === 'gv' || !S.tk || S.tk.view !== 'today') return;
  const L = nextLessons().filter(x => !x.open); if (!L.length) return;
  const x = L[0], soon = x.diff <= 30;
  const when = x.diff > 0 ? `còn ${x.diff >= 60 ? Math.floor(x.diff / 60) + ' giờ ' : ''}${x.diff % 60} phút` : 'đang trong giờ học';
  const box = document.createElement('div'); box.className = 'card hero' + (soon ? ' soon' : '');
  box.innerHTML = `<div class="row"><div class="f"><div class="sm" style="opacity:.85">${soon ? '⏰ Sắp đến giờ' : '📅 Buổi tiếp theo hôm nay'} · ${when}</div>
    <div class="b" style="font-size:19px">${h(x.c.name)}${multiStudent() ? ' · ' + h(SN(x.sid)) : ''}</div><div class="sm" style="opacity:.85">${x.t} · ${h(x.c.teacher || '')}${x.c.place ? ' · ' + h(x.c.place) : ''}</div></div>
    <button class="btn big" id="heroGo">▶ Bắt đầu</button></div>`;
  const tabs = document.querySelector('#v .tabs'); $('#v').insertBefore(box, tabs ? tabs.nextSibling : $('#v').firstChild);
  box.querySelector('#heroGo').onclick = e => checkIn(x.c.id, x.sid, e.target);
}

/* ---------- Nhắc học phí cuối / đầu tháng ---------- */
async function feeBanner() {
  if (S.me.role !== 'ph') return;
  const day = new Date().getDate(), m = day >= 25 ? thisMonth() : day <= 7 ? addMonth(thisMonth(), -1) : '';
  if (!m || LS.get('feeHide', '') === m) return;
  if (!S.feeCache || S.feeCache.month !== m) { const r = await api('bill', { month: m }); if (!r.ok) return; S.feeCache = r; }
  const B = S.feeCache, due = B.bills.reduce((a, b) => a + b.due, 0) + (B.school || []).reduce((a, b) => a + b.due, 0);
  if (due <= 0 || S.tab !== 'home' || $('#feeBn')) return;
  const box = document.createElement('div'); box.className = 'card warn'; box.id = 'feeBn';
  box.innerHTML = `<div class="row"><span style="font-size:22px">💰</span><div class="f">Học phí ${mLabel(m).toLowerCase()} còn <b>${money(due)}</b></div>
    <button class="btn s ok" id="fbGo">Xem</button><button class="btn s o" id="fbX">✕</button></div>`;
  const tabs = document.querySelector('#v .tabs'); $('#v').insertBefore(box, tabs ? tabs.nextSibling : $('#v').firstChild);
  box.querySelector('#fbGo').onclick = () => { S.month = m; LS.set('month', m); S.bill = B; go('fee'); };
  box.querySelector('#fbX').onclick = () => { LS.set('feeHide', m); box.remove(); };
}

/* ---------- Ảnh phiếu học phí / báo cáo tháng (gửi Zalo) ---------- */
function drawCard(title, sub, rows, total) {
  const W = 1080, P = 56, lh = 58, H = 330 + rows.length * lh + 200, cv = document.createElement('canvas');
  cv.width = W; cv.height = H; const g = cv.getContext('2d');
  g.fillStyle = '#f1f5f4'; g.fillRect(0, 0, W, H);
  const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, '#0f766e'); gr.addColorStop(1, '#14b8a6');
  g.fillStyle = gr; g.fillRect(0, 0, W, 230);
  g.fillStyle = '#fff'; g.font = 'bold 54px system-ui, sans-serif'; g.fillText(title, P, 105);
  g.font = '32px system-ui, sans-serif'; g.fillText(sub, P, 165);
  g.fillStyle = '#fff'; g.beginPath(); g.roundRect ? g.roundRect(P / 2, 260, W - P, rows.length * lh + 60, 28) : g.rect(P / 2, 260, W - P, rows.length * lh + 60); g.fill();
  rows.forEach((r, i) => {
    const y = 320 + i * lh; g.font = (r[2] ? 'bold ' : '') + '33px system-ui, sans-serif';
    g.fillStyle = r[3] || '#0f172a'; g.textAlign = 'left'; g.fillText(r[0], P, y); g.textAlign = 'right'; g.fillText(r[1], W - P, y);
    if (r[4]) { g.strokeStyle = '#e2e8f0'; g.beginPath(); g.moveTo(P, y + 20); g.lineTo(W - P, y + 20); g.stroke(); }
  });
  const ty = 340 + rows.length * lh + 60; g.textAlign = 'left'; g.fillStyle = '#64748b'; g.font = '32px system-ui, sans-serif'; g.fillText(total[0], P, ty);
  g.textAlign = 'right'; g.fillStyle = total[2] || '#dc2626'; g.font = 'bold 58px system-ui, sans-serif'; g.fillText(total[1], W - P, ty + 10);
  g.textAlign = 'left'; g.fillStyle = '#94a3b8'; g.font = '24px system-ui, sans-serif'; g.fillText('Giờ học · ' + new Date().toLocaleDateString('vi-VN'), P, H - 30);
  return cv;
}
async function shareCanvas(cv, name, text) {
  const b64 = cv.toDataURL('image/png').split(',')[1];
  if (NATIVE && Native.shareImage) { const r = Native.shareImage(name, b64, text); if (r !== 'OK') toast(r, 'er'); return; }
  try {
    const blob = await new Promise(r => cv.toBlob(r, 'image/png')), f = new File([blob], name, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [f] })) return await navigator.share({ files: [f], text });
  } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = cv.toDataURL('image/png'); a.download = name; a.click(); share(text);
}
function billImage(b) {
  const c = C(b.courseId), rows = b.items.map(i => [dmy(i.date).slice(0, 5) + '  ' + (i.start ? i.start + '–' + (i.end || '') : ST[i.status]), i.fee ? money(i.fee) : '', false, i.fee ? '' : '#94a3b8', true]);
  rows.push([`Có mặt ${b.attended} buổi · ${hours(b.minutes)}`, money(b.fee), true]);
  if (b.adjust) rows.push(['Điều chỉnh', money(b.adjust)]);
  if (b.paid) rows.push(['Đã thanh toán', '−' + money(b.paid), false, '#16a34a']);
  return drawCard('Phiếu học phí ' + mLabel(S.month).toLowerCase(), `${c.name} · ${c.teacher || ''} · ${SN(b.studentId)}`, rows, ['Còn phải trả', money(b.due), b.due > 0 ? '#dc2626' : '#16a34a']);
}
async function monthReport() {
  if (!S.bill || S.bill.month !== S.month) { const r = await api('bill', { month: S.month }); if (!r.ok) return toast(r.error, 'er'); S.bill = r; }
  const B = S.bill.bills, K = S.bill.school || [], rows = [];
  B.forEach(b => rows.push([`📚 ${C(b.courseId).name}${multiStudent() ? ' (' + SN(b.studentId) + ')' : ''} · ${b.attended} buổi`, money(b.total), false, '', true]));
  K.forEach(b => rows.push([`🏫 ${b.name}${multiStudent() ? ' (' + SN(b.studentId) + ')' : ''}`, money(b.total), false, '', true]));
  const tot = [...B, ...K].reduce((a, b) => a + b.total, 0), paid = [...B, ...K].reduce((a, b) => a + b.paid, 0);
  rows.push(['Tổng học phí', money(tot), true]); rows.push(['Đã nộp', '−' + money(paid), false, '#16a34a']);
  const cv = drawCard('Báo cáo học phí ' + mLabel(S.month).toLowerCase(), S.data.students.map(s => s.name).join(', '), rows, ['Còn phải nộp', money(tot - paid), tot - paid > 0 ? '#dc2626' : '#16a34a']);
  shareCanvas(cv, 'BaoCaoHocPhi_' + S.month + '.png', `Học phí ${mLabel(S.month).toLowerCase()}: ${money(tot)}, còn ${money(tot - paid)}`);
}
/* Thêm nút "Gửi ảnh" vào thẻ học phí học thêm */
const _vFee = vFee;
vFee = async function () {
  await _vFee();
  if (S.tab !== 'fee' || !S.bill) return;
  const B = S.bill.bills.filter(b => (!S.filter.s || b.studentId === S.filter.s));
  document.querySelectorAll('[data-share]').forEach(x => { const i = +x.dataset.share; x.insertAdjacentHTML('afterend', `<button class="btn o s" data-img="${i}">🖼 Gửi ảnh phiếu</button>`); });
  document.querySelectorAll('[data-img]').forEach(x => x.onclick = () => { const b = B[+x.dataset.img]; shareCanvas(billImage(b), 'PhieuHocPhi_' + S.month + '.png', billText(b)); });
  const sa = $('#shAll'); if (sa) { sa.textContent = '📊 Gửi báo cáo tháng'; sa.onclick = monthReport; }
};

/* ---------- Thanh đầu: tìm kiếm ---------- */
function headerExtras() {
  if ($('#srch') || !$('#bell')) return;
  $('#bell').insertAdjacentHTML('beforebegin', '<button class="ib" id="srch">🔎</button>');
  $('#srch').onclick = () => { S.tk = Object.assign(S.tk || {}, { view: 'find' }); go('home'); setTimeout(() => { const q = $('#q'); if (q) q.focus(); }, 50); };
}

/* ---------- Vuốt chuyển tab, kéo xuống làm mới ---------- */
(function gestures() {
  let x0 = 0, y0 = 0, t0 = 0, pull = 0;
  document.addEventListener('touchstart', e => { if ($('#modal').innerHTML) return; const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; t0 = Date.now(); pull = scrollY === 0 ? 1 : 0; }, { passive: true });
  document.addEventListener('touchend', async e => {
    if ($('#modal').innerHTML || !S.data) return;
    const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
    if (Date.now() - t0 < 600 && Math.abs(dx) > 80 && Math.abs(dy) < 50 && !e.target.closest('.tabs,.qk,input,textarea,select,table')) {
      const L = myTabs().map(z => z[0]), cur = ['stat', 'school'].includes(S.tab) ? 'fee' : S.tab, i = L.indexOf(cur), j = i + (dx < 0 ? 1 : -1);
      if (j >= 0 && j < L.length) go(L[j]);
    } else if (pull && dy > 110 && Math.abs(dx) < 60) {
      const b = $('#rf'); if (b) b.textContent = '⏳'; S.bill = S.sum = null; await reload(); render();
    }
  }, { passive: true });
})();

/* ---------- Khởi động ---------- */
if (S.token && S.me) start(); else viewLogin();
