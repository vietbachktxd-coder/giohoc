/* GIỜ HỌC — Thiết lập dạng cây, danh mục chọn nhanh, nhập liệu tức thì (lưu nền) */
'use strict';

/* ---------- Lưu nền: cập nhật màn hình ngay, gửi máy chủ phía sau ---------- */
const Q = []; let qBusy = false, syncT = null;
const cid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-6);
function syncBadge() { const b = $('#rf'); if (b) b.textContent = Q.length || qBusy ? '⏳' : '⟳'; }
function upsert(t, item) {
  const L = S.data[t] || (S.data[t] = []), i = L.findIndex(x => x.id === item.id);
  if (i >= 0) L[i] = Object.assign({}, L[i], item); else L.push(item);
  if (t === 'students') { S.data.allStudents = S.data.allStudents || []; const j = S.data.allStudents.findIndex(x => x.id === item.id); if (j >= 0) S.data.allStudents[j] = Object.assign({}, S.data.allStudents[j], item); else S.data.allStudents.push(item); }
}
function drop(t, id) { S.data[t] = (S.data[t] || []).filter(x => x.id !== id); }
function mut(action, params, local) {
  if (local) local();
  Q.push({ action, params }); syncBadge(); runQ();
}
async function runQ() {
  if (qBusy) return; qBusy = true; syncBadge();
  while (Q.length) {
    const r = await api(Q[0].action, Q[0].params);
    if (!r.ok) { toast('Chưa lưu được: ' + r.error, 'er'); Q.length = 0; await reload(true); if (!$('#modal').innerHTML) render(); break; }
    Q.shift(); syncBadge();
  }
  qBusy = false; syncBadge(); S.bill = S.sum = null;
  clearTimeout(syncT);
  syncT = setTimeout(async () => { if (!Q.length && await reload(true) && !$('#modal').innerHTML) render(); }, 3000);
}
window.addEventListener('beforeunload', e => { if (Q.length || qBusy) { e.preventDefault(); e.returnValue = ''; } });

/* ---------- Số tiền có dấu chấm ---------- */
const fmtN = v => { const n = String(v == null ? '' : v).replace(/[^\d-]/g, ''); if (!n || n === '-') return n; const neg = n[0] === '-'; return (neg ? '-' : '') + n.replace(/-/g, '').replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
const parseN = v => Number(String(v || '').replace(/[^\d-]/g, '')) || 0;
document.addEventListener('input', e => {
  const t = e.target; if (!t.classList || !t.classList.contains('money')) return;
  const before = t.value.length, pos = t.selectionStart; t.value = fmtN(t.value);
  try { const p = Math.max(0, pos + t.value.length - before); t.setSelectionRange(p, p); } catch (x) { }
});
document.addEventListener('focusin', e => { if (e.target.classList && e.target.classList.contains('money')) e.target.value = fmtN(e.target.value); });

/* ---------- Chip chọn nhanh ---------- */
function chips(list, attr, sel) {
  return list.length ? `<div class="qk">${list.map(x => `<button type="button" ${attr}="${h(x.v)}" class="${sel && sel.includes(x.v) ? 'on' : ''}">${h(x.t || x.v)}</button>`).join('')}</div>` : '';
}

/* ---------- TAB THIẾT LẬP: cây khai báo ---------- */
function vSetup() {
  const D = S.data, n = x => (x || []).length;
  const tree = (ic, t, sub, id, extra) => `<div class="tn" data-go="${id}" ${extra || ''}><span class="tl"></span><span>${ic}</span><div class="f"><b>${t}</b>${sub ? `<div class="mu">${sub}</div>` : ''}</div>›</div>`;
  let html = '';
  D.students.forEach(s => {
    const tt = (D.timetable || []).filter(t => t.studentId === s.id), cs = activeCourses().filter(c => HT.list(c.studentIds).includes(s.id));
    const fees = (D.schoolfees || []).filter(f => f.studentId === s.id && isT(f.active));
    html += `<details class="card tree" open><summary><span style="font-size:22px">🧒</span><b class="f">${h(s.name)}</b><span class="mu">${h([s.grade, s.school].filter(Boolean).join(' · '))}</span><button class="btn s o" data-es="${s.id}">✎</button></summary>
      ${tree('🏫', 'Thời khóa biểu', tt.length || cs.length ? `${tt.length} tiết chính khóa · ${cs.reduce((a, c) => a + (c.schedule || []).length, 0)} buổi học thêm / tuần` : 'Chưa khai báo', 'tt:' + s.id)}
      ${tree('📚', 'Lớp học thêm & đơn giá', cs.map(c => h(c.name) + ' (' + modeText(c) + ')').join(' · ') || 'Chưa có lớp', 'co:' + s.id)}
      ${tree('💵', 'Học phí chính khóa', fees.map(f => h(f.name) + ' ' + money(f.amount)).join(' · ') || 'Chưa có khoản thu', 'fe:' + s.id)}
      ${tree('🍱', 'Thực đơn', n((D.menus || []).filter(m => !m.studentId || m.studentId === s.id)) + ' món trong tuần', 'me:' + s.id)}</details>`;
  });
  html += `<button class="btn o w" id="addSt" style="margin-bottom:12px">＋ Thêm học sinh</button>
    <details class="card tree" open><summary><span style="font-size:22px">📂</span><b class="f">Danh mục chọn nhanh</b></summary>
      ${tree('📘', 'Môn học', n(D.subjects) + ' môn', 'cat:subjects')}
      ${tree('👩‍🏫', 'Thầy cô', n(D.teachers) + ' người', 'cat:teachers')}
      ${tree('🍲', 'Món ăn', n(D.dishes) + ' món', 'cat:dishes')}</details>`;
  $('#v').innerHTML = html;
  document.querySelectorAll('[data-es]').forEach(b => b.onclick = e => { e.preventDefault(); studentForm(D.students.find(s => s.id === b.dataset.es)); });
  $('#addSt').onclick = () => studentForm({});
  document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
    const [k, id] = b.dataset.go.split(':');
    ({ tt: () => ttManager(id), co: () => courseList(id), fe: () => feeList(id), me: () => menuManager(), cat: () => catList(id) })[k]();
  });
}

