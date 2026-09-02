// Presentational view components: no MCP hooks, props in, callbacks out.
// server/views/*/view.tsx wires them to the host; site/preview renders them from fixtures.
export { RoundBuilderView } from "./views/RoundBuilder.tsx";
export { ShoppingListView } from "./views/ShoppingList.tsx";
export * from "./views/tiers.ts";
export * from "./views/types.ts";
export { VoteView } from "./views/Vote.tsx";
export { WeekPlanView } from "./views/WeekPlan.tsx";
