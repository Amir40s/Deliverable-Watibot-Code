import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { authenticateProjectKey } from "@/lib/api/project-auth"
import { updateAdminStaffUser, deleteAdminStaffUser } from "@/app/[locale]/admin/staff/actions"
import { verifyAdminPermission } from "@/lib/admin/rbac"
import { prisma } from "@/lib/prisma"

async function verifyAuth(req: Request) {
  const session = await getServerSession(authOptions)
  if (session?.user) {
    const role = String(session.user.role || "").toUpperCase()
    if (role === "SUPER_ADMIN" || role === "ADMIN") {
      return { authorized: true, user: session.user }
    }
  }

  const auth = await authenticateProjectKey(req as NextRequest)
  if (!auth.error && auth.org) {
    return { authorized: true, user: { role: "ADMIN", permissions: null } }
  }

  return { authorized: false, user: null }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await verifyAuth(req)
    if (!auth.authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const staff = await prisma.user.findUnique({
      where: { id },
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

    if (!staff) {
      return NextResponse.json({ error: "Staff account not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: staff })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await verifyAuth(req)
    if (!auth.authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const check = verifyAdminPermission(auth.user, "configurations", "write")
    if (!check.allowed && auth.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden: Configurations write permission required" }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const result = await updateAdminStaffUser(id, body)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: "Staff account updated successfully" })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await verifyAuth(req)
    if (!auth.authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const check = verifyAdminPermission(auth.user, "configurations", "write")
    if (!check.allowed && auth.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden: Configurations write permission required" }, { status: 403 })
    }

    const { id } = await params
    const result = await deleteAdminStaffUser(id)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: "Staff account deleted successfully" })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
