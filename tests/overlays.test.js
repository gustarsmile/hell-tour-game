// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createNav } from '../js/ui/nav.js';
import { startGame } from '../js/flow.js';
import { layerDepth, resetLayers } from '../js/ui/layer.js';

const modules = import.meta.glob('../js/data/*.json', { eager: true });
const FILES = {};
for (const [path, mod] of Object.entries(modules)) {
  FILES[path.replace('../js/', 'js/')] = mod.default;
}
const loadJSON = async (p) => structuredClone(FILES[p]);

function fakeStorage() {
  const data = {};
  return {
    setItem: (k, v) => { data[k] = String(v); },
    getItem: (k) => (k in data ? data[k] : null),
    removeItem: (k) => { delete data[k]; },
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

// happy-dom 的 history.back() 不會觸發 popstate（實測），以 stub 模擬瀏覽器
beforeEach(() => {
  resetLayers();
  vi.spyOn(window.history, 'back').mockImplementation(() => {
    setTimeout(() => window.dispatchEvent(new window.PopStateEvent('popstate', { state: null })), 0);
  });
});

afterEach(async () => {
  resetLayers();
  await flush();
  vi.restoreAllMocks();
  cleanupStage();
});

// 只清掉本檔製造的節點，不用 body.innerHTML = ''
function cleanupStage() {
  document.querySelectorAll('#nav-bar, #nav-overlay, #booklet-overlay, .test-root')
    .forEach((n) => n.remove());
}

function esc() {
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

const menuOpen = () => !!document.querySelector('#nav-overlay')?.classList.contains('open');
const bookletOpen = () => !!document.querySelector('#booklet-overlay');

function mountNav(menuCfg = {}) {
  // 只清 nav，不動 .test-root——端到端案例需要 bootFlow 建立的遊戲狀態仍在
  document.querySelectorAll('#nav-bar, #nav-overlay').forEach((n) => n.remove());
  const nav = createNav(document);
  nav.setMenu({ modeLabel: '完整遊歷', entries: [], onJump: () => {}, ...menuCfg });
  document.querySelectorAll('.nav-btn')[1].click(); // ☰ 開啟選單
  return nav;
}

// 以假 nav 攔下 setMenu 設定，取得 onBooklet，無須深度驅動遊戲。
// startGame 已在內部載完所有資料，故點擊後的畫面切換為同步（見 tests/flow.test.js 的 autoplay）
async function bootFlow() {
  cleanupStage();
  const root = document.createElement('div');
  root.className = 'test-root';
  document.body.appendChild(root);
  let cfg = null;
  const nav = { setBack() {}, closeMenu() {}, toast() {}, setMenu(c) { if (c) cfg = c; } };
  await startGame({ root, loadJSON, storage: fakeStorage(), nav });
  root.querySelector('.btn-next').click(); // 封面「完整遊歷」
  expect(cfg).toBeTruthy();
  return cfg;
}

describe('漢堡選單接入 layer', () => {
  it('Esc 可關閉選單', () => {
    mountNav();
    expect(menuOpen()).toBe(true);
    esc();
    expect(menuOpen()).toBe(false);
  });

  it('popstate 可關閉選單', () => {
    mountNav();
    window.dispatchEvent(new window.PopStateEvent('popstate', { state: null }));
    expect(menuOpen()).toBe(false);
  });

  it('點背景仍可關閉選單（不回歸）', () => {
    mountNav();
    document.querySelector('#nav-overlay').click();
    expect(menuOpen()).toBe(false);
  });

  it('再按一次 ☰ 仍可關閉（不回歸）', () => {
    mountNav();
    document.querySelectorAll('.nav-btn')[1].click();
    expect(menuOpen()).toBe(false);
  });
});

describe('善書冊接入 layer', () => {
  it('Esc 可關閉善書冊', async () => {
    const cfg = await bootFlow();
    cfg.onBooklet();
    expect(bookletOpen()).toBe(true);
    esc();
    expect(bookletOpen()).toBe(false);
  });

  it('popstate 可關閉善書冊', async () => {
    const cfg = await bootFlow();
    cfg.onBooklet();
    window.dispatchEvent(new window.PopStateEvent('popstate', { state: null }));
    expect(bookletOpen()).toBe(false);
  });

  it('「合上善書冊 ▸」仍可關閉（不回歸）', async () => {
    const cfg = await bootFlow();
    cfg.onBooklet();
    const btns = [...document.querySelectorAll('#booklet-overlay button')];
    btns[btns.length - 1].click();
    expect(bookletOpen()).toBe(false);
  });

  it('經選單開啟善書冊後仍在畫面上（pendingBacks 端到端）', async () => {
    const cfg = await bootFlow();
    // 重現 nav.js 的 menuAction：close(); fn(); ——關選單與開善書冊在同一輪同步發生
    mountNav({ onBooklet: cfg.onBooklet });
    const action = [...document.querySelectorAll('#nav-menu .menu-action')]
      .find((b) => b.textContent.includes('善書冊'));
    action.click();
    expect(bookletOpen()).toBe(true);
    await flush();
    await flush();
    expect(bookletOpen()).toBe(true); // 關選單那次 back() 的回音不得關掉善書冊
  });

  it('單層不變式：堆疊深度不超過 1', async () => {
    const cfg = await bootFlow();
    cfg.onBooklet();
    expect(layerDepth()).toBeLessThanOrEqual(1);
  });
});
