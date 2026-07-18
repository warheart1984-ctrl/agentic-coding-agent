# Intent Specification Language (ISL) v2.0

Implementation-Neutral Constitutional Specification

## 1. Purpose

ISL defines the constitutional language for expressing intent, authority, evidence binding, execution obligations, validation requirements, and lineage continuity across all conforming runtimes.

## 2. Principles

- Intent is **declarative** — it states what, not how
- Intent **binds to evidence** — every intent declares its evidence requirements
- Intent **declares authority** — the source of permission to act
- Intent is **replayable** — the same intent produces the same outcome
- Intent is **portable** — it works across all conforming runtimes

## 3. Document Structure

```
ISL-Version: 2.0
Intent-ID: <UUID>
Timestamp: <ISO-8601>

intent { ... }
authority { ... }
evidence { ... }
obligations { ... }
validation { ... }
lineage { ... }
```

## 4. Type System

| Category | Types |
|----------|-------|
| **Primitive** | `string`, `integer`, `boolean`, `timestamp`, `uuid` |
| **Constitutional** | `intent`, `authority`, `evidence`, `obligation`, `validation`, `lineage` |
| **Inheritance** | `extends: <intent-id>` |

## 5. Semantics

| Property | Requirement |
|----------|-------------|
| **Interpretable** | Any conforming runtime can understand the intent |
| **Validatable** | The intent structure can be checked for correctness |
| **Replayable** | The same intent produces deterministic results |
| **Evidence-bound** | Every intent declares its evidence contract |
| **Federated** | Intents are portable across runtimes |

## 6. Diagram

```
+-----------------------------+
|        ISL Document         |
+-----------------------------+
| Header                      |
| Intent                      |
| Authority                   |
| Evidence Binding            |
| Obligations                 |
| Validation                  |
| Lineage                     |
+-----------------------------+
```