/* ---------- Học sinh ---------- */
function studentForm(s) {
  modal(`${head(s.id ? 'Sửa học sinh' : 'Thêm học sinh')}<label>Họ tên</label><input id="name" value="${h(s.name || '')}">
    <div class="g2"><div><label>Lớp</label><input id="grade" value="${h(s.grade || '')}" placeholder="VD: 8A"></div><div><label>Trường</label><input id="school" value="${h(s.school || '')}"></div></div>
    <label>📍 Vị trí trường</label><div class="g2"><input id="schoolLat" placeholder="Vĩ độ" value="${h(s.schoolLat || '')}"><input id="schoolLng" placeholder="Kinh độ" value="${h(s.schoolLng || '')}"></div>
    <button class="btn o s" id="here" style="margin-top:6px">📍 Lấy vị trí hiện tại</button>
    <div style="height:14px"></div><div class="row">${s.id ? '<button class="btn er" id="del">Xóa</button>' : ''}<button class="btn p f" id="sv">Lưu</button></div>`, el => {
    el.querySelector('#here').onclick = async () => { const q = await getPos(); if (!q) return toast('Không lấy được vị trí', 'er'); el.querySelector('#schoolLat').value = q.lat.toFixed(6); el.querySelector('#schoolLng').value = q.lng.toFixed(6); };
    el.querySelector('#sv').onclick = () => {
      const x = { id: s.id || cid(), name: val(el, 'name'), grade: val(el, 'grade'), school: val(el, 'school'), schoolLat: val(el, 'schoolLat'), schoolLng: val(el, 'schoolLng'), note: s.note || '', color: s.color || '', active: '1' };
      if (!x.name) return toast('Nhập họ tên', 'er');
      mut('saveStudent', { student: x }, () => upsert('students', x)); closeModal(); render();
    };
    const d = el.querySelector('#del'); if (d) d.onclick = async () => {
      if (!(await confirmBox(`Xóa học sinh <b>${h(s.name)}</b>? (Nếu đã có buổi học / thanh toán thì chỉ ẩn để giữ lịch sử.)`, 'Xóa'))) return;
      mut('deleteStudent', { id: s.id }, () => { drop('students', s.id); }); render();
    };
  });
}
function studentList() { S.tab = 'setup'; render(); }

