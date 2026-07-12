/**
 * fetch-image.js
 * ============================
 * Web 画像を DL して decks/{slug}/assets/images/{hash}.{ext} に保存するユーティリティ。
 *
 * doc.references[].image.enabled=true 検出時の自動 DL に使う。
 *
 * 設計の核:
 *   - Node 標準 https / http のみ使用 (外部依存なし)
 *   - URL の SHA1 で命名 → 同じ URL は再 DL せずキャッシュ命中
 *   - Content-Type が image/* でなければ拒否
 *   - タイムアウト 15 秒、リトライ 1 回
 *   - 出典メタデータを decks/{slug}/assets/images/_sources.json に追記
 *
 * 失敗時はスローせず { ok: false, reason } を返す。呼び出し側は
 * fetch_status をスキーマに書き戻して plan.html に「✗ 取得失敗」を出す。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const FETCH_TIMEOUT_MS = 15000;
const MAX_RETRIES = 1;
const MAX_BYTES = 8 * 1024 * 1024;
const VALID_CONTENT_TYPE = /^image\/(jpeg|png|gif|webp|svg\+xml)/i;

const EXT_BY_CT = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/gif':  'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

function hashUrl(url) {
  return crypto.createHash('sha1').update(url).digest('hex').slice(0, 12);
}

function fetchOnce(url, redirectsLeft = 5) {
  return new Promise(resolve => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      return resolve({ ok: false, reason: `invalid URL: ${e.message}` });
    }

    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(url, {
      timeout: FETCH_TIMEOUT_MS,
      headers: {
        'User-Agent': 'enostech-slides/6.74 (image-fetcher; +https://enostech.co.jp)',
        'Accept': 'image/*',
      },
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (redirectsLeft <= 0) {
          return resolve({ ok: false, reason: 'too many redirects' });
        }
        const next = new URL(res.headers.location, url).toString();
        return fetchOnce(next, redirectsLeft - 1).then(resolve);
      }

      if (res.statusCode !== 200) {
        res.resume();
        return resolve({ ok: false, reason: `HTTP ${res.statusCode}` });
      }

      const ct = (res.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      if (!VALID_CONTENT_TYPE.test(ct)) {
        res.resume();
        return resolve({ ok: false, reason: `unsupported content-type: ${ct || '(none)'}` });
      }

      const chunks = [];
      let total = 0;
      res.on('data', chunk => {
        total += chunk.length;
        if (total > MAX_BYTES) {
          req.destroy();
          return resolve({ ok: false, reason: `image too large (>${MAX_BYTES} bytes)` });
        }
        chunks.push(chunk);
      });
      res.on('end', () => {
        resolve({
          ok: true,
          buffer: Buffer.concat(chunks),
          contentType: ct,
          finalUrl: url,
        });
      });
      res.on('error', err => resolve({ ok: false, reason: `stream error: ${err.message}` }));
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, reason: `timeout (${FETCH_TIMEOUT_MS}ms)` });
    });
    req.on('error', err => resolve({ ok: false, reason: `request error: ${err.message}` }));
  });
}

async function fetchAndCache(url, cacheDir, meta = {}) {
  if (!url || typeof url !== 'string') {
    return { ok: false, reason: 'empty URL' };
  }

  fs.mkdirSync(cacheDir, { recursive: true });

  const hash = hashUrl(url);

  const existing = fs.readdirSync(cacheDir).find(f => f.startsWith(hash + '.'));
  if (existing) {
    const localPath = path.join(cacheDir, existing);
    return {
      ok: true,
      local_path: localPath,
      content_type: 'image/' + path.extname(existing).slice(1),
      fetched_at: new Date(fs.statSync(localPath).mtimeMs).toISOString(),
      cached: true,
    };
  }

  let result = await fetchOnce(url);
  for (let i = 0; i < MAX_RETRIES && !result.ok; i++) {
    await new Promise(r => setTimeout(r, 500));
    result = await fetchOnce(url);
  }

  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }

  const ext = EXT_BY_CT[result.contentType] || 'bin';
  const filename = `${hash}.${ext}`;
  const localPath = path.join(cacheDir, filename);
  fs.writeFileSync(localPath, result.buffer);

  const sourcesPath = path.join(cacheDir, '_sources.json');
  let sources = [];
  if (fs.existsSync(sourcesPath)) {
    try { sources = JSON.parse(fs.readFileSync(sourcesPath, 'utf8')); }
    catch (_) { sources = []; }
  }
  const idx = sources.findIndex(s => s.source_url === url);
  const entry = Object.assign({
    source_url: url,
    final_url: result.finalUrl,
    local_file: filename,
    content_type: result.contentType,
    bytes: result.buffer.length,
    fetched_at: new Date().toISOString(),
  }, meta);
  if (idx >= 0) sources[idx] = entry;
  else sources.push(entry);
  fs.writeFileSync(sourcesPath, JSON.stringify(sources, null, 2));

  return {
    ok: true,
    local_path: localPath,
    content_type: result.contentType,
    fetched_at: entry.fetched_at,
    cached: false,
  };
}

// ────────────────────────────────────────────────────────
// v10.6.0 (2026-05-11): OG:image 抽出 (HTML ページからメタ画像 URL)
// ────────────────────────────────────────────────────────
//
// WEBPAGE-1 / WEBPAGE-2 のような article_url (記事 URL) は HTML ページなので、
// 直接 fetch-image にかけても content-type が image/* でなく fail します。
// 一旦 HTML を取得して `<meta property="og:image">` (Open Graph) や
// `<meta name="twitter:image">` を抽出し、その画像 URL を fetchAndCache に流します。
//
// 失敗時は { ok: false, reason } を返します (例外を投げない)。
// 呼び出し側で fetch_status を image_path 関連フィールドに反映してください。

const HTML_TIMEOUT_MS = 12000;
const HTML_MAX_BYTES = 2 * 1024 * 1024;

// v10.6.1: gzip / deflate / brotli の自動デコード必須。
//   yamahack.com 等の大型サイトは Accept-Encoding を明示しなくても CDN 側で
//   gzip 圧縮を返してくる。Node 標準 https は Content-Encoding を見ても
//   自動デコードしないため、生バイトを utf-8 として読むと「壊れた HTML 37KB」
//   として og:image 抽出が空振りする (osanai 氏指摘 2026-05-11、yamahack/329 で発覚)。
const zlib = require('zlib');

function fetchHtmlOnce(url, redirectsLeft = 5) {
  return new Promise(resolve => {
    let parsed;
    try { parsed = new URL(url); }
    catch (e) { return resolve({ ok: false, reason: `invalid URL: ${e.message}` }); }

    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(url, {
      timeout: HTML_TIMEOUT_MS,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; enostech-slides/10.6 OG-fetcher; +https://enostech.co.jp)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
      },
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
        const next = new URL(res.headers.location, url).toString();
        res.resume();
        return resolve(fetchHtmlOnce(next, redirectsLeft - 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return resolve({ ok: false, reason: `HTTP ${res.statusCode}` });
      }
      // v10.6.1: Content-Encoding を見てストリームをデコード
      let stream = res;
      const enc = (res.headers['content-encoding'] || '').toLowerCase();
      try {
        if (enc === 'gzip') stream = res.pipe(zlib.createGunzip());
        else if (enc === 'deflate') stream = res.pipe(zlib.createInflate());
        else if (enc === 'br') stream = res.pipe(zlib.createBrotliDecompress());
      } catch (e) {
        return resolve({ ok: false, reason: `decompress setup failed (${enc}): ${e.message}` });
      }

      const chunks = [];
      let total = 0;
      stream.on('data', d => {
        total += d.length;
        if (total > HTML_MAX_BYTES) {
          req.destroy();
          return resolve({ ok: false, reason: `HTML too large (${total} bytes)` });
        }
        chunks.push(d);
      });
      stream.on('end', () => {
        const html = Buffer.concat(chunks).toString('utf8');
        resolve({ ok: true, html, finalUrl: url });
      });
      stream.on('error', e => resolve({ ok: false, reason: `decompress error (${enc}): ${e.message}` }));
      res.on('error', e => resolve({ ok: false, reason: e.message }));
    });
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, reason: 'HTML timeout' }); });
    req.on('error', e => resolve({ ok: false, reason: e.message }));
  });
}

const OG_IMAGE_PATTERNS = [
  /<meta[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::url)?["']/i,
  /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
];

function extractOgImage(html, baseUrl) {
  for (const re of OG_IMAGE_PATTERNS) {
    const m = html.match(re);
    if (m && m[1]) {
      try { return new URL(m[1], baseUrl).toString(); }
      catch (_) { return m[1]; }
    }
  }
  return null;
}

/**
 * 記事 URL (HTML ページ) から OG image URL を抽出して fetchAndCache に流す。
 *
 * v10.6.0: yamahack.com のような大型サイトで初回 fetch がタイムアウト or
 *   503 を返すケースを観測したため、HTML fetch + OG 抽出に **2 回までリトライ** を
 *   追加。og:image が見つからない (= サイトが OG 未対応) は即 fail (リトライしない)。
 */
