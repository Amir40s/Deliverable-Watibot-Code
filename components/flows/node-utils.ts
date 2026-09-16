export function normalizePaletteType(type: string) {
  return type.replace(/_/g, "-").toLowerCase();
}

function formatNodeLabel(type: string) {
  const normalized = normalizePaletteType(type);
  const overrides: Record<string, string> = {
    "api-request": "API Request",
    "ask-address": "Ask Address",
    "ask-location": "Ask Location",
    "ask-media": "Ask Media",
    "ask-order-number": "Ask Order Number",
    "ask-question": "Ask Question",
    "catalogue-message": "Catalogue Message",
    "connect-flow": "Connect Flow",
    "conversions-api": "Meta Conversions API",
    "google-sheets": "Google Sheets",
    "media-buttons": "Media Buttons",
    "multi-product": "Multi Product",
    "order-info": "Order Info",
    "public-reply": "Public Reply",
    "request-intervention": "Request Intervention",
    "set-attribute": "Set Attribute",
    "shopify-action": "Shopify Action",
    "single-product": "Single Product",
    "whatsapp-forms": "WhatsApp Forms",
    "quick-reply": "Quick Reply",
  };

  return (
    overrides[normalized] ||
    normalized.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

export function getFlowNodeType(type: string) {
  const normalized = normalizePaletteType(type);

  if (normalized.includes("condition")) return "condition";
  if (normalized.includes("start") || normalized === "trigger") return "trigger";
  if (normalized.includes("delay")) return "delay";
  if (normalized.includes("input")) return "input";
  if (normalized.includes("ask-media")) return "ask_media";
  if (normalized.includes("ask-address") || normalized === "address") return "ask_address";
  if (normalized.includes("ask-location") || normalized === "location") return "ask_location";
  if (normalized.includes("ask-question") || normalized === "question") return "ask_question";
  if (normalized.includes("form")) return "whatsapp_forms";
  if (normalized.includes("media-buttons") || normalized === "media" || normalized.includes("media-message")) return "media";
  if (normalized.includes("list")) return "list";
  if (normalized.includes("catalogue")) return "catalogue";
  if (normalized.includes("single")) return "single_product";
  if (normalized.includes("multi")) return "multi_product";
  if (normalized.includes("template")) return "template";
  if (normalized.includes("google-sheets")) return "google_sheets";
  if (normalized.includes("set-attribute")) return "set_attribute";
  if (normalized.includes("add-tag")) return "add_tag";
  if (normalized.includes("api-request") || normalized === "api") return "api_request";
  if (normalized.includes("conversions-api") || normalized.includes("conversion-api")) return "conversions_api";
  if (normalized.includes("request-intervention")) return "request_intervention";
  if (normalized.includes("connect-flow")) return "connect_flow";
  if (normalized.includes("ask-order-number")) return "ask_question";
  if (normalized.includes("order-info")) return "order_info";
  if (normalized.includes("shopify-action")) return "shopify_action";
  if (normalized.includes("public-reply")) return "public_reply";
  if (normalized.includes("carousel")) return "carousel";
  if (normalized.includes("quick-reply") || normalized.includes("quick_reply")) return "quick_reply";
  if (normalized.includes("ai-knowledge") || normalized === "ai_knowledge") return "ai_knowledge";

  return "message";
}

export function getDefaultFlowNodeData(type: string) {
  const normalized = normalizePaletteType(type);

  if (normalized === "ask-order-number") {
    return {
      label: "Ask Order Number",
      question: "Please provide your Order Number (e.g. #1234):",
      attribute: "attr_custom",
      variableName: "order_number",
      format: "number",
    };
  }

  if (normalized === "order-info") {
    return {
      label: "Order Info",
      orderSource: "variable",
      orderNumberVariable: "order_number",
    };
  }

  if (normalized === "public-reply") {
    return {
      label: "Public Reply",
      message: "",
    };
  }

  if (normalized === "quick-reply") {
    return {
      label: "Quick Reply",
      quickReplyId: "",
      quickReplyName: "",
      quickReplyContent: "",
    };
  }

  if (normalized === "conversions-api" || normalized === "conversion-api") {
    return {
      label: "Meta Conversions API",
      conversionType: "Lead",
      currency: "USD",
      amount: "",
      eventSourceId: "",
      testEventCode: "",
      actionSource: "business_messaging",
    };
  }

  return { label: formatNodeLabel(type) };
}
