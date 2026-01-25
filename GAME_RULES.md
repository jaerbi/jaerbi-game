# Game Rules & Architecture Reference

> **Status**: Living Document
> **Last Updated**: 2026-01-25

This document serves as the primary reference for game mechanics, AI priorities, and project architecture. All code changes must verify against these rules to ensure consistency.

## 1. Core Mechanics

*(Verbatim from Project Rulebook)*

*   **Movement**: Units move 1 tile per action. Diagonals are blocked if adjacent tiles are occupied by walls/units.
*   **Merging**: Two units of the same Tier combine into one unit of Tier+1. Max Tier: 4.
*   **Resources**: 1 Forest = 2 Wood/turn (production begins on the 3rd consecutive turn of occupation; any movement resets occupation). 20 Wood = 1 Reserve.
*   **Military**: Destroy enemy base (100 HP).
*   **Economic**: Hold 100% of forests for 10 consecutive turns.

*(Turn Execution Rules)*

*   **Non-Ending Actions (These do NOT end the current turn)**:
    *   **Deployment**: Spawning units from Reserves to the base.
    *   **Resource Conversion**: Converting 20 Wood to +1 Reserve (including 'Max Convert').
    *   **Wall Building**: Constructing a wall (Limit: Only one wall can be built per turn).

*   **Ending Actions (These immediately trigger endTurn())**:
    *   **Movement**: Moving a unit to a new tile.
    *   **Attack**: A unit attacking an enemy unit or a wall.
    *   **Merging**: Combining two units into a higher Tier.

### Expanded Mechanics

*   **Fog of War**:
    *   Base Sight Radius: 3 tiles.
    *   Unit Sight Radius: 2 tiles.
    *   Debug Mode: Can be toggled to disable Fog.
*   **Walls**:
    *   **Cost**: 10 Wood per wall segment.
    *   **Placement**: Between two adjacent tiles.
        *   At game start, Neutral Silver/Gray walls are auto-placed:
            *   Around both bases (all four adjacent edges).
            *   On all four edges of every forest tile (full enclosure).
    *   **Destruction**:
        *   Tier 1 Unit: Deals ~34% damage per hit (3 hits to destroy).
        *   Tier 2 Unit: Deals ~51% damage per hit (2 hits to destroy).
        *   Tier 3+ Unit: Instantly destroys walls (100% damage).
        *   Neutral Strategic Walls: Take 100% damage per hit from any unit; non-buildable by Player/AI.
        *   Rebuild Cooldown: When any wall segment is destroyed or removed, that specific tile edge enters a 5-turn cooldown; no new wall can be built on that edge during cooldown.
    *   **AI Interaction**:
        *   The AI treats Neutral Walls as destructible obstacles.
        *   When an unoccupied forest is enclosed, AI prioritizes attacking the adjacent neutral wall to open a path.
        *   The AI respects the wall cooldown and never attempts to build on cooling edges.
*   **Reserve System**:
    *   Reserves are global currency stored per player.
    *   Can be used to spawn units directly at the base or designated spawn zones.
    *   Conversion: 20 Wood -> +1 Reserve (Manual/AI Action).

## 2. Unit System

Units are defined by **Points**, which determine their **Tier** and **Level**.

### Tier Thresholds
| Tier | Point Range | Level Steps |
|------|-------------|-------------|
| **1**| 1 - 4       | 1, 2, 3, 4  |
| **2**| 5 - 20      | 5, 10, 15, 20|
| **3**| 25 - 100    | 25, 50, 75, 100|
| **4**| 125 - 500   | 125, 250, 375, 500|

*   **Merging Logic**: Merging adds the points of two units together. The new total points determine the new Tier/Level based on the table above.

### Combat Bonuses
*   **Stationary Bonus**: If a unit stays still for ≥3 turns, it gains **Shield +1**.
*   **Support Bonus**: If an adjacent friendly unit is of the same Tier, it gains **Support +1**.

### Luck Mechanics
Combat has a 20% chance for critical success or failure.
*   **CRIT** (Roll < 0.2): Damage + Tier Value (T1=1, T2=2, T3=4, T4=8).
*   **MISS** (Roll > 0.8): Damage - Tier Value.

## Visual Guide Overview

This project includes a visual, interactive rules guide accessible in the app (Rules panel). It presents:
- Unit Encyclopedia for Tiers 1–4 with point ranges and roles.
- How To Play cards:
  - Forest Activation (3-turn sequence with seedling → tree icons).
  - Wall Building (wall segment placed between unit and adjacent enemy).
  - Merging (example: T1(4) + T1(1) = T2(5)).
- Victory Conditions:
  - Domination (base health overlay).
  - Monopoly (forest capture progress for Player vs AI).
- Combat & Luck:
  - Shield bonus for staying still 3+ turns.
  - Crit/Miss samples to illustrate 20% luck mechanics.

### Wall Color Legend
- Green: Player-built walls (cost 10 Wood).
- Red: AI-built walls.
- Silver/Gray: Neutral strategic walls (non-buildable; take full damage per hit).

