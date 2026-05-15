const XLSX = require('xlsx');
const fs = require('fs');

// 读取考勤明细表
console.log('读取考勤明细表...');
const wb = XLSX.readFile('./数据库/中心考勤➣固定工-明细.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

console.log(`总记录数: ${data.length - 1} 条`);

// 读取花名册，获取所有工号（用于判断缺勤）
console.log('读取花名册...');
const wbRoster = XLSX.readFile('./数据库/在职花名册2026-04-28.xlsx');
const wsRoster = wbRoster.Sheets[wbRoster.SheetNames[0]];
const rosterData = XLSX.utils.sheet_to_json(wsRoster, { header: 1, defval: '' });

// 获取所有转运中心工号集合
const TARGET_CENTERS = [
  '武汉转运中心','武昌转运中心','荆州转运中心','襄阳转运中心',
  '长沙转运中心','衡阳转运中心','常德转运中心','郑州转运中心',
  '漯河转运中心','新乡转运中心','商丘转运中心','南昌转运中心',
  '赣州转运中心','横峰转运中心',
];
const TARGET_SET = new Set(TARGET_CENTERS);

const allEmpIds = new Set();
rosterData.slice(1).forEach(function(row) {
  const center = String(row[24] || '').trim(); // Y列: 转运中心
  const empId = String(row[1] || '').trim();   // B列: 工号
  if (center && TARGET_SET.has(center) && empId) {
    allEmpIds.add(empId);
  }
});
console.log(`花名册中目标中心工号数: ${allEmpIds.size}`);

// 按日期分组出勤记录：{ "2026-05-01": Set(工号) }
const dateAttendance = {};
data.slice(1).forEach(function(row) {
  const date = String(row[0] || '').trim();  // A列: 日期
  const empId = String(row[7] || '').trim();  // H列: 工号
  if (!date || !empId) return;
  if (!dateAttendance[date]) dateAttendance[date] = new Set();
  dateAttendance[date].add(empId);
});

console.log(`有数据的日期: ${Object.keys(dateAttendance).sort().join(', ')}`);

// 生成出勤映射: { "工号": { "日期": true/false } }
// true = 出勤, false = 缺勤(该日期有数据但此人未出勤), undefined = 该日期无数据
const attendanceMap = {};
allEmpIds.forEach(function(empId) {
  attendanceMap[empId] = {};
});

// 对有数据的每个日期，标记所有工号的出勤状态
Object.keys(dateAttendance).sort().forEach(function(date) {
  const presentSet = dateAttendance[date];
  allEmpIds.forEach(function(empId) {
    // true = 出勤, false = 缺勤（该日期有数据但此人没记录）
    attendanceMap[empId][date] = presentSet.has(empId);
  });
});

// 统计
const activeDates = Object.keys(dateAttendance).sort();
console.log(`\n生成完毕:`);
console.log(`  有数据的日期: ${activeDates.join(', ')}`);
console.log(`  工号总数: ${Object.keys(attendanceMap).length}`);
const sampleId = Object.keys(attendanceMap)[0];
console.log(`  示例工号 ${sampleId} 出勤记录: ${JSON.stringify(attendanceMap[sampleId])}`);

// 写入出勤映射
fs.writeFileSync('./src/data/attendanceMap.json', JSON.stringify(attendanceMap), 'utf8');
console.log('\n完成！已生成 src/data/attendanceMap.json');
