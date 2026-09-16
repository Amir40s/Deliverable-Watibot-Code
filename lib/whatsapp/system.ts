import { prisma } from '@/lib/prisma';
import { normalizePhoneNumber } from '@/lib/phone';

export interface SystemWhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendSystemWhatsAppTemplateDetailed(
  toPhoneNumber: string,
  templateName: string,
  parameters: { type: string; text: string }[] = [],
  languageCode: string = 'en',
  variableValues?: Record<string, string>
): Promise<SystemWhatsAppSendResult> {
  try {
    const config = await prisma.systemConfig.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { metaAccessToken: true, whatsappPhoneNumberId: true, whatsappBusinessId: true, platformName: true }
    });

    if (!config || !config.metaAccessToken || !config.whatsappPhoneNumberId) {
      const errMsg = 'Admin WhatsApp Gateway is not connected or configured.';
      console.warn(`[SystemWhatsApp] ${errMsg}`);
      return { success: false, error: errMsg };
    }

    const to = normalizePhoneNumber(toPhoneNumber);
    if (!to) {
      const errMsg = `Invalid destination phone number: "${toPhoneNumber}"`;
      console.warn(`[SystemWhatsApp] ${errMsg}`);
      return { success: false, error: errMsg };
    }

    let actualTemplateName = templateName;
    let reqLang = languageCode;
    let parsedConfig: any = null;

    if (templateName && templateName.trim().startsWith('{')) {
      try {
        parsedConfig = JSON.parse(templateName);
        if (parsedConfig.templateName) {
          actualTemplateName = parsedConfig.templateName;
        }
        if (parsedConfig.language) {
          reqLang = parsedConfig.language;
        }
      } catch (e) {
        // Fallback if not valid JSON
      }
    }

    // Resolve parameters from variableValues if provided and template was configured with variable mappings
    let effectiveParams: { type: string; text: string }[] = [...parameters];
    if (parsedConfig && parsedConfig.bodyVariables && variableValues) {
      const bodyVarEntries = Object.entries(parsedConfig.bodyVariables) as [string, string][];
      if (bodyVarEntries.length > 0) {
        // Sort by placeholder number: 1, 2, 3...
        bodyVarEntries.sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
        effectiveParams = bodyVarEntries.map(([, varName]) => {
          const val = variableValues[varName] !== undefined ? variableValues[varName] : (varName || '');
          return { type: 'text', text: String(val) };
        });
      }
    }

    const url = `https://graph.facebook.com/v21.0/${config.whatsappPhoneNumberId}/messages`;

    let finalLang = reqLang;
    if (finalLang === 'en') finalLang = 'en_US';
    if (finalLang === 'ru') finalLang = 'ru_RU';

    let targetTemplate: any = null;
    if (config.whatsappBusinessId) {
      try {
        const templateInfoUrl = `https://graph.facebook.com/v21.0/${config.whatsappBusinessId}/message_templates?name=${encodeURIComponent(actualTemplateName)}&fields=name,status,category,language,components`;
        const templateRes = await fetch(templateInfoUrl, {
          headers: { 'Authorization': `Bearer ${config.metaAccessToken}` }
        });
        if (templateRes.ok) {
          const templateData = await templateRes.json();
          const approvedTemplates = (templateData.data || []).filter((t: any) => t.status === 'APPROVED');
          
          targetTemplate = approvedTemplates.find((t: any) => 
            t.language === reqLang || t.language === finalLang || (reqLang === 'en' && t.language === 'en_US')
          ) || approvedTemplates[0];

          if (targetTemplate && targetTemplate.language) {
            finalLang = targetTemplate.language;
          }
        }
      } catch (e) {
        console.warn('[SystemWhatsApp] Failed to fetch template components/language for checks:', e);
      }
    }

    const components: any[] = [];

    if (targetTemplate && Array.isArray(targetTemplate.components)) {
      const templateComponents = targetTemplate.components;

      // 1. Check Header Component
      const headerComp = templateComponents.find((c: any) => c.type === 'HEADER');
      if (headerComp && (headerComp.format === 'TEXT' || headerComp.text)) {
        const headerText = headerComp.text || '';
        const headerMatchCount = (headerText.match(/\{\{\d+\}\}/g) || []).length;
        if (headerMatchCount > 0 && effectiveParams.length > 0) {
          components.push({
            type: 'header',
            parameters: effectiveParams.slice(0, headerMatchCount)
          });
        }
      }

      // 2. Check Body Component
      const bodyComp = templateComponents.find((c: any) => c.type === 'BODY');
      if (bodyComp && bodyComp.text) {
        const bodyText = bodyComp.text || '';
        const bodyMatchCount = (bodyText.match(/\{\{\d+\}\}/g) || []).length;
        if (bodyMatchCount > 0 && effectiveParams.length > 0) {
          const headerCompAdded = components.some(c => c.type === 'header');
          const headerParamCount = headerCompAdded ? (components.find(c => c.type === 'header')?.parameters?.length || 0) : 0;
          const bodyParams = effectiveParams.slice(headerParamCount, headerParamCount + bodyMatchCount);
          components.push({
            type: 'body',
            parameters: bodyParams.length > 0 ? bodyParams : effectiveParams.slice(0, bodyMatchCount)
          });
        }
      }

      // 3. Check Buttons Component
      const buttonsComp = templateComponents.find((c: any) => c.type === 'BUTTONS');
      if (buttonsComp && Array.isArray(buttonsComp.buttons)) {
        buttonsComp.buttons.forEach((btn: any, index: number) => {
          if (btn.type === 'COPY_CODE') {
            components.push({
              type: 'button',
              sub_type: 'copy_code',
              index: String(index),
              parameters: [
                {
                  type: 'coupon_code',
                  text: effectiveParams[0]?.text || ''
                }
              ]
            });
          } else if (btn.type === 'URL' && (btn.url?.includes('{{') || btn.url?.includes('http'))) {
            if (btn.url?.includes('{{')) {
              components.push({
                type: 'button',
                sub_type: 'url',
                index: String(index),
                parameters: [
                  {
                    type: 'text',
                    text: effectiveParams[0]?.text || ''
                  }
                ]
              });
            }
          }
        });
      }
    } else {
      // Fallback if template details couldn't be retrieved from WABA metadata API
      if (effectiveParams.length > 0) {
        components.push({
          type: 'body',
          parameters: effectiveParams
        });
      }
    }

    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: actualTemplateName,
        language: { code: finalLang },
        ...(components.length > 0 ? { components } : {})
      }
    };

    console.log(`[SystemWhatsApp] Sending template "${actualTemplateName}" to ${to} (lang: ${finalLang}, components: ${components.length})`);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.metaAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.error) {
      const errMsg = data.error.message || data.error.error_user_msg || JSON.stringify(data.error);
      console.error('[SystemWhatsApp] Meta API Error:', JSON.stringify(data.error, null, 2));
      return { success: false, error: errMsg };
    }

    const messageId = data.messages?.[0]?.id || null;
    console.log(`[SystemWhatsApp] Template successfully sent to ${to}, messageId: ${messageId}`);
    return { success: true, messageId };
  } catch (error: any) {
    const errMsg = error?.message || 'Error sending system template';
    console.error('[SystemWhatsApp] Error sending system template:', error);
    return { success: false, error: errMsg };
  }
}

