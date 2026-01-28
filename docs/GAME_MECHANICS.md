# Game Mechanics

## Combat
- Attack power equals unit points, modified by luck per tier.
- Luck: 20% Crit adds +Δ, 20% Miss subtracts −Δ, otherwise 0.
- Δ by tier: T1=1, T2=2, T3=4, T4=8.
- Defense bonuses:
  - Shield +1 when a unit has stayed 3+ turns.
  - Support +1 when an adjacent same-tier ally exists.
- Combat outcomes:
  - Attacker > Defender: Defender removed; attacker’s points reduce by defender’s points, then tier/level recalculated.
  - Attacker < Defender: Attacker removed; defender’s points reduce by attacker’s points, then tier/level recalculated.
  - Tie: 50% both destroyed (DRAW), 50% one survives at tier’s base minimum (LUCKY x1.25).
- Walls:
  - Neutral walls always take 100% damage.
  - Player/AI walls take fixed damage per attacker tier: T1=34%, T2=51%, T3+=100%.
  - Diagonal attacks are blocked if any corner-adjacent wall obstructs the move-to-attack vector.

## Movement
- Movement range by tier:
  - T1: 1 tile, cardinal only.
  - T2: 1 tile, 8-directional.
  - T3: 2 tiles, 8-directional.
  - T4: 3 tiles, 8-directional.
- Movement respects walls:
  - Cardinal: blocked if a wall exists on the edge.
  - Diagonal: blocked if any of the corner edges has a wall.
- Merging:
  - Same-tier units can merge; points sum up to tier max, surplus becomes a remainder unit recalculated by thresholds.

## Victory
- Economic Domination (Monopoly):
  - Tracks per-owner consecutive turns of forest control.
  - Countdown is 10 turns once an owner holds all forests at once.
  - The display shows turns remaining for the current controller; resets when control breaks.

## High Scores & Leaderboard Logic
- Data Structure:
  - ScoreEntry: playerName, turnsPlayed, forestsCaptured, victoryType (Monopoly/Annihilation), timestamp.
- Ranking Criteria:
  - Rank by Victory type first (Monopoly outranks Annihilation), then by minimum turnsPlayed.
  - Ties break by earlier timestamp.
