import type {
  BusinessPartnerLookupResult,
  BusinessPartnerType,
} from "@models/businessPartner";
import type { BusinessPartnerBulkImportPartnerPreview } from "@models/businessPartnerBulkImportRequest";
import type { BusinessPartnerAssistantPatch } from "@models/businessPartnerFormAssistant";
import type { BusinessPartnerFormSnapshot } from "@models/businessPartnerFormAssistant";
import { enrichBusinessPartnerLookupAddress } from "@utils/parseJapaneseAddress";
import { suggestBusinessPartnerCode } from "@utils/suggestBusinessPartnerCode";
import createRandomDocId from "@utils/createRandomDocId";

type BuildPreviewInput = {
  type: BusinessPartnerType;
  companyName: string;
  url: string;
  lookup?: BusinessPartnerLookupResult | null;
  assistantPatch?: BusinessPartnerAssistantPatch | null;
  existingCodes: readonly string[];
};

const emptySnapshot = (
  companyName: string,
  url: string
): BusinessPartnerFormSnapshot => ({
  code: "",
  name: companyName,
  corporateNumber: "",
  tradeName: "",
  tradeNameKana: "",
  postalCode: "",
  prefecture: "",
  city: "",
  streetAddress: "",
  address: "",
  capitalStock: "",
  representativeName: "",
  representativeTitle: "",
  foundedDate: "",
  industry: "",
  employeeCount: "",
  businessSummary: "",
  contactPerson: "",
  phoneNumber: "",
  email: "",
  website: url,
  note: "",
});

const mergeLookup = (
  base: BusinessPartnerFormSnapshot,
  lookup: BusinessPartnerLookupResult
): void => {
  const enriched = enrichBusinessPartnerLookupAddress(lookup);
  const setIfEmpty = (key: keyof BusinessPartnerFormSnapshot, value?: string) => {
    if (!value?.trim()) return;
    if (base[key].trim().length > 0) return;
    base[key] = value.trim();
  };

  setIfEmpty("name", enriched.name ?? base.name);
  setIfEmpty("tradeName", enriched.tradeName ?? enriched.name);
  setIfEmpty("tradeNameKana", enriched.tradeNameKana);
  setIfEmpty("corporateNumber", enriched.corporateNumber);
  setIfEmpty("postalCode", enriched.postalCode);
  setIfEmpty("prefecture", enriched.prefecture);
  setIfEmpty("city", enriched.city);
  setIfEmpty("streetAddress", enriched.streetAddress);
  setIfEmpty("address", enriched.address);
  setIfEmpty("phoneNumber", enriched.phoneNumber);
  setIfEmpty("email", enriched.email);
  setIfEmpty("website", enriched.website ?? base.website);
  setIfEmpty("capitalStock", enriched.capitalStock);
  setIfEmpty("representativeName", enriched.representativeName);
  setIfEmpty("representativeTitle", enriched.representativeTitle);
  setIfEmpty("foundedDate", enriched.foundedDate);
  setIfEmpty("industry", enriched.industry);
  setIfEmpty("employeeCount", enriched.employeeCount);
  setIfEmpty("businessSummary", enriched.businessSummary);
};

const mergeAssistant = (
  base: BusinessPartnerFormSnapshot,
  patch: BusinessPartnerAssistantPatch
): void => {
  if (!patch.fields) return;
  for (const [key, value] of Object.entries(patch.fields)) {
    if (value === undefined || value === null) continue;
    const k = key as keyof BusinessPartnerFormSnapshot;
    if (!(k in base)) continue;
    if (base[k].trim().length > 0) continue;
    base[k] = String(value).trim();
  }
};

const composedAddress = (snap: BusinessPartnerFormSnapshot): string | undefined => {
  const parts = [snap.prefecture, snap.city, snap.streetAddress].filter(
    (s) => s.trim().length > 0
  );
  return parts.length > 0 ? parts.join("") : undefined;
};

/**
 * lookup + AI 補完結果から Firestore 反映前プレビューを組み立てる.
 */
export const buildBusinessPartnerBulkPreview = (
  input: BuildPreviewInput
): BusinessPartnerBulkImportPartnerPreview => {
  const snap = emptySnapshot(input.companyName, input.url);
  if (input.lookup) {
    mergeLookup(snap, input.lookup);
  }
  if (input.assistantPatch) {
    mergeAssistant(snap, input.assistantPatch);
  }

  if (!snap.name.trim()) {
    snap.name = input.companyName;
  }
  if (!snap.website.trim()) {
    snap.website = input.url;
  }

  const code = suggestBusinessPartnerCode({
    type: input.type,
    corporateNumber: snap.corporateNumber,
    name: snap.name,
    tradeName: snap.tradeName,
    existingCodes: input.existingCodes,
  });

  const trim = (v: string) => (v.trim() ? v.trim() : undefined);
  const finalAddress = trim(snap.address) ?? composedAddress(snap);

  return {
    partnerId: createRandomDocId(),
    type: input.type,
    code,
    name: snap.name.trim() || input.companyName,
    website: trim(snap.website) ?? input.url,
    address: finalAddress,
    phoneNumber: trim(snap.phoneNumber),
    email: trim(snap.email),
    contactPerson: trim(snap.contactPerson),
    note: trim(snap.note),
    corporateNumber: trim(snap.corporateNumber),
    tradeName: trim(snap.tradeName),
    tradeNameKana: trim(snap.tradeNameKana),
    postalCode: trim(snap.postalCode),
    prefecture: trim(snap.prefecture),
    city: trim(snap.city),
    streetAddress: trim(snap.streetAddress),
    capitalStock: trim(snap.capitalStock),
    representativeName: trim(snap.representativeName),
    representativeTitle: trim(snap.representativeTitle),
    foundedDate: trim(snap.foundedDate),
    industry: trim(snap.industry),
    employeeCount: trim(snap.employeeCount),
    businessSummary: trim(snap.businessSummary),
    lookupSource: input.lookup?.lookupSource ?? "url",
    lookupAt: new Date().toISOString(),
  };
};
