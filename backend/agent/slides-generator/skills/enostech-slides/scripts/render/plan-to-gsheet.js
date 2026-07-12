#!/usr/bin/env node
'use strict';

/**
 * plan-to-gsheet.js
 * ============================================================
 * Phase 1.5 — フリーベースモードで plan.json を Google Sheets に書き出す。
 *
 * 6 シート構成:
 *   1) doc-meta    … doc レベルメタ (key/value/desc)
 *   2) questions   … qa_driven 時の questions[]
 *   3) chapters    … body.chapters[] 概観
 *   4) slides      … 全スライドを flat 化した構造表
 *   5) references  … doc.references[]
 *   6) notes       … 編集者用フリーフォームメモ (plan.json には反映されない)
 *
 * 使い方:
 *   # 実シート生成 (gws CLI 経由)
 *   node scripts/render/plan-to-gsheet.js \
 *       --plan decks/<slug>/plan.json \
 *       --title "陽明学デッキ Phase 1.5" \
 *       [--gsheet-parent <FOLDER_ID>]
 *
 *   # オフライン dry-run (snapshot.json に payload を書き出すだけ — Google API を一切叩かない)
 *   node scripts/render/plan-to-gsheet.js \
 *       --plan decks/<slug>/plan.json \
 *       --dry-run \
 *       --snapshot-out tmp/yomeigaku-snapshot.json
 *
 * 副作用:
 *   - 成功時、plan.json の `doc.gsheet_url` に作成された URL を保存
 *   - 既存 plan.json は plan.json.bak.<timestamp> にバックアップ
 *
 * 認証: enostech-cowork-google-service スキル準拠の gws CLI を利用。
 *   gws バイナリと OAuth refresh token は `~/Documents/Claude/ENOSTECH-KNOWLEDGE-SPACE/workspace/`
 *   配下に常設されている前提。詳細は references/setup.md を参照。
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  VERSION,
  planToGsheetPayload,
  REQUIRED_DOC_META_KEYS,
  TEMPLATE_ID_ENUM,
  QUESTION_KIND_ENUM,
  DECK_MODE_ENUM,
} = require('./lib/plan-gsheet-bridge');

// ─── argv parsing ───
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a.startsWith('--')) {
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
  process.stderr.write(`[plan-to-gsheet] ERROR: ${msg}\n`);
  process.exit(code);
}

function info(msg) {
  process.stderr.write(`[plan-to-gsheet] ${msg}\n`);
}

// ─── gws helper ───
function runGws(gwsBin, args, jsonInput) {
  const env = Object.assign({}, process.env);
  if (process.env.GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE) {
    env.GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE = process.env.GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE;
  }
  const r = spawnSync(gwsBin, args, {
    env,
    input: jsonInput,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (r.status !== 0) {
    throw new Error(`gws ${args.join(' ')} failed (exit=${r.status}):\n${r.stderr}`);
  }
  try { return JSON.parse(r.stdout); } catch (e) { return r.stdout; }
}

// ─── locate gws binary + creds ───
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

// ─── Sheets payload helpers ───
function buildSpreadsheetCreatePayload(title, sheets) {
  // sheets is an object { docMeta, questions, chapters, slides, references, notes }
  const sheetSpecs = [
    { name: 'doc-meta',   rows: sheets.docMeta },
    { name: 'questions',  rows: sheets.questions },
    { name: 'chapters',   rows: sheets.chapters },
    { name: 'slides',     rows: sheets.slides },
    { name: 'references', rows: sheets.references },
    { name: 'notes',      rows: sheets.notes },
  ];
  const properties = sheetSpecs.map((s, idx) => ({
    properties: {
      sheetId: 100 + idx,
      title: s.name,
      gridProperties: {
        rowCount: Math.max(s.rows.length + 50, 100),
        columnCount: Math.max((s.rows[0] || []).length + 4, 8),
        frozenRowCount: 1,
      },
    },
  }));
  return {
    properties: { title },
    sheets: properties,
  };
}

function buildBatchUpdateRequests(spreadsheet, payload) {
  // styling and conditional formatting via batchUpdate
  const requests = [];
  const sheetIdByName = {};
  for (const s of spreadsheet.sheets) {
    sheetIdByName[s.properties.title] = s.properties.sheetId;
  }

  // 1) header band (amber #F59E0B) for each sheet's first row
  for (const name of ['doc-meta', 'questions', 'chapters', 'slides', 'references']) {
    const id = sheetIdByName[name];
    if (id == null) continue;
    requests.push({
      repeatCell: {
        range: { sheetId: id, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.961, green: 0.620, blue: 0.043 }, // #F59E0B
            textFormat: { foregroundColor: { red: 0.07, green: 0.09, blue: 0.16 }, bold: true },
            verticalAlignment: 'MIDDLE',
            wrapStrategy: 'WRAP',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,wrapStrategy)',
      },
    });
  }

  // 2) row height 40px
  for (const name of ['doc-meta', 'questions', 'chapters', 'slides', 'references']) {
    const id = sheetIdByName[name];
    if (id == null) continue;
    requests.push({
      updateDimensionProperties: {
        range: { sheetId: id, dimension: 'ROWS', startIndex: 0, endIndex: 999 },
        properties: { pixelSize: 40 },
        fields: 'pixelSize',
      },
    });
  }

  // 3) doc-meta value 列に validation: 「未入力なら赤」
  const dmId = sheetIdByName['doc-meta'];
  if (dmId != null) {
    requests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: dmId, startRowIndex: 1, endRowIndex: 50, startColumnIndex: 1, endColumnIndex: 2 }],
          booleanRule: {
            condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: '' }] },
            format: { backgroundColor: { red: 1.0, green: 0.84, blue: 0.84 } },
          },
        },
        index: 0,
      },
    });
    // deck_mode dropdown — row 4 (1-based after header) might shift; we set on column B for row matching key 'deck_mode'
    // ただし行番号は payload に依存するため、key-based 検索で row index を計算
    const keyRow = payload.sheets.docMeta.findIndex(r => r[0] === 'deck_mode');
    if (keyRow > 0) {
      requests.push({
        setDataValidation: {
          range: { sheetId: dmId, startRowIndex: keyRow, endRowIndex: keyRow + 1, startColumnIndex: 1, endColumnIndex: 2 },
          rule: {
            condition: { type: 'ONE_OF_LIST', values: DECK_MODE_ENUM.map(v => ({ userEnteredValue: v })) },
            showCustomUi: true, strict: true,
          },
        },
      });
    }
  }

  // 4) questions sheet: kind 列のプルダウン
  const qId = sheetIdByName['questions'];
  if (qId != null) {
    requests.push({
      setDataValidation: {
        range: { sheetId: qId, startRowIndex: 1, endRowIndex: 999, startColumnIndex: 2, endColumnIndex: 3 },
        rule: {
          condition: { type: 'ONE_OF_LIST', values: QUESTION_KIND_ENUM.map(v => ({ userEnteredValue: v })) },
          showCustomUi: true, strict: false,
        },
      },
    });
  }

  // 5) slides sheet: template_id 列のプルダウン (全 70+ enum)
  const sId = sheetIdByName['slides'];
  if (sId != null) {
    requests.push({
      setDataValidation: {
        range: { sheetId: sId, startRowIndex: 1, endRowIndex: 999, startColumnIndex: 3, endColumnIndex: 4 },
        rule: {
          condition: { type: 'ONE_OF_LIST', values: TEMPLATE_ID_ENUM.map(v => ({ userEnteredValue: v })) },
          showCustomUi: true, strict: false,
        },
      },
    });
  }

  // 6) auto-resize columns
  for (const name of ['doc-meta', 'questions', 'chapters', 'slides', 'references', 'notes']) {
    const id = sheetIdByName[name];
    if (id == null) continue;
    requests.push({
      autoResizeDimensions: {
        dimensions: { sheetId: id, dimension: 'COLUMNS', startIndex: 0, endIndex: 12 },
      },
    });
  }

  return requests;
}

// ─── main ───
function main() {
  const args = parseArgs(process.argv);
  const planPath = args.plan || args.input;
  if (!planPath) fail('--plan <path> が必要です');
  if (!fs.existsSync(planPath)) fail(`plan.json が見つかりません: ${planPath}`);

  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  if (!plan.doc) plan.doc = {};
  // deck_mode が "free" 以外 (未指定 = 暗黙 'template' を含む) は通常 skip
  // ただし --allow-template / --dry-run 時は強制実行可能 (regression-safe: 既存 plan.json は書き換えない)
  const effectiveMode = plan.doc.deck_mode || 'template';
  if (effectiveMode !== 'free' && !args.allowTemplate && !args.dryRun) {
    info(`deck_mode="${effectiveMode}" のため Phase 1.5 gsheet 連携は通常 skip 対象。--allow-template で強制実行可能。`);
    process.exit(0);
  }

  const title = args.title || `[plan-collab] ${path.basename(path.dirname(planPath))}`;
  const payload = planToGsheetPayload(plan);
  payload.meta = {
    bridgeVersion: VERSION,
    generatedAt: new Date().toISOString(),
    sourcePlan: path.resolve(planPath),
    title,
  };

  // Snapshot dry-run mode (no Google API calls)
  if (args.dryRun) {
    const out = args.snapshotOut || path.join(path.dirname(planPath), `gsheet-snapshot-${Date.now()}.json`);
    fs.writeFileSync(out, JSON.stringify(payload, null, 2), 'utf8');
    info(`dry-run: payload を書き出しました → ${out}`);
    info(`  シート行数: docMeta=${payload.sheets.docMeta.length}, questions=${payload.sheets.questions.length - 1} 件 + header, chapters=${payload.sheets.chapters.length}, slides=${payload.sheets.slides.length - 1} 枚 + header, references=${payload.sheets.references.length - 1} 件 + header`);
    process.stdout.write(out + '\n');
    return;
  }

  // Live mode — invoke gws
  const gwsBin = locateGws();
  if (!gwsBin) fail('gws CLI が見つかりません。--dry-run を使うか workspace/bin/gws-* を配置してください');
  const creds = locateCreds();
  if (!creds) fail('OAuth credentials (gws-credentials.json) が見つかりません');
  process.env.GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE = creds;

  // 1) Find or create parent folder
  let parentId = args.gsheetParent || null;
  if (!parentId) {
    parentId = ensureFolder(gwsBin, 'ENOSTECH/plan-gsheet');
  }

  // 2) Create spreadsheet
  info(`新規 Spreadsheet を作成中: "${title}"`);
  const createPayload = buildSpreadsheetCreatePayload(title, payload.sheets);
  const created = runGws(gwsBin, ['sheets', 'spreadsheets', 'create', '--json', JSON.stringify(createPayload)]);
  const spreadsheetId = created.spreadsheetId;
  const spreadsheetUrl = created.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
  info(`spreadsheetId=${spreadsheetId}`);

  // 3) Move under parent folder if specified
  if (parentId) {
    runGws(gwsBin, ['drive', 'files', 'update',
      '--params', JSON.stringify({ fileId: spreadsheetId, addParents: parentId, removeParents: 'root' }),
      '--json', '{}']);
  }

  // 4) Write each sheet's values
  const sheetSpecs = [
    { name: 'doc-meta',   rows: payload.sheets.docMeta },
    { name: 'questions',  rows: payload.sheets.questions },
    { name: 'chapters',   rows: payload.sheets.chapters },
    { name: 'slides',     rows: payload.sheets.slides },
    { name: 'references', rows: payload.sheets.references },
    { name: 'notes',      rows: payload.sheets.notes },
  ];
  for (const s of sheetSpecs) {
    info(`writing ${s.name} (${s.rows.length} rows)`);
    runGws(gwsBin, ['sheets', 'spreadsheets', 'values', 'update',
      '--params', JSON.stringify({ spreadsheetId, range: `${s.name}!A1`, valueInputOption: 'USER_ENTERED' }),
      '--json', JSON.stringify({ values: s.rows })]);
  }

  // 5) Apply formatting via batchUpdate
  info('applying header bands / dropdowns / conditional formats');
  const requests = buildBatchUpdateRequests(created, payload);
  runGws(gwsBin, ['sheets', 'spreadsheets', 'batchUpdate',
    '--params', JSON.stringify({ spreadsheetId }),
    '--json', JSON.stringify({ requests })]);

  // 6) Save url to plan.json
  const bak = planPath + '.bak.' + Date.now();
  fs.copyFileSync(planPath, bak);
  plan.doc.gsheet_url = spreadsheetUrl;
  plan.doc.gsheet_id = spreadsheetId;
  plan.doc.gsheet_synced_at = new Date().toISOString();
  fs.writeFileSync(planPath, JSON.stringify(plan, null, 2), 'utf8');
  info(`plan.json を更新 (backup: ${bak})`);

  process.stdout.write(spreadsheetUrl + '\n');
}

function ensureFolder(gwsBin, folderPath) {
  // folderPath like "ENOSTECH/plan-gsheet" — recursively ensure each segment under My Drive root
  const parts = folderPath.split('/').filter(Boolean);
  let parent = 'root';
  for (const seg of parts) {
    const q = `name = '${seg.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and '${parent}' in parents and trashed = false`;
    const list = runGws(gwsBin, ['drive', 'files', 'list', '--params', JSON.stringify({ q, fields: 'files(id,name)' })]);
    if (list && list.files && list.files.length > 0) {
      parent = list.files[0].id;
    } else {
      const created = runGws(gwsBin, ['drive', 'files', 'create',
        '--json', JSON.stringify({
          name: seg,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parent],
        })]);
      parent = created.id;
    }
  }
  return parent;
}

if (require.main === module) {
  try { main(); } catch (e) { fail(e.message); }
}

module.exports = { main, buildSpreadsheetCreatePayload, buildBatchUpdateRequests };
