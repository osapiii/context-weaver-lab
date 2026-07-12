#!/usr/bin/env node
/**
 * print-deck-structure.js
 * ========================
 * ターミナルに出力する CLI。
 *
 * shim として残置 (require 時に warn)。
 *
 * 想定ユースケース:
 *   Phase 2 (情報設計) で plan.json を書く前に、Claude が必ず実行して
 *   deckStructure の構造ルールを context に取り込む。
 *
 * 使い方:
 *   node scripts/render/print-deck-structure.js learning-deck
 *   node scripts/render/print-deck-structure.js  # 引数省略 → 一覧表示
 *
 * 出力:
 *   - deckStructure 概要 (id / version / description)
 *   - header の必須スライド一覧
 *   - body.chapters のループ構造 (章数 / 章内 head/content/tail)
 *   - footer の必須スライド一覧
 *   - StructureQA ルールの一覧
 *   - volumeConstraints (上書き可な数値)
 *
 * 用語整理:
 *   - **deckStructure** … デッキ全体の "型紙"。本スクリプトの主役。
 *   - **slideTemplate** … 1 スライドの型 (ENO-04 / LIST-1 等)。混同注意。
 */

'use strict';

const path = require('path');
const deckStructures = require('./deck-structures');
const { RULE_DEFAULT_LEVEL, RULE_SUGGESTIONS } = require('./lib/structure-qa');

// ───────────────────────────────────────────────────────
// 内部ヘルパー
// ───────────────────────────────────────────────────────

function tidsToString(value) {
  if (Array.isArray(value)) return value.join(' / ');
  return String(value);
}

function fmtSlideRule(rule, idx) {
  const tids = tidsToString(rule.template_id);
  const requireMark = rule.required ? '✅ 必須' : '⚪ 任意';
  let line = `${idx}. **${tids}** — ${requireMark}`;
  if (rule.message) {
    line += `  \n   ${rule.message}`;
  }
  if (rule.fields) {
    const fieldKeys = Object.keys(rule.fields);
    if (fieldKeys.length > 0) {
      line += `  \n   フィールド要件: ${fieldKeys.join(', ')}`;
    }
  }
  if (rule.conditional && rule.conditional.message) {
    line += `  \n   条件付き必須: ${rule.conditional.message}`;
  }
  return line;
}

// ───────────────────────────────────────────────────────
// メイン: 1 deckStructure を Markdown で印字
// ───────────────────────────────────────────────────────

