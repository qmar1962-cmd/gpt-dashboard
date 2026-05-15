const XLSX = require('xlsx');
const wb = XLSX.readFile('./数据库/在职花名册2026-04-28.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const d = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
const hdrs = d[0];

// 打印所有列名，找"中心"相关列
hdrs.forEach(function(h, i) {
  console.log('列' + i + ': ' + h.replace(/\u200b/g, ''));
});

// 找含"中心"或"省区"的列
hdrs.forEach(function(h, i) {
  const clean = h.replace(/\u200b/g, '');
  if (clean.includes('中心') || clean.includes('省区') || clean.includes('单位') || clean.includes('部门')) {
    console.log('>>> 找到: 列' + i + ': ' + clean);
    var vals = [...new Set(d.slice(1).map(function(r) { return String(r[i] || ''); }))];
    console.log('    唯一值(前20):', JSON.stringify(vals.slice(0, 20)));
  }
});
