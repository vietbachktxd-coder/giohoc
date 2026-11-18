// Ghép core.js + gas.js -> backend/Code.gs (dán vào Apps Script)
const fs = require('fs'), path = require('path'), b = path.join(__dirname, '..', 'backend');
const core = fs.readFileSync(path.join(b, 'core.js'), 'utf8').replace(/\nif \(typeof module[^\n]*\n?/, '\n');
fs.writeFileSync(path.join(b, 'Code.gs'), '/* TỰ SINH từ core.js + gas.js — sửa 2 file đó rồi chạy: node tools/build-gas.js */\n' + core + '\n' + fs.readFileSync(path.join(b, 'gas.js'), 'utf8'));
console.log('backend/Code.gs OK');
