/**
 * useKnowledgeOperator — Knowledge (= EN AIstudio 素材) の操作 API を 1 箇所に集約 (Phase R-1d).
 *
 * 旧設計では UI 側が組織 ID / スペース ID / fileSpaceId / Firestore docID / Gemini docID
 * を全部組み立てて Firestore SDK と Pinia store の 2 経路を直接叩いていた. それを
 * `deleteKnowledge(knowledge)` 1 本に集約し、UI は doc instance だけ持ってれば良い構造に.
 *
 * 内部実装は `geminiFileSpaceOperator.deleteDocumentFully()` に委譲 (Gemini → GCS →
 * Firestore の 3 層カスケード). 本 composable はそれの薄ラッパー + コンテキスト解決.
 *
 * 利用例:
 *   const { deleteKnowledge, getKnowledge } = useKnowledgeOperator();
 *   await deleteKnowledge(doc);
 *
 * 設計方針:
 *   - 引数は基本的に `Knowledge` instance (doc.id / doc.storeId を信頼する).
 *   - 「id しか持ってないけど消したい」ケースは `deleteKnowledgeById` を別途用意.
 *   - error は throw せず { ok, error } で返す (UI で toast に流しやすい).
 */

import { computed } from "vue";
import log from "@utils/logger";
import type { Knowledge } from "@models/document";
import { useGeminiFileSpaceOperatorStore } from "@stores/geminiFileSpaceOperator";
import { useOrganizationStore } from "@stores/organization";
import { useSpaceStore } from "@stores/space";

export type KnowledgeOpResult =
  | { ok: true; requestDocId: string | null }
  | { ok: false; error: string };

export function useKnowledgeOperator() {
  const fileSpaceStore = useGeminiFileSpaceOperatorStore();
  const organizationStore = useOrganizationStore();
  const spaceStore = useSpaceStore();

  const orgId = computed(() => organizationStore.getLoggedInOrganizationId);
  const spaceId = computed(() => spaceStore.selectedSpace?.id ?? null);

  /**
   * Knowledge を Gemini / GCS / Firestore の 3 層から削除する.
   *
   * doc.id / doc.storeId が無いケースは早期 fail. storeId 未指定なら opts.storeId
   * を fallback として使う (default FileSpace 経由の削除).
   */
  const deleteKnowledge = async (
    knowledge: Knowledge,
    opts?: { storeId?: string }
  ): Promise<KnowledgeOpResult> => {
    if (!orgId.value || !spaceId.value) {
      const err = `context_missing (org=${orgId.value ?? "?"} / space=${spaceId.value ?? "?"})`;
      log("ERROR", "deleteKnowledge: context missing", { err });
      return { ok: false, error: err };
    }
    const storeId = knowledge.storeId || opts?.storeId;
    if (!storeId) {
      const err = `missing_store_id (knowledgeId=${knowledge.id ?? "?"})`;
      log("ERROR", "deleteKnowledge: missing storeId", { err, knowledge });
      return { ok: false, error: err };
    }
    if (!knowledge.id) {
      const err = `missing_knowledge_id (name=${knowledge.name ?? "?"})`;
      log("ERROR", "deleteKnowledge: missing knowledge.id", { err });
      return { ok: false, error: err };
    }

    try {
      const requestDoc = await fileSpaceStore.deleteDocumentFully({
        doc: knowledge,
        storeId,
        organizationId: orgId.value,
        spaceId: spaceId.value,
      });
      log("INFO", "deleteKnowledge: succeeded", {
        knowledgeId: knowledge.id,
        storeId,
        geminiRequestDocId: requestDoc?.id ?? null,
      });
      return { ok: true, requestDocId: requestDoc?.id ?? null };
    } catch (e) {
      const err = (e as Error).message || String(e);
      log("ERROR", "deleteKnowledge: failed", {
        err,
        knowledgeId: knowledge.id,
      });
      return { ok: false, error: err };
    }
  };

  /**
   * Knowledge を ID だけで削除. store の documents から該当 doc を探して deleteKnowledge.
   * 見つからなければ early return.
   */
  const deleteKnowledgeById = async (
    knowledgeId: string,
    opts?: { storeId?: string }
  ): Promise<KnowledgeOpResult> => {
    const knowledge = fileSpaceStore.documents.find((d) => d.id === knowledgeId);
    if (!knowledge) {
      const err = `knowledge_not_found_in_state (id=${knowledgeId})`;
      log("WARN", "deleteKnowledgeById: not in state", { err });
      return { ok: false, error: err };
    }
    return deleteKnowledge(knowledge, opts);
  };

  /**
   * 複数 knowledge を並列削除. 個別失敗は許容 (Promise.allSettled).
   * 戻り値は { success, fail, reasons } のサマリ.
   */
  const deleteKnowledgeBulk = async (
    knowledges: Knowledge[],
    opts?: { storeId?: string }
  ): Promise<{ success: number; fail: number; reasons: string[] }> => {
    const results = await Promise.allSettled(
      knowledges.map((k) => deleteKnowledge(k, opts))
    );
    let success = 0;
    let fail = 0;
    const reasons: string[] = [];
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.ok) {
        success++;
      } else {
        fail++;
        if (r.status === "fulfilled" && !r.value.ok) reasons.push(r.value.error);
        else if (r.status === "rejected")
          reasons.push((r.reason as Error)?.message ?? "unknown");
      }
    }
    return { success, fail, reasons };
  };

  /**
   * Knowledge を ID で取得 (store の現在 state から).
   * 必要なら fetch を別経路で先に走らせること.
   */
  const getKnowledge = (knowledgeId: string): Knowledge | null => {
    return fileSpaceStore.documents.find((d) => d.id === knowledgeId) ?? null;
  };

  /**
   * レガシー `en-aistudio_snapshot__*.xlsx` を FileSpace / DE から一括削除する。
   */
  const purgeMasterSnapshotDocuments = async (opts: {
    storeId: string;
    documents?: Knowledge[];
  }): Promise<{ success: number; fail: number }> => {
    if (!orgId.value || !spaceId.value) {
      return { success: 0, fail: 0 };
    }
    return fileSpaceStore.purgeMasterSnapshotDocuments({
      storeId: opts.storeId,
      organizationId: orgId.value,
      spaceId: spaceId.value,
      documents: opts.documents,
    });
  };

  return {
    deleteKnowledge,
    deleteKnowledgeById,
    deleteKnowledgeBulk,
    getKnowledge,
    purgeMasterSnapshotDocuments,
  };
}
