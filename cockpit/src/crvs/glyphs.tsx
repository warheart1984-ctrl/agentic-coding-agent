/**
 * CRVS semantic glyphs P01–P14 — SVG only, no fabricated meaning beyond schema labels.
 */
import type { ReactElement, ReactNode } from "react";
import type { PanelId } from "./types";

const size = 28;

function Svg({ children, label }: { children: ReactNode; label: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-label={label}
      role="img"
      style={{ display: "block", flexShrink: 0 }}
    >
      {children}
    </svg>
  );
}

const stroke = "currentColor";

export function GlyphP01() {
  return (
    <Svg label="Identity">
      <circle cx="16" cy="16" r="11" fill="none" stroke={stroke} strokeWidth="1.4" />
      <circle cx="16" cy="16" r="3.5" fill={stroke} />
    </Svg>
  );
}

export function GlyphP02() {
  return (
    <Svg label="Constitution">
      <path d="M8 24 V10 h16 v14" fill="none" stroke={stroke} strokeWidth="1.4" />
      <path d="M11 14 h10 M11 18 h8" stroke={stroke} strokeWidth="1.2" />
      <path d="M16 4 L24 12 L8 12 Z" fill="none" stroke={stroke} strokeWidth="1.4" />
    </Svg>
  );
}

export function GlyphP03() {
  return (
    <Svg label="Runtime Status">
      <polygon
        points="16,3 28,10 28,22 16,29 4,22 4,10"
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
      />
      <polyline
        points="7,16 11,16 13,11 16,21 19,14 22,16 25,16"
        fill="none"
        stroke={stroke}
        strokeWidth="1.3"
      />
    </Svg>
  );
}

export function GlyphP04() {
  return (
    <Svg label="Memory & Evidence">
      <rect x="6" y="18" width="14" height="6" fill="none" stroke={stroke} strokeWidth="1.2" />
      <rect x="8" y="13" width="14" height="6" fill="none" stroke={stroke} strokeWidth="1.2" />
      <rect x="10" y="8" width="14" height="6" fill="none" stroke={stroke} strokeWidth="1.2" />
      <circle cx="24" cy="22" r="5" fill="none" stroke={stroke} strokeWidth="1.3" />
      <line x1="27.5" y1="25.5" x2="30" y2="28" stroke={stroke} strokeWidth="1.4" />
    </Svg>
  );
}

export function GlyphP05() {
  return (
    <Svg label="Intent">
      <path d="M4 16 H18" stroke={stroke} strokeWidth="1.5" />
      <path d="M14 11 L20 16 L14 21" fill="none" stroke={stroke} strokeWidth="1.5" />
      <rect x="20" y="8" width="8" height="16" rx="1" fill="none" stroke={stroke} strokeWidth="1.4" />
    </Svg>
  );
}

export function GlyphP06() {
  return (
    <Svg label="Authority">
      <path d="M8 10 L12 6 L16 10 L20 6 L24 10 V14 H8 Z" fill="none" stroke={stroke} strokeWidth="1.3" />
      <path d="M16 14 V18 M10 28 L16 18 L22 28" fill="none" stroke={stroke} strokeWidth="1.3" />
    </Svg>
  );
}

export function GlyphP07() {
  return (
    <Svg label="Evidence Chain">
      <circle cx="8" cy="16" r="4" fill="none" stroke={stroke} strokeWidth="1.3" />
      <circle cx="16" cy="16" r="4" fill="none" stroke={stroke} strokeWidth="1.3" />
      <circle cx="24" cy="16" r="4" fill="none" stroke={stroke} strokeWidth="1.3" />
      <path d="M20 12 L23 16 L28 10" fill="none" stroke={stroke} strokeWidth="1.4" />
    </Svg>
  );
}

