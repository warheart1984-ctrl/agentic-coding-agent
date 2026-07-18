const DANGEROUS_PATTERNS = [
  { pattern: "rm -rf", id: "no-dangerous-shell" },
  { pattern: "rm -fr", id: "no-dangerous-shell" },
  { pattern: "dd if=", id: "no-dangerous-disk" },
  { pattern: "> /dev/sd", id: "no-dangerous-disk" },
  { pattern: ":(){ :|:& };:", id: "no-fork-bomb" },
  { pattern: "chmod -R 000", id: "no-permission-destroy" },
];

export const invariantEngine = {
  checkAll(
    action: { type: string; payload?: Record<string, unknown> },
    context: Record<string, unknown>
  ): { ok: boolean; invariantId?: string } {
    const text = JSON.stringify({ action, context });

    for (const dp of DANGEROUS_PATTERNS) {
      if (text.includes(dp.pattern)) {
        return { ok: false, invariantId: dp.id };
      }
    }

    if (!action.type) {
      return { ok: false, invariantId: "missing-action-type" };
    }

    return { ok: true };
  },
};