### AI Defense & Hunter Roles
- AI Defense: Якщо база під загрозою на відстані ≤3 клітин, ШІ агресивно спавнить сильні блокери біля бази (ефект “Wall of Flesh”) та пріоритизує оборону.
- T3+ Hunter: Юніти Tier 3 і вище пріоритизують полювання та тиск на базу/ворога над заготівлею дерева; захоплення лісів дозволено лише за сприятливих умов (відсутність близьких ворогів і брак низьких тиранів поруч).

## 3. AI Strategic Cycle

A. **Forest Anchor Rule**
- Units standing on a forest must hold position.
- Movement off a forest is forbidden unless attacking an adjacent enemy/wall.
- If an adjacent enemy has a higher Tier, retreat is allowed toward safety.

B. **Spawn Logic (Quality over Quantity)**
- Opening: At game start, spawn max 2 units to grab nearest forests.
- Reactive Defense: If an enemy is within 3 tiles of any forest or the AI base, spawn Tier = enemyTier + 1. If reserves are insufficient, convert wood to reserves first.
- T4 Rush: If no nearby enemies, hoard reserves until Tier 3 or Tier 4 is affordable; do not spam Tier 1.

C. **Combat Loop (Engage/Retreat)**
- Target enemy on forest first, then enemy base.
- If MyTier >= EnemyTier: attack.
- If MyTier < EnemyTier: retreat to nearest friendly unit or base.
- Destroy walls only if Tier >= 2 (Tier 1 may attack walls only in emergencies).

## 4. Mid/Late-Game Rules

1. **Wood War Check**
- Compare Player vs AI total wood income each turn (2 per forest held).
- If PlayerIncome >= AIIncome, enable Aggression Mode.
- Attack condition relaxes to “trade acceptable”: attack when MyTier >= EnemyTier.
- Goal scoring prioritizes enemy-occupied forests over empty ones.
  - Income counts only forests with active production (occupied for 3+ consecutive turns).

2. **No-Trash Spawn Rule**
- If Turn > 8 and no enemy is adjacent to AI base, hard ban Tier 1 spawns.
- Convert wood to reserves until Tier 3 is affordable (Tier 2 if desperate).
- Prefer one Tier 4 over many Tier 1 units.

3. **Fortress Walls**
- If a unit is on a forest and an enemy is exactly 1 tile away with EnemyTier >= MyTier, build a wall on the edge between the unit and the enemy.
- Do not place walls toward the AI base.

5. **Forest Blocking**
- If a unit has started occupation (forestOccupationTurns > 0), movement to any other tile is heavily penalized and generally forbidden until production starts.
- Exception: If the AI base is threatened (enemy within 5 tiles), blocking is disabled; units may move to intercept. Tier 3+ units are exempt from blocking and act as hunters.

## 5. Unit Roles
- **Tier 1–2: Gatherers & Defenders**
  - Prioritize forests and local defense. Hold forests to start production on turn 3.
- **Tier 3–4: Interceptors & Siege**
  - Prioritize intercepting enemies near AI base, press enemy base, then attack enemies on forests. Capture empty forests only when no enemies are visible.
  - Early-Game Handover: On spawn in the opening, a Tier 3 must immediately move to occupy the nearest forest and remain to activate; once a Tier 1 or Tier 2 is adjacent to that forest, the Tier 3 hands over and switches to the Hunter role (leave the forest and pressure enemies/base).

### Absolute Victory Priority
- If any AI unit can attack the Player Base, it must do so immediately, overriding all other priorities (including forest blocking and near-activation states).

4. **Aggressive Combat**
- If MyPower >= EnemyPower: ATTACK.
- If MyPower < EnemyPower but at least two allies are adjacent: ATTACK (swarm).
 
## 4. Architecture Guidelines

### State Management
*   **Angular Signals**: The `GameEngineService` uses Signals for all reactive state (units, turn, resources).
*   **Readonly Exports**: Services should expose state via `asReadonly()` signals to prevent external mutation (e.g., `movedThisTurn`, `wallBuiltThisTurn`).

### Service Responsibilities
*   **GameEngineService**: Holds the "Truth". Manages state, turn execution, and rule enforcement.
*   **AiStrategyService**: Pure logic. Analyzes the `GameEngine` state to decide the *best move*. Does not mutate state directly; returns decisions.
*   **EconomyService**: Helper for cost calculations and resource logic.
*   **CombatService**: Helper for damage formulas and outcome prediction.

### Code Constraints
*   **No Circular Dependencies**: `GameEngine` depends on helpers (`Combat`, `Economy`), but helpers should not depend on `GameEngine`.
*   **Performance**: AI calculations run in the main thread; ensure `pickBestMove` remains efficient (avoid O(N^3) on grid scans).
*   **Build Verification**: After any logic change, the developer must run `npm run build` to verify TypeScript integrity and project stability.
*   **AI Thinking Delay**: When the turn switches to AI, a visual delay (≥10ms) must precede AI computation to prevent UI thrashing and allow state to settle.
*   **AI Ending Action Constraint**: The AI is allowed exactly one Ending Action per turn (Move/Attack/Merge). After this action, the active side must change to player, and the AI logic must terminate for that turn.
*   **Manual Trigger Rule**: The AI has no permission to act if `activeSideSignal` is not `ai`. Any attempt to start `aiTurn()` while it is the player's turn must be blocked by a guard and return immediately.
