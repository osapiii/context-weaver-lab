#!/usr/bin/env node
/**
 * generate-catalog.js — ENOSTECH Slides Design Catalog ジェネレータ
 * ─────────────────────────────────────────────────────────────
 *
 * 目的:
 *   tokens.js / themes.js / slide-patterns.md / diagram-patterns.md /
 *   template-previews/ / logos/ を読み取り、人間がブラウザで
 *   「このスキルに今どんなデザイン資産が入っているか」を
 *   一望できる `.user_reference/CATALOG.html` を生成する。
 *
 * 使い方:
 *   cd skills/enostech-slides
 *   node scripts/generate-catalog.js
 *
 * 出力:
 *   skills/enostech-slides/.user_reference/CATALOG.html
 *
 * 再生成タイミング:
 *   - tokens.js / themes.js を編集したとき
 *   - template-previews/ や logos/ に画像を追加・削除したとき
 *   - slide-patterns.md / diagram-patterns.md のメタ情報を更新したとき
 *
 * 設計方針:
 *   - 依存は Node 標準モジュールのみ（fs / path）
 *   - tokens.js / themes.js は require() で取り込み、生の値を使う
 *   - markdown の表は軽量正規表現で抜き出す（壊れたら該当テンプレだけ
 *     「未記載」表示になるだけで全体は壊れない）
 *   - 画像は相対パスで参照（file:// でそのまま開ける）
 *   - ブラウザ側でテーマを切り替えられるよう、themes.js の中身を
 *     JSON として HTML に埋め込む
 */

const fs = require('fs');
const path = require('path');

const SKILL_ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(SKILL_ROOT, 'assets');
// v5.1 でフォルダを 1 つに統合。assets/template-previews/ が単一ソース (1000px JPEG)。
// CATALOG.html はこの高解像をそのまま埋め込み、Phase 2 指示書の Base64 埋め込みは
// scripts/get-template-preview.py が 160px にオンデマンドリサイズして使う。
const TEMPLATE_PREVIEWS_DIR = path.join(ASSETS_DIR, 'template-previews');
const LOGOS_DIR = path.join(ASSETS_DIR, 'logos');
const REFERENCES_DIR = path.join(SKILL_ROOT, 'references');
const OUTPUT_DIR = path.join(SKILL_ROOT, '.user_reference');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'CATALOG.html');

/**
 * Cowork プロジェクトルートを検出する (v5.4 新規)。
 * 優先順位:
 *   1. CLI 引数 --project-root <path>
 *   2. 環境変数 ENOSTECH_PROJECT_ROOT
 *   3. process.cwd() から最大 6 階層遡って CLAUDE.md を持つディレクトリ
 * 見つからなければ null を返す (バンドル内 CATALOG.html の出力だけ続行)。
 */
function detectProjectRoot() {
  const cliArg = process.argv.find(a => a.startsWith('--project-root='));
  if (cliArg) {
    const p = cliArg.split('=').slice(1).join('=');
    if (p && fs.existsSync(p)) return path.resolve(p);
  }
  const envRoot = process.env.ENOSTECH_PROJECT_ROOT;
  if (envRoot && fs.existsSync(envRoot)) return path.resolve(envRoot);

  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, 'CLAUDE.md'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * テンプレ画像パスを解決する。assets/template-previews/ を単一ソースとして参照。
 * ない場合は null。
 */
function resolveTemplateImage(fname) {
  const p = path.join(TEMPLATE_PREVIEWS_DIR, fname);
  if (fs.existsSync(p)) return { path: p, source: 'preview' };
  return null;
}

/* =========================================================
   1. トークン・テーマ読み込み
   ======================================================== */

function loadTokens() {
  // require を使うと Proxy の中身が素直に取れないので、
  // 一度 mono テーマに固定した状態で必要な値だけ抜き出す
  delete require.cache[require.resolve(path.join(ASSETS_DIR, 'tokens.js'))];
  delete require.cache[require.resolve(path.join(ASSETS_DIR, 'themes.js'))];

  const T = require(path.join(ASSETS_DIR, 'tokens.js'));
  T.useTheme('mono');

  return {
    font: { ...T.font },
    size: { ...T.size },
    layout: { ...T.layout },
    chrome: { ...T.chrome },
    diagramPalette: T.diagramPalette,
    diagramTrackOrder: T.diagramTrackOrder,
    diagramSize: { ...T.diagramSize },
    logoMap: { ...T.logo },
    themes: T.listThemes(),
    rawThemes: T.getThemes(),
  };
}

/* =========================================================
   2. markdown の表をパース
   ======================================================== */

/**
 * slide-patterns.md / diagram-patterns.md から
 * `| NN | 名前 | タイトルの書き方 | 向いている話 |` 形式の行を拾って
 * 詳細メタを返す。各テンプレに対して:
 *   - num, name, category, categoryFull（枚数まで含めた見出し文）
 *   - title（タイトルの書き方）, usage（向いている話/用途）
 *   - tips: 直後のパラグラフから自分の番号を含む「選び方」ノートを収集
 *
 * 実装メモ:
 *   - 見出し `## カテゴリ X：COLOR — 説明（枚数）` からカテゴリを取る
 *   - 各表の中で「数字 2 桁 + 名前 + ... + 用途」の行だけ対象
 *   - 表のカラム構成が 3〜4 で差分あるため、cells.length で分岐する
 *   - 表直後の「**NN vs MM の選び方**:」ブロックは、登場する全番号に紐づける
 */
function parsePatternsMarkdown(mdPath) {
  const md = fs.readFileSync(mdPath, 'utf-8');
  const lines = md.split('\n');
  const entries = {};

  let currentCategory = null;
  let currentCategoryFull = null;

  const categoryRe = /^##\s+カテゴリ\s*([A-Z])：([^—\-（(]+)/;
  const rowRe = /^\|\s*(\d{2})\s*\|\s*([^|]+?)\s*\|/;

  // Pass 1: 行ベースで表とカテゴリを拾う
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const catMatch = line.match(categoryRe);
    if (catMatch) {
      currentCategory = `${catMatch[1].trim()} — ${catMatch[2].trim()}`;
      currentCategoryFull = line.replace(/^##\s+/, '').trim();
      continue;
    }

    const rowMatch = line.match(rowRe);
    if (!rowMatch) continue;

    const cells = line
      .split('|')
      .slice(1, -1)
      .map(c => c.trim());
    if (cells.length < 2) continue;

    const num = cells[0].padStart(2, '0');
    const name = cells[1].replace(/⭐\s*v?[0-9.]+/g, '').trim();

    // カラム数で分岐:
    //   3 列: | NN | 名前 | 用途 |            → title なし
    //   4 列: | NN | 名前 | タイトル | 用途 |  → title あり
    //   5 列以上は稀（要素数テーブルなど）。最後のセルを usage にする
    let title = '';
    let usage = '';
    if (cells.length === 3) {
      usage = cells[2];
    } else if (cells.length >= 4) {
      title = cells[2];
      usage = cells.slice(3).join(' / ');
    }
    title = title.replace(/\|/g, '').trim();
    usage = usage.replace(/\|/g, '').trim();

    if (entries[num]) continue;

    entries[num] = {
      num,
      name,
      title,
      usage,
      category: currentCategory || '—',
      categoryFull: currentCategoryFull || '',
      tips: [],
    };
  }

  // Pass 2: 「**NN vs MM の選び方**」ブロックを拾って関連テンプレに紐づける
  // パターン: `**04 vs 41 の選び方** ⭐ v4.3:` のような段落で始まり、
  //          次の空行以外の見出し or 別の「選び方」or 別の h2 まで続く
  const tipStartRe = /^\*\*(\d{2}(?:\s*(?:vs|\/|、|,|\s)\s*\d{2})+)[^*]*\*\*:?/;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(tipStartRe);
    if (!m) continue;

    // ブロック内容を次の空行 2 連続 or `##` まで集める
    const blockLines = [lines[i]];
    let j = i + 1;
    let blankCount = 0;
    while (j < lines.length) {
      const l = lines[j];
      if (/^##\s/.test(l) || /^---\s*$/.test(l)) break;
      if (tipStartRe.test(l)) break;
      if (l.trim() === '') {
        blankCount++;
        if (blankCount >= 2) break;
        blockLines.push(l);
      } else {
        blankCount = 0;
        blockLines.push(l);
      }
      j++;
    }

    const tipText = blockLines.join('\n').trim();

    // ブロック冒頭で参照されている全番号を抜き出す（"04 vs 41" など）
    const refNums = [];
    const numRe = /\b(\d{2})\b/g;
    let nm;
    const header = blockLines[0];
    while ((nm = numRe.exec(header)) !== null) {
      refNums.push(nm[1]);
    }

    refNums.forEach(n => {
      if (entries[n]) entries[n].tips.push(tipText);
    });
  }

  return entries;
}

/**
 * 旧 example-deck.js のコメントを拾うフォールバック。
 * 現在は scripts/render/templates/*.js の JSDoc から template-samples.json
 * 経由でメタを取るため、本関数は jsPath が存在しない時に空 {} を返すだけ。
 * 互換用に残しているが今後は無用になる予定。
 */
function parseExampleDeckComments(jsPath) {
  if (!fs.existsSync(jsPath)) return {};
  const src = fs.readFileSync(jsPath, 'utf-8');
  const re = /^\/\/\s*(\d{2})\.\s+([^\n]+)$/gm;
  const entries = {};
  let m;
  while ((m = re.exec(src)) !== null) {
    const num = m[1];
    const rest = m[2].trim();
    // 最初の em/en dash で名前と用途を割る。
    // 旧スクリプトでは `）— v2.4` のように前に空白を取らないケースもあったので
    // dash の両側のスペースは任意扱い。ASCII ハイフンは人名などに混ざるので対象外。
    const split = rest.split(/\s*[—–]\s*/);
    const name = split[0].replace(/⭐\s*v?[0-9.]+/g, '').trim();
    const usage = split.length > 1 ? split.slice(1).join(' — ').trim() : '';
    if (!entries[num]) {
      entries[num] = {
        num, name, usage,
        title: '',
        category: 'fallback',
        categoryFull: 'slide-patterns.md 未登録',
        tips: [],
      };
    }
  }
  return entries;
}

/* =========================================================
   3. 画像ファイル一覧
   ======================================================== */

function listImages(dir, prefix) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(f => f.startsWith(prefix) && /\.(jpg|jpeg|png)$/i.test(f))
    .sort();
}

