# AI Strategy: The Mirror Brain

The game no longer uses separate logic for the AI and the player's "Auto-Battle" feature. Both are now powered by a single, unified strategic engine referred to as the "Mirror Brain." This ensures that the player's automated forces behave with the same level of sophistication and cunning as the computer opponent.

## Core Philosophy: Unified Strategic Engine

The central principle is that any strategic function or tactical behavior available to the AI is also available to the player's Auto-Battle, and vice-versa. This is achieved through a shared set of services and decision-making functions within [game-engine.service.ts](file:///d%3A/jaerbi-game/src/app/services/game-engine.service.ts).

- **`botEconomyPhase(owner)`**: Manages resource conversion, infrastructure construction (Forges, Walls), and unit spawning for the specified owner ('player' or 'ai').
- **`playerAutoStep()` / `aiTurn()`**: These functions execute the action phase for their respective owners, but they draw from the same pool of tactical sub-routines (`findCombatTarget`, `findResourceTarget`, `seekUpgrades`, etc.).

## Key Strategic Pillars

### 1. Mirror AI & Auto-Battle

The `playerAutoStep()` function in [game-engine.service.ts](file:///d%3A/jaerbi-game/src/app/services/game-engine.service.ts) is the player's entry point into the Mirror Brain. It iterates through the player's units and assigns them tasks using the same logic that `aiTurn()` uses for the AI opponent.

The [app-game.ts](file:///d%3A/jaerbi-game/src/app/app-game.ts) component manages the Auto-Battle loop, ensuring the strict sequence of operations is followed:
1.  **Economy & Spawn**: `gameEngine.botEconomyPhase('player')` is called once per turn.
2.  **Action Phase**: `gameEngine.playerAutoStep()` is called repeatedly until all units have acted.
3.  **End Turn**: The turn is automatically ended once no actions remain.

### 2. Smart Merging & Tier Advancement

The engine uses a "Smart Merging" system to efficiently upgrade units.

- **`getMergePartnerForUnit(unit)`**: This function identifies the best-possible merge partner for a given unit based on proximity, tier, and board state. It avoids inefficient merges (e.g., a Tier 3 unit walking across the map to merge with a Tier 1).
- **Reclamation Protocol**: If a low-tier unit is isolated and has no immediate merge partners, it may be assigned a `reclamationGoal` to "hunt" a higher-tier unit, effectively seeking out its own upgrade.

### 3. Crisis Management & Strategic Scrapping

The AI is no longer a passive defender. It actively manages its territory and will take destructive action if it provides a strategic advantage.

- **`findBlockingWall(start, target)`**: A critical component of the "Obstacle Smash" logic. When a high-value target is identified, the AI performs a pathfinding check. If the path is blocked by a wall, this function identifies the specific wall segment to attack.
- **`destroyOwnWallBetween(...)`**: The AI (and player) can now destroy their own walls to reclaim resources if wood is critically low or to open paths for strategic advances.

## Gaming Hub Architecture

The application has been refactored into a **Gaming Hub** to support future expansion:
- **Root (/)**: A futuristic Landing Page where users select which game to play.
- **Shape Tactics (/shape-tactics)**: The core strategic game.
- **New Game Placeholder (/new-game)**: A landing area for upcoming projects.

This architecture ensures that game-specific logic (like the Mirror Brain loops) is properly initialized on entry and paused on exit to maintain performance.
