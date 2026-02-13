# UI Standards

This document outlines the standards for UI components, icons, and player feedback.

## Gaming Hub & Navigation

The application uses a hub-and-spoke routing architecture:
- **Landing Page (/)**:
  - Full-screen futuristic layout with emerald/purple glow effects.
  - Interactive cards with `hover:scale-105` and custom glow shadows.
  - Emerald Theme: Used for active games like **Shape Tactics**.
  - Purple Theme: Used for in-development projects like **Project: X**.
- **Return to Hub**: A home icon button is present in the top-left corner of the game screen to allow users to exit back to the main portal.

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

### Special Icons

The following icons have been added to support new mechanics:

-   **Auto-Battle Toggle**:
    -   **Active**: `🤖` (Robot emoji with a green check or border)
    -   **Inactive**: `🤖` (Robot emoji, standard)
    -   *Location*: Top control bar, next to the "End Turn" button.
    -   *Behavior*: Toggles the `isAutoBattleActive` signal.

-   **Forge Icons**:
    -   **Player's Forge**: `🔥` (Fire emoji with a blue outline or background)
    -   **AI's Forge**: `🔥` (Fire emoji with a red outline or background)
    -   *Location*: Displayed on the tile where a forge has been built.

## Player Feedback

Visual feedback is critical for communicating game state to the player.

-   **Unit Movement**: Animate the unit's transition from its start tile to its end tile using the `unitMoveOffsetSignal`.
-   **Combat**:
    -   **Attack Animation**: A brief "nudge" towards the target via `attackerNudgeSignal`.
    -   **Damage Feedback**: The attacked unit or wall should flash or shake using `shakenUnitIdSignal` and `shakenWallIdSignal`.
-   **Wall Building**: When a wall is built, it should fade in or animate its construction.
-   **Error/Invalid Action**: Subtle visual/auditory cues for invalid actions (occupied tiles, invalid edges).
