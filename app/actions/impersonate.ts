"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateSecureToken } from "@/lib/auth-utils"

export async function impersonateUser(userId: string) {
 try {
 const session = await getServerSession(authOptions)

 // 1. Verify Admin/Super Admin
 if (!session || session.user.role !== "SUPER_ADMIN") {
 return { error: "Unauthorized" }
 }

 // 2. Find target user
 const targetUser = await prisma.user.findUnique({
 where: { id: userId },
 })

 if (!targetUser) {
 return { error: "User not found" }
 }

 // 3. Generate secure token
 const token = generateSecureToken(64)
 const identifier =`impersonation:${targetUser.email}`
 const expires = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

 // 4. Save to VerificationToken
 await prisma.verificationToken.deleteMany({
 where: { identifier }
 })

 await prisma.verificationToken.create({
 data: {
 identifier,
 token,
 expires
 }
 })

 return { success: true, email: targetUser.email, token }

 } catch (error) {
 console.error("Impersonation error:", error)
 return { error: "Failed to start impersonation" }
 }
}

export async function impersonateAgent(agentId: string) {
  try {
    const session = await getServerSession(authOptions)

    // 1. Verify caller has organization ADMIN or SUPER_ADMIN role
    if (!session || !session.user?.organizationId) {
      return { error: "Unauthorized" }
    }

    const callerRole = session.user.role;
    if (callerRole !== "ADMIN" && callerRole !== "SUPER_ADMIN") {
      return { error: "Only administrators can sign in as agents." }
    }

    const orgId = session.user.organizationId;

    // 2. Find target agent and verify they belong to the same organization
    const targetAgent = await prisma.user.findFirst({
      where: {
        id: agentId,
        organizationId: orgId
      }
    })

    if (!targetAgent) {
      return { error: "Agent not found in your organization." }
    }

    // 3. Generate secure token
    const token = generateSecureToken(64)
    const identifier = `impersonation:${targetAgent.email}`
    const expires = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

    // 4. Save to VerificationToken
    await prisma.verificationToken.deleteMany({
      where: { identifier }
    })

    await prisma.verificationToken.create({
      data: {
        identifier,
        token,
        expires
      }
    })

    return { success: true, email: targetAgent.email, token }

  } catch (error) {
    console.error("Agent impersonation error:", error)
    return { error: "Failed to start agent impersonation" }
  }
}

export async function returnToAdmin() {
  try {
    const session = await getServerSession(authOptions)

    // 1. Verify that this is an active impersonated session
    if (!session || !session.user?.originalAdminId) {
      return { error: "No active admin session to return to." }
    }

    const adminId = session.user.originalAdminId;

    // 2. Fetch the original admin user
    const adminUser = await prisma.user.findUnique({
      where: { id: adminId }
    })

    if (!adminUser) {
      return { error: "Original admin user not found." }
    }

    // 3. Generate secure token for the admin
    const token = generateSecureToken(64)
    const identifier = `impersonation:${adminUser.email}`
    const expires = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

    // 4. Save to VerificationToken
    await prisma.verificationToken.deleteMany({
      where: { identifier }
    })

    await prisma.verificationToken.create({
      data: {
        identifier,
        token,
        expires
      }
    })

    return { success: true, email: adminUser.email, token, role: adminUser.role }

  } catch (error) {
    console.error("Return to admin error:", error)
    return { error: "Failed to return to admin session" }
  }
}
