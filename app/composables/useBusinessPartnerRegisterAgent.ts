/**
 * 取引先登録 Step1 — ADK business_partner Agent (RequestDoc 経由、UI は session SSOT).
 */
import { doc, onSnapshot } from "firebase/firestore";
import type { BusinessPartnerLookupResult } from "@models/businessPartner";
import type { BusinessPartnerType } from "@models/businessPartner";
import type { BusinessPartnerAssistantPatch } from "@models/businessPartnerFormAssistant";
import type { RequestLog } from "@models/core/requestStatus";
import { createAdkInvokeRequest } from "@composables/useAdkInvokeRequest";
import { buildAdkInvokeInput } from "@utils/adkInvokeInputBuilder";
import { resolveAdkSessionScope } from "@composables/useAdkSessionScope";
import createRandomDocId from "@utils/createRandomDocId";
import { getAuth } from "firebase/auth";
import log from "@utils/logger";
import { readTaskInvokeFromState } from "@utils/enAiStudioSessionStateIO";
import { isInvokeTerminal } from "@utils/taskInvokeIO";

export type BusinessPartnerLookupMode = "url" | "corporateNumber";

export type BusinessPartnerRegisterPhase =
  | "idle"
  | "lookup"
  | "agent"
  | "done"
  | "error";

const createId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const invokeLogsToRequestLogs = (
  logs: Array<{ ts: number; message: string; type: string }>
): RequestLog[] =>
  logs.map((entry) => ({
    timestamp: new Date(entry.ts),
    message: entry.message,
    type: entry.type === "error" ? "error" : "info",
  }));

const draftFromBucket = (
  bucket: Record<string, unknown> | undefined
): BusinessPartnerAssistantPatch | null => {
  if (!bucket) return null;
  const raw =
    bucket.artifact ?? bucket.draft ?? bucket.payload;
  if (!raw || typeof raw !== "object") return null;
  const draft = raw as Record<string, unknown>;
  const fields = draft.fields;
  if (!fields || typeof fields !== "object") return null;
  return {
    comment: typeof draft.comment === "string" ? draft.comment : "",
    fields: fields as BusinessPartnerAssistantPatch["fields"],
    sources: Array.isArray(draft.sources) ? draft.sources : [],
  };
};

