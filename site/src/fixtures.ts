import type {
  Candidate,
  Participant,
  Ranked,
  RecipeSummary,
  ShoppingList,
  SlotChange,
  Week,
} from "../../packages/ui/mod.ts";

/** Real dinners for the fixture recipes (Unsplash, free to use), cropped to the 44 px note photo at 2x. */
const photos: Record<string, string> = {
  r1: "1473093295043-cdd812d0e601", // pasta with greens and tomatoes
  r2: "1563379926898-05f4575a45d8", // spaghetti in a red, spicy sauce
  r3: "1512621776951-a57141f2eefd", // avocado bowl
  r4: "1567620905732-2d1ec7ab7445", // a stack of pancakes
};
const img = (id: string) => `https://images.unsplash.com/photo-${photos[id]}?w=176&h=176&fit=crop&q=80`;

export const members: Participant[] = [
  { memberId: "m1", name: "Dennis", hasVoted: true },
  { memberId: "m2", name: "Emma", hasVoted: false },
  { memberId: "m3", name: "Charlie", hasVoted: true },
];

export const recipes: RecipeSummary[] = [
  {
    id: "r1",
    title: "Turkey spaghetti with green asparagus, cucumber and carrots in cress cream",
    cuisine: "Nordic",
    cookTimeMinutes: 30,
    cookbook: "Aarstiderne",
  },
  {
    id: "r2",
    title: "Quick chorizo and harissa spaghetti",
    cuisine: "Italian",
    cookTimeMinutes: 20,
    cookbook: "HelloFresh",
  },
  {
    id: "r3",
    title: "Asian avocado and tofu bowl",
    cuisine: "Asian",
    cookTimeMinutes: 25,
    cookbook: "HelloFresh",
  },
  { id: "r4", title: "Pancakes", cuisine: null, cookTimeMinutes: null, cookbook: "Our recipes" },
];

export const candidates: Candidate[] = recipes.map((r) => ({
  recipeId: r.id,
  title: r.title,
  cuisine: r.cuisine,
  cookTimeMinutes: r.cookTimeMinutes,
  imageUrl: img(r.id),
}));

export const ranked: Ranked[] = [
  { recipeId: "r2", title: "Quick chorizo and harissa spaghetti", points: 13, rank: 1, imageUrl: img("r2") },
  { recipeId: "r3", title: "Asian avocado and tofu bowl", points: 11, rank: 2, imageUrl: img("r3") },
  {
    recipeId: "r1",
    title: "Turkey spaghetti with green asparagus…",
    points: 6,
    rank: 3,
    imageUrl: img("r1"),
  },
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
              recipe: { id: "r2", title: "Quick chorizo and harissa spaghetti", imageUrl: img("r2") },
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
      unit: "tub",
      checked: false,
      recipeTitle: "Turkey spaghetti with green asparagus, cucumber and carrots in cress cream",
    },
    {
      id: "s4",
      name: "Chorizo, diced",
      quantity: "120",
      unit: "g",
      checked: false,
      recipeTitle: "Quick chorizo and harissa spaghetti",
    },
    {
      id: "s5",
      name: "Harissa spice",
      quantity: "4",
      unit: "g",
      checked: true,
      recipeTitle: "Quick chorizo and harissa spaghetti",
    },
  ],
  uncheckedCount: 3,
};

export const emptyShopping: ShoppingList = { items: [], uncheckedCount: 0 };

/** Simulates a slow host: resolves after `ms`, or rejects when `fail` is set. */
export const later = <T>(value: T, ms = 600, fail?: string): Promise<T> =>
  new Promise((resolve, reject) => setTimeout(() => (fail ? reject(new Error(fail)) : resolve(value)), ms));

/** What set_slot would do, for the gallery: the week with one day's dinner changed. */
export const applySlot = (w: Week, date: string, change: SlotChange): Week => ({
  ...w,
  days: w.days.map((d) => {
    if (d.date !== date) return d;
    const rest = d.slots.filter((s) => s.mealType !== "dinner");
    if ("clear" in change) return { ...d, slots: rest };
    if ("title" in change)
      return { ...d, slots: [...rest, { date, mealType: "dinner", recipe: null, title: change.title }] };
    const r = ranked.find((x) => x.recipeId === change.recipeId);
    return {
      ...d,
      slots: [
        ...rest,
        {
          date,
          mealType: "dinner",
          recipe: { id: change.recipeId, title: r?.title ?? change.recipeId, imageUrl: r?.imageUrl ?? null },
          title: null,
        },
      ],
    };
  }),
});

/** A stateful onSet for the gallery, so placed notes stay placed. */
export const weekSetter = (start: Week) => {
  let w = start;
  return (date: string, change: SlotChange) => {
    w = applySlot(w, date, change);
    return later(w);
  };
};
