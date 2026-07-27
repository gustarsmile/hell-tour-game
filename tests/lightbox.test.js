// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { enableLightbox } from '../js/ui/lightbox.js';
import { artImg } from '../js/ui/render.js';
import { renderCover } from '../js/ui/coverView.js';
import { resetLayers } from '../js/ui/layer.js';

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  resetLayers();
  vi.spyOn(window.history, 'back').mockImplementation(() => {
    setTimeout(() => window.dispatchEvent(new window.PopStateEvent('popstate', { state: null })), 0);
  });
});

afterEach(async () => {
  document.querySelector('#lightbox')?.classList.remove('open');
  resetLayers();
  await flush();
  vi.restoreAllMocks();
});

const lb = () => document.querySelector('#lightbox');
const isOpen = () => !!lb()?.classList.contains('open');
function esc() {
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

describe('lightbox.js', () => {
  it('artImg 產出的圖帶有 zoomable class', () => {
    expect(artImg('hall1-scene.webp').className).toContain('zoomable');
  });

  it('點圖開啟疊層，大圖 src 與原圖相同', () => {
    const img = artImg('hall1-scene.webp');
    img.click();
    expect(isOpen()).toBe(true);
    expect(lb().querySelector('.lightbox-img').src).toBe(img.src);
  });

  it('點疊層背景可關閉', () => {
    artImg('hall1-scene.webp').click();
    lb().click();
    expect(isOpen()).toBe(false);
  });

  it('點大圖本身可關閉', () => {
    artImg('hall1-scene.webp').click();
    lb().querySelector('.lightbox-img').click();
    expect(isOpen()).toBe(false);
  });

  it('✕ 鈕可關閉', () => {
    artImg('hall1-scene.webp').click();
    lb().querySelector('.lightbox-close').click();
    expect(isOpen()).toBe(false);
  });

  it('Esc 可關閉', () => {
    artImg('hall1-scene.webp').click();
    esc();
    expect(isOpen()).toBe(false);
  });

  it('popstate 可關閉', () => {
    artImg('hall1-scene.webp').click();
    window.dispatchEvent(new window.PopStateEvent('popstate', { state: null }));
    expect(isOpen()).toBe(false);
  });

  it('關閉後再開不會產生第二個疊層', async () => {
    artImg('hall1-scene.webp').click();
    lb().click();
    await flush();
    artImg('hall2-scene.webp').click();
    expect(document.querySelectorAll('#lightbox').length).toBe(1);
    expect(isOpen()).toBe(true);
  });

  it('開啟鎖背景捲動、關閉還原原值', () => {
    document.body.style.overflow = 'scroll';
    const img = artImg('hall1-scene.webp');
    img.click();
    expect(document.body.style.overflow).toBe('hidden');
    lb().click();
    expect(document.body.style.overflow).toBe('scroll');
    document.body.style.overflow = '';
  });

  it('封面圖可放大', () => {
    const root = document.createElement('div');
    renderCover(
      { resumable: false, modes: { full: { label: 'a', desc: 'b' }, lite: { label: 'c', desc: 'd' } } },
      { onStart: () => {}, onResume: () => {} },
      root,
    );
    const cover = root.querySelector('.cover-art');
    expect(cover.className).toContain('zoomable');
    cover.click();
    expect(isOpen()).toBe(true);
    expect(lb().querySelector('.lightbox-img').src).toBe(cover.src);
  });

  it('enableLightbox 於點擊當下讀取 src（fallback 換圖後仍正確）', () => {
    const img = document.createElement('img');
    img.src = 'assets/art/a.webp';
    enableLightbox(img);
    img.src = 'assets/art/b.webp'; // 模擬 error fallback 換圖
    img.click();
    expect(lb().querySelector('.lightbox-img').src).toBe(img.src);
  });
});
