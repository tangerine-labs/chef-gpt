/**
 * Screenshot the fixture preview (site/preview.html) without any backend.
 *
 *   deno task preview:snap                              full gallery → scratch/preview.png
 *   deno task preview:snap --story "Vote" --dark        one story, dark → scratch/preview-Vote-dark.png
 *   deno task preview:snap --all                        every story × light/dark → scratch/preview-*.png
 *                                                       + scratch/manifest.json (what CI posts on PRs)
 *
 * Flags: --story <name> (exact heading from site/src/preview.tsx; quote it, several contain "—")
 *        --all · --dark · --width <px> (default 700; --all uses each story's own width)
 *        --out <png> (default $SNAP_DIR/…, SNAP_DIR=scratch)
 *
 * Builds the site, serves site/dist on a free port, renders with the system Chrome via
 * playwright-core, then exits. Run it as `deno task preview:snap` — a bare `deno preview:snap`
 * is parsed as a URL and fails with "Unsupported scheme".
 */
const USAGE = `usage: deno task preview:snap [--story "<name>" | --all] [--dark] [--width <px>] [--out <png>]

  --story <name>   only that story (exact heading from site/src/preview.tsx; quote it)
  --all            every story, light and dark, at each story's own width; writes manifest.json
  --dark           render in the dark theme
  --width <px>     viewport width (default 700)
  --out <png>      output file (default $SNAP_DIR/preview[-<story>][-dark].png, SNAP_DIR=scratch)

Prints each PNG path on success.`;
if (Deno.args.includes("--help") || Deno.args.includes("-h")) {
  console.log(USAGE);
  Deno.exit(0);
}
const args = [...Deno.args];
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const has = (name: string): boolean => {
  const i = args.indexOf(name);
  if (i < 0) return false;
  args.splice(i, 1);
  return true;
};
const all = has("--all");
const story = flag("--story");
const dark = has("--dark");
const width = flag("--width") ?? "700";
const outFlag = flag("--out");
const dir = Deno.env.get("SNAP_DIR") ?? "scratch";
const slug = (name: string) => name.replace(/\W+/g, "_");
const fileFor = (s: string | undefined, d: boolean) =>
  `${dir}/preview${s ? `-${slug(s)}` : ""}${d ? "-dark" : ""}.png`;

const root = new URL("../", import.meta.url);

/** Story headings + widths, read from the gallery source (biome keeps the two lines adjacent). */
const stories = (): { name: string; width: number }[] => {
  const src = Deno.readTextFileSync(new URL("site/src/preview.tsx", root));
  const found = [...src.matchAll(/name: "([^"]+)",\s*width: (\d+),/g)].map((m) => ({
    name: m[1],
    width: Number(m[2]),
  }));
  if (found.length === 0) throw new Error("no stories found in site/src/preview.tsx");
  return found;
};

const build = await new Deno.Command("deno", {
  args: ["task", "build:site"],
  cwd: root.pathname,
  stdout: "null",
  stderr: "piped",
}).output();
if (!build.success) {
  console.error(new TextDecoder().decode(build.stderr));
  Deno.exit(1);
}

const dist = new URL("site/dist/", root);
const server = Deno.serve({ port: 0, onListen: () => {} }, async (req) => {
  const path = new URL(req.url).pathname.replace(/^\/chef-gpt\/?/, "") || "index.html";
  try {
    const file = await Deno.readFile(new URL(path, dist));
    const type = path.endsWith(".js") ? "text/javascript" : path.endsWith(".css") ? "text/css" : "text/html";
    return new Response(file, { headers: { "content-type": type } });
  } catch {
    return new Response("not found", { status: 404 });
  }
});
const port = (server.addr as Deno.NetAddr).port;

const shoot = async (s: string | undefined, d: boolean, w: string | number, out: string) => {
  const q = new URLSearchParams();
  if (s) q.set("story", s);
  if (d) q.set("theme", "dark");
  const url = `http://127.0.0.1:${port}/chef-gpt/preview.html${q.size ? `?${q}` : ""}`;
  Deno.mkdirSync(out.replace(/[^/]*$/, "") || ".", { recursive: true });
  const shot = await new Deno.Command("deno", {
    args: [
      "run",
      "-A",
      "npm:playwright-core@1",
      "screenshot",
      "--channel",
      "chrome",
      "--viewport-size",
      `${w},300`, // full-page grows to fit; the gallery is min-height 100vh, so keep this small
      "--full-page",
      "--wait-for-timeout",
      "1500",
      url,
      out,
    ],
    stdout: "null",
    stderr: "piped",
  }).output();
  if (!shot.success) {
    await server.shutdown();
    console.error(new TextDecoder().decode(shot.stderr).slice(-800));
    Deno.exit(1);
  }
  console.log(out);
};

if (all) {
  const manifest: { story: string; theme: "light" | "dark"; file: string }[] = [];
  for (const s of stories()) {
    for (const d of [false, true]) {
      const out = fileFor(s.name, d);
      await shoot(s.name, d, s.width + 48, out); // 24px gallery padding each side
      manifest.push({ story: s.name, theme: d ? "dark" : "light", file: out.slice(dir.length + 1) });
    }
  }
  Deno.writeTextFileSync(`${dir}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`${dir}/manifest.json`);
} else {
  await shoot(story, dark, width, outFlag ?? fileFor(story, dark));
}
await server.shutdown();
