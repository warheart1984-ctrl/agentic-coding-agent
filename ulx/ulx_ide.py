#!/usr/bin/env python3
from __future__ import annotations

import json
import hashlib
from difflib import SequenceMatcher
from datetime import datetime, timezone
from html import escape as html_escape
import subprocess
import sys
import urllib.error
import urllib.request
import tempfile
from pathlib import Path
from dataclasses import dataclass
from typing import Any, Iterable
from urllib.parse import quote, unquote

import ulx
from federation_modules import FederationSurfaceModule, build_default_federation_modules

from PyQt6.QtCore import QEasingCurve, QEvent, QObject, QPropertyAnimation, QRegularExpression, Qt, QSettings, QTimer, QUrl
from PyQt6.QtGui import QAction, QBrush, QColor, QFont, QFontDatabase, QTextCharFormat, QSyntaxHighlighter
from PyQt6.QtWidgets import (
    QApplication,
    QDialog,
    QDialogButtonBox,
    QFileDialog,
    QGridLayout,
    QHBoxLayout,
    QGraphicsDropShadowEffect,
    QLabel,
    QMainWindow,
    QListWidget,
    QListWidgetItem,
    QPlainTextEdit,
    QMessageBox,
    QPushButton,
    QComboBox,
    QSplitter,
    QStatusBar,
    QTabWidget,
    QToolBar,
    QLineEdit,
    QSlider,
    QTextBrowser,
    QVBoxLayout,
    QTreeWidget,
    QTreeWidgetItem,
    QWidget,
)


APP_NAME = "ULX Universa IDE"
APP_ORG = "ULX"
APP_DOMAIN = "ulx.local"
DEFAULT_ENCODING = "utf-8"

BASE_DIR = Path(__file__).resolve().parent

EXAMPLES = {
    "hello_governed_world.ulx": """@constitution {
  @article BASIC {
    always: output.valid == true;
  }
}
module Hello [lawful] {
  fn main() -> Governed<Str, lawful> {
    bind greeting: Lawful<Str> = "Hello, Governed World.";
    enforce: greeting != "";
    emit OUTPUT: greeting;
    return greeting;
  }
}
""",
    "agent_registration.ulx": """module AgentCore [sovereign] {
  fn main() -> Governed<Bool, sovereign> {
    bind name: Lawful<Str> = "Nexus";
    anchor: name;
    emit AGENT_REGISTERED: name;
    return true;
  }
}
""",
    "reactive_signal_pipeline.ulx": """module DataStream [reactive] {
  fn main() -> Int [pure] {
    bind x: Lawful<Int> = 5000;
    bind processed: Lawful<Int> = x / 1000;
    enforce: processed >= 0;
    return processed;
  }
}
""",
    "governance_violation_demo.ulx": """@constitution {
  @article AUTHORITY {
    never: authority.self_elevate;
    always: action.logged == true;
  }
}
module Gov [lawful] {
  fn main() -> Bool [lawful] {
    bind action: Lawful<Bool> = true;
    return true;
  }
}
""",
}

ISL_SAMPLE = """{
  "intent": "register_agent",
  "agent": "Nexus",
  "authority": "sovereign",
  "trace": {
    "source": "ULX IDE",
    "mode": "desktop"
  }
}
"""


@dataclass(frozen=True)
class WorkspaceAdapter:
    key: str
    name: str
    root: Path
    entry_candidates: tuple[str, ...]
    description: str


WORKSPACE_ADAPTERS = (
    WorkspaceAdapter(
        key="ulx-playground",
        name="ULX Playground",
        root=BASE_DIR,
        entry_candidates=("ulx_ide.py", "ulx.py", "ulx-ide.html"),
        description="Local ULX IDE prototype and reference runtime.",
    ),
    WorkspaceAdapter(
        key="lawful-nova-shell",
        name="Lawful Nova Shell",
        root=Path(r"E:\project-infi\lawful-nova-shell"),
        entry_candidates=("desktop/renderer/index.html", "desktop/main.js", "README.md"),
        description="Electron + Monaco governed shell with replay and repo lineage.",
    ),
    WorkspaceAdapter(
        key="agentic-coding-agent",
        name="Agentic Coding Agent",
        root=Path(r"E:\agentic-coding-agent"),
        entry_candidates=("web/index.html", "README.md", "package.json"),
        description="Repo-backed cockpit and web workbench.",
    ),
    WorkspaceAdapter(
        key="skillzmcgee",
        name="SkillzMcGee",
        root=Path(r"E:\skillzmcgee"),
        entry_candidates=("README.md", "package.json", "nova-studio"),
        description="Broad runtime and workflow workspace with governed surfaces.",
    ),
    WorkspaceAdapter(
        key="project-infi",
        name="Project Infi",
        root=Path(r"E:\project-infi"),
        entry_candidates=("docs/architecture/README.md", "lawful-nova-shell/desktop/renderer/index.html", "README.md"),
        description="Umbrella workspace catalog for nested checkouts and shared docs.",
    ),
    WorkspaceAdapter(
        key="project-infi-aais",
        name="Project Infi AAIS",
        root=Path(r"E:\project-infi\aais"),
        entry_candidates=("launcher.py", "__main__.py", "README.md"),
        description="AAIS runtime and launcher surfaced as a dedicated ULX adapter.",
    ),
    WorkspaceAdapter(
        key="project-infi-sovereignx-router",
        name="SovereignX Router",
        root=Path(r"E:\project-infi\packages\sovereignx-router"),
        entry_candidates=("README.md", "src/SovereignXRouter.ts", "src/index.ts"),
        description="SovereignX routing engine and proof surface.",
    ),
    WorkspaceAdapter(
        key="project-infi-directx-os",
        name="DirectX / SovereignX OS",
        root=Path(r"E:\project-infi\docs\crk1\release"),
        entry_candidates=("SOVEREIGN_ROUTER_X_PRODUCT_SPEC.md", "CODEX_ROUTER_BRIDGE.md", "UGR_UGQL_UPL_CRF_V1.conformance.json"),
        description="Execution and OS-level routing specification surface wrapped by UGR.",
    ),
    WorkspaceAdapter(
        key="project-infi-veilthorn",
        name="Vielthorn",
        root=Path(r"E:\project-infi\docs-site\docs\veilthorn"),
        entry_candidates=("index.md", "conformance.md", "api-reference.md"),
        description="Conformance and proof-surface docs for the Vielthorn line.",
    ),
    WorkspaceAdapter(
        key="project-infi-aios-node",
        name="AIOS Constitutional Node",
        root=Path(r"E:\project-infi"),
        entry_candidates=(
            "constitutional/aios_node_runtime.py",
            "docs/specifications/aios-constitutional-node-runtime-v1.md",
            "docs/crk1/release/AIOS_CONSTITUTIONAL_NODE_RUNTIME_V1.spec.json",
        ),
        description="Smallest sovereign unit of constitutional administrative intelligence.",
    ),
    WorkspaceAdapter(
        key="project-infi-sovereign-ide",
        name="Project Infi Sovereign IDE",
        root=Path(r"E:\project-infi\sovereign-ide"),
        entry_candidates=("ui/shell/sovereign_ide_window.py", "main.py", "README.md"),
        description="Sovereign IDE shell with CEP, routing, and replay surfaces.",
    ),
    WorkspaceAdapter(
        key="project-infinity-main",
        name="Project Infinity Main",
        root=Path(r"E:\Project-Infinity-main"),
        entry_candidates=("README.md", "aais/launcher.py", "Project-Infinity-main/README.md", "Project-Infinity-main/app/main.py"),
        description="Top-level Project Infinity wrapper with AAIS and nested app surfaces.",
    ),
    WorkspaceAdapter(
        key="project-infinity-main-app",
        name="Project Infinity Main App",
        root=Path(r"E:\Project-Infinity-main\Project-Infinity-main"),
        entry_candidates=("README.md", "pyproject.toml", "app/main.py", "src/aais_blueprint.py"),
        description="Nested Project Infinity AAIS application checkout and runtime shell.",
    ),
    WorkspaceAdapter(
        key="project-infinity-main-aais",
        name="Project Infinity Main AAIS",
        root=Path(r"E:\Project-Infinity-main\aais"),
        entry_candidates=("launcher.py", "README.md", "__main__.py"),
        description="Top-level AAIS launcher package surfaced from the Project Infinity wrapper.",
    ),
)

TEXT_FILE_PRIORITY = (
    "README.md",
    "README.txt",
    "README",
    "package.json",
    "pyproject.toml",
    "tsconfig.json",
    "tsconfig.nova-studio.json",
    "main.py",
    "index.html",
    "index.ts",
    "index.js",
    "index.py",
    "ulx.py",
    "ulx_ide.py",
)

TEXT_EXTENSIONS = {
    ".ulx", ".py", ".md", ".txt", ".json", ".html", ".htm", ".js", ".ts", ".tsx", ".jsx",
    ".css", ".toml", ".yaml", ".yml", ".cjs", ".mjs", ".rs", ".go", ".sh", ".ps1", ".xml",
}

IGNORED_TREE_DIRS = {
    ".git",
    ".hg",
    ".svn",
    ".venv",
    "venv",
    "__pycache__",
    "node_modules",
    "dist",
    "build",
    "out",
    "coverage",
    ".next",
    ".turbo",
}

TREE_PATH_ROLE = int(Qt.ItemDataRole.UserRole)
TREE_KIND_ROLE = TREE_PATH_ROLE + 1
TREE_LOADED_ROLE = TREE_PATH_ROLE + 2

WORKSPACE_TREE_MAX_DEPTH = 6
WORKSPACE_TREE_MAX_CHILDREN = 250
WORKSPACE_EVENT_LIMIT = 1000
TREE_PLACEHOLDER_LABEL = "(expand to load)"
WORKSPACE_RUNTIME_DIRNAME = ".ulx"
WORKSPACE_REPLAY_FILENAME = "workspace-lineage.jsonl"
WORKSPACE_INDEX_FILENAME = "workspace-index.json"
WORKSPACE_REPLAY_SELECTIONS_KEY = "workspace_replay_selection_map"
WORKSPACE_TRUST_SELECTIONS_KEY = "workspace_trust_selection_map"
WORKSPACE_ROUTER_API_BASE_KEY = "workspace_router_api_base_url"
COC_CONTROL_PLANE_API_BASE_KEY = "coc_control_plane_api_base_url"
COC_UGQL_QUERY_KEY = "coc_ugql_last_query"
COC_ACTIVE_TAB_KEY = "coc_active_tab_index"
FEDERATION_MODULES_ENABLED_KEY = "federation_modules_enabled"
WORKSPACE_REPLAY_SELECTION_KIND = "replay.selection"
WORKSPACE_TRUST_SELECTION_KIND = "trust.revision"

TFS_CLAUSES = (
    "T1 Evidence-Backed Trust: no trust without evidence.",
    "T2 Governed Primitive: trust is first-class and governed.",
    "T3 Bounded and Scored: trust is never absolute or binary.",
    "T4 Replayable: trust artifacts are hash-chained and replayable.",
    "T5 Governance Bound: trust cannot bypass governance.",
    "T6 Temporal Continuity: trust revisions, supersession, decay.",
    "T7 Delegation Weighting: trust-weighted authority chains.",
    "T8 Decision Context: trust context recorded at decision time.",
    "T9 Retirement and Risk: decayed trust can trigger retirement.",
    "T10 Ledger Neutrality: the ledger preserves, it does not assert truth.",
)


def _fixed_font() -> QFont:
    font = QFontDatabase.systemFont(QFontDatabase.SystemFont.FixedFont)
    if not font.family():
        font = QFont("Consolas")
    font.setPointSize(10)
    return font


def _read_text(path: Path) -> str:
    return path.read_text(encoding=DEFAULT_ENCODING)


def _load_json(path: Path) -> Any | None:
    try:
        return json.loads(_read_text(path))
    except Exception:
        return None


def _write_text(path: Path, text: str) -> None:
    path.write_text(text, encoding=DEFAULT_ENCODING)


def _json_pretty(value: Any) -> str:
    return json.dumps(value, indent=2, sort_keys=True, default=str)


def _safe_repr(value: Any) -> str:
    try:
        return repr(value)
    except Exception:
        return f"<unreprable {type(value).__name__}>"


def _format_mapping(title: str, mapping: dict[str, Any]) -> str:
    if not mapping:
        return f"{title}: (empty)"
    lines = [title + ":"]
    for key in sorted(mapping):
        lines.append(f"  {key}: {_safe_repr(mapping[key])}")
    return "\n".join(lines)


def _flatten_modules(program: Any) -> list[str]:
    return [module.name for module in getattr(program, "modules", [])]


def _find_main(program: Any) -> str | None:
    for module in getattr(program, "modules", []):
        for decl in getattr(module, "decls", []):
            if getattr(decl, "kind", None) == "Function" and getattr(decl, "name", None) == "main":
                return f"{module.name}::main"
    return None


def _audit_lines(audit_trail: Iterable[dict[str, Any]]) -> str:
    lines: list[str] = []
    for entry in audit_trail:
        kind = entry.get("type", "EVENT")
        payload = {k: v for k, v in entry.items() if k != "type"}
        if payload:
            lines.append(f"[{kind}] {_json_pretty(payload)}")
        else:
            lines.append(f"[{kind}]")
    return "\n\n".join(lines) if lines else "(no audit events)"


def _workspace_exists(adapter: WorkspaceAdapter) -> bool:
    return adapter.root.exists()


def _path_text_rank(path: Path) -> tuple[int, int, int]:
    name = path.name
    lower_name = name.lower()
    if name in TEXT_FILE_PRIORITY:
        return (0, TEXT_FILE_PRIORITY.index(name), 0)
    if lower_name.startswith("readme"):
        return (1, 0, 0)
    if path.suffix.lower() == ".ulx":
        return (2, 0, 0)
    if path.suffix.lower() == ".py":
        return (3, 0, 0)
    if path.suffix.lower() in {".html", ".md", ".json", ".ts", ".js"}:
        return (4, 0, 0)
    return (9, len(path.parts), len(name))


def _first_existing(root: Path, candidates: Iterable[str]) -> Path | None:
    for relative in candidates:
        candidate = root / relative
        if candidate.exists() and candidate.is_file():
            return candidate
    return None


def _first_meaningful_file(root: Path, limit: int = 300) -> Path | None:
    if not root.exists():
        return None
    candidates: list[Path] = []
    for child in root.iterdir():
        if child.is_file() and child.suffix.lower() in TEXT_EXTENSIONS:
            candidates.append(child)
    search_roots = [
        root / "desktop",
        root / "web",
        root / "src",
        root / "docs",
        root / "shell",
        root / "runtime",
        root / "nova-studio",
        root / "agent",
        root / "backend",
        root / "tests",
    ]
    seen = 0
    for folder in search_roots:
        if not folder.exists() or not folder.is_dir():
            continue
        for child in folder.rglob("*"):
            if seen >= limit:
                break
            seen += 1
            if child.is_file() and child.suffix.lower() in TEXT_EXTENSIONS:
                candidates.append(child)
        if seen >= limit:
            break
    if not candidates:
        return None
    candidates.sort(key=_path_text_rank)
    return candidates[0]


def _adapter_entry_path(adapter: WorkspaceAdapter) -> Path | None:
    explicit = _first_existing(adapter.root, adapter.entry_candidates)
    if explicit is not None:
        return explicit
    if adapter.root.exists() and adapter.root.is_dir():
        return _first_meaningful_file(adapter.root)
    return None


def _git_lines(root: Path, args: list[str]) -> list[str]:
    if not root.exists():
        return []
    try:
        result = subprocess.run(
            ["git", "-C", str(root), *args],
            check=True,
            capture_output=True,
            text=True,
        )
    except Exception:
        return []
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def _git_scalar(root: Path, args: list[str], default: str = "") -> str:
    lines = _git_lines(root, args)
    return lines[0] if lines else default


def _git_is_repo(root: Path) -> bool:
    return _git_scalar(root, ["rev-parse", "--is-inside-work-tree"], default="false") == "true"


def _git_status_lines(root: Path, limit: int = 8) -> list[str]:
    return _git_lines(root, ["status", "--short"])[:limit]


def _git_recent_commits(root: Path, limit: int = 3) -> list[str]:
    return _git_lines(root, ["log", f"-n{limit}", "--oneline", "--decorate"])


def _git_recent_diffs(root: Path, limit: int = 8) -> list[str]:
    status_lines = _git_status_lines(root, limit=limit)
    if status_lines:
        return [f"working tree: {line}" for line in status_lines]
    commits = _git_recent_commits(root, limit=limit)
    if commits:
        return [f"commit: {line}" for line in commits]
    diff_name_only = _git_lines(root, ["diff", "--name-only", "--stat", "HEAD~1..HEAD"])
    if diff_name_only:
        return [f"diff: {line}" for line in diff_name_only[:limit]]
    return []


def _workspace_file_count(root: Path) -> int:
    if not root.exists():
        return 0
    count = 0
    for child in root.rglob("*"):
        if child.is_file() and child.suffix.lower() in TEXT_EXTENSIONS:
            count += 1
        if count >= 2000:
            break
    return count


def _workspace_directory_count(root: Path) -> int:
    if not root.exists():
        return 0
    count = 0
    for child in root.iterdir():
        if child.is_dir():
            count += 1
    return count


def _git_output(root: Path, args: list[str]) -> str:
    if not root.exists():
        return ""
    try:
        result = subprocess.run(
            ["git", "-C", str(root), *args],
            check=True,
            capture_output=True,
            text=True,
        )
    except Exception:
        return ""
    return result.stdout.rstrip("\n")


def _clip_text(text: str, limit_lines: int = 120, limit_chars: int = 12000) -> str:
    lines = text.splitlines()
    if len(lines) > limit_lines:
        lines = lines[:limit_lines] + ["..."]
    clipped = "\n".join(lines)
    if len(clipped) > limit_chars:
        clipped = clipped[: limit_chars - 3].rstrip() + "..."
    return clipped


def _workspace_runtime_dir(root: Path) -> Path:
    return root / WORKSPACE_RUNTIME_DIRNAME


def _workspace_replay_artifact_path(root: Path) -> Path:
    return _workspace_runtime_dir(root) / WORKSPACE_REPLAY_FILENAME


def _workspace_index_artifact_path(root: Path) -> Path:
    return _workspace_runtime_dir(root) / WORKSPACE_INDEX_FILENAME


