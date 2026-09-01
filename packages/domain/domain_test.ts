import { assertEquals } from "@std/assert";
import { rankedList, weekDates, weekStart } from "./mod.ts";

Deno.test("rankedList sums points across members and orders best first", () => {
  const out = rankedList(
    ["a", "b", "c"],
    [
      { recipeId: "a", memberId: "m1", tier: "S" },
      { recipeId: "a", memberId: "m2", tier: "C" },
      { recipeId: "b", memberId: "m1", tier: "A" },
      { recipeId: "b", memberId: "m2", tier: "A" },
      { recipeId: "c", memberId: "m1", tier: "GARBAGE" },
    ],
  );
  assertEquals(
    out.map((c) => c.recipeId),
    ["b", "a", "c"],
  );
  assertEquals(
    out.map((c) => c.points),
    [12, 11, 0],
  );
  assertEquals(out[1].tiersByMember, { m1: "S", m2: "C" });
});

Deno.test("rankedList gives ties the same rank and no tie-break", () => {
  const out = rankedList(
    ["a", "b", "c"],
    [
      { recipeId: "a", memberId: "m1", tier: "S" },
      { recipeId: "b", memberId: "m1", tier: "S" },
      { recipeId: "c", memberId: "m1", tier: "B" },
    ],
  );
  assertEquals(
    out.map((c) => c.rank),
    [1, 1, 3],
  );
});

Deno.test("rankedList ignores entries for non-candidates and keeps unranked candidates", () => {
  const out = rankedList(["a"], [{ recipeId: "zzz", memberId: "m1", tier: "S" }]);
  assertEquals(out, [{ recipeId: "a", points: 0, rank: 1, tiersByMember: {} }]);
});

Deno.test("weekStart returns the Monday of the containing week", () => {
  assertEquals(weekStart("2026-09-01"), "2026-08-31"); // Tuesday → Monday
  assertEquals(weekStart("2026-08-31"), "2026-08-31"); // Monday
  assertEquals(weekStart("2026-09-06"), "2026-08-31"); // Sunday belongs to the week before
});

Deno.test("weekDates lists seven consecutive days", () => {
  assertEquals(weekDates("2026-08-31").at(-1), "2026-09-06");
  assertEquals(weekDates("2026-08-31").length, 7);
});
