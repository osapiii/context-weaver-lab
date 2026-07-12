/**
 * ja-text-helpers.js
 * ──────────────────────────────────────────────────────────
 * 日本語テキストの「ですます調」「体言止め」を簡易判定するヘルパー。
 * Python 側 `scripts/writing-qa.py` の同名ヘルパーと挙動を揃えている
 * （仕様: WritingQA-13 / WritingQA-14）。
 *
 * 使い方:
 *   const { endsWithDesumasu, endsWithTaigen, isExemptTemplate } = require('./ja-text-helpers');
 *
 * 設計方針:
 *   - 形態素解析エンジン (kuromoji) は使わない（ロード時間 / 依存追加を避ける）
 *   - サフィックスマッチ + 末尾 1-2 文字の文字種判定で十分の精度
 *   - 誤検出より見逃しを許容（fatal ルールを乗せるため、確実なパターンのみで判定）
 */

'use strict';

// ─── ですます調終端のサフィックス（長い順） ──────────────
const DESUMASU_SUFFIXES = [
  'ませんでした',
  'でしょうか',
  'でしたか',
  'でした',
  'でしょう',
  'ですか',
  'ましょう',
  'ましたか',
  'ますか',
  'ませんか',
  'ません',
  'ました',
  'てください',
  'でください',
  'ください',
  'いたします',
  '致します',
  'いただきます',
  'いただけます',
  'なりました',
  'になりました',
  'となりました',
  'なります',
  'になります',
  'となります',
  'できません',
  'できます',
  'ありません',
  'ございます',
  'です',
  'ます',
];

// ─── 動詞・助動詞・形容詞の終止形 (普通体: ですますではない) ─
const VERB_PLAIN_SUFFIXES = [
  'する', 'した', 'しない', 'しよう', 'しろ',
  'できる', 'できた', 'できない',
  'だ', 'だった', 'である', 'であった',
  'ない', 'なかった',
  'ある', 'あった', 'いる', 'いた',
  'なる', 'なった', 'ならない',
  'たい', 'やすい', 'にくい', 'らしい', 'ほしい',
];

// ─── 助詞終端 (尻切れトンボ・終助詞。体言止めとは判定しない) ────
//   「か」は終助詞 (疑問) として体言止め扱いから除外する。
//   「のか」「ことか」「だろうか」など疑問末尾を含む。
const JOSHI_TAIL_SUFFIXES = [
  'を', 'に', 'で', 'と', 'から', 'まで', 'より', 'へ',
  'や', 'は', 'が', 'も', 'ね', 'よ',
  'か',
];

// ─── 例外テンプレ (タイトル単独 / 体言止め OK) ──────────
//   表紙・閉じ・セクション扉・SECSUMMARY-1 は subtitle 不在を前提に
//   WritingQA-13/14 の対象から外す。
const DESUMASU_EXEMPT_TEMPLATES = new Set([
  'SECTION-1',  // 表紙
  'SECTION-2',  // セクション扉
  'SECTION-3',  // 閉じ
  'SECTION-4',  // セクション扉 A
  'SECTION-5',  // セクション扉 B
  'SECSUMMARY-1', // 主役ビジュアル一発 (full-bleed SVG-only / subtitle なし規範)
]);

function _isKanji(c) {
  return c >= '一' && c <= '鿿';
}

function _isHiragana(c) {
  return c >= '぀' && c <= 'ゟ';
}

function _isKanjiOrHiragana(c) {
  return _isKanji(c) || _isHiragana(c);
}
const _TRAILING_PUNCT_RE = /(?:[。．！？!?\.　\s]|\(\s*\d+\s*\)|（\s*\d+\s*）|[)\]）】])+$/;
function _stripTrailingPunct(s) {
  return (s || '').replace(_TRAILING_PUNCT_RE, '');
}

function _lastSentence(text) {
  if (!text) return '';
  const trimmed = String(text).replace(/\s+$/, '');
  const parts = trimmed.split(/[。．\n]/);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i].trim();
    if (p) return p;
  }
  return '';
}

/**
 * テキストの末尾が「ですます調」で終わっているかを判定。
 * 複数文の場合は最後の文を判定する。句点・空白の有無は問わない。
 */
function endsWithDesumasu(text) {
  if (!text) return false;
  const last = _lastSentence(text);
  if (!last) return false;
  const cleaned = _stripTrailingPunct(last);
  if (!cleaned) return false;
  return DESUMASU_SUFFIXES.some(s => cleaned.endsWith(s));
}

function _endsWithVerbOrPlain(text) {
  if (!text) return false;
  if (VERB_PLAIN_SUFFIXES.some(s => text.endsWith(s))) return true;
  if (text.length >= 2) {
    const last = text[text.length - 1];
    const prev = text[text.length - 2];
    // う段ひらがな + その前が漢字 or 平仮名 → 動詞終止と推定
    if ('うくすつぬふむゆるぐぶ'.includes(last) && _isKanjiOrHiragana(prev)) {
      return true;
    }
  }
  return false;
}

function _endsWithAdjective(text) {
  if (!text || !text.endsWith('い')) return false;
  if (text.length < 2) return false;
  const prev = text[text.length - 2];
  // 形容詞: 「美しい / 大きい / 重い / 広い」など
  // 「い」の直前が漢字 or 平仮名なら形容詞終止と推定
  return _isKanjiOrHiragana(prev);
}

function _endsWithJoshi(text) {
  if (!text) return false;
  return JOSHI_TAIL_SUFFIXES.some(s => text.endsWith(s));
}

/**
 * テキストが「体言止め」(名詞終端) かを推定。
 *
 * 判定ロジック:
 *   1. 疑問符・感嘆符で終わる   → 体言止めではない
 *   2. ですます調で終わる        → 体言止めではない
 *   3. 動詞・助動詞終止形         → 体言止めではない
 *   4. 形容詞終止形 (い)          → 体言止めではない
 *   5. 助詞終端 (〜まで / 〜から など) → 体言止めではない (尻切れトンボ)
 *   6. それ以外                   → 体言止めと推定
 */
function endsWithTaigen(text) {
  if (!text) return false;
  const raw = String(text).trim();
  if (!raw) return false;
  if (/[？！?!]$/.test(raw)) return false;
  const cleaned = _stripTrailingPunct(raw);
  if (!cleaned) return false;
  if (endsWithDesumasu(text)) return false;
  if (_endsWithVerbOrPlain(cleaned)) return false;
  if (_endsWithAdjective(cleaned)) return false;
  if (_endsWithJoshi(cleaned)) return false;
  return true;
}

/**
 * 指定 template_id が WritingQA-13/14 の例外対象 (タイトル単独 / 体言止め OK) か。
 */
function isDesumasuExemptTemplate(templateId) {
  if (!templateId) return false;
  return DESUMASU_EXEMPT_TEMPLATES.has(templateId);
}

module.exports = {
  endsWithDesumasu,
  endsWithTaigen,
  isDesumasuExemptTemplate,
  DESUMASU_EXEMPT_TEMPLATES,
  DESUMASU_SUFFIXES,
  VERB_PLAIN_SUFFIXES,
  JOSHI_TAIL_SUFFIXES,
  // 内部ヘルパー（テスト用に export）
  _lastSentence,
  _stripTrailingPunct,
};
