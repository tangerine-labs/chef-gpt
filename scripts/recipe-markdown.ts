/** Parser for the scraped recipe markdown (frontmatter + ## Ingredients / ## Instructions / ## Allergens). */

export interface ParsedIngredient {
  text: string;
  name: string;
  quantity: string | null;
  unit: string | null;
}

export interface ParsedRecipe {
  source: string | null;
  externalId: string | null;
  title: string;
  description: string;
  imageUrl: string | null;
  url: string | null;
  cookTimeMinutes: number | null;
  difficulty: string | null;
  cuisine: string | null;
  tags: string[];
  servings: string | null;
  ingredients: ParsedIngredient[];
  instructions: string[];
  allergens: string[];
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  oslash: "ø",
  Oslash: "Ø",
  aelig: "æ",
  AElig: "Æ",
  aring: "å",
  Aring: "Å",
  eacute: "é",
  egrave: "è",
  uuml: "ü",
  ouml: "ö",
  auml: "ä",
  ccedil: "ç",
  ntilde: "ñ",
  deg: "°",
  frac12: "½",
  frac14: "¼",
  frac34: "¾",
};

/** Decode the HTML entities the scraper left behind (named + numeric). */
export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-zA-Z]+);/g, (m, n) => ENTITIES[n] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

function frontmatter(md: string): { data: Record<string, string>; body: string } {
  const m = md.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: md };
  const data: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    data[kv[1]] = v;
  }
  return { data, body: m[2] };
}

function section(body: string, name: string): string {
  const m = body.match(new RegExp(`##\\s+${name}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`));
  return m ? m[1] : "";
}

/** "1 dl creme fraiche" → { quantity: "1", unit: "dl", name: "creme fraiche" }; unparsable lines keep the text as name. */
export function parseIngredient(text: string): ParsedIngredient {
  const t = decodeEntities(text);
  const m = t.match(/^([\d.,½¼¾/-]+)\s*([a-zA-ZæøåÆØÅ.]+)?\s+(.+)$/);
  if (m?.[3]) {
    const unit = m[2] ?? null;
    // "1 stk Avocado" and "2 fed hvidløg" both fit; a capitalised second token in the middle of a sentence is not a unit.
    return { text: t, quantity: m[1], unit, name: m[3].trim() };
  }
  return { text: t, quantity: null, unit: null, name: t };
}

export function parseRecipeMarkdown(md: string): ParsedRecipe {
  const { data, body } = frontmatter(md);
  const ingredients = section(body, "Ingredients")
    .split("\n")
    .filter((l) => l.trim().startsWith("-"))
    .map((l) => parseIngredient(l.replace(/^\s*-\s*/, "")));
  const instructions = section(body, "Instructions")
    .split("\n")
    .filter((l) => /^\s*\d+\./.test(l))
    .map((l) => decodeEntities(l.replace(/^\s*\d+\.\s*/, "")))
    .filter(Boolean);
  const allergenText = decodeEntities(section(body, "Allergens"));
  const allergens = /check the original/i.test(allergenText)
    ? []
    : allergenText
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);
  const cook = Number.parseInt(data.cookTimeMinutes ?? "", 10);
  return {
    source: data.source || null,
    externalId: data.externalId || null,
    title: decodeEntities(data.title ?? ""),
    description: decodeEntities(data.description ?? ""),
    imageUrl: data.imageUrl || null,
    url: data.url || null,
    cookTimeMinutes: Number.isFinite(cook) && cook > 0 ? cook : null,
    difficulty: data.difficulty || null,
    cuisine: data.cuisine || null,
    tags: (data.tags ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    servings: data.servings || null,
    ingredients,
    instructions,
    allergens,
  };
}