/* ---------- Danh mục chọn nhanh ---------- */
const CATS = {
  subjects: { title: '📘 Môn học', save: 'saveSubject', del: 'deleteSubject', f: [['name', 'Tên môn'], ['teacher', 'Giáo viên'], ['room', 'Phòng học']] },
  teachers: { title: '👩‍🏫 Thầy cô', save: 'saveCat', del: 'deleteCat', f: [['name', 'Họ tên'], ['subject', 'Dạy môn'], ['phone', 'Số điện thoại']] },
  dishes: { title: '🍲 Món ăn', save: 'saveCat', del: 'deleteCat', f: [['name', 'Tên món'], ['meal', 'Bữa']] }
};
const SUBJ_DEF = ['Toán', 'Ngữ văn', 'Tiếng Anh', 'Khoa học tự nhiên', 'Vật lý', 'Hóa học', 'Sinh học', 'Lịch sử và Địa lý', 'GDCD', 'Tin học', 'Công nghệ', 'Giáo dục thể chất', 'Nghệ thuật', 'Hoạt động trải nghiệm', 'Chào cờ', 'Sinh hoạt lớp'];
const DISH_DEF = { sang: ['Phở bò', 'Bún riêu', 'Xôi gà', 'Bánh mì trứng', 'Cháo thịt bằm', 'Bánh cuốn', 'Hủ tiếu', 'Sữa tươi'], trua: ['Cơm trắng', 'Cá kho', 'Thịt rang', 'Gà luộc', 'Đậu sốt cà', 'Trứng chiên', 'Canh chua', 'Canh rau ngót', 'Canh bí', 'Rau luộc'], xe: ['Sữa chua', 'Trái cây', 'Bánh flan', 'Chè đậu xanh'], toi: ['Cơm trắng', 'Sườn xào chua ngọt', 'Thịt kho trứng', 'Cá chiên', 'Bò xào', 'Canh cải', 'Canh mồng tơi', 'Rau xào'] };
function catList(t) {
  const C0 = CATS[t], L = (S.data[t] || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  const sub = x => t === 'dishes' ? HT.MEAL[x.meal] || '' : [x.teacher || x.subject, x.room || x.phone].filter(Boolean).join(' · ');
  const quick = t === 'subjects' ? SUBJ_DEF.filter(n => !L.some(x => x.name === n)).map(n => ({ v: n })) : t === 'dishes' ? [].concat(...Object.keys(DISH_DEF).map(m => DISH_DEF[m].filter(n => !L.some(x => x.name === n && x.meal === m)).map(n => ({ v: m + '|' + n, t: n })))) : [];
  modal(`${head(C0.title)}<input id="qf" placeholder="🔎 Tìm…" style="margin-bottom:6px">
    <div class="list-a" id="cl">${L.map(x => `<div data-i="${x.id}"><b class="f">${h(x.name)}</b><span class="mu">${h(sub(x))}</span>›</div>`).join('') || '<div class="empty">Chưa có</div>'}</div>
    ${quick.length ? `<label>⚡ Bấm để thêm nhanh</label>${chips(quick.slice(0, 30), 'data-q')}` : ''}
    <div style="height:10px"></div><button class="btn p w" id="nw">＋ Thêm mới</button>`, el => {
    el.querySelector('#qf').oninput = e => { const k = e.target.value.toLowerCase(); el.querySelectorAll('#cl [data-i]').forEach(d => d.style.display = d.textContent.toLowerCase().includes(k) ? '' : 'none'); };
    el.querySelectorAll('[data-i]').forEach(d => d.onclick = () => catForm(t, L.find(x => x.id === d.dataset.i)));
    el.querySelector('#nw').onclick = () => catForm(t, {});
    el.querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
      const [a, nm] = b.dataset.q.includes('|') ? b.dataset.q.split('|') : ['', b.dataset.q];
      const x = t === 'dishes' ? { id: cid(), name: nm, meal: a } : { id: cid(), name: nm, teacher: '', room: '', color: COLORS[(S.data.subjects || []).length % COLORS.length], note: '' };
      mut(C0.save, t === 'subjects' ? { item: x } : { table: t, item: x }, () => upsert(t, x)); b.remove();
      const cl = el.querySelector('#cl'); if (cl.querySelector('.empty')) cl.innerHTML = '';
      cl.insertAdjacentHTML('beforeend', `<div><b class="f">${h(nm)}</b><span class="mu">${t === 'dishes' ? HT.MEAL[a] : ''}</span>✔</div>`);
    });
  });
}
function catForm(t, x) {
  const C0 = CATS[t];
  modal(`${head((x.id ? 'Sửa · ' : 'Thêm · ') + C0.title)}${C0.f.map(([k, lb]) => k === 'meal'
    ? `<label>${lb}</label><select id="${k}">${Object.keys(HT.MEAL).map(m => `<option value="${m}" ${x.meal === m ? 'selected' : ''}>${HT.MEAL[m]}</option>`).join('')}</select>`
    : `<label>${lb}</label><input id="${k}" value="${h(x[k] || '')}" ${k === 'phone' ? 'inputmode="tel"' : ''} ${k === 'teacher' ? 'list="tL"' : ''}>`).join('')}
    <datalist id="tL">${(S.data.teachers || []).map(z => `<option value="${h(z.name)}">`).join('')}</datalist>
    <div style="height:12px"></div><div class="row">${x.id ? '<button class="btn er" id="del">Xóa</button>' : ''}<button class="btn p f" id="sv">Lưu</button></div>`, el => {
    el.querySelector('#sv').onclick = () => {
      const o = Object.assign({}, x, { id: x.id || cid() }); C0.f.forEach(([k]) => o[k] = val(el, k));
      if (!o.name) return toast('Nhập tên', 'er');
      mut(C0.save, t === 'subjects' ? { item: o } : { table: t, item: o }, () => upsert(t, o)); catList(t);
    };
    const d = el.querySelector('#del'); if (d) d.onclick = () => { mut(C0.del, { table: t, id: x.id }, () => drop(t, x.id)); catList(t); };
  });
}
function subjectList() { catList('subjects'); }

