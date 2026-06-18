#!/usr/bin/env node
'use strict';

/**
 * gsheet-to-plan.js
 * ============================================================
 * Phase 1.5 — フリーベースモードで Google Sheets の編集結果を plan.json に取り込む。
 *
 * 入力経路:
 *   1) --url <SPREADSHEET_URL>   (gws CLI で 6 シートを fetch)
 *   2) --plan のみ指定           (plan.json の doc.gsheet_url から自動取得)
 *   3) --from-snapshot <PATH>    (snapshot.json をローカル読み込み — オフラインテスト用)
 *
 * 使い方:
 *   # 通常運用 (gws 経由)
 *   node scripts/render/gsheet-to-plan.js --plan decks/<slug>/plan.json
 *
 *   # snapshot から取り込み (オフラインテスト用)
 *   node scripts/render/gsheet-to-plan.js \
 *       --plan decks/<slug>/plan.json \
 *       --from-snapshot tmp/yomeigaku-snapshot.json
 *
 * 副作用:
 *   - 既存 plan.json は plan.json.bak.<timestamp> にバックアップ
 *   - シートに無いフィールド (cards / charts / diagrams / scenes / html_supplement 等) は plan.json 側を温存
 *   - 不整合があれば warning を stderr に出力 (fatal にはしない)
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  VERSION,
  gsheetPayloadToPlan,
  summarizeDiff,
} = require('./lib/plan-gsheet-bridge');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next != null && !next.startsWith('--')) {
        args[camel(key)] = next; i += 1;
      } else {
        args[camel(key)] = true;
      }
    }
  }
  return args;
}
function camel(s) { return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); }

function fail(msg, code = 1) {
  process.stderr.write(`[gsheet-to-plan] ERROR: ${msg}\n`);
  process.exit(code);
}
function info(msg) {
  process.stderr.write(`[gsheet-to-plan] ${msg}\n`);
}

function locateGws() {
  const home = process.env.HOME || '';
  const candidates = [
    process.env.GWS_BIN,
    path.join(home, 'Documents/Claude/ENOSTECH-KNOWLEDGE-SPACE/workspace/bin/gws-linux-aarch64'),
    path.join(home, 'Documents/Claude/ENOSTECH-KNOWLEDGE-SPACE/workspace/bin/gws-darwin-arm64'),
    path.join(home, 'Documents/Claude/ENOSTECH-KNOWLEDGE-SPACE/workspace/bin/gws-darwin-amd64'),
  ].filter(Boolean);
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}
function locateCreds() {
  const home = process.env.HOME || '';
  const candidates = [
    process.env.GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE,
    path.join(home, 'Documents/Claude/ENOSTECH-KNOWLEDGE-SPACE/workspace/gws-credentials.json'),
  ].filter(Boolean);
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

function runGws(gwsBin, args) {
  const env = Object.assign({}, process.env);
  if (process.env.GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE) {
    env.GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE = process.env.GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE;
  }
  const r = spawnSync(gwsBin, args, { env, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (r.status !== 0) {
    throw new Error(`gws ${args.join(' ')} failed (exit=${r.status}):\n${r.stderr}`);
  }
  try { return JSON.parse(r.stdout); } catch (e) { return r.stdout; }
}

function extractSpreadsheetId(url) {
  if (!url) return null;
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : url; // assume id-like input is fine
}

function fetchSheetsViaGws(spreadsheetId) {
  const gwsBin = locateGws();
  if (!gwsBin) throw new Error('gws CLI が見つかりません');
  const creds = locateCreds();
  if (creds) process.env.GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE = creds;

  const sheetNames = ['doc-meta', 'questions', 'chapters', 'slides', 'references', 'notes'];
  const out = {};
  for (const name of sheetNames) {
    const r = runGws(gwsBin, ['sheets', 'spreadsheets', 'values', 'get',
      '--params', JSON.stringify({ spreadsheetId, range: `${name}!A1:Z9999` })]);
    out[name] = (r && r.values) || [];
  }
  return {
    version: VERSION,
    sheets: {
      docMeta: out['doc-meta'],
      questions: out.questions,
      chapters: out.chapters,
      slides: out.slides,
      references: out.references,
      notes: out.notes,
    },
  };
}

function main() {
  const args = parseArgs(process.argv);
  const planPath = args.plan;
  if (!planPath) fail('--plan <path> が必要です');
  if (!fs.existsSync(planPath)) fail(`plan.json が見つかりません: ${planPath}`);

  const originalPlan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  let payload;
  if (args.fromSnapshot) {
    info(`snapshot から読み込み: ${args.fromSnapshot}`);
    payload = JSON.parse(fs.readFileSync(args.fromSnapshot, 'utf8'));
  } else {
    const url = args.url || (originalPlan.doc && originalPlan.doc.gsheet_url);
    if (!url) fail('--url または plan.doc.gsheet_url が必要です');
    const spreadsheetId = extractSpreadsheetId(url);
    info(`gws 経由で取得中: spreadsheetId=${spreadsheetId}`);
    payload = fetchSheetsViaGws(spreadsheetId);
  }

  // Apply
  const { plan: newPlan, warnings, diff } = gsheetPayloadToPlan(originalPlan, payload);

  // backup
  const bak = planPath + '.bak.' + Date.now();
  fs.copyFileSync(planPath, bak);
  fs.writeFileSync(planPath, JSON.stringify(newPlan, null, 2), 'utf8');

  // diff summary
  process.stderr.write('\n=== Diff Summary ===\n');
  process.stderr.write(summarizeDiff(diff) + '\n');
  if (warnings.length) {
    process.stderr.write('\n=== Warnings ===\n');
    for (const w of warnings) process.stderr.write(`  ! ${w}\n`);
  }
  process.stderr.write(`\nplan.json を更新しました (backup: ${bak})\n`);
}

if (require.main === module) {
  try { main(); } catch (e) { fail(e.message); }
}

module.exports = { main };
