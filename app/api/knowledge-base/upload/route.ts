import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncKnowledgeToAssistant } from "@/lib/ai/openai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const orgId = formData.get("orgId") as string;
    let title = formData.get("title") as string;

    if (!file || !orgId) {
      return NextResponse.json({ success: false, error: "File and organization ID are required" }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    if (session?.user) {
      const isSuperAdmin = session.user.role === "SUPER_ADMIN";
      const isImpersonating = !!(session.user.originalAdminId && session.user.originalAdminId !== session.user.id);
      if (!isSuperAdmin && !isImpersonating) {
        const org = await prisma.organization.findUnique({
          where: { id: orgId },
          select: { vendorConfig: true }
        });
        const config = (org?.vendorConfig as Record<string, any> | null) || {};
        if (config.knowledgeBaseManagement === "admin") {
          return NextResponse.json({ success: false, error: "Forbidden: Knowledge Base is managed by administrator." }, { status: 403 });
        }
      }
    }

    if (!title) {
       title = file.name.replace(/\.[^/.]+$/, "");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let content = "";

    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === "pdf") {
      const data = await pdfParse(buffer);
      content = data.text;
    } else if (ext === "docx" || ext === "doc") {
      const result = await mammoth.extractRawText({ buffer });
      content = result.value;
    } else if (ext === "xlsx" || ext === "xls") {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        content += `--- SHEET: ${sheetName} ---\n`;
        content += XLSX.utils.sheet_to_txt(worksheet) + "\n\n";
      });
    } else if (ext === "txt" || ext === "md" || ext === "csv") {
      content = buffer.toString("utf-8");
    } else if (ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "webp") {
      // Vision OCR extraction for Menu / Price List / Document images
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { aiApiKeys: true, aiProviderApiKey: true, aiProvider: true },
      });
      const keys = (org?.aiApiKeys && typeof org.aiApiKeys === "object")
        ? (org.aiApiKeys as Record<string, string>)
        : {};
      const geminiKey = keys["gemini"] || (org?.aiProvider === "gemini" ? org?.aiProviderApiKey : "") || process.env.GEMINI_API_KEY || "";
      const openaiKey = keys["openai"] || (org?.aiProvider === "openai" ? org?.aiProviderApiKey : "") || process.env.OPENAI_API_KEY || "";

      const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      const ocrPrompt = `You are a high-accuracy document, price list, and restaurant menu OCR scanner.
Thoroughly extract ALL text, categories, headings, products, food items, variants, and EXACT prices (e.g. PKR, Rs, $) from this image.
Format every single item clearly on its own line:
- [Item Name]: [Currency] [Price] (Details/Variant/Description)
Ensure numerical prices are strictly captured and preserved so that an automated AI order-taking agent can calculate totals accurately.`;

      if (geminiKey) {
        try {
          const { GoogleGenerativeAI } = await import("@google/generative-ai");
          const genAI = new GoogleGenerativeAI(geminiKey);
          const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
          const genResult = await model.generateContent([
            {
              inlineData: {
                data: buffer.toString("base64"),
                mimeType,
              },
            },
            ocrPrompt,
          ]);
          content = genResult.response.text();
        } catch (geminiErr: any) {
          console.warn("[Upload OCR] Gemini OCR failed, trying fallback:", geminiErr?.message);
        }
      }

      if (!content && openaiKey) {
        try {
          const { default: OpenAI } = await import("openai");
          const openai = new OpenAI({ apiKey: openaiKey });
          const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: ocrPrompt },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:${mimeType};base64,${buffer.toString("base64")}`,
                    },
                  },
                ],
              },
            ],
          });
          content = response.choices[0]?.message?.content || "";
        } catch (openaiErr: any) {
          console.warn("[Upload OCR] OpenAI OCR failed:", openaiErr?.message);
        }
      }

      if (!content) {
        return NextResponse.json({
          success: false,
          error: "Could not extract text from this image. Please ensure your Gemini or OpenAI API key is configured.",
        }, { status: 400 });
      }
    } else {
      return NextResponse.json({ success: false, error: "Unsupported file type. Please upload PDF, Word, Excel, Text, or Image files (PNG, JPG, WebP)." }, { status: 400 });
    }

    const aiAgentId = formData.get("aiAgentId") as string || null;

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ success: false, error: "The file appears to be empty or could not be parsed." }, { status: 400 });
    }

    // Save to database
    const created = await prisma.knowledgeBase.create({
      data: {
        organizationId: orgId,
        title: title,
        content: content,
        fileName: file.name,
        status: "active",
        ...(aiAgentId ? {
          agentFiles: {
            create: { aiAgentId: aiAgentId }
          }
        } : {})
      }
    });

    return NextResponse.json({ 
      success: true, 
      id: created.id, 
      title, 
      content, 
      fileName: file.name 
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to process document" }, { status: 500 });
  }
}
