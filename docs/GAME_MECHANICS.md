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
    -   **Formula**: `bonusHp = (formationSize - 1) * 20`.
    -   **Max Health**: `maxHealth = 100 + bonusHp`.
    
    *Example: A single wall has 100 HP. Two connected walls each have 120 HP. A formation of 5 walls gives each segment (5-1)*20 = 80 bonus HP, for a total of 180 HP each.*

-   **Siege Threshold & Damage**:
    -   Attacking a wall is a valid move for any unit adjacent to it.
    -   **Damage Calculation (`getWallHitAmount`)**: The damage dealt to a wall is based on the attacking unit's tier. A higher tier unit deals more damage.
    -   **Breaching**: When a wall's health is reduced to 0, it is destroyed and removed from the board. The `findBlockingWall` logic used by the AI makes targeting and breaching walls a core part of offensive strategy.
-   **Destruction & Reclamation**: Players and the AI can destroy their own walls using the `destroyOwnWallBetween` function. This action refunds a portion of the initial wood cost, providing a strategic option for resource reclamation or repositioning.
