# session.state Schema — App 統合ガイド

ADK の `session.state` は **進捗と成果物パスの SoT (Single Source of Truth)** です.
custom App UI はここを購読 / poll することで、LLM の振る舞いに依存せず安定した
進捗表示・成果物リンク提供ができます.

---

## 1. state にどう accesss するか

### 1-A. リアルタイム購読 (推奨)
ADK web server の SSE エンドポイント `/run_sse` を購読すると、各 LLM/tool 実行ごとに
`Event` が流れてきます. その `state_delta` フィールドにこの schema の差分が乗ります.

```http
POST http://localhost:8000/run_sse
Content-Type: application/json
Accept: text/event-stream

{ "app_name": "adk", "user_id": "user", "session_id": "<sid>",
  "new_message": { "role": "user", "parts": [{"text": "..."}] } }
```

各 SSE event の payload (抜粋):
```json
{
  "author": "build_plan_tool",
  "actions": { "state_delta": {
    "progress": { "phase": "phase2_design", "step": "build_plan", "status": "done", ... },
    "plan_path": "/.../plan.json"
  }}
}
```

### 1-B. polling (簡易)
セッション state 全体を REST で取得:
```http
GET /apps/<app>/users/<user>/sessions/<sid>
→ { "state": { "deck_dir": "...", "plan_path": "...", "progress": {...}, ... } }
```

5 秒ごとに poll してもよいですが、長時間 idle セッションが多いと無駄なので SSE 推奨.

---

## 2. state key 一覧

### 2-A. パス系 (各 Phase が成果物を生成すると更新される)

| key | type | 更新する tool | 内容 |
|-----|------|---------------|------|
| `deck_id`            | str | ensure_deck_dir_tool | deck の一意 ID (`YYYY-MM-DD_8hex`) |
| `deck_dir`           | str | ensure_deck_dir_tool | deck ディレクトリ絶対パス |
| `plan_path`          | str | build_plan_tool / repair_plan_tool / write_plan_json_from_str | plan.json 絶対パス |
| `pptx_path`          | str | render_pptx_tool / render_pptx_strict_tool | 資料.pptx 絶対パス |
| `narration_path`     | str | build_narration_tool | ナレーション台本.md 絶対パス |
| `preview_dir`        | str | pptx_to_images_tool | preview/slide-NN.png のディレクトリ |
| `contact_sheet_path` | str | build_contact_sheet_tool | contact-sheet.png 絶対パス |
| `visual_qa_issues`   | str | analyze_visual_qa_tool | Visual QA 解析結果 JSON 文字列 |
| `braindump_path`     | str | save_braindump_tool | braindump.md 絶対パス |
| `artifacts`          | list[str] | build_deck_package_tool | 最終 deck の artifact 名一覧 |

### 2-B. Phase 別 status 集約

| key | type | 内容 |
|-----|------|------|
| `current_phase`  | str  | 直近で更新があった phase 名 (`phase2_design` 等) |
| `phase_status`   | dict | `{ phase_name: latest_status }` のマップ |

例:
```json
{
  "current_phase": "phase3_build",
  "phase_status": {
    "phase2_design": "done",
    "phase3_build": "running"
  }
}
```

App UI はこれを使って Phase 1〜4 の進捗インジケータを描画できます.

### 2-C. 進捗イベント (主役)

#### `progress` — 最新 1 件
```json
{
  "phase": "phase3_build",
  "step": "render_pptx",
  "status": "done",
  "note": "資料.pptx 生成 (1234 KB)",
  "ts": "16:50:18",
  "ts_unix": 1716123018.5,
  "duration_ms": 8230,
  "artifact": "/.../資料.pptx"
}
```

#### `progress_history` — 全イベントの時系列 (最後 200 件保持)
配列. 最新 200 件まで. App UI のタイムライン表示用.

#### `job_log` — 詳細実行ログ (ターミナル風 UI 用. 最後 2000 件保持)
配列. 各 entry は flat な timestamped 1 行ログ:

```json
{
  "ts": "16:50:18.234",
  "ts_unix": 1716123018.234,
  "level": "info" | "warn" | "error" | "debug",
  "tag": "phase3_build",
  "message": "[done   ] render_pptx — 資料.pptx 生成 (1234 KB)",
  "extra": {
    "model": "gemini-3-pro-preview",
    "artifact": "/.../資料.pptx",
    "duration_ms": 8230
  }
}
```

`_push_progress` で発生した全 event が自動的に job_log にも 1 行 emit される.
さらに各 tool は `_log_job(tool_context, "msg", level="debug", tag="...", **extra)`
で **任意の debug ログ** を追加で書ける. 例:
```
[debug] phase3_visual_qa : Gemini multimodal 解析開始: image=850 KB, model=gemini-3-pro-preview
[debug] phase3_visual_qa : Gemini 応答受信: 2418 chars
[info ] phase3_visual_qa : [done   ] analyze — passed=true, issues=2, severity=minor
```

**App UI 想定** (タブ ②ログ):
- ターミナル風. ts を黒, level を色付き (info=白 / warn=黄 / error=赤 / debug=灰),
  tag を青, message を白で stream 表示.
- フィルタ: level / tag で絞り込み.

### 2-D. その他