function printDeckStructure(deckStructureId) {
  const deckStructure = deckStructures.getDeckStructure(deckStructureId);
  if (!deckStructure) {
    process.stderr.write(
      `[print-deck-structure] deckStructure "${deckStructureId}" は未登録です。\n` +
      `登録済: ${deckStructures.listDeckStructures().join(', ')}\n`
    );
    process.exit(1);
  }

  const spec = deckStructure.spec;
  const lines = [];

  lines.push(`# Deck 構造 (deckStructure): \`${spec.id}\` v${spec.version}`);
  lines.push('');
  lines.push(`**説明**: ${spec.description}`);
  lines.push('');

  // ───── Header ─────
  lines.push('## 1. Header (序盤固定枠)');
  lines.push('');
  const requiredHeader = (spec.header || []).filter(r => r.required).length;
  const optionalHeader = (spec.header || []).length - requiredHeader;
  lines.push(`- 必須: **${requiredHeader} 枚**`);
  lines.push(`- 任意: **${optionalHeader} 枚** (上限 ${requiredHeader + optionalHeader} 枚まで)`);
  lines.push('');
  lines.push('### 並び順 (deckStructure 規定)');
  lines.push('');
  (spec.header || []).forEach((rule, i) => {
    lines.push(fmtSlideRule(rule, i));
    lines.push('');
  });

  // ───── Body ─────
  lines.push('## 2. Body (章繰り返し)');
  lines.push('');
  const cMin = (spec.body && spec.body.count && spec.body.count.min) ?? 1;
  const cMax = (spec.body && spec.body.count && spec.body.count.max) ?? 99;
  lines.push(`- **章数**: ${cMin} - ${cMax} 章 (volumeConstraints.chapters.count で上書き可)`);
  const contMin = (spec.body && spec.body.content && spec.body.content.count && spec.body.content.count.min) ?? 0;
  const contMax = (spec.body && spec.body.content && spec.body.content.count && spec.body.content.count.max) ?? 999;
  lines.push(`- **章内本文**: ${contMin} - ${contMax} 枚 / 章 (volumeConstraints.chapters.contentPerChapter で上書き可)`);
  if (spec.body && spec.body.content && spec.body.content.allowedTemplates) {
    const at = spec.body.content.allowedTemplates;
    lines.push(`- **章本文の許可 slideTemplate**: ${at === 'any' ? 'すべて (any)' : (Array.isArray(at) ? at.join(' / ') : at)}`);
  }
  lines.push('');

  lines.push('### 章内構造 (head → content → tail)');
  lines.push('');
  lines.push('#### chapter.head (章頭固定枠)');
  lines.push('');
  (spec.body && spec.body.head || []).forEach((rule, i) => {
    lines.push(fmtSlideRule(rule, i));
    lines.push('');
  });
  lines.push('#### chapter.content (章本文・自由構成)');
  lines.push('');
  lines.push(`- 1 章あたり ${contMin}-${contMax} 枚`);
  lines.push('- slideTemplate は自由 (deckStructure の allowedTemplates 制約に従う)');
  lines.push('');
  lines.push('#### chapter.tail (章末固定枠)');
  lines.push('');
  (spec.body && spec.body.tail || []).forEach((rule, i) => {
    lines.push(fmtSlideRule(rule, i));
    lines.push('');
  });

  // ───── Footer ─────
  lines.push('## 3. Footer (末尾固定枠)');
  lines.push('');
  (spec.footer || []).forEach((rule, i) => {
    lines.push(fmtSlideRule(rule, i));
    lines.push('');
  });

  // ───── volumeConstraints ─────
  lines.push('## 4. volumeConstraints (デッキ全体の数値制約)');
  lines.push('');
  const totalSlides = (spec.globalConstraints && spec.globalConstraints.totalSlides) || {};
  lines.push(`- **総スライド数**: ${totalSlides.min ?? '?'} - ${totalSlides.max ?? '?'} 枚`);
  lines.push('');
  lines.push('上書き例 (plan.json):');
  lines.push('```json');
  lines.push('"volumeConstraints": {');
  lines.push(`  "totalSlides": { "min": ${totalSlides.min ?? 14}, "max": ${totalSlides.max ?? 60} },`);
  lines.push(`  "chapters": {`);
  lines.push(`    "count": { "min": ${cMin}, "max": ${cMax} },`);
  lines.push(`    "contentPerChapter": { "min": ${contMin}, "max": ${contMax} }`);
  lines.push(`  }`);
  lines.push('}');
  lines.push('```');
  lines.push('');

  // ───── globalConstraints ─────
  lines.push('## 5. globalConstraints (タグ系ルール)');
  lines.push('');
  if (spec.globalConstraints && Array.isArray(spec.globalConstraints.requiredTags) && spec.globalConstraints.requiredTags.length > 0) {
    lines.push('### requiredTags (1 枚以上必須)');
    lines.push('');
    for (const tag of spec.globalConstraints.requiredTags) {
      const tids = [...(tag.templates || []), ...(tag.nestedDiagrams || [])].join(' / ');
      lines.push(`- **${tag.tag}** (${tag.rule || 'rule 未定義'})  `);
      lines.push(`  対象: ${tids}`);
      if (tag.message) lines.push(`  ${tag.message}`);
      lines.push('');
    }
  }
  if (spec.globalConstraints && Array.isArray(spec.globalConstraints.maxTags) && spec.globalConstraints.maxTags.length > 0) {
    lines.push('### maxTags (上限制約)');
    lines.push('');
    for (const tag of spec.globalConstraints.maxTags) {
      const tids = [...(tag.templates || []), ...(tag.nestedDiagrams || [])].join(' / ');
      lines.push(`- **${tag.tag}** (${tag.rule || 'rule 未定義'}) — 上限 ${tag.max} 枚  `);
      lines.push(`  対象: ${tids}`);
      if (tag.message) lines.push(`  ${tag.message}`);
      lines.push('');
    }
  }

  // ───── StructureQA ルール ─────
  lines.push('## 6. StructureQA ルール一覧');
  lines.push('');
  lines.push('deckStructure 適用時に build-deck.js が機械検査するルール:');
  lines.push('');
  lines.push('| Rule ID | Severity | 概要 |');
  lines.push('|---|---|---|');
  for (const ruleId of Object.keys(RULE_DEFAULT_LEVEL)) {
    const lvl = RULE_DEFAULT_LEVEL[ruleId];
    const sug = RULE_SUGGESTIONS[ruleId] || '';
    const summary = sug.replace(/\n/g, ' ').replace(/\|/g, '\\|').slice(0, 80);
    lines.push(`| **${ruleId}** | ${lvl} | ${summary}${sug.length > 80 ? '...' : ''} |`);
  }
  lines.push('');

  // ───── 利用方法 ─────
  lines.push('## 7. plan.json での利用');
  lines.push('');
  lines.push('Phase 2 で plan.json を書く際、`doc.deck_structure` にこの id を指定:');
  lines.push('');
  lines.push('```json');
  lines.push('{');
  lines.push('  "doc": {');
  lines.push(`    "deck_structure": "${spec.id}",`);
  lines.push(`    "deck_structure_version": "${spec.version}",`);
  lines.push('    "deck_type": "learning",');
  lines.push('    "decision_focused": true');
  lines.push('  },');
  lines.push('  "header": [ ... ],');
  lines.push('  "body": { "chapters": [ ... ] },');
  lines.push('  "footer": [ ... ]');
  lines.push('}');
  lines.push('```');
  lines.push('');
  lines.push('**v9.2 の field rename について**:');
  lines.push('- 旧 `doc.deck_structure_template` / `doc.deck_structure_template_version` は');
  lines.push('  v9.2 / は warn + 自動 alias で動作します。fatal、v10.0 で削除予定。');
  lines.push('');
  lines.push(`build 時: \`node scripts/render/build-deck.js -i plan.json --validate-only\` で StructureQA を検査可能。`);
  lines.push('');

  process.stdout.write(lines.join('\n'));
}

// ───────────────────────────────────────────────────────
// 一覧モード (引数なし)
// ───────────────────────────────────────────────────────

function printList() {
  const ids = deckStructures.listDeckStructures();
  process.stdout.write('# 登録済 deckStructure 一覧\n\n');
  if (ids.length === 0) {
    process.stdout.write('(登録なし)\n');
    return;
  }
  for (const id of ids) {
    const ds = deckStructures.getDeckStructure(id);
    process.stdout.write(`- **${id}** v${ds.version} — ${ds.description}\n`);
  }
  process.stdout.write('\n詳細を見るには: `node scripts/render/print-deck-structure.js <id>`\n');
  process.stdout.write('\n新しい deckStructure を追加するには: `references/alt-modes/deckstructure-add-mode.md` を参照\n');
}

// ───────────────────────────────────────────────────────
// CLI entrypoint
// ───────────────────────────────────────────────────────

function main() {
  const arg = process.argv[2];
  if (!arg || arg === '-h' || arg === '--help') {
    printList();
    process.exit(0);
  }
  printDeckStructure(arg);
}

if (require.main === module) main();

module.exports = {
  printDeckStructure,
  printList,
  printTemplate: printDeckStructure,
};
