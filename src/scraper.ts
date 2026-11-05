import { chromium } from 'playwright';

export async function scrapeAllWeeksHtmls(url: string, weekCount = 4): Promise<string[]> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log(`[Playwright] Chargement de ${url}...`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

  console.log('[Playwright] Sélection de la promotion L2 (DFGSM2)...');

  const inputPromo = page.locator('input[id*="bouton_Edit"]').first();
  await inputPromo.waitFor({ state: 'attached', timeout: 20000 });

  await inputPromo.click();
  await page.keyboard.press('Meta+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('DFGSM2', { delay: 100 });

  const targetOption = page.locator('.liste-as-options div[role="option"]').filter({ hasText: 'L2' }).filter({ hasText: 'DFGSM2' }).first();
  await targetOption.waitFor({ state: 'attached', timeout: 10000 });
  await targetOption.dispatchEvent('click');

  console.log('[Playwright] Option "L2 (DFGSM2)" validée.');

  // Attendre la grille
  await page.waitForFunction(() => {
    const text = document.querySelector('.ObjetGrilleCours')?.textContent || '';
    return text.includes('L2-') || text.includes('DFGSM2');
  }, { timeout: 30000 });

  await page.waitForTimeout(1000);

  // 1. Cibler strictement la case de semaine active dans le calendrier
  const selectedWeekEl = page.locator('.calendrier-jour.selected[id*="_j_"]').first();
  await selectedWeekEl.waitFor({ state: 'attached', timeout: 10000 });
  const currentId = await selectedWeekEl.getAttribute('id');
  if (!currentId) throw new Error('Semaine active non localisée dans le calendrier');

  console.log(`[Playwright] Semaine active détectée : ${currentId}`);

  const idMatch = currentId.match(/^(.*_j_)(\d+)$/);
  if (!idMatch) throw new Error(`Format ID semaine inattendu : ${currentId}`);

  const prefix = idMatch[1];
  const startIdx = parseInt(idMatch[2], 10);
  const htmlSnapshots: string[] = [];

  for (let offset = 0; offset < weekCount; offset++) {
    const targetIdx = startIdx + offset;
    const targetId = `${prefix}${targetIdx}`;
    const weekBtn = page.locator(`[id="${targetId}"]`);

    if ((await weekBtn.count()) === 0) {
      console.warn(`[Playwright] Semaine index ${targetIdx} absente. Fin.`);
      break;
    }

    if (offset > 0) {
      const oldHeader = await page.evaluate(() => {
        return document.querySelector('#id_46_titreTranche0')?.textContent?.trim() || '';
      });

      console.log(`[Playwright] Clic sur semaine index ${targetIdx}...`);

      await weekBtn.scrollIntoViewIfNeeded().catch(() => {});
      await weekBtn.click({ force: true });

      // Attendre que la classe selected bascule ou que l'en-tête de date change
      await page.waitForFunction(
        ({ targetId, oldHeader }) => {
          const btn = document.getElementById(targetId);
          const isSelected = btn?.classList.contains('selected');
          const header = document.querySelector('#id_46_titreTranche0')?.textContent?.trim() || '';
          return isSelected && header !== oldHeader;
        },
        { targetId, oldHeader },
        { timeout: 10000 }
      ).catch(() => {});

      await page.waitForTimeout(800);
    }

    const currentMonday = await page.evaluate(() => {
      return document.querySelector('#id_46_titreTranche0')?.textContent?.trim() || 'inconnu';
    });
    console.log(`[Playwright] Semaine ${offset + 1}/${weekCount} capturée (${currentMonday}).`);

    const html = await page.content();
    htmlSnapshots.push(html);
  }

  await browser.close();
  return htmlSnapshots;
}
