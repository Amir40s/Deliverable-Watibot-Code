import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { propagatePlanConfigToOrganizations } from "@/lib/plan-config"
import { revalidatePath } from "next/cache"

export async function GET() {
 try {
 const plans = await prisma.plan.findMany({
 orderBy: {
 createdAt:'asc'
 }
 })
 return NextResponse.json(plans)
 } catch (error) {
 console.error("[PLANS_GET]", error)
 return new NextResponse("Internal Error", { status: 500 })
 }
}

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const querySlug = searchParams.get("slug")
    const body = await req.json()
    const { id, slug, ...data } = body

    const finalData = {
      ...data,
      aiChatBotEnabled: data.aiChatBotEnabled !== undefined ? Boolean(data.aiChatBotEnabled) : true,
      apiWebhookAccess: data.apiWebhookAccess !== undefined ? Boolean(data.apiWebhookAccess) : true,
      modulesAccess: data.modulesAccess !== undefined ? data.modulesAccess : {},
      maxCustomFields: -1,
    }

    let plan
    if (id) {
      plan = await prisma.plan.update({
        where: { id },
        data: finalData,
      })
    } else if (querySlug || slug) {
      plan = await prisma.plan.update({
        where: { slug: querySlug || slug },
        data: finalData,
      })
    } else {
      plan = await prisma.plan.create({
        data: {
          ...finalData,
          slug: slug || "",
        },
      })
    }

    const affectedOrganizations = await propagatePlanConfigToOrganizations(plan)
    revalidatePath("/dashboard")
    revalidatePath("/dashboard/quota")
    revalidatePath("/admin/configurations/plans")

    return NextResponse.json({ plan, affectedOrganizations })
  } catch (error) {
    console.error("[PLANS_POST]", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}
