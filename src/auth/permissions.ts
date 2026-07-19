// Define Permission enum locally until Prisma generates it
type Permission =
  | "USER_READ"
  | "USER_WRITE"
  | "USER_DELETE"
  | "ORG_READ"
  | "ORG_WRITE"
  | "ORG_DELETE"
  | "PROJECT_READ"
  | "PROJECT_WRITE"
  | "PROJECT_DELETE"
  | "LEDGER_READ"
  | "LEDGER_WRITE"
  | "LEDGER_DELETE"
  | "BACKUP_READ"
  | "BACKUP_WRITE"
  | "BACKUP_RESTORE"
  | "SYSTEM_READ"
  | "SYSTEM_WRITE"
  | "SYSTEM_ADMIN";

import { getPrisma } from "../persistence/prisma.js";

// Role-based default permissions
const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  ADMIN: [
    "USER_READ", "USER_WRITE", "USER_DELETE",
    "ORG_READ", "ORG_WRITE", "ORG_DELETE",
    "PROJECT_READ", "PROJECT_WRITE", "PROJECT_DELETE",
    "LEDGER_READ", "LEDGER_WRITE", "LEDGER_DELETE",
    "BACKUP_READ", "BACKUP_WRITE", "BACKUP_RESTORE",
    "SYSTEM_READ", "SYSTEM_WRITE", "SYSTEM_ADMIN",
  ],
  OPERATOR: [
    "USER_READ",
    "ORG_READ", "ORG_WRITE",
    "PROJECT_READ", "PROJECT_WRITE",
    "LEDGER_READ", "LEDGER_WRITE",
    "BACKUP_READ",
    "SYSTEM_READ",
  ],
  VIEWER: [
    "USER_READ",
    "ORG_READ",
    "PROJECT_READ",
    "LEDGER_READ",
    "SYSTEM_READ",
  ],
};

/**
 * Check if a user has a specific permission
 */
export async function hasPermission(
  userId: string,
  permission: Permission,
  scope?: string
): Promise<boolean> {
  const prisma = getPrisma();
  
  // Get user with role and permissions
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || !user.isActive) {
    return false;
  }

  // Check explicit permissions if UserPermission model exists
  try {
    const explicitPermissions = await (prisma as any).userPermission.findMany({
      where: {
        userId,
        permission,
        scope: scope || null,
      },
    });

    if (explicitPermissions.length > 0) {
      return true;
    }
  } catch {
    // UserPermission model doesn't exist yet, skip explicit check
  }

  // Fall back to role-based permissions
  const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
  return rolePermissions.includes(permission);
}

/**
 * Check if a user has any of the specified permissions
 */
export async function hasAnyPermission(
  userId: string,
  permissions: Permission[],
  scope?: string
): Promise<boolean> {
  for (const permission of permissions) {
    if (await hasPermission(userId, permission, scope)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a user has all of the specified permissions
 */
export async function hasAllPermissions(
  userId: string,
  permissions: Permission[],
  scope?: string
): Promise<boolean> {
  for (const permission of permissions) {
    if (!(await hasPermission(userId, permission, scope))) {
      return false;
    }
  }
  return true;
}

/**
 * Grant a permission to a user
 */
export async function grantPermission(
  userId: string,
  permission: Permission,
  grantedBy: string,
  scope?: string
): Promise<void> {
  const prisma = getPrisma();
  
  try {
    await (prisma as any).userPermission.create({
      data: {
        userId,
        permission,
        scope,
        grantedBy,
      },
    });
  } catch {
    // UserPermission model doesn't exist yet
    throw new Error("UserPermission model not available. Run database migration first.");
  }
}

/**
 * Revoke a permission from a user
 */
export async function revokePermission(
  userId: string,
  permission: Permission,
  scope?: string
): Promise<void> {
  const prisma = getPrisma();
  
  try {
    await (prisma as any).userPermission.deleteMany({
      where: {
        userId,
        permission,
        scope: scope || null,
      },
    });
  } catch {
    // UserPermission model doesn't exist yet
    throw new Error("UserPermission model not available. Run database migration first.");
  }
}

/**
 * Get all permissions for a user
 */
export async function getUserPermissions(userId: string): Promise<Permission[]> {
  const prisma = getPrisma();
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || !user.isActive) {
    return [];
  }

  // Get role permissions
  const rolePermissions = ROLE_PERMISSIONS[user.role] || [];

  // Get explicit permissions if UserPermission model exists
  let explicitPermissions: Permission[] = [];
  try {
    const userPermissions = await (prisma as any).userPermission.findMany({
      where: { userId },
    });
    explicitPermissions = userPermissions.map((p: any) => p.permission);
  } catch {
    // UserPermission model doesn't exist yet
  }

  // Remove duplicates
  return Array.from(new Set([...rolePermissions, ...explicitPermissions]));
}

/**
 * Get user permissions with scopes
 */
export async function getUserPermissionsWithScopes(
  userId: string
): Promise<{ permission: Permission; scope?: string }[]> {
  const prisma = getPrisma();
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || !user.isActive) {
    return [];
  }

  const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
  const result: { permission: Permission; scope?: string }[] = [];

  // Add role permissions (no scope)
  for (const permission of rolePermissions) {
    result.push({ permission });
  }

  // Add explicit permissions with scopes if UserPermission model exists
  try {
    const userPermissions = await (prisma as any).userPermission.findMany({
      where: { userId },
    });
    for (const userPermission of userPermissions) {
      result.push({
        permission: userPermission.permission,
        scope: userPermission.scope || undefined,
      });
    }
  } catch {
    // UserPermission model doesn't exist yet
  }

  return result;
}
