import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const DATA = new URL('./.data/', import.meta.url).pathname;
const kunci = (): string[] => (JSON.parse(readFileSync(`${DATA}fixture.json`, 'utf8')) as { kunci: string[] }).kunci;

async function bukaPeriksa(page: Page) {
  await page.goto('/periksa/');
  await expect(page.locator('[data-siap]')).toBeAttached();
}

test.describe('unggah PDF', () => {
  test('PDF asli → asli dan tercatat', async ({ page }) => {
    await bukaPeriksa(page);
    await page.locator('input[type=file]').setInputFiles(`${DATA}asli.pdf`);
    await expect(page.getByTestId('status')).toHaveText('↑ Asli · tercatat');
    await expect(page.getByRole('link', { name: 'Lihat rincian ijazah #1' })).toHaveAttribute('href', '/i/1');
  });

  test('PDF diubah satu bita → tidak tercatat', async ({ page }) => {
    await bukaPeriksa(page);
    await page.locator('input[type=file]').setInputFiles(`${DATA}ubah.pdf`);
    await expect(page.getByTestId('status')).toHaveText('✕ Tidak tercatat');
  });

  test('PDF ijazah yang dicabut → dicabut', async ({ page }) => {
    await bukaPeriksa(page);
    await page.locator('input[type=file]').setInputFiles(`${DATA}dicabut.pdf`);
    await expect(page.getByTestId('status')).toHaveText('↓ Dicabut');
  });

  test('nomor token membuka halaman hasil', async ({ page }) => {
    await bukaPeriksa(page);
    await page.getByRole('button', { name: 'Nomor token' }).click();
    await page.getByPlaceholder('Nomor token, misalnya 1284').fill('1');
    await page.getByRole('button', { name: 'Buka' }).click();
    await expect(page).toHaveURL(/\/i\/1$/);
    await expect(page.getByTestId('terkunci')).toBeVisible();
  });
});

test.describe('halaman /i/[tokenId]', () => {
  test('QR berkunci → nama, sidik jari cocok, unduh PDF', async ({ page }) => {
    await page.goto(`/i/1#k=${kunci()[0]}`);
    await expect(page.getByTestId('nama')).toHaveText('Dewi Lestari Anggraini');
    await expect(page.getByText('↑ Cocok 100%')).toBeVisible();
    const unduhan = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Unduh PDF' }).click();
    expect((await unduhan).suggestedFilename()).toBe('ijazah-UNPAM-2026-0001.pdf');
  });

  test('tanpa kunci → status saja, data terkunci', async ({ page }) => {
    await page.goto('/i/1');
    await expect(page.getByTestId('status')).toHaveText('↑ Asli · tercatat');
    await expect(page.getByTestId('terkunci')).toBeVisible();
    await expect(page.getByTestId('nama')).toHaveCount(0);
  });

  test('kunci salah → tidak bisa membuka berkas', async ({ page }) => {
    await page.goto(`/i/1#k=${'A'.repeat(43)}`);
    await expect(page.getByText('✕ Tidak cocok')).toBeVisible();
    await expect(page.getByTestId('nama')).toHaveCount(0);
  });

  test('token dicabut tetap terbaca sebagai dicabut', async ({ page }) => {
    await page.goto(`/i/2#k=${kunci()[1]}`);
    await expect(page.getByTestId('status')).toHaveText('↓ Dicabut');
    await expect(page.getByTestId('nama')).toHaveText('Budi Santoso');
  });

  test('token yang tidak ada', async ({ page }) => {
    await page.goto('/i/999');
    await expect(page.getByRole('heading', { name: 'Token #999 tidak ada' })).toBeVisible();
  });

  test('header Referrer-Policy no-referrer', async ({ page }) => {
    const r = await page.goto('/i/1');
    expect(r?.headers()['referrer-policy']).toBe('no-referrer');
  });
});

test.describe('tampilan', () => {
  for (const lebar of [320, 375, 414, 768]) {
    test(`tanpa geser horizontal di lebar ${lebar} px`, async ({ page }) => {
      await page.setViewportSize({ width: lebar, height: 820 });
      for (const alamat of ['/periksa/', `/i/1#k=${kunci()[0]}`]) {
        await page.goto(alamat);
        await expect(page.locator('[data-siap]')).toBeAttached();
        const lebih = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(lebih, alamat).toBeLessThanOrEqual(0);
      }
    });
  }

  test('reduced motion mematikan transisi', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await bukaPeriksa(page);
    const durasi = await page.locator('.segel-keping').evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(durasi).toBe('0s');
  });
});