def _ensure_parent_dir(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def _append_json_line(path: Path, payload: dict[str, Any]) -> None:
    _ensure_parent_dir(path)
    with path.open("a", encoding=DEFAULT_ENCODING) as handle:
        handle.write(json.dumps(payload, sort_keys=True, default=str))
        handle.write("\n")


def _load_json_lines(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    records: list[dict[str, Any]] = []
    try:
        for line in path.read_text(encoding=DEFAULT_ENCODING).splitlines():
            if not line.strip():
                continue
            payload = json.loads(line)
            if isinstance(payload, dict):
                records.append(payload)
    except Exception:
        return []
    return records


def _workspace_replay_artifact_excerpt(path: Path, limit_lines: int = 48) -> str:
    if not path.exists():
        return "(replay artifact not found)"
    try:
        lines = path.read_text(encoding=DEFAULT_ENCODING).splitlines()
    except Exception as exc:
        return f"Unable to read replay artifact:\n{type(exc).__name__}: {exc}"
    if not lines:
        return "(replay artifact is empty)"
    tail = lines[-limit_lines:]
    start_line = max(1, len(lines) - len(tail) + 1)
    formatted: list[str] = [f"Artifact: {path}", f"Lines: {len(lines)}", ""]
    for offset, line in enumerate(tail, start=start_line):
        formatted.append(f"{offset:04d}: {line}")
    return "\n".join(formatted)


def _workspace_replay_artifact_event_line(path: Path, line_number: int) -> dict[str, Any] | None:
    if line_number < 1 or not path.exists():
        return None
    try:
        lines = path.read_text(encoding=DEFAULT_ENCODING).splitlines()
    except Exception:
        return None
    if line_number > len(lines):
        return None
    raw_line = lines[line_number - 1].strip()
    if not raw_line:
        return None
    try:
        payload = json.loads(raw_line)
    except Exception:
        return None
    return payload if isinstance(payload, dict) else None


def _workspace_replay_artifact_selection_event(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        lines = path.read_text(encoding=DEFAULT_ENCODING).splitlines()
    except Exception:
        return None
    for line in reversed(lines):
        raw_line = line.strip()
        if not raw_line:
            continue
        try:
            payload = json.loads(raw_line)
        except Exception:
            continue
        if isinstance(payload, dict) and payload.get("kind") == WORKSPACE_REPLAY_SELECTION_KIND:
            return payload
    return None


def _workspace_replay_artifact_event_line_for_seq(path: Path, seq: int) -> tuple[int, dict[str, Any]] | None:
    if seq <= 0 or not path.exists():
        return None
    try:
        lines = path.read_text(encoding=DEFAULT_ENCODING).splitlines()
    except Exception:
        return None
    for line_number, raw_line in enumerate(lines, start=1):
        raw_line = raw_line.strip()
        if not raw_line:
            continue
        try:
            payload = json.loads(raw_line)
        except Exception:
            continue
        if not isinstance(payload, dict):
            continue
        if payload.get("kind") == WORKSPACE_REPLAY_SELECTION_KIND:
            continue
        if int(payload.get("seq", 0)) == seq:
            return line_number, payload
    return None


def _workspace_event_signature(events: Iterable[dict[str, Any]]) -> str:
    digest = hashlib.sha256()
    for event in events:
        digest.update(json.dumps(event, sort_keys=True, default=str).encode(DEFAULT_ENCODING))
        digest.update(b"\n")
    return digest.hexdigest()


def _workspace_event_summary(events: Iterable[dict[str, Any]]) -> dict[str, Any]:
    event_list = [event for event in events if isinstance(event, dict)]
    return {
        "event_count": len(event_list),
        "signature": _workspace_event_signature(event_list),
        "kinds": [str(event.get("kind", "")) for event in event_list[-32:]],
        "last_path": str(event_list[-1].get("path", "")) if event_list else "",
    }


def _text_excerpt(path: Path, limit_lines: int = 40, limit_chars: int = 4000) -> str:
    try:
        text = _read_text(path)
    except Exception as exc:
        return f"Unable to preview file:\n{type(exc).__name__}: {exc}"
    excerpt = _clip_text(text, limit_lines=limit_lines, limit_chars=limit_chars)
    return excerpt if excerpt else "(empty file)"


class WorkspaceRepositoryIndexer:
    def __init__(self, adapter: WorkspaceAdapter):
        self.adapter = adapter
        self.root = adapter.root
        self._children_map: dict[str, list[Path]] = {}
        self._discovered_paths: set[Path] = set()
        self._manifest_paths: list[Path] = []
        self._snapshot: dict[str, Any] = {}

    def refresh(self) -> dict[str, Any]:
        root = self.root
        self._children_map = {}
        self._discovered_paths = set()
        self._manifest_paths = []
        is_git = _git_is_repo(root)
        if not root.exists():
            self._snapshot = {
                "adapter": self.adapter,
                "root": root,
                "exists": False,
                "is_git": False,
                "file_count": 0,
                "dir_count": 0,
                "best_entry": None,
                "manifest_paths": [],
                "recent_changes": [],
                "index_path": _workspace_index_artifact_path(root),
                "replay_path": _workspace_replay_artifact_path(root),
            }
            return self._snapshot

        if is_git:
            relative_paths = _git_lines(root, ["ls-files", "-co", "--exclude-standard"])
            for relative in relative_paths:
                candidate = root / relative
                if candidate.exists() and candidate.is_file():
                    self._register_path(candidate)
        else:
            for candidate in root.rglob("*"):
                if candidate.is_file():
                    self._register_path(candidate)

        if not self._discovered_paths:
            for candidate in root.rglob("*"):
                if candidate.is_file():
                    self._register_path(candidate)

        self._manifest_paths = [path for path in self._discovered_paths if path.name in TEXT_FILE_PRIORITY or path.suffix.lower() in TEXT_EXTENSIONS]
        self._manifest_paths.sort(key=_path_text_rank)

        best_entry = self.best_entry()
        file_count = len([path for path in self._discovered_paths if path.is_file()])
        dir_count = len([path for path in self._discovered_paths if path.is_dir()])
        recent_changes = _git_recent_diffs(root) if is_git else [f"file: {path.relative_to(root)}" for path in self._manifest_paths[:8]]

        self._snapshot = {
            "adapter": self.adapter,
            "root": root,
            "exists": True,
            "is_git": is_git,
            "file_count": file_count,
            "dir_count": dir_count,
            "best_entry": best_entry,
            "manifest_paths": [str(path.relative_to(root)) for path in self._manifest_paths[:32] if path.exists()],
            "recent_changes": recent_changes[:16],
            "index_path": _workspace_index_artifact_path(root),
            "replay_path": _workspace_replay_artifact_path(root),
        }
        self._write_snapshot()
        return self._snapshot

    def children_for(self, parent_path: Path) -> list[Path]:
        if not self._children_map:
            self.refresh()
        children = self._children_map.get(str(parent_path), [])
        if children:
            return list(children)
        if parent_path.exists() and parent_path.is_dir():
            try:
                fallback = sorted(
                    parent_path.iterdir(),
                    key=lambda path: (path.is_file(), path.name.lower()),
                )
            except Exception:
                return []
            return [
                path
                for path in fallback
                if path.name not in IGNORED_TREE_DIRS
                and (path.is_dir() or path.is_file() and (path.suffix.lower() in TEXT_EXTENSIONS or path.name in TEXT_FILE_PRIORITY))
            ][:WORKSPACE_TREE_MAX_CHILDREN]
        return []

    def best_entry(self) -> Path | None:
        candidates = [path for path in self._discovered_paths if path.exists() and path.is_file()]
        if not candidates:
            return _adapter_entry_path(self.adapter)
        candidates.sort(key=_path_text_rank)
        return candidates[0]

    def summary(self) -> dict[str, Any]:
        if not self._snapshot:
            self.refresh()
        return dict(self._snapshot)

    def search(self, query: str, limit: int = 12) -> list[dict[str, Any]]:
        normalized = query.strip().lower()
        if not normalized:
            return []
        if not self._snapshot:
            self.refresh()
        results: list[dict[str, Any]] = []
        for path in sorted(self._discovered_paths, key=lambda candidate: str(candidate).lower()):
            if len(results) >= limit:
                break
            if not path.exists():
                continue
            relative = str(path.relative_to(self.root)) if self.root in path.parents or path == self.root else str(path)
            haystacks = [relative.lower(), path.name.lower()]
            try:
                haystacks.append(path.read_text(encoding=DEFAULT_ENCODING, errors="ignore").lower()[:4096])
            except Exception:
                pass
            if any(normalized in hay for hay in haystacks if hay):
                results.append(
                    {
                        "path": str(path),
                        "label": relative,
                        "adapter": self.adapter.key,
                        "adapter_name": self.adapter.name,
                        "preview": _text_excerpt(path, limit_lines=8, limit_chars=800),
                    }
                )
        return results

    def _register_path(self, path: Path) -> None:
        if not path.exists():
            return
        try:
            resolved = path.resolve()
        except Exception:
            return
        self._discovered_paths.add(resolved)
        root = self.root.resolve()
        try:
            relative = resolved.relative_to(root)
        except Exception:
            return
        current = root
        self._children_map.setdefault(str(current), [])
        self._discovered_paths.add(current)
        for part in relative.parts:
            child = current / part
            self._children_map.setdefault(str(current), [])
            self._children_map.setdefault(str(child), [])
            if child not in self._children_map[str(current)]:
                self._children_map[str(current)].append(child)
            self._discovered_paths.add(child)
            current = child
        for children in self._children_map.values():
            children.sort(key=lambda item: (item.is_file(), item.name.lower()))

    def _write_snapshot(self) -> None:
        payload = {
            "adapter": self.adapter.key,
            "name": self.adapter.name,
            "root": str(self.root),
            "is_git": self._snapshot.get("is_git", False),
            "file_count": self._snapshot.get("file_count", 0),
            "dir_count": self._snapshot.get("dir_count", 0),
            "best_entry": str(self._snapshot["best_entry"].relative_to(self.root)) if self._snapshot.get("best_entry") else "",
            "manifest_paths": self._snapshot.get("manifest_paths", []),
            "recent_changes": self._snapshot.get("recent_changes", []),
        }
        _ensure_parent_dir(_workspace_index_artifact_path(self.root))
        _write_text(_workspace_index_artifact_path(self.root), _json_pretty(payload))


class ULXSyntaxHighlighter(QSyntaxHighlighter):
    def __init__(self, document):
        super().__init__(document)
        self._rules: list[tuple[QRegularExpression, QTextCharFormat]] = []

        keyword_fmt = QTextCharFormat()
        keyword_fmt.setForeground(QColor("#7dd3fc"))
        keyword_fmt.setFontWeight(QFont.Weight.DemiBold)

        type_fmt = QTextCharFormat()
        type_fmt.setForeground(QColor("#f5d06f"))

        annotation_fmt = QTextCharFormat()
        annotation_fmt.setForeground(QColor("#c084fc"))

        string_fmt = QTextCharFormat()
        string_fmt.setForeground(QColor("#86efac"))

        number_fmt = QTextCharFormat()
        number_fmt.setForeground(QColor("#fca5a5"))

        comment_fmt = QTextCharFormat()
        comment_fmt.setForeground(QColor("#94a3b8"))
        comment_fmt.setFontItalic(True)

        operator_fmt = QTextCharFormat()
        operator_fmt.setForeground(QColor("#e2e8f0"))

        keywords = [
            "always",
            "anchor",
            "any",
            "article",
            "assert",
            "bind",
            "bool",
            "constitution",
            "declare",
            "emit",
            "enforce",
            "else",
            "false",
            "float",
            "fn",
            "governed",
            "if",
            "int",
            "lawful",
            "let",
            "match",
            "module",
            "never",
            "observe",
            "pure",
            "reactive",
            "return",
            "rollback",
            "signal",
            "sovereign",
            "str",
            "then",
            "trust",
            "true",
            "type",
            "void",
            "when",
            "with",
        ]
        for word in keywords:
            self._rules.append((QRegularExpression(rf"\b{word}\b"), keyword_fmt))

        types = ["Lawful", "Governed", "Signal", "Trust", "Record", "BaseType", "AuthLevelType"]
        for word in types:
            self._rules.append((QRegularExpression(rf"\b{word}\b"), type_fmt))

        self._rules.append((QRegularExpression(r"@[A-Za-z_][A-Za-z0-9_]*"), annotation_fmt))
        self._rules.append((QRegularExpression(r'"[^"\\]*(\\.[^"\\]*)*"'), string_fmt))
        self._rules.append((QRegularExpression(r"\b\d+(?:\.\d+)?\b"), number_fmt))
        self._rules.append((QRegularExpression(r"//[^\n]*"), comment_fmt))
        self._rules.append((QRegularExpression(r"/\*.*?\*/"), comment_fmt))
        self._rules.append((QRegularExpression(r"->|=>|\|>|::|==|!=|>=|<=|&&|\|\||[=><!:;,.\(\)\{\}\[\]+\-*/%]"), operator_fmt))

    def highlightBlock(self, text: str) -> None:
        for pattern, text_format in self._rules:
            iterator = pattern.globalMatch(text)
            while iterator.hasNext():
                match = iterator.next()
                self.setFormat(match.capturedStart(), match.capturedLength(), text_format)


class CodeEditor(QPlainTextEdit):
    def __init__(self, text: str = ""):
        super().__init__()
        self.setFont(_fixed_font())
        self.setTabStopDistance(self.fontMetrics().horizontalAdvance(" ") * 2)
        self.setLineWrapMode(QPlainTextEdit.LineWrapMode.NoWrap)
        self.setPlainText(text)


class ReadOnlyPane(QPlainTextEdit):
    def __init__(self):
        super().__init__()
        self.setReadOnly(True)
        self.setFont(_fixed_font())
        self.setLineWrapMode(QPlainTextEdit.LineWrapMode.NoWrap)


class ReplayBrowserPane(QTextBrowser):
    def __init__(self):
        super().__init__()
        self.setFont(_fixed_font())
        self.setOpenExternalLinks(False)
        self.setOpenLinks(False)
        self.setAcceptRichText(True)
        self.setLineWrapMode(QTextBrowser.LineWrapMode.NoWrap)
        self.setStyleSheet(
            "QTextBrowser {"
            "background: rgba(12, 14, 20, 0.95);"
            "border: 1px solid #262a38;"
            "border-radius: 10px;"
            "padding: 8px;"
            "color: #d9dce3;"
            "}"
            "QTextBrowser a { color: #8cc3ff; text-decoration: none; }"
            "QTextBrowser a:hover { color: #eef5ff; text-decoration: underline; }"
        )


class ULXIDEWindow(QMainWindow):
    def __init__(self, settings: QSettings | None = None, workspace_adapters: Iterable[WorkspaceAdapter] | None = None):
        super().__init__()
        self.setWindowTitle(APP_NAME)
        self.resize(1450, 920)

        self.settings = settings or QSettings(APP_ORG, APP_NAME)
        self.current_path: Path | None = None
        self._dirty = False
        self._current_program = None
        self._current_interpreter = None
        self.workspace_adapters = list(workspace_adapters or WORKSPACE_ADAPTERS)
        self.federation_modules = list(build_default_federation_modules())
        self.workspace_adapter_buttons: dict[str, QPushButton] = {}
        raw_enabled_modules = self.settings.value(FEDERATION_MODULES_ENABLED_KEY, "", type=str)
        if raw_enabled_modules:
            try:
                parsed_enabled_modules = json.loads(raw_enabled_modules)
            except Exception:
                parsed_enabled_modules = []
        else:
            parsed_enabled_modules = [module.key for module in self.federation_modules]
        self._enabled_federation_module_keys = {
            str(module_key)
            for module_key in (parsed_enabled_modules if isinstance(parsed_enabled_modules, list) else [])
            if str(module_key).strip()
        }
        if not self._enabled_federation_module_keys:
            self._enabled_federation_module_keys = {module.key for module in self.federation_modules}
        self.federation_module_buttons: dict[str, QPushButton] = {}
        self.workspace_key = self.settings.value("last_workspace", "ulx-playground", type=str)
        self._workspace_context_path: Path | None = None
        self._workspace_hover_path: Path | None = None
        self._workspace_hover_depth = 0
        self._workspace_hover_items: list[QTreeWidgetItem] = []
        self._workspace_focus_phase = 0
        self._workspace_focus_timer = QTimer(self)
        self._workspace_focus_timer.setInterval(180)
        self._workspace_focus_timer.timeout.connect(self._tick_workspace_focus_pulse)
        self._workspace_event_seq = 0
        self._workspace_event_log: list[dict[str, Any]] = []
        self._workspace_tree_index: dict[str, QTreeWidgetItem] = {}
        self._workspace_tree_expanded_paths: set[str] = set()
        self._workspace_tree_root_item: QTreeWidgetItem | None = None
        self._workspace_diff_preview_text = ""
        self._workspace_indexers: dict[str, WorkspaceRepositoryIndexer] = {}
        self._workspace_replay_artifact_path_cache: Path | None = None
        self._workspace_replay_selected_line = 0
        self._workspace_replay_selected_event: dict[str, Any] | None = None
        self._workspace_replay_selection_map: dict[str, int] = {}
        self._workspace_trust_ledgers: dict[str, ulx.TrustLedger] = {}
        self._workspace_trust_selected_index = 0
        self._workspace_trust_selected_adapter_key = ""
        self._workspace_trust_selection_map: dict[str, int] = {}
        self._workspace_router_api_cache: dict[str, tuple[float, dict[str, Any]]] = {}
        self._coc_control_plane_api_cache: dict[str, tuple[float, dict[str, Any]]] = {}

        self._build_ui()
        restored = self._restore_state()
        self._workspace_ready = True
        self._sync_workspace_preview(self.workspace_combo.currentIndex(), auto_open=False)
        if not restored and not self.source_editor.toPlainText().strip():
            self._set_source(EXAMPLES["hello_governed_world.ulx"], mark_clean=True)
        self._set_isl_payload(ISL_SAMPLE)
        self.statusBar().showMessage("Ready")

    def _build_ui(self) -> None:
        self.source_editor = CodeEditor()
        self.isl_editor = CodeEditor()
        self.bytecode_view = ReadOnlyPane()
        self.output_view = ReadOnlyPane()
        self.audit_view = ReadOnlyPane()
        self.state_view = ReadOnlyPane()
        self.signal_view = ReadOnlyPane()
        self.validation_view = ReadOnlyPane()
        self._workspace_ready = False
        self._previous_workspace_key = self.workspace_key

        self.highlighter = ULXSyntaxHighlighter(self.source_editor.document())

        left_tabs = QTabWidget()
        left_tabs.addTab(self._wrap_editor(self.source_editor), "ULX Source")
        left_tabs.addTab(self._wrap_editor(self.isl_editor), "ISL Payload")

        right_tabs = QTabWidget()
        right_tabs.addTab(self.output_view, "Output")
        right_tabs.addTab(self.bytecode_view, "Bytecode")
        right_tabs.addTab(self.audit_view, "Audit")
        right_tabs.addTab(self.state_view, "Runtime")
        right_tabs.addTab(self.signal_view, "Signals")
        right_tabs.addTab(self.validation_view, "ISL Check")

        editor_splitter = QSplitter(Qt.Orientation.Horizontal)
        editor_splitter.addWidget(left_tabs)
        editor_splitter.addWidget(right_tabs)
        editor_splitter.setStretchFactor(0, 3)
        editor_splitter.setStretchFactor(1, 2)

        explorer = QWidget()
        explorer_layout = QVBoxLayout(explorer)
        explorer_layout.setContentsMargins(0, 0, 0, 0)
        explorer_layout.setSpacing(8)

        cards_widget = QWidget()
        cards_layout = QGridLayout(cards_widget)
        cards_layout.setContentsMargins(0, 0, 0, 0)
        cards_layout.setHorizontalSpacing(8)
        cards_layout.setVerticalSpacing(8)
        self.workspace_cards = {}
        card_specs = (
            ("root", 0, 0, 1, 1),
            ("git", 0, 1, 1, 1),
            ("entry", 1, 0, 1, 1),
            ("diff", 1, 1, 1, 1),
            ("router", 2, 0, 1, 2),
            ("aios", 3, 0, 1, 2),
        )
        for key, row, col, row_span, col_span in card_specs:
            card = QLabel()
            card.setWordWrap(True)
            card.setTextFormat(Qt.TextFormat.RichText)
            card.setAlignment(Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignTop)
            card.setMinimumHeight(72)
            card.setStyleSheet(
                "background: rgba(18, 20, 27, 0.92);"
                "border: 1px solid #262a38;"
                "border-radius: 10px;"
                "padding: 8px;"
                "color: #d9dce3;"
            )
            self.workspace_cards[key] = card
            cards_layout.addWidget(card, row, col, row_span, col_span)

        self.workspace_adapter_strip = QWidget()
        adapter_strip_layout = QGridLayout(self.workspace_adapter_strip)
        adapter_strip_layout.setContentsMargins(0, 0, 0, 0)
        adapter_strip_layout.setHorizontalSpacing(6)
        adapter_strip_layout.setVerticalSpacing(6)
        adapter_columns = 3
        for index, adapter in enumerate(self.workspace_adapters):
            button = QPushButton()
            button.setMinimumHeight(52)
            button.setMinimumWidth(180)
            button.setText(self._workspace_adapter_button_label(adapter))
            button.setToolTip(self._workspace_adapter_button_tooltip(adapter))
            button.clicked.connect(lambda _checked=False, adapter=adapter: self._open_workspace_adapter(adapter))
            self.workspace_adapter_buttons[adapter.key] = button
            adapter_strip_layout.addWidget(button, index // adapter_columns, index % adapter_columns)

        self.federation_module_strip = QWidget()
        module_strip_layout = QGridLayout(self.federation_module_strip)
        module_strip_layout.setContentsMargins(0, 0, 0, 0)
        module_strip_layout.setHorizontalSpacing(6)
        module_strip_layout.setVerticalSpacing(6)
        for index, module in enumerate(self.federation_modules):
            button = QPushButton()
            button.setCheckable(True)
            button.setMinimumHeight(52)
            button.setMinimumWidth(180)
            button.clicked.connect(lambda _checked=False, module=module: self._toggle_federation_module(module.key))
            self.federation_module_buttons[module.key] = button
            module_strip_layout.addWidget(button, index // adapter_columns, index % adapter_columns)
        self._refresh_federation_module_buttons()

        self.workspace_tree = QTreeWidget()
        self.workspace_tree.setHeaderLabels(["Workspace tree"])
        self.workspace_tree.setAlternatingRowColors(True)
        self.workspace_tree.currentItemChanged.connect(self._on_workspace_tree_current_changed)
        self.workspace_tree.itemExpanded.connect(self._on_workspace_tree_item_expanded)
        self.workspace_tree.itemCollapsed.connect(self._on_workspace_tree_item_collapsed)
        self.workspace_tree.itemDoubleClicked.connect(self._open_workspace_tree_item)
        self.workspace_tree.setStyleSheet(
            "QTreeWidget { background: rgba(12, 14, 20, 0.95); border: 1px solid #262a38; border-radius: 10px; }"
        )

        self.workspace_breadcrumb = QLabel("Current workspace file: (none)")
        self.workspace_breadcrumb.setWordWrap(True)
        self.workspace_breadcrumb.setTextFormat(Qt.TextFormat.RichText)
        self.workspace_breadcrumb.setTextInteractionFlags(Qt.TextInteractionFlag.TextBrowserInteraction)
        self.workspace_breadcrumb.setOpenExternalLinks(False)
        self.workspace_breadcrumb.linkActivated.connect(self._on_workspace_breadcrumb_activated)
        self.workspace_breadcrumb.linkHovered.connect(self._on_workspace_breadcrumb_hovered)
        self.workspace_breadcrumb.setStyleSheet(
            "background: rgba(18, 20, 27, 0.92);"
            "border: 1px solid #262a38;"
            "border-radius: 10px;"
            "padding: 8px;"
            "color: #d9dce3;"
        )

        self.workspace_diff_view = ReadOnlyPane()
        self.workspace_diff_view.setMinimumHeight(120)
        self.workspace_diff_view.setPlaceholderText("Selected file diff preview appears here.")
        self.workspace_diff_effect = QGraphicsDropShadowEffect(self.workspace_diff_view)
        self.workspace_diff_effect.setOffset(0, 0)
        self.workspace_diff_effect.setBlurRadius(0)
        self.workspace_diff_view.setGraphicsEffect(self.workspace_diff_effect)
        self.workspace_diff_animation = QPropertyAnimation(self.workspace_diff_effect, b"blurRadius", self)
        self.workspace_diff_animation.setEasingCurve(QEasingCurve.Type.InOutSine)
        self.workspace_diff_animation.setLoopCount(-1)
        self._apply_workspace_diff_focus(False)

        self.workspace_lineage_view = ReplayBrowserPane()
        self.workspace_lineage_view.setMinimumHeight(140)
        self.workspace_lineage_view.setPlaceholderText("Workspace lineage events appear here.")
        self.workspace_lineage_view.anchorClicked.connect(self._on_workspace_lineage_activated)

        self.workspace_trust_view = ReplayBrowserPane()
        self.workspace_trust_view.setMinimumHeight(170)
        self.workspace_trust_view.setPlaceholderText("Workspace trust revisions appear here.")
        self.workspace_trust_view.anchorClicked.connect(self._on_workspace_trust_activated)

        self.workspace_aios_replay_view = ReplayBrowserPane()
        self.workspace_aios_replay_view.setMinimumHeight(180)
        self.workspace_aios_replay_view.setPlaceholderText("AIOS replay timeline appears here.")
        self.workspace_aios_replay_view.anchorClicked.connect(self._on_workspace_aios_replay_activated)

        self.workspace_replay_artifact_view = ReplayBrowserPane()
        self.workspace_replay_artifact_view.setMinimumHeight(160)
        self.workspace_replay_artifact_view.anchorClicked.connect(self._on_workspace_replay_artifact_activated)

        self.workspace_readiness_view = ReplayBrowserPane()
        self.workspace_readiness_view.setMinimumHeight(200)

        self.workspace_merge_report_view = ReplayBrowserPane()
        self.workspace_merge_report_view.setMinimumHeight(200)

        self.coc_tabs = QTabWidget()
        self.coc_tabs.setDocumentMode(True)
        self.coc_panels: dict[str, ReplayBrowserPane] = {}
        coc_tab_specs = (
            ("event_stream", "Event Stream"),
            ("replay", "Replay"),
            ("governance", "Governance"),
            ("trust", "Trust"),
            ("nodes", "Nodes"),
            ("authority", "Authority"),
            ("continuity", "Continuity"),
            ("change_ledger", "Change Ledger"),
            ("knowledge", "UGR"),
            ("ugr_graph", "UGR Graph"),
            ("crf_player", "CRF Player"),
            ("clauses", "Clauses"),
            ("drift", "Drift"),
            ("graph", "Graph"),
        )
        for key, label in coc_tab_specs:
            if key == "ugr_graph":
                panel = ReplayBrowserPane()
                panel.setMinimumHeight(220)
                panel.anchorClicked.connect(self._on_coc_ugr_graph_activated)
                self.coc_panels[key] = panel
                self.coc_tabs.addTab(panel, label)
                continue
            if key == "crf_player":
                self.coc_crf_tab = QWidget()
                self.coc_crf_tab.setObjectName("coc-crf-player-tab")
                self.coc_crf_tab_layout = QVBoxLayout(self.coc_crf_tab)
                self.coc_crf_tab_layout.setContentsMargins(0, 0, 0, 0)
                self.coc_crf_tab_layout.setSpacing(6)

                crf_controls = QHBoxLayout()
                crf_controls.setSpacing(6)
                self.coc_crf_artifact_selector = QComboBox()
                self.coc_crf_artifact_selector.currentIndexChanged.connect(self._render_coc_tabs)
                self.coc_crf_change_selector = QComboBox()
                self.coc_crf_change_selector.currentIndexChanged.connect(self._render_coc_tabs)
                self.coc_crf_scrub = QSlider(Qt.Orientation.Horizontal)
                self.coc_crf_scrub.setMinimum(0)
                self.coc_crf_scrub.setMaximum(0)
                self.coc_crf_scrub.valueChanged.connect(self._render_coc_tabs)
                self.coc_crf_frame_label = QLabel("Frame 0/0")
                self.coc_crf_frame_label.setMinimumWidth(110)
                self.coc_crf_frame_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
                self.coc_crf_artifact_label = QLabel("Artifact: none")
                self.coc_crf_artifact_label.setStyleSheet("color: #94a3b8;")
                crf_controls.addWidget(QLabel("Artifact:"))
                crf_controls.addWidget(self.coc_crf_artifact_selector, 1)
                crf_controls.addWidget(QLabel("Change:"))
                crf_controls.addWidget(self.coc_crf_change_selector, 1)
                crf_controls.addWidget(QLabel("Scrub:"))
                crf_controls.addWidget(self.coc_crf_scrub, 2)
                crf_controls.addWidget(self.coc_crf_frame_label)
                crf_controls.addWidget(self.coc_crf_artifact_label, 1)
                self.coc_crf_browser = ReplayBrowserPane()
                self.coc_crf_browser.setMinimumHeight(220)
                self.coc_crf_tab_layout.addLayout(crf_controls)
                self.coc_crf_tab_layout.addWidget(self.coc_crf_browser, 1)
                self.coc_panels[key] = self.coc_crf_browser
                self.coc_tabs.addTab(self.coc_crf_tab, label)
                continue
            panel = ReplayBrowserPane()
            panel.setMinimumHeight(160)
            self.coc_panels[key] = panel
            self.coc_tabs.addTab(panel, label)

        explorer_layout.addWidget(cards_widget)
        explorer_layout.addWidget(self.workspace_adapter_strip)
        explorer_layout.addWidget(self.federation_module_strip)
        explorer_layout.addWidget(self.workspace_breadcrumb)
        explorer_layout.addWidget(self.workspace_tree, 3)
        explorer_layout.addWidget(self.workspace_diff_view, 1)
        explorer_layout.addWidget(self.workspace_trust_view, 1)
        explorer_layout.addWidget(self.workspace_lineage_view, 1)
        explorer_layout.addWidget(self.workspace_aios_replay_view, 1)
        explorer_layout.addWidget(self.workspace_replay_artifact_view, 1)
        explorer_layout.addWidget(self.workspace_readiness_view, 1)
        explorer_layout.addWidget(self.workspace_merge_report_view, 1)
        explorer_layout.addWidget(self.coc_tabs, 2)

        container = QWidget()
        layout = QVBoxLayout(container)
        layout.setContentsMargins(8, 8, 8, 8)
        layout.setSpacing(8)

        toolbar_row = QHBoxLayout()
        toolbar_row.setSpacing(6)
        self.example_combo = QComboBox()
        self.example_combo.addItems(list(EXAMPLES.keys()))
        self.example_combo.currentTextChanged.connect(self.load_example)
        self.path_label = QLabel("Untitled")
        self.path_label.setStyleSheet("color: #94a3b8;")
        toolbar_row.addWidget(QLabel("Example:"))
        toolbar_row.addWidget(self.example_combo, 0)
        toolbar_row.addWidget(self.path_label, 1)

        self.run_button = QPushButton("Run")
        self.run_button.clicked.connect(self.run_program)
        self.compile_button = QPushButton("Compile")
        self.compile_button.clicked.connect(self.compile_program)
        self.validate_button = QPushButton("Validate ISL")
        self.validate_button.clicked.connect(self.validate_isl)

        toolbar_row.addWidget(self.run_button)
        toolbar_row.addWidget(self.compile_button)
        toolbar_row.addWidget(self.validate_button)

        layout.addLayout(toolbar_row)

        workspace_row = QHBoxLayout()
        workspace_row.setSpacing(6)
        self.workspace_combo = QComboBox()
        self.workspace_combo.setMinimumWidth(250)
        self.workspace_combo.currentIndexChanged.connect(self._on_workspace_changed)
        self.workspace_connect_button = QPushButton("Connect workspace")
        self.workspace_connect_button.clicked.connect(self.open_selected_workspace)
        self.workspace_open_button = QPushButton("Open entry")
        self.workspace_open_button.clicked.connect(self.open_selected_workspace_entry)
        self.workspace_refresh_button = QPushButton("Refresh")
        self.workspace_refresh_button.clicked.connect(self.refresh_workspace_adapters)
        self.workspace_preview_merge_button = QPushButton("Preview merge")
        self.workspace_preview_merge_button.clicked.connect(self.preview_merge_substrates)
        self.workspace_merge_button = QPushButton("Merge all substrates")
        self.workspace_merge_button.clicked.connect(self.merge_all_substrates)
        self.workspace_status = QLabel("Workspace adapters loading...")
        self.workspace_status.setStyleSheet("color: #94a3b8;")
        self.workspace_router_endpoint = QLineEdit()
        self.workspace_router_endpoint.setMinimumWidth(240)
        self.workspace_router_endpoint.setPlaceholderText("Router X endpoint")
        self.workspace_router_endpoint.setText(self._workspace_router_api_base_url())
        self.workspace_router_endpoint.textChanged.connect(self._on_workspace_router_endpoint_changed)
        self.workspace_router_endpoint.returnPressed.connect(self._apply_workspace_router_endpoint)
        self.workspace_router_probe_timer = QTimer(self)
        self.workspace_router_probe_timer.setSingleShot(True)
        self.workspace_router_probe_timer.setInterval(350)
        self.workspace_router_probe_timer.timeout.connect(self._test_workspace_router_endpoint)
        self.workspace_router_test_button = QPushButton("Test connection")
        self.workspace_router_test_button.clicked.connect(self._test_workspace_router_endpoint)
        self.workspace_router_connection_state = QLabel("Not tested")
        self.workspace_router_connection_state.setMinimumWidth(120)
        self.workspace_router_connection_state.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._set_workspace_router_connection_state("Not tested", "#94a3b8")
        self.workspace_router_apply_button = QPushButton("Apply endpoint")
        self.workspace_router_apply_button.clicked.connect(self._apply_workspace_router_endpoint)
        self.coc_control_plane_endpoint = QLineEdit()
        self.coc_control_plane_endpoint.setMinimumWidth(260)
        self.coc_control_plane_endpoint.setPlaceholderText("COC control-plane endpoint")
        self.coc_control_plane_endpoint.setText(self._coc_control_plane_api_base_url())
        self.coc_control_plane_endpoint.textChanged.connect(self._on_coc_control_plane_endpoint_changed)
        self.coc_control_plane_endpoint.returnPressed.connect(self._apply_coc_control_plane_endpoint)
        self.coc_control_plane_probe_timer = QTimer(self)
        self.coc_control_plane_probe_timer.setSingleShot(True)
        self.coc_control_plane_probe_timer.setInterval(350)
        self.coc_control_plane_probe_timer.timeout.connect(self._test_coc_control_plane_endpoint)
        self.coc_control_plane_test_button = QPushButton("Test COC")
        self.coc_control_plane_test_button.clicked.connect(self._test_coc_control_plane_endpoint)
        self.coc_control_plane_connection_state = QLabel("Not tested")
        self.coc_control_plane_connection_state.setMinimumWidth(120)
        self.coc_control_plane_connection_state.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._set_coc_control_plane_connection_state("Not tested", "#94a3b8")
        self.coc_control_plane_apply_button = QPushButton("Apply COC")
        self.coc_control_plane_apply_button.clicked.connect(self._apply_coc_control_plane_endpoint)
        self.coc_ugql_query = QLineEdit()
        self.coc_ugql_query.setMinimumWidth(300)
        self.coc_ugql_query.setPlaceholderText("UGQL query for the UGR tab")
        self.coc_ugql_query.setText(self.settings.value(COC_UGQL_QUERY_KEY, "TRACE concept risk FROM lineage WITH INCLUDE worlds, docs, metrics LIMIT 12", type=str))
        self.coc_ugql_query.returnPressed.connect(self._execute_coc_ugql_query)
        self.coc_ugql_run_button = QPushButton("Run UGQL")
        self.coc_ugql_run_button.clicked.connect(self._execute_coc_ugql_query)
        self.coc_quick_open_button = QPushButton("Quick Open")
        self.coc_quick_open_button.clicked.connect(self._open_command_palette)
        self.coc_ugql_copy_button = QPushButton("Copy UGQL")
        self.coc_ugql_copy_button.clicked.connect(self._copy_coc_ugql_query)
        self.coc_ugql_save_button = QPushButton("Save query")
        self.coc_ugql_save_button.clicked.connect(self._save_coc_ugql_query)
        self.coc_ugql_status = QLabel("UGQL ready")
        self.coc_ugql_status.setMinimumWidth(100)
        self.coc_ugql_status.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.coc_refresh_timer = QTimer(self)
        self.coc_refresh_timer.setInterval(2500)
        self.coc_refresh_timer.timeout.connect(self._render_coc_tabs)
        self.coc_refresh_timer.start()
        self.workspace_readiness_timer = QTimer(self)
        self.workspace_readiness_timer.setInterval(2000)
        self.workspace_readiness_timer.timeout.connect(self._render_workspace_substrate_readiness)
        self.workspace_readiness_timer.start()
        self.workspace_merge_report_timer = QTimer(self)
        self.workspace_merge_report_timer.setInterval(2000)
        self.workspace_merge_report_timer.timeout.connect(self._render_workspace_merge_report)
        self.workspace_merge_report_timer.start()
        workspace_row.addWidget(QLabel("Workspace:"))
        workspace_row.addWidget(self.workspace_combo, 0)
        workspace_row.addWidget(self.workspace_connect_button)
        workspace_row.addWidget(self.workspace_open_button)
        workspace_row.addWidget(self.workspace_refresh_button)
        workspace_row.addWidget(self.workspace_preview_merge_button)
        workspace_row.addWidget(self.workspace_merge_button)
        workspace_row.addWidget(QLabel("Router X:"))
        workspace_row.addWidget(self.workspace_router_endpoint, 0)
        workspace_row.addWidget(self.workspace_router_test_button)
        workspace_row.addWidget(self.workspace_router_connection_state)
        workspace_row.addWidget(self.workspace_router_apply_button)
        workspace_row.addWidget(QLabel("COC:"))
        workspace_row.addWidget(self.coc_control_plane_endpoint, 0)
        workspace_row.addWidget(self.coc_control_plane_test_button)
        workspace_row.addWidget(self.coc_control_plane_connection_state)
        workspace_row.addWidget(self.coc_control_plane_apply_button)
        workspace_row.addWidget(QLabel("UGQL:"))
        workspace_row.addWidget(self.coc_ugql_query, 0)
        workspace_row.addWidget(self.coc_ugql_run_button)
        workspace_row.addWidget(self.coc_quick_open_button)
        workspace_row.addWidget(self.coc_ugql_copy_button)
        workspace_row.addWidget(self.coc_ugql_save_button)
        workspace_row.addWidget(self.coc_ugql_status)
        workspace_row.addWidget(self.workspace_status, 1)

        layout.addLayout(workspace_row)
        self.coc_tabs.currentChanged.connect(self._on_coc_tab_changed)

        workspace_splitter = QSplitter(Qt.Orientation.Horizontal)
        workspace_splitter.addWidget(explorer)
        workspace_splitter.addWidget(editor_splitter)
        workspace_splitter.setStretchFactor(0, 2)
        workspace_splitter.setStretchFactor(1, 5)

        layout.addWidget(workspace_splitter, 1)
        self.setCentralWidget(container)

        self._build_actions()
        self._build_menu()
        self._populate_workspace_combo()
        self._render_workspace_substrate_readiness()
        self._render_workspace_merge_report()

        self.source_editor.textChanged.connect(self._mark_dirty)

        self.setStatusBar(QStatusBar())
        self.statusBar().setFont(_fixed_font())
        self.statusBar().showMessage("Booted with bundled ULX runtime")

    def _wrap_editor(self, editor: QPlainTextEdit) -> QWidget:
        frame = QWidget()
        layout = QVBoxLayout(frame)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.addWidget(editor)
        return frame

    def _build_actions(self) -> None:
        self.action_new = QAction("New", self)
        self.action_new.setShortcut("Ctrl+N")
        self.action_new.triggered.connect(self.new_file)

        self.action_open = QAction("Open", self)
        self.action_open.setShortcut("Ctrl+O")
        self.action_open.triggered.connect(self.open_file)

        self.action_save = QAction("Save", self)
        self.action_save.setShortcut("Ctrl+S")
        self.action_save.triggered.connect(self.save_file)

        self.action_save_as = QAction("Save As", self)
        self.action_save_as.setShortcut("Ctrl+Shift+S")
        self.action_save_as.triggered.connect(self.save_file_as)

        self.action_run = QAction("Run", self)
        self.action_run.setShortcut("F5")
        self.action_run.triggered.connect(self.run_program)

        self.action_compile = QAction("Compile", self)
        self.action_compile.setShortcut("Ctrl+R")
        self.action_compile.triggered.connect(self.compile_program)

        self.action_quick_open = QAction("Quick Open", self)
        self.action_quick_open.setShortcut("Ctrl+P")
        self.action_quick_open.triggered.connect(self._open_command_palette)

        self.action_exit = QAction("Exit", self)
        self.action_exit.triggered.connect(self.close)

    def _build_menu(self) -> None:
        file_menu = self.menuBar().addMenu("File")
        file_menu.addAction(self.action_new)
        file_menu.addAction(self.action_open)
        file_menu.addAction(self.action_save)
        file_menu.addAction(self.action_save_as)
        file_menu.addSeparator()
        file_menu.addAction(self.action_exit)

        tools_menu = self.menuBar().addMenu("Tools")
        tools_menu.addAction(self.action_quick_open)
        tools_menu.addAction(self.action_run)
        tools_menu.addAction(self.action_compile)

        run_menu = self.menuBar().addMenu("Run")
        run_menu.addAction(self.action_run)
        run_menu.addAction(self.action_compile)

    def _populate_workspace_combo(self) -> None:
        self.workspace_combo.blockSignals(True)
        self.workspace_combo.clear()
        for adapter in self.workspace_adapters:
            status = "ready" if _workspace_exists(adapter) else "missing"
            label = f"{adapter.name} [{status}]"
            self.workspace_combo.addItem(label, adapter.key)
        index = self._workspace_index(self.workspace_key)
        if index < 0:
            index = 0
        self.workspace_combo.setCurrentIndex(index)
        self.workspace_combo.blockSignals(False)
        self._sync_workspace_preview(index, auto_open=False)

    def _workspace_index(self, workspace_key: str) -> int:
        for index, adapter in enumerate(self.workspace_adapters):
            if adapter.key == workspace_key:
                return index
        return -1

    def _selected_workspace_adapter(self) -> WorkspaceAdapter | None:
        index = self.workspace_combo.currentIndex()
        if index < 0 or index >= len(self.workspace_adapters):
            return None
        return self.workspace_adapters[index]

    def _workspace_indexer(self, adapter: WorkspaceAdapter | None) -> WorkspaceRepositoryIndexer:
        if adapter is None:
            adapter = self.workspace_adapters[0]
        indexer = self._workspace_indexers.get(adapter.key)
        if indexer is None:
            indexer = WorkspaceRepositoryIndexer(adapter)
            self._workspace_indexers[adapter.key] = indexer
        return indexer

    def _workspace_base_dir(self) -> Path:
        adapter = self._selected_workspace_adapter()
        return adapter.root if adapter and adapter.root.exists() else BASE_DIR

    def _workspace_summary(self, adapter: WorkspaceAdapter | None) -> str:
        if adapter is None:
            return "No workspace selected"
        exists = adapter.root.exists()
        entry = _adapter_entry_path(adapter)
        status_bits = ["ready" if exists else "missing"]
        if entry is not None:
            status_bits.append(f"entry: {entry.relative_to(adapter.root) if entry.is_relative_to(adapter.root) else entry.name}")
        else:
            status_bits.append("entry: unavailable")
        if exists and not _git_is_repo(adapter.root):
            status_bits.append("non-git")
        status_bits.append(adapter.description)
        return f"{adapter.name} | {' | '.join(status_bits)}"

    def _workspace_router_summary(self, adapter: WorkspaceAdapter | None, snapshot: dict[str, Any]) -> str:
        if adapter is None:
            return "No sovereign router surface selected."
        manifest_paths = [str(path) for path in snapshot.get("manifest_paths", []) if str(path).strip()]
        live_payload = self._workspace_router_live_evaluation(adapter, snapshot)
        router_refs: list[str] = []
        lower_root = str(adapter.root).lower()
        if lower_root.endswith(r"\project-infi") or lower_root.endswith("/project-infi"):
            router_refs.extend(
                [
                    "docs/crk1/release/CODEX_ROUTER_BRIDGE.md",
                    "docs/crk1/release/SOVEREIGN_ROUTER_X_PRODUCT_SPEC.md",
                    "docs/crk1/release/SOVEREIGN_ROUTER_X_PRICING.md",
                ]
            )
        if "sovereign-ide" in lower_root:
            router_refs.extend(
                [
                    "ui/shell/sovereign_ide_window.py",
                    "runtime/orchestrator.py",
                    "runtime/codex_loader.py",
                ]
            )
        manifest_hits = [
            path for path in manifest_paths
            if "routing" in path.lower()
            or "router" in path.lower()
            or "sovereign_ide_window.py" in path
            or "codex_loader.py" in path
        ]
        evidence = router_refs + manifest_hits
        if not evidence:
            evidence.append("No Router X artifacts detected in this workspace.")
        header = "Sovereign Router X connected." if any("router" in item.lower() for item in evidence) else "Router-aware workspace detected."
        lines = [header]
        if live_payload is not None:
            route_eval = live_payload.get("routeEvaluation", {})
            lines.append(
                "Live API: "
                f"{live_payload.get('selectedModel', 'n/a')} | "
                f"decision={live_payload.get('modelDecision', 'n/a')} | "
                f"total={float(live_payload.get('total', 0.0)):.3f} | "
                f"blocked={str(bool(live_payload.get('blocked'))).lower()}"
            )
            lines.append(
                "Route eval: "
                f"gov={float(route_eval.get('governance', 0.0)):.3f} | "
                f"cost={float(route_eval.get('cost', 0.0)):.3f} | "
                f"perf={float(route_eval.get('performance', 0.0)):.3f} | "
                f"trust={float(route_eval.get('trust', 0.0)):.3f}"
            )
            if live_payload.get("reason"):
                lines.append(f"Reason: {live_payload.get('reason')}")
        lines.extend(evidence[:4])
        return "\n".join(lines)

    def _workspace_router_api_base_url(self) -> str:
        value = self.settings.value(WORKSPACE_ROUTER_API_BASE_KEY, "", type=str).strip()
        return value or "http://127.0.0.1:8787"

    def _set_workspace_router_connection_state(self, text: str, color: str) -> None:
        self.workspace_router_connection_state.setText(text)
        self.workspace_router_connection_state.setStyleSheet(
            f"color: {color}; border: 1px solid {color}; border-radius: 8px; padding: 2px 8px;"
        )

    def _on_workspace_router_endpoint_changed(self, *_args: Any) -> None:
        endpoint = self.workspace_router_endpoint.text().strip()
        if not endpoint:
            self.workspace_router_probe_timer.stop()
            self._set_workspace_router_connection_state("Missing", "#f87171")
            return
        self._set_workspace_router_connection_state("Checking...", "#fbbf24")
        self.workspace_router_probe_timer.start()

    def _probe_workspace_router_endpoint(self, endpoint: str, timeout_seconds: float = 1.0) -> tuple[bool, str]:
        endpoint = endpoint.strip().rstrip("/")
        if not endpoint:
            return False, "empty endpoint"
        request = urllib.request.Request(f"{endpoint}/health", method="GET")
        try:
            with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
                raw = response.read().decode(DEFAULT_ENCODING)
            data = json.loads(raw)
            if isinstance(data, dict) and data:
                return True, "reachable"
            return True, "reachable"
        except Exception as exc:  # pragma: no cover - UI probe
            return False, str(exc)

    def _test_workspace_router_endpoint(self) -> None:
        endpoint = self.workspace_router_endpoint.text().strip()
        if not endpoint:
            self._set_workspace_router_connection_state("Missing", "#f87171")
            self._set_status("Router X endpoint is empty")
            return
        ok, reason = self._probe_workspace_router_endpoint(endpoint)
        if ok:
            self._set_workspace_router_connection_state("Reachable", "#4ade80")
            self._set_status(f"Router X reachable at {endpoint}")
        else:
            self._set_workspace_router_connection_state("Unreachable", "#f87171")
            self._set_status(f"Router X unreachable: {reason}")

    def _apply_workspace_router_endpoint(self) -> None:
        endpoint = self.workspace_router_endpoint.text().strip()
        if not endpoint:
            endpoint = "http://127.0.0.1:8787"
            self.workspace_router_endpoint.setText(endpoint)
        self.workspace_router_probe_timer.stop()
        self.settings.setValue(WORKSPACE_ROUTER_API_BASE_KEY, endpoint)
        self._workspace_router_api_cache.clear()
        self._test_workspace_router_endpoint()
        adapter = self._selected_workspace_adapter()
        if adapter is not None:
            snapshot = self._collect_workspace_metadata(adapter)
            self.workspace_cards["router"].setText(
                f"<div style='font-size:10px; letter-spacing:0.08em; text-transform:uppercase; color:#94a3b8;'>Sovereign Router X</div>"
                f"<div style='margin-top:4px; font-size:12px; white-space:pre-wrap; color:#e2e8f0;'>"
                f"{html_escape(self._workspace_router_summary(adapter, snapshot))}"
                "</div>"
            )
            self._render_workspace_event_log()

    def _workspace_router_live_evaluation(
        self,
        adapter: WorkspaceAdapter,
        snapshot: dict[str, Any],
        *,
        timeout_seconds: float = 1.0,
        cache_ttl_seconds: float = 5.0,
    ) -> dict[str, Any] | None:
        base_url = self._workspace_router_api_base_url().rstrip("/")
        cache_key = adapter.key
        cached = self._workspace_router_api_cache.get(cache_key)
        now = datetime.now(timezone.utc).timestamp()
        if cached is not None:
            cached_at, payload = cached
            if now - cached_at <= cache_ttl_seconds:
                return payload
        if not base_url:
            return None
        entry = snapshot.get("entry")
        prompt = "\n".join(
            [
                f"workspace={adapter.name}",
                f"root={adapter.root}",
                f"entry={entry if entry is not None else ''}",
                f"git_branch={snapshot.get('git_branch', '')}",
                f"git_dirty={snapshot.get('git_dirty', False)}",
                f"manifest_count={len(snapshot.get('manifest_paths', []))}",
                f"recent_changes={len(snapshot.get('recent_changes', []))}",
            ]
        )
        payload = {
            "requestId": f"ulx-{adapter.key}",
            "prompt": prompt,
            "routeClass": "replay" if "sovereign-ide" in adapter.key else "standard",
            "bias": "governance" if snapshot.get("is_git") else "balanced",
            "evidenceIds": [
                str(snapshot.get("index_path", "")),
                str(snapshot.get("replay_path", "")),
                str(entry) if entry is not None else "",
                *[str(path) for path in snapshot.get("manifest_paths", [])[:4]],
            ],
        }
        request = urllib.request.Request(
            f"{base_url}/api/router/evaluate",
            data=json.dumps(payload, sort_keys=True).encode(DEFAULT_ENCODING),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
                raw = response.read().decode(DEFAULT_ENCODING)
            decoded = json.loads(raw)
            if isinstance(decoded, dict):
                self._workspace_router_api_cache[cache_key] = (now, decoded)
                return decoded
        except (urllib.error.URLError, TimeoutError, ValueError, json.JSONDecodeError, OSError):
            return None
        return None

    def _coc_control_plane_api_base_url(self) -> str:
        value = self.settings.value(COC_CONTROL_PLANE_API_BASE_KEY, "", type=str).strip()
        return value or "http://127.0.0.1:4110"

    def _set_coc_control_plane_connection_state(self, text: str, color: str) -> None:
        self.coc_control_plane_connection_state.setText(text)
        self.coc_control_plane_connection_state.setStyleSheet(
            f"color: {color}; border: 1px solid {color}; border-radius: 8px; padding: 2px 8px;"
        )

    def _on_coc_control_plane_endpoint_changed(self, *_args: Any) -> None:
        endpoint = self.coc_control_plane_endpoint.text().strip()
        if not endpoint:
            self.coc_control_plane_probe_timer.stop()
            self._set_coc_control_plane_connection_state("Missing", "#f87171")
            return
        self._set_coc_control_plane_connection_state("Checking...", "#fbbf24")
        self.coc_control_plane_probe_timer.start()

    def _probe_coc_control_plane_endpoint(self, endpoint: str, timeout_seconds: float = 1.0) -> tuple[bool, str]:
        endpoint = endpoint.strip().rstrip("/")
        if not endpoint:
            return False, "empty endpoint"
        request = urllib.request.Request(f"{endpoint}/health", method="GET")
        try:
            with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
                raw = response.read().decode(DEFAULT_ENCODING)
            data = json.loads(raw)
            if isinstance(data, dict) and data:
                return True, "reachable"
            return True, "reachable"
        except Exception as exc:  # pragma: no cover - UI probe
            return False, str(exc)

    def _test_coc_control_plane_endpoint(self) -> None:
        endpoint = self.coc_control_plane_endpoint.text().strip()
        if not endpoint:
            self._set_coc_control_plane_connection_state("Missing", "#f87171")
            self._set_status("COC endpoint is empty")
            return
        ok, reason = self._probe_coc_control_plane_endpoint(endpoint)
        if ok:
            self._set_coc_control_plane_connection_state("Reachable", "#4ade80")
            self._set_status(f"COC reachable at {endpoint}")
            self._render_coc_tabs()
        else:
            self._set_coc_control_plane_connection_state("Unreachable", "#f87171")
            self._set_status(f"COC unreachable: {reason}")

    def _apply_coc_control_plane_endpoint(self) -> None:
        endpoint = self.coc_control_plane_endpoint.text().strip()
        if not endpoint:
            endpoint = "http://127.0.0.1:4110"
            self.coc_control_plane_endpoint.setText(endpoint)
        self.coc_control_plane_probe_timer.stop()
        self.settings.setValue(COC_CONTROL_PLANE_API_BASE_KEY, endpoint)
        self._coc_control_plane_api_cache.clear()
        self._test_coc_control_plane_endpoint()
        self._render_coc_tabs()

    def _fetch_coc_control_plane_json(
        self,
        path: str,
        *,
        timeout_seconds: float = 1.0,
        cache_ttl_seconds: float = 5.0,
        cache_key: str | None = None,
    ) -> dict[str, Any] | list[Any] | None:
        base_url = self._coc_control_plane_api_base_url().rstrip("/")
        key = cache_key or path
        cached = self._coc_control_plane_api_cache.get(key)
        now = datetime.now(timezone.utc).timestamp()
        if cached is not None:
            cached_at, payload = cached
            if now - cached_at <= cache_ttl_seconds:
                return payload
        if not base_url:
            return None
        request = urllib.request.Request(f"{base_url}{path}", method="GET")
        try:
            with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
                raw = response.read().decode(DEFAULT_ENCODING)
            decoded = json.loads(raw)
            if isinstance(decoded, (dict, list)):
                self._coc_control_plane_api_cache[key] = (now, decoded)
                return decoded
        except (urllib.error.URLError, TimeoutError, ValueError, json.JSONDecodeError, OSError):
            return None
        return None

    def _execute_coc_ugql_query(self) -> None:
        query = self.coc_ugql_query.text().strip()
        if not query:
            query = "TRACE concept risk FROM lineage WITH INCLUDE worlds, docs, metrics LIMIT 12"
            self.coc_ugql_query.setText(query)
        self.settings.setValue(COC_UGQL_QUERY_KEY, query)
        encoded_query = quote(query, safe="")
        result = self._fetch_coc_control_plane_json(f"/ugr/query?ugql={encoded_query}", cache_key=f"ugr-query:{query}")
        if not isinstance(result, dict):
            self.coc_ugql_status.setText("UGQL failed")
            self.coc_ugql_status.setStyleSheet("color: #f87171; border: 1px solid #f87171; border-radius: 8px; padding: 2px 8px;")
            return
        self.coc_ugql_status.setText("UGQL loaded")
        self.coc_ugql_status.setStyleSheet("color: #4ade80; border: 1px solid #4ade80; border-radius: 8px; padding: 2px 8px;")
        self._render_coc_tabs()

    def _copy_coc_ugql_query(self) -> None:
        query = self.coc_ugql_query.text().strip()
        if not query:
            query = "TRACE concept risk FROM lineage WITH INCLUDE worlds, docs, metrics LIMIT 12"
            self.coc_ugql_query.setText(query)
        QApplication.clipboard().setText(query)
        self.coc_ugql_status.setText("UGQL copied")
        self.coc_ugql_status.setStyleSheet("color: #8cc3ff; border: 1px solid #8cc3ff; border-radius: 8px; padding: 2px 8px;")

    def _save_coc_ugql_query(self) -> None:
        query = self.coc_ugql_query.text().strip()
        if not query:
            query = "TRACE concept risk FROM lineage WITH INCLUDE worlds, docs, metrics LIMIT 12"
            self.coc_ugql_query.setText(query)
        self.settings.setValue(COC_UGQL_QUERY_KEY, query)
        self.coc_ugql_status.setText("UGQL saved")
        self.coc_ugql_status.setStyleSheet("color: #4ade80; border: 1px solid #4ade80; border-radius: 8px; padding: 2px 8px;")

    def _on_coc_tab_changed(self, index: int) -> None:
        self.settings.setValue(COC_ACTIVE_TAB_KEY, int(index))
        if index < 0 or index >= self.coc_tabs.count():
            return
        if not hasattr(self, "coc_ugql_status"):
            return
        tab_label = self.coc_tabs.tabText(index)
        self.coc_ugql_status.setText(f"Viewing {tab_label}")
        self.coc_ugql_status.setStyleSheet("color: #8cc3ff; border: 1px solid #8cc3ff; border-radius: 8px; padding: 2px 8px;")
        self._render_coc_tabs()

    def _toggle_federation_module(self, module_key: str) -> None:
        if module_key in self._enabled_federation_module_keys:
            self._enabled_federation_module_keys.discard(module_key)
        else:
            self._enabled_federation_module_keys.add(module_key)
        self.settings.setValue(FEDERATION_MODULES_ENABLED_KEY, json.dumps(sorted(self._enabled_federation_module_keys)))
        self._refresh_federation_module_buttons()
        self._render_coc_tabs()

    def _refresh_federation_module_buttons(self) -> None:
        for module in self.federation_modules:
            button = self.federation_module_buttons.get(module.key)
            if button is None:
                continue
            enabled = module.key in self._enabled_federation_module_keys
            state = "Unload" if enabled else "Load"
            button.setText(f"{state} {module.title}")
            button.setToolTip(f"{module.summary}\nState: {'enabled' if enabled else 'disabled'}")
            button.setChecked(enabled)
            button.setStyleSheet(
                "background: rgba(18, 20, 27, 0.92);"
                f"border: 1px solid {'#4ade80' if enabled else '#52525b'};"
                "border-radius: 10px;"
                "padding: 8px;"
                f"color: {'#d9dce3' if enabled else '#94a3b8'};"
            )

    def _workspace_global_search_results(self, query: str, limit: int = 24) -> list[dict[str, Any]]:
        normalized = query.strip().lower()
        if not normalized:
            return []
        results: list[dict[str, Any]] = []
        for adapter in self.workspace_adapters:
            if len(results) >= limit:
                break
            if normalized in adapter.name.lower() or normalized in adapter.key.lower() or normalized in adapter.description.lower():
                entry = _adapter_entry_path(adapter)
                results.append(
                    {
                        "kind": "adapter",
                        "label": adapter.name,
                        "detail": adapter.description,
                        "adapter_key": adapter.key,
                        "path": str(entry) if entry is not None else "",
                    }
                )
            indexer = self._workspace_indexer(adapter)
            for match in indexer.search(query, limit=max(1, limit - len(results))):
                results.append(
                    {
                        "kind": "file",
                        "label": f"{match['adapter_name']} :: {match['label']}",
                        "detail": match.get("preview", ""),
                        "adapter_key": match["adapter"],
                        "path": match["path"],
                    }
                )
                if len(results) >= limit:
                    break
        return results[:limit]

    def _command_palette_fuzzy_score(self, query: str, text: str) -> float:
        normalized_query = query.strip().lower()
        normalized_text = text.strip().lower()
        if not normalized_query:
            return 0.0
        if normalized_query == normalized_text:
            return 3.0
        if normalized_query in normalized_text:
            score = 2.0 + (len(normalized_query) / max(len(normalized_text), 1))
            if normalized_text.startswith(normalized_query):
                score += 0.5
            return score
        score = SequenceMatcher(None, normalized_query, normalized_text).ratio()
        query_tokens = [token for token in normalized_query.split() if token]
        if query_tokens and all(token in normalized_text for token in query_tokens):
            score += 0.25
        return score

    def _command_palette_entries(self, query: str, limit: int = 64) -> list[dict[str, Any]]:
        normalized = query.strip()
        commands = [
            {
                "kind": "command",
                "command_id": "open_selected_workspace",
                "label": "Open selected workspace entry",
                "detail": "Activate the current adapter's best file.",
            },
            {
                "kind": "command",
                "command_id": "refresh_coc",
                "label": "Refresh COC views",
                "detail": "Reload live COC panels from the control plane.",
            },
            {
                "kind": "command",
                "command_id": "run_ugql",
                "label": "Run current UGQL query",
                "detail": "Execute the active UGR query box value.",
            },
            {
                "kind": "command",
                "command_id": "copy_ugql",
                "label": "Copy UGQL query",
                "detail": "Copy the active UGQL text to the clipboard.",
            },
            {
                "kind": "command",
                "command_id": "save_ugql",
                "label": "Save UGQL query",
                "detail": "Persist the active UGQL text in settings.",
            },
        ]
        entries: list[dict[str, Any]] = []
        for payload in commands:
            label = str(payload.get("label", ""))
            detail = str(payload.get("detail", ""))
            score = self._command_palette_fuzzy_score(normalized, f"{label} {detail}")
            if normalized and score <= 0.0:
                continue
            entries.append(
                {
                    **payload,
                    "score": score,
                    "kind_order": 0,
                }
            )
        if hasattr(self, "coc_tabs"):
            for index in range(self.coc_tabs.count()):
                tab_label = self.coc_tabs.tabText(index)
                detail = f"Jump to COC surface: {tab_label}"
                score = self._command_palette_fuzzy_score(normalized, f"{tab_label} {detail}")
                if normalized and score <= 0.0:
                    continue
                entries.append(
                    {
                        "kind": "coc-tab",
                        "label": f"Jump to tab: {tab_label}",
                        "detail": detail,
                        "tab_index": index,
                        "score": score,
                        "kind_order": 1,
                    }
                )
        for adapter in self.workspace_adapters:
            entry_path = _adapter_entry_path(adapter)
            detail = adapter.description
            label = adapter.name
            score = self._command_palette_fuzzy_score(normalized, f"{label} {adapter.key} {detail}")
            if normalized and score <= 0.0:
                continue
            entries.append(
                {
                    "kind": "adapter",
                    "label": label,
                    "detail": detail,
                    "adapter_key": adapter.key,
                    "path": str(entry_path) if entry_path is not None else "",
                    "score": score,
                    "kind_order": 2,
                }
            )
        if normalized:
            for payload in self._workspace_global_search_results(normalized, limit=24):
                label = str(payload.get("label", ""))
                detail = str(payload.get("detail", ""))
                path = str(payload.get("path", ""))
                score = self._command_palette_fuzzy_score(normalized, f"{label} {detail} {path}")
                if score <= 0.0:
                    continue
                entries.append(
                    {
                        **payload,
                        "score": score,
                        "kind_order": 3,
                    }
                )
        seen: set[tuple[str, str, str]] = set()
        deduped: list[dict[str, Any]] = []
        for payload in entries:
            key = (
                str(payload.get("kind", "")),
                str(payload.get("label", "")),
                str(payload.get("path", "")),
            )
            if key in seen:
                continue
            seen.add(key)
            deduped.append(payload)
        deduped.sort(
            key=lambda payload: (
                -float(payload.get("score", 0.0)),
                int(payload.get("kind_order", 99)),
                str(payload.get("label", "")).lower(),
                str(payload.get("detail", "")).lower(),
            )
        )
        return deduped[:limit]

    def _run_command_palette_action(self, payload: dict[str, Any]) -> None:
        kind = str(payload.get("kind", ""))
        if kind == "adapter":
            adapter_key = str(payload.get("adapter_key", ""))
            adapter = next((item for item in self.workspace_adapters if item.key == adapter_key), None)
            if adapter is not None:
                self._open_workspace_adapter(adapter)
            return
        if kind == "coc-tab":
            tab_index = int(payload.get("tab_index", -1))
            if hasattr(self, "coc_tabs") and 0 <= tab_index < self.coc_tabs.count():
                self.coc_tabs.setCurrentIndex(tab_index)
                self._render_coc_tabs()
            return
        if kind == "file":
            path_text = str(payload.get("path", ""))
            if path_text:
                candidate = Path(path_text)
                if candidate.exists():
                    if not self._confirm_discard():
                        return
                    self.load_path(candidate)
                    self._set_status(f"Quick opened {candidate}")
            return
        if kind == "command":
            command_id = str(payload.get("command_id", ""))
            if command_id == "run_ugql":
                self._execute_coc_ugql_query()
            elif command_id == "copy_ugql":
                self._copy_coc_ugql_query()
            elif command_id == "save_ugql":
                self._save_coc_ugql_query()
            elif command_id == "refresh_coc":
                self._render_coc_tabs()
            elif command_id == "open_selected_workspace":
                adapter = self._selected_workspace_adapter()
                if adapter is not None:
                    self._open_workspace_adapter(adapter)

    def _open_command_palette(self) -> None:
        dialog = QDialog(self)
        dialog.setWindowTitle("ULX Command Palette")
        dialog.resize(780, 560)
        layout = QVBoxLayout(dialog)
        layout.setContentsMargins(12, 12, 12, 12)
        layout.setSpacing(8)

        query_edit = QLineEdit()
        query_edit.setPlaceholderText("Search commands, adapters, files, and UGR surfaces")
        layout.addWidget(query_edit)

        result_list = QListWidget()
        result_list.setUniformItemSizes(True)
        layout.addWidget(result_list, 1)

        buttons = QDialogButtonBox(QDialogButtonBox.StandardButton.Close)
        buttons.rejected.connect(dialog.reject)
        layout.addWidget(buttons)

        def populate() -> None:
            result_list.clear()
            query = query_edit.text().strip()
            items = self._command_palette_entries(query, limit=64)
            for payload in items:
                label = str(payload.get("label", ""))
                detail = str(payload.get("detail", ""))
                score = float(payload.get("score", 0.0))
                item = QListWidgetItem(f"{label}\n{detail}".strip())
                item.setToolTip(f"{label}\n{detail}\nScore: {score:.3f}")
                item.setData(Qt.ItemDataRole.UserRole, payload)
                result_list.addItem(item)
            if result_list.count() > 0:
                result_list.setCurrentRow(0)

        def accept_current() -> None:
            current = result_list.currentItem()
            if current is None:
                return
            payload = current.data(Qt.ItemDataRole.UserRole)
            if isinstance(payload, dict):
                self._run_command_palette_action(payload)
                dialog.accept()

        class CommandPaletteEventFilter(QObject):
            def __init__(self, owner: "ULXIDEWindow", query_widget: QLineEdit, list_widget: QListWidget) -> None:
                super().__init__(owner)
                self._owner = owner
                self._query_widget = query_widget
                self._list_widget = list_widget

            def eventFilter(self, watched: QObject, event: QEvent) -> bool:  # type: ignore[override]
                if event.type() != QEvent.Type.KeyPress:
                    return False
                key = event.key()
                if watched is self._query_widget:
                    if key in (Qt.Key.Key_Down, Qt.Key.Key_Tab):
                        if self._list_widget.count() > 0:
                            self._list_widget.setFocus()
                            if self._list_widget.currentRow() < 0:
                                self._list_widget.setCurrentRow(0)
                            return True
                    if key in (Qt.Key.Key_Up, Qt.Key.Key_Backtab) and self._list_widget.count() > 0:
                        self._list_widget.setFocus()
                        self._list_widget.setCurrentRow(max(self._list_widget.count() - 1, 0))
                        return True
                    if key in (Qt.Key.Key_Return, Qt.Key.Key_Enter):
                        accept_current()
                        return True
                if watched is self._list_widget:
                    current_row = self._list_widget.currentRow()
                    if key in (Qt.Key.Key_Up, Qt.Key.Key_Backtab) and current_row <= 0:
                        self._query_widget.setFocus()
                        self._query_widget.selectAll()
                        return True
                    if key in (Qt.Key.Key_Return, Qt.Key.Key_Enter):
                        accept_current()
                        return True
                return False

        palette_filter = CommandPaletteEventFilter(self, query_edit, result_list)
        dialog._command_palette_filter = palette_filter  # type: ignore[attr-defined]
        query_edit.installEventFilter(palette_filter)
        result_list.installEventFilter(palette_filter)

        query_edit.textChanged.connect(lambda _: populate())
        result_list.itemActivated.connect(lambda _item: accept_current())
        query_edit.returnPressed.connect(accept_current)
        populate()
        query_edit.setFocus()
        dialog.exec()

    def _workspace_adapter_button_label(self, adapter: WorkspaceAdapter) -> str:
        entry = _adapter_entry_path(adapter)
        entry_label = self._path_label(entry) if entry is not None else "(no best file)"
        return f"{adapter.name}\n{entry_label}"

    def _workspace_adapter_button_tooltip(self, adapter: WorkspaceAdapter) -> str:
        entry = _adapter_entry_path(adapter)
        entry_label = self._path_label(entry) if entry is not None else "(no best file)"
        return f"Open {adapter.name} best file\n{entry_label}"

    def _open_workspace_adapter(self, adapter: WorkspaceAdapter) -> None:
        if adapter.root.exists():
            if not self._confirm_discard():
                return
            self._previous_workspace_key = adapter.key
            self.workspace_key = adapter.key
            self.settings.setValue("last_workspace", adapter.key)
            index = self._workspace_index(adapter.key)
            if index >= 0 and self.workspace_combo.currentIndex() != index:
                self.workspace_combo.blockSignals(True)
                self.workspace_combo.setCurrentIndex(index)
                self.workspace_combo.blockSignals(False)
            self._open_workspace_entry(adapter)
            self._record_workspace_event("workspace.activate", adapter.root, adapter, "adapter-button")
            self._set_status(f"Opened workspace: {adapter.name}")
            return
        QMessageBox.warning(self, APP_NAME, f"Workspace root does not exist:\n{adapter.root}")

    def _on_coc_ugr_graph_activated(self, link: QUrl | str) -> None:
        raw = link.toString() if isinstance(link, QUrl) else str(link)
        if not raw.startswith("workspace:"):
            return
        target = Path(unquote(raw.removeprefix("workspace:")))
        if not target.exists():
            self._set_status("UGR graph target no longer exists")
            return
        adapter = self._adapter_for_path(target) or self._selected_workspace_adapter()
        if target.is_file():
            if not self._confirm_discard():
                return
            self.load_path(target)
            self._record_workspace_event("ugr.graph.open", target, adapter, "graph-link")
            return
        self._sync_current_file_context(target, adapter)
        self._record_workspace_event("ugr.graph.open", target, adapter, "graph-link")

    def _workspace_federation_graph_html(self, adapter: WorkspaceAdapter | None, snapshot: dict[str, Any] | None = None) -> str:
        snapshot = snapshot or (self._collect_workspace_metadata(adapter) if adapter is not None else {})
        selected_root = adapter.root if adapter is not None else None
        modules = self.federation_modules
        adapter_by_key = {workspace_adapter.key: workspace_adapter for workspace_adapter in self.workspace_adapters}

        def node_card(title: str, subtitle: str, body: list[str], link: str | None = None, accent: str = "#8cc3ff") -> str:
            action = f"<div style='margin-top:8px;'><a href='{html_escape(link)}' style='color:{accent}; text-decoration:none;'>Open best file</a></div>" if link else ""
            return (
                "<div style='background: rgba(18, 20, 27, 0.96); border: 1px solid #262a38; border-radius: 12px; padding: 10px; min-height: 120px;'>"
                f"<div style='color:{accent}; font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase;'>{html_escape(title)}</div>"
                f"<div style='margin-top: 4px; color: #e2e8f0; font-weight: 700;'>{html_escape(subtitle)}</div>"
                f"<div style='margin-top: 8px; color: #cbd5e1; white-space: pre-wrap;'>{html_escape(chr(10).join(body))}</div>"
                f"{action}"
                "</div>"
            )

        hub_card = node_card(
            "UGR hub",
            "Unified substrate",
            [
                f"Adapters: {len(self.workspace_adapters)}",
                f"Selected root: {self._path_label(selected_root) if selected_root is not None else '(none)'}",
                f"Snapshot entries: {int(snapshot.get('file_count', 0)) if isinstance(snapshot, dict) else 0}",
            ],
            accent="#4ade80",
        )

        module_cards: list[str] = []
        for module in modules:
            adapter_ref = adapter_by_key.get(module.adapter_key)
            module_root = adapter_ref.root if adapter_ref is not None else None
            best_entry = module.best_entry(module_root) if module_root is not None else None
            module_cards.append(
                node_card(
                    module.title,
                    module.adapter_key,
                    [
                        module.summary,
                        f"Surfaces: {', '.join(module.surfaces)}",
                        f"Entry: {self._path_label(best_entry) if best_entry is not None else '(missing)'}",
                    ],
                    link=f"workspace:{quote(str(best_entry), safe='')}" if best_entry is not None else None,
                    accent="#8b5cf6",
                )
            )

        adapter_cards: list[str] = []
        relationship_lines: list[str] = []
        for workspace_adapter in self.workspace_adapters:
            entry_path = _adapter_entry_path(workspace_adapter)
            if entry_path is not None:
                link = f"workspace:{quote(str(entry_path), safe='')}"
            else:
                link = None
            adapter_cards.append(
                node_card(
                    workspace_adapter.name,
                    workspace_adapter.key,
                    [
                        workspace_adapter.description,
                        f"Root: {self._path_label(workspace_adapter.root)}",
                        f"Best file: {self._path_label(entry_path) if entry_path is not None else '(missing)'}",
                    ],
                    link=link,
                    accent="#38bdf8",
                )
            )
            if workspace_adapter.root.exists():
                if workspace_adapter.root == Path(r"E:\project-infi"):
                    relationship_lines.append(f"UGR -> {workspace_adapter.name} (catalog root)")
                elif str(workspace_adapter.root).startswith(r"E:\project-infi"):
                    relationship_lines.append(f"Project Infi -> {workspace_adapter.name} (nested federated surface)")
                elif str(workspace_adapter.root).startswith(r"E:\Project-Infinity-main"):
                    relationship_lines.append(f"Project Infinity Main -> {workspace_adapter.name} (legacy adapter surface)")
                else:
                    relationship_lines.append(f"UGR -> {workspace_adapter.name} (external checkout)")

        module_relationships = []
        for module in modules:
            module_relationships.append(f"{module.title} -> {module.adapter_key} ({'; '.join(module.relationship_notes)})")

        lines = [
            "<div style='font-family: monospace; color: #d9dce3; background: rgba(12, 14, 20, 0.95); border: 1px solid #262a38; border-radius: 10px; padding: 10px;'>",
            "<div style='color: #8cc3ff; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;'>UGR Federation Graph</div>",
            "<div style='color: #94a3b8; margin-top: 2px;'>Adapter-to-adapter relationships and explicit federated modules</div>",
            "<div style='margin-top: 12px; display: grid; grid-template-columns: 1fr; gap: 10px;'>",
            hub_card,
            "</div>",
            "<div style='margin-top: 12px; color: #94a3b8; letter-spacing: 0.08em; text-transform: uppercase;'>Explicit modules</div>",
            "<div style='margin-top: 8px; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px;'>",
            *module_cards,
            "</div>",
            "<div style='margin-top: 12px; color: #94a3b8; letter-spacing: 0.08em; text-transform: uppercase;'>Adapters</div>",
            "<div style='margin-top: 8px; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px;'>",
            *adapter_cards,
            "</div>",
            "<div style='margin-top: 12px; color: #94a3b8; letter-spacing: 0.08em; text-transform: uppercase;'>Relationships</div>",
            "<pre style='white-space: pre-wrap; margin: 8px 0 0 0;'>",
            html_escape("\n".join(module_relationships + relationship_lines) or "(no relationships available)"),
            "</pre>",
            "</div>",
        ]
        return "".join(lines)

    def _coc_crf_timeline_index_for_change(self, artifact: dict[str, Any], replay_change: dict[str, Any] | None) -> int:
        timeline = artifact.get("timeline", [])
        if not isinstance(timeline, list) or not timeline:
            return 0
        change_timestamp = ""
        if isinstance(replay_change, dict):
            change_timestamp = str(replay_change.get("timestamp", "")).strip()
        if not change_timestamp:
            return 0
        try:
            change_dt = datetime.fromisoformat(change_timestamp.replace("Z", "+00:00"))
        except ValueError:
            return 0
        best_index = 0
        best_delta: float | None = None
        for index, frame in enumerate(timeline):
            if not isinstance(frame, dict):
                continue
            frame_timestamp = str(frame.get("timestamp", "")).strip()
            if not frame_timestamp:
                continue
            try:
                frame_dt = datetime.fromisoformat(frame_timestamp.replace("Z", "+00:00"))
            except ValueError:
                continue
            delta = abs((frame_dt - change_dt).total_seconds())
            if best_delta is None or delta < best_delta:
                best_delta = delta
                best_index = index
        return best_index

    def _render_coc_crf_player(self, artifacts: list[dict[str, Any]], replay_change: dict[str, Any] | None, endpoint: str) -> None:
        if not hasattr(self, "coc_crf_browser"):
            return
        if not artifacts:
            self.coc_crf_artifact_label.setText("Artifact: none")
            self.coc_crf_frame_label.setText("Frame 0/0")
            self.coc_crf_scrub.setRange(0, 0)
            self.coc_crf_browser.setHtml(self._coc_panel_html("CRF Player", "(no CRF artifacts yet)", subtitle=f"Endpoint: {endpoint}/crf/artifacts"))
            return

        selected_index = min(max(self.coc_crf_artifact_selector.currentIndex(), 0), len(artifacts) - 1)
        artifact = artifacts[selected_index] if selected_index < len(artifacts) else artifacts[0]
        if not isinstance(artifact, dict):
            return
        timeline = artifact.get("timeline", [])
        if not isinstance(timeline, list):
            timeline = []
        selected_change_entry = {}
        if hasattr(self, "coc_crf_change_selector") and self.coc_crf_change_selector.count() > 0:
            selected_change_entry = self.coc_crf_change_selector.currentData() or {}
        if not isinstance(selected_change_entry, dict):
            selected_change_entry = {}
        has_selected_change = bool(selected_change_entry)
        scrub_index = self._coc_crf_timeline_index_for_change(artifact, selected_change_entry) if has_selected_change else self.coc_crf_scrub.value()
        scrub_index = min(max(scrub_index, 0), max(0, len(timeline) - 1))
        self.coc_crf_scrub.blockSignals(True)
        self.coc_crf_scrub.setRange(0, max(0, len(timeline) - 1))
        self.coc_crf_scrub.setValue(scrub_index)
        self.coc_crf_scrub.blockSignals(False)

        frame = timeline[scrub_index] if timeline else {}
        if not isinstance(frame, dict):
            frame = {}
        replay_state = self._fetch_coc_control_plane_json(
            f"/governance/replay-state?timestamp={quote(str(frame.get('timestamp', '')), safe='')}",
            cache_key=f"crf-replay:{artifact.get('id', '')}:{scrub_index}",
        ) if frame.get("timestamp") else None
        self.coc_crf_artifact_label.setText(f"Artifact: {artifact.get('id', 'unknown')}")
        self.coc_crf_frame_label.setText(f"Frame {scrub_index + 1}/{max(1, len(timeline))}")

        body_parts = [
            f"Artifact ID: {artifact.get('id', '')}",
            f"Profile: {artifact.get('profile', '')}",
            f"Environment: {artifact.get('environment', '')}",
            f"Incident: {artifact.get('incidentRef', '')}",
            f"Change entry: {selected_change_entry.get('entry_id', '')}",
            "",
            "Timeline frame:",
            _json_pretty(frame),
            "",
            "Governance replay state:",
            _json_pretty(replay_state or {}),
            "",
            "Impact:",
            _json_pretty(artifact.get('impact', {})),
            "",
            "Lineage:",
            _json_pretty(artifact.get('lineage', {})),
            "",
            "Replay change:",
            _json_pretty(replay_change or {}),
        ]
        self.coc_crf_browser.setHtml(
            self._coc_panel_html(
                "CRF Player",
                "\n".join(body_parts),
                subtitle=f"Endpoint: {endpoint}/crf/artifacts",
            )
        )

    def _render_coc_change_ledger_controls(self, change_ledger: dict[str, Any]) -> None:
        if not hasattr(self, "coc_crf_change_selector"):
            return
        entries = change_ledger.get("entries", []) if isinstance(change_ledger, dict) else []
        if not isinstance(entries, list):
            entries = []
        current_entry_id = str(self.coc_crf_change_selector.currentData().get("entry_id", "")) if self.coc_crf_change_selector.currentData() else ""
        self.coc_crf_change_selector.blockSignals(True)
        self.coc_crf_change_selector.clear()
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            entry_id = str(entry.get("entry_id", ""))
            label = f"{entry.get('timestamp', '')} | {entry_id} | {entry.get('changeType', '')}"
            self.coc_crf_change_selector.addItem(label, entry)
        if current_entry_id:
            for index in range(self.coc_crf_change_selector.count()):
                item_entry = self.coc_crf_change_selector.itemData(index)
                if isinstance(item_entry, dict) and str(item_entry.get("entry_id", "")) == current_entry_id:
                    self.coc_crf_change_selector.setCurrentIndex(index)
                    break
        self.coc_crf_change_selector.blockSignals(False)

    def _coc_panel_html(self, title: str, body: str, *, subtitle: str = "") -> str:
        lines = [
            "<div style='font-family: monospace; color: #d9dce3; background: rgba(12, 14, 20, 0.95); "
            "border: 1px solid #262a38; border-radius: 10px; padding: 8px;'>",
            f"<div style='color: #8cc3ff; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;'>{html_escape(title)}</div>",
        ]
        if subtitle:
            lines.append(f"<div style='color: #94a3b8; margin-top: 2px;'>{html_escape(subtitle)}</div>")
        lines.append(f"<pre style='white-space: pre-wrap; margin: 8px 0 0 0;'>{html_escape(body)}</pre>")
        lines.append("</div>")
        return "".join(lines)

    def _render_coc_tabs(self) -> None:
        if not hasattr(self, "coc_tabs"):
            return
        endpoint = self._coc_control_plane_api_base_url().rstrip("/")
        health_status = "offline"
        health_color = "#94a3b8"
        if endpoint:
            health = self._probe_coc_control_plane_endpoint(endpoint)
            health_status = "reachable" if health[0] else "unreachable"
            health_color = "#4ade80" if health[0] else "#f87171"
        self._set_coc_control_plane_connection_state(health_status.title(), health_color)

        events = self._fetch_coc_control_plane_json("/events", cache_key="events") or {"events": []}
        governance = self._fetch_coc_control_plane_json("/governance/summary", cache_key="governance-summary") or {}
        replay_timeline = self._fetch_coc_control_plane_json("/replay/timeline", cache_key="replay-timeline") or {"points": []}
        trust_fabric = self._fetch_coc_control_plane_json("/trust-fabric", cache_key="trust-fabric") or {}
        nodes_health = self._fetch_coc_control_plane_json("/nodes-health", cache_key="nodes-health") or {"nodes": []}
        authority_map = self._fetch_coc_control_plane_json("/authority-map", cache_key="authority-map") or {"boundaries": []}
        continuity = self._fetch_coc_control_plane_json("/memory/narratives?topic=replay", cache_key="memory-replay") or {"narratives": []}
        change_ledger = self._fetch_coc_control_plane_json("/governance/change-ledger", cache_key="change-ledger") or {"entries": []}
        change_timeline = self._fetch_coc_control_plane_json("/governance/timeline", cache_key="change-timeline") or {"timeline": []}
        change_diff = self._fetch_coc_control_plane_json("/governance/diff?from=2026-06-01T00:00:00.000Z&to=2026-07-11T19:10:00.000Z", cache_key="change-diff") or {}
        current_ugql = self.coc_ugql_query.text().strip() or "TRACE concept risk FROM lineage WITH INCLUDE worlds, docs, metrics LIMIT 12"
        encoded_ugql = quote(current_ugql, safe="")
        ugr_results = self._fetch_coc_control_plane_json(f"/ugr/query?ugql={encoded_ugql}", cache_key=f"ugr-query:{current_ugql}") or {"results": []}
        upl_modules = self._fetch_coc_control_plane_json("/upl/modules", cache_key="upl-modules") or {"modules": []}
        crf_artifacts = self._fetch_coc_control_plane_json("/crf/artifacts", cache_key="crf-artifacts") or {"artifacts": []}
        clauses_heatmap = self._fetch_coc_control_plane_json("/clauses-heatmap", cache_key="clauses-heatmap") or {"clauses": {}}
        clauses = self._fetch_coc_control_plane_json("/clauses", cache_key="clauses") or {"clauses": []}
        drift = self._fetch_coc_control_plane_json("/drift", cache_key="drift") or {}
        graph = self._fetch_coc_control_plane_json("/graph", cache_key="graph") or {}

        event_lines: list[str] = []
        for event in (events.get("events", []) if isinstance(events, dict) else []):
            if not isinstance(event, dict):
                continue
            event_lines.append(f"{event.get('timestamp', '')} | {event.get('type', '')} | {event.get('id', '')}")
        if not event_lines:
            event_lines.append("(no constitutional events yet)")
        self.coc_panels["event_stream"].setHtml(
            self._coc_panel_html(
                "Event Stream",
                "\n".join(event_lines[:120]),
                subtitle=f"Endpoint: {endpoint}/events",
            )
        )

        replay_points: list[str] = []
        for point in (replay_timeline.get("points", []) if isinstance(replay_timeline, dict) else []):
            if not isinstance(point, dict):
                continue
            replay_points.append(
                f"{point.get('timestamp', '')} | {point.get('commit', '')} | trust={point.get('trustScore', '')} | decision={point.get('decision', '')}"
            )
        if not replay_points:
            replay_points.append("(no replay points yet)")
        self.coc_panels["replay"].setHtml(
            self._coc_panel_html(
                "Replay",
                "\n".join(replay_points[:120]),
                subtitle=f"Endpoint: {endpoint}/replay/timeline",
            )
        )

        self.coc_panels["governance"].setHtml(self._coc_panel_html("Governance", _json_pretty(governance), subtitle=f"Endpoint: {endpoint}/governance/summary"))
        self.coc_panels["trust"].setHtml(self._coc_panel_html("Trust", _json_pretty(trust_fabric), subtitle=f"Endpoint: {endpoint}/trust-fabric"))
        self.coc_panels["nodes"].setHtml(self._coc_panel_html("Nodes", _json_pretty(nodes_health), subtitle=f"Endpoint: {endpoint}/nodes-health"))
        self.coc_panels["authority"].setHtml(self._coc_panel_html("Authority", _json_pretty(authority_map), subtitle=f"Endpoint: {endpoint}/authority-map"))
        self.coc_panels["continuity"].setHtml(self._coc_panel_html("Continuity", _json_pretty(continuity), subtitle=f"Endpoint: {endpoint}/memory/narratives?topic=replay"))
        ledger_lines: list[str] = []
        for entry in (change_ledger.get("entries", []) if isinstance(change_ledger, dict) else []):
            if not isinstance(entry, dict):
                continue
            ledger_lines.append(
                f"{entry.get('timestamp', '')} | {entry.get('changeType', '')} | {entry.get('artifactRef', '')} | vote {entry.get('lineage', {}).get('councilVote', {}).get('for', '')}/{entry.get('lineage', {}).get('councilVote', {}).get('against', '')}/{entry.get('lineage', {}).get('councilVote', {}).get('abstain', '')}"
            )
        if not ledger_lines:
            ledger_lines.append("(no ledger entries yet)")
        ledger_body = "\n".join(ledger_lines[:120])
        ledger_body += "\n\nTimeline:\n" + _json_pretty(change_timeline)
        ledger_body += "\n\nDiff:\n" + _json_pretty(change_diff)
        self.coc_panels["change_ledger"].setHtml(
            self._coc_panel_html(
                "Change Ledger",
                ledger_body,
                subtitle=f"Endpoint: {endpoint}/governance/change-ledger",
            )
        )
        selected_change_entry: dict[str, Any] | None = None
        if hasattr(self, "coc_crf_change_selector"):
            self.coc_crf_change_selector.blockSignals(True)
            current_change_entry_id = ""
            current_change_data = self.coc_crf_change_selector.currentData()
            if isinstance(current_change_data, dict):
                current_change_entry_id = str(current_change_data.get("entry_id", ""))
            self.coc_crf_change_selector.clear()
            entries = change_ledger.get("entries", []) if isinstance(change_ledger, dict) else []
            if not isinstance(entries, list):
                entries = []
            for entry in entries:
                if not isinstance(entry, dict):
                    continue
                entry_id = str(entry.get("entry_id", ""))
                label = f"{entry.get('timestamp', '')} | {entry_id} | {entry.get('changeType', '')}"
                self.coc_crf_change_selector.addItem(label, entry)
            if current_change_entry_id:
                for index in range(self.coc_crf_change_selector.count()):
                    item_entry = self.coc_crf_change_selector.itemData(index)
                    if isinstance(item_entry, dict) and str(item_entry.get("entry_id", "")) == current_change_entry_id:
                        self.coc_crf_change_selector.setCurrentIndex(index)
                        break
            if self.coc_crf_change_selector.count() > 0 and self.coc_crf_change_selector.currentData() is None:
                self.coc_crf_change_selector.setCurrentIndex(0)
            current_change_data = self.coc_crf_change_selector.currentData()
            if isinstance(current_change_data, dict):
                selected_change_entry = current_change_data
            self.coc_crf_change_selector.blockSignals(False)
        if selected_change_entry is None:
            entries = change_ledger.get("entries", []) if isinstance(change_ledger, dict) else []
            if isinstance(entries, list) and entries:
                first_entry = entries[0]
                if isinstance(first_entry, dict):
                    selected_change_entry = first_entry
        change_replay = {}
        if isinstance(selected_change_entry, dict):
            selected_change_entry_id = str(selected_change_entry.get("entry_id", "")).strip()
            if selected_change_entry_id:
                change_replay = self._fetch_coc_control_plane_json(
                    f"/governance/replay-change/{quote(selected_change_entry_id, safe='')}",
                    cache_key=f"change-replay:{selected_change_entry_id}",
                ) or {}
        ugr_summary_lines: list[str] = []
        for result in (ugr_results.get("results", []) if isinstance(ugr_results, dict) else []):
            if not isinstance(result, dict):
                continue
            if "nodeId" in result and "refId" in result:
                ugr_summary_lines.append(f"{result.get('nodeId', '')} | {result.get('refId', '')} | {result.get('kind', '')}")
            else:
                ugr_summary_lines.append(_json_pretty(result))
        if not ugr_summary_lines:
            ugr_summary_lines.append("(no UGR results yet)")
        knowledge_body = "UGQL:\nTRACE concept risk FROM lineage WITH INCLUDE worlds, docs, metrics LIMIT 12\n\n"
        knowledge_body += "Results:\n" + "\n".join(ugr_summary_lines[:120])
        knowledge_body += "\n\nUPL Modules:\n" + _json_pretty(upl_modules)
        knowledge_body += "\n\nCRF Artifacts:\n" + _json_pretty(crf_artifacts)
        federation_lines: list[str] = []
        for adapter in self.workspace_adapters:
            entry_path = _adapter_entry_path(adapter)
            status = "ready" if adapter.root.exists() else "missing"
            entry_text = str(entry_path) if entry_path is not None else "(no entry file)"
            federation_lines.append(f"{adapter.name} | {status} | {adapter.root} | {entry_text}")
        knowledge_body += "\n\nConnected ULX Federation:\n" + "\n".join(federation_lines[:120])
        knowledge_body += "\n\nSelected UGQL:\n" + current_ugql
        self.coc_panels["knowledge"].setHtml(self._coc_panel_html("UGR Knowledge Console", knowledge_body, subtitle=f"Endpoint: {endpoint}/ugr/query"))
        selected_adapter = self._selected_workspace_adapter()
        self.coc_panels["ugr_graph"].setHtml(
            self._workspace_federation_graph_html(
                selected_adapter,
                snapshot=self._collect_workspace_metadata(selected_adapter) if selected_adapter is not None else None,
            )
        )
        if hasattr(self, "coc_crf_artifact_selector"):
            self.coc_crf_artifact_selector.blockSignals(True)
            current_artifact_id = self.coc_crf_artifact_selector.currentText()
            self.coc_crf_artifact_selector.clear()
            artifacts = crf_artifacts.get("artifacts", []) if isinstance(crf_artifacts, dict) else []
            for artifact in artifacts:
                if isinstance(artifact, dict):
                    self.coc_crf_artifact_selector.addItem(str(artifact.get("id", "artifact")))
            if current_artifact_id:
                index = self.coc_crf_artifact_selector.findText(current_artifact_id)
                if index >= 0:
                    self.coc_crf_artifact_selector.setCurrentIndex(index)
            self.coc_crf_artifact_selector.blockSignals(False)
            self._render_coc_crf_player(
                [artifact for artifact in artifacts if isinstance(artifact, dict)],
                change_replay if isinstance(change_replay, dict) else None,
                endpoint,
            )
        self.coc_panels["clauses"].setHtml(
            self._coc_panel_html(
                "Clauses",
                _json_pretty({"heatmap": clauses_heatmap, "clauses": clauses}),
                subtitle=f"Endpoint: {endpoint}/clauses-heatmap",
            )
        )
        self.coc_panels["drift"].setHtml(self._coc_panel_html("Drift", _json_pretty(drift), subtitle=f"Endpoint: {endpoint}/drift"))
        self.coc_panels["graph"].setHtml(self._coc_panel_html("Graph", _json_pretty(graph), subtitle=f"Endpoint: {endpoint}/graph"))

    def _collect_workspace_metadata(self, adapter: WorkspaceAdapter) -> dict[str, Any]:
        indexer = self._workspace_indexer(adapter)
        snapshot = indexer.summary()
        root = adapter.root
        entry = snapshot.get("best_entry") or _adapter_entry_path(adapter)
        is_git = bool(snapshot.get("is_git"))
        git_branch = _git_scalar(root, ["branch", "--show-current"], default="") if is_git else ""
        git_root = _git_scalar(root, ["rev-parse", "--show-toplevel"], default=str(root)) if is_git else str(root)
        git_dirty = bool(_git_status_lines(root, limit=1)) if is_git else False
        git_status = _git_status_lines(root) if is_git else []
        git_commits = _git_recent_commits(root) if is_git else []
        git_diffs = _git_recent_diffs(root) if is_git else []
        return {
            "adapter": adapter,
            "root": root,
            "exists": root.exists(),
            "is_git": is_git,
            "entry": entry,
            "entry_label": self._path_label(entry, root) if entry is not None else "No best file found",
            "git_branch": git_branch or ("(non-git workspace)" if not is_git else "(no branch)"),
            "git_root": git_root,
            "git_dirty": git_dirty,
            "git_status": git_status,
            "git_commits": git_commits,
            "git_diffs": git_diffs,
            "file_count": snapshot.get("file_count", _workspace_file_count(root)),
            "dir_count": snapshot.get("dir_count", _workspace_directory_count(root)),
            "index_path": snapshot.get("index_path", _workspace_index_artifact_path(root)),
            "replay_path": snapshot.get("replay_path", _workspace_replay_artifact_path(root)),
            "manifest_paths": snapshot.get("manifest_paths", []),
            "recent_changes": snapshot.get("recent_changes", []),
        }

    def _path_label(self, path: Path | None, root: Path | None = None) -> str:
        if path is None:
            return ""
        if root is not None:
            try:
                return str(path.relative_to(root))
            except Exception:
                pass
        return str(path)

    def _path_in_adapter(self, path: Path | None, adapter: WorkspaceAdapter | None) -> bool:
        if path is None or adapter is None or not adapter.root.exists():
            return False
        try:
            path.resolve().relative_to(adapter.root.resolve())
            return True
        except Exception:
            return False

    def _adapter_for_path(self, path: Path | None) -> WorkspaceAdapter | None:
        if path is None:
            return None
        try:
            resolved = path.resolve()
        except Exception:
            resolved = path
        for adapter in self.workspace_adapters:
            if not adapter.root.exists():
                continue
            try:
                resolved.relative_to(adapter.root.resolve())
                return adapter
            except Exception:
                continue
        return None

    def _workspace_file_breadcrumb(self, adapter: WorkspaceAdapter | None, path: Path | None) -> str:
        if adapter is None:
            if path is None:
                return "Current workspace file: (none)"
            display = html_escape(self._path_label(path))
            return f"Current workspace file: <b>{display}</b>"
        if path is None or not path.exists():
            return f"Current workspace file: <b>{html_escape(adapter.name)}</b> / (none)"
        if self._path_in_adapter(path, adapter):
            rel_path = path.relative_to(adapter.root)
            segments: list[tuple[str, Path]] = [(adapter.name, adapter.root)]
            current = adapter.root
            for part in rel_path.parts:
                current = current / part
                segments.append((part, current))
            rendered: list[str] = []
            for index, (label, target) in enumerate(segments):
                href = f"workspace:{quote(str(target))}"
                safe_label = html_escape(str(label))
                if index == 0:
                    rendered.append(f"<b><a href='{href}'>{safe_label}</a></b>")
                else:
                    rendered.append(f"<a href='{href}'>{safe_label}</a>")
            trail = " / ".join(rendered)
            if path.is_file():
                trail += " <span style='color:#94a3b8;'>[<a href='open'>open</a>]</span>"
            return f"Current workspace file: {trail}"
        display = html_escape(self._path_label(path))
        return f"Current workspace file: <b>{display}</b>"

    def _workspace_file_diff_preview(self, adapter: WorkspaceAdapter | None, path: Path | None) -> str:
        if adapter is None:
            return "Select a workspace file to preview its diff trail."
        if path is None:
            return "Select a file in the tree to preview its diff trail."
        if not path.exists():
            return f"Missing file:\n{path}"
        if not path.is_file():
            return f"Selected path is a directory:\n{self._path_label(path, adapter.root)}"
        if not self._path_in_adapter(path, adapter):
            return (
                f"Selected file is outside the active workspace:\n{path}\n\n"
                "Switch the workspace or select a file under the current adapter root."
            )

        relative = self._path_label(path, adapter.root)
        if not _git_is_repo(adapter.root):
            excerpt = _text_excerpt(path)
            return (
                f"{adapter.name} / {relative}\n"
                "(non-git workspace)\n\n"
                f"{excerpt}"
            )

        status_lines = _git_status_lines(adapter.root, limit=4)
        status_line = next((line for line in status_lines if line.endswith(relative)), status_lines[0] if status_lines else "")
        working_diff = _git_output(adapter.root, ["diff", "--no-ext-diff", "--unified=4", "--", relative])
        cached_diff = _git_output(adapter.root, ["diff", "--cached", "--no-ext-diff", "--unified=4", "--", relative])
        history_diff = _git_output(adapter.root, ["log", "-p", "-1", "--no-ext-diff", "--unified=4", "--", relative])

        sections: list[str] = [f"{adapter.name} / {relative}"]
        if status_line:
            sections.append(f"status: {status_line}")

        if cached_diff:
            sections.append("[cached]")
            sections.append(_clip_text(cached_diff))
        if working_diff:
            sections.append("[working tree]")
            sections.append(_clip_text(working_diff))
        if not working_diff and not cached_diff and history_diff:
            sections.append("[last commit diff]")
            sections.append(_clip_text(history_diff))
        if not working_diff and not cached_diff and not history_diff:
            sections.append("(no diff trail available)")
        return "\n".join(sections)

    def _workspace_replay_path(self, adapter: WorkspaceAdapter | None) -> Path | None:
        if adapter is None or not adapter.root.exists():
            return None
        return _workspace_replay_artifact_path(adapter.root)

    def _workspace_index_path(self, adapter: WorkspaceAdapter | None) -> Path | None:
        if adapter is None or not adapter.root.exists():
            return None
        return _workspace_index_artifact_path(adapter.root)

    def _workspace_aios_artifacts(self, adapter: WorkspaceAdapter | None) -> dict[str, Path]:
        if adapter is None or not adapter.root.exists():
            return {}
        root = adapter.root
        candidates = {
            "runtime": root / "constitutional" / "aios_node_runtime.py",
            "spec_doc": root / "docs" / "specifications" / "aios-constitutional-node-runtime-v1.md",
            "spec_json": root / "docs" / "crk1" / "release" / "AIOS_CONSTITUTIONAL_NODE_RUNTIME_V1.spec.json",
            "conformance_json": root / "docs" / "crk1" / "release" / "AIOS_CONSTITUTIONAL_NODE_RUNTIME_V1.conformance.json",
            "tests": root / "tests" / "test_aios_node_runtime.py",
            "run_ledger": root / ".runtime" / "run-ledger.json",
            "meaning_ledger": root / ".runtime" / "online" / "meaning-ledger.jsonl",
            "replay_machine": root / ".runtime" / "governance" / "retirement" / "temporal_replay_machine.json",
        }
        return {key: path for key, path in candidates.items() if path.exists()}

    def _workspace_aios_surface_snapshot(self, adapter: WorkspaceAdapter | None, snapshot: dict[str, Any] | None = None) -> dict[str, Any]:
        snapshot = snapshot or (self._collect_workspace_metadata(adapter) if adapter is not None else {})
        artifacts = self._workspace_aios_artifacts(adapter)
        run_ledger = _load_json(artifacts["run_ledger"]) if "run_ledger" in artifacts else None
        meaning_entries = _load_json_lines(artifacts["meaning_ledger"]) if "meaning_ledger" in artifacts else []
        spec_json = _load_json(artifacts["spec_json"]) if "spec_json" in artifacts else None
        conformance_json = _load_json(artifacts["conformance_json"]) if "conformance_json" in artifacts else None

        runs = run_ledger.get("runs", []) if isinstance(run_ledger, dict) else []
        run_count = len([run for run in runs if isinstance(run, dict)])
        step_count = sum(len(run.get("steps", [])) for run in runs if isinstance(run, dict))
        last_run = next((run for run in reversed(runs) if isinstance(run, dict)), {})
        meaning_count = len([entry for entry in meaning_entries if isinstance(entry, dict)])
        replay_anchor_labels = [
            self._path_label(path, adapter.root if adapter is not None else None)
            for key, path in artifacts.items()
            if key in {"runtime", "spec_doc", "spec_json", "conformance_json", "tests", "run_ledger", "meaning_ledger"}
        ]
        timeline_items: list[dict[str, Any]] = []
        for run in runs:
            if not isinstance(run, dict):
                continue
            timeline_items.append(
                {
                    "timestamp": str(run.get("created_at", "")),
                    "kind": "run",
                    "label": str(run.get("title", run.get("id", "run"))),
                    "detail": f"{run.get('status', 'unknown')} | {run.get('session_id', '')}",
                    "path": artifacts.get("run_ledger"),
                }
            )
            for step in run.get("steps", []):
                if not isinstance(step, dict):
                    continue
                timeline_items.append(
                    {
                        "timestamp": str(step.get("created_at", "")),
                        "kind": "step",
                        "label": str(step.get("title", step.get("id", "step"))),
                        "detail": str(step.get("status", step.get("kind", ""))),
                        "path": artifacts.get("run_ledger"),
                    }
                )
        for entry in meaning_entries:
            if not isinstance(entry, dict):
                continue
            timeline_items.append(
                {
                    "timestamp": str(entry.get("created_at", "")),
                    "kind": str(entry.get("kind", "meaning")),
                    "label": str(entry.get("entry_id", entry.get("title", "meaning"))),
                    "detail": str(entry.get("title", entry.get("body", ""))),
                    "path": artifacts.get("meaning_ledger"),
                }
            )
        timeline_items.sort(key=lambda item: (str(item.get("timestamp", "")), str(item.get("kind", "")), str(item.get("label", ""))))
        return {
            "active": bool(artifacts),
            "artifact_count": len(artifacts),
            "artifacts": artifacts,
            "run_ledger": run_ledger if isinstance(run_ledger, dict) else {},
            "meaning_entries": meaning_entries,
            "spec_json": spec_json if isinstance(spec_json, dict) else {},
            "conformance_json": conformance_json if isinstance(conformance_json, dict) else {},
            "run_count": run_count,
            "step_count": step_count,
            "meaning_count": meaning_count,
            "last_run": last_run if isinstance(last_run, dict) else {},
            "timeline_items": timeline_items,
            "replay_anchor_labels": replay_anchor_labels,
            "snapshot": snapshot,
        }

    def _workspace_aios_summary(self, adapter: WorkspaceAdapter | None, snapshot: dict[str, Any]) -> str:
        if adapter is None or not adapter.root.exists():
            return "No AIOS surface detected."
        aios = self._workspace_aios_surface_snapshot(adapter, snapshot)
        if not aios["active"]:
            return "AIOS runtime files not found in this workspace."

        spec_json = aios["spec_json"]
        title = str(spec_json.get("title", adapter.name)) if isinstance(spec_json, dict) else adapter.name
        last_run = aios["last_run"]
        last_run_bits: list[str] = []
        if last_run:
            if last_run.get("status"):
                last_run_bits.append(str(last_run.get("status")))
            if last_run.get("title"):
                last_run_bits.append(str(last_run.get("title")))
        last_run_text = " | ".join(last_run_bits) if last_run_bits else "no run ledger entries"
        conformance_count = len(aios["conformance_json"].get("conformanceArtifacts", [])) if isinstance(aios["conformance_json"], dict) else 0
        runtime_planes = len(spec_json.get("runtimePlanes", [])) if isinstance(spec_json, dict) else 0
        return "\n".join(
            [
                f"Surface: {title}",
                f"Ledger snapshot: {aios['run_count']} runs | {aios['step_count']} steps | {aios['meaning_count']} meaning entries",
                f"Replay trail: {last_run_text}",
                f"Artifacts: {aios['artifact_count']} present | {runtime_planes} planes | {conformance_count} conformance files",
            ]
        )

    def _workspace_aios_replay_html(self, adapter: WorkspaceAdapter | None) -> str:
        aios = self._workspace_aios_surface_snapshot(adapter)
        if not aios["active"]:
            return (
                "<div style='font-family: monospace; color: #d9dce3; "
                "background: rgba(12, 14, 20, 0.95); border: 1px solid #262a38; "
                "border-radius: 10px; padding: 8px;'>"
                "AIOS replay timeline is unavailable in this workspace."
                "</div>"
            )

        artifacts = aios["artifacts"]
        lines = [
            "<div style='font-family: monospace; color: #d9dce3; "
            "background: rgba(12, 14, 20, 0.95); border: 1px solid #262a38; "
            "border-radius: 10px; padding: 8px;'>",
            "<div style='color: #8cc3ff; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;'>AIOS Replay Timeline</div>",
            f"<div>Ledger snapshot: {aios['run_count']} runs | {aios['step_count']} steps | {aios['meaning_count']} meaning entries</div>",
            f"<div>Artifacts: {aios['artifact_count']} present</div>",
            f"<div>Anchors: {html_escape(' / '.join(aios['replay_anchor_labels'][:6]))}</div>",
            "<div style='height: 8px;'></div>",
        ]

        if artifacts:
            timeline_path_links = []
            for key in ("runtime", "spec_doc", "spec_json", "conformance_json", "tests", "run_ledger", "meaning_ledger"):
                path = artifacts.get(key)
                if path is None:
                    continue
                href = f"workspace:{quote(str(path))}"
                timeline_path_links.append(
                    f"<div><a href='{html_escape(href)}'>{html_escape(self._path_label(path, adapter.root if adapter is not None else None))}</a></div>"
                )
            if timeline_path_links:
                lines.append("<div style='color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em;'>Surface Anchors</div>")
                lines.extend(timeline_path_links)
                lines.append("<div style='height: 8px;'></div>")

        timeline_items = aios["timeline_items"][-40:]
        if not timeline_items:
            lines.append("<div>(no AIOS replay events available yet)</div>")
        else:
            current_context = self._workspace_context_path
            for item in timeline_items:
                path = item.get("path")
                path_obj = path if isinstance(path, Path) else None
                selected = path_obj is not None and current_context is not None and path_obj.exists() and current_context.exists() and path_obj.resolve() == current_context.resolve()
                row_style = (
                    "background: rgba(74, 156, 240, 0.18); border: 1px solid rgba(140, 195, 255, 0.7); "
                    "border-radius: 6px; padding: 2px 4px;"
                    if selected
                    else "padding: 2px 4px;"
                )
                href = f"workspace:{quote(str(path_obj))}" if path_obj is not None else ""
                display = " | ".join(
                    [
                        str(item.get("timestamp", "")),
                        str(item.get("kind", "")),
                        str(item.get("label", "")),
                        str(item.get("detail", "")),
                    ]
                )
                lines.append(
                    f"<div style='{row_style}'>"
                    f"<a href='{html_escape(href)}'>"
                    f"{html_escape(display)}"
                    "</a>"
                    "</div>"
                )
        lines.append("</div>")
        return "".join(lines)

    def _load_workspace_replay_events(self, adapter: WorkspaceAdapter | None) -> list[dict[str, Any]]:
        replay_path = self._workspace_replay_path(adapter)
        if replay_path is None:
            return []
        return _load_json_lines(replay_path)

    def _workspace_replay_summary(self, adapter: WorkspaceAdapter | None) -> dict[str, Any]:
        return _workspace_event_summary(self._load_workspace_replay_events(adapter))

    def _workspace_replay_selection_key(self, adapter: WorkspaceAdapter | None) -> str:
        return adapter.key if adapter is not None else ""

    def _workspace_replay_selected_line_for(self, adapter: WorkspaceAdapter | None) -> int:
        if adapter is None:
            return 0
        return int(self._workspace_replay_selection_map.get(adapter.key, 0))

    def _record_workspace_replay_selection(
        self,
        adapter: WorkspaceAdapter | None,
        line_number: int,
        event: dict[str, Any] | None = None,
        persist_record: bool = True,
    ) -> None:
        if adapter is None or line_number <= 0:
            return
        selected_seq = int(event.get("seq", line_number)) if event else int(line_number)
        self._workspace_replay_selection_map[adapter.key] = int(selected_seq)
        self.settings.setValue(WORKSPACE_REPLAY_SELECTIONS_KEY, json.dumps(self._workspace_replay_selection_map, sort_keys=True))
        self._workspace_replay_selected_line = int(line_number)
        self._workspace_replay_selected_event = event
        if persist_record:
            selection_record = {
                "seq": self._workspace_event_seq + 1,
                "kind": WORKSPACE_REPLAY_SELECTION_KIND,
                "adapter": adapter.key,
                "adapter_name": adapter.name,
                "path": self._path_label(Path(str(event.get("path", ""))) if event and event.get("path") else None, adapter.root) if event else "",
                "detail": f"selected_seq={selected_seq}",
                "selected_seq": selected_seq,
                "selected_line": int(line_number),
                "selected_kind": str(event.get("kind", "")) if event else "",
                "selected_path": str(event.get("path", "")) if event else "",
                "selected_detail": str(event.get("detail", "")) if event else "",
            }
            self._workspace_event_seq += 1
            replay_path = self._workspace_replay_path(adapter)
            if replay_path is not None:
                _append_json_line(replay_path, selection_record)
            self._sync_workspace_event_log_from_artifact(adapter)
        else:
            self._render_workspace_event_log()

    def _restore_workspace_replay_selection(self, adapter: WorkspaceAdapter | None) -> None:
        if adapter is None:
            self._workspace_replay_selected_line = 0
            self._workspace_replay_selected_event = None
            return
        replay_path = self._workspace_replay_path(adapter)
        selection_record = _workspace_replay_artifact_selection_event(replay_path) if replay_path is not None else None
        if selection_record is not None:
            selected_seq = int(selection_record.get("selected_seq", 0))
            located = _workspace_replay_artifact_event_line_for_seq(replay_path, selected_seq) if replay_path is not None else None
            if located is not None:
                selected_line, selected_event = located
                self._workspace_replay_selected_line = selected_line
                self._workspace_replay_selected_event = selected_event
                self._workspace_replay_selection_map[adapter.key] = selected_seq
                return
        selected_seq = self._workspace_replay_selected_line_for(adapter)
        if selected_seq <= 0 or replay_path is None:
            self._workspace_replay_selected_line = 0
            self._workspace_replay_selected_event = None
            return
        located = _workspace_replay_artifact_event_line_for_seq(replay_path, selected_seq)
        if located is None:
            self._workspace_replay_selected_line = 0
            self._workspace_replay_selected_event = None
            return
        selected_line, selected_event = located
        self._workspace_replay_selected_line = selected_line
        self._workspace_replay_selected_event = selected_event

    def _focus_workspace_replay_event(
        self,
        adapter: WorkspaceAdapter | None,
        line_number: int,
        event: dict[str, Any] | None,
        *,
        persist_record: bool,
    ) -> None:
        if adapter is None or line_number <= 0:
            return
        self._record_workspace_replay_selection(adapter, line_number, event, persist_record=persist_record)

    def _sync_current_file_context(self, path: Path | None, adapter: WorkspaceAdapter | None = None) -> None:
        active_adapter = adapter or self._adapter_for_path(path) or self._selected_workspace_adapter()
        self._workspace_context_path = path
        if path is not None:
            self.settings.setValue("last_workspace_focus", str(path))
        self.workspace_breadcrumb.setText(self._workspace_file_breadcrumb(active_adapter, path))
        self._sync_workspace_focus_visuals(active_adapter)
        self._record_workspace_event("focus.sync", path, active_adapter, "current-context")

    def _sync_workspace_focus_visuals(self, adapter: WorkspaceAdapter | None = None) -> None:
        focus_path = self._workspace_hover_path or self._workspace_context_path
        focus_adapter = adapter or self._adapter_for_path(focus_path) or self._selected_workspace_adapter()
        diff_preview = self._workspace_file_diff_preview(focus_adapter, focus_path)
        self.workspace_diff_view.setPlainText(diff_preview)
        self._workspace_diff_preview_text = diff_preview
        self._set_workspace_tree_hover(focus_path)
        active = self._workspace_hover_path is not None and focus_path is not None
        if active:
            self._workspace_focus_phase = (self._workspace_focus_phase + 1) % 4
        else:
            self._workspace_focus_phase = 0
            self._workspace_hover_depth = 0
        self._apply_workspace_diff_focus(active)

    def _record_workspace_event(
        self,
        kind: str,
        path: Path | None,
        adapter: WorkspaceAdapter | None = None,
        detail: str = "",
    ) -> None:
        entry = {
            "seq": self._workspace_event_seq + 1,
            "kind": kind,
            "adapter": adapter.key if adapter else "",
            "adapter_name": adapter.name if adapter else "",
            "path": self._path_label(path, adapter.root if adapter else None) if path is not None else "",
            "detail": detail,
        }
        self._workspace_event_seq += 1
        self._workspace_event_log.append(entry)
        if len(self._workspace_event_log) > WORKSPACE_EVENT_LIMIT:
            self._workspace_event_log = self._workspace_event_log[-WORKSPACE_EVENT_LIMIT:]
        self.settings.setValue("workspace_event_log", json.dumps(self._workspace_event_log, default=str))
        if adapter is not None and adapter.root.exists():
            replay_path = self._workspace_replay_path(adapter)
            if replay_path is not None:
                _append_json_line(replay_path, entry)
            self._sync_workspace_trust_state(adapter, event_kind=kind, event_path=path)
        self._render_workspace_event_log()

    def _render_workspace_event_log(self) -> None:
        adapter = self._selected_workspace_adapter()
        snapshot = self._collect_workspace_metadata(adapter) if adapter is not None else None
        self.workspace_lineage_view.setHtml(self._workspace_lineage_html(adapter))
        self.workspace_trust_view.setHtml(self._workspace_trust_html(adapter, snapshot))
        self.workspace_aios_replay_view.setHtml(self._workspace_aios_replay_html(adapter))
        adapter = self._selected_workspace_adapter()
        self._workspace_replay_artifact_path_cache = self._workspace_replay_path(adapter)
        self.workspace_replay_artifact_view.setHtml(self._workspace_replay_artifact_html(adapter))
        self._render_coc_tabs()

    def _workspace_lineage_html(self, adapter: WorkspaceAdapter | None) -> str:
        replay_path = self._workspace_replay_path(adapter)
        events = _load_json_lines(replay_path) if replay_path is not None else list(self._workspace_event_log)
        if not events:
            return (
                "<div style='font-family: monospace; color: #d9dce3; "
                "background: rgba(12, 14, 20, 0.95); border: 1px solid #262a38; "
                "border-radius: 10px; padding: 8px;'>"
                "(no workspace lineage events)"
                "</div>"
            )
        summary = self._workspace_replay_summary(adapter)
        trust_ledger = self._workspace_trust_ledger(adapter) if adapter is not None else None
        lines: list[str] = [
            "<div style='font-family: monospace; color: #d9dce3; "
            "background: rgba(12, 14, 20, 0.95); border: 1px solid #262a38; "
            "border-radius: 10px; padding: 8px;'>",
        ]
        if replay_path is not None:
            lines.append(f"<div>Replay path: {html_escape(str(replay_path))}</div>")
            lines.append(f"<div>Replay signature: {html_escape(str(summary['signature']))}</div>")
            lines.append(f"<div>Replay events: {summary['event_count']}</div>")
        if self._workspace_replay_selected_event:
            selected = self._workspace_replay_selected_event
            selected_bits = [f"#{int(selected.get('seq', 0)):03d}", str(selected.get("kind", ""))]
            if selected.get("path"):
                selected_bits.append(f"path={selected.get('path')}")
            if selected.get("detail"):
                selected_bits.append(str(selected.get("detail")))
            lines.append(f"<div>Selected replay event: {' | '.join(html_escape(bit) for bit in selected_bits)}</div>")
        if trust_ledger is not None:
            current_revision = trust_ledger.trust_state_for(adapter.key)
            lines.append("<div style='height: 8px;'></div>")
            lines.append("<div style='color: #8cc3ff; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;'>Trust Timeline</div>")
            if current_revision is not None:
                lines.append(
                    "<div>"
                    f"Live trust: {current_revision.context.score:.2f} ({html_escape(current_revision.context.band)})"
                    f" · revision {current_revision.revision}"
                    f" · receipts {len(trust_ledger.receipts)}"
                    "</div>"
                )
            trust_revisions = trust_ledger.trust_revisions[-64:]
            if trust_revisions:
                start_trust_line = max(1, len(trust_ledger.trust_revisions) - len(trust_revisions) + 1)
                for line_number, revision in enumerate(trust_revisions, start=start_trust_line):
                    lines.append(self._workspace_trust_event_label(revision, line_number))
            else:
                lines.append("<div>(no trust revisions recorded yet)</div>")
            lines.append("<div style='height: 8px;'></div>")
            lines.append(self._workspace_trust_clause_html())
            lines.append("<div style='height: 8px;'></div>")
        lines.append("<div style='height: 8px;'></div>")
        start_line = max(1, len(events) - 199)
        for line_number, entry in enumerate(events[-200:], start=start_line):
            if entry.get("kind") == WORKSPACE_REPLAY_SELECTION_KIND:
                label = self._workspace_lineage_selection_label(entry, line_number)
            else:
                label = self._workspace_lineage_event_label(entry, line_number)
            lines.append(label)
        lines.append("</div>")
        return "".join(lines)

    def _workspace_lineage_event_label(self, entry: dict[str, Any], line_number: int) -> str:
        selected = line_number == self._workspace_replay_selected_line
        row_style = (
            "background: rgba(74, 156, 240, 0.18); border: 1px solid rgba(140, 195, 255, 0.7); border-radius: 6px; padding: 2px 4px;"
            if selected
            else "padding: 2px 4px;"
        )
        prefix = ">> " if selected else "   "
        details: list[str] = []
        if entry["adapter_name"]:
            details.append(f"adapter={entry['adapter_name']}")
        if entry["path"]:
            details.append(f"path={entry['path']}")
        if entry["detail"]:
            details.append(entry["detail"])
        label = f"{prefix}#{entry['seq']:03d} {entry['kind']}"
        if details:
            label += " | " + " | ".join(details)
        return (
            f"<div style='{row_style}'>"
            f"<a href='workspace-replay:{line_number}'>"
            f"{html_escape(label)}"
            "</a>"
            "</div>"
        )

    def _workspace_lineage_selection_label(self, entry: dict[str, Any], line_number: int) -> str:
        selected_seq = int(entry.get("selected_seq", 0))
        is_focus = selected_seq == self._workspace_replay_selected_event_seq()
        row_style = (
            "background: rgba(74, 156, 240, 0.22); border: 1px solid rgba(140, 195, 255, 0.9); border-radius: 6px; padding: 2px 4px;"
            if is_focus
            else "padding: 2px 4px;"
        )
        focus_bits = [WORKSPACE_REPLAY_SELECTION_KIND, f"FOCUS -> #{selected_seq:03d}"]
        if entry.get("selected_kind"):
            focus_bits.append(str(entry.get("selected_kind")))
        if entry.get("selected_path"):
            focus_bits.append(f"path={entry.get('selected_path')}")
        if entry.get("detail"):
            focus_bits.append(str(entry.get("detail")))
        return (
            f"<div style='{row_style}'>"
            f"<a href='workspace-replay:{line_number}'>"
            f"{html_escape(' | '.join(focus_bits))}"
            "</a>"
            "</div>"
        )

    def _workspace_replay_selected_event_seq(self) -> int:
        if self._workspace_replay_selected_event is None:
            return 0
        try:
            return int(self._workspace_replay_selected_event.get("seq", 0))
        except Exception:
            return 0

    def _workspace_trust_ledger(self, adapter: WorkspaceAdapter | None) -> ulx.TrustLedger:
        key = adapter.key if adapter is not None else ""
        ledger = self._workspace_trust_ledgers.get(key)
        if ledger is None:
            ledger = ulx.TrustLedger()
            self._workspace_trust_ledgers[key] = ledger
        return ledger

    def _workspace_trust_selection_key(self, adapter: WorkspaceAdapter | None) -> str:
        return adapter.key if adapter is not None else ""

    def _workspace_trust_selected_index_for(self, adapter: WorkspaceAdapter | None) -> int:
        if adapter is None:
            return 0
        return int(self._workspace_trust_selection_map.get(adapter.key, 0))

    def _record_workspace_trust_selection(
        self,
        adapter: WorkspaceAdapter | None,
        line_number: int,
    ) -> None:
        if adapter is None or line_number <= 0:
            return
        self._workspace_trust_selection_map[adapter.key] = int(line_number)
        self.settings.setValue(WORKSPACE_TRUST_SELECTIONS_KEY, json.dumps(self._workspace_trust_selection_map, sort_keys=True))
        self._workspace_trust_selected_index = int(line_number)
        self._workspace_trust_selected_adapter_key = adapter.key
        self._render_workspace_event_log()

    def _restore_workspace_trust_selection(self, adapter: WorkspaceAdapter | None) -> None:
        if adapter is None:
            self._workspace_trust_selected_index = 0
            self._workspace_trust_selected_adapter_key = ""
            return
        selected_index = self._workspace_trust_selected_index_for(adapter)
        if selected_index <= 0:
            self._workspace_trust_selected_index = 0
            self._workspace_trust_selected_adapter_key = adapter.key
            return
        self._workspace_trust_selected_index = selected_index
        self._workspace_trust_selected_adapter_key = adapter.key

    def _workspace_trust_context(
        self,
        adapter: WorkspaceAdapter,
        snapshot: dict[str, Any],
        *,
        event_kind: str = "",
        event_path: Path | None = None,
    ) -> tuple[ulx.TrustContext, dict[str, Any]]:
        root = adapter.root
        entry = snapshot.get("entry")
        manifest_paths = [str(path) for path in snapshot.get("manifest_paths", []) if str(path).strip()]
        recent_changes = [str(item) for item in snapshot.get("recent_changes", []) if str(item).strip()]
        evidence_ids = [
            f"workspace:{adapter.key}:root:{root}",
            f"workspace:{adapter.key}:index:{snapshot.get('index_path')}",
            f"workspace:{adapter.key}:replay:{snapshot.get('replay_path')}",
        ]
        if entry is not None:
            evidence_ids.append(f"workspace:{adapter.key}:entry:{entry}")
        if snapshot.get("git_root"):
            evidence_ids.append(f"workspace:{adapter.key}:git-root:{snapshot.get('git_root')}")
        if snapshot.get("git_branch"):
            evidence_ids.append(f"workspace:{adapter.key}:git-branch:{snapshot.get('git_branch')}")
        if event_kind:
            evidence_ids.append(f"workspace:{adapter.key}:event:{event_kind}")
        if event_path is not None:
            evidence_ids.append(f"workspace:{adapter.key}:event-path:{event_path}")
        for relative_path in manifest_paths[:5]:
            evidence_ids.append(f"workspace:{adapter.key}:manifest:{relative_path}")
        for change in recent_changes[:4]:
            evidence_ids.append(f"workspace:{adapter.key}:change:{change}")

        if not evidence_ids:
            evidence_ids.append(f"workspace:{adapter.key}:fallback")

        exists = bool(snapshot.get("exists"))
        is_git = bool(snapshot.get("is_git"))
        git_dirty = bool(snapshot.get("git_dirty"))
        file_count = int(snapshot.get("file_count", 0) or 0)
        dir_count = int(snapshot.get("dir_count", 0) or 0)
        manifest_count = len(manifest_paths)
        change_count = len(recent_changes)

        score = 0.25
        if exists:
            score += 0.20
        if is_git:
            score += 0.15
        else:
            score += 0.05
        if not git_dirty:
            score += 0.08
        else:
            score -= 0.02
        if entry is not None:
            score += 0.10
        score += min(0.12, manifest_count * 0.02)
        score += min(0.08, change_count * 0.015)
        score += min(0.07, ((file_count + dir_count) / 4000.0))
        if event_kind:
            score += 0.03
        if event_path is not None:
            score += 0.02
        score = max(0.05, min(0.98, score))

        authority = 0.45
        if is_git:
            authority += 0.20
        if not git_dirty:
            authority += 0.12
        if entry is not None:
            authority += 0.08
        authority += min(0.10, manifest_count * 0.01)
        authority = max(0.05, min(0.98, authority))

        now = datetime.now(timezone.utc).isoformat()
        trust_payload = {
            "adapter": adapter.key,
            "name": adapter.name,
            "root": str(root),
            "exists": exists,
            "is_git": is_git,
            "git_dirty": git_dirty,
            "git_branch": snapshot.get("git_branch", ""),
            "git_root": snapshot.get("git_root", ""),
            "entry": str(entry) if entry is not None else "",
            "manifest_paths": manifest_paths[:8],
            "recent_changes": recent_changes[:8],
            "event_kind": event_kind,
            "event_path": str(event_path) if event_path is not None else "",
            "file_count": file_count,
            "dir_count": dir_count,
            "score": round(score, 6),
            "authority": round(authority, 6),
        }
        payload_hash = hashlib.sha3_256(json.dumps(trust_payload, sort_keys=True, default=str).encode(DEFAULT_ENCODING)).hexdigest()
        weights_payload = {
            "exists": 0.20,
            "git": 0.15,
            "dirty": 0.08,
            "entry": 0.10,
            "manifest": 0.12,
            "changes": 0.08,
            "size": 0.07,
            "event": 0.05,
            "path": 0.02,
        }
        weights_hash = hashlib.sha3_256(json.dumps(weights_payload, sort_keys=True, default=str).encode(DEFAULT_ENCODING)).hexdigest()
        revision = ulx.normalize_trust_context(
            score,
            evidence_ids,
            authority,
            revision=1,
            supersedes="",
            valid_from=now,
            valid_to="",
            decay_rate=0.0,
            provenance=(
                adapter.key,
                adapter.name,
                str(root),
                str(snapshot.get("git_branch", "")),
                event_kind,
                str(event_path) if event_path is not None else "",
            ),
            authority_chain=(
                "ULX IDE",
                "workspace indexer",
                adapter.key,
            ),
            weights_hash=weights_hash,
            artifact_hash=payload_hash,
        )
        return revision, trust_payload

    def _sync_workspace_trust_state(
        self,
        adapter: WorkspaceAdapter | None,
        snapshot: dict[str, Any] | None = None,
        *,
        event_kind: str = "",
        event_path: Path | None = None,
    ) -> ulx.TrustRevision | None:
        if adapter is None or not adapter.root.exists():
            return None
        ledger = self._workspace_trust_ledger(adapter)
        current_snapshot = snapshot or self._collect_workspace_metadata(adapter)
        trust_context, trust_payload = self._workspace_trust_context(
            adapter,
            current_snapshot,
            event_kind=event_kind,
            event_path=event_path,
        )
        previous = ledger.trust_state_for(adapter.key)
        if previous is not None and previous.context.artifactHash == trust_context.artifactHash:
            self._restore_workspace_trust_selection(adapter)
            return previous
        revision_number = previous.revision + 1 if previous is not None else 1
        if previous is not None:
            trust_context = ulx.normalize_trust_context(
                trust_context.score,
                trust_context.evidenceIds,
                trust_context.authorityLevel,
                trust_context.band,
                revision=revision_number,
                supersedes=previous.recordHash,
                valid_from=trust_context.validFrom,
                valid_to=trust_context.validTo,
                decay_rate=trust_context.decayRate,
                provenance=trust_context.provenance,
                authority_chain=trust_context.authorityChain,
                weights_hash=trust_context.weightsHash,
                artifact_hash=trust_context.artifactHash,
            )
        revision_record = ulx.TrustRevision(
            trustId=f"trust::{adapter.key}",
            subjectId=adapter.key,
            context=trust_context,
            timestamp=trust_context.validFrom or datetime.now(timezone.utc).isoformat(),
            revision=revision_number,
            supersedes=previous.recordHash if previous is not None else "",
        )
        recorded = ledger.record_trust_revision(revision_record)
        self._restore_workspace_trust_selection(adapter)
        return recorded

    def _workspace_trust_clause_html(self) -> str:
        items = "".join(
            f"<li style='margin: 0 0 4px 18px;'>{html_escape(clause)}</li>"
            for clause in TFS_CLAUSES
        )
        return (
            "<div style='margin-top: 10px;'>"
            "<div style='color: #8cc3ff; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;'>Trust Clauses</div>"
            f"<ul style='margin: 6px 0 0 0; padding: 0; color: #d9dce3;'>{items}</ul>"
            "</div>"
        )

    def _workspace_trust_revision_label(self, revision: ulx.TrustRevision, line_number: int) -> str:
        selected = (
            revision.subjectId == self._workspace_trust_selected_adapter_key
            and line_number == self._workspace_trust_selected_index
        )
        row_style = (
            "background: rgba(96, 165, 250, 0.18); border: 1px solid rgba(140, 195, 255, 0.8); border-radius: 6px; padding: 2px 4px;"
            if selected
            else "padding: 2px 4px;"
        )
        details = [
            f"#{line_number:03d}",
            f"revision={revision.revision}",
            f"trust={revision.context.score:.2f}/{revision.context.band}",
        ]
        if revision.context.evidenceIds:
            details.append(f"evidence={len(revision.context.evidenceIds)}")
        if revision.context.authorityChain:
            details.append(f"authority={len(revision.context.authorityChain)}")
        if revision.context.supersedes:
            details.append(f"supersedes={revision.context.supersedes[:12]}")
        if revision.timestamp:
            details.append(str(revision.timestamp))
        return (
            f"<div style='{row_style}'>"
            f"<a href='workspace-trust:{line_number}'>"
            f"{html_escape(' | '.join(details))}"
            "</a>"
            "</div>"
        )

    def _workspace_trust_receipt_label(self, receipt: ulx.TrustReceipt) -> str:
        details = [
            f"artifact={receipt.artifactKind}",
            f"id={receipt.artifactId}",
            f"band={receipt.trustBand}",
            f"score={receipt.trustScore:.2f}",
            f"replay={receipt.replayIndex}",
        ]
        return (
            "<div style='padding: 2px 4px;'>"
            f"{html_escape(' | '.join(details))}"
            "</div>"
        )

    def _workspace_trust_html(
        self,
        adapter: WorkspaceAdapter | None,
        snapshot: dict[str, Any] | None = None,
    ) -> str:
        if adapter is None:
            return (
                "<div style='font-family: monospace; color: #d9dce3; background: rgba(12, 14, 20, 0.95); "
                "border: 1px solid #262a38; border-radius: 10px; padding: 8px;'>"
                "(no active workspace)"
                "</div>"
            )
        ledger = self._workspace_trust_ledger(adapter)
        snapshot = snapshot or self._collect_workspace_metadata(adapter)
        current_revision = ledger.trust_state_for(adapter.key)
        routing = None
        trust_context = current_revision.context if current_revision is not None else None
        if trust_context is not None:
            governance_score = 0.88 if snapshot.get("is_git") else 0.62
            if snapshot.get("git_dirty"):
                governance_score -= 0.08
            cost_score = max(0.35, 1.0 - min(int(snapshot.get("file_count", 0)) / 5000.0, 0.55))
            performance_score = max(0.35, 1.0 - min(int(snapshot.get("dir_count", 0)) / 1000.0, 0.45))
            routing = ulx.evaluate_trust_routing(governance_score, cost_score, performance_score, trust_context)
        clauses_html = self._workspace_trust_clause_html()
        summary_bits: list[str] = [
            f"Adapter: {html_escape(adapter.name)}",
            f"Root: {html_escape(str(adapter.root))}",
            f"Ledger revisions: {len(ledger.trust_revisions)}",
            f"Receipts: {len(ledger.receipts)}",
        ]
        if current_revision is not None:
            summary_bits.extend(
                [
                    f"Current trust: {current_revision.context.score:.2f} ({current_revision.context.band})",
                    f"Authority: {current_revision.context.authorityLevel:.2f}",
                    f"Evidence refs: {len(current_revision.context.evidenceIds)}",
                ]
            )
        parts = [
            "<div style='font-family: monospace; color: #d9dce3; background: rgba(12, 14, 20, 0.95); "
            "border: 1px solid #262a38; border-radius: 10px; padding: 8px;'>",
            "<div style='color: #8cc3ff; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;'>Trust Console</div>",
            f"<div style='margin-top: 4px;'>{html_escape(' | '.join(summary_bits))}</div>",
        ]
        if current_revision is not None:
            parts.append("<div style='height: 8px;'></div>")
            parts.append("<div style='color: #8cc3ff; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;'>Live Trust State</div>")
            parts.append(
                "<div>"
                f"revision {current_revision.revision} · score {current_revision.context.score:.2f} · band {html_escape(current_revision.context.band)} · "
                f"authority {current_revision.context.authorityLevel:.2f} · artifact {html_escape(current_revision.recordHash[:16])}"
                "</div>"
            )
            parts.append(
                "<div>"
                f"evidence {html_escape(', '.join(current_revision.context.evidenceIds[:5]))}"
                "</div>"
            )
            parts.append(
                "<div>"
                f"provenance {html_escape(' / '.join(current_revision.context.provenance[:4]))}"
                "</div>"
            )
            parts.append(
                "<div>"
                f"routing: trust={routing.tierScores['trust']:.3f} · total={routing.total:.3f} · blocked={str(routing.blocked).lower()}"
                "</div>"
            )
            parts.append(
                "<div>"
                f"routing context: governance={routing.tierScores['governance']:.3f} · cost={routing.tierScores['cost']:.3f} · performance={routing.tierScores['performance']:.3f}"
                "</div>"
            )
            parts.append(
                "<div>"
                f"justification: {html_escape(' ; '.join(routing.justification))}"
                "</div>"
            )
        parts.append(clauses_html)
        parts.append("<div style='height: 8px;'></div>")
        parts.append(
            "<div style='color: #8cc3ff; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;'>Trust Timeline</div>"
        )
        revisions = ledger.trust_revisions[-120:]
        if revisions:
            start_line = max(1, len(ledger.trust_revisions) - len(revisions) + 1)
            for line_number, revision in enumerate(revisions, start=start_line):
                parts.append(self._workspace_trust_revision_label(revision, line_number))
        else:
            parts.append("<div>(no trust revisions recorded yet)</div>")
        parts.append("<div style='height: 8px;'></div>")
        parts.append(
            "<div style='color: #8cc3ff; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;'>Trust Receipts</div>"
        )
        receipts = ledger.receipts[-12:]
        if receipts:
            for receipt in receipts:
                parts.append(self._workspace_trust_receipt_label(receipt))
        else:
            parts.append("<div>(no trust receipts recorded yet)</div>")
        parts.append("</div>")
        return "".join(parts)

    def _workspace_trust_event_label(self, revision: ulx.TrustRevision, line_number: int) -> str:
        return self._workspace_trust_revision_label(revision, line_number)

    def _sync_workspace_event_log_from_artifact(self, adapter: WorkspaceAdapter | None) -> None:
        events = self._load_workspace_replay_events(adapter)
        if events:
            self._workspace_event_log = [event for event in events if isinstance(event, dict)]
            self._workspace_event_seq = max((int(entry.get("seq", 0)) for entry in self._workspace_event_log), default=0)
        self._restore_workspace_replay_selection(adapter)
        self._restore_workspace_trust_selection(adapter)
        if adapter is not None and adapter.root.exists():
            self._sync_workspace_trust_state(adapter)
        self._render_workspace_event_log()

    def _workspace_focus_interval(self) -> int:
        depth = max(0, min(self._workspace_hover_depth, 6))
        intervals = [260, 220, 180, 150, 130, 115, 100]
        return intervals[depth]

    def _operator_console_section_html(self, title: str, body: str, *, subtitle: str = "", accent: str = "#8cc3ff") -> str:
        subtitle_html = (
            f"<div style='margin-top: 4px; color: #94a3b8; font-size: 0.86rem;'>{html_escape(subtitle)}</div>"
            if subtitle
            else ""
        )
        return (
            "<section style='background: rgba(18, 20, 27, 0.96); border: 1px solid #262a38; "
            "border-radius: 14px; padding: 12px; box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);'>"
            f"<div style='color: {accent}; font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase;'>{html_escape(title)}</div>"
            f"{subtitle_html}"
            f"<div style='margin-top: 10px; color: #d9dce3; white-space: pre-wrap; line-height: 1.5;'>{body}</div>"
            "</section>"
        )

    def _workspace_replay_artifact_html(self, adapter: WorkspaceAdapter | None) -> str:
        replay_path = self._workspace_replay_path(adapter)
        summary = self._workspace_replay_summary(adapter)
        coordinator_lines = [
            "Page Coordinator: CEP Artifact Surface",
            "Pattern: coordinator / summary / primary / detail / action / evidence / shared utilities",
            f"Artifact root: {self._path_label(replay_path) if replay_path is not None else '(no replay artifact path)'}",
        ]
        summary_lines = [
            f"Replay signature: {summary.get('signature', '(unknown)')}",
            f"Replay events: {summary.get('event_count', 0)}",
            f"Selected replay line: {self._workspace_replay_selected_line}",
        ]
        detail_lines: list[str] = []
        primary_lines: list[str] = []
        evidence_lines = [
            f"Artifact path: {self._path_label(replay_path) if replay_path is not None else '(unavailable)'}",
            f"Replay signature: {summary.get('signature', '(unknown)')}",
            f"Replay events: {summary.get('event_count', 0)}",
            f"Selected line: {self._workspace_replay_selected_line}",
        ]
        utility_lines = [
            "Shared types/utilities:",
            "ReplayBrowserPane",
            "JSONL replay artifact loader",
            "Selected event anchors",
        ]

        if replay_path is None:
            primary_lines.append("(no replay artifact path available)")
            detail_lines.append("(no selected event)")
        else:
            try:
                raw_lines = replay_path.read_text(encoding=DEFAULT_ENCODING).splitlines()
            except Exception as exc:
                primary_lines.append(f"Unable to read replay artifact: {type(exc).__name__}: {exc}")
                detail_lines.append("(artifact load failed)")
            else:
                if not raw_lines:
                    primary_lines.append(f"Replay artifact: {replay_path}")
                    primary_lines.append("(replay artifact is empty)")
                    detail_lines.append("(artifact contains no lines)")
                else:
                    tail = raw_lines[-48:]
                    start_line = max(1, len(raw_lines) - len(tail) + 1)
                    for offset, line in enumerate(tail, start=start_line):
                        link = f"workspace-replay:{offset}"
                        selected = offset == self._workspace_replay_selected_line
                        marker = "[selected] " if selected else ""
                        primary_lines.append(f"{marker}{offset:04d}: {line} ({link})")
                    selected_line = self._workspace_replay_selected_line
                    if 1 <= selected_line <= len(raw_lines):
                        detail_lines.extend(
                            [
                                f"Selected line: {selected_line}",
                                raw_lines[selected_line - 1],
                            ]
                        )
                    else:
                        detail_lines.append("(no selected replay line)")

        action_lines = [
            "Jump to selected line by activating the selected row in the artifact view.",
            "Use the row anchors to replay a specific artifact line.",
            "Refresh the surface by changing workspace replay selection.",
        ]

        sections = [
            self._operator_console_section_html("Page Coordinator", html_escape("\n".join(coordinator_lines)), subtitle="Surface orchestration and selection state", accent="#4ade80"),
            self._operator_console_section_html("Summary Panel", html_escape("\n".join(summary_lines)), subtitle="Artifact identity and high-level replay state"),
            self._operator_console_section_html("Primary View", html_escape("\n".join(primary_lines)), subtitle="Artifact timeline / log tail"),
            self._operator_console_section_html("Detail Panel", html_escape("\n".join(detail_lines)), subtitle="Selected event / line detail", accent="#f59e0b"),
            self._operator_console_section_html("Action Panel", html_escape("\n".join(action_lines)), subtitle="Operator actions available on this surface", accent="#38bdf8"),
            self._operator_console_section_html("Evidence Panel", html_escape("\n".join(evidence_lines)), subtitle="Provenance, selection, and replay evidence", accent="#a78bfa"),
            self._operator_console_section_html("Shared Types/Utilities", html_escape("\n".join(utility_lines)), subtitle="Reusable rendering helpers and view models", accent="#94a3b8"),
        ]
        return (
            "<div style='font-family: monospace; color: #d9dce3; "
            "background: linear-gradient(180deg, rgba(10, 12, 18, 0.98), rgba(14, 17, 25, 0.98)); "
            "border: 1px solid #262a38; border-radius: 16px; padding: 12px;'>"
            "<div style='display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px;'>"
            + "".join(sections)
            + "</div></div>"
        )

    def _workspace_focus_visuals(self) -> tuple[str, str, str, float]:
        depth = max(0, min(self._workspace_hover_depth, 6))
        palette = [
            ("rgba(12, 14, 20, 0.95)", "#262a38", "#d9dce3", 0.12),
            ("rgba(15, 18, 25, 0.96)", "#29527a", "#dde7f5", 0.18),
            ("rgba(18, 22, 31, 0.97)", "#2f6ea7", "#e2edf9", 0.24),
            ("rgba(20, 25, 35, 0.98)", "#3980c6", "#eef5ff", 0.32),
            ("rgba(22, 28, 39, 0.99)", "#4a9cf0", "#f4f9ff", 0.40),
            ("rgba(24, 31, 44, 0.99)", "#6cb0ff", "#f8fbff", 0.50),
            ("rgba(26, 34, 49, 1.0)", "#8cc3ff", "#ffffff", 0.62),
        ]
        return palette[depth]

    def _workspace_diff_focus_styles(self, active: bool) -> str:
        if not active:
            return (
                "QPlainTextEdit {"
                "background: rgba(12, 14, 20, 0.95);"
                "border: 1px solid #262a38;"
                "border-radius: 10px;"
                "padding: 8px;"
                "color: #d9dce3;"
                "}"
            )
        background, border, text, _ = self._workspace_focus_visuals()
        return (
            "QPlainTextEdit {"
            f"background: {background};"
            f"border: 1px solid {border};"
            "border-radius: 10px;"
            "padding: 8px;"
            f"color: {text};"
            "}"
        )

    def _apply_workspace_diff_focus(self, active: bool) -> None:
        self.workspace_diff_view.setStyleSheet(self._workspace_diff_focus_styles(active))
        if active:
            _, border, _, glow = self._workspace_focus_visuals()
            self.workspace_diff_effect.setColor(QColor(border))
            self.workspace_diff_animation.stop()
            start_blur = 8.0 + (glow * 10.0)
            end_blur = 18.0 + (glow * 16.0)
            self.workspace_diff_effect.setBlurRadius(start_blur)
            self.workspace_diff_animation.setStartValue(start_blur)
            self.workspace_diff_animation.setEndValue(end_blur)
            self.workspace_diff_animation.setKeyValueAt(0.0, start_blur)
            self.workspace_diff_animation.setKeyValueAt(0.5, end_blur)
            self.workspace_diff_animation.setKeyValueAt(1.0, start_blur)
            self.workspace_diff_animation.setDuration(self._workspace_focus_interval())
            self.workspace_diff_animation.start()
        else:
            self.workspace_diff_animation.stop()
            self.workspace_diff_effect.setBlurRadius(0)
            self.workspace_diff_effect.setColor(QColor("#000000"))

    def _tick_workspace_focus_pulse(self) -> None:
        if self._workspace_hover_path is None:
            self._workspace_focus_phase = 0
            self._apply_workspace_diff_focus(False)
            return
        self._sync_workspace_focus_visuals()

    def _on_workspace_breadcrumb_activated(self, link: str) -> None:
        path = self._workspace_context_path
        if path is None:
            self._set_status("No active workspace file")
            return
        if link.startswith("workspace:"):
            target = Path(unquote(link.removeprefix("workspace:")))
            if not target.exists():
                self._set_status("Breadcrumb target no longer exists")
                return
            selected_item = self._ensure_workspace_tree_item(target)
            if selected_item is not None:
                self._reveal_workspace_tree_item(selected_item)
            adapter = self._adapter_for_path(target) or self._selected_workspace_adapter()
            self._sync_current_file_context(target, adapter)
            if target.is_file():
                self._set_status(f"Breadcrumb selected {self._path_label(target)}")
            else:
                self._set_status(f"Breadcrumb selected {self._path_label(target)}")
            self._record_workspace_event("breadcrumb.select", target, adapter, "segment")
            return
        if link == "reveal":
            selected_item = self._ensure_workspace_tree_item(path)
            if selected_item is None:
                self._set_status("Active file is not visible in the tree")
                return
            self.workspace_tree.setCurrentItem(selected_item)
            self.workspace_tree.scrollToItem(selected_item)
            self.workspace_tree.setFocus()
            self._set_status(f"Revealed {self._path_label(path)}")
            self._record_workspace_event("breadcrumb.reveal", path, self._adapter_for_path(path), "")
            return
        if link == "open":
            if not path.exists() or not path.is_file():
                self._set_status("Active selection is not a file")
                return
            if not self._confirm_discard():
                return
            self.load_path(path)
            self._set_status(f"Opened {self._path_label(path)} from breadcrumb")
            self._record_workspace_event("breadcrumb.open", path, self._adapter_for_path(path), "")

    def _on_workspace_breadcrumb_hovered(self, link: str) -> None:
        if not link:
            self._workspace_hover_path = None
            self._workspace_hover_depth = 0
            self._sync_workspace_focus_visuals()
            return
        if link == "open":
            self._workspace_hover_path = self._workspace_context_path
            self._workspace_hover_depth = self._workspace_path_depth(self._workspace_context_path)
            self._sync_workspace_focus_visuals()
            return
        if not link.startswith("workspace:"):
            return
        target = Path(unquote(link.removeprefix("workspace:")))
        if not target.exists():
            self._workspace_hover_path = None
            self._workspace_hover_depth = 0
            self._sync_workspace_focus_visuals()
            return
        self._workspace_hover_path = target
        self._workspace_hover_depth = self._workspace_path_depth(target)
        self._sync_workspace_focus_visuals()
        self._set_status(f"Previewing {self._path_label(target)}")
        self.settings.setValue("last_workspace_hover", str(target))
        self._record_workspace_event("breadcrumb.hover", target, self._adapter_for_path(target), "preview")

    def _activate_workspace_replay_row(self, link: QUrl | str) -> None:
        raw_link = link.toString() if isinstance(link, QUrl) else str(link)
        if not raw_link.startswith("workspace-replay:"):
            return
        try:
            line_number = int(raw_link.removeprefix("workspace-replay:"))
        except Exception:
            self._set_status("Invalid replay artifact selection")
            return
        adapter = self._selected_workspace_adapter()
        replay_path = self._workspace_replay_path(adapter)
        if replay_path is None or not replay_path.exists():
            self._set_status("Replay artifact is not available")
            return
        payload = _workspace_replay_artifact_event_line(replay_path, line_number)
        if not payload:
            self._set_status("Replay event could not be resolved")
            return
        if payload.get("kind") == WORKSPACE_REPLAY_SELECTION_KIND:
            selected_seq = int(payload.get("selected_seq", 0))
            selected_located = _workspace_replay_artifact_event_line_for_seq(replay_path, selected_seq)
            if selected_located is None:
                self._set_status("Selection record no longer resolves")
                return
            line_number, payload = selected_located
            persist_record = False
        else:
            persist_record = True
        self._record_workspace_replay_selection(adapter, line_number, payload, persist_record=persist_record)
        raw_path = payload.get("path")
        if not raw_path:
            self._set_status("Replay event has no target path")
            return
        target = Path(str(raw_path))
        if not target.is_absolute() and adapter is not None:
            target = adapter.root / target
        if not target.exists():
            self._set_status("Replay target no longer exists")
            return
        if target.is_file():
            self.load_path(target)
            self._set_status(f"Replayed {self._path_label(target)} from artifact")
            return
        else:
            item = self._ensure_workspace_tree_item(target)
            if item is not None:
                self._reveal_workspace_tree_item(item)
                self.workspace_tree.setCurrentItem(item)
        self._workspace_context_path = target
        self._sync_current_file_context(target, self._adapter_for_path(target) or adapter)
        self._set_status(f"Replayed {self._path_label(target)} from artifact")

    def _on_workspace_replay_artifact_activated(self, link: QUrl | str) -> None:
        self._activate_workspace_replay_row(link)

    def _on_workspace_aios_replay_activated(self, link: QUrl | str) -> None:
        raw = link.toString() if isinstance(link, QUrl) else str(link)
        if not raw.startswith("workspace:"):
            return
        target = Path(unquote(raw.removeprefix("workspace:")))
        if not target.exists():
            self._set_status("AIOS replay target no longer exists")
            return
        adapter = self._adapter_for_path(target) or self._selected_workspace_adapter()
        selected_item = self._ensure_workspace_tree_item(target)
        if selected_item is not None:
            self._reveal_workspace_tree_item(selected_item)
        if target.is_file():
            if not self._confirm_discard():
                return
            self.load_path(target)
        else:
            self._sync_current_file_context(target, adapter)
        self._record_workspace_event("aios.replay.open", target, adapter, "surface")
        self._set_status(f"Opened AIOS replay target {self._path_label(target)}")

    def _on_workspace_lineage_activated(self, link: QUrl | str) -> None:
        self._activate_workspace_replay_row(link)

    def _on_workspace_trust_activated(self, link: QUrl | str) -> None:
        raw = link.toString() if isinstance(link, QUrl) else str(link)
        if not raw.startswith("workspace-trust:"):
            return
        adapter = self._selected_workspace_adapter()
        if adapter is None:
            return
        try:
            line_number = int(raw.removeprefix("workspace-trust:"))
        except Exception:
            return
        ledger = self._workspace_trust_ledger(adapter)
        if line_number < 1 or line_number > len(ledger.trust_revisions):
            return
        self._record_workspace_trust_selection(adapter, line_number)

    def _workspace_tree_path(self, item: QTreeWidgetItem | None) -> Path | None:
        if item is None:
            return None
        path_text = item.data(0, TREE_PATH_ROLE)
        if not path_text:
            return None
        return Path(str(path_text))

    def _workspace_tree_kind(self, item: QTreeWidgetItem | None) -> str:
        if item is None:
            return ""
        return str(item.data(0, TREE_KIND_ROLE) or "")

    def _workspace_tree_is_loaded(self, item: QTreeWidgetItem | None) -> bool:
        if item is None:
            return False
        return bool(item.data(0, TREE_LOADED_ROLE))

    def _workspace_tree_register_item(self, item: QTreeWidgetItem) -> None:
        path = self._workspace_tree_path(item)
        if path is None:
            return
        self._workspace_tree_index[str(path)] = item

    def _workspace_tree_placeholder_item(self) -> QTreeWidgetItem:
        placeholder = QTreeWidgetItem([TREE_PLACEHOLDER_LABEL])
        placeholder.setData(0, TREE_PATH_ROLE, "")
        placeholder.setData(0, TREE_KIND_ROLE, "placeholder")
        placeholder.setData(0, TREE_LOADED_ROLE, True)
        return placeholder

    def _workspace_tree_child_entries(self, parent_path: Path) -> list[Path]:
        adapter = self._adapter_for_path(parent_path)
        if adapter is not None:
            indexer = self._workspace_indexer(adapter)
            indexer.refresh()
            indexed_children = indexer.children_for(parent_path)
            if indexed_children:
                return indexed_children[:WORKSPACE_TREE_MAX_CHILDREN]
        try:
            children = sorted(
                parent_path.iterdir(),
                key=lambda path: (path.is_file(), path.name.lower()),
            )
        except Exception:
            return []
        selected: list[Path] = []
        for child in children:
            if child.name in IGNORED_TREE_DIRS:
                continue
            if child.is_dir() or child.is_file() and (
                child.suffix.lower() in TEXT_EXTENSIONS or child.name in TEXT_FILE_PRIORITY
            ):
                selected.append(child)
            if len(selected) >= WORKSPACE_TREE_MAX_CHILDREN:
                break
        return selected

    def _workspace_tree_load_children(self, parent_item: QTreeWidgetItem, parent_path: Path, depth: int) -> None:
        if depth >= WORKSPACE_TREE_MAX_DEPTH or self._workspace_tree_is_loaded(parent_item):
            return
        if parent_item.childCount() == 1 and self._workspace_tree_kind(parent_item.child(0)) == "placeholder":
            parent_item.takeChild(0)
        for child in self._workspace_tree_child_entries(parent_path):
            child_item = QTreeWidgetItem([child.name])
            child_item.setData(0, TREE_PATH_ROLE, str(child))
            child_item.setData(0, TREE_LOADED_ROLE, False)
            if child.is_dir():
                child_item.setData(0, TREE_KIND_ROLE, "dir")
                child_item.addChild(self._workspace_tree_placeholder_item())
            else:
                child_item.setData(0, TREE_KIND_ROLE, "file")
                child_item.setData(0, TREE_LOADED_ROLE, True)
            parent_item.addChild(child_item)
            self._workspace_tree_register_item(child_item)
        parent_item.setData(0, TREE_LOADED_ROLE, True)

    def _find_workspace_tree_item(self, path: Path) -> QTreeWidgetItem | None:
        target = str(path)
        cached = self._workspace_tree_index.get(target)
        if cached is not None:
            return cached

        def visit(item: QTreeWidgetItem) -> QTreeWidgetItem | None:
            if item.data(0, TREE_PATH_ROLE) == target:
                return item
            for child_index in range(item.childCount()):
                found = visit(item.child(child_index))
                if found is not None:
                    return found
            return None

        for index in range(self.workspace_tree.topLevelItemCount()):
            found = visit(self.workspace_tree.topLevelItem(index))
            if found is not None:
                return found
        return None

    def _ensure_workspace_tree_item(self, path: Path) -> QTreeWidgetItem | None:
        adapter = self._adapter_for_path(path)
        if adapter is None or not adapter.root.exists():
            return self._find_workspace_tree_item(path)
        try:
            rel_parts = path.resolve().relative_to(adapter.root.resolve()).parts
        except Exception:
            return self._find_workspace_tree_item(path)

        current_item = self._find_workspace_tree_item(adapter.root)
        if current_item is None:
            return self._find_workspace_tree_item(path)
        current_path = adapter.root
        depth = 0
        for part in rel_parts:
            if not self._workspace_tree_is_loaded(current_item):
                self._workspace_tree_load_children(current_item, current_path, depth)
            current_path = current_path / part
            next_item = self._find_workspace_tree_item(current_path)
            if next_item is None:
                self._workspace_tree_load_children(current_item, current_path.parent, depth)
                next_item = self._find_workspace_tree_item(current_path)
            if next_item is None:
                return None
            current_item = next_item
            depth += 1
        return current_item

    def _workspace_tree_item_chain(self, path: Path) -> list[QTreeWidgetItem]:
        if not path.exists():
            return []
        adapter = self._adapter_for_path(path)
        if adapter is None:
            item = self._find_workspace_tree_item(path)
            return [item] if item is not None else []
        try:
            resolved = path.resolve()
            root = adapter.root.resolve()
            rel_parts = resolved.relative_to(root).parts
        except Exception:
            item = self._find_workspace_tree_item(path)
            return [item] if item is not None else []

        self._ensure_workspace_tree_item(path)
        current = adapter.root
        chain: list[QTreeWidgetItem] = []
        for part in rel_parts:
            current = current / part
            item = self._find_workspace_tree_item(current)
            if item is None:
                break
            chain.append(item)
        if not chain:
            item = self._find_workspace_tree_item(path)
            if item is not None:
                chain.append(item)
        return chain

    def _workspace_path_depth(self, path: Path | None) -> int:
        if path is None:
            return 0
        adapter = self._adapter_for_path(path)
        if adapter is None:
            return 0
        try:
            return len(path.resolve().relative_to(adapter.root.resolve()).parts)
        except Exception:
            return 0

    def _reveal_workspace_tree_item(self, item: QTreeWidgetItem) -> None:
        parent = item.parent()
        while parent is not None:
            parent.setExpanded(True)
            parent = parent.parent()
        self.workspace_tree.setCurrentItem(item)
        self.workspace_tree.scrollToItem(item)
        self.workspace_tree.setFocus()

    def _workspace_tree_expansion_setting_key(self, adapter: WorkspaceAdapter) -> str:
        return f"workspace_tree_expanded::{adapter.key}"

    def _restore_workspace_tree_expansion(self, adapter: WorkspaceAdapter) -> None:
        self._workspace_tree_expanded_paths = set()
        raw = self.settings.value(self._workspace_tree_expansion_setting_key(adapter), "", type=str)
        if raw:
            try:
                restored = json.loads(raw)
            except Exception:
                restored = []
            if isinstance(restored, list):
                self._workspace_tree_expanded_paths = {str(path) for path in restored}
        if self._workspace_tree_root_item is None:
            return
        for path_text in sorted(self._workspace_tree_expanded_paths):
            path = Path(path_text)
            item = self._ensure_workspace_tree_item(path)
            if item is not None:
                item.setExpanded(True)

    def _clear_workspace_tree_hover(self) -> None:
        for item in self._workspace_hover_items:
            try:
                item.setBackground(0, QBrush())
            except RuntimeError:
                continue
        self._workspace_hover_items = []

    def _set_workspace_tree_hover(self, path: Path | None) -> None:
        self._clear_workspace_tree_hover()
        if path is None or not path.exists():
            return
        chain = self._workspace_tree_item_chain(path)
        if not chain:
            return
        depth = max(0, min(self._workspace_path_depth(path), 6))
        hovered_palette = ["#24425d", "#27506f", "#2a628b", "#2f75a8", "#3683bf", "#4193d8", "#4da3ef"]
        ancestor_palette = ["#182230", "#1a2635", "#1d2b3c", "#203043", "#23354a", "#263a51", "#294057"]
        hovered_brush = QBrush(QColor(hovered_palette[depth]))
        ancestor_brush = QBrush(QColor(ancestor_palette[depth]))
        for index, item in enumerate(chain):
            parent = item.parent()
            while parent is not None:
                parent.setExpanded(True)
                parent = parent.parent()
            item.setBackground(0, hovered_brush if index == len(chain) - 1 else ancestor_brush)
            self._workspace_hover_items.append(item)

    def _set_card_text(self, card: QLabel, title: str, value: str) -> None:
        card.setText(
            f"<div style='font-size:10px; letter-spacing:0.08em; text-transform:uppercase; color:#94a3b8;'>{html_escape(title)}</div>"
            f"<div style='margin-top:4px; font-size:12px; white-space:pre-wrap; color:#e2e8f0;'>{html_escape(value)}</div>"
        )

    def _refresh_workspace_panel(self, adapter: WorkspaceAdapter) -> None:
        snapshot = self._collect_workspace_metadata(adapter)
        root_label = self._path_label(snapshot["root"])
        state_label = "dirty" if snapshot["git_dirty"] else "clean"
        self.workspace_status.setText(
            f"{adapter.name} | {state_label} | {snapshot['git_branch']} | {snapshot['entry_label']}"
        )
        self._set_card_text(
            self.workspace_cards["root"],
            "Root",
            f"{adapter.name}\n{root_label}\n{snapshot['dir_count']} dirs · {snapshot['file_count']} files",
        )
        self._set_card_text(
            self.workspace_cards["git"],
            "Git",
            f"branch {snapshot['git_branch']}\nroot {snapshot['git_root']}\n{state_label}",
        )
        self._set_card_text(
            self.workspace_cards["entry"],
            "Best file",
            f"{snapshot['entry_label']}\n{adapter.description}",
        )
        diff_text = "\n".join(snapshot["git_diffs"][:6]) if snapshot["git_diffs"] else "(no recent diffs or commits)"
        self._set_card_text(
            self.workspace_cards["diff"],
            "Recent diffs",
            diff_text,
        )
        self._set_card_text(
            self.workspace_cards["router"],
            "Sovereign Router X",
            self._workspace_router_summary(adapter, snapshot),
        )
        self._set_card_text(
            self.workspace_cards["aios"],
            "AIOS Constitutional Node",
            self._workspace_aios_summary(adapter, snapshot),
        )
        self._populate_workspace_tree(adapter, snapshot)
        preferred_path = self.current_path if self._path_in_adapter(self.current_path, adapter) else snapshot["entry"]
        self._sync_workspace_event_log_from_artifact(adapter)
        self._sync_current_file_context(preferred_path, adapter)
        self._record_workspace_event("workspace.refresh", preferred_path or adapter.root, adapter, state_label)

    def _populate_workspace_tree(self, adapter: WorkspaceAdapter, snapshot: dict[str, Any] | None = None) -> None:
        selected_path = self.current_path if self._path_in_adapter(self.current_path, adapter) else None
        if selected_path is None and snapshot is not None:
            entry = snapshot.get("entry")
            if isinstance(entry, Path) and entry.exists():
                selected_path = entry

        self._clear_workspace_tree_hover()
        self._workspace_tree_index = {}
        self._workspace_tree_root_item = None
        self.workspace_tree.blockSignals(True)
        self.workspace_tree.clear()
        if not adapter.root.exists():
            missing = QTreeWidgetItem([f"{adapter.name} (missing)"])
            missing.setData(0, TREE_PATH_ROLE, str(adapter.root))
            missing.setData(0, TREE_KIND_ROLE, "missing")
            missing.setData(0, TREE_LOADED_ROLE, True)
            self.workspace_tree.addTopLevelItem(missing)
            self.workspace_tree.expandItem(missing)
            self._workspace_tree_register_item(missing)
            self._workspace_tree_root_item = missing
            self.workspace_tree.blockSignals(False)
            return

        root_item = QTreeWidgetItem([f"{adapter.name} · {adapter.root}"])
        root_item.setData(0, TREE_PATH_ROLE, str(adapter.root))
        root_item.setData(0, TREE_KIND_ROLE, "dir")
        root_item.setData(0, TREE_LOADED_ROLE, False)
        self.workspace_tree.addTopLevelItem(root_item)
        self._workspace_tree_register_item(root_item)
        self._workspace_tree_root_item = root_item

        self._workspace_tree_load_children(root_item, adapter.root, 0)
        root_item.setExpanded(True)
        self.workspace_tree.expandToDepth(1)
        self.workspace_tree.resizeColumnToContents(0)
        self._restore_workspace_tree_expansion(adapter)
        if selected_path is not None:
            selected_item = self._ensure_workspace_tree_item(selected_path)
            if selected_item is not None:
                self._reveal_workspace_tree_item(selected_item)
        self.workspace_tree.blockSignals(False)

    def _on_workspace_tree_current_changed(
        self,
        current: QTreeWidgetItem | None,
        previous: QTreeWidgetItem | None,  # noqa: ARG002
    ) -> None:
        if current is None:
            self._sync_current_file_context(None, self._selected_workspace_adapter())
            return
        path_text = current.data(0, TREE_PATH_ROLE)
        if not path_text:
            self._sync_current_file_context(None, self._selected_workspace_adapter())
            return
        target = Path(str(path_text))
        kind_text = current.data(0, TREE_KIND_ROLE)
        adapter = self._adapter_for_path(target) or self._selected_workspace_adapter()
        if kind_text == "dir" or not target.exists():
            self._sync_current_file_context(target, adapter)
            self._record_workspace_event("tree.select", target, adapter, kind_text)
            return
        self._sync_current_file_context(target, adapter)
        self._record_workspace_event("tree.select", target, adapter, kind_text)

    def _on_workspace_tree_item_expanded(self, item: QTreeWidgetItem) -> None:
        path = self._workspace_tree_path(item)
        if path is None:
            return
        adapter = self._adapter_for_path(path) or self._selected_workspace_adapter()
        if adapter is not None and path.is_dir():
            depth = self._workspace_path_depth(path)
            self._workspace_tree_load_children(item, path, depth)
            self._workspace_tree_expanded_paths.add(str(path))
            self.settings.setValue(self._workspace_tree_expansion_setting_key(adapter), json.dumps(sorted(self._workspace_tree_expanded_paths)))
            self._record_workspace_event("tree.expand", path, adapter, f"depth={depth}")

    def _on_workspace_tree_item_collapsed(self, item: QTreeWidgetItem) -> None:
        path = self._workspace_tree_path(item)
        adapter = self._adapter_for_path(path) if path is not None else self._selected_workspace_adapter()
        if path is not None:
            self._workspace_tree_expanded_paths.discard(str(path))
            if adapter is not None:
                self.settings.setValue(self._workspace_tree_expansion_setting_key(adapter), json.dumps(sorted(self._workspace_tree_expanded_paths)))
            self._record_workspace_event("tree.collapse", path, adapter, "")

    def _on_workspace_changed(self, index: int) -> None:
        if not self._workspace_ready:
            return
        adapter = self._adapter_from_index(index)
        if adapter is None:
            return
        previous_index = self._workspace_index(self._previous_workspace_key)
        if not self._confirm_discard():
            self.workspace_combo.blockSignals(True)
            if previous_index >= 0:
                self.workspace_combo.setCurrentIndex(previous_index)
            self.workspace_combo.blockSignals(False)
            return
        self._activate_workspace(adapter, auto_open=True)

    def _adapter_from_index(self, index: int) -> WorkspaceAdapter | None:
        if index < 0 or index >= len(self.workspace_adapters):
            return None
        return self.workspace_adapters[index]

    def _sync_workspace_preview(self, index: int | None = None, auto_open: bool = False) -> None:
        adapter = self._selected_workspace_adapter()
        if adapter is None and self.workspace_adapters:
            adapter = self.workspace_adapters[0]
        self.workspace_key = adapter.key if adapter else ""
        self._previous_workspace_key = self.workspace_key
        self.workspace_status.setText(self._workspace_summary(adapter))
        if adapter is not None:
            self.settings.setValue("last_workspace", adapter.key)
            self._refresh_workspace_panel(adapter)
            if auto_open:
                self._open_workspace_entry(adapter)

    def _open_workspace_entry(self, adapter: WorkspaceAdapter) -> None:
        if not adapter.root.exists():
            QMessageBox.warning(self, APP_NAME, f"Workspace root does not exist:\n{adapter.root}")
            self._set_status(f"Workspace missing: {adapter.name}")
            return
        entry = _adapter_entry_path(adapter)
        if entry is None:
            QMessageBox.information(self, APP_NAME, f"No text entry file was found for {adapter.name}.")
            self._set_status(f"No entry file for {adapter.name}")
            return
        self.load_path(entry)
        self.settings.setValue("last_workspace_entry", str(entry))
        self._set_status(f"Connected workspace: {adapter.name}")

    def _activate_workspace(self, adapter: WorkspaceAdapter, auto_open: bool = True) -> None:
        index = self._workspace_index(adapter.key)
        self._previous_workspace_key = adapter.key
        self.workspace_key = adapter.key
        self.settings.setValue("last_workspace", adapter.key)
        self._refresh_workspace_panel(adapter)
        self._record_workspace_event("workspace.activate", adapter.root, adapter, "auto_open" if auto_open else "manual")
        if auto_open:
            self._open_workspace_entry(adapter)
        if index >= 0 and self.workspace_combo.currentIndex() != index:
            self.workspace_combo.blockSignals(True)
            self.workspace_combo.setCurrentIndex(index)
            self.workspace_combo.blockSignals(False)

    def _open_workspace_tree_item(self, item: QTreeWidgetItem, column: int) -> None:  # noqa: ARG002
        path_text = item.data(0, TREE_PATH_ROLE)
        kind_text = item.data(0, TREE_KIND_ROLE)
        if not path_text:
            return
        if kind_text == "dir":
            item.setExpanded(not item.isExpanded())
            return
        target = Path(str(path_text))
        if not target.exists() or not target.is_file():
            return
        if not self._confirm_discard():
            return
        self.load_path(target)
        self._set_status(f"Opened tree file: {self._path_label(target)}")

    def refresh_workspace_adapters(self) -> None:
        self._populate_workspace_combo()
        adapter = self._selected_workspace_adapter()
        if adapter is not None:
            self._refresh_workspace_panel(adapter)
            self._set_status(f"Workspace refreshed: {adapter.name}")
            self._record_workspace_event("workspace.refresh", adapter.root, adapter, "manual")
        self._render_workspace_substrate_readiness()
        self._render_workspace_merge_report()

    def _mergeable_workspace_adapters(self) -> list[WorkspaceAdapter]:
        mergeable: list[WorkspaceAdapter] = []
        base_root = BASE_DIR.resolve()
        for adapter in self.workspace_adapters:
            if not adapter.root.exists():
                continue
            try:
                if adapter.root.resolve() == base_root:
                    continue
            except Exception:
                continue
            mergeable.append(adapter)
        return mergeable

    def _substrate_manifest_payload(self) -> dict[str, Any]:
        adapters = self._mergeable_workspace_adapters()
        return {
            "substrates": [
                {
                    "id": adapter.key,
                    "name": adapter.name,
                    "source": str(adapter.root),
                    "domain": "workspace",
                    "layer": "projection",
                    "status": "normalized",
                    "owner": "jon",
                    "promotion": "requires-evidence",
                    "branch": _git_scalar(adapter.root, ["rev-parse", "--abbrev-ref", "HEAD"], default=""),
                }
                for adapter in adapters
            ]
        }

    def _workspace_substrate_readiness_path(self) -> Path:
        return BASE_DIR / ".ulx-migration" / "substrate-readiness.json"

    def _workspace_substrate_readiness_payload(self) -> dict[str, Any]:
        records: list[dict[str, Any]] = []
        ready_count = 0
        needs_adaptation_count = 0
        do_not_merge_count = 0
        for adapter in self.workspace_adapters:
            root_exists = adapter.root.exists()
            entry_path = _adapter_entry_path(adapter)
            has_entry = entry_path is not None
            git_repo = _git_is_repo(adapter.root) if root_exists else False
            if not root_exists:
                status = "do not merge"
                reason = "workspace root missing"
                do_not_merge_count += 1
            elif not has_entry:
                status = "needs adaptation"
                reason = "no recognized substrate entrypoint"
                needs_adaptation_count += 1
            else:
                status = "substrate-ready"
                ready_count += 1
                reason = "recognized entrypoint available"
            records.append(
                {
                    "key": adapter.key,
                    "name": adapter.name,
                    "root": str(adapter.root),
                    "rootExists": root_exists,
                    "gitRepo": git_repo,
                    "entryPoint": str(entry_path) if entry_path is not None else "",
                    "status": status,
                    "reason": reason,
                    "description": adapter.description,
                }
            )
        return {
            "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "summary": {
                "substrateReady": ready_count,
                "needsAdaptation": needs_adaptation_count,
                "doNotMerge": do_not_merge_count,
                "total": len(records),
            },
            "records": records,
        }

    def _workspace_substrate_readiness_html(self) -> str:
        payload = self._workspace_substrate_readiness_payload()
        path = self._workspace_substrate_readiness_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        try:
            path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding=DEFAULT_ENCODING)
        except Exception:
            pass
        summary = payload.get("summary", {}) if isinstance(payload, dict) else {}
        records = payload.get("records", []) if isinstance(payload, dict) else []
        if not isinstance(summary, dict):
            summary = {}
        if not isinstance(records, list):
            records = []
        lines: list[str] = [
            "<div style='font-family: monospace; color: #d9dce3; "
            "background: rgba(12, 14, 20, 0.95); border: 1px solid #262a38; "
            "border-radius: 10px; padding: 8px;'>",
            "<div style='color: #8cc3ff; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;'>Substrate Readiness</div>",
            f"<div>Generated at: {html_escape(str(payload.get('generatedAt', '')))}</div>",
            f"<div>Ready: {html_escape(str(summary.get('substrateReady', 0)))}</div>",
            f"<div>Needs adaptation: {html_escape(str(summary.get('needsAdaptation', 0)))}</div>",
            f"<div>Do not merge: {html_escape(str(summary.get('doNotMerge', 0)))}</div>",
            "<div style='height: 8px;'></div>",
            "<table style='width: 100%; border-collapse: collapse;'>",
            "<thead><tr>"
            "<th style='text-align:left; padding: 4px; border-bottom: 1px solid #2b3142;'>Workspace</th>"
            "<th style='text-align:left; padding: 4px; border-bottom: 1px solid #2b3142;'>Status</th>"
            "<th style='text-align:left; padding: 4px; border-bottom: 1px solid #2b3142;'>Root</th>"
            "<th style='text-align:left; padding: 4px; border-bottom: 1px solid #2b3142;'>Entry</th>"
            "<th style='text-align:left; padding: 4px; border-bottom: 1px solid #2b3142;'>Reason</th>"
            "</tr></thead><tbody>",
        ]
        for record in records:
            if not isinstance(record, dict):
                continue
            lines.append(
                "<tr>"
                f"<td style='padding: 4px; border-bottom: 1px solid #202635;'>{html_escape(str(record.get('name', '')))}</td>"
                f"<td style='padding: 4px; border-bottom: 1px solid #202635;'>{html_escape(str(record.get('status', '')))}</td>"
                f"<td style='padding: 4px; border-bottom: 1px solid #202635;'>{html_escape(str(record.get('root', '')))}</td>"
                f"<td style='padding: 4px; border-bottom: 1px solid #202635;'>{html_escape(str(record.get('entryPoint', '')))}</td>"
                f"<td style='padding: 4px; border-bottom: 1px solid #202635;'>{html_escape(str(record.get('reason', '')))}</td>"
                "</tr>"
            )
        lines.append("</tbody></table></div>")
        return "".join(lines)

    def _render_workspace_substrate_readiness(self) -> None:
        self.workspace_readiness_view.setHtml(self._workspace_substrate_readiness_html())

    def _workspace_merge_report_path(self) -> Path:
        return BASE_DIR / ".ulx-migration" / "merge-report.json"

    def _workspace_merge_report_html(self) -> str:
        report_path = self._workspace_merge_report_path()
        if not report_path.exists():
            return (
                "<div style='font-family: monospace; color: #d9dce3; "
                "background: rgba(12, 14, 20, 0.95); border: 1px solid #262a38; "
                "border-radius: 10px; padding: 8px;'>"
                "Merge report not generated yet."
                "</div>"
            )
        try:
            payload = json.loads(report_path.read_text(encoding=DEFAULT_ENCODING))
        except Exception as error:
            return (
                "<div style='font-family: monospace; color: #ffb4b4; "
                "background: rgba(12, 14, 20, 0.95); border: 1px solid #6b2b2b; "
                "border-radius: 10px; padding: 8px;'>"
                f"Failed to load merge report: {html_escape(str(error))}"
                "</div>"
            )
        if not isinstance(payload, dict):
            return (
                "<div style='font-family: monospace; color: #ffb4b4; "
                "background: rgba(12, 14, 20, 0.95); border: 1px solid #6b2b2b; "
                "border-radius: 10px; padding: 8px;'>"
                "Merge report payload is not a JSON object."
                "</div>"
            )

        generated_at = html_escape(str(payload.get("generatedAt", "")))
        target_repo = html_escape(str(payload.get("targetRepo", "")))
        mode = html_escape(str(payload.get("mode", "")))
        report_path_text = html_escape(str(report_path))
        plan_value = payload.get("plan")
        results_value = payload.get("results")
        plan = plan_value if isinstance(plan_value, list) else []
        results = results_value if isinstance(results_value, list) else []

        lines: list[str] = [
            "<div style='font-family: monospace; color: #d9dce3; "
            "background: rgba(12, 14, 20, 0.95); border: 1px solid #262a38; "
            "border-radius: 10px; padding: 8px;'>",
            "<div style='color: #8cc3ff; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;'>Merge Report</div>",
            f"<div>Report path: {report_path_text}</div>",
            f"<div>Generated at: {generated_at}</div>",
            f"<div>Target repo: {target_repo}</div>",
            f"<div>Mode: {mode}</div>",
            "<div style='height: 8px;'></div>",
            "<div style='color: #8cc3ff; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;'>Plan</div>",
        ]

        if plan:
            lines.append(
                "<table style='width: 100%; border-collapse: collapse;'>"
                "<thead><tr>"
                "<th style='text-align:left; padding: 4px; border-bottom: 1px solid #2b3142;'>Substrate</th>"
                "<th style='text-align:left; padding: 4px; border-bottom: 1px solid #2b3142;'>Source</th>"
                "<th style='text-align:left; padding: 4px; border-bottom: 1px solid #2b3142;'>Normalized</th>"
                "<th style='text-align:left; padding: 4px; border-bottom: 1px solid #2b3142;'>Mode</th>"
                "<th style='text-align:left; padding: 4px; border-bottom: 1px solid #2b3142;'>Branch</th>"
                "</tr></thead><tbody>"
            )
            for item in plan[-40:]:
                if not isinstance(item, dict):
                    continue
                lines.append(
                    "<tr>"
                    f"<td style='padding: 4px; border-bottom: 1px solid #202635;'>{html_escape(str(item.get('id', '')))}</td>"
                    f"<td style='padding: 4px; border-bottom: 1px solid #202635;'>{html_escape(str(item.get('source', '')))}</td>"
                    f"<td style='padding: 4px; border-bottom: 1px solid #202635;'>{html_escape(str(item.get('normalized_dir', '')))}</td>"
                    f"<td style='padding: 4px; border-bottom: 1px solid #202635;'>{html_escape(str(item.get('mode', '')))}</td>"
                    f"<td style='padding: 4px; border-bottom: 1px solid #202635;'>{html_escape(str(item.get('branch', '')))}</td>"
                    "</tr>"
                )
            lines.append("</tbody></table>")
        else:
            lines.append("<div>(no plan entries)</div>")

        lines.extend(
            [
                "<div style='height: 8px;'></div>",
                "<div style='color: #8cc3ff; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;'>Results</div>",
            ]
        )

        if results:
            lines.append(
                "<table style='width: 100%; border-collapse: collapse;'>"
                "<thead><tr>"
                "<th style='text-align:left; padding: 4px; border-bottom: 1px solid #2b3142;'>Substrate</th>"
                "<th style='text-align:left; padding: 4px; border-bottom: 1px solid #2b3142;'>Status</th>"
                "<th style='text-align:left; padding: 4px; border-bottom: 1px solid #2b3142;'>Mode</th>"
                "<th style='text-align:left; padding: 4px; border-bottom: 1px solid #2b3142;'>Commit</th>"
                "<th style='text-align:left; padding: 4px; border-bottom: 1px solid #2b3142;'>Evidence</th>"
                "</tr></thead><tbody>"
            )
            for item in results[-40:]:
                if not isinstance(item, dict):
                    continue
                lines.append(
                    "<tr>"
                    f"<td style='padding: 4px; border-bottom: 1px solid #202635;'>{html_escape(str(item.get('substrate_id', '')))}</td>"
                    f"<td style='padding: 4px; border-bottom: 1px solid #202635;'>{html_escape(str(item.get('status', '')))}</td>"
                    f"<td style='padding: 4px; border-bottom: 1px solid #202635;'>{html_escape(str(item.get('merge_mode', '')))}</td>"
                    f"<td style='padding: 4px; border-bottom: 1px solid #202635;'>{html_escape(str(item.get('merge_commit', '')))}</td>"
                    f"<td style='padding: 4px; border-bottom: 1px solid #202635;'>{html_escape(str(item.get('evidence_bundle', '')))}</td>"
                    "</tr>"
                )
            lines.append("</tbody></table>")
        else:
            lines.append("<div>(no merge results yet; preview to generate the plan or merge to produce results)</div>")

        lines.append("</div>")
        return "".join(lines)

    def _render_workspace_merge_report(self) -> None:
        self.workspace_merge_report_view.setHtml(self._workspace_merge_report_html())

    def _run_workspace_substrate_merge(self, *, dry_run: bool) -> int:
        adapters = self._mergeable_workspace_adapters()
        if not adapters:
            self._set_status("No mergeable substrates found")
            QMessageBox.information(self, APP_NAME, "No mergeable substrates were found in the current workspace adapters.")
            self._render_workspace_merge_report()
            return 0

        if not dry_run:
            summary_lines = [
                "Merge all mergeable workspace substrates into ULX?",
                "",
                *[f"- {adapter.name} :: {adapter.root}" for adapter in adapters],
            ]
            answer = QMessageBox.question(
                self,
                APP_NAME,
                "\n".join(summary_lines),
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.No,
            )
            if answer != QMessageBox.StandardButton.Yes:
                self._set_status("Substrate merge cancelled")
                return 0

        script_path = BASE_DIR / "src" / "core" / "tools" / "migrations" / "ulx_normalize_substrates.py"
        if not script_path.exists():
            QMessageBox.warning(self, APP_NAME, f"Migration script not found:\n{script_path}")
            self._set_status("Substrate merge unavailable")
            self._render_workspace_merge_report()
            return 1

        manifest_payload = self._substrate_manifest_payload()
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding=DEFAULT_ENCODING) as handle:
            json.dump(manifest_payload, handle, indent=2, sort_keys=True)
            handle.write("\n")
            manifest_path = Path(handle.name)

        workspace = BASE_DIR / ".ulx-migration"
        report_path = self._workspace_merge_report_path()
        workspace.mkdir(parents=True, exist_ok=True)
        command = [
            sys.executable,
            str(script_path),
            "--manifest",
            str(manifest_path),
            "--target-repo",
            str(BASE_DIR),
            "--workspace",
            str(workspace),
            "--output",
            str(report_path),
        ]
        if dry_run:
            command.append("--dry-run")

        try:
            result = subprocess.run(command, check=True, capture_output=True, text=True)
        except subprocess.CalledProcessError as error:
            message = error.stderr.strip() or error.stdout.strip() or str(error)
            prefix = "Substrate merge preview failed" if dry_run else "Substrate merge failed"
            QMessageBox.critical(self, APP_NAME, f"{prefix}:\n{message}")
            self._set_status(prefix)
            self._render_workspace_merge_report()
            return error.returncode or 1
        finally:
            try:
                manifest_path.unlink(missing_ok=True)
            except Exception:
                pass

        if dry_run:
            self._set_status(f"Previewed {len(adapters)} substrates")
            self.statusBar().showMessage(f"Previewed {len(adapters)} substrates -> {report_path}")
        else:
            self._set_status(f"Merged {len(adapters)} substrates")
            if report_path.exists():
                self.statusBar().showMessage(f"Merged {len(adapters)} substrates -> {report_path}")
            else:
                self.statusBar().showMessage(f"Merged {len(adapters)} substrates")
            self._refresh_workspace_panel(self._selected_workspace_adapter() or self.workspace_adapters[0])
        self._render_workspace_merge_report()
        if result.stdout.strip():
            print(result.stdout)
        if result.stderr.strip():
            print(result.stderr, file=sys.stderr)
        return 0

    def preview_merge_substrates(self) -> None:
        self._run_workspace_substrate_merge(dry_run=True)

    def merge_all_substrates(self) -> None:
        self._run_workspace_substrate_merge(dry_run=False)

    def open_selected_workspace(self) -> None:
        adapter = self._selected_workspace_adapter()
        if adapter is None:
            self._set_status("No workspace selected")
            return
        if not self._confirm_discard():
            return
        self._activate_workspace(adapter, auto_open=True)

    def open_selected_workspace_entry(self) -> None:
        adapter = self._selected_workspace_adapter()
        if adapter is None:
            self._set_status("No workspace selected")
            return
        if not self._confirm_discard():
            return
        self._activate_workspace(adapter, auto_open=True)

    def _restore_state(self) -> bool:
        restored = False
        last_file = self.settings.value("last_file", "", type=str)
        last_focus = self.settings.value("last_workspace_focus", "", type=str)
        last_hover = self.settings.value("last_workspace_hover", "", type=str)
        replay_selection_raw = self.settings.value(WORKSPACE_REPLAY_SELECTIONS_KEY, "", type=str)
        if replay_selection_raw:
            try:
                loaded_selection_map = json.loads(replay_selection_raw)
            except Exception:
                loaded_selection_map = {}
            if isinstance(loaded_selection_map, dict):
                selection_map: dict[str, int] = {}
                for key, value in loaded_selection_map.items():
                    if not isinstance(key, str):
                        continue
                    try:
                        selection_map[key] = int(value)
                    except Exception:
                        continue
                self._workspace_replay_selection_map = selection_map
        trust_selection_raw = self.settings.value(WORKSPACE_TRUST_SELECTIONS_KEY, "", type=str)
        if trust_selection_raw:
            try:
                loaded_trust_selection_map = json.loads(trust_selection_raw)
            except Exception:
                loaded_trust_selection_map = {}
            if isinstance(loaded_trust_selection_map, dict):
                trust_selection_map: dict[str, int] = {}
                for key, value in loaded_trust_selection_map.items():
                    if not isinstance(key, str):
                        continue
                    try:
                        trust_selection_map[key] = int(value)
                    except Exception:
                        continue
                self._workspace_trust_selection_map = trust_selection_map
        last_example = self.settings.value("last_example", "hello_governed_world.ulx", type=str)
        if last_example in EXAMPLES:
            self.example_combo.setCurrentText(last_example)
        if last_file:
            candidate = Path(last_file)
            if candidate.exists():
                self.load_path(candidate)
                restored = True
        last_workspace = self.settings.value("last_workspace", "ulx-playground", type=str)
        workspace_index = self._workspace_index(last_workspace)
        if workspace_index >= 0:
            self.workspace_combo.blockSignals(True)
            self.workspace_combo.setCurrentIndex(workspace_index)
            self.workspace_combo.blockSignals(False)
            self.workspace_key = last_workspace
            self._previous_workspace_key = last_workspace
        coc_endpoint = self.settings.value(COC_CONTROL_PLANE_API_BASE_KEY, "", type=str)
        if isinstance(coc_endpoint, str) and coc_endpoint.strip():
            self.coc_control_plane_endpoint.setText(coc_endpoint.strip())
        if last_hover:
            hover_candidate = Path(last_hover)
            if hover_candidate.exists():
                self._workspace_hover_path = hover_candidate
                self._workspace_hover_depth = self._workspace_path_depth(hover_candidate)
        elif last_focus:
            focus_candidate = Path(last_focus)
            if focus_candidate.exists() and self._path_in_adapter(focus_candidate, self._selected_workspace_adapter()):
                self._workspace_hover_path = focus_candidate
                self._workspace_hover_depth = self._workspace_path_depth(focus_candidate)
        event_log_raw = self.settings.value("workspace_event_log", "", type=str)
        if event_log_raw:
            try:
                loaded_events = json.loads(event_log_raw)
            except Exception:
                loaded_events = []
            if isinstance(loaded_events, list):
                self._workspace_event_log = [entry for entry in loaded_events if isinstance(entry, dict)]
                self._workspace_event_seq = max((int(entry.get("seq", 0)) for entry in self._workspace_event_log), default=0)
                self._render_workspace_event_log()
        geometry = self.settings.value("geometry")
        if geometry is not None:
            self.restoreGeometry(geometry)
        coc_tab_index_raw = self.settings.value(COC_ACTIVE_TAB_KEY, 0, type=int)
        if hasattr(self, "coc_tabs"):
            coc_tab_index = int(coc_tab_index_raw) if isinstance(coc_tab_index_raw, int) else 0
            if 0 <= coc_tab_index < self.coc_tabs.count():
                self.coc_tabs.blockSignals(True)
                self.coc_tabs.setCurrentIndex(coc_tab_index)
                self.coc_tabs.blockSignals(False)
        return restored

    def _set_source(self, text: str, mark_clean: bool = False) -> None:
        self.source_editor.blockSignals(True)
        self.source_editor.setPlainText(text)
        self.source_editor.blockSignals(False)
        if mark_clean:
            self._dirty = False
            self._update_title()

    def _set_isl_payload(self, text: str, mark_clean: bool = False) -> None:
        self.isl_editor.blockSignals(True)
        self.isl_editor.setPlainText(text)
        self.isl_editor.blockSignals(False)
        if mark_clean:
            self._dirty = False

    def _mark_dirty(self) -> None:
        self._dirty = True
        self._update_title()

    def _update_title(self) -> None:
        suffix = f" - {self.current_path.name}" if self.current_path else " - Untitled"
        if self._dirty:
            suffix += " *"
        self.setWindowTitle(APP_NAME + suffix)
        self.path_label.setText(str(self.current_path) if self.current_path else "Untitled")

    def _set_status(self, message: str) -> None:
        self.statusBar().showMessage(message)

    def _confirm_discard(self) -> bool:
        if not self._dirty:
            return True
        answer = QMessageBox.question(
            self,
            APP_NAME,
            "The current source has unsaved changes. Discard them?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No,
        )
        return answer == QMessageBox.StandardButton.Yes

    def load_example(self, name: str) -> None:
        if name not in EXAMPLES:
            return
        if not self._confirm_discard():
            self.example_combo.blockSignals(True)
            self.example_combo.setCurrentText(self.settings.value("last_example", "hello_governed_world.ulx", type=str))
            self.example_combo.blockSignals(False)
            return
        self._set_source(EXAMPLES[name], mark_clean=True)
        self.settings.setValue("last_example", name)
        self.current_path = None
        self._update_title()
        self._set_status(f"Loaded example: {name}")

    def new_file(self) -> None:
        if not self._confirm_discard():
            return
        self.current_path = None
        self._set_source("", mark_clean=True)
        self._set_status("New file")

    def open_file(self) -> None:
        path, _ = QFileDialog.getOpenFileName(
            self,
            "Open ULX source",
            str(self._workspace_base_dir()),
            "ULX source (*.ulx *.txt);;All files (*.*)",
        )
        if path:
            self.load_path(Path(path))

    def load_path(self, path: Path) -> None:
        try:
            text = _read_text(path)
        except Exception as exc:
            QMessageBox.critical(self, APP_NAME, f"Failed to open {path}:\n{exc}")
            return
        self.current_path = path
        self._set_source(text, mark_clean=True)
        self._dirty = False
        self.settings.setValue("last_file", str(path))
        self._update_title()
        adapter = self._adapter_for_path(path) or self._selected_workspace_adapter()
        self._sync_current_file_context(path, adapter)
        self.settings.setValue("last_workspace_focus", str(path))
        selected_item = self._ensure_workspace_tree_item(path)
        if selected_item is not None:
            self._reveal_workspace_tree_item(selected_item)
        self._set_status(f"Opened {path}")
        self._record_workspace_event("file.open", path, adapter, "editor")

    def save_file(self) -> None:
        if self.current_path is None:
            self.save_file_as()
            return
        try:
            _write_text(self.current_path, self.source_editor.toPlainText())
        except Exception as exc:
            QMessageBox.critical(self, APP_NAME, f"Failed to save {self.current_path}:\n{exc}")
            return
        self._dirty = False
        self._update_title()
        self._set_status(f"Saved {self.current_path}")

    def save_file_as(self) -> None:
        path, _ = QFileDialog.getSaveFileName(
            self,
            "Save ULX source",
            str(self.current_path or self._workspace_base_dir() / "program.ulx"),
            "ULX source (*.ulx);;All files (*.*)",
        )
        if not path:
            return
        self.current_path = Path(path)
        self.save_file()

    def _collect_source(self) -> str:
        return self.source_editor.toPlainText()

    def _reset_views(self) -> None:
        self.output_view.clear()
        self.bytecode_view.clear()
        self.audit_view.clear()
        self.state_view.clear()
        self.signal_view.clear()
        self.validation_view.clear()

    def _show_error(self, title: str, exc: Exception) -> None:
        message = f"{type(exc).__name__}: {exc}"
        self.output_view.setPlainText(f"[ERROR] {message}")
        self.audit_view.setPlainText(message)
        self._set_status(f"{title} failed")

    def _current_isl_payload(self) -> str:
        return self.isl_editor.toPlainText()

    def validate_isl(self) -> None:
        self.validation_view.clear()
        payload = self._current_isl_payload().strip()
        if not payload:
            self.validation_view.setPlainText("(empty payload)")
            self._set_status("ISL payload is empty")
            return
        try:
            parsed = json.loads(payload)
        except Exception as exc:
            self.validation_view.setPlainText(f"[ISL ERROR] {type(exc).__name__}: {exc}")
            self._set_status("ISL validation failed")
            return

        normalized = _json_pretty(parsed)
        self.validation_view.setPlainText(normalized)
        self.output_view.setPlainText("[ISL VALID]\n" + normalized)
        self._set_status("ISL payload parsed successfully")

    def _summarize_program(self, program: Any, entry: str | None, result: Any, interp: Any) -> str:
        modules = _flatten_modules(program)
        function_names = sorted(
            name for name in getattr(interp, "functions", {}) if "::" in name
        )
        signal_events = [event for event in getattr(interp, "audit_trail", []) if event.get("type", "").startswith("SIGNAL")]
        anchor_count = len(getattr(interp, "anchors", []).stack) if getattr(interp, "anchors", None) else 0

        lines = [
            f"Entry: {entry or '(none)'}",
            f"Modules: {', '.join(modules) if modules else '(none)'}",
            f"Functions: {len(function_names)}",
            f"Anchors: {anchor_count}",
            f"Signals: {len(signal_events)}",
            f"Result: {_safe_repr(result)}",
        ]
        return "\n".join(lines)

    def run_program(self) -> None:
        source = self._collect_source()
        self._reset_views()
        try:
            program = ulx.parse(source)
            interp = ulx.Interpreter()
            interp.load_program(program)
            entry = _find_main(program)
            result = interp.run_function(entry) if entry else None
            self._current_program = program
            self._current_interpreter = interp

            self.output_view.setPlainText(
                self._summarize_program(program, entry, result, interp)
            )
            self.audit_view.setPlainText(_audit_lines(interp.audit_trail))
            self.state_view.setPlainText(
                _format_mapping("Globals", interp.globals)
                + "\n\n"
                + f"Current authority: {interp.current_authority}\n"
                + f"Quarantined ids: {len(interp.quarantined)}\n"
                + f"Anchor stack depth: {len(interp.anchors.stack)}"
            )
            self.signal_view.setPlainText(
                _audit_lines(
                    event for event in interp.audit_trail if event.get("type", "").startswith("SIGNAL")
                )
                if any(event.get("type", "").startswith("SIGNAL") for event in interp.audit_trail)
                else "(no signal events)"
            )
            if entry is None:
                self._set_status("Program loaded, but no fn main() entry point was found")
            else:
                self._set_status(f"Executed {entry}")
        except Exception as exc:
            self._show_error("Run", exc)

    def compile_program(self) -> None:
        source = self._collect_source()
        self.bytecode_view.clear()
        try:
            program = ulx.parse(source)
            compiler = ulx.Compiler()
            compiled = compiler.compile_program(program)
            self.bytecode_view.setPlainText(_json_pretty(compiled))
            self.output_view.setPlainText(
                f"Format: {compiled.get('format')}\n"
                f"Constants: {len(compiled.get('constants', []))}\n"
                f"Functions: {len(compiled.get('functions', {}))}\n"
                f"Constitution: {'present' if compiled.get('constitution') else 'absent'}"
            )
            self._set_status("Compiled to ULXB JSON")
        except Exception as exc:
            self._show_error("Compile", exc)

    def closeEvent(self, event) -> None:  # noqa: N802
        if self._confirm_discard():
            self._save_settings()
            event.accept()
        else:
            event.ignore()

    def _save_settings(self) -> None:
        self.settings.setValue("geometry", self.saveGeometry())
        if self.current_path is not None:
            self.settings.setValue("last_file", str(self.current_path))
            self.settings.setValue("last_workspace_focus", str(self.current_path))
        if self._workspace_hover_path is not None:
            self.settings.setValue("last_workspace_hover", str(self._workspace_hover_path))
        self.settings.setValue("last_example", self.example_combo.currentText())
        if self.workspace_key:
            self.settings.setValue("last_workspace", self.workspace_key)
        if hasattr(self, "coc_tabs"):
            self.settings.setValue(COC_ACTIVE_TAB_KEY, self.coc_tabs.currentIndex())
        adapter = self._selected_workspace_adapter()
        if adapter is not None:
            self.settings.setValue(self._workspace_tree_expansion_setting_key(adapter), json.dumps(sorted(self._workspace_tree_expanded_paths)))
        self.settings.setValue("workspace_event_log", json.dumps(self._workspace_event_log, default=str))
        self.settings.setValue(WORKSPACE_REPLAY_SELECTIONS_KEY, json.dumps(self._workspace_replay_selection_map, sort_keys=True))
        self.settings.setValue(WORKSPACE_TRUST_SELECTIONS_KEY, json.dumps(self._workspace_trust_selection_map, sort_keys=True))
        self.settings.setValue(COC_CONTROL_PLANE_API_BASE_KEY, self.coc_control_plane_endpoint.text().strip() or self._coc_control_plane_api_base_url())


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv if argv is None else argv)
    app = QApplication(argv)
    app.setOrganizationName(APP_ORG)
    app.setApplicationName(APP_NAME)
    app.setOrganizationDomain(APP_DOMAIN)
    window = ULXIDEWindow()
    window.show()
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())



