# Nova Crest Vector Specification (for an SVG Designer)

---

## Overall Shape

- Circular emblem with inner hexagonal core.
- Outer ring thickness: 8–10% of total radius.

---

## Layers

### Outer Ring
- Color: `#0A1E3F` (Nova Blue)
- Stroke: 3–4px, solid.
- Engraved six small glyphs evenly spaced (for six layers).

### Middle Ring
- Color: `#D4A857` (Constitution Gold)
- Slight inner glow, 50% opacity.

### Inner Core (Hexagon)
- Color: `#3BE8FF` (Cyan)
- Faceted, with subtle gradient from center outward.

### Symbol Inside Core
- Stylized "N" formed by two intersecting diagonal lines and a vertical spine.
- Stroke: 2px, color `#FFFFFF`.
- Slight glow.

### Accents
- Thin radial lines from core to middle ring (6 lines).
- Small dots at ring intersections, color `#3BE8FF`.

---

## SVG Constraints

| Property | Value |
|----------|-------|
| ViewBox | `0 0 512 512` |
| Core & Glyphs | `<path>` elements |
| Rings | `<circle>` elements |
| Effects | All vector — no raster effects |