/**
 * 画像を Base64 data URI に変換して返す。
 * 生成 HTML を 1 ファイル完結にするためにこれを使う。
 * Drive 同期下の相対パス（../assets/...）が壊れるのを回避する目的で
 * v1.1 から相対参照ではなく埋め込み方式に変更した。
 */
function toDataUri(absPath) {
  if (!fs.existsSync(absPath)) return '';
  const ext = path.extname(absPath).slice(1).toLowerCase();
  const mime =
    ext === 'png' ? 'image/png' :
    ext === 'jpeg' ? 'image/jpeg' :
    ext === 'jpg' ? 'image/jpeg' :
    'application/octet-stream';
  const b64 = fs.readFileSync(absPath).toString('base64');
  return `data:${mime};base64,${b64}`;
}

/* =========================================================
   3.5 シーン / アイコンメタ読み込み
   ======================================================== */

/**
 * 旧 build-visual-pattern-catalog.js は削除済み。
 * ICON_META セクションはカタログから完全撤去された (空オブジェクト固定)。
 */
function loadVisualPatterns() {
  return { iconMeta: {} };
}

const ICONS_PNG_DIR  = path.join(SKILL_ROOT, 'assets/catalog/icons');

function resolveCatalogImage(dir, key) {
  const p = path.join(dir, `${key}.png`);
  return fs.existsSync(p) ? p : null;
}

