import type { BusinessPartnerType } from "@models/businessPartner";
import {
  BUSINESS_PARTNER_BULK_IMPORT_REQUESTS_PATH,
  type BusinessPartnerBulkImportItem,
  type DecodedBusinessPartnerBulkImportRequest,
  businessPartnerBulkImportRequestConverter,
} from "@models/businessPartnerBulkImportRequest";
import type { BusinessPartnerBulkCsvRow } from "@utils/parseBusinessPartnerBulkCsv";
import { buildBusinessPartnerBulkPreview } from "@utils/buildBusinessPartnerBulkPreview";
import log from "@utils/logger";

const PARALLEL_CONCURRENCY = 3;

const typesForRow = (row: BusinessPartnerBulkCsvRow): BusinessPartnerType[] => {
  const types: BusinessPartnerType[] = [];
  if (row.isSupplier) types.push("supplier");
  if (row.isCustomer) types.push("customer");
  return types;
};

/**
 * CSV 行ごとに lookup + AI 補完を並列実行し RequestDoc を更新する.
 */
export const useBusinessPartnerBulkImportRunner = () => {
  const corporateLookup = useCorporateInfoLookup();
  const formAssistant = useBusinessPartnerFormAssistant();
  const businessPartnerStore = useBusinessPartnerStore();
  const contextStore = useContextStore();
  const firestoreOps = useFirestoreDocOperation();

  const collectionPath = () =>
    contextStore.baseFirestorePath(BUSINESS_PARTNER_BULK_IMPORT_REQUESTS_PATH);

  const updateRequest = async (
    requestId: string,
    patch: Partial<DecodedBusinessPartnerBulkImportRequest>
  ) => {
    await firestoreOps.updateDocument({
      collectionName: collectionPath(),
      docId: requestId,
      docData: patch,
      converter: businessPartnerBulkImportRequestConverter,
    });
  };

  const processOneItem = async (
    requestId: string,
    item: BusinessPartnerBulkImportItem,
    row: BusinessPartnerBulkCsvRow,
    getExistingCodes: () => readonly string[]
  ): Promise<BusinessPartnerBulkImportItem> => {
    const processingItem: BusinessPartnerBulkImportItem = {
      ...item,
      status: "processing",
      errorMessage: undefined,
      partners: [],
    };

    try {
      const types = typesForRow(row);
      if (types.length === 0) {
        return {
          ...processingItem,
          status: "failed",
          errorMessage: "仕入先・顧客のいずれかを指定してください",
        };
      }

      const partners = [];
      for (const type of types) {
        let lookupResult = null;
        if (corporateLookup.isValidUrl(row.url)) {
          const outcome = await corporateLookup.lookup({
            kind: "url",
            value: row.url,
          });
          if (outcome.ok) {
            lookupResult = outcome.result;
          }
        }

        const snap = {
          code: "",
          name: row.companyName,
          corporateNumber: lookupResult?.corporateNumber ?? "",
          tradeName: lookupResult?.tradeName ?? row.companyName,
          tradeNameKana: lookupResult?.tradeNameKana ?? "",
          postalCode: lookupResult?.postalCode ?? "",
          prefecture: lookupResult?.prefecture ?? "",
          city: lookupResult?.city ?? "",
          streetAddress: lookupResult?.streetAddress ?? "",
          address: lookupResult?.address ?? "",
          capitalStock: lookupResult?.capitalStock ?? "",
          representativeName: lookupResult?.representativeName ?? "",
          representativeTitle: lookupResult?.representativeTitle ?? "",
          foundedDate: lookupResult?.foundedDate ?? "",
          industry: lookupResult?.industry ?? "",
          employeeCount: lookupResult?.employeeCount ?? "",
          businessSummary: lookupResult?.businessSummary ?? "",
          contactPerson: "",
          phoneNumber: lookupResult?.phoneNumber ?? "",
          email: lookupResult?.email ?? "",
          website: row.url,
          note: "",
        };

        let assistantPatch = null;
        try {
          assistantPatch = await formAssistant.enrichAllFieldsFromUrl({
            snapshot: snap,
            websiteUrl: row.url,
          });
        } catch (e) {
          log("WARN", "Bulk import AI enrich failed; continuing with lookup only", e);
        }

        const preview = buildBusinessPartnerBulkPreview({
          type,
          companyName: row.companyName,
          url: row.url,
          lookup: lookupResult,
          assistantPatch,
          existingCodes: [
            ...getExistingCodes(),
            ...partners.map((p) => p.code),
          ],
        });

        if (lookupResult?.logoUrl || lookupResult?.faviconUrl) {
          preview.logoUrl = lookupResult.logoUrl;
          preview.faviconUrl = lookupResult.faviconUrl;
          preview.imageUrl =
            lookupResult.imageUrl ??
            lookupResult.logoUrl ??
            lookupResult.faviconUrl;
        }

        partners.push(preview);
      }

      return {
        ...processingItem,
        status: "completed",
        partners,
      };
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "登録処理中にエラーが発生しました";
      return {
        ...processingItem,
        status: "failed",
        errorMessage: message,
      };
    }
  };

  const recomputeCounts = (items: BusinessPartnerBulkImportItem[]) => {
    const completedCount = items.filter((i) => i.status === "completed").length;
    const failedCount = items.filter((i) => i.status === "failed").length;
    const pending = items.some(
      (i) => i.status === "pending" || i.status === "processing"
    );
    const status = pending
      ? ("processing" as const)
      : failedCount > 0 && completedCount === 0
        ? ("error" as const)
        : ("completed" as const);
    return { completedCount, failedCount, status };
  };

  const runParallelImport = async (
    requestId: string,
    rows: BusinessPartnerBulkCsvRow[],
    initialItems: BusinessPartnerBulkImportItem[]
  ): Promise<void> => {
    const items = [...initialItems];
    const rowByIndex = new Map(rows.map((r) => [r.rowIndex, r]));
    const existingCodes = () =>
      businessPartnerStore.partnerList.map((p) => p.code);

    let cursor = 0;
    const worker = async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        const item = items[index];
        const row = rowByIndex.get(item.rowIndex);
        if (!row) continue;

        const updated = await processOneItem(
          requestId,
          item,
          row,
          existingCodes
        );
        items[index] = updated;

        const { completedCount, failedCount, status } = recomputeCounts(items);
        await updateRequest(requestId, {
          items: [...items],
          completedCount,
          failedCount,
          status,
        });
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(PARALLEL_CONCURRENCY, items.length) }, () =>
        worker()
      )
    );
  };

  const createImportRequest = async (
    rows: BusinessPartnerBulkCsvRow[]
  ): Promise<string> => {
    const requestId = createRandomDocId();
    const items: BusinessPartnerBulkImportItem[] = rows.map((row) => ({
      rowIndex: row.rowIndex,
      companyName: row.companyName,
      url: row.url,
      isSupplier: row.isSupplier,
      isCustomer: row.isCustomer,
      status: "pending",
      partners: [],
    }));

    await firestoreOps.createDocument({
      collectionName: collectionPath(),
      docId: requestId,
      docData: {
        status: "processing",
        totalCount: rows.length,
        completedCount: 0,
        failedCount: 0,
        items,
      },
      converter: businessPartnerBulkImportRequestConverter,
    });

    void runParallelImport(requestId, rows, items);
    return requestId;
  };

  const commitImportRequest = async (
    request: DecodedBusinessPartnerBulkImportRequest
  ): Promise<{ succeeded: number; failed: number }> => {
    let succeeded = 0;
    let failed = 0;

    for (const item of request.items) {
      if (item.status !== "completed") continue;
      for (const partner of item.partners) {
        if (partner.committed) {
          succeeded += 1;
          continue;
        }
        const {
          code,
          name,
          type,
          partnerId,
          committed: _committed,
          ...optional
        } = partner;
        const ok = await businessPartnerStore.createNewPartner({
          partnerId,
          settings: {
            code,
            name,
            type,
            ...optional,
          },
        });
        if (ok) {
          succeeded += 1;
          partner.committed = true;
        } else {
          failed += 1;
        }
      }
    }

    await updateRequest(request.id, {
      status: "completed",
      committedAt: new Date().toISOString(),
      items: request.items,
    });

    await businessPartnerStore.fetchPartners();
    return { succeeded, failed };
  };

  return {
    createImportRequest,
    commitImportRequest,
  };
};
