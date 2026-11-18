/* TỰ SINH từ core.js + gas.js — sửa 2 file đó rồi chạy: node tools/build-gas.js */
/* ==========================================================================
 * GIỜ HỌC — LÕI XỬ LÝ DÙNG CHUNG
 * Chạy được ở 2 nơi:
 *   - Máy chủ Google Apps Script (lưu Google Sheets)  -> backend/gas.js
 *   - Trình duyệt, chế độ dùng thử (lưu trong máy)     -> web/demo.js
 * env = { db:{all,insert,update,remove}, now:()=>({date,time,iso,ms}), hash:(s)=>hex, uid:()=>string }
 * ========================================================================== */
var HT = (function () {
  var VERSION = '1.2.0';

  var SCHEMA = {
    users: ['id', 'username', 'name', 'role', 'pass', 'studentId', 'courseIds', 'phone', 'active', 'mustChange', 'createdAt'],
    students: ['id', 'name', 'grade', 'note', 'color', 'active', 'school', 'schoolLat', 'schoolLng'],
    timetable: ['id', 'studentId', 'd', 'start', 'end', 'subject', 'teacher', 'room', 'note'],
    menus: ['id', 'studentId', 'd', 'meal', 'dishes', 'note'],
    subjects: ['id', 'name', 'teacher', 'room', 'color', 'note'],
    courses: ['id', 'name', 'subject', 'teacher', 'teacherPhone', 'place', 'mode', 'rate', 'monthlyFee', 'roundMin', 'minMin',
      'defaultMin', 'schedule', 'studentIds', 'chargeExcused', 'chargeUnexcused', 'lat', 'lng', 'radius', 'requireGps', 'color', 'active', 'note'],
    sessions: ['id', 'courseId', 'studentId', 'date', 'start', 'end', 'minutes', 'status', 'mode', 'rate', 'note',
      'inBy', 'outBy', 'inLat', 'inLng', 'inDist', 'confirmed', 'confirmedBy', 'confirmedAt', 'createdAt', 'updatedAt'],
    payments: ['id', 'courseId', 'studentId', 'month', 'type', 'amount', 'date', 'method', 'note', 'by', 'createdAt'],
    notifs: ['id', 'to', 'title', 'body', 'at'],
    tokens: ['token', 'userId', 'createdAt', 'device'],
    config: ['key', 'value']
  };

  var STATUS = {
    co_mat: 'Có mặt', hoc_bu: 'Học bù', vang_phep: 'Vắng có phép', vang_kp: 'Vắng không phép', gv_nghi: 'GV nghỉ'
  };
  var ROLE = { ph: 'Phụ huynh', gv: 'Giáo viên', hs: 'Học sinh' };
  var MEAL = { sang: 'Bữa sáng', trua: 'Bữa trưa', xe: 'Bữa xế', toi: 'Bữa tối' };

  /* ---------------- tiện ích ---------------- */
  function isT(v) { return v === true || v === 1 || v === '1' || String(v).toUpperCase() === 'TRUE'; }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function str(v) { return v == null ? '' : String(v).trim(); }
  function list(v) { return str(v) ? str(v).split(',').map(function (x) { return x.trim(); }).filter(String) : []; }
  function min(hhmm) { var p = str(hhmm).split(':'); return p.length < 2 ? 0 : num(p[0]) * 60 + num(p[1]); }
  function hhmm(m) { m = Math.max(0, Math.round(m)); return pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function json(v, d) { try { return typeof v === 'string' && v ? JSON.parse(v) : (v || d); } catch (e) { return d; } }
  function err(m, code) { return { ok: false, error: m, code: code || '' }; }
  function dist(a, b, c, d) {
    var R = 6371000, r = Math.PI / 180, x = (c - a) * r, y = (d - b) * r;
    var h = Math.sin(x / 2) * Math.sin(x / 2) + Math.cos(a * r) * Math.cos(c * r) * Math.sin(y / 2) * Math.sin(y / 2);
    return Math.round(2 * R * Math.asin(Math.sqrt(h)));
  }
  function dow(date) { var p = date.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2]).getDay(); return d === 0 ? 7 : d; } // 1=T2..7=CN
  function money(n) { return Math.round(num(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' đ'; }

  /* ---------------- tính tiền 1 buổi ---------------- */
  function billable(s, c) {
    var st = s.status;
    if (st === 'co_mat' || st === 'hoc_bu') return true;
    if (st === 'vang_phep') return isT(c.chargeExcused);
    if (st === 'vang_kp') return isT(c.chargeUnexcused);
    return false;
  }
  function billMinutes(s, c) {
    var m = num(s.minutes);
    if (s.status === 'vang_phep' || s.status === 'vang_kp' || (!s.end && !m)) m = num(c.defaultMin) || 90;
    var r = num(c.roundMin);
    if (r > 0) m = Math.round(m / r) * r;
    return Math.max(m, num(c.minMin));
  }
  function sessionFee(s, c) {
    if (!billable(s, c)) return 0;
    var mode = s.mode || c.mode, rate = s.rate !== '' && s.rate != null ? num(s.rate) : num(c.rate);
    if (mode === 'gio') return Math.round(billMinutes(s, c) / 60 * rate);
    if (mode === 'buoi') return rate;
    return 0; // theo tháng: tính 1 lần ở bảng tháng
  }

  /* ---------------- bảng học phí 1 tháng (1 lớp × 1 học sinh) ---------------- */
  function monthBill(c, studentId, month, sessions, payments) {
    var ss = sessions.filter(function (s) { return s.courseId === c.id && s.studentId === studentId && s.date.slice(0, 7) === month; })
      .sort(function (a, b) { return (a.date + a.start) < (b.date + b.start) ? -1 : 1; });
    var o = { courseId: c.id, studentId: studentId, month: month, mode: c.mode, count: {}, sessions: 0, attended: 0, minutes: 0,
      billMin: 0, billCount: 0, fee: 0, adjust: 0, paid: 0, total: 0, due: 0, items: [], pays: [], unconfirmed: 0, open: 0 };
    Object.keys(STATUS).forEach(function (k) { o.count[k] = 0; });
    ss.forEach(function (s) {
      o.count[s.status] = (o.count[s.status] || 0) + 1; o.sessions++;
      if (s.status === 'co_mat' || s.status === 'hoc_bu') { o.attended++; o.minutes += num(s.minutes); }
      if (s.start && !s.end && (s.status === 'co_mat' || s.status === 'hoc_bu')) o.open++;
      if (!isT(s.confirmed)) o.unconfirmed++;
      var b = billable(s, c), f = sessionFee(s, c), bm = b ? billMinutes(s, c) : 0;
      if (b) { o.billCount++; o.billMin += bm; }
      o.fee += f;
      o.items.push({ id: s.id, date: s.date, start: s.start, end: s.end, minutes: num(s.minutes), status: s.status, billMin: bm, fee: f,
        rate: s.rate, confirmed: isT(s.confirmed), note: s.note });
    });
    if (c.mode === 'thang') o.fee = num(c.monthlyFee);
    payments.forEach(function (p) {
      if (p.courseId !== c.id || p.month !== month || (p.studentId && p.studentId !== studentId)) return;
      if (p.type === 'dc') o.adjust += num(p.amount); else o.paid += num(p.amount);
      o.pays.push(p);
    });
    o.total = o.fee + o.adjust; o.due = o.total - o.paid;
    return o;
  }

  /* ---------------- quyền ---------------- */
  function canCourse(me, c) {
    if (me.role === 'ph') return true;
    if (me.role === 'gv') return list(me.courseIds).indexOf(c.id) >= 0;
    if (me.role === 'hs') return list(c.studentIds).indexOf(me.studentId) >= 0;
    return false;
  }
  function canStudent(me, sid) { return me.role !== 'hs' || me.studentId === sid; }

  /* ---------------- máy xử lý ---------------- */
  function create(env) {
    var db = env.db, T = {};
    function all(t) { return T[t] || (T[t] = db.all(t)); }
    function find(t, id) { var a = all(t); for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i]; return null; }
    function ins(t, o) { o.id = o.id || env.uid(); db.insert(t, o); if (T[t]) T[t].push(o); return o; }
    function upd(t, o, patch) { for (var k in patch) o[k] = patch[k]; db.update(t, o.id, patch); return o; }
    function del(t, o) { db.remove(t, o.id); if (T[t]) T[t] = T[t].filter(function (x) { return x !== o; }); }
    function cfg(k, d) { var r = all('config').filter(function (x) { return x.key === k; })[0]; return r ? r.value : d; }
    function setCfg(k, v) {
      var r = all('config').filter(function (x) { return x.key === k; })[0];
      if (r) { r.value = v; db.update('config', k, { value: v }, 'key'); } else { db.insert('config', { key: k, value: v }); all('config').push({ key: k, value: v }); }
    }
    function hash(p) { return env.hash('gh$' + p); }
    function pubUser(u) { return { id: u.id, username: u.username, name: u.name, role: u.role, studentId: u.studentId, courseIds: u.courseIds, phone: u.phone, active: isT(u.active), mustChange: isT(u.mustChange) }; }
    function notify(to, title, body) { ins('notifs', { to: to, title: title, body: body, at: env.now().iso }); }
    function notifyRole(role, title, body, except) {
      all('users').forEach(function (u) { if (u.role === role && isT(u.active) && u.id !== except) notify(u.id, title, body); });
    }
    function teachersOf(cid) { return all('users').filter(function (u) { return u.role === 'gv' && isT(u.active) && list(u.courseIds).indexOf(cid) >= 0; }); }
    function sName(id) { var s = find('students', id); return s ? s.name : '?'; }

    function auth(p) {
      var t = str(p.token); if (!t) return null;
      var tk = all('tokens').filter(function (x) { return x.token === t; })[0]; if (!tk) return null;
      var u = find('users', tk.userId); return u && isT(u.active) ? u : null;
    }

    var A = {};

    A.ping = function () { return { ok: true, backend: VERSION, name: cfg('appName', 'Giờ học'), time: env.now().iso }; };

    A.login = function (p) {
      var un = str(p.username).toLowerCase();
      var u = all('users').filter(function (x) { return str(x.username).toLowerCase() === un; })[0];
      if (!u || u.pass !== hash(str(p.password))) return err('Sai tên đăng nhập hoặc mật khẩu');
      if (!isT(u.active)) return err('Tài khoản chưa được duyệt hoặc đã bị khóa. Liên hệ phụ huynh (quản trị).');
      var tok = env.uid() + env.uid();
      db.insert('tokens', { token: tok, userId: u.id, createdAt: env.now().iso, device: str(p.device).slice(0, 80) });
      return { ok: true, token: tok, me: pubUser(u) };
    };

    function secured(fn, roles) {
      return function (p) {
        var me = auth(p); if (!me) return err('Phiên đăng nhập hết hạn, vui lòng đăng nhập lại', 'AUTH');
        if (roles && roles.indexOf(me.role) < 0) return err('Bạn không có quyền thực hiện thao tác này');
        return fn(p, me);
      };
    }

    A.logout = secured(function (p) {
      var tk = all('tokens').filter(function (x) { return x.token === p.token; })[0];
      if (tk) { db.remove('tokens', tk.token, 'token'); }
      return { ok: true };
    });

    A.changePass = secured(function (p, me) {
      if (me.pass !== hash(str(p.old))) return err('Mật khẩu cũ không đúng');
      if (str(p.pass).length < 6) return err('Mật khẩu mới tối thiểu 6 ký tự');
      upd('users', me, { pass: hash(str(p.pass)), mustChange: '0' });
      return { ok: true };
    });

    /* Dữ liệu cho màn hình: danh mục + buổi học trong khoảng [from,to] + buổi đang mở */
    A.load = secured(function (p, me) {
      var courses = all('courses').filter(function (c) { return canCourse(me, c); });
      var cids = courses.map(function (c) { return c.id; });
      var studs = all('students').filter(function (s) { return canStudent(me, s.id); });
      var from = str(p.from) || env.now().date.slice(0, 7) + '-01', to = str(p.to) || env.now().date.slice(0, 7) + '-31';
      var sessions = all('sessions').filter(function (s) {
        return cids.indexOf(s.courseId) >= 0 && canStudent(me, s.studentId) && ((s.date >= from && s.date <= to) || (s.start && !s.end && (s.status === 'co_mat' || s.status === 'hoc_bu')));
      });
      var months = {}; sessions.forEach(function (s) { months[s.date.slice(0, 7)] = 1; });
      var payments = all('payments').filter(function (x) { return cids.indexOf(x.courseId) >= 0 && (!x.studentId || canStudent(me, x.studentId)) && x.month >= from.slice(0, 7) && x.month <= to.slice(0, 7); });
      var since = str(p.since);
      var nf = all('notifs').filter(function (n) { return n.to === me.id; }).sort(function (a, b) { return a.at < b.at ? 1 : -1; }).slice(0, 30);
      return {
        ok: true, me: pubUser(me), now: env.now(), appName: cfg('appName', 'Giờ học'),
        students: studs, courses: courses.map(function (c) { var o = {}; for (var k in c) o[k] = c[k]; o.schedule = json(c.schedule, []); return o; }),
        sessions: sessions, payments: payments, notifs: nf, unread: nf.filter(function (n) { return !since || n.at > since; }).length,
        users: me.role === 'ph' ? all('users').map(pubUser) : [],
        timetable: me.role === 'gv' ? [] : all('timetable').filter(function (t) { return canStudent(me, t.studentId); }),
        subjects: all('subjects'),
        menus: me.role === 'gv' ? [] : all('menus').filter(function (m) { return !m.studentId || canStudent(me, m.studentId); })
      };
    });

    A.notifs = secured(function (p, me) {
      var since = str(p.since);
      var l = all('notifs').filter(function (n) { return n.to === me.id && (!since || n.at > since); }).sort(function (a, b) { return a.at < b.at ? 1 : -1; }).slice(0, 20);
      return { ok: true, list: l, now: env.now().iso };
    });

    /* ---- ĐIỂM DANH: bắt đầu buổi ---- */
    A.checkin = secured(function (p, me) {
      var c = find('courses', p.courseId); if (!c || !isT(c.active)) return err('Không tìm thấy lớp học');
      var sid = me.role === 'hs' ? me.studentId : str(p.studentId);
      if (!canCourse(me, c) || !canStudent(me, sid)) return err('Bạn không có quyền điểm danh lớp này');
      if (list(c.studentIds).indexOf(sid) < 0) return err('Học sinh không thuộc lớp này');
      var open = all('sessions').filter(function (s) { return s.studentId === sid && s.start && !s.end && (s.status === 'co_mat' || s.status === 'hoc_bu'); })[0];
      if (open) { var oc = find('courses', open.courseId); return err(sName(sid) + ' đang có buổi ' + (oc ? oc.name : '') + ' chưa kết thúc (bắt đầu ' + open.start + ' ngày ' + open.date + '). Hãy bấm KẾT THÚC buổi đó trước.'); }
      var n = env.now(), d = '';
      if (num(c.lat) && num(c.radius) > 0) {
        if (p.lat != null && p.lat !== '') d = dist(num(c.lat), num(c.lng), num(p.lat), num(p.lng));
        if (isT(c.requireGps)) {
          if (d === '') return err('Lớp này yêu cầu bật định vị (GPS) để điểm danh');
          if (d > num(c.radius)) return err('Bạn đang cách nơi học ' + d + ' m (cho phép ' + c.radius + ' m). Không điểm danh được.');
        }
      }
      var s = ins('sessions', { courseId: c.id, studentId: sid, date: n.date, start: n.time, end: '', minutes: 0, status: p.status === 'hoc_bu' ? 'hoc_bu' : 'co_mat',
        mode: c.mode, rate: c.mode === 'thang' ? '' : num(c.rate), note: str(p.note), inBy: me.id, outBy: '', inLat: p.lat || '', inLng: p.lng || '', inDist: d,
        confirmed: me.role === 'gv' ? '1' : '0', confirmedBy: me.role === 'gv' ? me.id : '', confirmedAt: me.role === 'gv' ? n.iso : '', createdAt: n.iso, updatedAt: n.iso });
      var msg = sName(sid) + ' bắt đầu học ' + c.name + ' lúc ' + n.time + (d !== '' ? ' (cách nơi học ' + d + ' m)' : '');
      if (me.role !== 'ph') notifyRole('ph', '▶ Bắt đầu buổi học', msg, me.id);
      return { ok: true, session: s, msg: msg };
    });

    /* ---- ĐIỂM DANH: kết thúc buổi ---- */
    A.checkout = secured(function (p, me) {
      var s = find('sessions', p.id); if (!s) return err('Không tìm thấy buổi học');
      var c = find('courses', s.courseId);
      if (!c || !canCourse(me, c) || !canStudent(me, s.studentId)) return err('Bạn không có quyền');
      if (s.end) return err('Buổi này đã kết thúc lúc ' + s.end);
      var n = env.now(), m;
      if (s.date === n.date) m = min(n.time) - min(s.start);
      else return err('Buổi học từ ngày ' + s.date + ' chưa kết thúc. Vào Nhật ký để sửa giờ kết thúc.', 'STALE');
      upd('sessions', s, { end: n.time, minutes: Math.max(0, m), outBy: me.id, updatedAt: n.iso });
      var msg = sName(s.studentId) + ' kết thúc ' + c.name + ' lúc ' + n.time + ' — học ' + Math.floor(m / 60) + ' giờ ' + (m % 60) + ' phút';
      if (me.role !== 'ph') notifyRole('ph', '■ Kết thúc buổi học', msg, me.id);
      return { ok: true, session: s, msg: msg };
    });

    /* ---- Ghi buổi thủ công / vắng / sửa ---- */
    A.saveSession = secured(function (p, me) {
      var x = p.session || {}, s = x.id ? find('sessions', x.id) : null;
      var c = find('courses', x.courseId || (s && s.courseId)); if (!c) return err('Chưa chọn lớp');
      var sid = me.role === 'hs' ? me.studentId : str(x.studentId || (s && s.studentId));
      if (!canCourse(me, c) || !canStudent(me, sid)) return err('Bạn không có quyền');
      if (list(c.studentIds).indexOf(sid) < 0) return err('Học sinh không thuộc lớp này');
      if (s && isT(s.confirmed) && me.role === 'hs') return err('Buổi đã được giáo viên xác nhận, không sửa được');
      if (me.role === 'hs' && !s && ['co_mat', 'hoc_bu'].indexOf(x.status) >= 0) return err('Học sinh hãy dùng nút BẮT ĐẦU / KẾT THÚC để điểm danh');
      if (!STATUS[x.status]) return err('Trạng thái không hợp lệ');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(str(x.date))) return err('Ngày không hợp lệ');
      var st = str(x.start), en = str(x.end), m = 0;
      if (x.status === 'co_mat' || x.status === 'hoc_bu') {
        if (!st) return err('Nhập giờ bắt đầu');
        if (en) { m = min(en) - min(st); if (m <= 0) return err('Giờ kết thúc phải sau giờ bắt đầu'); }
      } else { st = st || ''; en = en || ''; m = 0; }
      var dup = all('sessions').filter(function (o) { return o !== s && o.courseId === c.id && o.studentId === sid && o.date === x.date && o.start && st && Math.abs(min(o.start) - min(st)) < 30; })[0];
      if (dup) return err('Đã có buổi ' + c.name + ' ngày ' + x.date + ' lúc ' + dup.start + ' — tránh ghi trùng');
      var n = env.now();
      var patch = { courseId: c.id, studentId: sid, date: x.date, start: st, end: en, minutes: m, status: x.status, note: str(x.note), updatedAt: n.iso };
      if (me.role === 'ph' && x.rate !== undefined && x.rate !== '') patch.rate = num(x.rate);
      if (me.role === 'gv') { patch.confirmed = '1'; patch.confirmedBy = me.id; patch.confirmedAt = n.iso; }
      else if (me.role === 'hs') { patch.confirmed = '0'; }
      if (s) upd('sessions', s, patch);
      else {
        patch.mode = c.mode; if (patch.rate === undefined) patch.rate = c.mode === 'thang' ? '' : num(c.rate);
        patch.inBy = me.id; patch.outBy = en ? me.id : ''; patch.inLat = ''; patch.inLng = ''; patch.inDist = '';
        if (patch.confirmed === undefined) patch.confirmed = '0';
        patch.createdAt = n.iso; s = ins('sessions', patch);
      }
      if (me.role !== 'ph') notifyRole('ph', '✎ Cập nhật buổi học', sName(sid) + ' · ' + c.name + ' · ' + x.date + ': ' + STATUS[x.status], me.id);
      return { ok: true, session: s };
    });

    A.deleteSession = secured(function (p, me) {
      var s = find('sessions', p.id); if (!s) return err('Không tìm thấy');
      var c = find('courses', s.courseId);
      if (me.role === 'hs') return err('Học sinh không xóa được buổi học');
      if (me.role === 'gv' && (!c || !canCourse(me, c))) return err('Bạn không có quyền');
      del('sessions', s); return { ok: true };
    }, ['ph', 'gv']);

    A.confirm = secured(function (p, me) {
      var ids = p.ids || [], n = env.now(), k = 0, cn = {};
      ids.forEach(function (id) {
        var s = find('sessions', id), c = s && find('courses', s.courseId);
        if (!s || !c || !canCourse(me, c) || isT(s.confirmed)) return;
        upd('sessions', s, { confirmed: '1', confirmedBy: me.id, confirmedAt: n.iso }); k++; cn[c.name] = 1;
      });
      if (k && me.role === 'gv') notifyRole('ph', '✔ Giáo viên xác nhận', me.name + ' đã xác nhận ' + k + ' buổi ' + Object.keys(cn).join(', '));
      return { ok: true, count: k };
    }, ['ph', 'gv']);

    /* ---- Học phí ---- */
    A.bill = secured(function (p, me) {
      var month = str(p.month) || env.now().date.slice(0, 7), out = [];
      var ss = all('sessions'), pays = all('payments');
      all('courses').forEach(function (c) {
        if (!canCourse(me, c)) return;
        list(c.studentIds).forEach(function (sid) {
          if (!canStudent(me, sid)) return;
          var b = monthBill(c, sid, month, ss, pays);
          if (!isT(c.active) && !b.sessions && !b.pays.length) return;
          out.push(b);
        });
      });
      return { ok: true, month: month, bills: out };
    });

    /* Tổng hợp theo tháng trong năm (cho biểu đồ) */
    A.summary = secured(function (p, me) {
      var y = str(p.year) || env.now().date.slice(0, 4), res = [], ss = all('sessions'), pays = all('payments');
      for (var m = 1; m <= 12; m++) {
        var mon = y + '-' + pad(m), row = { month: mon, minutes: 0, attended: 0, absent: 0, fee: 0, paid: 0, due: 0, byCourse: {} };
        all('courses').forEach(function (c) {
          if (!canCourse(me, c)) return;
          list(c.studentIds).forEach(function (sid) {
            if (!canStudent(me, sid)) return;
            var b = monthBill(c, sid, mon, ss, pays);
            if (c.mode === 'thang' && !b.sessions && !b.pays.length) { b.fee = 0; b.total = b.adjust; b.due = b.total - b.paid; }
            row.minutes += b.minutes; row.attended += b.attended; row.absent += b.count.vang_phep + b.count.vang_kp;
            row.fee += b.total; row.paid += b.paid; row.due += b.due;
            var bc = row.byCourse[c.id] || (row.byCourse[c.id] = { minutes: 0, fee: 0, attended: 0 });
            bc.minutes += b.minutes; bc.fee += b.total; bc.attended += b.attended;
          });
        });
        res.push(row);
      }
      return { ok: true, year: y, months: res };
    });

    A.savePayment = secured(function (p) {
      var x = p.payment || {}, c = find('courses', x.courseId); if (!c) return err('Chưa chọn lớp');
      if (!/^\d{4}-\d{2}$/.test(str(x.month))) return err('Tháng không hợp lệ');
      if (!num(x.amount)) return err('Nhập số tiền');
      var n = env.now();
      var o = ins('payments', { courseId: c.id, studentId: str(x.studentId), month: x.month, type: x.type === 'dc' ? 'dc' : 'tt', amount: num(x.amount),
        date: str(x.date) || n.date, method: str(x.method), note: str(x.note), by: p.__me, createdAt: n.iso });
      if (o.type === 'tt') teachersOf(c.id).forEach(function (t) { notify(t.id, '💰 Đã thanh toán học phí', c.name + ' tháng ' + x.month.slice(5) + '/' + x.month.slice(0, 4) + ': ' + money(o.amount) + (o.studentId ? ' (' + sName(o.studentId) + ')' : '')); });
      return { ok: true, payment: o };
    }, ['ph']);

    A.deletePayment = secured(function (p) { var o = find('payments', p.id); if (o) del('payments', o); return { ok: true }; }, ['ph']);

    /* ---- Danh mục (phụ huynh quản lý) ---- */
    A.saveCourse = secured(function (p) {
      var x = p.course || {}; if (!str(x.name)) return err('Nhập tên lớp');
      if (['gio', 'buoi', 'thang'].indexOf(x.mode) < 0) return err('Chọn cách tính tiền');
      var o = {};
      SCHEMA.courses.forEach(function (k) { if (k !== 'id' && x[k] !== undefined) o[k] = x[k]; });
      o.schedule = JSON.stringify(Array.isArray(x.schedule) ? x.schedule : json(x.schedule, []));
      o.studentIds = Array.isArray(x.studentIds) ? x.studentIds.join(',') : str(x.studentIds);
      ['chargeExcused', 'chargeUnexcused', 'requireGps', 'active'].forEach(function (k) { o[k] = isT(x[k]) ? '1' : '0'; });
      var c = x.id ? find('courses', x.id) : null;
      if (c) upd('courses', c, o); else c = ins('courses', o);
      return { ok: true, course: c };
    }, ['ph']);

    A.deleteCourse = secured(function (p) {
      var c = find('courses', p.id); if (!c) return err('Không tìm thấy');
      if (all('sessions').some(function (s) { return s.courseId === c.id; })) { upd('courses', c, { active: '0' }); return { ok: true, archived: true }; }
      del('courses', c); return { ok: true };
    }, ['ph']);

    A.saveStudent = secured(function (p) {
      var x = p.student || {}; if (!str(x.name)) return err('Nhập tên học sinh');
      var o = { name: str(x.name), grade: str(x.grade), note: str(x.note), color: str(x.color), active: x.active === undefined || isT(x.active) ? '1' : '0',
        school: str(x.school), schoolLat: str(x.schoolLat), schoolLng: str(x.schoolLng) };
      var s = x.id ? find('students', x.id) : null;
      if (s) upd('students', s, o); else s = ins('students', o);
      return { ok: true, student: s };
    }, ['ph']);

    A.saveUser = secured(function (p, me) {
      var x = p.user || {}, un = str(x.username).toLowerCase();
      if (!/^[a-z0-9._-]{3,30}$/.test(un)) return err('Tên đăng nhập 3–30 ký tự, không dấu, không cách');
      if (!str(x.name)) return err('Nhập họ tên');
      if (!ROLE[x.role]) return err('Chọn vai trò');
      if (x.role === 'hs' && !str(x.studentId)) return err('Chọn học sinh gắn với tài khoản');
      var u = x.id ? find('users', x.id) : null;
      if (all('users').some(function (o) { return o !== u && str(o.username).toLowerCase() === un; })) return err('Tên đăng nhập đã tồn tại');
      if (u && u.id === me.id && (x.role !== 'ph' || !isT(x.active === undefined ? '1' : x.active))) return err('Không tự hạ quyền / khóa chính mình');
      var o = { username: un, name: str(x.name), role: x.role, studentId: x.role === 'hs' ? str(x.studentId) : '',
        courseIds: x.role === 'gv' ? (Array.isArray(x.courseIds) ? x.courseIds.join(',') : str(x.courseIds)) : '', phone: str(x.phone),
        active: x.active === undefined || isT(x.active) ? '1' : '0' };
      if (str(x.password)) { if (str(x.password).length < 6) return err('Mật khẩu tối thiểu 6 ký tự'); o.pass = hash(str(x.password)); o.mustChange = '1'; }
      if (u) upd('users', u, o);
      else { if (!o.pass) { o.pass = hash('123456'); o.mustChange = '1'; } o.createdAt = env.now().iso; u = ins('users', o); }
      return { ok: true, user: pubUser(u) };
    }, ['ph']);

    /* ---- Thời khóa biểu chính khóa (phụ huynh, học sinh) ---- */
    A.saveTT = secured(function (p, me) {
      var x = p.item || {}, sid = me.role === 'hs' ? me.studentId : str(x.studentId);
      if (!find('students', sid)) return err('Chọn học sinh');
      if (!(num(x.d) >= 1 && num(x.d) <= 7)) return err('Chọn thứ');
      if (!str(x.subject)) return err('Nhập môn học');
      if (!/^\d{1,2}:\d{2}$/.test(str(x.start)) || !/^\d{1,2}:\d{2}$/.test(str(x.end)) || min(x.end) <= min(x.start)) return err('Giờ học không hợp lệ');
      var o = { studentId: sid, d: num(x.d), start: str(x.start), end: str(x.end), subject: str(x.subject), teacher: str(x.teacher), room: str(x.room), note: str(x.note) };
      var t = x.id ? find('timetable', x.id) : null;
      if (t && !canStudent(me, t.studentId)) return err('Bạn không có quyền');
      if (t) upd('timetable', t, o); else t = ins('timetable', o);
      return { ok: true, item: t };
    }, ['ph', 'hs']);
    A.deleteTT = secured(function (p, me) { var t = find('timetable', p.id); if (t && canStudent(me, t.studentId)) del('timetable', t); return { ok: true }; }, ['ph', 'hs']);

    /* ---- Thực đơn hằng tuần ---- */
    A.saveMenu = secured(function (p) {
      var x = p.item || {};
      if (!(num(x.d) >= 1 && num(x.d) <= 7)) return err('Chọn thứ');
      if (!MEAL[x.meal]) return err('Chọn bữa');
      if (!str(x.dishes)) return err('Nhập món ăn');
      var o = { studentId: str(x.studentId), d: num(x.d), meal: x.meal, dishes: str(x.dishes), note: str(x.note) };
      var m = x.id ? find('menus', x.id) : null;
      if (m) upd('menus', m, o); else m = ins('menus', o);
      return { ok: true, item: m };
    }, ['ph']);
    A.deleteMenu = secured(function (p) { var m = find('menus', p.id); if (m) del('menus', m); return { ok: true }; }, ['ph']);

    /* ---- Đăng ký tài khoản mới: chờ phụ huynh duyệt ---- */
    A.register = function (p) {
      var un = str(p.username).toLowerCase();
      if (!/^[a-z0-9._-]{3,30}$/.test(un)) return err('Tên đăng nhập 3–30 ký tự, không dấu, không cách');
      if (!str(p.name)) return err('Nhập họ tên');
      if (str(p.password).length < 6) return err('Mật khẩu tối thiểu 6 ký tự');
      if (['gv', 'hs', 'ph'].indexOf(p.role) < 0) return err('Chọn vai trò');
      if (all('users').some(function (o) { return str(o.username).toLowerCase() === un; })) return err('Tên đăng nhập đã có người dùng');
      var u = ins('users', { username: un, name: str(p.name), role: p.role, pass: hash(str(p.password)), studentId: '', courseIds: '', phone: str(p.phone), active: '0', mustChange: '0', createdAt: env.now().iso });
      notifyRole('ph', '🆕 Tài khoản mới chờ duyệt', u.name + ' (' + ROLE[u.role] + ', ' + un + (u.phone ? ', ' + u.phone : '') + ') vừa đăng ký. Vào Khác → Tài khoản để duyệt.');
      return { ok: true, msg: 'Đã gửi đăng ký. Chờ phụ huynh (quản trị) duyệt rồi đăng nhập.' };
    };

    /* ---- Danh mục môn học (đầu vào cho thời khóa biểu) ---- */
    A.saveSubject = secured(function (p) {
      var x = p.item || {}; if (!str(x.name)) return err('Nhập tên môn');
      var o = { name: str(x.name), teacher: str(x.teacher), room: str(x.room), color: str(x.color), note: str(x.note) };
      var m = x.id ? find('subjects', x.id) : null;
      if (m) upd('subjects', m, o); else m = ins('subjects', o);
      return { ok: true, item: m };
    }, ['ph', 'hs']);
    A.deleteSubject = secured(function (p) { var m = find('subjects', p.id); if (m) del('subjects', m); return { ok: true }; }, ['ph']);

    A.saveConfig = secured(function (p) { if (p.appName) setCfg('appName', str(p.appName).slice(0, 40)); return { ok: true }; }, ['ph']);

    /* Sao lưu toàn bộ dữ liệu (JSON) */
    A.backup = secured(function () {
      var o = {}; ['students', 'courses', 'sessions', 'payments'].forEach(function (t) { o[t] = all(t); });
      return { ok: true, data: o, at: env.now().iso };
    }, ['ph']);

    function handle(p) {
      p = p || {};
      var f = A[p.action]; if (!f) return err('Thao tác không hợp lệ: ' + p.action);
      try {
        var me = auth(p); if (me) p.__me = me.id;
        return f(p);
      } catch (e) { return err('Lỗi máy chủ: ' + (e && e.message ? e.message : e)); }
    }

    /* Dữ liệu ban đầu */
    function seed() {
      if (all('users').length) return false;
      var n = env.now();
      ins('users', { username: 'admin', name: 'Phụ huynh', role: 'ph', pass: hash('123456'), studentId: '', courseIds: '', phone: '', active: '1', mustChange: '1', createdAt: n.iso });
      var st = ins('students', { name: 'Con', grade: '', note: 'Sửa tên trong Quản lý → Học sinh', color: '#2563eb', active: '1' });
      var base = { teacherPhone: '', place: '', monthlyFee: 0, roundMin: 15, minMin: 0, defaultMin: 90, studentIds: st.id, chargeExcused: '0', chargeUnexcused: '1',
        lat: '', lng: '', radius: 150, requireGps: '0', active: '1', note: '' };
      function mk(o) { var c = {}; for (var k in base) c[k] = base[k]; for (k in o) c[k] = o[k]; return ins('courses', c); }
      mk({ name: 'Tiếng Anh', subject: 'Tiếng Anh', teacher: 'Cô Tú Hảo', mode: 'gio', rate: 0, color: '#e11d48',
        schedule: JSON.stringify([{ d: 1, t: '18:00', m: 90 }, { d: 3, t: '18:00', m: 90 }, { d: 5, t: '18:00', m: 90 }]) });
      mk({ name: 'Nâng cao Toán – Lý – Hóa', subject: 'Toán, Lý, Hóa', teacher: 'Thầy Gia Khiêm', mode: 'buoi', rate: 0, color: '#2563eb',
        schedule: JSON.stringify([{ d: 2, t: '19:00', m: 120 }, { d: 7, t: '08:00', m: 120 }]) });
      setCfg('appName', 'Giờ học');
      return true;
    }

    return { handle: handle, seed: seed };
  }

  return { VERSION: VERSION, SCHEMA: SCHEMA, STATUS: STATUS, ROLE: ROLE, MEAL: MEAL, create: create, monthBill: monthBill, sessionFee: sessionFee,
    billable: billable, billMinutes: billMinutes, dist: dist, dow: dow, money: money, isT: isT, list: list, min: min, hhmm: hhmm };
})();

