# UI Standards

## Component Encapsulation
- Game Guide may use ViewEncapsulation.None to leverage shared styles.
- Prefer colocating animations and keyframes within the component’s stylesheet for portability.

## Animations
- Use CSS keyframes for combat and movement:
  - hit-flash, hp-drain, tremble, merge-loop for evolution/combat.
  - path-animation for movement, centered on tile coordinates.
- Keep animation durations short (150–400ms) to preserve snappy feedback.

## Icons
- Base icon: 🏰 Castle
  - Player: filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.8))
  - AI: filter: drop-shadow(0 0 8px rgba(239, 68, 68, 0.8))

## Victory Counter
- Display the Forest Monopoly countdown in the top bar.
- Apply a subtle pulse animation when turns remaining ≤ 3.

## External Links
- Always open external links with target=_blank and “noopener,noreferrer”.
- Use the provided openExternalLink helper which enforces these attributes.

## Loading States
- Use a small spinner or progress indicator on actions that fetch remote data.
- For High Scores, show a spinner on the button or overlay while awaiting Firebase responses.
- Avoid blocking the entire UI; prefer localized indicators near the initiating control.
