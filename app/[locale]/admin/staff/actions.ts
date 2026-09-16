"use server"

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"
import {
  normalizeAdminPermissions,
  verifyAdminPermission,
  type AdminUserPermissions,
  type AdminStaffUser,
} from "@/lib/admin/rbac"

async function verifySuperOrConfigAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return { authorized: false, error: "Unauthorized: Please log in", session: null }
  }

  const role = String(session.user.role || "").toUpperCase()
  if (role === "SUPER_ADMIN") {
    return { authorized: true, isSuperAdmin: true, session }
  }

  // Check if staff has configurations write permission
  const check = verifyAdminPermission(session.user, "configurations", "write")
  if (!check.allowed) {
    return { authorized: false, error: "Forbidden: Configurations write permission required", session }
  }

  return { authorized: true, isSuperAdmin: false, session }
}

/**
 * Fetch all platform admin and sub-admin accounts.
 */
export async function getAdminStaffUsers(): Promise<{ success: boolean; users?: AdminStaffUser[]; error?: string }> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return { success: false, error: "Unauthorized" }
    }

    const role = String(session.user.role || "").toUpperCase()
    if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
      return { success: false, error: "Forbidden: Admin access required" }
    }

    // Check read permission on configurations or vendors
    const check = verifyAdminPermission(session.user, "configurations", "read")
    if (!check.allowed && role !== "SUPER_ADMIN") {
      return { success: false, error: "Forbidden: Access denied to staff management" }
    }

    const rawUsers = await prisma.user.findMany({
      where: {
        OR: [
          { role: "SUPER_ADMIN" },
          {
            role: "ADMIN",
            organizationId: null,
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        permissions: true,
      },
    })

    const users: AdminStaffUser[] = rawUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: (u.status === "ACTIVE" || u.status === "TRIAL") ? "ACTIVE" : "INACTIVE",
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      permissions: normalizeAdminPermissions(u.permissions, u.role),
    }))

    return { success: true, users }
  } catch (error: any) {
    console.error("Failed to fetch admin staff users:", error)
    return { success: false, error: error?.message || "Failed to load staff accounts" }
  }
}

/**
 * Lightweight query to populate vendor selector in admin scoping UI.
 */
export async function getAllVendorsForPicker(): Promise<{
  success: boolean
  vendors?: { id: string; name: string; slug: string; whatsappNumber?: string | null; status: string }[]
  error?: string
}> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return { success: false, error: "Unauthorized" }
    }

    const orgs = await prisma.organization.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        whatsappNumber: true,
        status: true,
      },
    })

    return { success: true, vendors: orgs }
  } catch (error: any) {
    console.error("Failed to fetch vendors for picker:", error)
    return { success: false, error: error?.message || "Failed to fetch organizations" }
  }
}

/**
 * Create a new platform sub-admin / staff account.
 */
export async function createAdminStaffUser(data: {
  name: string
  email: string
  password?: string
  status?: "ACTIVE" | "INACTIVE"
  permissions: AdminUserPermissions
}): Promise<{ success: boolean; user?: AdminStaffUser; error?: string }> {
  try {
    const auth = await verifySuperOrConfigAdmin()
    if (!auth.authorized) {
      return { success: false, error: auth.error }
    }

    const cleanEmail = data.email?.trim().toLowerCase()
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return { success: false, error: "A valid email address is required" }
    }

    if (!data.name || data.name.trim().length === 0) {
      return { success: false, error: "Staff member name is required" }
    }

    if (!data.password || data.password.length < 6) {
      return { success: false, error: "Password must be at least 6 characters long" }
    }

    const existing = await prisma.user.findUnique({
      where: { email: cleanEmail },
      select: { id: true },
    })

    if (existing) {
      return { success: false, error: `A user with email "${cleanEmail}" already exists` }
    }

    const hashedPassword = await bcrypt.hash(data.password, 10)
    const isSuper = data.permissions.roleName === "Super Admin" && auth.isSuperAdmin

    const created = await prisma.user.create({
      data: {
        name: data.name.trim(),
        email: cleanEmail,
        password: hashedPassword,
        role: isSuper ? "SUPER_ADMIN" : "ADMIN",
        status: data.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
        organizationId: null,
        onboardingCompleted: true,
        onboardingStep: 3,
        permissions: data.permissions as any,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        permissions: true,
      },
    })

    revalidatePath("/admin/staff")
    revalidatePath("/admin/configurations/users")
    revalidatePath("/[locale]/admin/staff", "page")

    return {
      success: true,
      user: {
        id: created.id,
        name: created.name,
        email: created.email,
        role: created.role,
        status: created.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
        createdAt: created.createdAt.toISOString(),
        permissions: normalizeAdminPermissions(created.permissions, created.role),
      },
    }
  } catch (error: any) {
    console.error("Failed to create admin staff user:", error)
    return { success: false, error: error?.message || "Failed to create staff account" }
  }
}