export function GlyphP08() {
  return (
    <Svg label="Execution">
      <circle cx="14" cy="16" r="7" fill="none" stroke={stroke} strokeWidth="1.3" />
      <circle cx="14" cy="16" r="2.5" fill={stroke} />
      <rect x="20" y="10" width="8" height="10" rx="1" fill="none" stroke={stroke} strokeWidth="1.2" />
      <path d="M22 13 h4 M22 16 h3" stroke={stroke} strokeWidth="1" />
    </Svg>
  );
}

export function GlyphP09() {
  return (
    <Svg label="Reality">
      <circle cx="16" cy="16" r="9" fill="none" stroke={stroke} strokeWidth="1.3" />
      <ellipse cx="16" cy="16" rx="4" ry="9" fill="none" stroke={stroke} strokeWidth="1.1" />
      <line x1="7" y1="16" x2="25" y2="16" stroke={stroke} strokeWidth="1.1" />
      <path d="M16 5 L18 1 M16 5 L14 1 M27 16 L31 14 M27 16 L31 18" stroke={stroke} strokeWidth="1.1" />
    </Svg>
  );
}

export function GlyphP10() {
  return (
    <Svg label="Continuity">
      <path d="M6 8 H26 M6 16 H26 M6 24 H26 M10 6 V26 M18 6 V26" stroke={stroke} strokeWidth="1" opacity="0.55" />
      <path d="M5 22 C10 10, 18 24, 27 8" fill="none" stroke={stroke} strokeWidth="1.5" />
    </Svg>
  );
}

export function GlyphP11() {
  return (
    <Svg label="Cluster">
      <circle cx="8" cy="10" r="2.5" fill={stroke} />
      <circle cx="24" cy="10" r="2.5" fill={stroke} />
      <circle cx="16" cy="22" r="2.5" fill={stroke} />
      <circle cx="16" cy="12" r="2" fill="none" stroke={stroke} strokeWidth="1.2" />
      <line x1="8" y1="10" x2="16" y2="12" stroke={stroke} strokeWidth="1.1" />
      <line x1="24" y1="10" x2="16" y2="12" stroke={stroke} strokeWidth="1.1" />
      <line x1="16" y1="12" x2="16" y2="22" stroke={stroke} strokeWidth="1.1" />
    </Svg>
  );
}

export function GlyphP12() {
  return (
    <Svg label="Compute Fabric">
      <path
        d="M6 10 L16 4 L26 10 L26 22 L16 28 L6 22 Z M6 10 L16 16 L26 10 M16 16 V28"
        fill="none"
        stroke={stroke}
        strokeWidth="1.2"
      />
    </Svg>
  );
}

export function GlyphP13() {
  return (
    <Svg label="Replay">
      <path
        d="M16 6 C22 6 26 11 26 16 C26 22 21 26 16 26 C11 26 8 22 8 18"
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
      />
      <path d="M8 18 L5 14 L11 13" fill="none" stroke={stroke} strokeWidth="1.3" />
      <circle cx="16" cy="16" r="2" fill={stroke} />
    </Svg>
  );
}

export function GlyphP14() {
  return (
    <Svg label="Stewardship">
      <path d="M10 18 C10 12 14 9 16 8 C18 9 22 12 22 18 C22 24 16 27 16 27 C16 27 10 24 10 18 Z" fill="none" stroke={stroke} strokeWidth="1.3" />
      <path d="M8 22 C6 20 6 16 8 14" fill="none" stroke={stroke} strokeWidth="1.3" />
      <path d="M7 20 H5" stroke={stroke} strokeWidth="1.3" />
    </Svg>
  );
}

const GLYPHS: Record<PanelId, () => ReactElement> = {
  P01: GlyphP01,
  P02: GlyphP02,
  P03: GlyphP03,
  P04: GlyphP04,
  P05: GlyphP05,
  P06: GlyphP06,
  P07: GlyphP07,
  P08: GlyphP08,
  P09: GlyphP09,
  P10: GlyphP10,
  P11: GlyphP11,
  P12: GlyphP12,
  P13: GlyphP13,
  P14: GlyphP14,
};

export function PanelGlyph({ panelId }: { panelId: PanelId }) {
  const G = GLYPHS[panelId];
  return <G />;
}
