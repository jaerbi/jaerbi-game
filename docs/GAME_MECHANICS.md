# Game Mechanics

This document details specific game rules and calculations that have been recently updated.

## Infrastructure

### Forge Ownership & Security

Forges are critical for upgrading units, and their ownership is strictly enforced.

-   **Ownership**: Forges are owned by the player who builds them. This is tracked in the `forgeSitesSignal`.
-   **Strict Security (`buyWeapon`, `buyArmor`)**: A unit **cannot** use a forge that does not belong to its owner. Before any resources are spent, the `buyWeapon` and `buyArmor` functions perform a critical security check:
    
    ```typescript
    // Inside the buy function, before deducting resources:
    const forgeTile = this.getForges(owner).find(p => this.isUnitAtForge(u, p));
    if (forgeTile && this.getForgeOwner(forgeTile) !== u.owner) {
        console.warn(`[Cheat Attempt] Unit ${u.id} tried to use enemy forge...`);
        return; // The action is aborted.
    }
    ```
    
    This prevents a player from luring an enemy unit onto their forge to steal an upgrade. The action is validated at the moment of execution, ensuring no exploits are possible.

### Wall Mechanics & Math

Walls provide defensive bonuses and can be reinforced. Their health and behavior are governed by the following rules.

-   **Base Health**: A standard wall segment has **100 HP**.
-   **Formation Bonus**: Walls built adjacent to each other form a "formation." The strength of the formation provides a health bonus to all connected wall segments.
    -   The `updateWallFormations` function calculates the size of each connected wall group.
    -   **Formula**: `bonusHp = formationSize * 20`.
    -   **Max Health**: `maxHealth = 100 + bonusHp`.
    
    *Example: A single wall segment in a "formation" of 1 has 120 HP. A formation of 5 walls gives each segment 5 * 20 = 100 bonus HP, for a total of 200 HP each.*

-   **Siege Threshold & Damage**:
    -   Attacking a wall is a valid move for any unit adjacent to it.
    -   **Damage Calculation (`getWallHitAmount`)**: The damage dealt to a wall is fixed based on the attacking unit's tier:
        - **Tier 1**: 34 damage.
        - **Tier 2**: 51 damage.
        - **Tier 3+**: 101 damage.
    -   **Breaching**: When a wall's health is reduced to 0, it is destroyed and removed from the board. The `findBlockingWall` logic used by the AI makes targeting and breaching walls a core part of offensive strategy.

### Routing & State Management

The game's lifecycle is tied to the Angular Router:
- **Navigation In**: Entering `/shape-tactics` triggers `ngOnInit` in [app-game.ts](file:///d%3A/jaerbi-game/src/app/app-game.ts), which calls `resetGame()` to ensure a clean board.
- **Navigation Out**: Leaving the game route triggers `ngOnDestroy`, which calls `pauseGame()` to stop all AI background timers and clear any pending `isAiThinking` flags. This prevents memory leaks and ensures background loops don't persist in the Gaming Hub.
