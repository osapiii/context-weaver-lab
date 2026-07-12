/** クリップボード画像のファイル名用タイムスタンプ (YYYYMMDD-HHmmss-SSS) */
export const clipboardImageTimestamp = (): string => {
  const d = new Date();
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}` +
    `-${pad(d.getMilliseconds(), 3)}`
  );
};

/** ClipboardEvent から画像 File を抽出し、一意なファイル名を付与する */
export const extractClipboardImageFiles = (event: ClipboardEvent): File[] => {
  const data = event.clipboardData;
  if (!data) return [];

  const files: File[] = [];
  const seen = new Set<string>();

  const pushImage = (file: File, mimeType: string): void => {
    const ext = mimeType.split("/")[1] || "png";
    const renamed = new File(
      [file],
      `clipboard-${clipboardImageTimestamp()}.${ext}`,
      { type: mimeType }
    );
    const key = `${renamed.name}:${renamed.size}:${renamed.lastModified}`;
    if (seen.has(key)) return;
    seen.add(key);
    files.push(renamed);
  };

  for (const item of data.items) {
    if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
    const file = item.getAsFile();
    if (file) pushImage(file, item.type);
  }

  if (files.length === 0 && data.files?.length) {
    for (const file of data.files) {
      if (file.type.startsWith("image/")) pushImage(file, file.type);
    }
  }

  return files;
};

/** ClipboardEvent から添付用 File を抽出（画像は一意名、それ以外は元ファイル名を維持） */
export const extractClipboardAttachmentFiles = (
  event: ClipboardEvent
): File[] => {
  const data = event.clipboardData;
  if (!data) return [];

  const files: File[] = [];
  const seen = new Set<string>();

  const pushFile = (file: File): void => {
    let out = file;
    if (file.type.startsWith("image/")) {
      const ext = file.type.split("/")[1] || "png";
      out = new File(
        [file],
        `clipboard-${clipboardImageTimestamp()}.${ext}`,
        { type: file.type }
      );
    }
    const key = `${out.name}:${out.size}:${out.lastModified}:${out.type}`;
    if (seen.has(key)) return;
    seen.add(key);
    files.push(out);
  };

  for (const item of data.items) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (file) pushFile(file);
  }

  if (files.length === 0 && data.files?.length) {
    for (const file of data.files) {
      pushFile(file);
    }
  }

  return files;
};

/** Clipboard API から画像 File を取得 (ボタン「貼り付け」用) */
export const readClipboardImageFiles = async (): Promise<File[]> => {
  if (typeof navigator === "undefined" || !navigator.clipboard?.read) {
    return [];
  }
  const files: File[] = [];
  const seen = new Set<string>();
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      for (const type of item.types) {
        if (!type.startsWith("image/")) continue;
        const blob = await item.getType(type);
        const ext = type.split("/")[1] || "png";
        const file = new File(
          [blob],
          `clipboard-${clipboardImageTimestamp()}.${ext}`,
          { type }
        );
        const key = `${file.name}:${file.size}`;
        if (seen.has(key)) continue;
        seen.add(key);
        files.push(file);
      }
    }
  } catch {
    return [];
  }
  return files;
};

/** 画像のみのペースト時に textarea へ不要な内容が入らないよう preventDefault する */
export const shouldPreventDefaultOnImagePaste = (
  event: ClipboardEvent,
  imageAdded: boolean
): boolean => {
  if (!imageAdded) return false;
  const hasText = (event.clipboardData?.getData("text/plain") || "").length > 0;
  return !hasText;
};
