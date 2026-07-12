export type HelpArticleCategory = "manual" | "schema" | "reference";

export type HelpArticle = {
  id: string;
  path: string;
  slug: string;
  title: string;
  description: string;
  category: HelpArticleCategory;
  tags: string[];
  order: number;
  routes: string[];
  updatedAt: string;
  body: string;
  searchableText: string;
};

const rawHelpModules = import.meta.glob("../content/help/**/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

const CATEGORY_LABELS: Record<HelpArticleCategory, string> = {
  manual: "操作ガイド",
  schema: "データ項目",
  reference: "リファレンス",
};

export const helpArticleCategoryLabels = CATEGORY_LABELS;

const parseScalar = (raw: string | undefined): string =>
  (raw ?? "").trim().replace(/^["']|["']$/g, "");

const parseInlineArray = (raw: string | undefined): string[] => {
  const value = parseScalar(raw);
  if (!value.startsWith("[") || !value.endsWith("]")) return [];
  return value
    .slice(1, -1)
    .split(",")
    .map((item) => parseScalar(item))
    .filter(Boolean);
};

const parseFrontmatter = (
  raw: string
): { attrs: Record<string, string>; body: string } => {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { attrs: {}, body: raw };

  const attrs: Record<string, string> = {};
  for (const line of match[1]!.split("\n")) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    attrs[key] = value;
  }

  return { attrs, body: raw.slice(match[0].length).trimStart() };
};

const titleFromBody = (body: string): string => {
  const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return heading || "Untitled";
};

const slugFromPath = (path: string): string =>
  path
    .replace(/^\.\.\/content\/help\//, "")
    .replace(/\.md$/, "")
    .replace(/\//g, "-");

const normalizeCategory = (raw: string): HelpArticleCategory => {
  if (raw === "schema" || raw === "reference") return raw;
  return "manual";
};

export const helpArticles: HelpArticle[] = Object.entries(rawHelpModules)
  .map(([path, raw]) => {
    const { attrs, body } = parseFrontmatter(raw);
    const slug = slugFromPath(path);
    const title = parseScalar(attrs.title) || titleFromBody(body);
    const description = parseScalar(attrs.description);
    const category = normalizeCategory(parseScalar(attrs.category));
    const tags = parseInlineArray(attrs.tags);
    const routes = parseInlineArray(attrs.routes);
    const order = Number.parseInt(parseScalar(attrs.order), 10);
    const updatedAt = parseScalar(attrs.updatedAt);
    const searchableText = [
      title,
      description,
      category,
      ...tags,
      ...routes,
      body,
    ]
      .join("\n")
      .toLowerCase();

    return {
      id: slug,
      path,
      slug,
      title,
      description,
      category,
      tags,
      routes,
      order: Number.isFinite(order) ? order : 999,
      updatedAt,
      body,
      searchableText,
    };
  })
  .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

export const findHelpArticleBySlug = (slug: string): HelpArticle | null =>
  helpArticles.find((article) => article.slug === slug) ?? null;

export const searchHelpArticles = (params: {
  query: string;
  category?: HelpArticleCategory | "all";
  tag?: string | "all";
}): HelpArticle[] => {
  const query = params.query.trim().toLowerCase();
  const words = query.split(/\s+/).filter(Boolean);
  return helpArticles.filter((article) => {
    if (params.category && params.category !== "all") {
      if (article.category !== params.category) return false;
    }
    if (params.tag && params.tag !== "all") {
      if (!article.tags.includes(params.tag)) return false;
    }
    if (words.length === 0) return true;
    return words.every((word) => article.searchableText.includes(word));
  });
};

export const allHelpTags = Array.from(
  new Set(helpArticles.flatMap((article) => article.tags))
).sort((a, b) => a.localeCompare(b));
