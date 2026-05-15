const XLSX = require('xlsx');
const fs = require('fs');
const wb = XLSX.readFile('./数据库/武汉中心考勤表  - .xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

const hdrs = data[0];
const dayNums = data[1].slice(9, 39);
const weekNames = hdrs.slice(9, 39);
const title = String((data[2] || [''])[0] || '');

// Excel日期序列号转换
function excelDateToStr(val) {
  if (typeof val === 'number' && val > 10000) {
    const epoch = Date.UTC(1899, 11, 30);
    const d = new Date(epoch + val * 86400000);
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth()+1).padStart(2,'0') + '-' + String(d.getUTCDate()).padStart(2,'0');
  }
  return val !== '' && val !== null && val !== undefined ? String(val) : '';
}

const realRows = data.slice(3).filter(function(r) { return r[0] || r[7]; });
console.log('有效行数:', realRows.length);

const rows = realRows.map(function(r) {
  return {
    seq: r[0],
    unit: r[1],
    dept1: r[2],
    dept2: r[3],
    role: r[4],
    empId: r[5],
    group: r[6],
    name: r[7],
    entryDate: excelDateToStr(r[8]),
    // 30天出勤
    days: r.slice(9, 39).map(function(v) { return v === '' || v === null ? '' : String(v); }),
    // 主要统计列
    absenceDays: r[39],
    truantDeductDays: r[40],
    actualWorkDays: r[47],
    workDays: r[48],
    paidLeaveDays: r[49],
    shouldWorkDays: r[51],
    legalPayDays: r[53],
    personalLeave: r[54],
    sickLeave: r[55],
    truantDays: r[60],
    lateMinutes: r[64],
    earlyLeaveMinutes: r[65],
    reportActualDays: r[69],
    sysDiff: r[71],
    diffReason: r[72] !== undefined ? String(r[72]) : '',
    remark: r[73] !== undefined ? String(r[73]) : '',
  };
});

// 只取前50条用于静态展示
const output = {
  title: title,
  month: '2026年5月',
  center: '武汉转运中心',
  group: '省内一班',
  dayNums: dayNums,
  weekNames: weekNames,
  rows: rows.slice(0, 50)
};

fs.writeFileSync('./src/data/attendanceData.json', JSON.stringify(output, null, 2), 'utf8');
console.log('写入成功，共', output.rows.length, '条');
