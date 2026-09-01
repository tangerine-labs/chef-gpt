import { assertEquals } from "@std/assert";
import { decodeEntities, parseIngredient, parseRecipeMarkdown } from "./recipe-markdown.ts";

Deno.test("decodeEntities handles the scraper's named and numeric entities", () => {
  assertEquals(decodeEntities("K&oslash;kkennote:&nbsp;Du kan&#x27;t &#248;l"), "Køkkennote: Du kan't øl");
});

Deno.test("parseIngredient splits quantity, unit and name; keeps unparsable text", () => {
  assertEquals(parseIngredient("1 dl creme fraiche 38 %"), {
    text: "1 dl creme fraiche 38 %",
    quantity: "1",
    unit: "dl",
    name: "creme fraiche 38 %",
  });
  assertEquals(parseIngredient("180 g Tofu").unit, "g");
  assertEquals(parseIngredient("peber"), { text: "peber", quantity: null, unit: null, name: "peber" });
  assertEquals(parseIngredient("1 citron"), { text: "1 citron", quantity: "1", unit: null, name: "citron" });
});

Deno.test("parseRecipeMarkdown reads frontmatter and sections", () => {
  const md = `---
id: "aarstiderne/x"
source: "aarstiderne"
externalId: "x"
title: "1000 &oslash;er-dressing"
imageUrl: "/recipes/aarstiderne/images/x.webp"
cookTimeMinutes: 30
tags: "aarstiderne, quick"
cuisine: "Nordic"
---

## Ingredients

- 1 spsk. l&oslash;g
- peber

## Instructions

1. K&oslash;kkennote:&nbsp;Brug ymer.
2. Vend det hele sammen.

## Allergens

Check the original recipe for allergen information.
`;
  const r = parseRecipeMarkdown(md);
  assertEquals(r.title, "1000 øer-dressing");
  assertEquals(r.tags, ["aarstiderne", "quick"]);
  assertEquals(r.cookTimeMinutes, 30);
  assertEquals(
    r.ingredients.map((i) => i.name),
    ["løg", "peber"],
  );
  assertEquals(r.ingredients[0].unit, "spsk.");
  assertEquals(r.instructions, ["Køkkennote: Brug ymer.", "Vend det hele sammen."]);
  assertEquals(r.allergens, []);
});
