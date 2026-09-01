# chef-gpt

A household meal-planning suite whose primary UI is MCP Apps rendered inside a chat host (Claude Desktop first). Members of a household vote on candidate dinners, plan a week, and keep a shopping list — by clicking in the apps or by asking the agent.

## Language

### People

**User**:
Someone who can sign in.
_Avoid_: account, login

**Household**:
The unit of ownership. Cookbooks, rounds, meal plans and the shopping list belong to a household. A user may belong to several households.
_Avoid_: family, team, tenant

**Member**:
A person in a household who can vote. A member may be linked to a user; kids are members without users. All signed-in members are equal.
_Avoid_: child, kid, voter, participant (see Round)

**Invite**:
A single-use, expiring code that lets a user join a household, optionally linking them to an existing member.
_Avoid_: invitation link, share code

### Recipes

**Cookbook**:
A named collection of recipes. A **system cookbook** is read-only and visible to every household; a **household cookbook** is owned by one household. A household starts with one default cookbook.
_Avoid_: catalog, library, collection, source

**Recipe**:
A dish with ingredients and instructions, belonging to exactly one cookbook. Copying a system recipe into a household cookbook creates a new recipe that records what it was based on.
_Avoid_: meal, dish, dinner

**Retired**:
A per-household mark that hides a recipe from search and candidates. Always an explicit action.
_Avoid_: deleted, hidden, banned

### Voting

**Round**:
A set of candidate recipes put to a vote by a set of participants. Open until every participant has ranked, or until closed by hand. Results are visible only after close.
_Avoid_: session, tier list session, vote, poll

**Candidate**:
A recipe included in a round.
_Avoid_: option, meal, entry

**Participant**:
A member expected to rank in a given round. Defaults to all members of the household.
_Avoid_: voter, child

**Ranking**:
One participant's placement of every candidate into a tier. Re-submitting while the round is open replaces the earlier ranking.
_Avoid_: vote, ranking set, submission

**Tier**:
One of S, A, B, C, D, F, GARBAGE, worth 7, 6, 5, 4, 3, 2, 0 points.
_Avoid_: grade, rating, score (score is the sum)

**Ranked list**:
A closed round's result: candidates ordered by the sum of their tier points across participants. There is no "winner"; people choose from the list by hand.
_Avoid_: winners, results, leaderboard

### Planning

**Meal plan**:
A household's week, Monday-start, made of slots.
_Avoid_: week plan, plan, schedule

**Slot**:
One date and meal type (breakfast, lunch, dinner, snack) in a meal plan, holding either a recipe or free text such as "eating out".
_Avoid_: day, entry, meal

### Shopping

**Shopping list**:
A household's single running list of items. Ingredients from a slot's recipe can be added on request.
_Avoid_: grocery list, basket

**Item**:
A line on the shopping list: free text with optional quantity and unit, and optionally the recipe it came from. Checked items stay until cleared.
_Avoid_: ingredient (that's on the recipe), product