/* =========================================================
   4. HTML 組み立て
   ======================================================== */

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function swatch(hex, label) {
  const safe = (hex || '').replace(/^#/, '');
  return `
    <div class="swatch">
      <div class="swatch__chip" style="background:#${esc(safe)}"></div>
      <div class="swatch__meta">
        <div class="swatch__label">${esc(label)}</div>
        <div class="swatch__hex">#${esc(safe.toUpperCase())}</div>
      </div>
    </div>
  `;
}

function renderTemplateCard(num, meta, imgUri, kind) {
  // kind: 'ENO' or 'DIAG'
  const id = `${kind}-${num}`;
  const nameHtml = meta && meta.name ? esc(meta.name) : '<em class="muted">未記載</em>';
  const usageHtml = meta && meta.usage ? esc(meta.usage)
                  : '<span class="muted">slide-patterns.md に記載なし</span>';
  const catHtml = meta && meta.category ? esc(meta.category) : '—';

  return `
    <article class="card" data-id="${esc(id)}" tabindex="0" role="button" aria-label="${esc(id)} の詳細を開く">
      <div class="card__img">
        <img src="${esc(imgUri)}" alt="${esc(id)} プレビュー" loading="lazy" />
      </div>
      <div class="card__body">
        <div class="card__meta-row">
          <span class="badge">${esc(id)}</span>
          <span class="card__cat">${catHtml}</span>
        </div>
        <h3 class="card__title">${nameHtml}</h3>
        <p class="card__usage">${usageHtml}</p>
      </div>
    </article>
  `;
}

function renderThemeBlock(theme, themeId) {
  const b = theme.brand;
  const a = theme.accent;
  const n = theme.neutral;
  return `
    <section class="theme-block" data-theme="${esc(themeId)}">
      <header class="theme-block__head">
        <div>
          <h3 class="theme-block__title">${esc(theme.name)} <span class="theme-block__id">(${esc(themeId)})</span></h3>
          <p class="theme-block__desc">${esc(theme.description)}</p>
          <p class="theme-block__usage"><strong>想定用途:</strong> ${esc(theme.usage)}</p>
        </div>
        <button class="btn-apply" data-apply-theme="${esc(themeId)}">このテーマで表示</button>
      </header>
      <div class="swatch-group">
        <div class="swatch-group__label">brand (主張)</div>
        <div class="swatch-row">
          ${swatch(b.soft, 'soft')}${swatch(b.base, 'base')}${swatch(b.deep, 'deep')}
        </div>
      </div>
      <div class="swatch-group">
        <div class="swatch-group__label">accent (強調)</div>
        <div class="swatch-row">
          ${swatch(a.soft, 'soft')}${swatch(a.base, 'base')}${swatch(a.deep, 'deep')}
        </div>
      </div>
      <div class="swatch-group">
        <div class="swatch-group__label">neutral (グレースケール)</div>
        <div class="swatch-row swatch-row--scale">
          ${Object.entries(n).map(([k, v]) => swatch(v, k)).join('')}
        </div>
      </div>
      <div class="swatch-group">
        <div class="swatch-group__label">surface</div>
        <div class="swatch-row">
          ${swatch(theme.canvas, 'canvas')}${swatch(theme.white, 'white')}
        </div>
      </div>
    </section>
  `;
}

function renderDiagramPalette(palette, order) {
  return `
    <div class="palette-grid">
      ${order.map(key => {
        const p = palette[key];
        return `
          <div class="palette-track">
            <div class="palette-track__label">${esc(key)}</div>
            <div class="palette-track__row">
              ${swatch(p.bg, 'bg')}${swatch(p.mid, 'mid')}${swatch(p.deep, 'deep')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderSizeTable(sizes) {
  const rows = Object.entries(sizes)
    .map(([k, v]) => `<tr><td><code>${esc(k)}</code></td><td class="num">${esc(v)}</td></tr>`)
    .join('');
  return `<table class="kv"><thead><tr><th>トークン</th><th>値 (pt)</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderLayoutTable(layout) {
  const rows = Object.entries(layout)
    .map(([k, v]) => `<tr><td><code>${esc(k)}</code></td><td class="num">${esc(v)}</td></tr>`)
    .join('');
  return `<table class="kv"><thead><tr><th>トークン</th><th>値 (inch)</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderFontTable(font) {
  const rows = Object.entries(font)
    .map(([k, v]) => `<tr><td><code>${esc(k)}</code></td><td style="font-family:'${esc(v)}', sans-serif">${esc(v)} — これがサンプル表示</td></tr>`)
    .join('');
  return `<table class="kv kv--wide"><thead><tr><th>用途</th><th>フォント</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderDiagramSizeTable(ds) {
  const rows = Object.entries(ds)
    .map(([k, v]) => `<tr><td><code>${esc(k)}</code></td><td class="num">${esc(v)}</td></tr>`)
    .join('');
  return `<table class="kv"><thead><tr><th>トークン</th><th>値</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderLogoGallery(logoMap, logoDirAbs) {
  const entries = Object.entries(logoMap);
  return `
    <div class="logo-grid">
      ${entries
        .map(([key, fname]) => {
          const isBlack = /black/i.test(key);
          const bg = isBlack ? '#FAFAFA' : '#1F1F1F';
          const uri = toDataUri(path.join(logoDirAbs, fname));
          return `
            <figure class="logo-card" style="background:${bg}">
              <img src="${esc(uri)}" alt="${esc(key)}" loading="lazy" />
              <figcaption><code>${esc(key)}</code><br/><span class="muted">${esc(fname)}</span></figcaption>
            </figure>
          `;
        })
        .join('')}
    </div>
  `;
}

function renderStats(data) {
  const iconCount = data.iconMeta ? Object.keys(data.iconMeta).length : 0;
  return `
    <div class="stat-row">
      <div class="stat"><div class="stat__num">${data.enoImages.length}</div><div class="stat__label">スライドテンプレ</div></div>
      <div class="stat"><div class="stat__num">${data.diagImages.length}</div><div class="stat__label">ダイアグラム</div></div>
      <div class="stat"><div class="stat__num">${iconCount}</div><div class="stat__label">アイコン</div></div>
      <div class="stat"><div class="stat__num">${data.themes.length}</div><div class="stat__label">テーマ</div></div>
      <div class="stat"><div class="stat__num">${Object.keys(data.logoMap).length}</div><div class="stat__label">ロゴ</div></div>
    </div>
  `;
}

/**
 * 画像群をカテゴリ単位にグルーピングして HTML を返す (v5.6 新規)。
 *
 * 何をしているか:
 *   - enoPatterns / diagPatterns から拾った category ("A — STRUCTURE" 等) を
 *     キーにテンプレを束ね、見出し+grid のセクションを縦に積む
 *   - カテゴリ並び順は「先頭が英大文字 (A,B,C…)」のものを文字順で先に出し、
 *     メタ未登録のものは末尾の「その他」グループにまとめる
 *   - templateMeta はモーダル詳細用に外側で集約するので、引数で受け取って詰める
 *
 * 旧フラット表示 (~v5.5) では一目で全テンプレを見渡せる代わりに、テンプレが
 * どのカテゴリに属するかを各カードのテキストでしか判別できなかった。
 * カテゴリ単位グルーピングにすることで「骨格用 → 本編用 → ピッチ用」の
 * 思考の入口がカタログ上で自然に区切られ、デッキ設計時の選択が早くなる。
 */
function renderCategorizedCards(images, patterns, kind, templateMeta) {
  const re = kind === 'ENO' ? /^ENO-(\d{2})\./ : /^DIAG-(\d{2})\./;
  const FALLBACK_KEY = '__fallback__'; // メタ未登録のテンプレ受け皿
  const groups = new Map();

  for (const fname of images) {
    const m = fname.match(re);
    const num = m ? m[1] : '??';
    const meta = patterns[num] || null;
    const resolved = resolveTemplateImage(fname);
    const uri = resolved ? toDataUri(resolved.path) : '';
    const id = `${kind}-${num}`;
    templateMeta[id] = {
      id, kind, num,
      imgSource: resolved ? resolved.source : 'missing',
      ...(meta || { name: '', usage: '', title: '', category: '', categoryFull: '', tips: [] }),
    };

    // category キー決定:
    //   - meta.category が "A — STRUCTURE" のような形ならそのまま採用
    //   - 空 / "—" / "fallback" は FALLBACK にまとめる
    const rawCat = (meta && meta.category) ? meta.category.trim() : '';
    const isReal = /^[A-Z]\s+—\s+/.test(rawCat); // "A — STRUCTURE"
    const key = isReal ? rawCat : FALLBACK_KEY;
    const label = isReal ? rawCat : 'その他 / メタ未登録';
    const full = isReal
      ? ((meta && meta.categoryFull) || rawCat)
      : 'slide-patterns.md にカテゴリ記載がないテンプレ';

    if (!groups.has(key)) {
      groups.set(key, { label, full, cards: [] });
    }
    groups.get(key).cards.push({ num, meta, uri });
  }

  // 並び替え: A < B < C < … < FALLBACK
  const sortedKeys = [...groups.keys()].sort((a, b) => {
    if (a === FALLBACK_KEY) return 1;
    if (b === FALLBACK_KEY) return -1;
    const al = a.charAt(0);
    const bl = b.charAt(0);
    return al.localeCompare(bl);
  });

  return sortedKeys.map(key => {
    const g = groups.get(key);
    const cardsHtml = g.cards
      .map(c => renderTemplateCard(c.num, c.meta, c.uri, kind))
      .join('');
    return `
      <div class="category-group" data-category-key="${esc(key)}">
        <header class="category-group__head">
          <h3 class="category-group__title">${esc(g.label)}</h3>
          <span class="category-group__count">${g.cards.length} 枚</span>
        </header>
        <div class="grid category-group__grid">
          ${cardsHtml}
        </div>
      </div>
    `;
  }).join('');
}

/* =========================================================
   4.5 アイコンカードレンダラ
   ======================================================== */

function renderIconCard(name, meta, imgUri) {
  const safeName = esc(name);
  const desc = (meta && meta.desc) ? esc(meta.desc) : '';
  const imgHtml = imgUri
    ? `<img src="${esc(imgUri)}" alt="${safeName}" loading="lazy" />`
    : '<div class="card__img-missing">未生成</div>';
  return `
    <article class="icon-card" data-icon-id="${safeName}">
      <div class="icon-card__img">
        ${imgHtml}
      </div>
      <div class="icon-card__body">
        <code class="icon-card__name">${safeName}</code>
        <p class="icon-card__desc">${desc}</p>
      </div>
    </article>
  `;
}

/**
 * アイコンを `meta.cat` 単位でグルーピング。
 * カテゴリ順は ICON_META の宣言順をそのまま採用。
 */
function renderCategorizedIconCards(iconMeta, iconsDir) {
  const groups = new Map();
  for (const [name, meta] of Object.entries(iconMeta)) {
    const key = meta.cat || 'その他';
    if (!groups.has(key)) groups.set(key, []);
    const imgPath = resolveCatalogImage(iconsDir, name);
    const uri = imgPath ? toDataUri(imgPath) : '';
    groups.get(key).push({ name, meta, uri });
  }
  return [...groups.entries()].map(([cat, items]) => {
    const cards = items
      .map(({ name, meta, uri }) => renderIconCard(name, meta, uri))
      .join('');
    return `
      <div class="category-group" data-category-key="${esc(cat)}">
        <header class="category-group__head">
          <h3 class="category-group__title">${esc(cat)}</h3>
          <span class="category-group__count">${items.length} 件</span>
        </header>
        <div class="icon-grid">
          ${cards}
        </div>
      </div>
    `;
  }).join('');
}

function renderDocument(data) {
  const {
    enoImages, diagImages, enoPatterns, diagPatterns,
    iconMeta,
    tokens, generatedAt, skillVersion,
  } = data;

  // メタデータは JS 側の TEMPLATE_META に一括で持たせ、モーダルで使う。
  // 画像 URI はカードの <img> を流用するので meta 側には入れない（HTML サイズ半減）
  const templateMeta = {};

  // v5.6: カテゴリ単位グルーピングに変更。フラット表示は廃止。
  const enoCards = renderCategorizedCards(enoImages, enoPatterns, 'ENO', templateMeta);
  const diagCards = renderCategorizedCards(diagImages, diagPatterns, 'DIAG', templateMeta);
  const iconCards = renderCategorizedIconCards(iconMeta, ICONS_PNG_DIR);

  const themesHtml = tokens.themes.map(t =>
    renderThemeBlock(tokens.rawThemes[t.id], t.id)
  ).join('');

  // JSON を <script> 内に埋め込むときの安全化:
  //   </script> や <!-- を含む文字列があると HTML パーサが script を閉じてしまうので
  //   `<` だけ Unicode エスケープ化しておく（JSON 仕様としても安全）
  const safeJson = v => JSON.stringify(v).replace(/</g, '\\u003c');
  const themesJson = safeJson(tokens.rawThemes);
  const templateMetaJson = safeJson(templateMeta);

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>ENOSTECH Slides — Design Catalog</title>
<style>
:root {
  --brand: #9212F3;
  --brand-soft: #F3E7FE;
  --brand-deep: #6D0BB5;
  --accent: #F59E0B;
  --accent-soft: #FEF3C7;
  --ink: #111827;
  --ink-soft: #374151;
  --gray-300: #D1D5DB;
  --gray-200: #E5E7EB;
  --gray-100: #F3F4F6;
  --gray-50:  #FAFAFA;
  --canvas: #FAFAF7;
  --white: #FFFFFF;
  --radius: 10px;
  --radius-sm: 6px;
  --shadow: 0 1px 2px rgba(0,0,0,.05), 0 4px 12px rgba(0,0,0,.04);
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: 'Noto Sans JP', 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', system-ui, sans-serif;
  color: var(--ink);
  background: var(--canvas);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
.wrap { max-width: 1280px; margin: 0 auto; padding: 48px 32px 120px; }

/* Header */
.hero {
  border-left: 6px solid var(--brand);
  padding: 4px 0 4px 24px;
  margin-bottom: 28px;
}
.hero__eyebrow {
  font-size: 12px; letter-spacing: .14em; color: var(--brand); font-weight: 700;
  text-transform: uppercase;
}
.hero__title { margin: 4px 0 10px; font-size: 32px; font-weight: 800; letter-spacing: -.01em; }
.hero__sub { margin: 0; color: var(--ink-soft); font-size: 15px; max-width: 720px; }
.meta-line { margin-top: 14px; font-size: 12px; color: var(--ink-soft); }
.meta-line code { background: var(--gray-100); padding: 2px 6px; border-radius: 4px; }

/* Stats */
.stat-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin: 28px 0 12px; }
.stat {
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius);
  padding: 18px 20px;
  box-shadow: var(--shadow);
}
.stat__num { font-size: 32px; font-weight: 800; color: var(--brand); line-height: 1; }
.stat__label { margin-top: 6px; font-size: 12px; color: var(--ink-soft); }

/* TOC */
.toc {
  position: sticky; top: 0; z-index: 20;
  background: rgba(250,250,247,.92);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--gray-200);
  padding: 12px 0;
  margin: 24px -32px 32px;
}
.toc__inner { max-width: 1280px; margin: 0 auto; padding: 0 32px; display: flex; flex-wrap: wrap; gap: 10px; }
.toc a {
  font-size: 13px; color: var(--ink); text-decoration: none;
  padding: 6px 12px; border-radius: 999px; background: var(--gray-100); border: 1px solid var(--gray-200);
}
.toc a:hover { background: var(--brand-soft); border-color: var(--brand); }

/* Section */
section.block { margin-top: 56px; }
.block__head { margin-bottom: 20px; }
.block__num {
  display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: .12em;
  color: var(--brand); text-transform: uppercase;
}
.block__title { margin: 4px 0 6px; font-size: 22px; font-weight: 700; }
.block__sub { margin: 0; color: var(--ink-soft); font-size: 14px; }

/* Filter */
.filter-bar {
  display: flex; gap: 10px; flex-wrap: wrap; align-items: center;
  margin-bottom: 18px; padding: 12px 14px;
  background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius);
}
.filter-bar input {
  flex: 1; min-width: 200px; padding: 8px 12px; font-size: 14px;
  border: 1px solid var(--gray-300); border-radius: var(--radius-sm); outline: none;
}
.filter-bar input:focus { border-color: var(--brand); }
.filter-bar__count { font-size: 12px; color: var(--ink-soft); }

/* Category grouping (v5.6) */
.category-stack { display: flex; flex-direction: column; gap: 36px; }
.category-group[data-hidden="true"] { display: none; }
.category-group__head {
  display: flex; align-items: baseline; gap: 12px;
  margin-bottom: 14px; padding-bottom: 8px;
  border-bottom: 1px solid var(--gray-200);
}
.category-group__title {
  margin: 0; font-size: 13px; font-weight: 700;
  color: var(--brand-deep); letter-spacing: .04em;
}
.category-group__count {
  font-size: 11px; color: var(--ink-soft); font-weight: 500;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
}

/* Card grid */
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
.card {
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius);
  overflow: hidden;
  display: flex; flex-direction: column;
  transition: transform .12s ease, box-shadow .12s ease, border-color .12s ease;
}
.card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow);
  border-color: var(--brand-soft);
}
.card[data-hidden="true"] { display: none; }
.card__img { aspect-ratio: 16/9; background: var(--gray-100); overflow: hidden; }
.card__img img { width: 100%; height: 100%; object-fit: cover; display: block; }
.card__body { padding: 12px 14px 16px; display: flex; flex-direction: column; gap: 6px; flex: 1; }
.card__meta-row { display: flex; align-items: center; gap: 8px; }
.badge {
  font-size: 10px; font-weight: 700; letter-spacing: .04em;
  padding: 2px 8px; border-radius: 999px;
  background: var(--brand-soft); color: var(--brand-deep);
  font-family: 'SF Mono', Menlo, Consolas, monospace;
}
.card__cat { font-size: 10px; color: var(--ink-soft); letter-spacing: .02em; }
.card__title { margin: 0; font-size: 14px; font-weight: 700; line-height: 1.4; }
.card__usage { margin: 0; font-size: 12px; color: var(--ink-soft); line-height: 1.55; }
.muted { color: var(--gray-300); font-style: italic; }

