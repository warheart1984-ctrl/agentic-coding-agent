# Constitutional State Record (CSR)

Canonical Constitutional State Representation

## 1. Structure

```
csr {
    id: <uuid>
    timestamp: <iso-8601>
    state: { ... }
    evidence: [ ... ]
    authority: { ... }
    lineage: { ... }
    validation: { ... }
    replay: { ... }
}
```

## 2. Fields

| Field | Description |
|-------|-------------|
| `id` | Unique identifier (UUID) |
| `timestamp` | ISO-8601 timestamp |
| `state` | Constitutional state snapshot |
| `evidence` | Array of evidence primitives |
| `authority` | Source authority for this record |
| `lineage` | Hash-linked ancestor chain |
| `validation` | Validation results and invariant checks |
| `replay` | Replay metadata for deterministic reproduction |

## 3. Requirements

CSR **must** be:

| Property | Requirement |
|----------|-------------|
| **Immutable** | Once recorded, CSR cannot be altered |
| **Complete** | All state transitions are represented |
| **Cryptographically verifiable** | Hash-chained integrity |
| **Replayable** | Any CSR can be reproduced deterministically |
| **Federated** | CSRs are portable across runtimes |

## 4. Diagram

```
+-----------------------------+
|            CSR              |
+-----------------------------+
| ID                          |
| Timestamp                   |
| State                       |
| Evidence                    |
| Authority                   |
| Lineage                     |
| Validation                  |
| Replay Metadata             |
+-----------------------------+
```
