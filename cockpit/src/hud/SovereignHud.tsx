/**
 * Sovereign X OS HUD — CRVS v1.0 visualization layer.
 * Reveals constitutional evidence only; never creates authority.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import styles from "./SovereignHud.module.css";
import { HudTile } from "./HudTile";
import { CenterCommand } from "./CenterCommand";
import { HudRealityStrip } from "./HudRealityStrip";
import { ToastContainer } from "../components/Toast";
import { MonitoringDashboard } from "../components/MonitoringDashboard";
import { useCockpitState } from "../state/store";
import { PlanVisualizer } from "../panels/PlanVisualizer";
import { DiffInspector } from "../panels/DiffInspector";
import { ReceiptViewer } from "../panels/ReceiptViewer";
import { ContinuityTimeline } from "../panels/ContinuityTimeline";
import { InvariantDashboard } from "../panels/InvariantDashboard";
import { KernelMonitor } from "../panels/KernelMonitor";
import { FlightDeck } from "../flight-deck/FlightDeck";
import { LedgerCompare } from "../flight-deck/LedgerCompare";
import { ContinuityMatrix } from "../flight-deck/ContinuityMatrix";
import { DriftVisualizer } from "../drift/DriftVisualizer";
import { TerminalPanel } from "../panels/TerminalPanel";
import { AdminPanel } from "../components/AdminPanel";
import { FourDRenderer } from "../panels/FourDRenderer";
import { ComputeFabric } from "../panels/ComputeFabric";
import { LLMRouter } from "../panels/LLMRouter";
import { RealityPanel } from "../panels/RealityPanel";
import { ContractFields } from "../crvs/ContractFields";
import { PanelGlyph } from "../crvs/glyphs";
import { activateAllBindings, deactivateAllBindings } from "../crvs/bindings";
import { usePanelEvidence } from "../crvs/usePanelEvidence";
import { CONTRACT_BY_ID } from "../crvs/contracts";
import type { PanelId } from "../crvs/types";
import type { CenterMode } from "../types";

type ConsoleTab = "files" | "changes" | "git" | "terminal" | "tests";

/** CRVS panel → existing detail surface */
const PANEL_DETAIL: Partial<Record<PanelId, CenterMode>> = {
  P02: "invariants",
  P03: "kernel",
  P04: "receipts",
  P05: "plan",
  P06: "invariants",
  P07: "receipts",
  P08: "terminal",
  P09: "reality",
  P10: "continuity-matrix",
  P11: "flight-deck",
  P12: "compute-fabric",
  P13: "continuity",
  P14: "admin",
};

const DETAIL_TITLES: Record<CenterMode, string> = {
  plan: "P05 INTENT",
  invariants: "P02 CONSTITUTION",
  kernel: "P03 RUNTIME STATUS",
  receipts: "P04 / P07 EVIDENCE",
  "flight-deck": "P11 CLUSTER",
  admin: "P14 STEWARDSHIP",
  continuity: "P13 REPLAY",
  "ledger-compare": "LEDGER COMPARE",
  drift: "P10 DRIFT",
  "continuity-matrix": "P10 CONTINUITY",
  "four-d": "4D STATE",
  "compute-fabric": "P12 FABRIC",
  diff: "P08 CHANGES",
  terminal: "P08 EXECUTION",
  "llm-router": "LLM ROUTER",
  reality: "P09 REALITY",
};

function DetailBody({ mode, agents }: { mode: CenterMode; agents: string[] }) {
  switch (mode) {
    case "plan":
      return <PlanVisualizer />;
    case "diff":
      return <DiffInspector />;
    case "receipts":
      return <ReceiptViewer />;
    case "continuity":
      return <ContinuityTimeline />;
    case "invariants":
      return <InvariantDashboard />;
    case "kernel":
      return <KernelMonitor />;
    case "flight-deck":
      return <FlightDeck />;
    case "ledger-compare":
      return <LedgerCompare leftAgentId={agents[0]} rightAgentId={agents[1]} />;
    case "continuity-matrix":
      return <ContinuityMatrix />;
    case "drift":
      return <DriftVisualizer />;
    case "four-d":
      return <FourDRenderer />;
    case "compute-fabric":
      return <ComputeFabric />;
    case "llm-router":
      return <LLMRouter />;
    case "terminal":
      return <TerminalPanel />;
    case "admin":
      return <AdminPanel />;
    case "reality":
      return <RealityPanel />;
    default: {
      const _exhaustive: never = mode;
      void _exhaustive;
      return <PlanVisualizer />;
    }
  }
}

