import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { authenticateProjectKey } from "@/lib/api/project-auth"
import { deleteVendor, getVendorFullDetails, updateVendor, changeVendorPassword } from "@/app/[locale]/admin/vendors/actions"

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

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const isAuthorized = await verifyAuth(req)
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const result = await getVendorFullDetails(id)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to fetch vendor details" }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const isAuthorized = await verifyAuth(req)
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const result = await deleteVendor(id)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: "Vendor deleted successfully" })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to delete vendor" }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const isAuthorized = await verifyAuth(req)
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()

    if (body.action === 'changePassword') {
      if (!body.newPassword || body.newPassword.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
      }
      const result = await changeVendorPassword(id, body.newPassword)
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      return NextResponse.json({ success: true })
    }

    const result = await updateVendor({ id, ...body })
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to update vendor" }, { status: 500 })
  }
}
