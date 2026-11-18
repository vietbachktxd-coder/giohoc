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