export const useBusinessPartnerRegisterAgent = () => {
  const phase = ref<BusinessPartnerRegisterPhase>("idle");
  const requestLogs = ref<RequestLog[]>([]);
  const progressMessage = ref("");
  const lastError = ref("");

  const enrichViaAgent = async (params: {
    partnerType: BusinessPartnerType;
    lookupMode: BusinessPartnerLookupMode;
    websiteUrl: string;
    corporateNumber?: string;
    lookupResult?: BusinessPartnerLookupResult | null;
    existingCodes: readonly string[];
  }): Promise<BusinessPartnerAssistantPatch | null> => {
    lastError.value = "";
    requestLogs.value = [];
    progressMessage.value = "";

    const uid = getAuth().currentUser?.uid;
    if (!uid) {
      lastError.value = "ログイン状態ではありません";
      phase.value = "error";
      return null;
    }

    let scope: { organizationId: string; spaceId: string };
    try {
      scope = resolveAdkSessionScope();
    } catch {
      lastError.value = "組織・スペースが選択されていません";
      phase.value = "error";
      return null;
    }

    phase.value = "agent";
    progressMessage.value = "AI が Web 調査とマスタ整形を実行しています…";

    const sessionId = `bp_${createId()}`;
    const responseId = `bp_res_${createId()}`;
    const website =
      params.websiteUrl.trim() ||
      params.lookupResult?.website?.trim() ||
      "";

    const modeState = {
      active_mode: "business_partner",
      business_partner: {
        partner_type: params.partnerType,
        lookup_mode: params.lookupMode,
        website_url: website,
        corporate_number: params.corporateNumber?.trim() || "",
        existing_codes: [...params.existingCodes],
        lookup: params.lookupResult ?? null,
        phase: "url_submitted",
      },
    };

    const prompt =
      params.lookupMode === "corporateNumber"
        ? [
            "法人番号と既取得の登記情報をもとに、取引先マスタのドラフトを完成させてください。",
            `法人番号: ${params.corporateNumber ?? ""}`,
            website ? `公式サイト URL: ${website}` : "",
          ]
            .filter(Boolean)
            .join("\n")
        : [
            "公式サイト URL を起点に Web 調査し、取引先マスタのドラフトを完成させてください。",
            `公式サイト URL: ${website}`,
          ].join("\n");

    const input = buildAdkInvokeInput({
      mode: "business_partner",
      sessionId,
      organizationId: scope.organizationId,
      spaceId: scope.spaceId,
      userId: uid,
      prompt,
      responseId,
      history: [],
      modeState,
    });

    try {
      await createAdkInvokeRequest({
        input,
        organizationId: scope.organizationId,
        spaceId: scope.spaceId,
      });
    } catch (error) {
      log("ERROR", "[businessPartnerRegisterAgent] create request failed", error);
      lastError.value = "ADK リクエストの作成に失敗しました";
      phase.value = "error";
      return null;
    }

    const db = useFirestore();
    const sessionRef = doc(
      db,
      "organizations",
      scope.organizationId,
      "spaces",
      scope.spaceId,
      "adkSessions",
      sessionId
    );

    return await new Promise<BusinessPartnerAssistantPatch | null>((resolve) => {
      const finish = (patch: BusinessPartnerAssistantPatch | null): void => {
        unsub();
        resolve(patch);
      };

      const unsub = onSnapshot(
        sessionRef,
        (snap) => {
          if (!snap.exists()) return;
          const data = snap.data() as Record<string, unknown>;
          const state =
            data.state && typeof data.state === "object"
              ? (data.state as Record<string, unknown>)
              : {};
          const invoke = readTaskInvokeFromState({
            state,
            task: "business_partner",
          });
          requestLogs.value = invokeLogsToRequestLogs(invoke.logs);
          const lastLog = invoke.logs[invoke.logs.length - 1];
          if (lastLog?.message) {
            progressMessage.value = lastLog.message;
          }

          const bucket =
            state.business_partner &&
            typeof state.business_partner === "object"
              ? (state.business_partner as Record<string, unknown>)
              : undefined;

          const bpPhase =
            typeof bucket?.phase === "string" ? bucket.phase : "";
          if (bpPhase && bpPhase !== "url_submitted") {
            phase.value = "agent";
          }

          if (bpPhase === "done" || invoke.status === "completed") {
            const patch = draftFromBucket(bucket);
            if (!patch?.fields || Object.keys(patch.fields).length === 0) {
              lastError.value =
                "AI が取引先ドラフトを返しませんでした。再試行するか手入力してください。";
              phase.value = "error";
              finish(null);
              return;
            }
            progressMessage.value = patch.comment ?? "取引先情報を取得しました";
            phase.value = "done";
            finish(patch);
            return;
          }

          if (invoke.status === "error" || bpPhase === "error") {
            lastError.value =
              invoke.error_message || "ADK invoke が失敗しました";
            phase.value = "error";
            finish(null);
            return;
          }

          if (isInvokeTerminal(invoke) && bpPhase !== "done") {
            const patch = draftFromBucket(bucket);
            if (patch?.fields && Object.keys(patch.fields).length > 0) {
              progressMessage.value = patch.comment ?? "取引先情報を取得しました";
              phase.value = "done";
              finish(patch);
            }
          }
        },
        (error) => {
          log("ERROR", "[businessPartnerRegisterAgent] session snapshot failed", error);
          lastError.value = String(error);
          phase.value = "error";
          finish(null);
        }
      );
    });
  };

  const reset = (): void => {
    phase.value = "idle";
    requestLogs.value = [];
    progressMessage.value = "";
    lastError.value = "";
  };

  return {
    phase: readonly(phase),
    requestLogs: readonly(requestLogs),
    progressMessage: readonly(progressMessage),
    lastError: readonly(lastError),
    enrichViaAgent,
    reset,
    isRequestDocEnabled: () => true,
  };
};
