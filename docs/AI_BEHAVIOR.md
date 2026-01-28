# AI Behavior

## Wall Breaker
- Goal pursuit prioritizes forests, enemy units, and base.
- If the path toward the goal is obstructed by any wall (Neutral, Player, or AI):
  - Cardinal step blocked: move adjacent and queue a wall attack on that edge.
  - Diagonal step blocked: check the two adjacent cardinal edges; attack the blocking edge to clear the diagonal.
- Forest access:
  - If a forest neighbor is free but blocked by a wall, attack that wall to open access.
  - Player walls near forests are preferred breach targets when detours are significantly longer.
- Base siege:
  - T3+ units attack base-adjacent walls to enable direct strikes on the base.
- Anti-clustering:
  - When allies block the intended direction and an adjacent wall obstructs alternatives, attack that wall to disperse.
- Anti-stagnation:
  - With no clear forest path and local neutral walls, attack a neutral wall to break out.

## Desperation Spawning (Economy Override)
- Condition: AI units on board < 3 AND reserves >= T2 cost AND reserves < T3 cost.
- Action: Immediately spawn a T2 unit near the AI base.
- Intent: Restore map presence and enable forest capture; subsequent goals prioritize nearest forests visible to AI.