function IdentityHeader({
  onAdmin,
  onLlm,
  monitoring,
  onToggleMonitoring,
}: {
  onAdmin: () => void;
  onLlm: () => void;
  monitoring: boolean;
  onToggleMonitoring: () => void;
}) {
  const id = usePanelEvidence<Record<string, unknown>>("P01");
  const now = useMemo(() => new Date().toISOString().slice(0, 10), []);

  return (
    <header className={styles.header}>
      <div className={styles.brandBlock}>
        <div className={styles.identityRow}>
          <PanelGlyph panelId="P01" />
          <h1 className={styles.brand}>SOVEREIGN X OS — AGENTIC CODING AGENT COCKPIT</h1>
        </div>
        <p className={styles.tagline}>
          Unbound growth through bonded law. Governed. Sovereign. Self-aware. · CRVS v1.0
        </p>
        <p className={styles.identityMeta}>
          <span>
            Hash{" "}
            <strong>{String(id?.constitutionalHash ?? "awaiting evidence")}</strong>
          </span>
          <span>
            Build <strong>{String(id?.buildSignature ?? "awaiting evidence")}</strong>
          </span>
          <span>
            Agent <strong>{String(id?.agentIdentity ?? "awaiting evidence")}</strong>
          </span>
        </p>
      </div>
      <div className={styles.meta}>
        <span>
          System Time <strong>{now}</strong>
        </span>
        <span>
          User <strong>Prime Architect</strong>
        </span>
        <span>
          Clearance <strong>SOVEREIGN</strong>
        </span>
        <span>
          Auth <strong>{CONTRACT_BY_ID.P01?.authority}</strong>
        </span>
      </div>
      <div className={styles.headerActions}>
        <button
          type="button"
          className={`${styles.iconBtn} ${monitoring ? styles.iconBtnActive : ""}`}
          onClick={onToggleMonitoring}
          title="Monitoring"
        >
          SYS
        </button>
        <button type="button" className={styles.iconBtn} onClick={onAdmin} title="Stewardship">
          P14
        </button>
        <button type="button" className={styles.iconBtn} onClick={onLlm} title="LLM Router">
          LLM
        </button>
      </div>
    </header>
  );
}

function CrvsTile({
  panelId,
  areaClass,
  accent,
  onExpand,
}: {
  panelId: PanelId;
  areaClass: string;
  accent?: "cyan" | "violet" | "amber" | "green";
  onExpand: () => void;
}) {
  const c = CONTRACT_BY_ID[panelId]!;
  return (
    <div className={areaClass}>
      <HudTile
        id={panelId}
        title={c.name}
        panelId={panelId}
        accent={accent}
        onExpand={onExpand}
      >
        <ContractFields panelId={panelId} />
      </HudTile>
    </div>
  );
}

