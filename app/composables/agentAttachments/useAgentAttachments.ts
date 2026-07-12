/**
 * Agent 参考資料 添付の Storage CRUD.
 *
 * パス規約: `agentAttachments/{uid}/{ymd}/{id}-{filename}`
 *   - uid 単位で隔離 (Firebase Storage rules で本人のみ R/W)
 *   - ymd で日次フォルダ化 (一覧性 / 退避時のグルーピング向け)
 *   - id は短いランダム文字列 (timestamp + rand)
 *
 * size 上限: 既定 25MB / 1 ファイル. PDF や図解 1 枚画像が無難に収まるサイズ.
 */
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";
import { getAuth } from "firebase/auth";
import log from "@utils/logger";
import { resolveStorageBucketName } from "@utils/adkAttachments";
import type { AttachmentRef } from "./types";

const DEFAULT_MAX_SIZE = 25 * 1024 * 1024; // 25MB

const newId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const ymd = (): string => {
  const d = new Date();
  const yyyy = d.getFullYear().toString();
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
};

/**
 * ファイル名から path に使える safe な形を作る. 拡張子は残す.
 */
const sanitizeFilename = (name: string): string =>
  name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);

export interface UseAgentAttachmentsOptions {
  /** バイト数上限. 既定 25MB. */
  maxBytes?: number;
}

export const useAgentAttachments = (
  options: UseAgentAttachmentsOptions = {}
) => {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_SIZE;

  const upload = async (file: File): Promise<AttachmentRef> => {
    if (file.size > maxBytes) {
      throw new Error(
        `ファイルが大きすぎます (上限 ${Math.round(
          maxBytes / 1024 / 1024
        )}MB, 実際 ${Math.round(file.size / 1024 / 1024)}MB)`
      );
    }
    const user = getAuth().currentUser;
    if (!user) throw new Error("ログイン状態ではありません.");

    const id = newId();
    const safeName = sanitizeFilename(file.name);
    const path = `agentAttachments/${user.uid}/${ymd()}/${id}-${safeName}`;

    const storage = getStorage();
    const r = storageRef(storage, path);
    try {
      await uploadBytes(r, file, {
        contentType: file.type || "application/octet-stream",
      });
    } catch (e) {
      log("ERROR", "[agentAttachments] upload failed", e);
      throw new Error(
        e instanceof Error ? e.message : "アップロードに失敗しました"
      );
    }
    const url = await getDownloadURL(r);
    const bucket = resolveStorageBucketName();
    const gcsPath = `gs://${bucket}/${path}`;

    return {
      id,
      name: file.name,
      url,
      storagePath: path,
      gcsPath,
      size: file.size,
      mimeType: file.type || "application/octet-stream",
      uploadedAt: Date.now(),
    };
  };

  const remove = async (attachment: AttachmentRef): Promise<void> => {
    const storage = getStorage();
    const r = storageRef(storage, attachment.storagePath);
    try {
      await deleteObject(r);
    } catch (e) {
      // 既に削除済み等は無視
      log("WARN", "[agentAttachments] delete failed (ignored)", e);
    }
  };

  return { upload, remove };
};

/**
 * 添付ファイル群を prompt の追加セクションに整形する.
 * 各 agent の buildPrompt(draft) の戻りに concat して finalize prompt を作る.
 */
export const buildAttachmentsPromptSection = (
  attachments: AttachmentRef[]
): string => {
  if (attachments.length === 0) return "";
  const lines: string[] = ["", "# 参考資料 (ユーザー添付)"];
  for (const a of attachments) {
    const sizeKb = Math.round(a.size / 1024);
    lines.push(`- [${a.name}](${a.url}) (${a.mimeType}, ${sizeKb}KB)`);
  }
  lines.push("");
  lines.push(
    "上記の URL は Firebase Storage の認証付き download link です. " +
      "AI 側で直接 fetch できる場合は内容を参照し、できない場合は ユーザーに " +
      "「資料の要点を 1-2 文でこの場で教えてください」と聞き返してください."
  );
  return lines.join("\n");
};
