export function consensus<T>(plans: T[]): T | null {
  if (!plans || plans.length === 0) return null;
  if (plans.length === 1) return plans[0];
  const serialized = plans.map((p) => JSON.stringify(p));
  const unique = [...new Set(serialized)];
  if (unique.length === 1) return plans[0];
  return plans[0];
}
