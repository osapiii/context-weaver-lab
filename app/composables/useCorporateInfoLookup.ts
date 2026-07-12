import type {
  BusinessPartnerLookupResult,
  BusinessPartnerLookupSource,
} from "@models/businessPartner";
import log from "@utils/logger";
import {
  applyParsedJapaneseAddress,
  enrichBusinessPartnerLookupAddress,
} from "@utils/parseJapaneseAddress";

/**
 * 法人番号 / 公式 URL から会社プロファイルを自動取得する composable.
 *
 * 取得元 (優先順):
 *   1. `corporateInfoLookupEndpoint` (Cloud Run / Cloud Function プロキシ)
 *      - 入力: { corporateNumber?, url? }
 *      - 出力: BusinessPartnerLookupResult 形式の JSON
 *   2. gBizINFO API への直接呼び出し (法人番号モードのみ, トークン要)
 *      - 公開 API https://info.gbiz.go.jp/hojin/v1/hojin/{法人番号}
 *      - レスポンスを EN AIstudio 内部形式に正規化する
 *
 * いずれも未設定 / 失敗時はエラーを返し、呼び出し側 UI は手動入力にフォールバックする.
 */

const CORPORATE_NUMBER_REGEX = /^\d{13}$/;

/** プロキシ lookup の最大待ち時間 (UI が固まらないよう fail-fast) */
const LOOKUP_FETCH_TIMEOUT_MS = 30_000;

const sanitizeCorporateNumber = (raw: string): string =>
  raw.replace(/[^\d]/g, "");

const isValidCorporateNumber = (raw: string): boolean =>
  CORPORATE_NUMBER_REGEX.test(sanitizeCorporateNumber(raw));

