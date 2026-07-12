# adk/ — ENOSTECH Slides Multi-Agent Orchestrator

Google ADK v1.33+ ベースの multi-agent オーケストレータ.
`skills/enostech-slides` v12 (Node + Python) を subprocess で叩きながら、
Phase 1 〜 4 を **都度承認モード** (1 step = 1 tool call, 結果を要約して floor を返す)
で進めます.

## アーキテクチャ

```
root_agent (LlmAgent, "enostech_coordinator")
  │
  ├── sub_agents (transfer; ユーザー対話あり)
  │     ├── phase1_hearing       — 読者・目的・questions[] 合意形成
  │     └── phase1_8_braindump   — deep_research 調査 + braindump.md 確認
  │           └─ deep_research   (AgentTool, google_search 内蔵)
  │
  └── tools (Coordinator が 1 個ずつ呼ぶ atomic tool 群 = 都度承認モード)
        ├── 補助:  show_backend_status / list_deck_artifacts /
        │          save_braindump_tool / update_progress_tool
        ├── Phase 2 (Design): build_plan_tool / validate_structure_tool /
        │                     run_schema_qa_tool / render_pptx_strict_tool /
        │                     repair_plan_tool
        ├── Phase 3 (Build):  run_svg_pass_tool / render_pptx_tool /
        │                     build_narration_tool / pptx_to_images_tool /
        │                     build_contact_sheet_tool / analyze_visual_qa_tool /
        │                     repair_plan_from_visual_qa_tool
        └── Phase 4 (QA):     run_writing_qa_tool / build_deck_package_tool
```

## 主な設計判断

- **既存 Node + Python script を最大限再利用**. レンダリング・QA はすべて
  `skills/enostech-slides` v12 を subprocess で呼ぶ. Python 側で再実装しない.
- **LLM 出力は Pydantic v2 + Gemini structured output** で型保証. `Plan`
  モデルが正本 (outline 中間層は 2026-05-15 に撤廃, braindump → 直接 plan).
- **都度承認モード**. Phase 1 / 1.8 だけ sub_agent transfer で対話, Phase 2-4 は
  Coordinator が atomic tool を 1 個ずつ呼ぶ. App 層が「次へ」を自動送信すれば
  実質自律稼動になる.
- **state = SoT (Single Source of Truth)**. deck_dir / plan_path / pptx_path 等は
  session.state に書き込まれ、後続 tool は **引数省略可** で state から自動解決.
  詳細は `docs/STATE_SCHEMA.md`.
- **Cloud Run デプロイ前提**. Dockerfile は Python 3.12 + Node 20 +
  LibreOffice + poppler + Noto Sans JP のハイブリッド.

## ローカル開発

```bash
# 1. 依存インストール
pip install -r agents-sandbox/adk/requirements.txt
cd skills/enostech-slides && npm ci && cd -

# 2. CLI でツール検証 (ラッパー経由で PYTHONPATH=agents-sandbox を自動設定)
./scripts/adk-cli.sh backend-info
./scripts/adk-cli.sh e2e --theme "ベアフットシューズ入門" \
    --intent "靴ではなくプロセスです"

# 3. adk web で対話起動 (推奨 — ランチャー経由)
./scripts/start_adk_web.sh           # port 8000
./scripts/start_adk_web.sh 8765      # 任意 port

# ランチャーは以下を自動でやる:
#   - adk CLI が PATH に無くても Python framework から自動探索
#   - .env から GEMINI_API_KEY 等を export
#   - agents-sandbox/ を agents dir として渡し、UI には `adk` だけが出る
#   - ADK v1.33+ の symlink 拒否仕様回避のため adk/ は agents-sandbox/adk/ に実体配置
```

## 配置ルール

```
ENOSTECH-KNOWLEDGE-SPACE/
├── agents-sandbox/         ← adk web の AGENTS_DIR
│   └── adk/                ← agent 本体 (実体)
├── scripts/
│   ├── start_adk_web.sh    ← adk web ランチャー
│   └── adk-cli.sh          ← python -m adk.* ラッパー
├── skills/enostech-slides/ ← subprocess で叩く既存 v12 skill
└── .env                    ← GEMINI_API_KEY 等
```

### `adk` コマンドが見つからない場合

google-adk は pip install で `/Library/Frameworks/Python.framework/Versions/3.13/bin/adk`
に入るが、macOS 標準シェルの PATH に通っていないことが多い. 解決:

```bash
# .zshrc に追記
export PATH="/Library/Frameworks/Python.framework/Versions/3.13/bin:$PATH"
```

を入れるか、上記の `./scripts/start_adk_web.sh` を使う (こちらは PATH 解決済み).

## 環境変数