/* Scene cards */
.scene-grid { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
.card__img--scene {
  aspect-ratio: 16/10;
  background: var(--canvas);
  display: flex; align-items: center; justify-content: center;
  padding: 6px;
}
.card__img--scene img { width: 100%; height: 100%; object-fit: contain; display: block; }
.card__img-missing {
  display: flex; align-items: center; justify-content: center;
  width: 100%; height: 100%;
  font-size: 11px; color: var(--ink-soft);
  background: var(--gray-100);
}
.badge--scene {
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 10px;
}
.card--scene .card__usage { font-size: 12px; line-height: 1.55; }

/* Icon cards */
.icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
  gap: 10px;
}
.icon-card {
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-sm);
  overflow: hidden;
  display: flex; flex-direction: column;
  transition: border-color .12s ease, transform .12s ease;
}
.icon-card:hover { border-color: var(--brand-soft); transform: translateY(-2px); }
.icon-card__img {
  position: relative;
  background: var(--gray-50);
  aspect-ratio: 1 / 1;
  display: flex; align-items: center; justify-content: center;
  padding: 14px;
}
.icon-card__img img { max-width: 100%; max-height: 100%; object-fit: contain; }
.icon-card__body { padding: 8px 10px 10px; line-height: 1.4; }
.icon-card__name {
  display: block;
  font-size: 11px; color: var(--brand-deep);
  font-weight: 700;
  background: transparent !important;
  padding: 0 !important;
  word-break: break-all;
  margin-bottom: 2px;
}
.icon-card__desc {
  margin: 0;
  font-size: 10.5px;
  color: var(--ink-soft);
  line-height: 1.45;
}
.badge-tiny {
  position: absolute; top: 6px; right: 6px;
  font-size: 9px; padding: 1px 6px; border-radius: 999px;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-weight: 700; letter-spacing: .04em;
}
.badge-tiny--shape { background: var(--brand-soft); color: var(--brand-deep); }
.badge-tiny--svg   { background: var(--accent-soft); color: var(--brand-deep); border: 1px solid var(--accent); }