/**
 * Update an existing platform sub-admin / staff account.
 */
export async function updateAdminStaffUser(
  userId: string,
  data: {
    name?: string
    email?: string
    password?: string
    status?: "ACTIVE" | "INACTIVE"
    permissions?: AdminUserPermissions
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await verifySuperOrConfigAdmin()
    if (!auth.authorized) {
      return { success: false, error: auth.error }
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    })

    if (!targetUser) {
      return { success: false, error: "Staff account not found" }
    }

    // Safety: Prevent non-super admin from editing a SUPER_ADMIN
    if (targetUser.role === "SUPER_ADMIN" && !auth.isSuperAdmin) {
      return { success: false, error: "Only a Super Admin can modify Super Admin accounts" }
    }

    const updateData: any = {
      updatedAt: new Date(),
    }

    if (data.name && data.name.trim().length > 0) {
      updateData.name = data.name.trim()
    }

    if (data.email) {
      const cleanEmail = data.email.trim().toLowerCase()
      if (cleanEmail !== targetUser.email) {
        const emailConflict = await prisma.user.findUnique({
          where: { email: cleanEmail },
          select: { id: true },
        })
        if (emailConflict) {
          return { success: false, error: `Email "${cleanEmail}" is already in use by another user` }
        }
        updateData.email = cleanEmail
      }
    }

    if (data.password && data.password.trim().length >= 6) {
      updateData.password = await bcrypt.hash(data.password.trim(), 10)
    }

    if (data.status) {
      // Prevent deactivating own account
      if (auth.session?.user?.id === userId && data.status === "INACTIVE") {
        return { success: false, error: "You cannot deactivate your own account" }
      }
      updateData.status = data.status === "INACTIVE" ? "INACTIVE" : "ACTIVE"
    }

    if (data.permissions) {
      const isSuper = data.permissions.roleName === "Super Admin" && auth.isSuperAdmin
      updateData.role = isSuper ? "SUPER_ADMIN" : "ADMIN"
      updateData.permissions = data.permissions
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    })

    revalidatePath("/admin/staff")
    revalidatePath("/admin/configurations/users")
    revalidatePath("/[locale]/admin/staff", "page")

    return { success: true }
  } catch (error: any) {
    console.error("Failed to update admin staff user:", error)
    return { success: false, error: error?.message || "Failed to update staff account" }
  }
}

/**
 * Delete a platform sub-admin / staff account.
 */
export async function deleteAdminStaffUser(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await verifySuperOrConfigAdmin()
    if (!auth.authorized) {
      return { success: false, error: auth.error }
    }

    // Safety: Prevent self-deletion
    if (auth.session?.user?.id === userId) {
      return { success: false, error: "You cannot delete your own account" }
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    })

    if (!targetUser) {
      return { success: false, error: "Staff account not found" }
    }

    // Safety: Prevent non-super admin from deleting a SUPER_ADMIN
    if (targetUser.role === "SUPER_ADMIN" && !auth.isSuperAdmin) {
      return { success: false, error: "Only a Super Admin can delete Super Admin accounts" }
    }

    // Clean up sessions and accounts
    await prisma.$transaction([
      prisma.account.deleteMany({ where: { userId } }),
      prisma.session.deleteMany({ where: { userId } }),
      prisma.deviceSetting.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ])

    revalidatePath("/admin/staff")
    revalidatePath("/admin/configurations/users")
    revalidatePath("/[locale]/admin/staff", "page")

    return { success: true }
  } catch (error: any) {
    console.error("Failed to delete admin staff user:", error)
    return { success: false, error: error?.message || "Failed to delete staff account" }
  }
}
