import { NextRequest, NextResponse } from "next/server";
import { authenticateProjectKey, apiError } from "@/lib/api/project-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/v1/messages/:messageId
 *
 * Retrieves details of a specific message by its internal ID or WhatsApp Message ID (wamid).
 *
 * Headers:
 * X-WatiBot-Project-API-Key: <your_project_api_key>
 */
export async function GET(
 req: NextRequest,
 { params }: { params: Promise<{ messageId: string }> }
) {
 const { messageId } = await params;
 const auth = await authenticateProjectKey(req);
 if (auth.error) return auth.error;
 const { org } = auth;

 // Support lookup by internal ID or wamid
 const message = await prisma.message.findFirst({
 where: {
 OR: [{ id: messageId }, { wamid: messageId }],
 contact: { organizationId: org.id },
 },
 include: {
 contact: {
 select: {
 id: true,
 waId: true,
 name: true,
 organizationId: true,
 },
 },
 sender: { select: { id: true, name: true, email: true } },
 },
 });

 if (!message) {
 return apiError(404, "Message not found.");
 }

 return NextResponse.json({
 id: message.id,
 project_id: org.id,
 contact_id: message.contactId,
 phone_number: message.contact?.waId,
 type: message.type,
 clear_name: message.contact?.name ?? null,
 status: message.status,
 is_HSM: message.type === "template",
 direction: message.direction,
 message: message.content,
 message_content: message.rawBody ?? { text: message.content },
 media_url: message.mediaUrl ?? null,
 delivered_at: message.status === "delivered" ? (message.updatedAt?.getTime() ?? null) : null,
 read_at: message.status === "read" ? (message.updatedAt?.getTime() ?? null) : null,
 sent_at: message.createdAt.getTime(),
 failed_at: message.status === "failed" ? (message.updatedAt?.getTime() ?? null) : null,
 agent_id: message.senderId ?? null,
 agent_name: message.sender?.name ?? null,
 messageId: message.wamid ?? message.id,
 timestamp: message.createdAt.toISOString(),
 chatbot_response: null,
 campaign: null,
 });
}