/* ==========================================================================
 * GIỜ HỌC — MÁY CHỦ GOOGLE APPS SCRIPT (lưu dữ liệu vào Google Sheets)
 * Cài đặt: chạy hàm setup() 1 lần -> Triển khai -> Ứng dụng web (Thực thi: Tôi, Truy cập: Bất kỳ ai)
 * ========================================================================== */
var TZ = 'Asia/Ho_Chi_Minh';

function book() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  try { var a = SpreadsheetApp.getActiveSpreadsheet(); if (a) return a; } catch (e) { }
  var ss = SpreadsheetApp.create('GioHoc_Data');
  props.setProperty('SHEET_ID', ss.getId());
  return ss;
}

function sheetOf(t) {
  var ss = book(), sh = ss.getSheetByName(t), cols = HT.SCHEMA[t];
  if (!sh) {
    sh = ss.insertSheet(t);
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold').setBackground('#dbeafe');
    sh.setFrozenRows(1);
  }
  var head = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0];
  var miss = cols.filter(function (c) { return head.indexOf(c) < 0; });
  if (miss.length) { sh.getRange(1, head.filter(String).length + 1, 1, miss.length).setValues([miss]).setFontWeight('bold').setBackground('#dbeafe'); }
  sh.getRange(1, 1, sh.getMaxRows(), Math.max(sh.getLastColumn(), cols.length)).setNumberFormat('@');
  return sh;
}

