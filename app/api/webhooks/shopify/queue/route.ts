import { internalSendTemplateMessage } from "@/lib/whatsapp/api";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || "mock_key",
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || "mock_key",
});

export async function POST(req: Request) {
  try {
    const signature = req.headers.get("upstash-signature");
    const bodyText = await req.text();

    if (process.env.NODE_ENV === "production" && signature) {
      const isValid = await receiver.verify({
        signature,
        body: bodyText,
      }).catch(() => false);

      if (!isValid) {
        logger.webhook.error("[QueueConsumer] Invalid QStash signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const payload = JSON.parse(bodyText);
    const { contactId, templateName, language, components } = payload;

    logger.webhook.info(`[QueueConsumer] Processing delayed message for ${contactId}. Template: ${templateName}`);

    await internalSendTemplateMessage(
      contactId,
      templateName,
      language,
      components
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.webhook.error(`[QueueConsumer] Fatal Error: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
