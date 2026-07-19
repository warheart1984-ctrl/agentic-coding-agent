Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot

function Invoke-StageCommit {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message,

        [Parameter(Mandatory = $true)]
        [string[]]$Paths
    )

    $ResolvedPaths = @()
    foreach ($Path in $Paths) {
        $Candidate = if ($Path.StartsWith('ulx/')) {
            $Path
        } else {
            "ulx/$Path"
        }
        if (Test-Path (Join-Path $RepoRoot $Candidate)) {
            $ResolvedPaths += $Candidate
        } else {
            Write-Warning "Skipping missing path: $Candidate"
        }
    }

    if ($ResolvedPaths.Count -eq 0) {
        Write-Warning "Skipping commit '$Message' because no staged paths exist."
        return
    }

    git -C $RepoRoot add -- @ResolvedPaths
    git -C $RepoRoot commit -m $Message
}

Invoke-StageCommit `
    -Message 'feat(ulx): add journaled migration spine' `
    -Paths @(
        'src/core/migration/index.ts',
        'src/core/migration/engine.ts',
        'src/core/migration/journal.ts',
        'src/core/migration/snapshot.ts',
        'src/core/migration/replay.ts',
        'src/core/migration/rewind.ts',
        'src/core/migration/restore.ts',
        'src/cli/commands/migration.ts',
        'src/daemon/migration.ts',
        'tests/node/migration-journal.test.ts',
        'tests/node/migration-replay.test.ts',
        'tests/node/migration-rewind.test.ts',
        'tests/node/migration-restore.test.ts',
        'constitutional/migration.schema.json',
        'constitutional/migration.conformance.json'
    )

Invoke-StageCommit `
    -Message 'refactor(ulx): establish canonical runtime core' `
    -Paths @(
        'src/core/runtime/index.ts',
        'src/core/runtime/canonicalModel.ts',
        'src/core/runtime/evidenceLedger.ts',
        'src/core/runtime/restorePoint.ts',
        'src/core/replay.ts',
        'src/core/lineage.ts',
        'src/core/csl/index.ts',
        'src/core/csl/runtime.ts',
        'src/core/csl/integration.ts',
        'src/core/csl/replay.ts',
        'src/core/csl/store.ts',
        'src/core/knowledge/store.ts',
        'src/core/knowledge/pipeline.ts',
        'src/core/knowledge/batch.ts'
    )

Invoke-StageCommit `
    -Message 'refactor(ulx): collapse substrate adapters behind ULX' `
    -Paths @(
        'src/core/adapters/workspaces.ts',
        'src/core/adapters/substrates.ts',
        'constitutional/workspace-adapters.json',
        'src/cli/index.ts',
        'src/cli/commands/mergeSubstrates.ts',
        'src/cli/commands/substrateReadiness.ts',
        'src/cli/commands/substrateStatus.ts',
        'src/daemon/index.ts',
        'src/daemon/specificationRegistry.ts',
        'src/daemon/specificationDependencyGraph.ts',
        'src/daemon/launchReadiness.ts',
        'src/daemon/knowledge.ts',
        'src/daemon/sovereignOsConstitutionalKernel.ts',
        'src/console/dataSource.ts',
        'ulx_ide.py'
    )

Invoke-StageCommit `
    -Message 'feat(ulx): migrate substrate behavior into ULX runtime' `
    -Paths @(
        'src/core/runtime/migration/census.ts',
        'src/core/runtime/migration/apply.ts',
        'src/core/runtime/migration/verify.ts',
        'src/core/runtime/migration/restore.ts',
        'src/core/runtime/migration/rewind.ts',
        'tools/migrations/ulx_repo_census.py',
        'tools/migrations/ulx_promote_substrate.py',
        'tools/migrations/ulx_normalize_substrates.py',
        'tools/migrations/ulx_batch_migrate.py',
        'tests/node/migration-roundtrip.test.ts'
    )

Invoke-StageCommit `
    -Message 'test(ulx): lock conformance and migration replay' `
    -Paths @(
        'constitutional/migration.replay.conformance.json',
        'constitutional/migration.restore.conformance.json',
        'constitutional/migration.timeline.conformance.json',
        'tests/node/migration-conformance.test.ts',
        'tests/node/migration-roundtrip.test.ts',
        'src/core/runtime/cutover.ts'
    )

Invoke-StageCommit `
    -Message 'refactor(ulx): retire substrate live paths' `
    -Paths @(
        'src/cli/commands/mergeSubstrates.ts',
        'src/cli/commands/substrateReadiness.ts',
        'tools/migrations/tool-ulx-repo-census.py',
        'tools/migrations/tool-ulx-promote-substrate.py',
        'tools/migrations/tool-ulx-normalize-substrates.py',
        'tools/migrations/tool-ulx-batch-migrate.py'
    )
