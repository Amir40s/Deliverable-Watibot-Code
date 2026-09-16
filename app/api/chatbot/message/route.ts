import { NextResponse } from "next/server";
import { getAIResponse } from "@/lib/ai/openai";
import { isProviderErrorMessage } from "@/lib/messaging/sanitize";

interface ChatMessage {
 role: "user" | "assistant";
 content: string;
}

export async function POST(request: Request) {
 try {
 const body = await request.json();
 const message = typeof body?.message === "string" ? body.message.trim() : "";
 const history = Array.isArray(body?.history) ? body.history : [];

 if (!message) {
 return NextResponse.json({ error: "Message is required." }, { status: 400 });
 }

 const sanitizedHistory: ChatMessage[] = history
 .filter((item: any) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
 .map((item: any) => ({
 role: item.role,
 content: item.content.trim(),
 }))
 .filter((item: ChatMessage) => item.content.length > 0)
 .slice(-30);

 const reply = await getAIResponse(message, { history: sanitizedHistory });
 const replyText = typeof reply === "string" ? reply : "";

 if (isProviderErrorMessage(replyText)) {
 // Keep detailed vendor errors out of end-user chat UI.
 console.error("[Chatbot Runtime Error]", replyText);
 return NextResponse.json({
 reply: "Chatbot is temporarily unavailable. Please try again later.",
 });
 }

 return NextResponse.json({ reply: replyText || "I am sorry, but I cannot answer right now." });
 } catch (error: any) {
 console.error("[Chatbot API Error]", error);
 return NextResponse.json(
 { reply: "Chatbot is temporarily unavailable. Please try again later." },
 { status: 200 }
 );
 }
}
