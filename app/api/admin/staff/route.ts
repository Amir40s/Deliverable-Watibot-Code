import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { authenticateProjectKey } from "@/lib/api/project-auth"
import { getAdminStaffUsers, createAdminStaffUser } from "@/app/[locale]/admin/staff/actions"
import { verifyAdminPermission } from "@/lib/admin/rbac"

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

export async function GET(req: Request) {
  try {
    const auth = await verifyAuth(req)
    if (!auth.authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const check = verifyAdminPermission(auth.user, "configurations", "read")
    if (!check.allowed && auth.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden: Configurations read permission required" }, { status: 403 })
    }

    const result = await getAdminStaffUsers()
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: result.users })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const auth = await verifyAuth(req)
    if (!auth.authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const check = verifyAdminPermission(auth.user, "configurations", "write")
    if (!check.allowed && auth.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden: Configurations write permission required" }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const result = await createAdminStaffUser(body)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: result.user })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
