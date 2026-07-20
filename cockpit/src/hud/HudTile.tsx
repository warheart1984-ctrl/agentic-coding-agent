import type { ReactNode } from "react";
import styles from "./HudTile.module.css";
import { PanelGlyph } from "../crvs/glyphs";
import type { PanelId } from "../crvs/types";

interface HudTileProps {
  id: string;
  title: string;
  children: ReactNode;
  accent?: "cyan" | "violet" | "amber" | "green";
  onExpand?: () => void;
  className?: string;
  panelId?: PanelId;
}

export function HudTile({
  id,
  title,
  children,
  accent = "cyan",
  onExpand,
  className,
  panelId,
}: HudTileProps) {
  return (
    <section className={`${styles.tile} ${styles[accent]} ${className ?? ""}`}>
      <header className={styles.header}>
        <span className={styles.id}>{id}</span>
        {panelId ? (
          <span className={styles.glyph} aria-hidden>
            <PanelGlyph panelId={panelId} />
          </span>
        ) : null}
        <h3 className={styles.title}>{title}</h3>
        {onExpand ? (
          <button type="button" className={styles.expand} onClick={onExpand} title="Expand">
            ↗
          </button>
        ) : null}
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
