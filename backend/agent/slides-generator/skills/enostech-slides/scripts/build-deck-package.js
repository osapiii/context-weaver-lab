// ==========================================================================
//
//  Phase 4 末尾の decks/ 機械整形エントリポイント。
//  Phase 1 R1-4 で先切りされた decks/yyyy-mm-dd_{slug}/ を最終整形する。
//  draft/draft.pptx を 資料.pptx に昇格、plan.html / preview/ の定置確認、
//  ナレーション台本.md の集約、 レポート.html の補足生成、
//  (v10.8.0 追加 / C-19) スライドQA.csv の生成と全 ✅/🔺 fatal ガードまでを 1 コマンドで完了させる。
//
//  v10.8.0 (2026-05-12) — C-19 (新設核ルール) スライドQA.csv の生成を 6/6 ステップに追加:
//    - scripts/build-slide-qa-csv.py を呼び出し、固定 10 列の CSV を decks/{slug}/ に配置
//    - 全行 ✅ または 🔺(+notes) でなければ fatal 停止 (承認を通さない)
//    - doc.qa_csv_strict: false で warn 降格 (旧式デッキ regression 用)
//    - 大サボり防止セット (C-18 自己判断スキップ禁止 + C-19 CSV 証跡義務化) の片翼
//
//    - plan.json の各スライドが持つ html_supplement.enabled = true を集約して
//      decks/{slug}/レポート.html を生成 (single-file, インライン CSS/JS)
//    - PPTX は引き続き SSOT。HTML はあくまで「PPTX のここは噛み砕きたい」と
//      判断したスライドにだけ補足を貼るサプリメント (両方セットで読む前提)
//    - 補足ありが 0 枚ならスキップ (このデッキは PPTX 単独で十分と判定)
//    - は失敗しても warn 止まり、fatal 化予定
//
//   - DECK_DIR が既に存在する前提で動く（不在時は mkdir + 警告で互換）
//   - --pptx 省略時は ${DECK_DIR}/draft/draft.pptx を自動採用
//   - 同一パスの cp は no-op に置き換え（自己参照運用が冪等に動く）
//   - draft/draft.pptx → 資料.pptx は mv で昇格（同一 DECK_DIR 内で完結）
//   - --plan が ${DECK_DIR}/plan.html を指す時は定置確認のみで no-op
//   - --preview-dir が ${DECK_DIR}/preview を指す時も同様に no-op
//   - --date 引数を新設（既存 DECK_DIR を後から packaging する時用）
//
//
//
//
//  最終ディレクトリ構造:
//    decks/yyyy-mm-dd_{slug}/
//    ├── 資料.pptx          — デッキ本体（SSOT、draft/draft.pptx から昇格）
//    ├── レポート.html      — PPTX 補足。html_supplement あり 0 枚ならスキップ
//    ├── スライドQA.csv    — (v10.8.0 / C-19) 1 行 1 スライド × 8 QA 列 + notes。全 ✅/🔺 必須
//    ├── plan.json          — plan.html のソース。html_supplement の正本
//    ├── ナレーション台本.md — speaker notes (ナレーション台本) を markdown に集約
//    ├── draft/             — Phase 3 中間成果物（昇格後は draft.pptx は移動済み）
//    └── preview/
//        ├── slide-01.png 〜 slide-NN.png
//        └── contact-sheet.png
//
//  [CLI]
//    node build-deck-package.js \
//      --slug          facthub-intro \                           ← ✅必須
//      --title         "FactHub 紹介資料" \                       ← ✅必須
//      --plan          ${DECK_DIR}/plan.html                     ← ✅必須
//      [--pptx         ${DECK_DIR}/draft/draft.pptx]             ← 省略時は自動採用
//      [--skip-plan]                                             ← plan.html を意図的に省く時だけ明示
//      [--project-root <Cowork プロジェクトの絶対パス>]            ← 省略時は自動検出
//      [--preview-dir  ${DECK_DIR}/preview]                      ← 省略時は自動採用
//      [--contact-sheet <コンタクトシート画像>]                    ← 既に preview-dir 内にあれば不要
//      [--date         yyyy-mm-dd]                               ← 既存 DECK_DIR の日付を上書きしたい時
//
//  [project-root 自動検出]
//    --project-root 省略時は次の順で探索:
//      1. 環境変数 ENOSTECH_PROJECT_ROOT
//      2. process.cwd() から最大 6 階層遡って CLAUDE.md があるディレクトリ
//    どちらも見つからなければエラーで停止。
//
//  [既存 DECK_DIR の解決規則]
//    DECK_DIR = decks/{date}_{slug} で組み立てる。date は次の順で決定:
//      1. --date 引数が明示されていれば採用（既存 DECK_DIR を後から packaging する時用）
//      2. decks/ 配下に *_{slug} の既存ディレクトリが 1 つだけあればその日付を採用
//         （Phase 1 R1-4 で先切りされたものを尊重）
//      3. 上記いずれも該当しなければ today (UTC) を採用
//    DECK_DIR が存在しない時は mkdir + 警告ログ。Phase 1 R1-4 を踏んでいない呼び出し
//    でもクラッシュせずに動く互換を維持する。
//
//  [Node API]
//    const { buildDeckPackage } = require('./build-deck-package');
//    await buildDeckPackage({ slug, title, planPath, ... });
//    // skipPlan: true にした場合のみ planPath を省略可能。それ以外はエラー。
// ==========================================================================