/* ---------- Thời khóa biểu: chính khóa + học thêm ---------- */
function ttManager(sid, d, pick) {
  const st = S.data.students; sid = sid || (st[0] || {}).id; d = d || HT.dow(today());
  const items = dayItems(sid, d), sel = new Set();
  const allCk = (S.data.timetable || []).filter(t => t.studentId === sid), dayCk = allCk.filter(t => +t.d === d);
  modal(`${head('🗓 Thời khóa biểu' + (st.length > 1 ? ' · ' + h(SN(sid)) : ''))}${dayChips(d, 'data-dd')}
    <div class="list-a">${items.map((x, i) => `<div data-k="${i}">${pick ? `<input type="checkbox" class="pk" data-i="${i}">` : ''}<span class="bar" style="background:${x.color};height:34px"></span><b style="width:92px">${x.start}–${x.end}</b><div class="f"><b>${h(x.title)}</b> <span class="chip" style="background:${x.kind === 'ck' ? '#e2e8f0' : '#ccfbf1'}">${x.kind === 'ck' ? 'Chính khóa' : 'Học thêm'}</span><div class="mu">${h([x.who, x.where].filter(Boolean).join(' · '))}</div></div>${pick ? '' : `<button class="btn s o" data-rm="${i}" title="Xóa">🗑</button>`}</div>`).join('') || `<div class="empty">${WD[d]} chưa có lịch</div>`}</div>
    <div style="height:10px"></div>
    ${pick ? `<div class="row"><button class="btn o f" id="cancel">Hủy</button><button class="btn er f" id="delSel">🗑 Xóa mục đã chọn</button></div>`
    : `<div class="row"><button class="btn p f" id="nw">＋ Tiết chính khóa</button><button class="btn o f" id="nc">＋ Buổi học thêm</button></div>
    ${d < 6 ? `<button class="btn o s w" id="cp" style="margin-top:8px">⧉ Chép lịch ${WD[d]} sang ngày khác…</button>` : ''}
    <details style="margin-top:10px"><summary class="mu sm" style="cursor:pointer">🗑 Xóa để thay đổi thời khóa biểu…</summary>
      <div class="row wrap gap" style="margin-top:8px">${items.length ? '<button class="btn o s f" id="pick">☑ Chọn nhiều mục để xóa</button>' : ''}
      ${dayCk.length ? `<button class="btn o s f" id="delDay">Xóa chính khóa ${WD[d]} (${dayCk.length})</button>` : ''}
      ${allCk.length ? `<button class="btn er s w" id="delAll">Xóa toàn bộ TKB chính khóa (${allCk.length} tiết)</button>` : ''}</div>
      <p class="mu sm">Lịch học thêm xóa từng buổi bằng 🗑, hoặc sửa trong Lớp học thêm. Buổi đã điểm danh và học phí không bị ảnh hưởng.</p></details>`}`, el => {
    el.querySelectorAll('[data-dd]').forEach(b => b.onclick = () => ttManager(sid, +b.dataset.dd, pick));
    el.querySelectorAll('[data-k]').forEach(b => b.onclick = e => {
      if (e.target.closest('[data-rm]')) return;
      if (pick) { const c = b.querySelector('.pk'); if (e.target !== c) c.checked = !c.checked; c.checked ? sel.add(+c.dataset.i) : sel.delete(+c.dataset.i); return; }
      const x = items[+b.dataset.k]; x.kind === 'ck' ? ttForm(x.t) : courseForm(x.c);
    });
    el.querySelectorAll('[data-rm]').forEach(b => b.onclick = async () => { const x = items[+b.dataset.rm]; if (!(await confirmBox(`Xóa <b>${h(x.title)}</b> ${x.start}–${x.end} ${WD[d]}?`, 'Xóa'))) return ttManager(sid, d); delItems([x], d); ttManager(sid, d); });
    const q = id => el.querySelector('#' + id), on = (id, f) => { const b = q(id); if (b) b.onclick = f; };
    on('pick', () => ttManager(sid, d, true)); on('cancel', () => ttManager(sid, d));
    on('delSel', async () => { if (!sel.size) return toast('Chưa chọn mục nào', 'er'); const L = [...sel].map(i => items[i]); if (!(await confirmBox(`Xóa ${L.length} mục đã chọn?`, 'Xóa'))) return ttManager(sid, d, true); delItems(L, d); toast('Đã xóa ' + L.length + ' mục', 'ok'); ttManager(sid, d); });
    on('delDay', async () => { if (!(await confirmBox(`Xóa ${dayCk.length} tiết chính khóa ${WD[d]}?`, 'Xóa'))) return ttManager(sid, d); delCk(dayCk); ttManager(sid, d); });
    on('delAll', async () => { if (!(await confirmBox(`Xóa <b>toàn bộ ${allCk.length} tiết</b> chính khóa của ${h(SN(sid))} để nhập thời khóa biểu mới?<br><span class="mu">Lịch học thêm, điểm danh và học phí giữ nguyên.</span>`, 'Xóa hết'))) return ttManager(sid, d); delCk(allCk); toast('Đã xóa thời khóa biểu chính khóa', 'ok'); ttManager(sid, d); });
    on('nw', () => { const ck = items.filter(x => x.kind === 'ck'), last = ck[ck.length - 1], a = last ? HT.min(last.end) + 5 : 420; ttForm({ studentId: sid, d, start: HT.hhmm(a), end: HT.hhmm(a + 45) }); });
    on('nc', () => courseList(sid));
    on('cp', () => {
      const src = dayCk;
      if (!src.length) return toast('Chưa có tiết chính khóa để chép', 'er');
      modal(`${head('Chép lịch ' + WD[d])}<p class="mu">Chọn các ngày nhận ${src.length} tiết (ghi đè lịch chính khóa ngày đó):</p>${chips([1, 2, 3, 4, 5, 6, 7].filter(x => x !== d).map(x => ({ v: String(x), t: WD[x] })), 'data-to')}
        <div style="height:12px"></div><button class="btn p w" id="go">Chép</button>`, e2 => {
        const s2 = new Set(); e2.querySelectorAll('[data-to]').forEach(b => b.onclick = () => { b.classList.toggle('on'); s2.has(b.dataset.to) ? s2.delete(b.dataset.to) : s2.add(b.dataset.to); });
        e2.querySelector('#go').onclick = () => {
          s2.forEach(dd => {
            delCk((S.data.timetable || []).filter(t => t.studentId === sid && +t.d === +dd));
            src.forEach(t => { const x = Object.assign({}, t, { id: cid(), d: +dd }); mut('saveTT', { item: x }, () => upsert('timetable', x)); });
          });
          toast('Đã chép lịch', 'ok'); ttManager(sid, d);
        };
      });
    });
  });
}
/* Xóa tiết chính khóa (1 lần gọi máy chủ) */
function delCk(list) { list.forEach(t => mut('deleteTT', { id: t.id }, () => drop('timetable', t.id))); }
/* Xóa mục trong danh sách ngày: chính khóa xóa tiết, học thêm bỏ buổi khỏi lịch của lớp */
function delItems(L, d) {
  delCk(L.filter(x => x.kind === 'ck').map(x => x.t));
  const byC = {}; L.filter(x => x.kind === 'ht').forEach(x => (byC[x.c.id] = byC[x.c.id] || []).push(x.start));
  Object.keys(byC).forEach(id => {
    const c = S.data.courses.find(z => z.id === id); if (!c) return;
    const x = Object.assign({}, c, { schedule: (c.schedule || []).filter(z => !(+z.d === d && byC[id].includes(z.t))), studentIds: HT.list(c.studentIds) });
    mut('saveCourse', { course: x }, () => upsert('courses', Object.assign({}, x, { studentIds: x.studentIds.join(',') })));
  });
}
function ttForm(t) {
  const subj = (S.data.subjects || []).map(m => ({ v: m.name }));
  modal(`${head(t.id ? 'Sửa tiết học' : 'Thêm tiết chính khóa')}
    <div class="g2"><div><label>Thứ</label><select id="d">${[1, 2, 3, 4, 5, 6, 7].map(d => `<option value="${d}" ${+t.d === d ? 'selected' : ''}>${WD[d]}</option>`).join('')}</select></div>
    <div><label>Giờ học</label><div class="row" style="gap:4px"><input id="start" type="time" value="${t.start}"><input id="end" type="time" value="${t.end}"></div></div></div>
    <label>Môn học</label><input id="subject" list="sjL" value="${h(t.subject || '')}"><datalist id="sjL">${subj.map(x => `<option value="${h(x.v)}">`).join('')}</datalist>
    ${chips(subj.slice(0, 16), 'data-sj', [t.subject])}
    <div class="g2"><div><label>Giáo viên</label><input id="teacher" list="tL2" value="${h(t.teacher || '')}"><datalist id="tL2">${(S.data.teachers || []).map(z => `<option value="${h(z.name)}">`).join('')}</datalist></div><div><label>Phòng</label><input id="room" value="${h(t.room || '')}"></div></div>
    <div style="height:12px"></div><div class="row">${t.id ? '<button class="btn er" id="del">Xóa</button>' : ''}<button class="btn o" id="sn" ${t.id ? 'style="display:none"' : ''}>Lưu & thêm tiếp</button><button class="btn p f" id="sv">Lưu</button></div>`, el => {
    const fill = n => { const m = (S.data.subjects || []).find(z => z.name === n); el.querySelector('#subject').value = n; if (m) { el.querySelector('#teacher').value = m.teacher || el.querySelector('#teacher').value; el.querySelector('#room').value = m.room || el.querySelector('#room').value; } el.querySelectorAll('[data-sj]').forEach(b => b.classList.toggle('on', b.dataset.sj === n)); };
    el.querySelectorAll('[data-sj]').forEach(b => b.onclick = () => fill(b.dataset.sj));
    el.querySelector('#subject').onchange = e => fill(e.target.value);
    const save = next => {
      const x = { id: t.id || cid(), studentId: t.studentId, d: +val(el, 'd'), start: val(el, 'start'), end: val(el, 'end'), subject: val(el, 'subject'), teacher: val(el, 'teacher'), room: val(el, 'room'), note: t.note || '' };
      if (!x.subject) return toast('Chọn môn học', 'er');
      if (HT.min(x.end) <= HT.min(x.start)) return toast('Giờ kết thúc phải sau giờ bắt đầu', 'er');
      mut('saveTT', { item: x }, () => upsert('timetable', x));
      if (next) { const a = HT.min(x.end) + 5; ttForm({ studentId: x.studentId, d: x.d, start: HT.hhmm(a), end: HT.hhmm(a + (HT.min(x.end) - HT.min(x.start))), room: x.room }); toast('Đã lưu ' + x.subject, 'ok'); }
      else ttManager(x.studentId, x.d);
    };
    el.querySelector('#sv').onclick = () => save(false); el.querySelector('#sn').onclick = () => save(true);
    const d = el.querySelector('#del'); if (d) d.onclick = () => { mut('deleteTT', { id: t.id }, () => drop('timetable', t.id)); ttManager(t.studentId, +t.d); };
  });
}