const isValidUrl = (raw: string): boolean => {
  try {
    const parsed = new URL(raw.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

export type CorporateInfoLookupInput =
  | { kind: "corporateNumber"; value: string }
  | { kind: "url"; value: string };

export type CorporateInfoLookupOutcome =
  | { ok: true; result: BusinessPartnerLookupResult }
  | {
      ok: false;
      reason: "invalid_input" | "not_configured" | "not_found" | "network_error";
      message: string;
    };

export const useCorporateInfoLookup = () => {
  const runtime = useRuntimeConfig();

  /**
   * プロキシエンドポイント (Cloud Run など) 経由で取得.
   * EN AIstudio バックエンド側で 法人番号 API / Web スクレイピングを集約する想定.
   */
  const lookupViaProxy = async (
    input: CorporateInfoLookupInput
  ): Promise<CorporateInfoLookupOutcome | null> => {
    const endpoint = runtime.public.corporateInfoLookupEndpoint as string;
    if (!endpoint) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      LOOKUP_FETCH_TIMEOUT_MS
    );
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          corporateNumber:
            input.kind === "corporateNumber" ? input.value : undefined,
          url: input.kind === "url" ? input.value : undefined,
        }),
        signal: controller.signal,
      });

      if (response.status === 404) {
        return {
          ok: false,
          reason: "not_found",
          message:
            "指定の法人番号 / URL では会社情報が見つかりませんでした。手入力で登録してください。",
        };
      }

      if (!response.ok) {
        log("WARN", "Corporate lookup proxy returned non-OK status", response.status);
        return {
          ok: false,
          reason: "network_error",
          message: `自動取得サービスがエラーを返しました (HTTP ${response.status})。手入力で登録してください。`,
        };
      }

      const json = (await response.json()) as Partial<BusinessPartnerLookupResult>;
      const result = enrichBusinessPartnerLookupAddress({
        ...json,
        lookupSource:
          (json.lookupSource as BusinessPartnerLookupSource | undefined) ??
          input.kind,
      } as BusinessPartnerLookupResult);
      return { ok: true, result };
    } catch (error) {
      log("ERROR", "Corporate lookup proxy fetch failed", error);
      if (error instanceof Error && error.name === "AbortError") {
        return {
          ok: false,
          reason: "network_error",
          message:
            "自動取得がタイムアウトしました。URL を確認するか、手入力で登録してください。",
        };
      }
      return {
        ok: false,
        reason: "network_error",
        message:
          "自動取得サービスに接続できませんでした。手入力で登録してください。",
      };
    } finally {
      clearTimeout(timeoutId);
    }
  };

  /**
   * gBizINFO 公開 API への直接呼び出し (法人番号モードのみ).
   * CORS が許可されているため SPA からそのまま叩ける.
   * トークン未設定の場合は null を返してフォールバック.
   */
  const lookupViaGbizInfo = async (
    corporateNumber: string
  ): Promise<CorporateInfoLookupOutcome | null> => {
    const token = runtime.public.gbizInfoApiToken as string;
    if (!token) return null;

    const url = `https://info.gbiz.go.jp/hojin/v1/hojin/${corporateNumber}`;
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "X-hojinInfo-api-token": token,
          Accept: "application/json",
        },
      });

      if (response.status === 404) {
        return {
          ok: false,
          reason: "not_found",
          message:
            "gBizINFO に該当する法人が見つかりませんでした。手入力で登録してください。",
        };
      }

      if (!response.ok) {
        return {
          ok: false,
          reason: "network_error",
          message: `gBizINFO がエラーを返しました (HTTP ${response.status})。`,
        };
      }

      const json = await response.json();
      const hojin = json?.["hojin-infos"]?.[0];
      if (!hojin) {
        return {
          ok: false,
          reason: "not_found",
          message: "gBizINFO の応答に法人情報が含まれていませんでした。",
        };
      }

      const location = hojin.location;
      let prefecture = "";
      let city = "";
      let street = "";
      let fullAddress = "";
      if (typeof location === "string") {
        fullAddress = location.trim();
        const parsed = applyParsedJapaneseAddress({ fullAddress });
        prefecture = parsed.prefecture;
        city = parsed.city;
        street = parsed.street;
      } else if (location && typeof location === "object") {
        prefecture = location.prefecture_name ?? "";
        city = location.city_name ?? "";
        street = location.street_number ?? "";
        fullAddress = [prefecture, city, street].filter(Boolean).join("");
        const parsed = applyParsedJapaneseAddress({
          prefecture,
          city,
          street,
          fullAddress,
        });
        prefecture = parsed.prefecture;
        city = parsed.city;
        street = parsed.street;
      }

      const lookupResult = enrichBusinessPartnerLookupAddress({
        corporateNumber,
        name: hojin.name,
        tradeName: hojin.name,
        tradeNameKana: hojin.kana,
        postalCode:
          hojin.postal_code ??
          (typeof location === "object" && location ? location.postal_code : undefined),
        prefecture,
        city,
        streetAddress: street,
        address: fullAddress || undefined,
        lookupSource: "corporateNumber",
      });

      return {
        ok: true,
        result: {
          ...lookupResult,
          phoneNumber: hojin.representative_phone_number,
          website: hojin.company_url,
          capitalStock: hojin.capital_stock
            ? String(hojin.capital_stock)
            : undefined,
          representativeName: hojin.representative_name,
          representativeTitle: hojin.representative_position,
          foundedDate: hojin.date_of_establishment,
          industry: Array.isArray(hojin.business_summary?.business_items)
            ? hojin.business_summary.business_items.join(", ")
            : hojin.business_items,
          employeeCount: hojin.employee_number
            ? `${hojin.employee_number}人`
            : undefined,
          businessSummary:
            hojin.business_summary?.business_summary ??
            hojin.business_summary ??
            undefined,
        },
      };
    } catch (error) {
      log("ERROR", "gBizINFO fetch failed", error);
      return {
        ok: false,
        reason: "network_error",
        message:
          "gBizINFO に接続できませんでした。ネットワーク状態を確認してください。",
      };
    }
  };

  /**
   * 入力をバリデートし、利用可能な取得元へディスパッチする.
   */
  const lookup = async (
    input: CorporateInfoLookupInput
  ): Promise<CorporateInfoLookupOutcome> => {
    if (input.kind === "corporateNumber") {
      const normalized = sanitizeCorporateNumber(input.value);
      if (!isValidCorporateNumber(normalized)) {
        return {
          ok: false,
          reason: "invalid_input",
          message: "法人番号は半角数字 13 桁で入力してください。",
        };
      }

      const proxyResult = await lookupViaProxy({
        kind: "corporateNumber",
        value: normalized,
      });
      if (proxyResult) return proxyResult;

      const gbizResult = await lookupViaGbizInfo(normalized);
      if (gbizResult) return gbizResult;

      return {
        ok: false,
        reason: "not_configured",
        message:
          "自動取得が未設定です。管理者に gBizINFO トークン または lookup endpoint の設定を依頼してください。",
      };
    }

    // url モード
    const trimmed = input.value.trim();
    if (!isValidUrl(trimmed)) {
      return {
        ok: false,
        reason: "invalid_input",
        message: "URL は http(s):// で始まる形式で入力してください。",
      };
    }

    const proxyResult = await lookupViaProxy({ kind: "url", value: trimmed });
    if (proxyResult) return proxyResult;

    return {
      ok: false,
      reason: "not_configured",
      message:
        "URL からの自動取得が未設定です。管理者に lookup endpoint (web crawler) の設定を依頼してください。",
    };
  };

  return {
    lookup,
    isValidCorporateNumber,
    isValidUrl,
    sanitizeCorporateNumber,
  };
};