/* Theme block */
.theme-block {
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius);
  padding: 20px 22px;
  margin-bottom: 16px;
  box-shadow: var(--shadow);
}
.theme-block__head {
  display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;
  margin-bottom: 14px;
}
.theme-block__title { margin: 0; font-size: 18px; font-weight: 700; }
.theme-block__id { font-size: 12px; color: var(--ink-soft); font-weight: 400; font-family: 'SF Mono', Menlo, Consolas, monospace; }
.theme-block__desc { margin: 4px 0 2px; font-size: 13px; color: var(--ink-soft); }
.theme-block__usage { margin: 0; font-size: 12px; color: var(--ink-soft); }
.btn-apply {
  flex-shrink: 0;
  border: 1px solid var(--brand); background: var(--brand); color: #fff;
  font-size: 12px; font-weight: 600; padding: 8px 14px; border-radius: var(--radius-sm); cursor: pointer;
  transition: background .12s;
}
.btn-apply:hover { background: var(--brand-deep); }
.btn-apply[aria-pressed="true"] { background: var(--brand-deep); }
.swatch-group { margin-top: 10px; }
.swatch-group__label { font-size: 11px; font-weight: 700; color: var(--ink-soft); letter-spacing: .06em; text-transform: uppercase; margin-bottom: 6px; }
.swatch-row { display: flex; flex-wrap: wrap; gap: 8px; }
.swatch { display: flex; align-items: center; gap: 8px; padding: 4px 8px 4px 4px; background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: var(--radius-sm); min-width: 126px; }
.swatch__chip { width: 28px; height: 28px; border-radius: 4px; flex-shrink: 0; border: 1px solid rgba(0,0,0,.08); }
.swatch__meta { line-height: 1.15; }
.swatch__label { font-size: 10px; color: var(--ink-soft); }
.swatch__hex { font-size: 11px; font-family: 'SF Mono', Menlo, Consolas, monospace; }
.swatch-row--scale .swatch { min-width: 104px; }

