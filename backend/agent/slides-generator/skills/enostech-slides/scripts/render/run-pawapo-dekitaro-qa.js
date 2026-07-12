#!/usr/bin/env node
/**
 * run-pawapo-dekitaro-qa.js
 * ──────────────────────────────────────────────────────────
 * 「パワポでき太郎」ペルソナによる Phase 2 専門レビューを生成する CLI。
 *
 * 役割
 *   - plan.json から全スライドの title + subtitle (subcopy) を抽出
 *   - ja-writing skill v1.0 の 4 大原則 + CHECKLIST に照らして自動レビュー
 *   - per_slide_findings[] と top_concerns[] を組み立てる
 *   - reviews[] に review_type=title-subcopy-qa の 1 サイクルとして書き込む
 *
 *
 * 使い方
 *   # 単独実行 (plan.json を更新)
 *   node scripts/render/run-pawapo-dekitaro-qa.js -i decks/{slug}/plan.json
 *
 *   # 検査だけして JSON を別ファイルに書き出す (plan.json は変更しない)
 *   node scripts/render/run-pawapo-dekitaro-qa.js -i plan.json --out review.json
 *
 *   # stdout に流す
 *   node scripts/render/run-pawapo-dekitaro-qa.js -i plan.json --stdout
 *
 *   # quiet モード (run-qa.py から呼ぶ時用)
 *   node scripts/render/run-pawapo-dekitaro-qa.js -i plan.json --quiet
 *
 * 重要事項
 *   - スコア D が出ても **fatal にしない**。書き直すかどうかは人間判断を残す。
 *   - WritingQA (機械検査) と相互補完: WritingQA が拾わない
 *     ニュアンス（体言止め連発・主述呼応・サブコピーの説得力不足）を拾う。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
  endsWithDesumasu,
  endsWithTaigen,
  isDesumasuExemptTemplate,
} = require('./lib/ja-text-helpers');

// ─── 引数パース ──────────────────────────────────────
function parseArgs(argv) {
  const args = { input: null, out: null, stdout: false, quiet: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-i' || a === '--input') args.input = argv[++i];
    else if (a === '--out' || a === '-o') args.out = argv[++i];
    else if (a === '--stdout') args.stdout = true;
    else if (a === '--quiet' || a === '-q') args.quiet = true;
    else if (a === '-h' || a === '--help') {
      console.log(fs.readFileSync(__filename, 'utf-8').split('\n').slice(1, 32).join('\n'));
      process.exit(0);
    }
  }
  return args;
}

function log(msg, quiet) {
  if (!quiet) console.error(`[dekitaro] ${msg}`);
}

// ─── スライド収集: v9 / v8 / v6 系の全形式に対応 ───────
function gatherSlides(data) {
  const slides = [];
  const seen = new Set();
  function push(s) {
    if (!s || !s.id) return;
    if (seen.has(s.id)) return;
    seen.add(s.id);
    slides.push(s);
  }
  if (Array.isArray(data.header)) data.header.forEach(push);
  if (data.body) {
    if (Array.isArray(data.body)) {
      data.body.forEach(push);
    } else if (Array.isArray(data.body.chapters)) {
      data.body.chapters.forEach(ch => {
        ['head', 'content', 'tail'].forEach(k => {
          if (Array.isArray(ch[k])) ch[k].forEach(push);
        });
      });
    }
  }
  if (Array.isArray(data.footer)) data.footer.forEach(push);
  if (Array.isArray(data.sections)) {
    data.sections.forEach(sec => {
      if (Array.isArray(sec.slides)) sec.slides.forEach(push);
    });
  }
  return slides;
}

// ─── ヒューリスティクス: ja-writing CHECKLIST に基づく検出 ──

// 翻訳調 (ja-writing checklist-translation.md より)
const TRANSLATION_PATTERNS = [
  { re: /することができ(る|ます|ず|ない)/, advice: '「することができる」→「できる」' },
  { re: /することが可能/, advice: '「することが可能」→「できる」' },
  { re: /を行(う|います|った|い、|い。)/, advice: '「を行う」→「する」' },
  { re: /を実施(する|します|した)/, advice: '「を実施する」→「する」' },
  { re: /において(は)?/, advice: '「において」→「で」' },
  { re: /に関して(は)?/, advice: '「に関して」→「について」' },
  { re: /することにより/, advice: '「することにより」→「することで」' },
  { re: /まず最初(に)?/, advice: '「まず最初に」→「まず」' },
  { re: /の中で(は)?/, advice: '「〜の中で」→「〜で」' },
  { re: /と言われている/, advice: '「と言われている」→「とされる / 〜だ」' },
];

// ハイプ語
const HYPE_PATTERNS = [
  { re: /革命的/, advice: '「革命的」→ 「大きな変化を生む」「効果のある」' },
  { re: /ゲームチェンジャー/, advice: '「ゲームチェンジャー」→ 「流れを変える」' },
  { re: /究極の/, advice: '「究極の」→ 「高い水準の」「突き詰めた」' },
  { re: /完璧な/, advice: '「完璧な」→ 「高品質の」「よくできた」' },
  { re: /魔法のよう/, advice: '「魔法のよう」→ 「スムーズに」「自然に」' },
  { re: /すべての(課題|問題|悩み)を(解決|解消)/, advice: 'すべて系の絶対化を避ける' },
  { re: /パラダイムシフト/, advice: '「パラダイムシフト」→ 「大きな変化」' },
  { re: /(圧倒的|至高|最強|最高峰|未来を変える|世界を変える)/, advice: '誇張表現は誠実さを削るので回避' },
  { re: /(^|[^一-龥])超(凄い|やばい|最強|簡単|楽|画期的)/, advice: '副詞「超」+ 強調語は誠実さを削るので回避' },
];

// AI 風メタ表現
const META_PATTERNS = [
  { re: /(\bについて(は)?[、。\s])/, advice: '「〜について」は概要感が強く主張が薄れる。具体動詞に書き換え' },
  { re: /(の概要|とは何か|の重要性|の検討|の考察)$/, advice: '名詞化メタタイトルは情報感だけで主張がない。動詞・言い切りに' },
];

// 動詞の名詞化 (体言止めの一種だが特に「〜の実現」「〜の向上」系)
const NOMINALIZATION = [
  { re: /の(実現|促進|高速化|効率化|最適化|改善|向上|削減|達成|強化|構築|整備|徹底)$/,
    advice: '「〜の実現」型の名詞化は硬いので動詞言い切りに（例: 「〜を実現する」「〜できる」）' },
];

// 主述呼応の崩れの簡易検出: 同じ助詞 4 連
function checkJoshiOverflow(text) {
  if (!text) return null;
  for (const j of ['の', 'は', 'が', 'で', 'を', 'に']) {
    const pat = new RegExp(`[^${j}\\s]+${j}`, 'g');
    const sentences = text.split(/[。．\n]/);
    for (const sen of sentences) {
      const matches = sen.match(pat) || [];
      if (matches.length >= 4) {
        return { joshi: j, count: matches.length, sentence: sen.slice(0, 40) };
      }
    }
  }
  return null;
}

// 体言止めの判定: 動詞・助動詞で終わっていない (タイトル末尾)
const VERB_END_RE = /(する|した|します|しない|だ|です|でしょう|ます|ました|る|た|い|よ|ない|ぬ|ぜ|か|？|\?)$/;
const STRONG_TAIL_RE = /(を|に|で|と|から|まで|より|へ)$/;
function isTaigenDome(title) {
  if (!title) return false;
  const t = title.trim();
  // 純粋に体言で終わっているか (動詞・助動詞で終わっていないか)
  if (VERB_END_RE.test(t)) return false;
  if (STRONG_TAIL_RE.test(t)) return false;
  // 「？」「！」「。」で終わっているなら体言止めではない
  if (/[。！？.\!\?]$/.test(t)) return false;
  return true;
}

// ─── スライド単位のスコアリング ────────────────────
function evaluateSlide(slide, ctx) {
  ctx = ctx || {};
  const title = (slide.title || '').trim();
  const subtitle = (slide.subtitle || '').trim();
  const tid = slide.template_id || '';
  const writingStrict = ctx.writingStrict !== false;

  // 表紙・章扉・閉じ系は字数規約を緩める
  const SHORT_OK = new Set([
    'SECTION-1', 'SECTION-3', 'VISUAL-3', 'SECTION-2', 'SECTION-4',
    'SECTION-5', 'VISUAL-8', 'SECSUMMARY-1', 'DIAG-04', 'DIAGRAM-4',
    'FRAMING-3', 'FRAMING-4', 'FRAMING-5', 'DATA-4', 'DATA-5',
  ]);
  // タイトル/サブコピー両方が空でも問題ないテンプレ (見取り図系・閉じ・データ表)
  const EMPTY_OK = new Set([
    'SECSUMMARY-1', 'DIAG-04', 'DIAGRAM-4',
    'SECTION-3',     // 閉じスライドはテンプレ側で自動見出し
    'DATA-1',        // データ表は本文がメインで title が無くても可
    'CHART-1', 'CHART-2', 'CHART-3', 'CHART-4', 'CHART-5',
  ]);

  const findings = [];
  let score = 'A';  // 出発点
  // ── タイトル空 / サブ空 ──
  if (!title && !subtitle) {
    if (EMPTY_OK.has(tid)) {
      // 構造的に title/subtitle 持たないテンプレなのでチェック対象外
      return null;
    }
    return {
      slide_id: slide.id,
      title: '',
      subtitle: '',
      score: 'D',
      comment: 'タイトルもサブコピーも空です。読者がスライド単独で何を伝えたいのか判断できません。',
      suggestion: 'タイトル(20-30字 / 言い切り or 主張) と サブコピー(120-200字 / 4 要素: 具体・なぜ/どうやって・読後の変化・対比) を埋めてください。',
      flags: ['empty-title-and-subtitle'],
    };
  }

  // ── タイトル評価 ──
  const titleIssues = [];
  if (title) {
    if (title.length > 38) {
      titleIssues.push(`タイトルが ${title.length} 字で長め（20-30 字推奨）`);
    }
    if (title.length < 6 && !SHORT_OK.has(tid)) {
      titleIssues.push(`タイトルが ${title.length} 字で短すぎ（主張が薄い）`);
    }
    // メタ表現
    for (const p of META_PATTERNS) {
      if (p.re.test(title)) {
        titleIssues.push(`タイトルがメタ表現 (${p.advice})`);
        break;
      }
    }
    // ハイプ語
    for (const p of HYPE_PATTERNS) {
      if (p.re.test(title)) {
        titleIssues.push(`タイトルにハイプ語: ${p.advice}`);
        break;
      }
    }
    // 翻訳調
    for (const p of TRANSLATION_PATTERNS) {
      if (p.re.test(title)) {
        titleIssues.push(`タイトルに翻訳調: ${p.advice}`);
        break;
      }
    }
    // 名詞化
    for (const p of NOMINALIZATION) {
      if (p.re.test(title)) {
        titleIssues.push(`タイトル末尾の名詞化: ${p.advice}`);
        break;
      }
    }
    // 助詞 4 連
    const j = checkJoshiOverflow(title);
    if (j) titleIssues.push(`タイトルで助詞「${j.joshi}」が ${j.count} 連 → 主述呼応が崩れます`);
  } else if (!SHORT_OK.has(tid) && !EMPTY_OK.has(tid)) {
    titleIssues.push('タイトルが空です。');
  }

  // ── サブコピー評価 ──
  const subIssues = [];
  if (subtitle) {
    const L = subtitle.length;
    if (!SHORT_OK.has(tid)) {
      if (L < 60) {
        subIssues.push(`サブコピーが ${L} 字で説明力不足（120-200 字推奨）`);
      } else if (L < 100) {
        subIssues.push(`サブコピーが ${L} 字で短め（4 要素のうち足りない要素がないか確認）`);
      } else if (L > 250) {
        subIssues.push(`サブコピーが ${L} 字で長すぎ（最大 250 字）`);
      }
    }
    // 翻訳調
    for (const p of TRANSLATION_PATTERNS) {
      if (p.re.test(subtitle)) {
        subIssues.push(`サブコピーに翻訳調: ${p.advice}`);
        break;
      }
    }
    // ハイプ語
    for (const p of HYPE_PATTERNS) {
      if (p.re.test(subtitle)) {
        subIssues.push(`サブコピーにハイプ語: ${p.advice}`);
        break;
      }
    }
    // 助詞 4 連
    const j = checkJoshiOverflow(subtitle);
    if (j) subIssues.push(`サブコピーで助詞「${j.joshi}」が ${j.count} 連 → 主述呼応が崩れます`);

    // タイトルとサブコピーが同義反復していないか
    if (title && title.length >= 4) {
      // 単純: タイトル先頭 4 文字がサブコピーにそのまま出るとき
      const head = title.slice(0, 4);
      if (head && subtitle.startsWith(head + 'について')) {
        subIssues.push('サブコピーがタイトルの同義反復になっています');
      }
    }
  } else if (!SHORT_OK.has(tid) && !EMPTY_OK.has(tid)) {
    subIssues.push('サブコピーが空 — タイトルだけでは説明力が足りません');
  }

  // 体言止めフラグ (隣接スライドの連続判定はあとで)
  const taigenDome = isTaigenDome(title);

  // タイトル + サブコピー両ありで title 体言止め or subtitle が desumasu でないと fatal (D 固定)。
  // 例外テンプレ (SECTION-1/2/3/4/5, SECSUMMARY-1) は対象外。
  // doc.writing_strict: false で warn 降格 (= D 固定にしない)。
  const writingQa13 = (() => {
    if (isDesumasuExemptTemplate(tid)) return false;
    if (!title || !subtitle) return false;
    return endsWithTaigen(title);
  })();
  const writingQa14 = (() => {
    if (isDesumasuExemptTemplate(tid)) return false;
    if (!title || !subtitle) return false;
    return !endsWithDesumasu(subtitle);
  })();

  if (writingQa13) {
    titleIssues.push(
      'WritingQA-13: 体言止めですが subtitle があります — タイトル+サブコピー両方ある時はタイトルもですます調必須'
    );
  }
  if (writingQa14) {
    subIssues.push(
      'WritingQA-14: subtitle がですます調で終わっていません — 〜です / 〜ます / 〜ません / 〜でしょう / 〜してください 等で終わる必要あり'
    );
  }

  // ── スコアリング ──
  // - 致命的 (score=D): タイトル+サブ両方空 (上で return 済), サブ長すぎ/短すぎ + 翻訳調/ハイプ ダブル違反
  // - 大きい (score=C): サブコピー説明力不足単独 / 翻訳調 / ハイプ
  // - 小さい (score=B): 字数 100 字未満 / メタタイトル / 体言止めその他
  // - 良好 (score=A): 違反なし
  // - 卓越 (score=S): 違反なし + サブコピーが理想字数 + タイトル動詞言い切り
  const totalIssues = titleIssues.length + subIssues.length;
  const writingQaHit = writingQa13 || writingQa14;
  if (writingQaHit && writingStrict) {
    score = 'D';
  } else if (writingQaHit && !writingStrict) {
    score = 'C';
  } else if (titleIssues.some(s => /翻訳調|ハイプ/.test(s)) && subIssues.some(s => /翻訳調|ハイプ/.test(s))) {
    score = 'D';
  } else if (subIssues.some(s => /説明力不足/.test(s)) ||
             titleIssues.some(s => /翻訳調|ハイプ|メタ表現|名詞化/.test(s)) ||
             subIssues.some(s => /翻訳調|ハイプ/.test(s)) ||
             titleIssues.some(s => /4 連/.test(s)) ||
             subIssues.some(s => /4 連/.test(s))) {
    score = 'C';
  } else if (totalIssues >= 2) {
    score = 'B';
  } else if (totalIssues === 1) {
    score = 'B';
  } else {
    score = 'A';
    // ── S への昇格: サブコピー字数理想 + タイトル動詞言い切り ──
    if (!SHORT_OK.has(tid)
        && subtitle.length >= 120 && subtitle.length <= 200
        && title && VERB_END_RE.test(title)) {
      score = 'S';
    }
  }

  // ── コメント ──
  const allIssues = [...titleIssues, ...subIssues];
  if (taigenDome) {
    // ctx.taigen_run でこのスライドが連続体言止めの一部かどうか後で判定
  }

  let comment = '';
  let suggestion = '';
  if (score === 'A' || score === 'S') {
    comment = (score === 'S')
      ? '理想的な字数と動詞言い切りで構成されており、読み手にスッと入ります。'
      : '気になる点はありません。';
  } else {
    comment = allIssues.length === 0
      ? '大きな違反はないものの、読み手目線で 1 段階磨ける余地があります。'
      : '気になる点を整理しました: ' + allIssues.join(' / ');
  }

  // 提案文 (ですます調)
  const suggestParts = [];
  if (titleIssues.length) {
    if (writingQa13) {
      suggestParts.push(`タイトル: 「${title}」は体言止めですが subtitle があるためですます調が必須 (WritingQA-13)。例: 「〜のポイント」→「〜のポイントを押さえます」 / 「〜と注意点」→「〜と注意点を整理します」のように述語を補ってください。`);
    } else if (taigenDome && titleIssues.some(s => /メタ|名詞化|短すぎ/.test(s))) {
      suggestParts.push(`タイトル: 「${title}」は体言止め単独だと主張が伝わりにくいので、動詞言い切り (例: 「${title}〜する / 〜できる」のように述語を加える) に書き換えてみてください。`);
    } else if (titleIssues.some(s => /メタ表現/.test(s))) {
      suggestParts.push(`タイトル: 「${title}」は概要感が強いので、何を主張したいかを動詞で言い切ってください (例: 「〜について」→「〜の核は〇〇」)。`);
    } else if (titleIssues.length) {
      suggestParts.push(`タイトル: 「${title}」を ${titleIssues[0]} の観点で書き直してください。`);
    }
  }
  if (subIssues.length) {
    if (writingQa14) {
      suggestParts.push(`サブコピー: 最終文をですます調 (〜です / 〜ます / 〜ません / 〜でしょう / 〜してください / 〜になります 等) に書き直してください (WritingQA-14)。タイトルが体言止め単独で十分な場合は subtitle を消すという選択肢もあります。`);
    } else if (subIssues.some(s => /説明力不足/.test(s))) {
      suggestParts.push(`サブコピー: 現行 ${subtitle.length} 字。R2-4 の 4 要素 (具体: 数値・固有名 / なぜどうやって / 読後の変化 / 対比) を盛り込み、120-200 字に増やしてください。`);
    } else if (subIssues.some(s => /長すぎ/.test(s))) {
      suggestParts.push(`サブコピー: 現行 ${subtitle.length} 字。1 文を分割し、要点を 2 文に再構成して 200 字程度に収めてください。`);
    } else if (subIssues.some(s => /翻訳調/.test(s))) {
      suggestParts.push(`サブコピー: 翻訳調を ja-writing/references/checklist-translation.md の置換表で除去してください。`);
    } else if (subIssues.length) {
      suggestParts.push(`サブコピー: ${subIssues[0]}`);
    }
  }
  suggestion = suggestParts.join(' ');

  return {
    slide_id: slide.id,
    title,
    subtitle,
    score,
    comment,
    suggestion: suggestion || '— 大きな書き直しは不要です。',
    flags: [
      ...(taigenDome ? ['taigen-dome'] : []),
      ...(writingQa13 ? ['writing-qa-13'] : []),
      ...(writingQa14 ? ['writing-qa-14'] : []),
      ...(allIssues.length ? ['minor-issues'] : []),
    ],
  };
}

// ─── 体言止め連発検出 (3 枚以上連続) ─────────────────
function detectTaigenRuns(findings) {
  const runs = [];
  let cur = [];
  for (const f of findings) {
    if (!f) { if (cur.length >= 3) runs.push(cur); cur = []; continue; }
    if (f.flags && f.flags.includes('taigen-dome')) {
      cur.push(f.slide_id);
    } else {
      if (cur.length >= 3) runs.push(cur);
      cur = [];
    }
  }
  if (cur.length >= 3) runs.push(cur);
  return runs;
}

// ─── サマリー組み立て ──────────────────────────────
function buildReview(plan) {
  const slides = gatherSlides(plan);
  const writingStrict = !(plan && plan.doc && plan.doc.writing_strict === false);
  const ctx = { writingStrict };
  const findings = [];
  for (const s of slides) {
    const f = evaluateSlide(s, ctx);
    if (f) findings.push(f);
  }

  // 体言止め連発 → 該当スライドの comment を補強
  const runs = detectTaigenRuns(findings);
  if (runs.length > 0) {
    for (const run of runs) {
      run.forEach((sid, idx) => {
        const f = findings.find(x => x.slide_id === sid);
        if (!f) return;
        const tag = `（体言止めが ${run.length} 連: ${run.join(' / ')}）`;
        if (!f.comment.includes('体言止めが')) {
          f.comment = (f.comment.replace(/^気になる点はありません。$/, '') + ' ' + tag).trim();
          // スコアを最低 B に降格
          if (['S', 'A'].includes(f.score)) f.score = 'B';
        }
      });
    }
  }

  // 統計
  const counter = { S: 0, A: 0, B: 0, C: 0, D: 0 };
  for (const f of findings) counter[f.score]++;
  const totalFindings = findings.length;
  const concernedFindings = findings.filter(f => ['B', 'C', 'D'].includes(f.score));
  // top_concerns: スコアの低い順 / D > C > B、同スコア内では文字数欠陥が大きい順
  const scoreRank = { D: 4, C: 3, B: 2, A: 1, S: 0 };
  const sorted = [...concernedFindings].sort((a, b) => {
    return scoreRank[b.score] - scoreRank[a.score];
  });
  const topConcerns = sorted.slice(0, 5).map(f => ({
    slide_id: f.slide_id,
    headline: `[${f.score}] ${f.comment.slice(0, 50)}${f.comment.length > 50 ? '…' : ''}`,
  }));

  // ── final_check 文を組み立てる ──
  const messages = [];
  const dCount = counter.D;
  const cCount = counter.C;
  const bCount = counter.B;
  const wqa13Hits = findings.filter(f => f.flags && f.flags.includes('writing-qa-13')).length;
  const wqa14Hits = findings.filter(f => f.flags && f.flags.includes('writing-qa-14')).length;
  if (wqa13Hits > 0 || wqa14Hits > 0) {
    const sevLabel = writingStrict ? 'fatal (D 固定)' : 'warn (C 降格)';
    messages.push(`すます調統一ルール ${sevLabel}: WritingQA-13 (タイトル体言止め) ${wqa13Hits} 件 / WritingQA-14 (サブコピー非desumasu) ${wqa14Hits} 件。タイトル+サブコピー両方ある時は、タイトル・サブコピーともに「〜です / 〜ます / 〜ません / 〜でしょう / 〜してください」等で終わらせてください。`);
  }
  if (dCount > 0) {
    messages.push(`要書き直し (D) が ${dCount} 枚あります。空タイトル/空サブコピー、翻訳調+ハイプ語のダブル違反、ですます調統一ルール違反など、土台から見直したい箇所です。`);
  }
  if (cCount > 0) {
    messages.push(`説明力不足や翻訳調が目立つ枚 (C) が ${cCount} 枚。サブコピーを 120-200 字に拡張し、4 要素 (具体・なぜ/どうやって・読後の変化・対比) で書き直すと一気に締まります。`);
  }
  if (runs.length > 0) {
    messages.push(`体言止めが 3 枚以上連続している箇所が ${runs.length} カ所 (${runs.map(r => r.join('/')).join(', ')})。文末を「〜する / 〜できる / 〜です」と多様化すると単調さが消えます。`);
  }
  if (messages.length === 0) {
    messages.push('全体的に整っており、大きな手戻りは不要です。');
  }
  // 最後に必ず締めを入れる
  messages.push('per_slide_findings の suggestion を順番に当てていけば、半日でほぼ仕上がる手応えです。');

  const review = {
    cycle_num: 5,
    cycle_desc: '全スライドのタイトル+サブコピーを日本語ライティング観点で総点検 (パワポでき太郎)',
    review_type: 'title-subcopy-qa',
    persona: {
      avatar: '📐',
      name: 'パワポでき太郎',
      role: 'プロフェッショナル パワポコンサルタント / 30 年選手',
      bio: '外資コンサル系で 30 年スライドを叩いてきたプロです。ja-writing skill の 4 原則と CHECKLIST を物差しに、伝わりやすさ / 自然な日本語 / 体言止め乱用防止を厳しく見ます。指摘の隣には必ず改善提案を添えるのがポリシーです。',
      traits: [
        { label: '専門', value: 'タイトル+サブコピーの日本語' },
        { label: '口調', value: 'ですます調 / 厳しい目利き + 必ず改善提案' },
        { label: '物差し', value: 'ja-writing 4 原則 + CHECKLIST' },
      ],
    },
    summary: {
      title: `全 ${totalFindings} 枚を点検しました`,
      stats: [
        `S: ${counter.S} 枚 / A: ${counter.A} 枚 / B: ${counter.B} 枚 / C: ${counter.C} 枚 / D: ${counter.D} 枚`,
        `要再考 (B 以下): ${concernedFindings.length} 枚`,
        `体言止めが 3 枚以上連続: ${runs.length} カ所`,
        `WritingQA-13 (タイトル体言止め+subtitle): ${wqa13Hits} 件 / WritingQA-14 (subtitle 非desumasu): ${wqa14Hits} 件 [${writingStrict ? 'fatal' : 'warn'}]`,
      ],
    },
    per_slide_findings: findings,
    top_concerns: topConcerns,
    issues: [],   // generic 形式の互換用（空）
    final_check: {
      title: '全体総評（パワポでき太郎より）',
      body: messages.join(' '),
    },
  };
  return review;
}

// ─── plan.json への書き戻し (review_type=title-subcopy-qa を置換 or 追加) ──
function attachReview(plan, review) {
  if (!Array.isArray(plan.reviews)) plan.reviews = [];
  plan.reviews = plan.reviews.filter(c =>
    !(c && typeof c === 'object' && c.review_type === 'title-subcopy-qa'));
  plan.reviews.push(review);
  return plan;
}

// ─── main ─────────────────────────────────────────
function main() {
  const args = parseArgs(process.argv);
  if (!args.input) {
    console.error('usage: run-pawapo-dekitaro-qa.js -i <plan.json> [--out <file>] [--stdout] [--quiet]');
    process.exit(2);
  }
  const inputPath = path.resolve(args.input);
  if (!fs.existsSync(inputPath)) {
    console.error(`[dekitaro] plan.json が見つかりません: ${inputPath}`);
    process.exit(2);
  }
  log(`読み込み: ${inputPath}`, args.quiet);
  const raw = fs.readFileSync(inputPath, 'utf-8');
  let plan;
  try { plan = JSON.parse(raw); }
  catch (e) {
    console.error(`[dekitaro] JSON parse エラー: ${e.message}`);
    process.exit(2);
  }

  const review = buildReview(plan);
  log(`per_slide_findings: ${review.per_slide_findings.length} 件 / top_concerns: ${review.top_concerns.length} 件`, args.quiet);
  log(`スコア分布: S=${review.summary.stats[0].match(/S: (\d+)/)[1]}, A=${review.summary.stats[0].match(/A: (\d+)/)[1]}, B=${review.summary.stats[0].match(/B: (\d+)/)[1]}, C=${review.summary.stats[0].match(/C: (\d+)/)[1]}, D=${review.summary.stats[0].match(/D: (\d+)/)[1]}`, args.quiet);

  if (args.stdout) {
    process.stdout.write(JSON.stringify(review, null, 2));
    return;
  }
  if (args.out) {
    fs.writeFileSync(path.resolve(args.out), JSON.stringify(review, null, 2));
    log(`書き出し: ${args.out}`, args.quiet);
    return;
  }
  // デフォルト: plan.json を更新
  attachReview(plan, review);
  fs.writeFileSync(inputPath, JSON.stringify(plan, null, 2) + '\n');
  log(`plan.json 更新: ${inputPath} (reviews[] に review_type=title-subcopy-qa を追加/置換)`, args.quiet);
}

if (require.main === module) {
  main();
}

module.exports = { gatherSlides, evaluateSlide, buildReview, attachReview };
