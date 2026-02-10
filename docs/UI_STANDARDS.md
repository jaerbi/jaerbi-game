# UI Standards

This document outlines the standards for UI components, icons, and player feedback.

## Color Palette

-   **Player**: `#3498db` (Blue)
-   **AI/Enemy**: `#e74c3c` (Red)
-   **Neutral**: `#95a5a6` (Grey)
-   **Valid Move**: `rgba(52, 152, 219, 0.3)` (Translucent Blue)
-   **Selected Unit**: Outline of `#f1c40f` (Yellow)

## Iconography

Standard icons should be used to represent game elements and actions consistently.

-   **Wood Resource**: `🌲` (Tree emoji)
-   **Iron Resource**: `⛏️` (Pickaxe emoji)
-   **Build Wall**: `🧱` (Brick emoji)
-   **Destroy Wall**: `💥` (Explosion emoji)

### New Icons

The following icons have been added to support new mechanics:

-   **Auto-Battle Toggle**:
    -   **Active**: `🤖` (Robot emoji with a green check or border)
    -   **Inactive**: `🤖` (Robot emoji, standard)
    -   *Location*: Top control bar, next to the "End Turn" button.
    -   *Behavior*: Toggles the `isAutoBattleActive` signal in `app-game.ts`. When active, the UI should clearly indicate that Auto-Battle is running, perhaps by changing the button's background color.

-   **Forge Icons**:
    -   **Player's Forge**: `🔥` (Fire emoji with a blue outline or background)
    -   **AI's Forge**: `🔥` (Fire emoji with a red outline or background)
    -   *Location*: Displayed on the tile where a forge has been built.
    -   *State*: The icon should be clearly visible on the game board, distinct from units or resources.

## Player Feedback

Visual feedback is critical for communicating game state to the player.

-   **Unit Movement**: Animate the unit's transition from its start tile to its end tile. The `unitMoveOffsetSignal` can be used to drive this animation.
-   **Combat**:
    -   **Attack Animation**: When a unit attacks, it should have a brief "nudge" animation towards its target. The `attackerNudgeSignal` provides the necessary offset.
    -   **Damage Feedback**: The attacked unit or wall should flash or shake. The `shakenUnitIdSignal` and `shakenWallIdSignal` are used to trigger this effect.
-   **Wall Building**: When a wall is built, it should fade in or animate its construction.
-   **Error/Invalid Action**: If a player attempts an invalid action (e.g., moving to an occupied tile, building on an invalid edge), provide a subtle visual and/or auditory cue (e.g., a red flash on the tile, a soft "buzz" sound).