const fs = require('node:fs');
const path = require('node:path');
const { execSync, spawnSync } = require('node:child_process');

// --------------------------------------------------------------------------
// パスユーティリティ
// --------------------------------------------------------------------------

/**
 * realpath が解決できないパス（未作成ファイル）でも安全に正規化する。
 * realpath 失敗時は path.resolve で正規化したものを返す。
 */
function realpathSafe(p) {
  if (!p) return null;
  try {
    return fs.realpathSync(p);
  } catch (_) {
    return path.resolve(p);
  }
}

function samePath(a, b) {
  if (!a || !b) return false;
  return realpathSafe(a) === realpathSafe(b);
}

/**
 * src を dst に「コピーまたは移動」する。
 *   - move=true なら fs.renameSync、デバイスを跨いで失敗したら cp + unlink にフォールバック
 *   - move=false なら fs.copyFileSync
 */
function placeFile(src, dst, { move = false } = {}) {
  if (samePath(src, dst)) {
    return { action: 'noop', src, dst };
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  if (move) {
    try {
      fs.renameSync(src, dst);
      return { action: 'move', src, dst };
    } catch (e) {
      if (e.code === 'EXDEV') {
        // クロスデバイス。cp + unlink でフォールバック
        fs.copyFileSync(src, dst);
        fs.unlinkSync(src);
        return { action: 'move-via-copy', src, dst };
      }
      throw e;
    }
  }
  fs.copyFileSync(src, dst);
  return { action: 'copy', src, dst };
}

// --------------------------------------------------------------------------
// project-root 自動検出
// --------------------------------------------------------------------------
function detectProjectRoot(explicit) {
  if (explicit) return path.resolve(explicit);
  if (process.env.ENOSTECH_PROJECT_ROOT) {
    return path.resolve(process.env.ENOSTECH_PROJECT_ROOT);
  }
  let cur = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(cur, 'CLAUDE.md'))) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  throw new Error('--project-root が指定されておらず、CLAUDE.md も見つけられませんでした。--project-root を明示してください。');
}

// --------------------------------------------------------------------------
//   - --date 明示 > 既存 *_{slug} の日付検出 > today (UTC) の優先順位
//   - 既存ディレクトリが見つかればそれを採用、無ければ mkdir + 警告
// --------------------------------------------------------------------------
function resolveDeckDir(root, slug, explicitDate) {
  const decksRoot = path.join(root, 'decks');
  fs.mkdirSync(decksRoot, { recursive: true });

  let date = explicitDate || null;

  if (!date) {
    // 既存の {date}_{slug} を探す（Phase 1 R1-4 で先切りされたものを尊重）
    const slugSuffix = `_${slug}`;
    const existing = fs.readdirSync(decksRoot)
      .filter(name => {
        if (!name.endsWith(slugSuffix)) return false;
        const dateLen = name.length - slugSuffix.length;
        const datePart = name.slice(0, dateLen);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return false;
        try {
          return fs.statSync(path.join(decksRoot, name)).isDirectory();
        } catch (_) {
          return false;
        }
      });

    if (existing.length === 1) {
      const matched = existing[0];
      date = matched.slice(0, matched.length - slugSuffix.length);
    } else if (existing.length > 1) {
      existing.sort();
      const latest = existing[existing.length - 1];
      date = latest.slice(0, latest.length - slugSuffix.length);
      console.warn(
        `[deck-dir] slug "${slug}" に該当する既存ディレクトリが ${existing.length} 件あります: ${existing.join(', ')}\n` +
        `           最新の "${latest}" を採用します。意図と違う場合は --date で明示してください。`
      );
    }
  }

  if (!date) {
    date = new Date().toISOString().slice(0, 10);
  }

  const deckDir = path.join(decksRoot, `${date}_${slug}`);

  if (!fs.existsSync(deckDir)) {
    fs.mkdirSync(deckDir, { recursive: true });
    console.warn(
      `[deck-dir] ${path.relative(root, deckDir)} が存在しなかったため新規作成しました。\n` +
      `           Phase 1 R1-4 で先切りする運用が推奨です。`
    );
  }

  return { deckDir, date };
}

