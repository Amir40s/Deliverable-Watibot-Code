/**
 * AI Sales Agent — Stateful Order Collection
 *
 * This agent intercepts incoming WhatsApp messages when:
 *   a) The user expresses ordering intent ("I want to order", "order karna hai", etc.)
 *   b) An active order collection state already exists for this contact
 *
 * State is stored in Contact.customAttributes.aiAgentState (JSON field, no migration needed).
 *
 * Flow:
 *   idle → collecting_name → collecting_phone → collecting_address
 *        → collecting_product → collecting_quantity → confirming → done
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentPhase =
  | 'collecting_name'
  | 'collecting_phone'
  | 'collecting_address'
  | 'collecting_product'
  | 'collecting_quantity'
  | 'confirming'
  | 'done';

interface OrderData {
  name?: string;
  phone?: string;
  address?: string;
  product?: string;
  quantity?: string;
}

interface AgentState {
  phase: AgentPhase;
  collected: OrderData;
}



// ─── State Management ─────────────────────────────────────────────────────────

export async function getAgentState(contactId: string): Promise<AgentState | null> {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { customAttributes: true },
    });
    const attrs = contact?.customAttributes as Record<string, any> | null;
    if (attrs?.aiAgentState) {
      return attrs.aiAgentState as AgentState;
    }
    return null;
  } catch (err) {
    logger.flow.error(`[SalesAgent] Error reading agent state: ${(err as Error).message}`);
    return null;
  }
}

export async function setAgentState(contactId: string, state: AgentState): Promise<void> {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { customAttributes: true },
    });
    const existing = (contact?.customAttributes as Record<string, any>) || {};
    await prisma.contact.update({
      where: { id: contactId },
      data: {
        customAttributes: { ...existing, aiAgentState: state } as any,
      },
    });
  } catch (err) {
    logger.flow.error(`[SalesAgent] Error saving agent state: ${(err as Error).message}`);
  }
}

export async function clearAgentState(contactId: string): Promise<void> {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { customAttributes: true },
    });
    const existing = (contact?.customAttributes as Record<string, any>) || {};
    const { aiAgentState, ...rest } = existing;
    await prisma.contact.update({
      where: { id: contactId },
      data: { customAttributes: rest as any },
    });
  } catch (err) {
    logger.flow.error(`[SalesAgent] Error clearing agent state: ${(err as Error).message}`);
  }
}

// ─── Linked Google Sheet Lookup ────────────────────────────────────────────────

async function getLinkedGoogleSheet(
  organizationId: string,
): Promise<{ spreadsheetId: string; sheetName: string } | null> {
  try {
    const entry = await prisma.knowledgeBase.findFirst({
      where: {
        organizationId,
        sourceUrl: { startsWith: 'googlesheets://' },
      },
      select: { sourceUrl: true },
    });
    if (!entry?.sourceUrl) return null;

    // Format: googlesheets://<spreadsheetId>/<sheetName>
    const withoutPrefix = entry.sourceUrl.replace('googlesheets://', '');
    const [spreadsheetId, sheetName] = withoutPrefix.split('/');
    return {
      spreadsheetId: spreadsheetId || '',
      sheetName: sheetName || 'Orders',
    };
  } catch {
    return null;
  }
}

// ─── Order Summary Builder ────────────────────────────────────────────────────

function buildOrderSummary(collected: OrderData): string {
  return [
    `📋 *Order Summary*`,
    ``,
    `👤 *Name:* ${collected.name || '-'}`,
    `📞 *Phone:* ${collected.phone || '-'}`,
    `📍 *Address:* ${collected.address || '-'}`,
    `📦 *Product:* ${collected.product || '-'}`,
    `🔢 *Quantity:* ${collected.quantity || '-'}`,
    ``,
    `Reply *confirm* to place the order ✅`,
    `Reply *cancel* to start over ❌`,
  ].join('\n');
}

// ─── Generate Order ID ────────────────────────────────────────────────────────

function generateOrderId(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(Math.random() * 9000 + 1000);
  return `#ORD-${dateStr}-${randomSuffix}`;
}

// ─── Main Agent Handler ───────────────────────────────────────────────────────

/**
 * Run the sales agent for an incoming message.
 * Returns the response string to send back to the user, or null if the agent
 * did not handle this message (caller should fall back to KB Q&A).
 */