| key | type | 内容 |
|-----|------|------|
| `phase1_hearing_result`     | str  | Phase 1 ヒアリング応答全文 (questions[] embed) |
| `phase1_8_braindump_result` | str  | Phase 1.8 braindump 本文 (Markdown) |
| `visual_qa_issues`          | str  | Visual QA 解析結果 JSON (文字列化) |
| `user_wants_pptx`           | str  | "yes" / "no" |

---

## 3. progress event schema (詳細)

すべての tool が `_push_progress(...)` 経由で push する event:

```typescript
interface ProgressEvent {
  // 必須
  phase: string;          // "phase2_design" / "phase3_build" / "phase4_qa" / ...
  step: string;           // "build_plan" / "svg_pass.s5" / "render_pptx" 等. ドット区切りで granular OK
  status: "running" | "done" | "failed" | "skipped" | "warn";
  note: string;           // 人間可読の 1 行説明
  ts: string;             // "HH:MM:SS" (localtime)
  ts_unix: number;        // epoch seconds (sort 用)

  // 任意
  duration_ms?: number;   // 同じ (phase, step) の running から計測 (status != running 時のみ)
  artifact?: string;      // 生成された artifact の絶対パス or artifact 名
  error?: string;         // status=failed 時のエラー要約 (最大 500 chars)
  model?: string;         // LLM 呼び出し時のモデル名 ("gemini-3-pro-preview" 等)
  percent?: number;       // phase-level 進捗 0..1 (例: SVG 3/8 = 0.375)
}
```

### `phase` の正規値

| value | 担当 |
|-------|------|
| `phase1_hearing`    | ヒアリング (sub_agent transfer) |
| `phase1_8_braindump`| 深堀調査 + braindump (sub_agent transfer) |
| `phase2_design`     | build_plan / validate_structure / run_schema_qa / render_pptx_strict / repair_plan |
| `phase3_build`      | SVG Pass / Render / Narration / Visual QA |
| `phase3_visual_qa`  | Phase 3 内部の Visual QA (analyze / repair) |
| `phase4_qa`         | WritingQA / Package |

### `step` の例 (granular)

| step | 内容 |
|------|------|
| `build_plan`                     | plan 生成 (LLM, braindump → plan.json) |
| `repair_plan`                    | plan 修復 (LLM) |
| `validate_structure`             | validate-structure-cli.js (StructureQA) |
| `run_schema_qa`                  | schema-qa.py (SchemaQA-01〜15) |
| `render_pptx_strict`             | build-deck.js fallback_lenient=false で zod 検証 |
| `svg_pass.<slide_id>`            | 各 SVG slide 生成 (LLM, 並列実行) |
| `render_pptx`                    | build-deck.js で 資料.pptx 生成 |
| `build_narration`                | build-narration.py で台本生成 |
| `pptx_to_images`                 | soffice + pdftoppm |
| `build_contact_sheet`            | preview を 1 枚絵に集約 |
| `analyze`                        | Visual QA multimodal 解析 |
| `plan_repair`                    | Visual QA 課題で plan 修正 |
| `writing_qa`                     | writing-qa.py |
| `build_deck_package`             | build-deck-package.js |

---

## 4. App UI 実装例 (擬似 React/Vue)

```ts
// SSE 購読 + 進捗 timeline 描画
const events = useEventSource('/run_sse', { ... });

const phases = useMemo(() => {
  const ps = state.phase_status || {};
  return [
    { id: 'phase1_hearing', label: 'ヒアリング', status: ps.phase1_hearing },
    { id: 'phase1_8_braindump', label: '調査 & braindump', status: ps.phase1_8_braindump },
    { id: 'phase2_design', label: '設計', status: ps.phase2_design },
    { id: 'phase3_build', label: 'ビルド', status: ps.phase3_build },
    { id: 'phase4_qa', label: 'QA + パッケージ', status: ps.phase4_qa },
  ];
}, [state.phase_status]);

return (
  <div>
    <PhaseTimeline phases={phases} current={state.current_phase} />

    <ProgressDetail event={state.progress} />

    <EventLog history={state.progress_history} />

    {state.pptx_path && <DownloadLink href={state.pptx_path} label="資料.pptx" />}
    {state.narration_path && <DownloadLink href={state.narration_path} label="ナレーション台本" />}
    {state.contact_sheet_path && <ImagePreview src={state.contact_sheet_path} />}
  </div>
);
```

---

## 5. 設計原則

### 5-A. tool が **必ず** state に書く
LLM (Coordinator) が text emit で進捗を伝える方法は脆い (LLM が emit を忘れる).
**Python tool 内で `_push_progress` を呼ぶことが SoT**. text emit はあくまで補助.

### 5-B. running → done/failed のペアで書く
長時間処理する tool は **開始時 running / 終了時 done (or failed)** の 2 イベントを必ず push.
これで App UI が「いま動いてる」「N 秒前に終わった」を正しく描画できる.

### 5-C. error は必ず文字列化して残す
exception を握りつぶさない. `_push_progress(..., status="failed", error="...")` で
App UI に表示できるよう残す.

### 5-D. percent はベストエフォート
phase 全体の進捗率がわかる場合のみ. わからなければ omit でよい.
(SVG Pass のように slide 単位で iterate するなら i/N で計算可能)