var SH = {};
var BOOK = null;
function sh(t) { return SH[t] || (SH[t] = (BOOK || (BOOK = book())).getSheetByName(t) || sheetOf(t)); }
function cell(v) {
  if (v instanceof Date) {
    if (v.getFullYear() < 1901) return Utilities.formatDate(v, TZ, 'HH:mm');
    return Utilities.formatDate(v, TZ, "yyyy-MM-dd");
  }
  return v === null || v === undefined ? '' : v;
}

var DB = {
  all: function (t) {
    var s = sh(t), n = s.getLastRow(); if (n < 2) return [];
    var v = s.getRange(1, 1, n, s.getLastColumn()).getValues(), h = v[0], out = [];
    for (var i = 1; i < v.length; i++) {
      var o = {}, empty = true;
      for (var j = 0; j < h.length; j++) if (h[j]) { o[h[j]] = cell(v[i][j]); if (o[h[j]] !== '') empty = false; }
      if (!empty) out.push(o);
    }
    return out;
  },
  insert: function (t, o) {
    var s = sh(t), h = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
    var row = h.map(function (k) { var v = o[k]; return v === undefined || v === null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v)); });
    s.getRange(s.getLastRow() + 1, 1, 1, row.length).setNumberFormat('@').setValues([row]);
  },
  rowOf: function (t, id, key) {
    var s = sh(t), h = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0], c = h.indexOf(key || 'id') + 1, n = s.getLastRow();
    if (c < 1 || n < 2) return { r: -1, h: h, s: s };
    var ids = s.getRange(2, c, n - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return { r: i + 2, h: h, s: s };
    return { r: -1, h: h, s: s };
  },
  update: function (t, id, patch, key) {
    var x = DB.rowOf(t, id, key); if (x.r < 0) return;
    var rg = x.s.getRange(x.r, 1, 1, x.h.length), row = rg.getValues()[0];
    for (var k in patch) { var j = x.h.indexOf(k); if (j >= 0) { var v = patch[k]; row[j] = v === undefined || v === null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v)); } }
    rg.setNumberFormat('@').setValues([row]);
  },
  remove: function (t, id, key) { var x = DB.rowOf(t, id, key); if (x.r > 0) x.s.deleteRow(x.r); }
};

