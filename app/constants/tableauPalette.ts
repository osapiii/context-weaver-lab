export const TABLEAU_10_PALETTE = [
  "#4e79a7",
  "#f28e2b",
  "#e15759",
  "#76b7b2",
  "#59a14f",
  "#edc948",
  "#b07aa1",
  "#ff9da7",
  "#9c755f",
  "#bab0ac",
] as const;

export const TABLEAU_SEMANTIC_COLORS = {
  sales: TABLEAU_10_PALETTE[0],
  materialCost: TABLEAU_10_PALETTE[1],
  expense: TABLEAU_10_PALETTE[2],
  grossProfit: TABLEAU_10_PALETTE[3],
  operatingProfit: TABLEAU_10_PALETTE[4],
  target: TABLEAU_10_PALETTE[6],
  warning: TABLEAU_10_PALETTE[5],
  shortage: TABLEAU_10_PALETTE[2],
  production: TABLEAU_10_PALETTE[0],
  material: TABLEAU_10_PALETTE[1],
  score: TABLEAU_10_PALETTE[4],
  weight: TABLEAU_10_PALETTE[3],
} as const;

export const TABLEAU_CHART_NEUTRALS = {
  text: "#1f2937",
  mutedText: "#667085",
  axis: "#c9d2dc",
  grid: "#e8edf2",
  tooltipBorder: "#d7dee7",
  background: "#ffffff",
} as const;

export const tableauColorAt = (index: number): string =>
  TABLEAU_10_PALETTE[index % TABLEAU_10_PALETTE.length] ??
  TABLEAU_10_PALETTE[0];

export const withAlpha = (hex: string, alpha: number): string => {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return hex;
  const value = Number.parseInt(normalized, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};
