/** コンサル風 HTML レポートのプレビュー・ダウンロード用ユーティリティ */

const hasDoctype = (html: string): boolean =>
  /<!DOCTYPE\s+html/i.test(html.trimStart());

const hasCharsetMeta = (html: string): boolean =>
  /<meta[^>]+charset/i.test(html);

export const normalizeHtmlDocumentForPreview = (html: string): string => {
  const trimmed = html.trim();
  if (!trimmed) return trimmed;

  let doc = trimmed;
  if (!hasDoctype(doc)) {
    doc = `<!DOCTYPE html>\n${doc}`;
  }
  if (!hasCharsetMeta(doc) && /<head[\s>]/i.test(doc)) {
    doc = doc.replace(
      /<head([^>]*)>/i,
      '<head$1>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">'
    );
  } else if (!/<html[\s>]/i.test(doc)) {
    doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${doc}</body></html>`;
  }
  return doc;
};

export const sanitizeHtmlFilename = (title: string | undefined): string => {
  const base = (title?.trim() || "report")
    .replace(/[^\w\u3040-\u30ff\u4e00-\u9fff\-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
  return base.endsWith(".html") ? base : `${base}.html`;
};

export const openHtmlDocumentInNewTab = (params: {
  html: string;
  title?: string;
}): void => {
  const blob = new Blob([normalizeHtmlDocumentForPreview(params.html)], {
    type: "text/html;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

export const downloadHtmlDocument = (params: {
  html: string;
  title?: string;
}): void => {
  const blob = new Blob([normalizeHtmlDocumentForPreview(params.html)], {
    type: "text/html;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = sanitizeHtmlFilename(params.title);
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
};