/* Palette grid */
.palette-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; }
.palette-track { background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-sm); padding: 10px 12px; }
.palette-track__label { font-size: 12px; font-weight: 700; margin-bottom: 6px; letter-spacing: .06em; text-transform: uppercase; color: var(--brand-deep); }

/* KV tables */
table.kv { width: 100%; border-collapse: collapse; background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius); overflow: hidden; font-size: 13px; }
table.kv thead th { background: var(--gray-100); font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-soft); text-align: left; padding: 10px 14px; }
table.kv td { padding: 10px 14px; border-top: 1px solid var(--gray-100); }
table.kv td.num { font-family: 'SF Mono', Menlo, Consolas, monospace; color: var(--brand-deep); }
table.kv td code { background: var(--gray-100); padding: 2px 6px; border-radius: 4px; font-size: 12px; }

/* 3-column layout for misc tokens */
.three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
@media (max-width: 900px) { .three-col { grid-template-columns: 1fr; } }

/* Logo gallery */
.logo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.logo-card { margin: 0; border: 1px solid var(--gray-200); border-radius: var(--radius); overflow: hidden; padding: 20px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.logo-card img { max-width: 100%; max-height: 90px; object-fit: contain; }
.logo-card figcaption { font-size: 11px; text-align: center; color: var(--white); }
.logo-card[style*="FAFAFA"] figcaption { color: var(--ink); }
.logo-card code { background: rgba(255,255,255,.08); padding: 1px 6px; border-radius: 3px; }
.logo-card[style*="FAFAFA"] code { background: var(--gray-100); color: var(--ink); }

/* Footer */
.foot { margin-top: 64px; padding-top: 24px; border-top: 1px solid var(--gray-200); font-size: 12px; color: var(--ink-soft); }
.foot code { background: var(--gray-100); padding: 2px 6px; border-radius: 4px; }

/* Modal */
.modal {
  position: fixed; inset: 0;
  display: none;
  z-index: 100;
  align-items: center; justify-content: center;
}
.modal[aria-hidden="false"] { display: flex; }
.modal__backdrop {
  position: absolute; inset: 0;
  background: rgba(17, 24, 39, .55);
  backdrop-filter: blur(3px);
}
.modal__box {
  position: relative;
  background: var(--white);
  width: min(1080px, 94vw);
  max-height: 92vh;
  border-radius: 14px;
  overflow: hidden;
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
  box-shadow: 0 20px 60px rgba(0,0,0,.35);
  animation: modalPop .18s ease-out;
}
@keyframes modalPop {
  from { transform: translateY(10px) scale(.98); opacity: 0; }
  to   { transform: none; opacity: 1; }
}
.modal__media {
  background: var(--gray-100);
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
  min-height: 400px;
}
.modal__media img {
  max-width: 100%; max-height: 100%;
  width: 100%; height: auto;
  object-fit: contain;
  border: 1px solid var(--gray-200);
  border-radius: 6px;
  background: var(--white);
  box-shadow: 0 4px 12px rgba(0,0,0,.08);
}
.modal__body {
  padding: 28px 30px 24px;
  overflow-y: auto;
}
.modal__close {
  position: absolute; top: 14px; right: 14px;
  z-index: 10;
  width: 36px; height: 36px; border-radius: 50%;
  border: none; background: rgba(255,255,255,.92);
  box-shadow: 0 2px 6px rgba(0,0,0,.15);
  font-size: 18px; cursor: pointer; color: var(--ink);
  display: flex; align-items: center; justify-content: center;
}
.modal__close:hover { background: #fff; }
.modal__badge-row { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; }
.modal__badge {
  font-size: 11px; font-weight: 700; letter-spacing: .04em;
  padding: 4px 10px; border-radius: 999px;
  background: var(--brand-soft); color: var(--brand-deep);
  font-family: 'SF Mono', Menlo, Consolas, monospace;
}
.modal__badge--src-thumb { background: #FEF3C7; color: #854D0E; }
.modal__cat { font-size: 11px; color: var(--ink-soft); }
.modal__title { margin: 2px 0 4px; font-size: 22px; font-weight: 800; line-height: 1.35; }
.modal__catfull { margin: 0 0 18px; font-size: 12px; color: var(--ink-soft); }
.modal__section { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--gray-200); }
.modal__section:first-of-type { border-top: none; padding-top: 0; margin-top: 0; }
.modal__label {
  font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
  color: var(--brand-deep); margin-bottom: 6px;
}
.modal__value { margin: 0; font-size: 14px; line-height: 1.7; color: var(--ink); }
.modal__tip {
  background: var(--gray-50); border-left: 3px solid var(--accent);
  padding: 10px 14px; border-radius: 4px;
  font-size: 13px; line-height: 1.7; white-space: pre-wrap;
  margin-bottom: 8px;
}
.modal__tip strong { color: var(--brand-deep); }
.modal__copy {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11px; color: var(--brand-deep);
  background: transparent; border: 1px solid var(--gray-300); border-radius: 4px;
  padding: 3px 8px; cursor: pointer; margin-left: 6px;
}
.modal__copy:hover { border-color: var(--brand); background: var(--brand-soft); }

@media (max-width: 760px) {
  .modal__box { grid-template-columns: 1fr; max-height: 96vh; }
  .modal__media { min-height: 240px; padding: 16px; }
  .modal__body { padding: 20px 22px; }
}

/* Card clickable state */
.card { cursor: pointer; }
.card:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
</style>
</head>
<body>
<div class="wrap">

<header class="hero">
  <div class="hero__eyebrow">ENOSTECH Slides · Design Catalog</div>
  <h1 class="hero__title">スキルに入っているデザイン資産を一覧で眺める</h1>
  <p class="hero__sub">
    <code>enostech-slides</code> スキルが参照している <strong>テンプレート・テーマ・トークン・ロゴ</strong> を
    1 ページで俯瞰できる自動生成カタログ。デザインを変更したら
    <code>node scripts/generate-catalog.js</code> を再実行すると最新状態に追従します。
  </p>
  <div class="meta-line">
    生成日時: <code>${esc(generatedAt)}</code> / ソース: <code>assets/tokens.js</code>, <code>assets/themes.js</code>, <code>references/_common/slide-patterns.md</code>, <code>references/_common/diagram-patterns.md</code>, <code>scripts/render/templates/*.js</code>, <code>scripts/render/diagrams/*.js</code>
  </div>
</header>

${renderStats({ enoImages, diagImages, iconMeta, themes: tokens.themes, logoMap: tokens.logoMap })}

<nav class="toc">
  <div class="toc__inner">
    <a href="#templates">スライドテンプレ</a>
    <a href="#diagrams">ダイアグラム</a>
    <a href="#icons">アイコン</a>
    <a href="#themes">テーマ・ブランドカラー</a>
    <a href="#palette">ダイアグラムパレット</a>
    <a href="#tokens">フォント・サイズ・レイアウト</a>
    <a href="#logos">ロゴ</a>
  </div>
</nav>

<section class="block" id="templates">
  <header class="block__head">
    <div class="block__num">01 · TEMPLATES</div>
    <h2 class="block__title">スライドテンプレ（${enoImages.length} 種）</h2>
    <p class="block__sub">例: <code>LIST-1</code>（標準コンテンツ）のように ID で参照する。画像は <code>assets/template-previews/</code> に格納。</p>
  </header>
  <div class="filter-bar">
    <input type="search" id="tpl-filter" placeholder="番号・名前・用途で絞り込む (例: スケジュール / 03 / プロフィール)" />
    <div class="filter-bar__count"><span id="tpl-count">${enoImages.length}</span> 件表示中</div>
  </div>
  <div class="category-stack" id="tpl-grid">
    ${enoCards}
  </div>
</section>

<section class="block" id="diagrams">
  <header class="block__head">
    <div class="block__num">02 · DIAGRAMS</div>
    <h2 class="block__title">ダイアグラム（${diagImages.length} 種）</h2>
    <p class="block__sub">スライド内に入れる図版の型。実装は <code>scripts/render/diagrams/*.js</code>。</p>
  </header>
  <div class="category-stack">
    ${diagCards}
  </div>
</section>

<section class="block" id="icons">
  <header class="block__head">
    <div class="block__num">03 · ICONS</div>
    <h2 class="block__title">アイコン原子要素（${Object.keys(iconMeta).length} 種）</h2>
    <p class="block__sub">スライドや図解の中で使う原子要素。<code>NI.icons['...'](s, x, y, w, h, h_)</code> で直接呼び出し。SVG ハイブリッド機構を撤去し、全アイコンをネイティブ shape に統一。挿絵シーン概念を廃止、本ライブラリはアイコン専用に。</p>
  </header>
  <div class="category-stack">
    ${iconCards}
  </div>
</section>

<section class="block" id="themes">
  <header class="block__head">
    <div class="block__num">04 · THEMES</div>
    <h2 class="block__title">カラーテーマ（${tokens.themes.length} 種）</h2>
    <p class="block__sub">「このテーマで表示」を押すとカタログ上部のアクセント色が切り替わる。実装では <code>T.useTheme('corporate')</code>。</p>
  </header>
  ${themesHtml}
</section>

<section class="block" id="palette">
  <header class="block__head">
    <div class="block__num">05 · DIAGRAM PALETTE</div>
    <h2 class="block__title">ダイアグラムパレット（6 トラック × 3 階調）</h2>
    <p class="block__sub">テーマが切り替わっても固定。<code>T.diagramTrack(i)</code> で順に取り出して使う。</p>
  </header>
  ${renderDiagramPalette(tokens.diagramPalette, tokens.diagramTrackOrder)}

  <header class="block__head" style="margin-top:28px;">
    <h3 class="block__title" style="font-size:16px">ダイアグラムサイズトークン</h3>
    <p class="block__sub">ドット半径・コネクタ太さなど、ダイアグラム共通の寸法。</p>
  </header>
  ${renderDiagramSizeTable(tokens.diagramSize)}
</section>

<section class="block" id="tokens">
  <header class="block__head">
    <div class="block__num">06 · TYPOGRAPHY · SIZE · LAYOUT</div>
    <h2 class="block__title">フォント・テキストサイズ・レイアウト</h2>
    <p class="block__sub">テーマ横断で共通。1 スライド = 10 × 5.625 inch。マージンは 0.40 inch。</p>
  </header>
  <div class="three-col">
    <div>
      <h3 class="block__title" style="font-size:14px; margin-bottom:8px">Font</h3>
      ${renderFontTable(tokens.font)}
    </div>
    <div>
      <h3 class="block__title" style="font-size:14px; margin-bottom:8px">Size (pt)</h3>
      ${renderSizeTable(tokens.size)}
    </div>
    <div>
      <h3 class="block__title" style="font-size:14px; margin-bottom:8px">Layout (inch)</h3>
      ${renderLayoutTable(tokens.layout)}
    </div>
  </div>
</section>

<section class="block" id="logos">
  <header class="block__head">
    <div class="block__num">07 · LOGOS</div>
    <h2 class="block__title">ロゴバリエーション（${Object.keys(tokens.logoMap).length} 種）</h2>
    <p class="block__sub">背景色に合わせて color / black を使い分ける。実画像は <code>assets/logos/</code>。</p>
  </header>
  ${renderLogoGallery(tokens.logoMap, LOGOS_DIR)}
</section>

<footer class="foot">
  このカタログは <code>scripts/generate-catalog.js</code> によって自動生成されています。
  画像・メタ情報が古い場合は、スキルのルートで <code>node scripts/generate-catalog.js</code> を再実行してください。
  ソースを直接触らず、必ずこのコマンド経由で更新します。
</footer>

</div>

<!-- Modal (template detail) -->
<div class="modal" id="tpl-modal" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <div class="modal__backdrop" data-close-modal></div>
  <div class="modal__box">
    <button class="modal__close" data-close-modal aria-label="閉じる">×</button>
    <div class="modal__media">
      <img id="modal-img" alt="" />
    </div>
    <div class="modal__body" id="modal-body">
      <!-- populated by JS -->
    </div>
  </div>
</div>

<script>
// ─── テーマプレビュー切替 ───
const THEMES = ${themesJson};
const root = document.documentElement;

function applyTheme(id) {
  const t = THEMES[id];
  if (!t) return;
  root.style.setProperty('--brand',      '#' + t.brand.base);
  root.style.setProperty('--brand-soft', '#' + t.brand.soft);
  root.style.setProperty('--brand-deep', '#' + t.brand.deep);
  root.style.setProperty('--accent',     '#' + t.accent.base);
  root.style.setProperty('--accent-soft','#' + t.accent.soft);
  root.style.setProperty('--canvas',     '#' + t.canvas);
  document.querySelectorAll('[data-apply-theme]').forEach(btn => {
    btn.setAttribute('aria-pressed', btn.dataset.applyTheme === id ? 'true' : 'false');
  });
}
document.querySelectorAll('[data-apply-theme]').forEach(btn => {
  btn.addEventListener('click', () => applyTheme(btn.dataset.applyTheme));
});

// ─── テンプレ絞り込み ───
const filter = document.getElementById('tpl-filter');
const grid = document.getElementById('tpl-grid');
const count = document.getElementById('tpl-count');
if (filter && grid) {
  filter.addEventListener('input', () => {
    const q = filter.value.trim().toLowerCase();
    let shown = 0;
    grid.querySelectorAll('.card').forEach(card => {
      const text = card.textContent.toLowerCase();
      const hit = q === '' || text.includes(q);
      card.dataset.hidden = hit ? 'false' : 'true';
      if (hit) shown++;
    });
    // v5.6: 全カードが非表示になったカテゴリは見出しごと折り畳む
    grid.querySelectorAll('.category-group').forEach(group => {
      const hasVisible = group.querySelector('.card:not([data-hidden="true"])');
      group.dataset.hidden = hasVisible ? 'false' : 'true';
    });
    count.textContent = shown;
  });
}

// ─── テンプレ詳細モーダル ───
const TEMPLATE_META = ${templateMetaJson};
const modal = document.getElementById('tpl-modal');
const modalImg = document.getElementById('modal-img');
const modalBody = document.getElementById('modal-body');

function mdLite(text) {
  // **bold** だけ最小対応、改行は <br> に変換、HTML はエスケープ
  const escaped = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped
    .replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>')
    .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
    .replace(/\\n/g, '<br>');
}

function openModal(id) {
  const m = TEMPLATE_META[id];
  if (!m) return;

  // 画像 URI はカードの <img> から流用（data URI の二重埋め込み回避）
  const cardImg = document.querySelector('.card[data-id="' + id + '"] img');
  modalImg.src = cardImg ? cardImg.src : '';
  modalImg.alt = id + ' プレビュー';

  const srcBadge = m.imgSource === 'thumb'
    ? '<span class="modal__badge modal__badge--src-thumb" title="160px サムネイル。scripts/refresh-catalog-previews.sh で高解像度化">thumb</span>'
    : (m.imgSource === 'hires' ? '' : '<span class="modal__badge modal__badge--src-thumb">no preview</span>');

  const nameHtml = m.name ? mdLite(m.name) : '<em class="muted">未記載</em>';
  const usageHtml = m.usage ? mdLite(m.usage) : '<span class="muted">slide-patterns.md に記載なし</span>';
  const titleRuleSection = m.title
    ? '<div class="modal__section"><div class="modal__label">タイトルの書き方</div><p class="modal__value">' + mdLite(m.title) + '</p></div>'
    : '';
  const categoryFullHtml = m.categoryFull ? mdLite(m.categoryFull) : mdLite(m.category || '');

  const tipsHtml = (m.tips && m.tips.length)
    ? '<div class="modal__section"><div class="modal__label">使い分けのヒント</div>' +
      m.tips.map(t => '<div class="modal__tip">' + mdLite(t) + '</div>').join('') +
      '</div>'
    : '';

  modalBody.innerHTML =
    '<div class="modal__badge-row">' +
      '<span class="modal__badge">' + id + '</span>' + srcBadge +
      '<span class="modal__cat">' + (m.category || '—') + '</span>' +
      '<button class="modal__copy" data-copy-id="' + id + '">ID をコピー</button>' +
    '</div>' +
    '<h2 class="modal__title" id="modal-title">' + nameHtml + '</h2>' +
    '<p class="modal__catfull">' + categoryFullHtml + '</p>' +
    '<div class="modal__section"><div class="modal__label">向いている話 / 用途</div><p class="modal__value">' + usageHtml + '</p></div>' +
    titleRuleSection +
    tipsHtml;

  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

// カードのクリックとキーボード操作
document.querySelectorAll('.card').forEach(card => {
  card.addEventListener('click', () => openModal(card.dataset.id));
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openModal(card.dataset.id);
    }
  });
});

// バックドロップ・×ボタン・Esc で閉じる
document.querySelectorAll('[data-close-modal]').forEach(el => {
  el.addEventListener('click', closeModal);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// ID コピー
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-copy-id]');
  if (!btn) return;
  const id = btn.dataset.copyId;
  navigator.clipboard && navigator.clipboard.writeText(id);
  const orig = btn.textContent;
  btn.textContent = 'コピーしました';
  setTimeout(() => { btn.textContent = orig; }, 1400);
});
</script>

</body>
</html>
`;
}

/* =========================================================
   5. main
   ======================================================== */

function main() {
  const tokens = loadTokens();

  const enoPatternsPrimary = parsePatternsMarkdown(path.join(REFERENCES_DIR, '_common', 'slide-patterns.md'));
  const enoPatternsFallback = {};
  // primary(slide-patterns.md) が優先、未記載分だけ fallback(example-deck.js) で埋める
  const enoPatterns = { ...enoPatternsFallback, ...enoPatternsPrimary };
  const diagPatterns = parsePatternsMarkdown(path.join(REFERENCES_DIR, '_common', 'diagram-patterns.md'));

  const enoImages = listImages(TEMPLATE_PREVIEWS_DIR, 'ENO-');
  const diagImages = listImages(TEMPLATE_PREVIEWS_DIR, 'DIAG-');
  const { iconMeta } = loadVisualPatterns();

  const html = renderDocument({
    enoImages,
    diagImages,
    enoPatterns,
    diagPatterns,
    iconMeta,
    tokens,
    generatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
    skillVersion: 'auto',
  });

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  fs.writeFileSync(OUTPUT_FILE, html, 'utf-8');

  const rel = path.relative(SKILL_ROOT, OUTPUT_FILE);
  console.log(`[generate-catalog] wrote ${rel}`);
  console.log(`  - ${enoImages.length} スライドテンプレ (メタあり: ${Object.keys(enoPatterns).length})`);
  console.log(`  - ${diagImages.length} ダイアグラム     (メタあり: ${Object.keys(diagPatterns).length})`);
  console.log(`  - ${Object.keys(iconMeta).length} アイコン (全 shape、scene 概念ごと撤去)`);
  console.log(`  - ${tokens.themes.length} テーマ / ${Object.keys(tokens.logoMap).length} ロゴ`);

  // v5.4: Cowork プロジェクト直下の skills/ にも常に最新版をコピー
  const projectRoot = detectProjectRoot();
  if (projectRoot) {
    const projectSkillsDir = path.join(projectRoot, 'skills');
    fs.mkdirSync(projectSkillsDir, { recursive: true });
    const projectCatalogPath = path.join(projectSkillsDir, 'CATALOG.html');
    fs.writeFileSync(projectCatalogPath, html, 'utf-8');
    console.log(`[generate-catalog] mirrored to ${projectCatalogPath}`);
  } else {
    console.log('[generate-catalog] project root not detected — skipped <project>/skills/CATALOG.html mirror');
    console.log('  (CLAUDE.md が見つからない場合は --project-root=<path> または ENOSTECH_PROJECT_ROOT env で指定可能)');
  }
}

if (require.main === module) {
  main();
}

module.exports = { main, parsePatternsMarkdown, loadTokens };
