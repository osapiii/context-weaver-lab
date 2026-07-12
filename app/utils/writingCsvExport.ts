import type { WritingFormField } from "@models/writingForm";

const escapeCsvCell = (value: string): string => {
  const normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
};

/** 書類記入結果を CSV 文字列に変換（UTF-8 BOM 付きで Excel 互換） */
export const buildWritingFieldsCsv = (params: {
  fields: ReadonlyArray<WritingFormField>;
}): string => {
  const lines = [
    ["項目名", "キー", "値"]
      .map((cell) => escapeCsvCell(cell))
      .join(","),
  ];
  for (const field of params.fields) {
    const value = (field.value ?? "").trim();
    lines.push(
      [field.label, field.key, value]
        .map((cell) => escapeCsvCell(cell))
        .join(",")
    );
  }
  return `\uFEFF${lines.join("\n")}\n`;
};

export const downloadWritingFieldsCsv = (params: {
  fields: ReadonlyArray<WritingFormField>;
  filename?: string;
}): void => {
  const csv = buildWritingFieldsCsv({ fields: params.fields });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = params.filename?.trim() || "writing_filled.csv";
  anchor.click();
  URL.revokeObjectURL(url);
};
