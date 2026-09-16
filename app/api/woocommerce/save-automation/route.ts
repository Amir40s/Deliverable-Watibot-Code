import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { automation } = await req.json();

    await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: {
        woocommerceAutomation: automation,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[SaveWooCommerceAutomation] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
