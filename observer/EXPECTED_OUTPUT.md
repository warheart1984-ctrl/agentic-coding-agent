# Expected Output — Mission #002

## Successful `nova generate` (factorial)

```
export function factorial(n: number): number {
  ...
}

Receipts:
[
  {
    "id": "<uuid>",
    "timestamp": <number>,
    "action": { "type": "generate", "payload": { "prompt": "..." } },
    "invariantsChecked": ["no-credentials", "no-dangerous-shell"],
    "continuityHash": "<hex>",
    "ledgerHash": "<hex>"
  }
]
```

## Blocked `nova generate` (dangerous)

```
BLOCKED: Invariant violated: no-dangerous-shell — Disallow dangerous shell commands...

Receipts:
[
  {
    "blocked": true,
    "blockReason": "Invariant violated: no-dangerous-shell — ..."
  }
]
```

## Continuity Snapshot

```json
{
  "id": "<uuid>",
  "timestamp": <number>,
  "stateHash": "<sha256-hex>"
}
```

## LLM Router Selection (E10)

```json
{
  "provider": "deepseek",
  "model": "deepseek-chat",
  "temperature": 0.1,
  "maxTokens": 4096,
  "selectionReceiptId": "<uuid>",
  "invariantsChecked": ["model-selection", "E10"]
}
```

## Hardware Probe

```json
{
  "platform": "win32|linux|darwin",
  "arch": "x64|arm64",
  "cpuCores": 8,
  "totalMemoryGB": 16,
  "hasGPU": false,
  "recommendation": "cpu"
}
```

## Receipt JSON Schema

| Field | Type | Required |
|-------|------|----------|
| id | string (UUID) | yes |
| timestamp | number | yes |
| action | AgentAction | yes |
| invariantsChecked | string[] | yes |
| continuityHash | string | yes |
| ledgerHash | string | yes |
| blocked | boolean | no |
| blockReason | string | no |
