# AI Behavior Profile

The AI's personality has undergone a significant refactor, moving from a simple, greedy algorithm to a more nuanced and efficient tactical engine. This document outlines the key behavioral shifts.

## Core Personality: Efficient & Opportunistic

The AI's primary directive is to maximize efficiency and capitalize on opportunities. It is no longer purely driven by hoarding resources but by making the most effective use of them.

### Economic Behavior: From Greedy to Efficient

The AI's economic decision-making is now governed by a "Wealth Override" and a focus on return on investment.

-   **Wealth Override (`seekUpgrades`)**: The old AI was a "miser," often hoarding resources even when it had a significant advantage. The new logic includes a critical check: if the AI's iron reserves are **100 or greater**, it aggressively seeks to spend it. Units will prioritize moving to the nearest forge to acquire weapon and armor upgrades, ignoring previous "scarcity" and "partner" checks that made them hesitant.
-   **Forced Conversion (`botEconomyPhase`)**: The AI will automatically convert wood to reserve points if its wood stockpile exceeds a certain threshold (typically 100 wood) and it has not already done so this turn. This prevents resource hoarding and ensures a steady stream of reinforcements.

### Combat Behavior: From Passive to Wall Breacher

The AI is now far more aggressive and intelligent when it comes to engaging fortifications.

-   **"Obstacle Smash" Logic (`findCombatTarget`)**: This is a major behavioral change. The AI now actively looks for high-value targets (like high-tier enemy units or the player's base) within a 5-tile radius.
    1.  It first attempts to find a clear path to the target.
    2.  If no path exists (`bfsPath` returns null), it assumes a wall is blocking the way.
    3.  It then calls `findBlockingWall` to identify the specific wall segment obstructing its path.
    4.  That wall segment becomes its **highest priority target**.
    
    This logic transforms the AI from a passive attacker that gives up when faced with a wall to a determined breacher that will smash through obstacles to reach its goal.

-   **Anti-Clumping (`getNextStepTowards`)**: To prevent units from forming a single, vulnerable conga line, the pathfinding algorithm now includes a "congestion penalty." When evaluating potential moves, a unit will slightly prefer moves that lead to less-crowded areas, encouraging a natural spreading of forces.

-   **Target Prioritization**:
    -   **Lethal First**: The AI prioritizes targets it can destroy in a single hit.
    -   **Lowest HP Second**: If no lethal targets are available, it focuses fire on the weakest enemy to remove threats from the board as quickly as possible.

This new behavioral profile makes the AI a much more formidable and human-like opponent, capable of both long-term economic planning and decisive, aggressive assaults.
