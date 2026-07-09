// 美術預載：開場後在背景把整趟旅程的插圖逐張拉進快取，
// 之後每一殿換頁時圖片即刻顯示，不再「文字先出、圖片後跳」。

export function collectArtFiles(value, out = new Set()) {
  if (typeof value === 'string') {
    if (value.endsWith('.webp')) out.add(value);
  } else if (Array.isArray(value)) {
    value.forEach((v) => collectArtFiles(v, out));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((v) => collectArtFiles(v, out));
  }
  return out;
}

// 逐張串行載入，不與當前畫面搶頻寬；失敗照樣往下走
export function preloadArt(files, doc = globalThis.document) {
  if (!doc) return Promise.resolve();
  return [...files].reduce(
    (chain, file) =>
      chain.then(
        () =>
          new Promise((resolve) => {
            const img = doc.createElement('img');
            img.onload = resolve;
            img.onerror = resolve;
            img.src = `assets/art/${file}`;
          }),
      ),
    Promise.resolve(),
  );
}