async function fetchArticleOgImage(articleUrl, cacheDir, meta = {}) {
  let htmlResult;
  let ogImageUrl;
  let lastReason = '';
  // v10.6.0: HTML fetch も og:image 抽出も両方リトライ対象。
  //   理由: 大型サイト (yamahack 等) は初回 fetch でストリーミングが途中で切れる
  //   ことがあり、og:image を含む <head> セクションが取れずに「no og:image」と
  //   誤判定されるケースを観測。3 回までリトライして、最後まで取れなかったら諦める。
  for (let attempt = 1; attempt <= 3; attempt++) {
    htmlResult = await fetchHtmlOnce(articleUrl);
    if (!htmlResult.ok) {
      lastReason = `HTML fetch failed: ${htmlResult.reason}`;
    } else {
      ogImageUrl = extractOgImage(htmlResult.html, htmlResult.finalUrl);
      if (ogImageUrl) break;
      // HTML が小さすぎる (< 10KB) → 部分取得の疑い → リトライ
      // それ以外で og がないのは本当にサイトが OG 未対応 → 即 fail
      if (htmlResult.html.length >= 10 * 1024) {
        return { ok: false, reason: 'no og:image found in HTML (page has no OG meta tags)' };
      }
      lastReason = `HTML too small (${htmlResult.html.length} bytes) — likely partial fetch`;
    }
    if (attempt < 3) {
      await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }
  if (!ogImageUrl) {
    return { ok: false, reason: lastReason || 'no og:image after retries' };
  }
  const imgResult = await fetchAndCache(ogImageUrl, cacheDir, Object.assign({}, meta, {
    article_url: articleUrl,
    og_image_url: ogImageUrl,
  }));
  if (!imgResult.ok) {
    return { ok: false, reason: `image fetch failed: ${imgResult.reason}`, og_image_url: ogImageUrl };
  }
  return Object.assign({}, imgResult, { og_image_url: ogImageUrl });
}

module.exports = {
  fetchAndCache,
  fetchArticleOgImage,
  extractOgImage,
  hashUrl,
};
