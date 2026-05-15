const XLSX = require('xlsx');
const wb = XLSX.readFile('./数据库/在职花名册2026-04-28.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const d = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
const hdrs = d[0];

// 把 Excel 列字母转数字索引
function colLetterToIdx(letter) {
  let idx = 0;
  for (let i = 0; i < letter.length; i++) {
    idx = idx * 26 + (letter.charCodeAt(i) - 64);
  }
  return idx - 1; // 0-based
}

const targetCols = [
  { letter: 'B', name: '工号' },
  { letter: 'C', name: '姓名' },
  { letter: 'AI', name: '二级部门' },
  { letter: 'AM', name: '组别' },
  { letter: 'AU', name: '岗位' },
  { letter: 'Y', name: '转运中心筛选' },
];

targetCols.forEach(function(c) {
  const idx = colLetterToIdx(c.letter);
  const cleanName = (hdrs[idx] || '').replace(/\u200b/g, '');
  console.log('列' + c.letter + ' (idx=' + idx + ') [' + c.name + ']: ' + cleanName);
  // 打印前3条数据
  var vals = [d[1] ? d[1][idx] : '', d[2] ? d[2][idx] : '', d[3] ? d[3][idx] : ''];
  console.log('  示例:', JSON.stringify(vals));
});