export function SovereignHud() {
  const [consoleTab, setConsoleTab] = useState<ConsoleTab>("terminal");
  const [detail, setDetail] = useState<CenterMode | null>(null);

  const selectedAgents = useCockpitState((s) => s.ui.selectedAgents);
  const selectedDiff = useCockpitState((s) => s.workspace.selectedDiff);
  const showMonitoring = useCockpitState((s) => s.uiSignals.showMonitoring);
  const setUiSignals = useCockpitState((s) => s.actions.setUiSignals);
  const setCenterMode = useCockpitState((s) => s.actions.setCenterMode);
  const exec = usePanelEvidence<Record<string, unknown>>("P08");

  useEffect(() => {
    activateAllBindings();
    return () => deactivateAllBindings();
  }, []);

  const openDetail = (mode: CenterMode) => {
    setCenterMode(mode);
    setDetail(mode);
  };

  const openPanel = (panelId: PanelId) => {
    const mode = PANEL_DETAIL[panelId];
    if (mode) openDetail(mode);
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const map: Record<string, CenterMode> = {
        p: "plan",
        d: "diff",
        r: "receipts",
        c: "continuity",
        i: "invariants",
        k: "kernel",
        f: "flight-deck",
        t: "terminal",
        a: "admin",
      };
      if (e.key === "Escape") {
        setDetail(null);
        e.preventDefault();
        return;
      }
      if (!e.metaKey && !e.ctrlKey && map[e.key]) {
        openDetail(map[e.key]!);
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCenterMode]);

  const consoleBody: ReactNode = (() => {
    if (consoleTab === "changes" || consoleTab === "files") {
      if (selectedDiff?.text) {
        return (
          <pre className={styles.codeLine}>
            {selectedDiff.text.split("\n").slice(0, 40).map((line, i) => {
              const cls = line.startsWith("+")
                ? styles.codeAdd
                : line.startsWith("-")
                  ? styles.codeDel
                  : line.startsWith("@@")
                    ? styles.codeMeta
                    : undefined;
              return (
                <div key={i} className={cls}>
                  {line}
                </div>
              );
            })}
          </pre>
        );
      }
      return (
        <pre className={styles.codeLine}>
          <div className={styles.codeMeta}>// P08 Execution — workspace preview</div>
          <div>active: {formatList(exec?.activeExecutions)}</div>
          <div>receipts: {formatList(exec?.receiptIds)}</div>
          <div>driftScore: {String(exec?.driftScore ?? "awaiting evidence")}</div>
          <div className={styles.codeMeta}>{String(exec?._provenance ?? "awaiting evidence")}</div>
        </pre>
      );
    }
    if (consoleTab === "git") {
      return (
        <pre className={styles.codeLine}>
          <div className={styles.codeMeta}>constitutional working tree</div>
          <div>evidence source: runtime.execution</div>
          <div className={styles.codeAdd}>provenance required for commit</div>
        </pre>
      );
    }
    if (consoleTab === "tests") {
      return (
        <pre className={styles.codeLine}>
          <div className={styles.codeMeta}>// Reality / stewardship validate via P09 · P14</div>
          <div>Expand P09 Reality or P14 Stewardship for lawful metrics.</div>
        </pre>
      );
    }
    return (
      <pre className={styles.codeLine}>
        <div className={styles.codeMeta}>$ nova spine · CRVS visualization layer</div>
        <div>panels bound: P01–P14</div>
        <div>law: reveal authority · never fabricate evidence</div>
        <div className={styles.codeAdd}>{String(exec?._provenance ?? "bindings activating…")}</div>
      </pre>
    );
  })();

  return (
    <div className={styles.hud}>
      <ToastContainer />

      <IdentityHeader
        monitoring={!!showMonitoring}
        onToggleMonitoring={() =>
          setUiSignals({
            ...useCockpitState.getState().uiSignals,
            showMonitoring: !showMonitoring,
          })
        }
        onAdmin={() => openPanel("P14")}
        onLlm={() => openDetail("llm-router")}
      />

      <div className={styles.grid}>
        <CrvsTile panelId="P02" areaClass={styles.t01} accent="amber" onExpand={() => openPanel("P02")} />
        <CrvsTile panelId="P03" areaClass={styles.t02} onExpand={() => openPanel("P03")} />

        <div className={styles.center}>
          <CenterCommand />
          <div className={styles.console}>
            <div className={styles.consoleTabs}>
              {(
                [
                  ["files", "FILES"],
                  ["changes", "CHANGES"],
                  ["git", "GIT"],
                  ["terminal", "TERMINAL"],
                  ["tests", "TESTS"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`${styles.consoleTab} ${consoleTab === id ? styles.consoleTabActive : ""}`}
                  onClick={() => setConsoleTab(id)}
                  onDoubleClick={() => {
                    if (id === "terminal") openDetail("terminal");
                    if (id === "changes" || id === "files") openDetail("diff");
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className={styles.consoleBody}>{consoleBody}</div>
          </div>
        </div>

        <CrvsTile panelId="P04" areaClass={styles.t03} accent="violet" onExpand={() => openPanel("P04")} />
        <CrvsTile panelId="P07" areaClass={styles.t04} accent="violet" onExpand={() => openPanel("P07")} />
        <CrvsTile panelId="P08" areaClass={styles.t05} onExpand={() => openPanel("P08")} />
        <CrvsTile panelId="P10" areaClass={styles.t06} accent="green" onExpand={() => openPanel("P10")} />
        <CrvsTile panelId="P11" areaClass={styles.t07} accent="green" onExpand={() => openPanel("P11")} />
        <CrvsTile panelId="P12" areaClass={styles.t08} onExpand={() => openPanel("P12")} />
        <CrvsTile panelId="P13" areaClass={styles.t09} onExpand={() => openPanel("P13")} />
        <CrvsTile panelId="P14" areaClass={styles.t10} accent="amber" onExpand={() => openPanel("P14")} />
        <CrvsTile panelId="P06" areaClass={styles.t11} accent="amber" onExpand={() => openPanel("P06")} />
        <CrvsTile panelId="P05" areaClass={styles.t12} onExpand={() => openPanel("P05")} />
      </div>

      <div className={styles.realityWrap}>
        <HudRealityStrip />
      </div>

      <footer className={styles.footer}>
        <div className={styles.footerLeft}>
          <span>SOVEREIGN X FABRIC</span>
          <span>MERKLE-LINKED</span>
          <span>CRVS v1.0</span>
          <span>LINEAGE-VERIFIED</span>
          <span>CONSTITUTIONAL</span>
          <span>SELF-AWARE</span>
        </div>
        <div className={styles.footerRight}>
          <span>ALL ACTIONS RECORDED</span>
          <span>ALL CHANGES JUSTIFIED</span>
          <span>ALL INTELLIGENCE GOVERNED</span>
        </div>
      </footer>

      {showMonitoring ? <MonitoringDashboard /> : null}

      {detail ? (
        <div className={styles.overlay} role="dialog" aria-modal="true">
          <div className={styles.overlayPanel}>
            <header className={styles.overlayHeader}>
              <span>{DETAIL_TITLES[detail] ?? detail}</span>
              <button type="button" className={styles.iconBtn} onClick={() => setDetail(null)}>
                CLOSE
              </button>
            </header>
            <div className={styles.overlayBody}>
              <DetailBody mode={detail} agents={selectedAgents} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatList(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return "awaiting evidence";
  return value.slice(0, 6).map(String).join(", ");
}
