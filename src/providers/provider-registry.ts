import { type ProviderContract } from "./provider-contract.js";

const registry = new Map<string, ProviderContract>();

export function registerProvider(provider: ProviderContract): void {
  if (registry.has(provider.name)) {
    throw new Error(`Provider already registered: ${provider.name}`);
  }
  registry.set(provider.name, provider);
}

export function getProvider(name: string): ProviderContract {
  const provider = registry.get(name);
  if (!provider) {
    throw new Error(`Unknown provider: ${name}`);
  }
  return provider;
}

export function listProviders(): string[] {
  return Array.from(registry.keys());
}

export function hasProvider(name: string): boolean {
  return registry.has(name);
}

export function clearProviders(): void {
  registry.clear();
}