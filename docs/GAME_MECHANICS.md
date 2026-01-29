# Game Mechanics

This document outlines the core rules for combat, movement, economics, and victory conditions within the game.

---

## ⚔️ Combat System

The combat system is based on comparing the Hit Points (HP) of units, modified by luck, defensive bonuses, and environmental factors.

### Attack Power Calculation
`Final Attack Power = Current Unit HP ± Luck Modifier`

**Luck Mechanics:**
Every attack has a chance to trigger a Critical Hit or a Glancing Blow:
* **20% Chance: Critical Hit.** Adds **+Δ** to the attack power.
* **20% Chance: Glancing Blow (Miss).** Subtracts **-Δ** from the attack power.
* **60% Chance: Standard Hit.** No modifier (0).

**Δ (Delta) Values by Tier:**
| Unit Tier | Δ Value |
|:---------:|:-------:|
| **T1** | 1       |
| **T2** | 2       |
| **T3** | 4       |
| **T4** | 8       |

### Defense Bonuses
Defenders can receive bonuses that are added to their strength during combat calculation:
1.  **Shield (+1):** Granted if a unit has remained on the same tile for **3 or more consecutive turns** (Fortified).
2.  **Support (+1):** Granted if an **adjacent ally of the same tier** exists (cardinal directions).

### Combat Outcomes
After applying all modifiers, the Attacker’s strength (A) is compared to the Defender’s strength (D):

1.  **Attacker Victory (A > D):**
    * The Defender is removed from the board.
    * The Attacker occupies the Defender's tile.
    * The Attacker’s HP is reduced by the Defender's HP value.
    * *Unit tier and level are recalculated based on new HP thresholds.*

2.  **Defender Victory (A < D):**
    * The Attacker is removed from the board.
    * The Defender remains on its tile.
    * The Defender’s HP is reduced by the Attacker's HP value.
    * *Unit tier and level are recalculated based on new HP thresholds.*

3.  **Tie (A == D):**
    * **50% Probability:** Both units are destroyed (**DRAW**).
    * **50% Probability:** One unit survives with the base minimum HP for its current tier (**LUCKY** survival).

### Wall Interactions
* **Neutral Walls:** Always take 100% damage and are destroyed if hit.
* **Player/AI Walls:** Take fixed percentage damage based on the Attacker's tier:
    * **T1:** 34% damage per hit.
    * **T2:** 51% damage per hit.
    * **T3+:** 100% damage (Instant destruction).
* **Line of Sight:** Diagonal attacks are blocked if any wall on the corner-adjacent edges obstructs the move-to-attack vector.

---

## 🏃 Movement & Positioning

Movement range and direction capability are determined by the unit's Tier.

| Tier | Range | Directions |
|:---:|:---:|:---:|
| **T1** | 1 Tile | Cardinal Only (N, S, E, W) |
| **T2** | 1 Tile | 8-Directional (includes Diagonals) |
| **T3** | 2 Tiles | 8-Directional |
| **T4** | 3 Tiles | 8-Directional |

### Obstacles (Walls)
* **Cardinal Move:** Blocked if a wall exists on the edge between the current and target tile.
* **Diagonal Move:** Blocked if **any** of the two edges forming the corner has a wall (prevents "slipping through" wall joints).

### Merging Units
* Only units of the **same tier** can merge.
* HP values are summed.
* If the sum exceeds the maximum threshold for the current tier:
    1.  The unit evolves to a higher tier.
    2.  Any surplus HP creates a "remainder" unit with recalculated stats.

---

## 🏆 Victory Conditions

### Economic Domination (Monopoly)
This is the primary victory condition focused on map control.
* The game tracks how many consecutive turns an owner controls all forests.
* **Trigger:** When a player (or AI) holds **all forests** on the map simultaneously, a **10-turn countdown** begins.
* If the owner loses control of even one forest, the countdown resets immediately.
* Victory is declared when the countdown reaches 0.

### Annihilation
* Achieved by destroying the enemy Base.

---

## 📊 Leaderboard Logic

The ranking system evaluates player performance based on the efficiency and type of victory.

### Data Structure (ScoreEntry)
* `difficulty`: baby | normal | hard | nightmare.
* `forestsCaptured`: Number of unique forest captures.
* `forestsCaptured`: Map Size Number 10 | 20 | 30.
* `playerName`: Name of the player.
* `timestamp`: Date and time of the achievement.
* `turnsPlayed`: Total turns taken to win.
* `victory`: Win or Loss. true | false.
* `victoryType`: Monopoly or Annihilation.

### Ranking Criteria
Results are sorted using the following priority:
1.  **Victory Type:** `Monopoly` outranks `Annihilation`.
2.  **Efficiency:** Lower `turnsPlayed` results in a higher rank.
3.  **Recency:** Ties are broken by the earlier `timestamp`.
