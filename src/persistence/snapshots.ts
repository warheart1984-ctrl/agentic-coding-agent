import { getPrisma } from "./prisma.js";

export interface Snapshot {
  id: string;
  name?: string;
  state: Record<string, unknown>;
  metadata: Record<string, unknown>;
  organizationId: string;
  projectId?: string;
  createdAt: Date;
}

export async function insertSnapshot(s: Omit<Snapshot, "id" | "createdAt">): Promise<string> {
  const prisma = getPrisma();
  const created = await prisma.snapshot.create({
    data: {
      name: s.name,
      state: s.state as any,
      metadata: s.metadata as any,
      organizationId: s.organizationId,
      projectId: s.projectId,
    },
  });
  return created.id;
}

export async function getSnapshotById(id: string): Promise<Snapshot | null> {
  const prisma = getPrisma();
  const snapshot = await prisma.snapshot.findUnique({
    where: { id },
  });
  if (!snapshot) return null;
  return {
    id: snapshot.id,
    name: snapshot.name ?? undefined,
    state: snapshot.state as Record<string, unknown>,
    metadata: snapshot.metadata as Record<string, unknown>,
    organizationId: snapshot.organizationId,
    projectId: snapshot.projectId ?? undefined,
    createdAt: snapshot.createdAt,
  };
}

export async function getLatestSnapshot(organizationId: string, projectId?: string): Promise<Snapshot | null> {
  const prisma = getPrisma();
  const snapshot = await prisma.snapshot.findFirst({
    where: {
      organizationId,
      projectId: projectId ?? null,
    },
    orderBy: { createdAt: "desc" },
  });
  if (!snapshot) return null;
  return {
    id: snapshot.id,
    name: snapshot.name ?? undefined,
    state: snapshot.state as Record<string, unknown>,
    metadata: snapshot.metadata as Record<string, unknown>,
    organizationId: snapshot.organizationId,
    projectId: snapshot.projectId ?? undefined,
    createdAt: snapshot.createdAt,
  };
}

export async function querySnapshots(organizationId: string, limit = 100, offset = 0): Promise<Snapshot[]> {
  const prisma = getPrisma();
  const snapshots = await prisma.snapshot.findMany({
    where: { organizationId },
    skip: offset,
    take: limit,
    orderBy: { createdAt: "desc" },
  });
  return snapshots.map((s) => ({
    id: s.id,
    name: s.name ?? undefined,
    state: s.state as Record<string, unknown>,
    metadata: s.metadata as Record<string, unknown>,
    organizationId: s.organizationId,
    projectId: s.projectId ?? undefined,
    createdAt: s.createdAt,
  }));
}