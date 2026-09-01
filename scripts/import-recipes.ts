/**
 * One-off import of the markdown recipe corpus into the two system cookbooks.
 *
 *   deno run -A --env-file=.env scripts/import-recipes.ts [--dry-run] [--limit N]
 *
 * Reads ../chef-mcp/packages/recipe-finder/recipes/{aarstiderne,hellofresh}/*.md, uploads each
 * recipe's image from ../dinner-tier-list/apps/web/public/recipes/... to the public
 * `recipe-images` bucket, and upserts rows keyed on (cookbook, external_id). Idempotent.
 * Uses the service role: system cookbooks are read-only for everyone else.
 */
import { createClient } from "@supabase/supabase-js";
import { parseRecipeMarkdown } from "./recipe-markdown.ts";

const RECIPES_DIR = new URL("../../chef-mcp/packages/recipe-finder/recipes/", import.meta.url);
const IMAGES_ROOT = new URL("../../dinner-tier-list/apps/web/public/", import.meta.url);
const BUCKET = "recipe-images";

const args = Deno.args;
const dryRun = args.includes("--dry-run");
const limitIdx = args.indexOf("--limit");
const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Number.POSITIVE_INFINITY;

const url = Deno.env.get("SUPABASE_URL");
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
const db = createClient(url, key, { auth: { persistSession: false } });

const { data: cookbooks, error: cbErr } = await db
  .from("cookbooks")
  .select("id, slug")
  .is("household_id", null);
if (cbErr) throw cbErr;
const cookbookBySlug = new Map(cookbooks.map((c) => [c.slug, c.id]));

const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

async function uploadImage(localPath: string): Promise<string | null> {
  // "/recipes/aarstiderne/images/x.webp" → bucket object "aarstiderne/x.webp"
  const objectPath = localPath.replace(/^\/recipes\//, "").replace("/images/", "/");
  const ext = objectPath.slice(objectPath.lastIndexOf("."));
  const publicUrl = db.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;
  if (dryRun) return publicUrl;
  let bytes: Uint8Array;
  try {
    bytes = await Deno.readFile(new URL(localPath.replace(/^\//, ""), IMAGES_ROOT));
  } catch {
    return null; // image missing locally; leave image_url empty
  }
  const { error } = await db.storage.from(BUCKET).upload(objectPath, bytes, {
    contentType: CONTENT_TYPES[ext] ?? "application/octet-stream",
    upsert: true,
    cacheControl: "31536000",
  });
  if (error) throw new Error(`upload ${objectPath}: ${error.message}`);
  return publicUrl;
}

let count = 0;
let skipped = 0;
for (const slug of ["aarstiderne", "hellofresh"]) {
  const cookbookId = cookbookBySlug.get(slug);
  if (!cookbookId) throw new Error(`system cookbook ${slug} missing; run migrations first`);
  const dir = new URL(`${slug}/`, RECIPES_DIR);
  const batch: Record<string, unknown>[] = [];
  for await (const entry of Deno.readDir(dir)) {
    if (!entry.isFile || !entry.name.endsWith(".md")) continue;
    if (count >= limit) break;
    const md = await Deno.readTextFile(new URL(entry.name, dir));
    const r = parseRecipeMarkdown(md);
    if (!r.externalId || !r.title) {
      skipped++;
      continue;
    }
    const imageUrl = r.imageUrl?.startsWith("/") ? await uploadImage(r.imageUrl) : (r.imageUrl ?? null);
    batch.push({
      cookbook_id: cookbookId,
      source: slug,
      external_id: r.externalId,
      title: r.title,
      description: r.description,
      image_url: imageUrl,
      url: r.url,
      cook_time_minutes: r.cookTimeMinutes,
      difficulty: r.difficulty,
      cuisine: r.cuisine,
      tags: r.tags,
      servings: r.servings,
      ingredients: r.ingredients,
      instructions: r.instructions,
      allergens: r.allergens,
    });
    count++;
    if (batch.length === 100) await flush(batch.splice(0));
  }
  await flush(batch);
}

async function flush(rows: Record<string, unknown>[]) {
  if (rows.length === 0 || dryRun) return;
  const { error } = await db.from("recipes").upsert(rows, { onConflict: "cookbook_id,external_id" });
  if (error) throw new Error(`upsert: ${error.message}`);
  console.log(`  upserted ${rows.length}`);
}

console.log(`${dryRun ? "[dry run] " : ""}imported ${count} recipes, skipped ${skipped}`);
