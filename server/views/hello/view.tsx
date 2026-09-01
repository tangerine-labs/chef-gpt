import { ThemeProvider, useToolContext } from "mcp-use/react";

function Hello() {
  const ctx = useToolContext<"hello">();
  const greeting = (ctx.structuredContent as { greeting?: string } | undefined)?.greeting ?? "…";
  return (
    <main style={{ padding: 16, fontFamily: "var(--font-sans, system-ui)" }}>
      <h1>{greeting}</h1>
    </main>
  );
}

export default function HelloView() {
  return (
    <ThemeProvider>
      <Hello />
    </ThemeProvider>
  );
}