function envGas() {
  return {
    db: DB,
    now: function () {
      var d = new Date();
      return { date: Utilities.formatDate(d, TZ, 'yyyy-MM-dd'), time: Utilities.formatDate(d, TZ, 'HH:mm'), iso: Utilities.formatDate(d, TZ, "yyyy-MM-dd'T'HH:mm:ss"), ms: d.getTime() };
    },
    hash: function (s) {
      return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
        .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
    },
    uid: function () { return Utilities.getUuid().replace(/-/g, '').slice(0, 12); }
  };
}

function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function run(p) {
  var READ = { ping: 1, load: 1, bill: 1, summary: 1, notifs: 1, backup: 1 };
  if (READ[p.action]) return HT.create(envGas()).handle(p);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, error: 'Máy chủ đang bận, thử lại sau vài giây' };
  try { return HT.create(envGas()).handle(p); } finally { lock.releaseLock(); }
}
function doGet(e) { return out(run((e && e.parameter) || {})); }
function doPost(e) { var p = {}; try { p = JSON.parse(e.postData.contents); } catch (x) { } return out(run(p)); }

/** Chạy 1 lần khi cài đặt: tạo file dữ liệu, các trang tính và tài khoản admin / 123456 */
function setup() {
  Object.keys(HT.SCHEMA).forEach(sheetOf);
  var ss = book(), d = ss.getSheetByName('Sheet1') || ss.getSheetByName('Trang tính1');
  if (d && ss.getSheets().length > 1) ss.deleteSheet(d);
  var created = HT.create(envGas()).seed();
  Logger.log('File dữ liệu: ' + ss.getUrl());
  Logger.log(created ? 'Đã tạo tài khoản: admin / 123456 (đổi mật khẩu khi đăng nhập lần đầu)' : 'Dữ liệu đã có sẵn, không tạo lại.');
}

