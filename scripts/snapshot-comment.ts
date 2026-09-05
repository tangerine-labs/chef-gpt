/**
 * Turn `preview:snap --all`'s manifest into the Markdown that .github/workflows/snapshots.yml
 * posts on a PR: one collapsible section per story, light and dark side by side.
 *
 *   deno run -A scripts/snapshot-comment.ts scratch/manifest.json https://raw.githubusercontent.com/<owner>/<repo>/<sha>/pr-12
 */
const [manifestPath, baseUrl] = Deno.args;
if (!manifestPath || !baseUrl) {
  console.error("usage: snapshot-comment.ts <manifest.json> <base url for the PNGs>");
  Deno.exit(1);
}
type Entry = { story: string; theme: "light" | "dark"; file: string };
const entries: Entry[] = JSON.parse(await Deno.readTextFile(manifestPath));
const byStory = new Map<string, Partial<Record<Entry["theme"], string>>>();
for (const e of entries) {
  byStory.set(e.story, { ...byStory.get(e.story), [e.theme]: `${baseUrl}/${e.file}` });
}
const img = (url: string | undefined, alt: string) =>
  url ? `<img src="${url}" alt="${alt}" width="360">` : "";
const sections = [...byStory].map(
  ([story, urls]) => `<details><summary>${story}</summary>

| light | dark |
| --- | --- |
| ${img(urls.light, `${story} (light)`)} | ${img(urls.dark, `${story} (dark)`)} |

</details>`,
);
console.log(`<!-- snapshots -->
### Fixture snapshots

Every story in \`site/src/preview.tsx\` rendered from this PR (\`deno task preview:snap --all\`).

${sections.join("\n")}`);
