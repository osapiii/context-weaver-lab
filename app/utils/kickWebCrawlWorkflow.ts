import type { RequestMetadata } from "@models/core/operationMetadata";
import { getWebCrawlWorkflowKickerUrl } from "@utils/webCrawlServiceUrl";

export type KickWebCrawlWorkflowParams = {
  requestPath: string;
  requestId: string;
  organizationId: string;
  input: {
    url: string;
    bucketName: string;
    folderPath: string;
    maxDepth: number;
    maxUrls: number;
    fileSpaceId: string;
    description?: string | null;
    includeImages?: boolean;
  };
  operationMetadata: RequestMetadata;
  kickerBaseUrl?: string;
  fetchImpl?: typeof fetch;
};

export type KickWebCrawlWorkflowResult = {
  ok: boolean;
  alreadyStarted?: boolean;
  error?: string;
};

/**
 * Web クロール Workflow を起動する。
 * 本番では Firestore trigger も同じ `/kick` を呼ぶが、Emulator や trigger 未デプロイ時は FE 呼び出しのみが動く。
 */
export async function kickWebCrawlWorkflow(
  params: KickWebCrawlWorkflowParams
): Promise<KickWebCrawlWorkflowResult> {
  const base = (params.kickerBaseUrl ?? getWebCrawlWorkflowKickerUrl()).replace(
    /\/$/,
    ""
  );
  const fetchFn = params.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await fetchFn(`${base}/kick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestPath: params.requestPath,
        requestId: params.requestId,
        organizationId: params.organizationId,
        input: {
          url: params.input.url,
          bucketName: params.input.bucketName,
          folderPath: params.input.folderPath,
          maxDepth: params.input.maxDepth,
          maxUrls: params.input.maxUrls,
          fileSpaceId: params.input.fileSpaceId,
          description: params.input.description ?? null,
          includeImages: params.input.includeImages ?? true,
        },
        operationMetadata: params.operationMetadata,
      }),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "workflow kicker に接続できません";
    return { ok: false, error: message };
  }

  const payload = (await response.json().catch(() => ({}))) as {
    status?: string;
    output?: { alreadyStarted?: boolean };
    error?: { message?: string };
  };

  if (!response.ok) {
    return {
      ok: false,
      error:
        payload.error?.message ??
        `Workflow の起動に失敗しました (HTTP ${response.status})`,
    };
  }

  return {
    ok: true,
    alreadyStarted: payload.output?.alreadyStarted === true,
  };
}