// --------------------------------------------------------------------------
// preview PNG 群の生成（pptx-to-images.sh に委譲）
// --------------------------------------------------------------------------
function generatePreviewPngs(pptxPath, outDir) {
  const scriptPath = path.join(__dirname, 'pptx-to-images.sh');
  fs.mkdirSync(outDir, { recursive: true });
  const result = spawnSync('bash', [scriptPath, pptxPath, outDir], { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`pptx-to-images.sh が失敗しました (exit=${result.status})`);
  }
}

// --------------------------------------------------------------------------
// contact-sheet 生成（ImageMagick montage）
// --------------------------------------------------------------------------
function ensureContactSheet(previewDir) {
  const sheetPath = path.join(previewDir, 'contact-sheet.png');
  if (fs.existsSync(sheetPath)) return sheetPath;
  const slides = fs.readdirSync(previewDir)
    .filter(f => /^slide-\d+\.png$/.test(f))
    .sort();
  if (slides.length === 0) {
    console.warn('[contact-sheet] preview/ に slide-NN.png が無いのでスキップ');
    return null;
  }
  const inputs = slides.map(f => `"${path.join(previewDir, f)}"`).join(' ');
  const tile = `${Math.min(slides.length, 4)}x`;
  try {
    execSync(`montage ${inputs} -tile ${tile} -geometry 320x+8+8 -background white "${sheetPath}"`, { stdio: 'inherit' });
    return sheetPath;
  } catch (e) {
    console.warn(`[contact-sheet] montage 失敗: ${e.message}`);
    return null;
  }
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
function extractNarrationScript(pptxPath, outPath, deckTitle) {
  const scriptPath = path.join(__dirname, 'build-narration.py');
  const result = spawnSync('python3', [
    scriptPath,
    '--pptx', pptxPath,
    '--out', outPath,
    '--deck-title', deckTitle,
  ], { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`build-narration.py が失敗しました (exit=${result.status})`);
  }
}

// --------------------------------------------------------------------------
// メインエントリ
// --------------------------------------------------------------------------
async function buildDeckPackage(opts) {
  const {
    pptxPath: pptxPathExplicit,
    slug, title, planPath, skipPlan,
    projectRoot, previewDir: previewDirExplicit, contactSheet,
    date: explicitDate,
  } = opts;

  if (!slug) throw new Error('slug は必須です');
  if (!title) throw new Error('title は必須です');
  if (!skipPlan) {
    if (!planPath) {
      throw new Error(
        '--plan は必須です（v6.15〜）。Phase 2 で書き出した HTML 指示書のパスを渡してください。\n' +
        '  例: --plan ${DECK_DIR}/plan.html\n' +
        '\n' +
        'Phase 2 で plan.html を生成する手順:\n' +
        '  python3 <skill-root>/scripts/render-deck-instruction.py \\\n' +
        '    --input  ${DECK_DIR}/plan.json \\\n' +
        '    --output ${DECK_DIR}/plan.html\n' +
        '\n' +
        'どうしても plan.html を含めたくない例外ケース（過去デッキの再パッケージで\n' +
        '指示書が紛失している等）の場合のみ、--skip-plan を明示してください。'
      );
    }
    if (!fs.existsSync(planPath)) {
      throw new Error(
        `--plan で指定されたファイルが存在しません: ${planPath}\n` +
        'パスを再確認するか、Phase 2 の HTML 指示書を render-deck-instruction.py で\n' +
        'もう一度生成してから渡してください。'
      );
    }
  }

  // qa_report.json の存在 + plan_sha256 整合 + phase_completed に "phase2" + "phase4"
  // が両方含まれていることを検証。失敗時は throw して exit 2 相当。
  // --skip-qa-gate を明示しない限り必ず通す。
  if (!opts.skipQaGate) {
    const planJsonPath = planPath
      ? planPath.replace(/\.html?$/, '.json')
      : null;
    if (planJsonPath && fs.existsSync(planJsonPath)) {
      const deckDir = path.dirname(planJsonPath);
      const result = spawnSync('python3', [
        path.join(__dirname, 'qa-report-io.py'),
        'gate',
        '--plan', planJsonPath,
      ], { encoding: 'utf-8' });
      if (result.status !== 0) {
        const reason = (result.stdout || '').match(/reason=(.+)/)?.[1] || result.stdout || result.stderr;
        throw new Error(
          `🚨 Phase 4 ゲートで停止 (qa_report.json 検証失敗):\n  ${reason}\n\n` +
          `この検証をスキップするには --skip-qa-gate を明示してください (非推奨、デバッグ用)。`
        );
      }
      console.log('[gate] qa_report.json 検証 pass');
    }
  }

  const root = detectProjectRoot(projectRoot);
  const { deckDir, date } = resolveDeckDir(root, slug, explicitDate);
  console.log(`[deck-dir] ${path.relative(root, deckDir)}  (date=${date})`);

  // --pptx 省略時は ${DECK_DIR}/draft/draft.pptx を自動採用
  let pptxPath = pptxPathExplicit;
  if (!pptxPath) {
    pptxPath = path.join(deckDir, 'draft', 'draft.pptx');
    if (!fs.existsSync(pptxPath)) {
      throw new Error(
        '--pptx が省略され、自動採用先 ${DECK_DIR}/draft/draft.pptx も存在しません。\n' +
        `  自動採用先: ${pptxPath}\n` +
        'Phase 3 で draft.pptx を ${DECK_DIR}/draft/draft.pptx に出力するか、\n' +
        '--pptx で明示的にパスを指定してください。'
      );
    }
    console.log(`[pptx]     省略のため ${path.relative(root, pptxPath)} を自動採用`);
  }
  if (!fs.existsSync(pptxPath)) {
    throw new Error(`--pptx で指定された pptx が存在しません: ${pptxPath}`);
  }

  const pptxOut = path.join(deckDir, '資料.pptx');
  const draftPptxCanonical = path.join(deckDir, 'draft', 'draft.pptx');

  // 1. 資料.pptx を配置
  //    - src が ${DECK_DIR}/draft/draft.pptx なら mv で昇格
  //    - それ以外 (外部パス指定) は cp で 互換 //    - src と dst が同一実体なら no-op (再実行に対する冪等性を担保)
  if (samePath(pptxPath, pptxOut)) {
    console.log(`[1/6] 資料.pptx は既に定置済み (no-op): ${path.relative(root, pptxOut)}`);
  } else if (samePath(pptxPath, draftPptxCanonical)) {
    placeFile(pptxPath, pptxOut, { move: true });
    console.log(`[1/6] 資料.pptx を昇格: ${path.relative(root, draftPptxCanonical)} → ${path.relative(root, pptxOut)}`);
  } else {
    placeFile(pptxPath, pptxOut, { move: false });
    console.log(`[1/6] 資料.pptx を配置 (外部パスから cp): ${path.relative(root, pptxOut)}`);
  }

  // 1-b. hyperlink 色のテーマ上書き（<ahyp:hlinkClr val="tx"/>）を剥がす。
  //      PptxGenJS が自動挿入する Office 2018 拡張で、PowerPoint 表示時に
  //      inlineRef の青文字 (#0563C1) が黒で表示されてしまう問題を回避する。
  const fixHlinkScript = path.join(__dirname, 'fix-hyperlink-color.py');
  if (fs.existsSync(fixHlinkScript)) {
    const fixResult = spawnSync('python3', [fixHlinkScript, pptxOut], { stdio: 'inherit' });
    if (fixResult.status !== 0) {
      console.warn('  ⚠ fix-hyperlink-color.py が失敗。リンク色がテーマ tx で表示される可能性があります');
    }
  }

  if (skipPlan) {
    console.warn(`[2/6] plan.html を意図的にスキップ (--skip-plan 指定)`);
  } else {
    const planOut = path.join(deckDir, 'plan.html');
    if (samePath(planPath, planOut)) {
      console.log(`[2/6] plan.html は既に定置済み (no-op): ${path.relative(root, planOut)}`);
    } else {
      placeFile(planPath, planOut, { move: false });
      console.log(`[2/6] plan.html を配置: ${path.relative(root, planOut)}`);
    }
  }

  // 3. preview PNG 群を配置
  const previewOut = path.join(deckDir, 'preview');
  fs.mkdirSync(previewOut, { recursive: true });

  if (previewDirExplicit && fs.existsSync(previewDirExplicit)) {
    if (samePath(previewDirExplicit, previewOut)) {
      const count = fs.readdirSync(previewOut).length;
      console.log(`[3/6] preview/ は既に定置済み (no-op, ${count} 件): ${path.relative(root, previewOut)}`);
    } else {
      for (const f of fs.readdirSync(previewDirExplicit)) {
        const src = path.join(previewDirExplicit, f);
        if (fs.statSync(src).isFile()) {
          fs.copyFileSync(src, path.join(previewOut, f));
        }
      }
      console.log(`[3/6] preview/ をコピー (${fs.readdirSync(previewOut).length} 件)`);
    }
  } else {
    // 既に preview/ にスライド画像が揃っていれば再生成不要
    const existingSlides = fs.readdirSync(previewOut).filter(f => /^slide-\d+\.png$/.test(f));
    if (existingSlides.length > 0) {
      console.log(`[3/6] preview/ は既に ${existingSlides.length} 枚のスライド画像があるため再生成スキップ`);
    } else {
      generatePreviewPngs(pptxOut, previewOut);
      console.log(`[3/6] preview/ を新規生成`);
    }
  }
  // contact-sheet の確保
  if (contactSheet && fs.existsSync(contactSheet)) {
    const sheetDst = path.join(previewOut, 'contact-sheet.png');
    if (!samePath(contactSheet, sheetDst)) {
      fs.copyFileSync(contactSheet, sheetDst);
    }
  } else {
    ensureContactSheet(previewOut);
  }

  // 4. ナレーション台本.md を抽出
  const narrationOut = path.join(deckDir, 'ナレーション台本.md');
  extractNarrationScript(pptxOut, narrationOut, title);
  console.log(`[4/6] ナレーション台本.md を抽出: ${path.relative(root, narrationOut)}`);

  // 5. HTML 補足レポートの生成
  //    - PPTX が SSOT。html_supplement.enabled = true のスライドが 1 枚以上あれば
  //      レポート.html を生成。0 枚ならスキップ (このデッキは PPTX 単独で十分と判定)。
  //    - は未生成でも warn 止まり。fatal 化予定。
  const planJsonForReport = planPath ? planPath.replace(/\.html?$/, '.json') : null;
  if (planJsonForReport && fs.existsSync(planJsonForReport)) {
    try {
      const { buildHtmlReport } = require('./render/build-html-report');
      const result = buildHtmlReport({
        planPath: planJsonForReport,
        outPath: path.join(deckDir, 'レポート.html'),
        titleOverride: title,
        quiet: false,
      });
      if (result.skipped) {
        console.log(`[5/6] レポート.html はスキップ (html_supplement.enabled = true が 0 件)`);
      } else {
        console.log(`[5/6] レポート.html を生成: ${path.relative(root, result.outPath)}`);
      }
    } catch (e) {
      console.warn(`  ⚠ build-html-report.js が失敗 (warn): ${e.message || e}`);
      console.warn(`     は warn 扱い。fatal 化予定。`);
    }
  } else {
    console.warn(`[5/6] plan.json が見つからないためレポート.html 生成をスキップ`);
  }


  // ----------------------------------------------------------------------------
  // [6/6] スライドQA.csv (C-19 / v10.8.0 新設) — Phase 4 QA の証跡を per-slide で固定列 CSV に出力。
  //   ・contact-sheet.png と同じ位置付け = 毎回必ず生成
  //   ・全行 ✅ または 🔺(+notes) でなければ fatal 停止 (doc.qa_csv_strict: false で warn 降格)
  //   ・実装は scripts/build-slide-qa-csv.py
  // ----------------------------------------------------------------------------
  {
    const planJsonForCsv = planPath ? planPath.replace(/\.html?$/, '.json') : null;
    if (planJsonForCsv && fs.existsSync(planJsonForCsv)) {
      // strict / warn-only を doc.qa_csv_strict で決定
      let strictMode = true;
      try {
        const planData = JSON.parse(fs.readFileSync(planJsonForCsv, 'utf-8'));
        if (planData && planData.doc && planData.doc.qa_csv_strict === false) {
          strictMode = false;
        }
      } catch (e) {
        // 読めない場合は default strict を維持
      }
      const csvPath = path.join(deckDir, 'スライドQA.csv');
      const csvScript = path.join(__dirname, 'build-slide-qa-csv.py');
      const csvArgs = ['--plan', planJsonForCsv, '--out', csvPath];
      if (!strictMode) csvArgs.push('--warn-only');
      const csvResult = spawnSync('python3', [csvScript, ...csvArgs], {
        cwd: root,
        encoding: 'utf-8',
        stdio: ['ignore', 'inherit', 'inherit'],
      });
      if (csvResult.status === 0) {
        console.log(`[6/6] スライドQA.csv を生成: ${path.relative(root, csvPath)}`);
      } else if (csvResult.status === 1) {
        // C-19 fatal: 全 ✅/🔺 を満たしていない
        if (strictMode) {
          console.error('');
          console.error('❌ [6/6] C-19 fatal: スライドQA.csv の全行 ✅/🔺 ガードに失敗しました。');
          console.error('   Phase 4 QA 工程の完走を確認し、空欄行を解消してから再実行してください。');
          console.error('   - 残 QA を完走: python3 scripts/run-qa.py phase4 --plan ' + path.relative(root, planJsonForCsv));
          console.error('   - 妥協を許容するセルは --apply-manual で 🔺 + notes を記入');
          console.error('   - 旧式デッキ regression を吸収する場合は plan.json に doc.qa_csv_strict: false を追加');
          console.error('');
          throw new Error('C-19 fatal: スライドQA.csv に未パス行が残っているため承認を通せません');
        } else {
          console.warn(`[6/6] スライドQA.csv は生成済み (warn 降格 / doc.qa_csv_strict: false): ${path.relative(root, csvPath)}`);
        }
      } else {
        // 想定外のエラー
        const msg = `[6/6] build-slide-qa-csv.py が異常終了 (exit ${csvResult.status})`;
        if (strictMode) {
          throw new Error(msg);
        } else {
          console.warn(msg + ' — warn 扱いで継続');
        }
      }
    } else {
      console.warn(`[6/6] plan.json が見つからないためスライドQA.csv 生成をスキップ`);
    }
  }

  console.log(`\n✅ パッケージ完了: ${path.relative(root, deckDir)}`);
  return { deckDir };
}

// --------------------------------------------------------------------------
// CLI エントリ
// --------------------------------------------------------------------------
function parseCli(argv) {
  const opts = {};
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--pptx') opts.pptxPath = argv[++i];
    else if (k === '--slug') opts.slug = argv[++i];
    else if (k === '--title') opts.title = argv[++i];
    else if (k === '--plan' || k === '--instruction') opts.planPath = argv[++i];
    else if (k === '--skip-plan') opts.skipPlan = true;
    else if (k === '--skip-qa-gate') opts.skipQaGate = true;
    else if (k === '--project-root') opts.projectRoot = argv[++i];
    else if (k === '--preview-dir') opts.previewDir = argv[++i];
    else if (k === '--contact-sheet') opts.contactSheet = argv[++i];
    else if (k === '--date') opts.date = argv[++i];
    else if (k === '--help' || k === '-h') {
      console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(0, 65).join('\n'));
      process.exit(0);
    } else {
      console.error(`Unknown flag: ${k}`);
      process.exit(2);
    }
  }
  return opts;
}

if (require.main === module) {
  const opts = parseCli(process.argv);
  buildDeckPackage(opts).catch(err => {
    console.error(err.stack || err.message || err);
    process.exit(1);
  });
}

module.exports = {
  buildDeckPackage,
  // テスト・拡張用にユーティリティを公開
  _internal: { samePath, realpathSafe, placeFile, resolveDeckDir, detectProjectRoot },
};
