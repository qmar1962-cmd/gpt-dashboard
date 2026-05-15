const XLSX = require('xlsx');
const wb = XLSX.readFile('./数据库/中心考勤固定工-部门汇总.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const d = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
const hdrs = d[0];
const rows = d.slice(1);

// 找中心相关列
const centerNameIdx = hdrs.indexOf('中心名称');
const centerCodeIdx = hdrs.indexOf('中心代码');
const provinceIdx = hdrs.indexOf('省区名称');
console.log('中心名称列索引:', centerNameIdx);
console.log('省区名称列索引:', provinceIdx);

// 获取唯一中心列表
var centers = {};
rows.forEach(function(r) {
  var cName = String(r[centerNameIdx] || '');
  var cCode = String(r[centerCodeIdx] || '');
  var pName = String(r[provinceIdx] || '');
  if (cName) {
    if (!centers[cName]) {
      centers[cName] = { code: cCode, province: pName, count: 0 };
    }
    centers[cName].count++;
  }
});

console.log('\n所有中心（按省区分组）:');
var provinces = {};
Object.keys(centers).forEach(function(c) {
  var p = centers[c].province;
  if (!provinces[p]) provinces[p] = [];
  provinces[p].push(c);
});
Object.keys(provinces).forEach(function(p) {
  console.log('  ' + p + ':', JSON.stringify(provinces[p]));
});
