import { el } from './render.js';
import { pushLayer } from './layer.js';

// 頂欄導覽：左上「返回上一頁」與「遊歷選單」，全程常駐（音效鈕在右上，由 main.js 掛載）
export function createNav(doc = document) {
  let onBack = null;
  let menu = null; // { modeLabel, entries, onJump, onBooklet, onSave, onCover }

  const bar = el('div');
  bar.id = 'nav-bar';
  const backBtn = el('button', 'nav-btn', '◂');
  backBtn.setAttribute('aria-label', '返回上一頁');
  backBtn.title = '返回上一頁';
  backBtn.disabled = true;
  const menuBtn = el('button', 'nav-btn', '☰');
  menuBtn.setAttribute('aria-label', '遊歷選單');
  menuBtn.title = '遊歷選單';
  menuBtn.disabled = true;
  bar.appendChild(backBtn);
  bar.appendChild(menuBtn);

  const overlay = el('div');
  overlay.id = 'nav-overlay';
  const panel = el('div');
  panel.id = 'nav-menu';
  overlay.appendChild(panel);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  backBtn.addEventListener('click', () => onBack?.());
  menuBtn.addEventListener('click', () => (overlay.classList.contains('open') ? close() : open()));

  let layer = null;

  function close() {
    layer?.close();
    layer = null;
  }

  function open() {
    renderPanel();
    overlay.classList.add('open');
    layer = pushLayer(() => {
      overlay.classList.remove('open');
      layer = null;
    }, doc);
  }

  function menuAction(label, fn, cls = 'menu-action') {
    const btn = el('button', `btn ${cls}`, label);
    // close(); fn(); 必須維持同步連續執行，中間不得插入 await 或 setTimeout。
    // layer.js 的歷程對帳排在 microtask：同一輪內關掉選單又開新疊層時，對帳會看到
    // 堆疊非空而不呼叫 history.back()，兩者沿用同一筆歷程紀錄。若這兩句被拆成非同步，
    // 對帳就落在縫隙裡先 back() 了，新疊層隨後 pushState 便與 back() 在途交錯，
    // 歷程位置比帳目少一格，下次關閉會多退一步而整個離開遊戲（2026-07-28 實測過的缺陷）。
    btn.addEventListener('click', () => { close(); fn(); });
    return btn;
  }

  function renderPanel() {
    panel.innerHTML = '';
    const head = el('div', 'menu-head');
    head.appendChild(el('div', 'menu-title', '遊 歷 選 單'));
    if (menu.modeLabel) head.appendChild(el('span', 'menu-mode', menu.modeLabel));
    const x = el('button', 'menu-close', '✕');
    x.setAttribute('aria-label', '關閉選單');
    x.addEventListener('click', close);
    head.appendChild(x);
    panel.appendChild(head);

    if (menu.entries?.length) {
      panel.appendChild(el('div', 'menu-section', '直達各殿'));
      panel.appendChild(el('p', 'menu-hint', '直達會從該殿開頭遊歷，該殿得分重新計算。'));
      const list = el('div', 'menu-halls');
      for (const entry of menu.entries) {
        const btn = el('button', `btn menu-hall${entry.current ? ' current' : ''}`);
        btn.appendChild(el('strong', 'menu-hall-title', entry.title));
        if (entry.desc) btn.appendChild(el('span', 'menu-hall-desc', entry.desc));
        btn.addEventListener('click', () => { close(); menu.onJump(entry.id); });
        list.appendChild(btn);
      }
      panel.appendChild(list);
    }

    panel.appendChild(el('div', 'menu-section', '其他'));
    if (menu.onBooklet) panel.appendChild(menuAction('翻閱善書冊（已存因果卡）', menu.onBooklet));
    if (menu.onSave) {
      panel.appendChild(menuAction('儲存進度（存於此瀏覽器）', () => {
        menu.onSave();
        toast('進度已儲存於此瀏覽器');
      }));
    }
    panel.appendChild(menuAction('返回前一頁', () => onBack?.()));
    if (menu.onCover) panel.appendChild(menuAction('回到入口封面', menu.onCover));
  }

  let toastTimer = null;
  function toast(msg) {
    let box = doc.getElementById('nav-toast');
    if (!box) {
      box = el('div');
      box.id = 'nav-toast';
      doc.body.appendChild(box);
    }
    box.textContent = msg;
    box.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove('show'), 2200);
  }

  doc.body.appendChild(bar);
  doc.body.appendChild(overlay);

  return {
    setBack(fn) { onBack = fn; backBtn.disabled = !fn; },
    setMenu(cfg) { menu = cfg; menuBtn.disabled = !cfg; },
    closeMenu: close,
    toast,
  };
}

export const NOOP_NAV = { setBack() {}, setMenu() {}, closeMenu() {}, toast() {} };
