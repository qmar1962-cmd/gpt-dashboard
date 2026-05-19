const idb = require('idb');

async function checkIDB() {
  const db = await idb.openDB('gpt-dashboard', 1);
  const tx = db.transaction('rawData', 'readonly');
  const store = tx.objectStore('rawData');
  
  const allData = await store.getAll();
  console.log('IndexedDB 中所有数据类型:', allData.map(d => d.id));
  
  const att7 = allData.find(d => d.id === 'attendance_7days');
  if (att7) {
    console.log('\nattendance_7days 数据:');
    console.log('- 长度:', att7.rawData?.length);
    if (att7.rawData && att7.rawData.length > 0) {
      console.log('- 第一条数据的列名:', Object.keys(att7.rawData[0]));
      console.log('- 第一条数据:', JSON.stringify(att7.rawData[0]));
    }
  } else {
    console.log('未找到 attendance_7days 数据');
  }
  
  db.close();
}

checkIDB().catch(console.error);
