import type {
  Candidate,
  Participant,
  Ranked,
  RecipeSummary,
  ShoppingList,
  Week,
} from "../../packages/ui/mod.ts";

const img = (seed: string) => `https://picsum.photos/seed/${seed}/88/88`;

export const members: Participant[] = [
  { memberId: "m1", name: "Björn", hasVoted: true },
  { memberId: "m2", name: "Emma", hasVoted: false },
  { memberId: "m3", name: "Noah", hasVoted: false },
];

export const recipes: RecipeSummary[] = [
  {
    id: "r1",
    title: "Kalkun med spaghetti, grønne asparges og agurk og gulerødder med karsecreme",
    cuisine: "Nordic",
    cookTimeMinutes: 30,
    cookbook: "Aarstiderne",
  },
  {
    id: "r2",
    title: "Hurtig chorizo- og harissaspaghetti",
    cuisine: "Italian",
    cookTimeMinutes: 20,
    cookbook: "HelloFresh",
  },
  {
    id: "r3",
    title: "Asiatisk avocado- og tofubowl",
    cuisine: "Asian",
    cookTimeMinutes: 25,
    cookbook: "HelloFresh",
  },
  { id: "r4", title: "Pandekager", cuisine: null, cookTimeMinutes: null, cookbook: "Our recipes" },
];

export const candidates: Candidate[] = recipes.slice(0, 3).map((r) => ({
  recipeId: r.id,
  title: r.title,
  cuisine: r.cuisine,
  cookTimeMinutes: r.cookTimeMinutes,
  imageUrl: img(r.id),
}));

export const ranked: Ranked[] = [
  { recipeId: "r2", title: "Hurtig chorizo- og harissaspaghetti", points: 13, rank: 1, imageUrl: img("r2") },
  { recipeId: "r3", title: "Asiatisk avocado- og tofubowl", points: 11, rank: 2, imageUrl: img("r3") },
  { recipeId: "r1", title: "Kalkun med spaghetti…", points: 6, rank: 3, imageUrl: img("r1") },
];

export const week: Week = {
  weekStart: "2026-08-31",
  days: [
    "2026-08-31",
    "2026-09-01",
    "2026-09-02",
    "2026-09-03",
    "2026-09-04",
    "2026-09-05",
    "2026-09-06",
  ].map((date, i) => ({
    date,
    slots:
      i === 1
        ? [
            {
              date,
              mealType: "dinner",
              recipe: { id: "r2", title: "Hurtig chorizo- og harissaspaghetti", imageUrl: img("r2") },
              title: null,
            },
          ]
        : i === 2
          ? [{ date, mealType: "dinner", recipe: null, title: "eating out" }]
          : [],
  })),
};

export const shopping: ShoppingList = {
  items: [
    { id: "s1", name: "Milk", quantity: "1", unit: "l", checked: false, recipeTitle: null },
    { id: "s2", name: "Eggs", quantity: "12", unit: null, checked: true, recipeTitle: null },
    {
      id: "s3",
      name: "creme fraiche",
      quantity: "1",
      unit: "bæger",
      checked: false,
      recipeTitle: "Kalkun med spaghetti, grønne asparges og agurk og gulerødder med karsecreme",
    },
    {
      id: "s4",
      name: "Chorizo, ternet",
      quantity: "120",
      unit: "g",
      checked: false,
      recipeTitle: "Hurtig chorizo- og harissaspaghetti",
    },
    {
      id: "s5",
      name: "Harissa-krydderi",
      quantity: "4",
      unit: "g",
      checked: true,
      recipeTitle: "Hurtig chorizo- og harissaspaghetti",
    },
  ],
  uncheckedCount: 3,
};

export const emptyShopping: ShoppingList = { items: [], uncheckedCount: 0 };

/** Simulates a slow host: resolves after `ms`, or rejects when `fail` is set. */
export const later = <T>(value: T, ms = 600, fail?: string): Promise<T> =>
  new Promise((resolve, reject) => setTimeout(() => (fail ? reject(new Error(fail)) : resolve(value)), ms));