/** Tạo sẵn tài khoản cho từng người (mật khẩu ban đầu 123456, phải đổi khi đăng nhập lần đầu). Chạy lại không tạo trùng. */
function taoTaiKhoan() {
  var env = envGas(), now = env.now().iso, users = DB.all('users'), courses = DB.all('courses'), st = DB.all('students');
  var pass = env.hash('gh$123456');
  var admin = users.filter(function (u) { return u.username === 'admin'; })[0];
  if (admin && !users.some(function (u) { return u.username === 'bach'; })) DB.update('users', admin.id, { username: 'bach', name: 'Đặng Văn Bách' });
  function cid(word) { var c = courses.filter(function (x) { return String(x.teacher).indexOf(word) >= 0; })[0]; return c ? c.id : ''; }
  [['tuhao', 'Cô Tú Hảo', 'gv', cid('Tú Hảo'), ''], ['giakhiem', 'Thầy Gia Khiêm', 'gv', cid('Gia Khiêm'), ''], ['con', st[0] ? st[0].name : 'Con', 'hs', '', st[0] ? st[0].id : '']]
    .forEach(function (a) {
      if (DB.all('users').some(function (u) { return u.username === a[0]; })) return;
      DB.insert('users', { id: env.uid(), username: a[0], name: a[1], role: a[2], pass: pass, studentId: a[4], courseIds: a[3], phone: '', active: '1', mustChange: '1', createdAt: now });
    });
  Logger.log(DB.all('users').map(function (u) { return u.username + ' · ' + u.name + ' · ' + u.role; }).join('\n'));
}
