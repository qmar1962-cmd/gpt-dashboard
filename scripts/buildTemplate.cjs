const XLSX = require('xlsx');
const fs = require('fs');

// Excel 列字母转 0-based 索引
function colLetterToIdx(letter) {
  let idx = 0;
  for (let i = 0; i < letter.length; i++) {
    idx = idx * 26 + (letter.charCodeAt(i) - 64);
  }
  return idx - 1;
}

const COL = {
  empId:  colLetterToIdx('B'),   // 工号
  name:   colLetterToIdx('C'),   // 姓名
  dept2:  colLetterToIdx('AI'),  // 二级部门
  group:  colLetterToIdx('AM'),  // 组别
  role:   colLetterToIdx('AU'),  // 岗位
  center: colLetterToIdx('Y'),   // 转运中心筛选
};

// 12 个目标中心
const TARGET_CENTERS = [
  '武汉转运中心','武昌转运中心','荆州转运中心','襄阳转运中心',
  '长沙转运中心','衡阳转运中心','常德转运中心','郑州转运中心',
  '漯河转运中心','新乡转运中心','商丘转运中心','南昌转运中心',
  '赣州转运中心','横峰转运中心',
];
const TARGET_SET = new Set(TARGET_CENTERS);

// 读取武汉考勤表（获取月份模板）
const wbAtt = XLSX.readFile('./数据库/武汉中心考勤表  - .xlsx');
const wsAtt = wbAtt.Sheets[wbAtt.SheetNames[0]];
const attData = XLSX.utils.sheet_to_json(wsAtt, { header: 1, defval: '' });
const attTitle = String((attData[2] || [''])[0] || '');

// 解析标题获取年月，如 "2026年 5月"
var titleParts = attTitle.split(/\s+/);
var monthStr = titleParts.slice(0, 2).join(' '); // "2026年 5月"
var year = parseInt(titleParts[0]);
var month = parseInt(titleParts[1]);

// 根据年月动态生成完整日期（1-31号）
const DAYS_IN_MONTH = new Date(year, month, 0).getDate(); // 该月总天数
const WEEK_NAMES = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
const dayNums = [];
const weekNames = [];
for (let d = 1; d <= DAYS_IN_MONTH; d++) {
  dayNums.push(String(d));
  const dt = new Date(year, month - 1, d);
  weekNames.push(WEEK_NAMES[dt.getDay()]);
}

// 读取花名册
const wbRoster = XLSX.readFile('./数据库/在职花名册2026-04-28.xlsx');
const wsRoster = wbRoster.Sheets[wbRoster.SheetNames[0]];
const rosterData = XLSX.utils.sheet_to_json(wsRoster, { header: 1, defval: '' });

// 按中心分组，只取 TARGET_CENTERS 中的
var centerGroups = {};
rosterData.slice(1).forEach(function(row) {
  var c = String(row[COL.center] || '').trim();
  if (!c || !TARGET_SET.has(c)) return;
  if (!centerGroups[c]) centerGroups[c] = [];
  centerGroups[c].push({
    empId: String(row[COL.empId] || '').trim(),
    name:  String(row[COL.name]  || '').trim(),
    dept2: String(row[COL.dept2] || '').trim(),
    group: String(row[COL.group] || '').trim(),
    role:  String(row[COL.role]  || '').trim(),
  });
});

// 生成每条人员的考勤行模板
function makeRows(persons) {
  return persons.map(function(p, i) {
    return {
      seq: i + 1,
      empId: p.empId,
      name: p.name,
      dept2: p.dept2,
      group: p.group,
      role: p.role,
      days: Array(DAYS_IN_MONTH).fill(''),
      absenceDays: 0,
      truantDeductDays: 0,
      actualWorkDays: 0,
      workDays: 0,
      paidLeaveDays: 0,
      shouldWorkDays: 0,
      legalPayDays: 0,
      personalLeave: 0,
      sickLeave: 0,
      truantDays: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      reportActualDays: 0,
      sysDiff: 0,
      diffReason: '',
      remark: '',
    };
  });
}

// 输出：中心元数据（无人员数据）+ 各中心人员 JSON
var meta = {}; // centerKey -> { name, count }
var output = {}; // centerKey -> full data

TARGET_CENTERS.forEach(function(c) {
  var persons = centerGroups[c] || [];
  meta[c] = { name: c, count: persons.length };
  output[c] = {
    title: monthStr + ' ' + c + ' 人员 考勤表',
    month: monthStr,
    center: c,
    dayNums: dayNums,
    weekNames: weekNames,
    rows: makeRows(persons),
  };
  console.log(c + ': ' + persons.length + ' 人');
});

// 写入中心元数据（轻量，下拉列表用）
fs.writeFileSync('./src/data/attendanceMeta.json', JSON.stringify(meta, null, 2), 'utf8');

// 写入各中心完整数据（按需加载）
fs.writeFileSync('./src/data/attendanceData.json', JSON.stringify(output, null, 2), 'utf8');

console.log('\n完成！');
console.log('attendanceMeta.json: 中心元数据（轻量）');
console.log('attendanceData.json: 各中心完整人员数据');
