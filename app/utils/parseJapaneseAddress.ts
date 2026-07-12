/**
 * 日本の住所1行文字列を都道府県 / 市区町村 / 番地に分割する.
 * gBizINFO / URL スクレイプが location を文字列のみで返すケース向け
 * (backend address_parser と同等ロジック).
 */

const PREFECTURE_RE =
  /^(北海道|(?:東京都|(?:京都|大阪)府|[^都道府県]{2,4}[都道府県]))/;

const CITY_RE = /^(.+?(?:区|市|町|村))/;

/** 先頭の 〒108-0014 / 1080014 等を除去してから都道府県マッチさせる */
const POSTAL_PREFIX_RE = /^〒?\s*\d{3}-?\d{4}\s*/;

export type ParsedJapaneseAddress = {
  prefecture: string;
  city: string;
  street: string;
};

export const stripPostalCodePrefix = (address: string): string =>
  (address ?? "").trim().replace(POSTAL_PREFIX_RE, "").trim();

export const parseJapaneseAddress = (fullAddress: string): ParsedJapaneseAddress => {
  const text = stripPostalCodePrefix(fullAddress ?? "");
  if (!text) {
    return { prefecture: "", city: "", street: "" };
  }

  let prefecture = "";
  let city = "";
  let remainder = text;

  const prefMatch = remainder.match(PREFECTURE_RE);
  if (prefMatch) {
    prefecture = prefMatch[1];
    remainder = remainder.slice(prefMatch[1].length);
  }

  const cityMatch = remainder.match(CITY_RE);
  if (cityMatch) {
    city = cityMatch[1];
    remainder = remainder.slice(cityMatch[1].length);
  }

  let street = remainder.trim();
  if (!prefecture && !city) {
    street = text;
  } else if (!street) {
    street = text;
  }

  return { prefecture, city, street };
};

/** 都道府県・市区町村が空のとき、フル住所文字列から補完する */
export const applyParsedJapaneseAddress = (params: {
  prefecture?: string;
  city?: string;
  street?: string;
  fullAddress?: string;
}): ParsedJapaneseAddress => {
  const prefecture = (params.prefecture ?? "").trim();
  const city = (params.city ?? "").trim();
  const street = (params.street ?? "").trim();
  const full = (params.fullAddress ?? "").trim();

  if (prefecture && city && street) {
    return { prefecture, city, street };
  }
  if (!full) {
    return { prefecture, city, street };
  }

  const parsed = parseJapaneseAddress(stripPostalCodePrefix(full));
  return {
    prefecture: prefecture || parsed.prefecture,
    city: city || parsed.city,
    street: street || parsed.street,
  };
};

type LookupAddressFields = {
  postalCode?: string;
  prefecture?: string;
  city?: string;
  streetAddress?: string;
  address?: string;
};

/** lookup 結果の所在地フィールドをフル住所文字列から補完する */
export const enrichBusinessPartnerLookupAddress = <T extends LookupAddressFields>(
  result: T
): T => {
  const fullRaw = (result.address ?? "").trim();
  const streetRaw = (result.streetAddress ?? "").trim();
  const source = fullRaw || streetRaw;
  if (!source) {
    return result;
  }

  const parsed = applyParsedJapaneseAddress({
    prefecture: result.prefecture,
    city: result.city,
    street: result.streetAddress,
    fullAddress: source,
  });

  const prefecture = parsed.prefecture;
  const city = parsed.city;
  const street = parsed.street;
  const body = [prefecture, city, street].filter(Boolean).join("");

  let address = fullRaw;
  if (body && (!fullRaw || fullRaw.replace(POSTAL_PREFIX_RE, "").length < body.length)) {
    const postal = (result.postalCode ?? "").trim();
    address = postal ? `〒${postal} ${body}` : body;
  }

  return {
    ...result,
    prefecture: prefecture || result.prefecture,
    city: city || result.city,
    streetAddress: street || result.streetAddress,
    address: address || result.address,
  };
};
