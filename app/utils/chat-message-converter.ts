/**
 * Chat Message Converter Utility
 *
 * Firebase Vertex AI形式のメッセージをAI SDK v5形式（NuxtUI ChatMessages用）に変換するユーティリティ
 */

/**
 * AI SDK v5形式のメッセージ型
 */
export interface AISDKMessage {
  id: string;
  role: "user" | "assistant" | "system";
  parts: Array<{ type: "text"; text: string }>;
}

/**
 * ChatStatus型（NuxtUI ChatMessages用）
 */
export type ChatStatus = "ready" | "submitted" | "streaming" | "error";

/**
 * 既存のメッセージ形式（vertexAIChatStore.currentChatSessionHistoryForView）
 */
export interface VertexAIMessage {
  type: "chat" | "section";
  chatInfo?: {
    rawText: string;
    htmlText: string;
  };
  role: "user" | "ai" | "system";
}

/**
 * メッセージIDとHTMLテキストのマッピング（レンダリング用）
 */
export interface MessageHtmlMap {
  [messageId: string]: string;
}

/**
 * 既存形式のメッセージをAI SDK v5形式に変換
 *
 * @param messages - 既存形式のメッセージ配列
 * @returns AI SDK v5形式のメッセージ配列とHTMLマッピング
 */
export function convertToAISDKFormat(
  messages: VertexAIMessage[]
): {
  convertedMessages: AISDKMessage[];
  htmlMap: MessageHtmlMap;
} {
  const convertedMessages: AISDKMessage[] = [];
  const htmlMap: MessageHtmlMap = {};

  messages.forEach((message, index) => {
    // sectionタイプのメッセージはスキップ（チャットメッセージのみ変換）
    if (message.type !== "chat" || !message.chatInfo) {
      return;
    }

    // roleを変換（'ai' → 'assistant'）
    const role =
      message.role === "ai"
        ? "assistant"
        : (message.role as "user" | "assistant" | "system");

    // メッセージIDを生成（安定したIDのため、indexベースを使用）
    // rawTextの一部も含めて、より一意性を確保
    const textHash = message.chatInfo.rawText
      .slice(0, 10)
      .replace(/\s/g, "")
      .replace(/[^a-zA-Z0-9]/g, "");
    const messageId = `msg_${index}_${role}_${textHash}`;

    // AI SDK v5形式に変換
    const convertedMessage: AISDKMessage = {
      id: messageId,
      role,
      parts: [
        {
          type: "text",
          text: message.chatInfo.rawText,
        },
      ],
    };

    convertedMessages.push(convertedMessage);

    // HTMLテキストをマッピングに保存（レンダリング用）
    // ユーザーメッセージの場合はrawTextをそのまま使用、AIメッセージの場合はhtmlTextを使用
    htmlMap[messageId] =
      message.role === "user"
        ? message.chatInfo.rawText
        : message.chatInfo.htmlText || message.chatInfo.rawText;
  });

  return {
    convertedMessages,
    htmlMap,
  };
}

/**
 * Storeの状態からChatStatusを取得
 *
 * @param chatIsLoading - チャットがローディング中かどうか
 * @param hasError - エラーが発生しているかどうか
 * @returns ChatStatus
 */
export function getChatStatus(
  chatIsLoading: boolean,
  hasError: boolean = false
): ChatStatus {
  if (hasError) {
    return "error";
  }
  if (chatIsLoading) {
    // ストリーミング中かどうかは現在の実装では区別できないため、
    // ローディング中は'submitted'として扱う
    // 将来的にストリーミング検知が可能になったら'streaming'に変更可能
    return "submitted";
  }
  return "ready";
}

/**
 * メッセージIDからHTMLテキストを取得
 *
 * @param messageId - メッセージID
 * @param htmlMap - HTMLマッピング
 * @returns HTMLテキスト（存在しない場合は空文字列）
 */
export function getMessageHtml(
  messageId: string,
  htmlMap: MessageHtmlMap
): string {
  return htmlMap[messageId] || "";
}

