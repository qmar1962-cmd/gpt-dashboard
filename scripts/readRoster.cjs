const XLSX = require('xlsx');
const wb = XLSX.readFile('./数据库/在职花名册2026-04-28.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const d = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
const hdrs = d[0];
console.log('列数:', hdrs.length);
console.log('列名:', JSON.stringify(hdrs.slice(0, 15)));
console.log('行数:', d.length);
console.log('第1行数据:', JSON.stringify((d[1] || []).slice(0, 15)));
// 中心列 - 找一下哪列是中心
const centerIdx = hdrs.indexOf('中心名称');
if (centerIdx >= 0) {
  const centers = [...new Set(d.slice(1).map(function(r) { return String(r[centerIdx] || ''); }))];
  console.log('中心列表:', JSON.stringify(centers));
} else {
  console.log('未找到中心名称列，尝试其他列');
  // 打印前几列的唯一值
  for (var i = 0; i < 10; i++) {
    var vals = [...new Set(d.slice(1).map(function(r) { return String(r[i] || ''); }))];
    console.log('列' + i + ' [' + hdrs[i] + '] 唯一值:', JSON.stringify(vals.slice(0, 10)));
  }
}
