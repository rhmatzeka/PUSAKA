import { expect, test, type Page } from '@playwright/test';

async function gulirKe(page: Page, p: number) {
  await page.evaluate((x) => window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight) * x), p);
}

test('judul tampil tanpa menunggu 3D, lalu adegan hidup', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Ijazah yang\s*mustahil dipalsukan/);
  await expect(page.locator('html.hidup')).toBeAttached();
  await expect(page.locator('html')).toHaveAttribute('data-babak', 'pembuka');
});

test('gulir sampai bawah melewati babak dan berakhir di penutup', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html.hidup')).toBeAttached();
  await gulirKe(page, 0.27);
  await expect(page.locator('html')).toHaveAttribute('data-babak', 'cetak-biru');
  await gulirKe(page, 1);
  await expect(page.locator('html')).toHaveAttribute('data-babak', 'penutup');
  await expect(page.getByRole('heading', { name: 'Asli atau palsu?' })).toBeVisible();
  await page.locator('[data-untuk="penutup"]').getByRole('link', { name: 'Periksa ijazah' }).click();
  await expect(page).toHaveURL(/\/periksa\/?$/);
});

test('jumlah ijazah tercatat dibaca langsung dari kontrak', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-total-terbit]')).toHaveText(/^\d+$/);
  await expect(page.locator('[data-alamat-kontrak]').first()).toHaveText('0x5FbD…0aa3');
});

test('reduced motion: tanpa kanvas, semua teks tampil, gulir biasa', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('html.statis')).toBeAttached();
  await expect(page.locator('#kanvas-beranda')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Langsung ketahuan.' })).toBeVisible();
});

test('tanpa geser horizontal di 375 px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  await expect(page.locator('html.hidup')).toBeAttached();
  for (const p of [0, 0.3, 0.45, 0.6, 0.8, 1]) {
    await gulirKe(page, p);
    const lebih = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(lebih, `p=${p}`).toBeLessThanOrEqual(0);
  }
});
