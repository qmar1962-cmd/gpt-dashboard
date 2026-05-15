const XLSX = require('xlsx');
const fs = require('fs');

// 读取考勤明细表
const wb = XLSX.readFile('./数据库/中心考勤➣固定工-明细.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

console.log('总行数:', data.length);
console.log('第一行(标题):', JSON.stringify(data[0]).substring(0, 200));
console.log('第二行:', JSON.stringify(data[1]).substring(0, 200));
console.log('第三行:', JSON.stringify(data[2]).substring(0, 200));
console.log('第四行:', JSON.stringify(data[3]).substring(0, 200));
console.log('第五行:', JSON.stringify(data[4]).substring(0, 200));

// 打印更多行看结构
console.log('\n--- 更多行样本 ---');
for (let i = 0; i < Math.min(10, data.length); i++) {
  console.log(`行${i}:`, JSON.stringify(data[i]).substring(0, 300));
}
