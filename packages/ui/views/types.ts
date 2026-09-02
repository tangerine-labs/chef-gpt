/** Data shapes the views render — mirrors the tools' structuredContent. */
export type RecipeSummary = {
  id: string;
  title: string;
  cuisine: string | null;
  cookTimeMinutes: number | null;
  cookbook: string;
};
export type Member = { memberId: string; name: string };
export type Participant = Member & { hasVoted: boolean };
export type Candidate = {
  recipeId: string;
  title: string;
  cuisine: string | null;
  cookTimeMinutes: number | null;
  imageUrl: string | null;
};
export type Slot = {
  date: string;
  mealType: string;
  recipe: { id: string; title: string; imageUrl: string | null } | null;
  title: string | null;
};
export type Week = { weekStart: string; days: { date: string; slots: Slot[] }[] };
export type Ranked = {
  recipeId: string;
  title: string;
  points: number;
  rank: number;
  imageUrl: string | null;
};
export type ShoppingItem = {
  id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  checked: boolean;
  recipeTitle: string | null;
};
export type ShoppingList = { items: ShoppingItem[]; uncheckedCount: number };

const DAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const dayName = (date: string) => DAY[(new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7];
export const errorText = (e: unknown) => String((e as Error)?.message ?? e);
