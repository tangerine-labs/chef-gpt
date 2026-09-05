/**
 * Screenshot the fixture preview (site/preview.html) without any backend.
 *
 *   deno task preview:snap                              full gallery → scratch/preview.png
 *   deno task preview:snap --story "Vote" --dark        one story, dark → scratch/preview-Vote-dark.png
 *   deno task preview:snap --story "Vote" --out /tmp/vote.png --width 600
 *
 * Flags: --story <name> (exact heading from site/src/preview.tsx; quote it, several contain "—")
 *        --dark · --width <px> (default 700) · --out <png> (default $SNAP_DIR/…, SNAP_DIR=scratch)
 *
 * Builds the site, serves site/dist on a free port, renders with the system Chrome via
 * playwright-core, then exits. Run it as `deno task preview:snap` — a bare `deno preview:snap`
 * is parsed as a URL and fails with "Unsupported scheme".
 */
const USAGE = `usage: deno task preview:snap [--story "<name>"] [--dark] [--width <px>] [--out <png>]

  --story <name>   only that story (exact heading from site/src/preview.tsx; quote it)
  --dark           render in the dark theme
  --width <px>     viewport width (default 700)
  --out <png>      output file (default $SNAP_DIR/preview[-<story>][-dark].png, SNAP_DIR=scratch)

Prints the PNG path on success.`;
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
const story = flag("--story");
const dark = has("--dark");
const width = flag("--width") ?? "700";
const out =
  flag("--out") ??
  `${Deno.env.get("SNAP_DIR") ?? "scratch"}/preview${story ? `-${story.replace(/\W+/g, "_")}` : ""}${dark ? "-dark" : ""}.png`;

const root = new URL("../", import.meta.url);
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
const q = new URLSearchParams();
if (story) q.set("story", story);
if (dark) q.set("theme", "dark");
const url = `http://127.0.0.1:${port}/chef-gpt/preview.html${q.size ? `?${q}` : ""}`;

const outDir = out.replace(/[^/]*$/, "");
if (outDir) Deno.mkdirSync(outDir, { recursive: true });
const shot = await new Deno.Command("deno", {
  args: [
    "run",
    "-A",
    "npm:playwright-core@1",
    "screenshot",
    "--channel",
    "chrome",
    "--viewport-size",
    `${width},900`,
    "--full-page",
    "--wait-for-timeout",
    "1500",
    url,
    out,
  ],
  stdout: "null",
  stderr: "piped",
}).output();
await server.shutdown();
if (!shot.success) {
  console.error(new TextDecoder().decode(shot.stderr).slice(-800));
  Deno.exit(1);
}
console.log(out);
