# AI Strategy

This document describes the current AI behavior and decision-making in Shape Tactics. It is written for game designers and engineers to understand the strategy and tune parameters confidently.

## 1) AI Turn Loop (Order of Operations)

The AI acts in a strict sequence each turn:

1. Global Assessment
   - Check player resource control (forests + mines)
   - Determine mood and modes (Reclamation, Fortress, Total War)
2. Economy Conversion
   - Convert surplus AI wood to reserves while respecting safety thresholds
3. Infrastructure
   - Build Forges near base when resource thresholds are met
   - Consider defensive wall building for forest holders
4. Early Spawn Phase
   - Turns ≤10: prefer T1 spawns to increase presence
   - Mandatory hunter checks to create T3 when conditions permit
5. Queue Management (Turns ≤15)
   - Queue a mover toward nearest visible free forest with low-tier bias
6. Defense & Siege
   - If threats near AI base: spawn blockers and intercept
   - If wood > 100: 50% of mobile units enter Siege Mode
7. Unit Action Loop (heavy → light)
   - Base defense overrides
   - Hold on resource tiles; defend if threatened
   - Reclamation goals override typical behavior
   - Siege: breaching and advancing toward player base
   - Upgrades: move to Forge for armor/weapon when eligible
   - Survival: retreat only under lethal threat
   - Target selection and movement to resources or enemies
8. End Turn
   - Update occupation counters, income, and cooldown flags

```mermaid
flowchart TD
    Start --> Assess[Global Assessment: resource control, modes]
    Assess --> Econ[Economy: convert wood to reserves]
    Econ --> Infra[Infrastructure: Forge build checks]
    Infra --> Early[Early Spawns: T1 (<=10), T3 hunter checks]
    Early --> Queue[Queue mover toward forests (<=15)]
    Queue --> UnitLoop
    UnitLoop[Unit Action Loop (Tier-sorted)] --> BD[Base Defense override]
    BD --> Hold[Hold on Resource: defend]
    Hold --> Reclaim[Reclamation Goal? Tunnel-vision]
    Reclaim --> Siege[Siege near player base]
    Siege --> Upgrade[Seek Forge for upgrades]
    Upgrade --> Survival[Survival: retreat only if lethal]
    Survival --> Target[Resource/Enemy targeting & movement]
    Target --> End[End Turn updates]
```

## 2) Decision Logic & Priorities

Targeting to capture resources:
- Early game (≤20): prioritize nearest empty forests; if none, nearest empty mines.
- Mid game (>20): treat forests and mines equally; choose nearest empty resource.
- Occupied resources: choose ones where the AI unit’s tier ≥ occupier’s tier (safe reclaim).
- If no safe targets: target the player’s weakest-held forest (lowest occupier tier), then nearest.

Priority weights:
- Enemies on resource tiles are favored targets when reachable.
- Walls: prefer small clusters and penalize highly reinforced clusters; weapon-equipped units reduce the penalty.
- Movement toward base or goal uses shortest-step heuristics, with BFS used for tunnel-vision paths.

Phase shifts:
- Turns ≤10: increased T1 spawning to raise presence.
- Turns ≤15: queued movers toward visible forests for expansion.
- Turn ≤20: empty forests have higher priority than mines; after 20 treat both equally.

Reclamation Mode (Player >50% resources):
- Detects global player control >50% across forests + mines.
- For each player occupier on a resource:
  - Required counter tier = min(4, targetTier + 1)
  - Prefer an existing nearest counter-unit; otherwise assign a merge to reach the tier; otherwise spawn the tier near base.
- Assigns RECLAIM_RESOURCE goals and enforces tunnel-vision movement toward the target tile.

## 3) Combat & Threat Assessment

Effective Power:
- Effective Attack = points + 20 when unit has Weapon.
- Effective Defense = points + armorHp (shield).
- Danger checks use Effective Attack vs Effective Defense (with small margin reductions for weapon-equipped defenders).

Aggression vs. Retreat:
- Hold resource tiles when not in danger; defend if reachable enemies are present.
- Standard retreat triggers on danger; with Reclamation goals, retreat only if lethal (enemy EA > defender ED + margin).
- Siege: within 3–4 tiles of player base, prioritize base hits and wall breaches that reduce distance to base.

Wall Logic (Reinforcement-aware):
- Wall cluster detection via graph BFS over shared endpoints per owner.
- MaxHP per wall = 100 + (ClusterSize × 20); bonusHp is shown in UI.
- Targeting penalizes attacking walls with MaxHP > 200 if unit lacks Weapon; prefers isolated edges or smaller clusters.

## 4) Economy & Construction

Forge Building thresholds:
- First Forge: aiForges == 0 AND aiWood ≥ 40 AND aiIron ≥ 20; place within range 2 of AI base (not on base tile).
- Second Forge: aiForges < 2 AND aiIron > 50 AND aiWood ≥ 40 AND aiIron ≥ 20; same placement rules.

Upgrades (armor/weapon):
- Units Tier ≥2 move to nearest Forge when AI Iron ≥ 20.
- Purchase order: Armor first (survivability), then Weapon if iron remains (or if iron > 40).
- Armor grants armorHp (shield) and does not change tier; Weapon adds +20 Effective Attack and improves higher-tier hit odds.

## 5) Unit Merging & Spawning

Merging:
- Only same-tier units may merge.
- HP (points) combine; thresholds apply for tier/level recalculation.
- Equipment preservation: resulting unit has hasWeapon/hasArmor if either parent had it; shieldHp becomes the higher parent value.
- Overflow remainder (from tier escalation) spawns without equipment and armorHp = 0.

Spawning:
- aiSpawnTier places units within radius 2 of AI base on empty tiles.
- Type cap of 5 per tier excluding units currently holding forests (override for T3 hunter when flagged).
- Early expansion:
  - Turns ≤10: prefer T1 to expand presence quickly.
  - If reserves are high: spawn T2 hunters to contest.
  - Mandatory T3 hunter checks when reserves ≥ T3 cost and AI forest control ≤ ~60%.
- Defense spawning:
  - When threats near AI base, spawn a single strongest blocker along the approach path.

## Notes for Tuning

- Reinforcement penalties for wall attacks can be adjusted to change AI breaching behavior.
- Reclamation Mode threshold and tier mapping can be tuned (e.g., demand T4 vs. T3 for T3 targets).
- Early-game thresholds (≤10/≤15/≤20) govern expansion tempo and can be adjusted for difficulty.

