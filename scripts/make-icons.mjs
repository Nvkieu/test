#!/usr/bin/env node
/**
 * Sinh các file PNG icon từ icons/icon.svg.
 *
 * Chỉ cần chạy lại khi đổi thiết kế icon — các file PNG đã được commit sẵn
 * nên người dùng bình thường không phải chạy script này.
 *
 *   npm i -D playwright && node scripts/make-icons.mjs
 *
 * Nếu máy đã có sẵn Chromium ở chỗ khác:
 *   CHROME_PATH=/usr/bin/chromium node scripts/make-icons.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(ROOT, 'icons', 'icon.svg'), 'utf8');

// maskable: Android cắt icon theo nhiều hình dạng khác nhau, nên nội dung phải
// nằm gọn trong 80% ở giữa ("safe zone"). Ta thu nhỏ icon gốc và trải nền ra mép.
const inner = svg
  .replace(/^[\s\S]*?<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')
  // Bỏ nền bo góc của icon gốc — nếu giữ lại, sau khi thu nhỏ nó hiện ra thành
  // một hình vuông bo góc lồng bên trong, trông như icon bị đóng khung hai lớp.
  .replace(/<rect[^>]*rx="112"[^>]*\/>/, '');

const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="mbg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6366f1"/>
      <stop offset="1" stop-color="#4338ca"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#mbg)"/>
  <g transform="translate(76.8 76.8) scale(0.7)">${inner}</g>
</svg>`;

const TARGETS = [
  { file: 'icon-192.png', size: 192, source: svg },
  { file: 'icon-512.png', size: 512, source: svg },
  { file: 'icon-maskable-512.png', size: 512, source: maskable },
  // iOS không hỗ trợ maskable và không bo góc icon trong suốt → dùng bản vuông đặc.
  { file: 'apple-touch-icon.png', size: 180, source: svg },
];

const { chromium } = await import('playwright');
const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
);

mkdirSync(join(ROOT, 'icons'), { recursive: true });

for (const { file, size, source } of TARGETS) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<style>html,body{margin:0;padding:0;background:transparent}
     svg{display:block;width:${size}px;height:${size}px}</style>${source}`,
    { waitUntil: 'load' },
  );
  const png = await page.screenshot({ omitBackground: true });
  writeFileSync(join(ROOT, 'icons', file), png);
  await page.close();
  console.log(`✓ icons/${file} (${size}×${size}, ${(png.length / 1024).toFixed(1)} KB)`);
}

await browser.close();
