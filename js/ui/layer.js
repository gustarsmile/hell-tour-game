// 疊層關閉的共用管理：Esc 與系統返回鍵，後開先關（LIFO）。
// 本模組只管「何時該關」，不碰任何疊層的 DOM——各疊層以 onClose 回呼自理。
//
// 歷程策略：只要堆疊非空就「恰好」持有一筆 history 紀錄，不是每層各推一筆。
// 原因（2026-07-28 真實瀏覽器實測）：nav.js 的 menuAction 是 close(); fn(); 同步連續執行，
// 若關閉時立刻 back()、緊接著 fn() 又 pushState，兩者會在途中交錯——瀏覽器的 back()
// 解析為「回到呼叫當下那一筆」的絕對位置而非相對退一步，導致歷程位置比內部帳目少一格，
// 下一次關閉再 back() 就多退一步，整個離開遊戲跳到 about:blank。
// 改以 microtask 對帳後，同一輪內關舊層又開新層時根本不會呼叫 back()，交錯不復存在。
const stack = [];
let held = false;      // 目前是否持有那筆歷程紀錄
let consuming = false; // 已呼叫 back()，正在等自己的 popstate 回音
let boundDoc = null;

function dismiss(layer) {
  const i = stack.indexOf(layer);
  if (i === -1) return false; // 已關閉，冪等
  stack.splice(i, 1);
  layer.onClose();
  return true;
}

function onKeydown(e) {
  if (e.key !== 'Escape' || !stack.length) return;
  e.preventDefault();
  stack[stack.length - 1].close();
}

function pushEntry(win) {
  try {
    win.history.pushState({ layer: true }, '');
    held = true;
  } catch {
    held = false; // file:// 直開時 pushState 會丟 SecurityError，降級為僅點擊／Esc 可關
  }
}

// popstate 有兩種來源：使用者按返回鍵，或我方 back() 的回音。
function onPopstate() {
  const win = boundDoc.defaultView;
  if (consuming) {
    consuming = false;
    // 回音在途期間若又開了新層，補推一筆，讓返回鍵仍能關閉它
    if (stack.length && !held) pushEntry(win);
    return;
  }
  held = false; // 瀏覽器已替我們退掉那筆
  if (!stack.length) return;
  dismiss(stack[stack.length - 1]);
  // 若下層仍開著，補推一筆讓返回鍵也能逐層關掉。本 app 目前無巢狀，
  // 但 artImg() 會自動為圖片掛上大圖疊層，日後只要有人在選單或善書冊裡放一張圖
  // 就會出現巢狀；少了這行，第二次按返回鍵會直接退出遊戲。
  // !held 與上面 consuming 分支對稱：若某層的 onClose 同步開了新層，該層已自行推過一筆，
  // 這裡再推就會讓同一個非空堆疊持有兩筆，返回鍵得按兩次。
  if (stack.length && !held) pushEntry(win);
}

// 對帳延到 microtask 執行：close(); fn(); 這種同一輪內關舊層又開新層的路徑，
// 對帳時堆疊已非空，就保留原本那筆歷程、不呼叫 back()
function reconcile(win) {
  if (stack.length) return;
  if (!held) return;
  held = false;
  consuming = true;
  win.history.back();
}

function unbind() {
  if (!boundDoc) return;
  boundDoc.removeEventListener('keydown', onKeydown);
  boundDoc.defaultView.removeEventListener('popstate', onPopstate);
  boundDoc = null;
}

function ensureBound(doc) {
  if (boundDoc === doc) return;
  unbind();
  boundDoc = doc;
  doc.addEventListener('keydown', onKeydown);
  doc.defaultView.addEventListener('popstate', onPopstate);
}

export function pushLayer(onClose, doc = document) {
  ensureBound(doc);
  const win = doc.defaultView;
  const layer = { onClose };
  layer.close = () => {
    if (!dismiss(layer)) return; // 已關閉則不重複對帳
    Promise.resolve().then(() => reconcile(win));
  };
  stack.push(layer);
  // 已持有紀錄、或正在等回音，都不重複推——回音抵達時 onPopstate 會補推
  if (!held && !consuming) pushEntry(win);
  return layer;
}

// 以下兩者僅供測試使用（模組狀態在同一測試檔內跨案例殘留），正式流程不呼叫。
export function layerDepth() {
  return stack.length;
}

export function resetLayers() {
  stack.length = 0;
  held = false;
  consuming = false;
  unbind();
}
