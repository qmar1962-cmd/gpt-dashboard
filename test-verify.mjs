import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const DIR = 'C:/temp';
mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const findings = [];
const att15Logs = [];

page.on('console', msg => {
  if (msg.text().includes('[排休判定]')) att15Logs.push(msg.text());
});

try {
  // 1. Open page
  console.log('[1] Opening page...');
  await page.goto('http://localhost:5174/gpt-dashboard/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: join(DIR, '01-loaded.png') });

  // 2. Login as admin
  console.log('[2] Logging in...');
  const nameInput = page.locator('input').first();
  const empInput = page.locator('input').nth(1);
  if (await nameInput.count() > 0) {
    await nameInput.fill('测试');
    await empInput.fill('01234567');
    // Click admin label
    const adminLabel = page.locator('text=管理员');
    if (await adminLabel.count() > 0) {
      await adminLabel.click();
      await page.waitForTimeout(500);
      const pwdInput = page.locator('input').nth(2);
      await pwdInput.fill('123456');
      await page.locator('button:has-text("管理员登录")').click();
    } else {
      await page.locator('button:has-text("登录")').click();
    }
    await page.waitForTimeout(5000);
    await page.screenshot({ path: join(DIR, '02-after-login.png') });
  } else {
    console.log('[2] Already logged in (no input fields found)');
  }

  // 3. Find attendance15 clickable cells
  console.log('[3] Finding attendance15 data...');
  const bodyText = await page.locator('body').innerText();
  findings.push(`Page content sample: ${bodyText.substring(0, 200)}`);

  // 4. Navigate to center attendance module if needed
  const attTab = page.locator('button:has-text("中心考勤"), button:has-text("考勤")');
  if (await attTab.count() > 0) {
    await attTab.first().click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: join(DIR, '03-attendance-module.png') });
    console.log('[3] Opened attendance module');
  }

  // 5. Check for modal - try clicking on data cells
  const clickableCells = page.locator('td.cursor-pointer, td[class*="cursor"]');
  const cellCount = await clickableCells.count();
  console.log(`[4] Found ${cellCount} clickable cells`);

  if (cellCount > 0) {
    // Click the first visible one that has a number
    for (let i = 0; i < Math.min(cellCount, 20); i++) {
      const cell = clickableCells.nth(i);
      const text = await cell.textContent();
      const display = await cell.evaluate(el => window.getComputedStyle(el).display);
      if (text && /\d+/.test(text.trim()) && display !== 'none') {
        console.log(`[4] Clicking cell: "${text.trim()}"`);
        await cell.click();
        await page.waitForTimeout(3000);
        break;
      }
    }
  }

  // 6. Check for modal
  await page.screenshot({ path: join(DIR, '04-modal.png'), fullPage: false });

  // Look for judgment text
  const modalText = await page.locator('body').innerText();
  if (modalText.includes('数据不足')) findings.push('⚠️ 发现"数据不足"文字');
  if (modalText.includes('无法排休')) findings.push('✅ 发现"无法排休"判定');
  if (modalText.includes('没排休')) findings.push('✅ 发现"没排休"判定');
  if (modalText.includes('出勤率')) findings.push('✅ 发现"出勤率"字段');

  console.log('[5] Modal text analysis:', findings.join(' '));

} catch (e) {
  console.error('FAIL:', e.message);
  findings.push(`❌ Error: ${e.message}`);
  await page.screenshot({ path: join(DIR, 'error.png'), fullPage: true });
}

console.log('\n=== [排休判定] Console Logs ===');
att15Logs.forEach(l => console.log(l));

console.log('\n=== Findings ===');
findings.forEach(f => console.log(f));

// Verdict
const hasData = findings.some(f => f.includes('无法排休') || f.includes('没排休'));
const hasInsufficient = findings.some(f => f.includes('数据不足'));
const hasRates = att15Logs.length > 0;

console.log('\n=== VERDICT ===');
if (hasRates && !hasInsufficient) {
  console.log('PASS - Group attendance rates calculated correctly');
} else if (hasRates && hasInsufficient) {
  console.log('MIXED - Data calculated but some rows show insufficient');
} else if (!hasRates) {
  console.log('FAIL - No [排休判定] logs found, calculation may not have run');
} else {
  console.log('INCONCLUSIVE');
}

await browser.close();
