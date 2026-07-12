#!/usr/bin/env node
/**
 * validate-structure-cli.js
 * ==========================
 *
 * 使い方:
 *   node scripts/render/validate-structure-cli.js -i plan.json
 *   cat plan.json | node scripts/render/validate-structure-cli.js
 *
 * 出力 (stdout, JSON):
 *   {
 *     skipped: bool,
 *     ok: bool,
 *     templateId: string|null,
 *     summary: { fatal, warn, total },
 *     issues: [...],
 *   }
 *
 * exit code:
 *   0 = pass / skipped
 *   2 = StructureQA fatal あり
 *   1 = 内部エラー (入力 JSON 不正等)
 *
 * 主な利用箇所: render-deck-instruction.py が plan.html 生成時に subprocess で呼ぶ。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { validateDeckStructure } = require('./lib/structure-qa');
const { isV9Format, normalizeV8ToV9: _normalizeV8ToV9_from_build } = require('./build-deck');

function parseArgs(argv) {
  const args = { input: null, structure: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    // -i / --input / --plan (alias, 2026-05-15 ADK 互換のため) すべて受け付ける
    if (a === '-i' || a === '--input' || a === '--plan') args.input = argv[++i];
    else if (a === '--structure' || a === '--structure-id') args.structure = argv[++i];
  }
  return args;
}

function readJson(inputPath) {
  if (inputPath) return JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  return JSON.parse(fs.readFileSync(0, 'utf-8'));
}

// normalizeV8ToV9 は build-deck.js から import (上記). 重複定義は撤廃 (2026-05-15).

function main() {
  let deckJson;
  try {
    const args = parseArgs(process.argv);
    deckJson = readJson(args.input);
  } catch (e) {
    process.stderr.write(`[validate-structure-cli] 入力読み込みエラー: ${e.message}\n`);
    process.exit(1);
  }

  const v9 = isV9Format(deckJson);
  // 2026-05-15: v8 形式 (sections 直書き) でも StructureQA を効かせるため
  // ここで v8 → v9 逆正規化する. ADK plan_builder は v8 で出すため.
  // build-deck.js から共通 helper を import (重複定義は localBackup として残置).
  if (!v9) {
    deckJson = _normalizeV8ToV9_from_build(deckJson);
  }
  const result = validateDeckStructure(deckJson);

  const out = {
    skipped: result.skipped,
    ok: result.ok,
    templateId: result.templateId,
    summary: result.summary,
    issues: result.issues,
    v9,
  };
  process.stdout.write(JSON.stringify(out, null, 2));
  process.stdout.write('\n');

  if (result.skipped) process.exit(0);
  process.exit(result.ok ? 0 : 2);
}

if (require.main === module) main();
