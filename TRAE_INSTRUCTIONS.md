# Trae Instructions (Mandatory Context)

## Stability Rules
- NEVER remove the Monopoly Victory counter logic from the engine.
- ALWAYS verify external links using the openExternalLink method with “noopener,noreferrer”.
- PROTECT the Forest Cycle animation logic in the Game Guide.

## Enforcement Notes
- External links: use the helper that calls window.open(url, '_blank', 'noopener,noreferrer'), then focuses the window if present.
- Monopoly Victory: UI must display the countdown; engine maintains the counters and determines win conditions.
- Forest Cycle: keep keyframes and triggers intact; avoid renaming core classes used by the Guide.

