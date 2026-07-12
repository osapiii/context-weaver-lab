import markdownit from "markdown-it";
import hljs from "highlight.js";
import markdownItTaskLists from "markdown-it-task-lists";
import markdownItSub from "markdown-it-sub";
import markdownItSup from "markdown-it-sup";
import markdownItMark from "markdown-it-mark";
import markdownItDeflist from "markdown-it-deflist";

/**
 * EN AIstudio 共通 markdown-it インスタンス.
 *
 * 設計原則:
 *  - ここで生成した HTML はすべて `<div class="en-aistudio-prose ...">` で囲まれて
 *    描画される (EnMarkdown.vue ラッパ経由). スタイルは
 *    `app/assets/css/en-aistudio-prose.css` のグローバル class で当てる.
 *  - リンクは 3 種類の振る舞いを区別:
 *      - `route:xxx`     → SPA 内ルート遷移 (href="#" + data-router-route)
 *      - `launcher:xxx`  → モーダル / パネル起動 (href="#" + data-router-launcher)
 *      - 通常 http(s)    → 別タブ表示
 *  - 拡張 (task-lists / sub / sup / mark / deflist) は全て enable.
 *  - コードブロックは highlight.js でシンタックスハイライト.
 *
 * 旧 `useMarkdownRouterRenderer` を吸収し、AI チャット系・ヘルプ・各種
 * ドキュメントプレビューで使われていた複数の markdown-it 実装を 1 本化した.
 */

const ROUTE_PREFIX = "route:";
const LAUNCHER_PREFIX = "launcher:";

/** AI がナビコンテキストの `behavior:modal launcher:xxx` をそのままコピーしたリンクを正規化 */
export const normalizeRouterLinksInMarkdown = (
  markdownText: string
): string =>
  markdownText.replace(
    /\[([^\]]*)\]\(([^)]+)\)/g,
    (full, label: string, href: string) => {
      const trimmedHref = href.trim();
      if (/^https?:\/\//i.test(trimmedHref)) return full;
      if (
        trimmedHref.startsWith(LAUNCHER_PREFIX) ||
        trimmedHref.startsWith(ROUTE_PREFIX)
      ) {
        return full;
      }
      const launcher = trimmedHref.match(/launcher:([a-z-]+)/i);
      if (launcher?.[1]) {
        return `[${label}](${LAUNCHER_PREFIX}${launcher[1]})`;
      }
      const route = trimmedHref.match(/route:([a-zA-Z0-9-_]+)/);
      if (route?.[1]) {
        return `[${label}](${ROUTE_PREFIX}${route[1]})`;
      }
      return full;
    }
  );

const md = markdownit({
  breaks: true,
  html: true,
  linkify: true,
  typographer: true,
  highlight: (str: string, lang: string) => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        const highlighted = hljs.highlight(str, { language: lang }).value;
        return `<pre class="hljs"><code class="language-${lang}">${highlighted}</code></pre>`;
      } catch {
        // フォールスルー
      }
    }
    const escaped = md.utils.escapeHtml(str);
    return `<pre class="hljs"><code>${escaped}</code></pre>`;
  },
})
  .use(markdownItTaskLists, { enabled: true, label: true })
  .use(markdownItSub)
  .use(markdownItSup)
  .use(markdownItMark)
  .use(markdownItDeflist);

// link_open を上書き: route:/launcher:/外部リンクを識別
const defaultLinkOpen =
  md.renderer.rules.link_open ??
  ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]!;
  const hrefIndex = token.attrIndex("href");
  const href = hrefIndex >= 0 ? token.attrs![hrefIndex]![1] : "";

  if (href.startsWith(ROUTE_PREFIX)) {
    const routeName = href.slice(ROUTE_PREFIX.length);
    token.attrSet("href", "#");
    token.attrSet("data-router-route", routeName);
    token.attrSet("class", "en-aistudio-router-link en-aistudio-router-link--route");
  } else if (href.startsWith(LAUNCHER_PREFIX)) {
    const launcherKey = href.slice(LAUNCHER_PREFIX.length);
    token.attrSet("href", "#");
    token.attrSet("data-router-launcher", launcherKey);
    token.attrSet("class", "en-aistudio-router-link en-aistudio-router-link--launcher");
  } else if (/^https?:\/\//i.test(href)) {
    token.attrSet("target", "_blank");
    token.attrSet("rel", "noopener noreferrer");
  }
  return defaultLinkOpen(tokens, idx, options, env, self);
};

/** AI が出力する制御コメント (UI に出さない指示マーカー) を除去 */
const stripDirectives = (markdownText: string): string =>
  markdownText.replace(/<!--\s*autoNav:[^>]*?-->/g, "");

/**
 * Markdown テキストを HTML 文字列に変換.
 * `<div class="en-aistudio-prose">` でラップして利用すること (EnMarkdown.vue 推奨).
 */
export const convertMarkdownToHtml = (markdownText: string): string => {
  if (!markdownText) return "";
  const normalized = normalizeRouterLinksInMarkdown(stripDirectives(markdownText));
  return md.render(normalized);
};

const extractHtmlCells = (html: string, tagName: "th" | "td"): string[] => {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "gi");
  return Array.from(html.matchAll(pattern), (match) => match[1]?.trim() ?? "");
};

const stripHtml = (html: string): string =>
  html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();

export const convertHelpTablesToCards = (html: string): string =>
  html.replace(/<table>([\s\S]*?)<\/table>/gi, (tableHtml) => {
    const headers = extractHtmlCells(
      tableHtml.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i)?.[1] ?? "",
      "th"
    );
    const body = tableHtml.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i)?.[1] ?? "";
    const rows = Array.from(
      body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi),
      (match) => extractHtmlCells(match[1] ?? "", "td")
    ).filter((cells) => cells.length > 0);

    if (!headers.length || !rows.length) return tableHtml;

    const cards = rows
      .map((cells) => {
        const title = cells[0] ?? "";
        const details = cells
          .slice(1)
          .map((cell, index) => {
            const label = headers[index + 1] ?? "";
            if (!stripHtml(cell)) return "";
            return [
              '<div class="en-aistudio-help-table-card__field">',
              label
                ? `<div class="en-aistudio-help-table-card__label">${label}</div>`
                : "",
              `<div class="en-aistudio-help-table-card__value">${cell}</div>`,
              "</div>",
            ].join("");
          })
          .join("");

        return [
          '<section class="en-aistudio-help-table-card">',
          `<div class="en-aistudio-help-table-card__title">${title}</div>`,
          `<div class="en-aistudio-help-table-card__details">${details}</div>`,
          "</section>",
        ].join("");
      })
      .join("");

    return `<div class="en-aistudio-help-table-card-list">${cards}</div>`;
  });

/** 共有 markdown-it インスタンスへの直接アクセス (拡張用; 通常は不要) */
export const enAiStudioMarkdownIt = md;