export async function runSalesAgent(
  message: string,
  contactId: string,
  organizationId: string,
  buttonId?: string,
): Promise<string | { message: string, interactiveData?: any } | null> {
  const lower = (buttonId || message).trim().toLowerCase();

  // Check for active state first
  let state = await getAgentState(contactId);

  // If user says cancel at any point, reset
  if (state && (lower === 'cancel' || lower.includes('cancel') || lower === 'cancel karo' || lower === 'band karo')) {
    await clearAgentState(contactId);
    logger.flow.info(`[SalesAgent] Order cancelled for contact ${contactId}`);
    return `❌ Order cancelled. No problem! Feel free to ask me anything or start a new order anytime.`;
  }

  // No active state — return null to let AI and tool calling decide when to trigger the order flow
  if (!state) {
    return null;
  }

  // ── State Machine ──────────────────────────────────────────────────────────

  switch (state.phase) {
    case 'collecting_name': {
      if (message.trim().length < 2) {
        return `Please enter your full name to continue.`;
      }
      state.collected.name = message.trim();
      state.phase = 'collecting_phone';
      await setAgentState(contactId, state);
      return `Thanks *${state.collected.name}*! 📞\n\nWhat's your *WhatsApp/phone number*?`;
    }

    case 'collecting_phone': {
      const cleaned = message.replace(/[\s\-\(\)]/g, '');
      if (cleaned.length < 7 || !/[\d+]/.test(cleaned)) {
        return `Please enter a valid phone number. (e.g., 0300-1234567)`;
      }
      state.collected.phone = message.trim();
      state.phase = 'collecting_address';
      await setAgentState(contactId, state);
      return `Got it! 📍\n\nWhat's your *delivery address*?`;
    }

    case 'collecting_address': {
      if (message.trim().length < 5) {
        return `Please provide your full delivery address to continue.`;
      }
      state.collected.address = message.trim();
      state.phase = 'collecting_product';
      await setAgentState(contactId, state);
      return `Perfect! 📦\n\n*Which product* would you like to order?`;
    }

    case 'collecting_product': {
      if (message.trim().length < 2) {
        return `Please enter the product name you'd like to order.`;
      }
      state.collected.product = message.trim();
      state.phase = 'collecting_quantity';
      await setAgentState(contactId, state);
      return `Great choice! 🔢\n\n*How many units* would you like?`;
    }

    case 'collecting_quantity': {
      const qty = message.trim();
      if (!qty || isNaN(Number(qty.replace(/[^0-9]/g, '')))) {
        return `Please enter a valid quantity (e.g., 1, 2, 3).`;
      }
      state.collected.quantity = qty;
      state.phase = 'confirming';
      await setAgentState(contactId, state);

      const summary = buildOrderSummary(state.collected);
      return {
        message: summary,
        interactiveData: {
          type: "button",
          body: {
            text: "Please select Confirm to place the order or Cancel to start over."
          },
          action: {
            buttons: [
              { id: "confirm", text: "Confirm ✅" },
              { id: "cancel", text: "Cancel ❌" }
            ]
          }
        }
      };
    }

    case 'confirming': {
      const isConfirm = lower === 'confirm' || lower.includes('confirm') || lower === 'yes' || lower === 'ok' ||
        lower === 'haan' || lower === 'han' || lower === 'ok haan' ||
        lower === 'okay' || lower === 'done' || lower === 'theek hai';

      if (!isConfirm) {
        // Re-show the summary if user sent something else
        const summary = buildOrderSummary(state.collected);
        return {
          message: `Please reply *confirm* to place the order or *cancel* to start over.\n\n${summary}`,
          interactiveData: {
            type: "button",
            body: {
              text: "Please select Confirm to place the order or Cancel to start over."
            },
            action: {
              buttons: [
                { id: "confirm", text: "Confirm ✅" },
                { id: "cancel", text: "Cancel ❌" }
              ]
            }
          }
        };
      }

      // ── Save to Google Sheet ────────────────────────────────────────────────
      const orderId = generateOrderId();
      const sheet = await getLinkedGoogleSheet(organizationId);

      if (sheet?.spreadsheetId) {
        try {
          const { appendToGoogleSheet } = await import('@/lib/flows/integrations/google-sheets');
          const rowData: Record<string, string> = {
            'Order ID': orderId,
            'Timestamp': new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' }),
            'Name': state.collected.name || '',
            'Phone': state.collected.phone || '',
            'Address': state.collected.address || '',
            'Product': state.collected.product || '',
            'Quantity': state.collected.quantity || '',
            'Status': 'Pending',
          };
          await appendToGoogleSheet(sheet.spreadsheetId, sheet.sheetName || 'Orders', rowData, organizationId);
          logger.flow.success(`[SalesAgent] Order ${orderId} saved to Google Sheet for org ${organizationId}`);
        } catch (sheetErr: any) {
          logger.flow.error(`[SalesAgent] Failed to save to Google Sheet: ${sheetErr.message}`);
          // Don't fail the whole order — just log the error
        }
      } else {
        logger.flow.warn(`[SalesAgent] No Google Sheet linked for org ${organizationId}. Order not saved to sheet.`);
      }

      // Clear state after successful order
      await clearAgentState(contactId);

      return [
        `✅ *Order Confirmed!*`,
        ``,
        `Your order has been placed successfully.`,
        `🆔 *Order ID:* ${orderId}`,
        ``,
        `Our team will contact you at *${state.collected.phone}* shortly to confirm delivery details.`,
        ``,
        `Thank you for your order! 🙏`,
      ].join('\n');
    }

    case 'done': {
      // Shouldn't normally reach here, clear state
      await clearAgentState(contactId);
      return null;
    }

    default:
      return null;
  }
}