/* ---------- Thực đơn: chọn món trong danh mục ---------- */
function menuManager(d) {
  d = d || HT.dow(today());
  const L = (S.data.menus || []).filter(m => +m.d === d);
  modal(`${head('🍱 Thực đơn')}${dayChips(d, 'data-dd')}<div class="list-a">${Object.keys(HT.MEAL).map(k => { const m = L.filter(z => z.meal === k);
    return `<div data-ml="${k}"><b style="width:84px">${HT.MEAL[k]}</b><span class="f ${m.length ? '' : 'mu'}">${m.length ? m.map(z => h(z.dishes)).join('; ') : 'Bấm để chọn món'}</span>›</div>`; }).join('')}</div>
    <p class="mu sm">Bấm vào từng bữa để chọn món nhanh từ danh mục. Món mới tự lưu vào danh mục.</p>`, el => {
    el.querySelectorAll('[data-dd]').forEach(b => b.onclick = () => menuManager(+b.dataset.dd));
    el.querySelectorAll('[data-ml]').forEach(b => b.onclick = () => { const k = b.dataset.ml; menuForm(L.find(z => z.meal === k) || { d, meal: k, studentId: '' }); });
  });
}
function menuForm(m) {
  const sel = (m.dishes || '').split(/\s*[,;]\s*/).filter(Boolean);
  const cat = (S.data.dishes || []).filter(x => x.meal === m.meal).concat((S.data.dishes || []).filter(x => x.meal !== m.meal));
  modal(`${head('🍱 ' + HT.MEAL[m.meal] + ' · ' + WD[m.d])}
    <label>Đã chọn</label><div id="pk" class="qk"></div>
    <label>Chọn nhanh từ danh mục</label>${chips(cat.map(x => ({ v: x.name })), 'data-ds', sel) || '<div class="mu sm">Danh mục món ăn trống — gõ món bên dưới, món mới tự lưu vào danh mục.</div>'}
    <div class="row" style="margin-top:8px"><input id="nm" placeholder="Món khác…" class="f"><button class="btn o" id="add">＋</button></div>
    <div style="height:12px"></div><div class="row">${m.id ? '<button class="btn er" id="del">Xóa</button>' : ''}<button class="btn p f" id="sv">Lưu</button></div>`, el => {
    const draw = () => { el.querySelector('#pk').innerHTML = sel.length ? sel.map((x, i) => `<button type="button" class="on" data-rm="${i}">${h(x)} ✕</button>`).join('') : '<span class="mu sm">Chưa chọn món</span>';
      el.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { const x = sel.splice(+b.dataset.rm, 1)[0]; el.querySelectorAll('[data-ds]').forEach(c => { if (c.dataset.ds === x) c.classList.remove('on'); }); draw(); }); };
    draw();
    el.querySelectorAll('[data-ds]').forEach(b => b.onclick = () => { const i = sel.indexOf(b.dataset.ds); if (i >= 0) sel.splice(i, 1); else sel.push(b.dataset.ds); b.classList.toggle('on', i < 0); draw(); });
    const add = () => { const v = val(el, 'nm'); if (!v) return; v.split(/\s*[,;]\s*/).forEach(x => x && !sel.includes(x) && sel.push(x)); el.querySelector('#nm').value = ''; draw(); };
    el.querySelector('#add').onclick = add; el.querySelector('#nm').onkeydown = e => { if (e.key === 'Enter') add(); };
    el.querySelector('#sv').onclick = () => {
      add();
      if (!sel.length) { if (m.id) mut('deleteMenu', { id: m.id }, () => drop('menus', m.id)); return menuManager(m.d); }
      const x = Object.assign({}, m, { id: m.id || cid(), dishes: sel.join(', ') });
      mut('saveMenu', { item: x }, () => upsert('menus', x));
      sel.filter(n => !(S.data.dishes || []).some(z => z.name === n)).forEach(n => { const z = { id: cid(), name: n, meal: m.meal }; mut('saveCat', { table: 'dishes', item: z }, () => upsert('dishes', z)); });
      menuManager(m.d);
    };
    const d = el.querySelector('#del'); if (d) d.onclick = () => { mut('deleteMenu', { id: m.id }, () => drop('menus', m.id)); menuManager(m.d); };
  });
}

