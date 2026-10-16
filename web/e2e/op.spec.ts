import { writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { buatPdf } from './pdf';

const DATA = new URL('./.data/', import.meta.url).pathname;

// Alur berurutan: tiap tes melanjutkan keadaan tes sebelumnya (satu Anvil + satu basis data).
test.describe.configure({ mode: 'serial' });

async function masukSebagai(page: Page, label: 'Operator BAAK' | 'Rektor', ke: '/op' | '/meja') {
  await page.goto(`/masuk/?ke=${ke}`);
  await page.getByRole('button', { name: `Masuk sebagai ${label}` }).click();
  await expect(page).toHaveURL(new RegExp(`${ke}/?$`));
  await expect(page.locator('[data-siap]')).toBeAttached();
}

const kabar = (page: Page) => page.getByTestId('kabar');

test('operator mengunggah CSV + PDF; baris salah tidak ikut terkirim', async ({ page }) => {
  writeFileSync(`${DATA}siti.pdf`, buatPdf(['IJAZAH', 'Siti Nurhaliza', 'UNPAM/2026/0010']));
  writeFileSync(`${DATA}agus.pdf`, buatPdf(['IJAZAH', 'Agus Pratama', 'UNPAM/2026/0011']));
  writeFileSync(
    `${DATA}lulusan.csv`,
    [
      'nama,nim,prodi,gelar,nomor_ijazah,tanggal_lulus,email,file_pdf',
      'Siti Nurhaliza,231011400010,Teknik Informatika,S.Kom.,UNPAM/2026/0010,2026-08-30,siti@unpam.ac.id,siti.pdf',
      'Agus Pratama,231011400011,Sistem Informasi,S.Kom.,UNPAM/2026/0011,2026-08-30,alumni.uji@unpam.ac.id,agus.pdf',
      'Rina Salah,12ab,Teknik Informatika,S.Kom.,UNPAM/2026/0012,2026-08-30,rina@unpam.ac.id,rina.pdf',
    ].join('\n'),
  );
  await masukSebagai(page, 'Operator BAAK', '/op');
  await page.getByRole('link', { name: 'Unggah draf' }).click();
  await expect(page.locator('[data-siap]')).toBeAttached();
  await page.getByTestId('pilih-csv').setInputFiles(`${DATA}lulusan.csv`);
  await page.getByTestId('pilih-pdf').setInputFiles([`${DATA}siti.pdf`, `${DATA}agus.pdf`]);
  await expect(page.getByTestId('baris-draf')).toHaveCount(3);
  await expect(page.getByTestId('baris-draf').filter({ hasText: 'Baris 4' })).toContainText(/nim/i);
  await page.getByRole('button', { name: 'Kirim 2 ke Meja Rektor' }).click();
  await expect(kabar(page)).toHaveText('2 draf terkirim ke Meja Rektor');
  await expect(page.getByTestId('baris-draf').filter({ hasText: '↑ Terkirim ke Meja Rektor' })).toHaveCount(2);
});

test('operator tidak bisa membuka meja tanda tangan', async ({ page }) => {
  await masukSebagai(page, 'Operator BAAK', '/op');
  await page.goto('/meja/');
  await expect(page.getByRole('heading', { name: 'Halaman ini untuk pejabat penanda tangan' })).toBeVisible();
});

let ditolak = '';

test('Rektor menolak satu draf dan menandatangani yang lain', async ({ page }) => {
  await masukSebagai(page, 'Rektor', '/meja');
  const nama = page.getByTestId('nama-meja');
  await expect(nama).toBeVisible();
  ditolak = (await nama.textContent()) ?? '';
  await page.getByRole('button', { name: /^Tolak/ }).click();
  await page.getByRole('textbox').fill('Nama ibu kandung salah');
  await page.getByRole('button', { name: 'Kirim penolakan' }).click();
  await expect(kabar(page)).toHaveText(`${ditolak} dikembalikan ke operator`);
  await expect(nama).not.toHaveText(ditolak);
  await page.getByRole('button', { name: /^Tanda tangani/ }).click();
  await expect(page.getByTestId('meja-bersih')).toBeVisible();
});

test('operator memperbaiki draf yang ditolak, Rektor menandatanganinya', async ({ page, browser }) => {
  await masukSebagai(page, 'Operator BAAK', '/op');
  await page.getByRole('button', { name: 'Ditolak', exact: true }).click();
  await page.getByRole('option', { name: new RegExp(ditolak) }).click();
  await page.getByRole('button', { name: /Perbaiki dan kirim ulang/ }).click();
  await expect(page).toHaveURL(/\/op\/unggah\/?\?ulang=/);
  await expect(page.locator('input[name=nama]')).toHaveValue(ditolak);
  const pdf = ditolak.startsWith('Siti') ? 'siti' : 'agus';
  writeFileSync(`${DATA}${pdf}-perbaikan.pdf`, buatPdf(['IJAZAH', ditolak, 'perbaikan']));
  await page.getByTestId('pilih-pdf-satu').setInputFiles(`${DATA}${pdf}-perbaikan.pdf`);
  await page.getByRole('button', { name: /Kirim ulang ke Meja Rektor/ }).click();
  await expect(kabar(page)).toHaveText('Draf diperbaiki dan dikirim ulang ke Meja Rektor');

  const rektor = await (await browser.newContext()).newPage();
  await masukSebagai(rektor, 'Rektor', '/meja');
  await expect(rektor.getByTestId('nama-meja')).toHaveText(ditolak);
  await rektor.keyboard.press('Enter');
  await expect(rektor.getByTestId('meja-bersih')).toBeVisible();
});

test('operator mencatat dua ijazah ke blockchain dalam satu transaksi', async ({ page }) => {
  await masukSebagai(page, 'Operator BAAK', '/op');
  await page.getByRole('button', { name: 'Siap', exact: true }).click();
  await expect(page.getByRole('option')).toHaveCount(2);
  await page.getByRole('button', { name: /Catat 2 ijazah ke blockchain/ }).click();
  await expect(kabar(page)).toHaveText('2 ijazah tercatat di blockchain');
  await page.getByRole('button', { name: 'Tercatat', exact: true }).click();
  await expect(page.getByRole('option')).toHaveCount(2);
});

let tautanSiti = '';

test('lembar QR membawa tautan berkunci yang membuka ijazah', async ({ page }) => {
  await masukSebagai(page, 'Operator BAAK', '/op');
  await page.getByRole('button', { name: 'Tercatat', exact: true }).click();
  await page.getByRole('option', { name: /Siti Nurhaliza/ }).click();
  await page.keyboard.press('Control+k');
  await page.getByRole('menuitem', { name: 'Lembar QR' }).click();
  await expect(page.getByTestId('qr').locator('svg')).toBeVisible();
  tautanSiti = (await page.getByTestId('tautan-qr').textContent()) ?? '';
  expect(tautanSiti).toMatch(/\/i\/\d+#k=[A-Za-z0-9_-]{43}$/);
  await page.goto(tautanSiti);
  await expect(page.getByTestId('nama')).toHaveText('Siti Nurhaliza');
  await expect(page.getByText('↑ Cocok 100%')).toBeVisible();
});

test('pencabutan: operator meminta, Rektor menandatangani, operator mengirim ke blockchain', async ({ page, browser }) => {
  await masukSebagai(page, 'Operator BAAK', '/op');
  await page.getByRole('button', { name: 'Tercatat', exact: true }).click();
  await page.getByRole('option', { name: /Siti Nurhaliza/ }).click();
  await page.getByRole('button', { name: /^Aksi/ }).click();
  await page.getByRole('menuitem', { name: 'Cabut ijazah…' }).click();
  await page.getByRole('textbox', { name: /Alasan pencabutan/ }).fill('Data kelulusan dibatalkan senat');
  await page.getByRole('button', { name: 'Minta pencabutan' }).click();
  await expect(kabar(page)).toHaveText('Permintaan cabut dikirim ke Meja Rektor');

  const rektor = await (await browser.newContext()).newPage();
  await masukSebagai(rektor, 'Rektor', '/meja');
  await rektor.getByRole('button', { name: /^Pencabutan/ }).click();
  await rektor.getByRole('button', { name: 'Tanda tangani pencabutan' }).click();
  await expect(rektor.getByTestId('kabar')).toHaveText(/Pencabutan ijazah #\d+ ditandatangani/);

  await page.getByRole('link', { name: 'Pencabutan' }).click();
  await page.getByRole('button', { name: 'Kirim pencabutan ke blockchain' }).click();
  await expect(kabar(page)).toHaveText(/Ijazah #\d+ dicabut/);
  await page.goto(tautanSiti);
  await expect(page.getByTestId('status')).toHaveText('↓ Dicabut');
});
