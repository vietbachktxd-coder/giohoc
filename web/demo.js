/* Chế độ DÙNG THỬ: chạy toàn bộ phần mềm ngay trên máy, dữ liệu lưu trong trình duyệt (không chia sẻ). */
var DEMO = (function () {
  var KEY = 'gh_demo_db';
  var T = null;
  function load() { if (!T) { try { T = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { T = {}; } } return T; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(T)); } catch (e) { } }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function now() {
    var d = new Date();
    return { date: d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()), time: p2(d.getHours()) + ':' + p2(d.getMinutes()),
      iso: d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + 'T' + p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds()), ms: d.getTime() };
  }
  var db = {
    all: function (t) { return (load()[t] || []).map(function (o) { return Object.assign({}, o); }); },
    insert: function (t, o) { load(); (T[t] = T[t] || []).push(Object.assign({}, o)); save(); },
    update: function (t, id, p, k) { load(); var o = (T[t] || []).filter(function (x) { return x[k || 'id'] === id; })[0]; if (o) { Object.assign(o, p); save(); } },
    remove: function (t, id, k) { load(); T[t] = (T[t] || []).filter(function (x) { return x[k || 'id'] !== id; }); save(); }
  };
  function hash(s) { var h1 = 0x811c9dc5, h2 = 0x1000193; for (var i = 0; i < s.length; i++) { h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619); h2 = Math.imul(h2 + s.charCodeAt(i), 2654435761); } return (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16); }
  var env = { db: db, now: now, hash: hash, uid: function () { return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); } };

  /* Dữ liệu mẫu: 2 lớp, 1 học sinh, buổi học 2 tháng gần nhất */
  function sample() {
    if ((load().users || []).length) return;
    var x = HT.create(env); x.seed();
    var c = db.all('courses'), s = db.all('students')[0];
    db.update('students', s.id, { name: 'Bé An', grade: 'Lớp 8' });
    db.update('courses', c[0].id, { rate: 200000 });
    db.update('courses', c[1].id, { rate: 250000 });
    db.update('users', db.all('users')[0].id, { mustChange: '0' });
    var t = new Date(); t.setDate(1); t.setMonth(t.getMonth() - 1);
    var today = now().date;
    while (true) {
      var d = t.getFullYear() + '-' + p2(t.getMonth() + 1) + '-' + p2(t.getDate());
      if (d >= today) break;
      var w = HT.dow(d);
      c.forEach(function (k, i) {
        JSON.parse(k.schedule).forEach(function (sl) {
          if (sl.d !== w) return;
          var r = Math.random(), st = r < 0.08 ? 'vang_phep' : r < 0.12 ? 'vang_kp' : r < 0.15 ? 'gv_nghi' : 'co_mat';
          var m = st === 'co_mat' ? sl.m + Math.round((Math.random() - 0.5) * 20) : 0;
          var a = HT.min(sl.t) + Math.round(Math.random() * 6);
          db.insert('sessions', { id: env.uid(), courseId: k.id, studentId: s.id, date: d, start: st === 'co_mat' ? HT.hhmm(a) : '', end: st === 'co_mat' ? HT.hhmm(a + m) : '',
            minutes: m, status: st, mode: k.mode, rate: i ? 250000 : 200000, note: '', inBy: '', outBy: '', confirmed: d < today.slice(0, 8) + '01' ? '1' : '0', createdAt: d });
        });
      });
      t.setDate(t.getDate() + 1);
    }
  }

  return {
    call: function (p) {
      sample();
      var r = HT.create(env).handle(JSON.parse(JSON.stringify(p)));
      return new Promise(function (res) { setTimeout(function () { res(r); }, 120); });
    },
    reset: function () { localStorage.removeItem(KEY); T = null; }
  };
})();
