import type {
  GoogleDriveSyncFileItem,
  GoogleDriveSyncFileItemsById,
} from "@models/googleDriveSyncRequest";
import type { DriveImportFileItemSource } from "@utils/driveImportFileRows";

export function buildInitialFileItemsMap(params: {
  importIds?: string[];
  removeIds?: string[];
  sources?: DriveImportFileItemSource[];
}): GoogleDriveSyncFileItemsById {
  const out: NonNullable<GoogleDriveSyncFileItemsById> = {};

  const seedOne = (
    driveFileId: string,
    kind: "import" | "remove",
    displayName?: string | null
  ) => {
    if (!driveFileId || out[driveFileId]) return;
    out[driveFileId] = {
      driveFileId,
      kind,
      displayName: displayName ?? null,
      prepare: "pending",
      mirror: "pending",
      register: "pending",
      complete: "pending",
      errorMessage: null,
    } satisfies GoogleDriveSyncFileItem;
  };

  if (params.sources?.length) {
    for (const src of params.sources) {
      seedOne(src.driveFileId, src.kind, src.displayName);
    }
    return out;
  }

  for (const id of params.importIds ?? []) {
    seedOne(id, "import");
  }
  for (const id of params.removeIds ?? []) {
    seedOne(id, "remove");
  }

  return out;
}

export function fileItemsMapToSources(
  map: GoogleDriveSyncFileItemsById | null | undefined
): DriveImportFileItemSource[] {
  if (!map) return [];
  return Object.values(map).map((item) => ({
    driveFileId: item.driveFileId,
    kind: item.kind,
    displayName: item.displayName ?? null,
  }));
}
