from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class FederationSurfaceModule:
    key: str
    title: str
    adapter_key: str
    summary: str
    entry_candidates: tuple[str, ...]
    surfaces: tuple[str, ...]
    relationship_notes: tuple[str, ...]

    def best_entry(self, root: Path) -> Path | None:
        if not root.exists():
            return None
        for relative in self.entry_candidates:
            candidate = root / relative
            if candidate.exists() and candidate.is_file():
                return candidate
        if root.is_dir():
            for child in root.iterdir():
                if child.is_file():
                    return child
        return None


DEFAULT_FEDERATION_MODULES: tuple[FederationSurfaceModule, ...] = (
    FederationSurfaceModule(
        key="aais-core",
        title="AAIS Core Adapter",
        adapter_key="project-infi-aais",
        summary="Explicit ULX adaptor for the AAIS launcher, runtime, and doctrine surfaces.",
        entry_candidates=("launcher.py", "__main__.py", "README.md"),
        surfaces=("launcher", "runtime", "doctrine", "capability-module"),
        relationship_notes=(
            "bridges Project Infi AAIS into the ULX control plane",
            "maps local launch and runtime surfaces into UGR navigation",
        ),
    ),
    FederationSurfaceModule(
        key="project-infinity-main-core",
        title="Project Infinity Main Adapter",
        adapter_key="project-infinity-main",
        summary="Explicit ULX adaptor for the main Project Infinity AAIS spine and blueprint surfaces.",
        entry_candidates=("README.md", "docs/spine/AAIS_MASTER_SPEC.md", "src/aais_blueprint.py"),
        surfaces=("AAIS-spine", "docs-spine", "blueprint", "launcher"),
        relationship_notes=(
            "bridges the legacy Project Infinity mainline into ULX",
            "treats the AAIS spine and blueprint as federated surfaces",
        ),
    ),
    FederationSurfaceModule(
        key="sovereign-ide",
        title="Sovereign IDE Plugin",
        adapter_key="sovereign-ide",
        summary="Sovereign IDE scaffold with PrimeArchitectPlugin for constitutional operations and ULX bridge integration.",
        entry_candidates=("plugins/prime_architect.py", "__init__.py", "README.md"),
        surfaces=("timeline", "shader", "organism", "consensus", "ledger", "audio", "ulx"),
        relationship_notes=(
            "provides PrimeArchitectPlugin for IDE integration",
            "includes ULXBridge for compile, run, trace operations",
            "offers six constitutional operator surfaces",
            "UCDD-compliant constitutional framework",
        ),
    ),
)


def build_default_federation_modules() -> tuple[FederationSurfaceModule, ...]:
    return DEFAULT_FEDERATION_MODULES