| 名前 | 既定 | 役割 |
|------|------|------|
| `GEMINI_API_KEY` | (未設定) | Gemini API を直接叩く |
| `GOOGLE_GENAI_USE_VERTEXAI` | (未設定) | Vertex AI 経由 (Cloud Run 推奨) |
| `GOOGLE_CLOUD_PROJECT` | (未設定) | Vertex AI 用 project |
| `GOOGLE_CLOUD_LOCATION` | `us-central1` | Vertex AI region |
| `ENOSTECH_FORCE_MOCK` | `0` | 1 で mock 強制 (CI / オフライン) |
| `ENOSTECH_MODEL` | `gemini-2.5-flash` | 既定モデル |
| `ENOSTECH_PLAN_MODEL` | (= ENOSTECH_MODEL) | build_plan 用 |
| `ENOSTECH_REPAIR_MODEL` | (= ENOSTECH_MODEL) | repair 用 |
| `ENOSTECH_SVG_MODEL` | `gemini-3-pro-preview` | SVG 構図設計 |
| `ENOSTECH_VISUAL_ANALYSIS_MODEL` | `gemini-3-pro-preview` | Visual QA |
| `ENOSTECH_DEEP_RESEARCH_MODEL` | `gemini-2.5-flash` | Deep Research (built-in search) |
| `ENOSTECH_SKILL_ROOT` | `<repo>/skills/enostech-slides` | skill 配置 |
| `ENOSTECH_DECK_OUT` | `<repo>/tests/outputs/last_run` | 成果物書き出し先 |
| `ENOSTECH_SKIP_SCHEMA_QA` | `1` | SchemaQA loop を skip |
| `ENOSTECH_SKIP_WRITING_QA` | `0` | WritingQA loop を skip |
| `ENOSTECH_SKIP_VISUAL_QA` | `0` | Visual QA を skip |
| `ENOSTECH_NODE_BIN` | `node` | Node 実行バイナリ |

## Cloud Run デプロイ

```bash
gcloud builds submit --config agents-sandbox/adk/cloudbuild.yaml \
    --substitutions=_REGION=asia-northeast1,_SERVICE=enostech-adk
```

または直接:

```bash
gcloud run deploy enostech-adk \
    --source . \
    --region asia-northeast1 \
    --memory 2Gi --cpu 2 --timeout 900 \
    --set-env-vars GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_PROJECT=$GCP_PROJECT,GOOGLE_CLOUD_LOCATION=asia-northeast1
```

## ディレクトリ

```
adk/
├── __init__.py
├── agent.py                ← root_agent (Coordinator + 2 SubAgent + 18 tools)
├── auth.py                 ← Gemini / Vertex / Mock 判定
├── config.py               ← モデル名・パス・skip フラグ・instruction provider
├── main.py                 ← CLI (backend-info / plan / render / narration / e2e)
├── prompts/
│   ├── coordinator.md           ← Coordinator 都度承認モード指示
│   ├── phase1_hearing.md        ← Phase 1: ヒアリング
│   ├── phase1_8_braindump.md    ← Phase 1.8: deep_research + braindump
│   └── deep_research.md         ← deep_research AgentTool 指示
├── schemas/                ← Pydantic v2 (Plan / Slide / Section / Question)
├── sub_agents/
│   ├── __init__.py
│   ├── _helpers.py              ← safe_genai_config (thinking_budget 等)
│   ├── phase1_hearing.py
│   ├── phase1_8_braindump.py
│   └── deep_research.py         ← AgentTool wrap (google_search built-in)
├── agent_tools/            ← Python tool 群 (LLM + subprocess wrapper)
│   ├── __init__.py
│   ├── _adk_tools.py            ← ADK 用 primitive 引数 wrapper + state SoT
│   ├── run_subprocess.py
│   ├── llm_plan.py              ← build_plan / repair_plan (Gemini structured)
│   ├── deck_renderer.py         ← build-deck.js / build-deck-package.js
│   ├── qa_runner.py             ← writing-qa.py / schema-qa.py
│   ├── structure_runner.py      ← validate-structure-cli.js / print-deck-structure.js
│   ├── narration_runner.py      ← build-narration.py
│   ├── preview_runner.py        ← pptx-to-images.sh + contact sheet
│   ├── svg_pass.py              ← SVG Pass (gemini-3-pro-preview, 並列処理)
│   ├── template_schemas.py
│   └── storage.py
├── docs/
│   └── STATE_SCHEMA.md          ← session.state の正規 key
├── Dockerfile              ← Cloud Run hybrid (Python + Node)
├── cloudbuild.yaml
├── .dockerignore
├── requirements.txt
└── README.md               ← このファイル
```

## 旧実装 (参考用)

このディレクトリは旧 `adk_app/` (単一 LlmAgent + Function Tool 構成) を完全に
置き換える. `adk_app.deprecated/` として保持しているが、新規開発は禁止.
