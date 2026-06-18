import type { BusinessPartnerFormSnapshot } from "@models/businessPartnerFormAssistant";

export type BusinessPartnerAssistantRoute = "local_fill" | "web_search";

const WEB_SEARCH_HINT =
  /調べ|検索|サーチ|代表者|資本金|設立日|本社|所在地|住所|郵便|公式|サイト|電話|メール|フリガナ|商号|法人番号を|徹底|リサーチ|web\s*検索/i;

const CODE_HINT = /取引先コード|コード生成|コードを|コード付|BP[-_]?|code\s*gen/i;

const LOCAL_FILL_HINT =
  /生成して|生成し|付けて|つけて|決めて|良い感じ|お任せ|適当に|埋めて|補完して|反映して/i;

/**
 * Web 検索が必要か、フォーム既存値だけで足りるかをヒューリスティック判定.
 */
export const classifyBusinessPartnerAssistantIntent = (
  userMessage: string,
  snapshot: BusinessPartnerFormSnapshot
): BusinessPartnerAssistantRoute => {
  const msg = userMessage.trim();
  if (!msg) return "web_search";

  if (WEB_SEARCH_HINT.test(msg)) {
    return "web_search";
  }

  const asksCode = /コード/.test(msg);
  const hasIdentity =
    Boolean(snapshot.corporateNumber?.trim()) ||
    Boolean(snapshot.name?.trim()) ||
    Boolean(snapshot.tradeName?.trim());

  if (asksCode && (CODE_HINT.test(msg) || LOCAL_FILL_HINT.test(msg))) {
    return "local_fill";
  }

  if (asksCode && hasIdentity && !WEB_SEARCH_HINT.test(msg)) {
    return "local_fill";
  }

  if (
    LOCAL_FILL_HINT.test(msg) &&
    hasIdentity &&
    !WEB_SEARCH_HINT.test(msg) &&
    !/代表|資本金|設立|住所|サイト|電話|メール/.test(msg)
  ) {
    return "local_fill";
  }

  return "web_search";
};
