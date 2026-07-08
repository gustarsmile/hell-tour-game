import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

describe('index.html 頁首', () => {
  const html = readFileSync('index.html', 'utf8');
  it('favicon 連結存在且檔案存在', () => {
    expect(html).toMatch(/rel="icon"[^>]*href="assets\/favicon\.svg"/);
    expect(existsSync('assets/favicon.svg')).toBe(true);
  });
  it('有 meta description 與 theme-color', () => {
    expect(html).toMatch(/name="description"/);
    expect(html).toMatch(/name="theme-color" content="#17130f"/);
  });
});