/* ---------- Học phí chính khóa ---------- */
function feeList(sid) {
  const L = (S.data.schoolfees || []).filter(f => isT(f.active) && (!sid || f.studentId === sid));
  modal(`${head('💵 Học phí chính khóa' + (sid && multiStudent() ? ' · ' + h(SN(sid)) : ''))}
    <div class="list-a">${L.map(f => `<div data-f="${f.id}"><div class="f"><b>${h(f.name)}</b><div class="mu">${CYCLE[f.cycle]} · từ ${f.from.slice(5)}/${f.from.slice(0, 4)}${f.to ? ' đến ' + f.to.slice(5) + '/' + f.to.slice(0, 4) : ''}</div></div><b>${money(f.amount)}</b>›</div>`).join('') || '<div class="empty">Chưa có khoản thu</div>'}</div>
    <label>⚡ Thêm nhanh</label>${chips(['Học phí', 'Tiền bán trú', 'Tiền ăn', 'BHYT', 'Đồng phục', 'Sách giáo khoa', 'Quỹ phụ huynh'].filter(n => !L.some(f => f.name === n)).map(n => ({ v: n })), 'data-q')}
    <div style="height:10px"></div><button class="btn p w" id="nw">＋ Khoản thu khác</button>`, el => {
    el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => feeForm(L.find(f => f.id === b.dataset.f)));
    el.querySelector('#nw').onclick = () => feeForm({ studentId: sid });
    el.querySelectorAll('[data-q]').forEach(b => b.onclick = () => feeForm({ studentId: sid, name: b.dataset.q, cycle: b.dataset.q === 'BHYT' || b.dataset.q.startsWith('Sách') || b.dataset.q === 'Đồng phục' ? 'nam' : 'thang' }));
  });
}
function feeForm(f) {
  const st = S.data.students;
  modal(`${head(f.id ? 'Sửa khoản thu' : 'Thêm khoản thu')}
    ${st.length > 1 ? `<label>Học sinh</label><select id="sid">${st.map(s => `<option value="${s.id}" ${s.id === f.studentId ? 'selected' : ''}>${h(s.name)}</option>`).join('')}</select>` : `<input type="hidden" id="sid" value="${f.studentId || (st[0] || {}).id}">`}
    <label>Tên khoản thu</label><input id="name" value="${h(f.name || '')}">
    <div class="g2"><div><label>Số tiền (đ)</label><input id="amount" class="money" inputmode="numeric" value="${fmtN(f.amount || '')}"></div><div><label>Chu kỳ</label><select id="cycle">${Object.keys(CYCLE).map(k => `<option value="${k}" ${f.cycle === k ? 'selected' : ''}>${CYCLE[k]}</option>`).join('')}</select></div></div>
    <div class="g2"><div><label>Từ tháng</label><input id="from" type="month" value="${f.from || S.month}"></div><div><label>Đến tháng</label><input id="to" type="month" value="${f.to || ''}"></div></div>
    <div style="height:12px"></div><div class="row">${f.id ? '<button class="btn er" id="del">Xóa</button>' : ''}<button class="btn p f" id="sv">Lưu</button></div>`, el => {
    el.querySelector('#sv').onclick = () => {
      const x = { id: f.id || cid(), studentId: val(el, 'sid'), name: val(el, 'name'), amount: parseN(val(el, 'amount')), cycle: val(el, 'cycle'), from: val(el, 'from'), to: val(el, 'to'), note: f.note || '', active: '1' };
      if (!x.name || !x.amount) return toast('Nhập tên và số tiền', 'er');
      mut('saveFee', { item: x }, () => upsert('schoolfees', x)); feeList(x.studentId);
    };
    const d = el.querySelector('#del'); if (d) d.onclick = () => { mut('deleteFee', { id: f.id }, () => drop('schoolfees', f.id)); feeList(f.studentId); };
  });
}

/* Khởi động */
if (S.token && S.me) start(); else viewLogin();
