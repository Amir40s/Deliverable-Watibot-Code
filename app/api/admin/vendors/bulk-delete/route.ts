import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { authenticateProjectKey } from "@/lib/api/project-auth"
import { deleteVendorsBulk } from "@/app/[locale]/admin/vendors/actions"

async function verifyAuth(req: Request) {
  const session = await getServerSession(authOptions)
  if (session?.user) {
    const role = session.user.role?.toUpperCase()
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
      return true
    }
  }

  const auth = await authenticateProjectKey(req as NextRequest)
  if (!auth.error && auth.org) {
    return true
  }

  return false
}

export async function POST(req: Request) {
  try {
    const isAuthorized = await verifyAuth(req)
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const ids = body.ids || body.vendorIds

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "Invalid request payload. Please provide an array of IDs: { ids: string[] }" },
        { status: 400 }
      )
    }

    const result = await deleteVendorsBulk(ids)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      count: result.count,
      failed: result.failed || 0,
      message: `Successfully deleted ${result.count} vendor(s)`,
    })
  } catch (error: any) {
    console.error("Error in POST /api/admin/vendors/bulk-delete:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error while bulk deleting vendors" },
      { status: 500 }
    )
  }
}
