/**
 * Knowledge (= EN AIstudio 素材) の lifecycle 判定 helper.
 *
 * 旧設計では「name に /documents/drive_ / webcrawl_img_ が含まれるか」という
 * 文字列 prefix チェックで「未登録 (placeholder)」を判定していた. これを 1 箇所に
 * 閉じ込めて、将来 `registration.stage` を全 doc に書けるようになったら
 * 内部実装だけ差し替えればよい構造にする.
 *
 * 呼び出し側はこのモジュールの関数だけ使うこと:
 *   import { isKnowledgeIndexed, isKnowledgePlaceholder } from "@utils/knowledge";
 */

import type { Knowledge } from "@models/document";

/**
 * 「Gemini File Search にこの素材が索引登録済か」を返す.
 *
 * 判定優先順位:
 *   1. `registration.stage === "indexed"` (Phase R-1d 以降の新 doc)
 *   2. fallback: `name` が Gemini が振った ID 形式で、placeholder prefix を
 *      含まない (= Gemini 側に doc が存在しているはず) と推定.
 */
export function isKnowledgeIndexed(k: Knowledge | null | undefined): boolean {
  if (!k) return false;
  if (k.agentSearchDocumentId) return true;
  if (k.registration?.stage === "indexed") return true;
  if (k.registration?.stage === "placeholder") return false;
  if (k.registration?.stage === "uploading") return false;
  if (k.registration?.stage === "failed") return false;
  // fallback: 旧仕様 (placeholder prefix チェック)
  return !isPlaceholderName(k.name ?? null);
}

/**
 * 「まだ Gemini 登録されていない placeholder 状態か」を返す.
 *
 * 用途:
 *   - 削除時に Gemini API call を skip するか判定
 *   - UI で「未登録」バッジ表示
 */
export function isKnowledgePlaceholder(
  k: Knowledge | null | undefined
): boolean {
  if (!k) return false;
  if (k.registration?.stage === "placeholder") return true;
  if (k.registration?.stage === "uploading") return true;
  if (k.registration?.stage === "indexed") return false;
  if (k.registration?.stage === "failed") return false;
  // fallback: 旧仕様
  return isPlaceholderName(k.name ?? null);
}

/** name が placeholder prefix を含むか (Phase R-1c 旧仕様の判定基盤). */
function isPlaceholderName(name: string | null): boolean {
  if (!name) return true;
  return (
    name.includes("/documents/drive_") ||
    name.includes("/documents/webcrawl_img_")
  );
}

/**
 * Knowledge から context-store / Agent Search delete 用の document ID を抽出する.
 *
 * 優先順位:
 *   1. `agentSearchDocumentId` (Agent Search 移行後)
 *   2. `name` 末尾 (旧 Gemini `fileSearchStores/{fsId}/documents/{id}` 形式)
 *   3. Firestore `id` (Drive 同期 doc 等、name 未設定の場合)
 */
export function extractGeminiDocId(
  k: Knowledge | null | undefined
): string | null {
  if (!k) return null;
  if (k.agentSearchDocumentId) return k.agentSearchDocumentId;
  if (k.name) {
    const parts = k.name.split("/");
    const fromName = parts.length > 0 ? parts[parts.length - 1] || null : null;
    if (fromName) return fromName;
  }
  return k.id ?? null;
}
