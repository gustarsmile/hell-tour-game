// 疊層關閉的共用管理：Esc 與系統返回鍵，後開先關（LIFO）。
// 本模組只管「何時該關」，不碰任何疊層的 DOM——各疊層以 onClose 回呼自理。
const stack = [];
let pendingBacks = 0; // 我方呼叫 history.back() 的筆數，用來辨識 popstate 來源
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

// popstate 有兩種來源：使用者按返回鍵，或我方 close() 呼叫 back() 的回音。
// 後者必須忽略——否則「關選單、同一輪立刻開善書冊」會把善書冊關掉。
function onPopstate() {
  if (pendingBacks > 0) {
    pendingBacks -= 1;
    return;
  }
  if (stack.length) dismiss(stack[stack.length - 1]);
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
  const layer = { onClose, pushed: false };
  layer.close = () => {
    if (!dismiss(layer)) return; // 已關閉則不重複消耗歷程
    if (!layer.pushed) return;
    pendingBacks += 1;
    doc.defaultView.history.back();
  };
  try {
    doc.defaultView.history.pushState({ layer: true }, '');
    layer.pushed = true;
  } catch {
    layer.pushed = false; // file:// 直開時 pushState 會丟 SecurityError，降級為僅點擊／Esc 可關
  }
  stack.push(layer);
  return layer;
}

// 以下兩者僅供測試使用（模組狀態在同一測試檔內跨案例殘留），正式流程不呼叫。
export function layerDepth() {
  return stack.length;
}

export function resetLayers() {
  stack.length = 0;
  pendingBacks = 0;
  unbind();
}