export async function sendSystemWhatsAppTemplate(
  toPhoneNumber: string,
  templateName: string,
  parameters: { type: string; text: string }[],
  languageCode: string = 'en'
): Promise<boolean> {
  const result = await sendSystemWhatsAppTemplateDetailed(toPhoneNumber, templateName, parameters, languageCode);
  return result.success;
}


export async function sendSystemWhatsAppTextMessage(
  toPhoneNumber: string,
  message: string
) {
  try {
    const config = await prisma.systemConfig.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { metaAccessToken: true, whatsappPhoneNumberId: true }
    });

    if (!config || !config.metaAccessToken || !config.whatsappPhoneNumberId) {
      console.warn('[SystemWhatsApp] Gateway is not connected or configured.');
      return false;
    }

    const to = normalizePhoneNumber(toPhoneNumber);
    if (!to) {
      console.warn('[SystemWhatsApp] Invalid destination phone number:', toPhoneNumber);
      return false;
    }

    const url = `https://graph.facebook.com/v21.0/${config.whatsappPhoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: message }
    };

    console.log(`[SystemWhatsApp] Sending text message to ${to}`);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.metaAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.error) {
      console.error('[SystemWhatsApp] Meta API Error (Text):', JSON.stringify(data.error, null, 2));
      return false;
    }
    console.log(`[SystemWhatsApp] Text message successfully sent to ${to}`);
    return true;
  } catch (error) {
    console.error('[SystemWhatsApp] Error sending system text message:', error);
    return false;
  }
}


