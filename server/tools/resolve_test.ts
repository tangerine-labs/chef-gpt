import { assertEquals, assertThrows } from "@std/assert";
import { ToolError } from "../db.ts";
import { pickByName } from "./resolve.ts";

const rows = [
  { id: "1", name: "Milk" },
  { id: "2", name: "Oat milk" },
  { id: "3", name: "Chorizo pasta" },
  { id: "4", name: "Hurtig chorizo- og harissaspaghetti" },
];

Deno.test("pickByName: an exact match wins even when it is also a substring of another", () => {
  assertEquals(pickByName(rows, "milk", "item").id, "1");
  assertEquals(pickByName(rows, "  MILK ", "item").id, "1");
});

Deno.test("pickByName: a unique substring match is enough", () => {
  assertEquals(pickByName(rows, "oat", "item").id, "2");
  assertEquals(pickByName(rows, "harissa", "recipe").id, "4");
});

Deno.test("pickByName: ambiguity lists the matches so the agent can ask", () => {
  const e = assertThrows(() => pickByName(rows, "chorizo", "recipe"), ToolError);
  assertEquals(
    e.message,
    'Several recipes match "chorizo": Chorizo pasta, Hurtig chorizo- og harissaspaghetti — which one?',
  );
});

Deno.test("pickByName: a long ambiguity list is capped and asks for a narrower name", () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ id: `${i}`, name: `Pasta ${i}` }));
  const e = assertThrows(() => pickByName(many, "pasta", "recipe"), ToolError);
  assertEquals(
    e.message,
    'Several recipes match "pasta": Pasta 0, Pasta 1, Pasta 2, Pasta 3, Pasta 4, Pasta 5, Pasta 6, Pasta 7 and 4 more — which one? A more specific name helps.',
  );
});

Deno.test("pickByName: identical labels collapse in the listing", () => {
  const dup = [
    { id: "1", name: "Lasagne", label: "Lasagne (Aarstiderne)" },
    { id: "2", name: "Lasagne", label: "Lasagne (Aarstiderne)" },
    { id: "3", name: "Lasagne", label: "Lasagne (Our recipes)" },
  ];
  const e = assertThrows(() => pickByName(dup, "lasagne", "recipe"), ToolError);
  assertEquals(
    e.message,
    'Several recipes match "lasagne": Lasagne (Aarstiderne), Lasagne (Our recipes) — which one?',
  );
});

Deno.test("pickByName: no match and empty query are readable errors", () => {
  assertEquals(
    assertThrows(() => pickByName(rows, "tofu", "recipe"), ToolError).message,
    'No recipe named "tofu".',
  );
  assertEquals(
    assertThrows(() => pickByName(rows, "  ", "item"), ToolError).message,
    "Which item? The name is empty.",
  );
});
