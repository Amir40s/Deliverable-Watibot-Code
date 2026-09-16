export interface ContactVariableItem {
  label: string;
  value: string;
  description: string;
}

export const COMMON_CONTACT_VARIABLES: ContactVariableItem[] = [
  {
    label: "WhatsApp Name",
    value: "{{WhatsApp Name}}",
    description: "Recipient's WhatsApp profile name (fallback to saved contact name)",
  },
  {
    label: "Full Name",
    value: "{{Name}}",
    description: "Recipient's saved contact name",
  },
  {
    label: "First Name",
    value: "{{First Name}}",
    description: "First name extracted from contact name",
  },
  {
    label: "Last Name",
    value: "{{Last Name}}",
    description: "Last name extracted from contact name",
  },
  {
    label: "Phone / WhatsApp Number",
    value: "{{Phone}}",
    description: "Recipient's WhatsApp phone number",
  },
  {
    label: "Email",
    value: "{{Email}}",
    description: "Recipient's email address if available",
  },
];

export interface ResolveVariablesOptions {
  fallback?: string;
  customVariables?: Record<string, any>;
}

/**
 * Resolves all {{variable}} tags in a string against a Contact object and optional context variables.
 * Handles case-insensitivity, underscores/spaces, and custom attributes.
 */
export function resolveContactVariables(
  text: string | null | undefined,
  contact: any,
  options?: ResolveVariablesOptions
): string {
  if (!text || typeof text !== "string") return text || "";
  if (!contact && !options?.customVariables) return text;

  const fullName = (contact?.name || contact?.whatsappName || "").trim();
  const waName = (contact?.whatsappName || contact?.name || "").trim();
  const nameParts = fullName ? fullName.split(/\s+/) : [];
  const firstName = contact?.firstName || (nameParts[0] || waName || "");
  const lastName =
    contact?.lastName ||
    (nameParts.length > 1 ? nameParts.slice(1).join(" ") : "");
  const phone = contact?.waId || contact?.phoneNumber || "";
  const email = contact?.email || "";

  // Matches both {{tag}} and {tag} (single brace legacy quick reply placeholders)
  return text.replace(/(?:\{\{|\{)\s*([a-zA-Z0-9_.\s]+?)\s*(?:\}\}|\})/g, (match, rawKey) => {
    const key = rawKey.trim();
    const lowerKey = key.toLowerCase().replace(/[\s_-]+/g, "");

    // 1. WhatsApp Profile Name
    if (
      [
        "whatsappname",
        "contact.whatsappname",
        "waname",
        "contact.waname",
        "whatsapp_name",
        "wa_name",
      ].includes(lowerKey)
    ) {
      return waName || fullName || firstName || phone || options?.fallback || "";
    }

    // 2. Full Name
    if (
      [
        "name",
        "contact.name",
        "fullname",
        "contact.fullname",
        "contactname",
      ].includes(lowerKey)
    ) {
      return fullName || waName || firstName || phone || options?.fallback || "";
    }

    // 3. First Name
    if (
      [
        "firstname",
        "contact.firstname",
        "first",
        "first_name",
        "contact.first_name",
      ].includes(lowerKey)
    ) {
      return firstName || waName || fullName || phone || options?.fallback || "";
    }

    // 4. Last Name
    if (
      [
        "lastname",
        "contact.lastname",
        "last",
        "last_name",
        "contact.last_name",
      ].includes(lowerKey)
    ) {
      return lastName || "";
    }

    // 5. Phone / WhatsApp ID
    if (
      [
        "phone",
        "contact.phone",
        "waid",
        "contact.waid",
        "whatsappnumber",
        "phonenumber",
        "phone_number",
        "number",
      ].includes(lowerKey)
    ) {
      return phone;
    }

    // 6. Email
    if (["email", "contact.email", "mail"].includes(lowerKey)) {
      return email;
    }

    // 7. Custom Attributes
    if (key.startsWith("contact.custom.")) {
      const customField = key.replace("contact.custom.", "").trim();
      if (
        contact?.customAttributes &&
        typeof contact.customAttributes === "object"
      ) {
        const val = (contact.customAttributes as Record<string, any>)[
          customField
        ];
        if (val !== undefined && val !== null) return String(val);
      }
    }

    // 8. Custom variables passed in options (e.g. from Flow context)
    if (options?.customVariables) {
      if (options.customVariables[key] !== undefined) {
        const val = options.customVariables[key];
        return val !== undefined && val !== null ? String(val) : "";
      }
      if (
        key.startsWith("variables.") &&
        options.customVariables[key.replace("variables.", "")] !== undefined
      ) {
        const val = options.customVariables[key.replace("variables.", "")];
        return val !== undefined && val !== null ? String(val) : "";
      }
    }

    // Also check direct customAttributes key if not prefixed
    if (
      contact?.customAttributes &&
      typeof contact.customAttributes === "object" &&
      (contact.customAttributes as Record<string, any>)[key] !== undefined
    ) {
      const val = (contact.customAttributes as Record<string, any>)[key];
      if (val !== undefined && val !== null) return String(val);
    }

    // Unmatched: preserve original tag
    return match;
  });
}

export const replaceContactVariables = resolveContactVariables;

/**
 * Inserts a variable at the current cursor position in a textarea or input.
 */
export function insertVariableAtCursor(
  textarea: HTMLTextAreaElement | HTMLInputElement | null,
  currentValue: string,
  variableText: string,
  onChange: (newValue: string) => void
): void {
  if (!textarea) {
    onChange((currentValue || "") + variableText);
    return;
  }

  const start = textarea.selectionStart ?? currentValue.length;
  const end = textarea.selectionEnd ?? currentValue.length;
  const before = currentValue.substring(0, start);
  const after = currentValue.substring(end);
  const nextValue = before + variableText + after;

  onChange(nextValue);

  setTimeout(() => {
    try {
      textarea.focus();
      const newCursorPos = start + variableText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    } catch {}
  }, 10);
}
