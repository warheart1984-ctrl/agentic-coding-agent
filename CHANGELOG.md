# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial constitutional agentic coding system
- CRK-2 components (Law, Execution, Oversight, Judicial layers)
- Agentic SDK for mission development
- GitHub Actions CI workflow
- CODE_OF_CONDUCT.md
- CONTRIBUTING.md
- SECURITY.md
- Issue and PR templates

### Changed
- Updated forge platform gate documentation

## [0.4.0-mission-004] - 2026-07-17

### Added
- **CMAS — Constitutional Multi-Agent System**: 5 constitutional agents (Architect, Builder, Implementor, Validator, Reviewer) with governed workflow pipeline
- **Agent Registry**: subagent spawning, status tracking, parent-child relationships
- **Validator Agent**: 4-check validation suite (governance, replay, evidence, lineage) with integrity certificates
- **Skill Registry**: auto-discovers skills from skillzmcgee (36 modules), engineering-partner-package, and Nova built-in modules; query by capability/source/text
- **Inline Completion Engine**: continuation + FIM fallback, language detection (36 extensions), post-processing
- **SSE + REST Endpoints**: `/api/events`, `/api/receipts`, `/api/cluster`, `/api/complete`
- **Terminal Panel**: dark-themed Cockpit terminal with 8 built-in commands
- **Cross-Platform Desktop**: Electron wrapper (Win NSIS, macOS DMG, Linux AppImage/deb)
- **NGC v1.0 Charter**: formal governance specification (`inas/charter/NGC-COUNCIL-v1.0.md`)
- **INAS Conformance Tests**: 15 tests covering all 4 invariants (E001/E002/X001/R001)
- **Three-Tier Data Bridge**: WebSocket → SSE → REST fallback for Cockpit ClusterMap
- **Platform Skills**: Windows, Linux, macOS skill files in `shell/skills/`
- **Cross-Platform Installers**: PowerShell (Windows), bash (Linux/macOS) in `scripts/`
- **`.gitattributes`**: LF/CRLF normalization per file type
- **Federation module**: `agent/federation/` for multi-agent networking
- **Governance Bridge**: `agent/governance/governanceBridge.ts`

### Changed
- Agent index exports CMAS and Skills modules
- `test:full` includes CMAS tests (40 total tests, all green)
- Install/package scripts updated to v0.4.0, include all new directories
- Package build scripts cross-platform (Win .bat, Linux/macOS .sh)
- `build-exe.ps1` uses proper SEA + postject pipeline

### Fixed
- `validatorVerifyLineage`: correct `workflowId` lookup in `action.payload`
- Error handling in all 5 CMAS agents: status set to `failed` on exception
- `executeFullWorkflow`: wrapped in try/catch, prevents partial state
- Skill registry: replaced `require()` with dynamic `import()` for ESM compat
- Skill registry: paths configurable via `SKILLZMCGEE_PATH` / `ENG_SKILLS_PATH`
- Dead ternary removed from `governance/receipts.ts`
- Redundant non-null assertion removed from skill registry

## [0.2.0-mission-002] - 2026-07-02

### Added
- Mission #002 for founder-independent reproduction
- Nova constitutional platform integration
- Meta Architect governance layer

## [0.1.0] - Initial Release

### Added
- Nova: The Constitutional Agentic Coding System
- Core constitutional layers
- Basic agent framework
