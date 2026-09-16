import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { X, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Node } from "reactflow";
import { getAdAccounts, getAdCampaigns } from "@/app/actions/facebook-ads";
import { getQuickReplies } from "@/app/actions/quick-replies";
import {
  COMMON_CONTACT_VARIABLES,
  insertVariableAtCursor,
} from "@/lib/messaging/contactVariables";

interface WhatsAppTemplate {
  id: string;
  name: string;
  language: string;
  components: Record<string, unknown>[];
}

interface NodeConfigPanelProps {
  selectedNode: Node | null;
  onClose: () => void;
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void;
  organizationId?: string;
}

export function NodeConfigPanel({
  selectedNode,
  onClose,
  onUpdate,
  organizationId,
}: NodeConfigPanelProps) {
  if (!selectedNode) return null;

  const { data: session } = useSession();
  const [aiAgents, setAiAgents] = useState<any[]>([]);

  const effectiveOrgId = organizationId || session?.user?.organizationId;

  useEffect(() => {
    if (effectiveOrgId) {
      getAIAgents(effectiveOrgId as string)
        .then(setAiAgents)
        .catch(err => console.error("Failed to load AI Agents:", err));
    }
  }, [effectiveOrgId]);

  const handleUpdate = (
    fieldOrUpdates: string | Record<string, unknown>,
    value?: unknown,
  ) => {
    if (typeof fieldOrUpdates === "string") {
      // Single field update
      onUpdate(selectedNode.id, {
        ...selectedNode.data,
        [fieldOrUpdates]: value,
      });
    } else {
      // Batch update
      onUpdate(selectedNode.id, {
        ...selectedNode.data,
        ...fieldOrUpdates,
      });
    }
  };

  const renderConfigForm = () => {
    switch (selectedNode.type) {
      case "trigger":
        return (
          <TriggerConfig node={selectedNode} handleUpdate={handleUpdate} />
        );
      case "condition":
        return (
          <ConditionConfig node={selectedNode} handleUpdate={handleUpdate} />
        );
      case "message":
        return (
          <MessageConfig node={selectedNode} handleUpdate={handleUpdate} />
        );
      case "delay":
        return <DelayConfig node={selectedNode} handleUpdate={handleUpdate} />;
      case "input":
        return <WaitConfig node={selectedNode} handleUpdate={handleUpdate} />;
      case "set_attribute":
        return (
          <SetAttributeConfig node={selectedNode} handleUpdate={handleUpdate} />
        );
      case "order_info":
        return (
          <OrderInfoConfig node={selectedNode} handleUpdate={handleUpdate} />
        );
      case "shopify_action":
        return (
          <ShopifyActionConfig
            node={selectedNode}
            handleUpdate={handleUpdate}
          />
        );
      case "public_reply":
        return (
          <PublicReplyConfig node={selectedNode} handleUpdate={handleUpdate} />
        );
      case "quick_reply":
        return (
          <QuickReplyConfig node={selectedNode} handleUpdate={handleUpdate} />
        );
      case "ai_knowledge":
        return (
          <AIKnowledgeConfig node={selectedNode} handleUpdate={handleUpdate} aiAgents={aiAgents} />
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full h-full border-l border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto">
      <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 p-4 flex items-center justify-between z-10">
        <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
          Node Configuration
        </h3>
        <button
          onClick={onClose}
          className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-4 space-y-4">
        {renderConfigForm()}

        {selectedNode && [
          "message",
          "input",
          "askInput",
          "list",
          "carousel",
          "ask_question",
          "ask_address",
          "ask_location",
          "ask_media"
        ].includes(selectedNode.type || "") && (
          <div className="pt-6 border-t border-gray-150 dark:border-slate-800/60 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">AI Fallback</Label>
                <p className="text-[11px] text-muted-foreground">Trigger AI response if inactive</p>
              </div>
              <Switch
                checked={!!selectedNode.data?.fallbackEnabled}
                onCheckedChange={(checked) => handleUpdate("fallbackEnabled", checked)}
                className="data-[state=checked]:bg-[#333366] data-[state=checked]:border-[#333366]"
              />
            </div>

            {!!selectedNode.data?.fallbackEnabled && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold block text-slate-500 uppercase tracking-wider">AI Agent/Knowledge Base</Label>
                  <select
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    value={(selectedNode.data?.fallbackKbId as string) || ""}
                    onChange={(e) => handleUpdate("fallbackKbId", e.target.value)}
                  >
                    <option value="">Default Agent (Global KB)</option>
                    {aiAgents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold block text-slate-500 uppercase tracking-wider">Inactivity Delay</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      placeholder="5"
                      min="1"
                      value={selectedNode.data?.fallbackDelay !== undefined ? String(selectedNode.data?.fallbackDelay) : "5"}
                      onChange={(e) => handleUpdate("fallbackDelay", parseInt(e.target.value) || 0)}
                      className="h-10 text-sm border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl focus-visible:ring-emerald-500/20 shadow-sm"
                    />
                    <select
                      className="h-10 px-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      value={(selectedNode.data?.fallbackUnit as string) || "minutes"}
                      onChange={(e) => handleUpdate("fallbackUnit", e.target.value)}
                    >
                      <option value="seconds">Seconds</option>
                      <option value="minutes">Minutes</option>
                      <option value="hours">Hours</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Trigger Node Configuration
function TriggerConfig({
  node,
  handleUpdate,
}: {
  node: Node;
  handleUpdate: (
    fieldOrUpdates: string | Record<string, unknown>,
    value?: unknown,
  ) => void;
}) {
  const [adAccounts, setAdAccounts] = useState<any[]>([]);
  const [ads, setAds] = useState<{ id: string, name: string }[]>([]);
  const [isLoadingAds, setIsLoadingAds] = useState(false);

  useEffect(() => {
    if (node.data.triggerType === "keyword") {
      loadAdAccounts();
    }
  }, [node.data.triggerType]);

  useEffect(() => {
    if (node.data.facebookAdAccountId) {
      loadAds(node.data.facebookAdAccountId as string);
    }
  }, [node.data.facebookAdAccountId]);

  const loadAdAccounts = async () => {
    try {
      const accounts = await getAdAccounts();
      if (accounts && accounts.length > 0) {
        setAdAccounts(accounts);
        if (!node.data.facebookAdAccountId) {
          handleUpdate("facebookAdAccountId", accounts[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load ad accounts:', error);
      if (adAccounts.length === 0) {
        const dummyAccounts = [{ id: 'act_dummy1', name: 'Dummy Ad Account 1' }];
        setAdAccounts(dummyAccounts);
        if (!node.data.facebookAdAccountId) {
          handleUpdate("facebookAdAccountId", dummyAccounts[0].id);
        }
      }
    }
  };

  const loadAds = async (accountId: string) => {
    setIsLoadingAds(true);
    try {
      const campaigns = await getAdCampaigns(accountId);
      const extractedAds: { id: string, name: string }[] = [];
      campaigns.forEach((camp: any) => {
        if (camp.adsets && camp.adsets.data) {
          camp.adsets.data.forEach((adset: any) => {
            if (adset.ads && adset.ads.data) {
              adset.ads.data.forEach((ad: any) => {
                extractedAds.push({ id: ad.id, name: ad.name });
              });
            }
          });
        }
      });
      setAds(extractedAds);
    } catch (error) {
      console.error("Failed to load ads:", error);
      // Fallback
      if (ads.length === 0) {
        setAds([
          { id: 'ad_1', name: 'Summer Sale Campaign - Image Ad' },
          { id: 'ad_2', name: 'Retargeting Video Ad' },
          { id: 'ad_3', name: 'Lead Gen Form Ad' }
        ]);
      }
    } finally {
      setIsLoadingAds(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-semibold mb-2 block">Trigger Type</Label>
        <select
          className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          value={node.data.triggerType || "keyword"}
          onChange={(e) => handleUpdate("triggerType", e.target.value)}
        >
          <option value="keyword">Keyword</option>
          <option value="facebook_comment">Facebook Comment</option>
          <option value="instagram_comment">Instagram Comment</option>
          <option value="story_reply">Instagram Story Reply</option>
          <option value="any">Any Message</option>
          <option value="event">Event</option>
          <option value="woocommerce_event">WooCommerce Event</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      {node.data.triggerType === "woocommerce_event" && (
        <div className="space-y-4">
          <div>
            <Label className="text-xs font-semibold mb-2 block">
              WooCommerce Event
            </Label>
            <select
              className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              value={node.data.woocommerceEvent || "order.created"}
              onChange={(e) => handleUpdate("woocommerceEvent", e.target.value)}
            >
              <option value="order.created">Order Created</option>
              <option value="order.updated">Order Updated</option>
              <option value="order.deleted">Order Deleted</option>
              <option value="customer.created">Customer Created</option>
              <option value="product.created">Product Created</option>
            </select>
            <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
              Flow starts when this WooCommerce event is received via webhook.
            </p>
          </div>
        </div>
      )}

      {node.data.triggerType === "keyword" && (
        <div className="space-y-4">
          <div className="space-y-3">
            <Label className="text-xs font-semibold block text-slate-500 uppercase tracking-wider">Keywords</Label>
            <Input
              placeholder="e.g., hello, start, help"
              value={node.data.keyword || ""}
              onChange={(e) => handleUpdate("keyword", e.target.value)}
              className="h-12 text-sm border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl focus-visible:ring-emerald-500/20 shadow-sm"
            />

            <div className="flex p-1 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
              <button
                type="button"
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${node.data.matchType !== "contains"
                    ? "bg-[#333366] text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                onClick={() => handleUpdate("matchType", "whole")}
              >
                Whole
              </button>
              <button
                type="button"
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${node.data.matchType === "contains"
                    ? "bg-[#333366] text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                onClick={() => handleUpdate("matchType", "contains")}
              >
                Contains
              </button>
            </div>

            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Flow starts when user sends any of these keywords (comma separated).
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
            <div className="flex justify-between items-center mb-3">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold uppercase tracking-wider">
                  Regex Match
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  Advanced pattern matching
                </p>
              </div>
              <Switch
                checked={node.data.isRegexEnabled || false}
                onCheckedChange={(checked: boolean) =>
                  handleUpdate("isRegexEnabled", checked)
                }
              />
            </div>
            <Input
              placeholder="e.g., hello.*world"
              value={node.data.regexPattern || ""}
              onChange={(e) => handleUpdate("regexPattern", e.target.value)}
              className="h-9 text-xs font-mono bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
              disabled={!node.data.isRegexEnabled}
            />
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
            <div className="space-y-0.5 mb-3">
              <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Choose Ad Account
              </Label>
            </div>
            <select
              className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              value={(node.data.facebookAdAccountId as string) || ""}
              onChange={(e) => handleUpdate({ facebookAdAccountId: e.target.value, facebookAdId: "" })}
            >
              <option value="">Select Ad Account</option>
              {adAccounts.map((acc: any) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
            <div className="space-y-0.5 mb-3">
              <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Choose Facebook Ad
              </Label>
            </div>
            <select
              className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              value={(node.data.facebookAdId as string) || ""}
              onChange={(e) => handleUpdate("facebookAdId", e.target.value)}
              disabled={isLoadingAds}
            >
              <option value="">{isLoadingAds ? "Loading ads..." : "Choose Facebook Ad"}</option>
              {ads.map((ad: any) => (
                <option key={ad.id} value={ad.id}>
                  {ad.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {(node.data.triggerType === "facebook_comment" ||
        node.data.triggerType === "instagram_comment" ||
        node.data.triggerType === "story_reply") && (
          <CommentTriggerConfig node={node} handleUpdate={handleUpdate} />
        )}

      <div>
        <Label className="text-xs font-semibold mb-2 block">Label</Label>
        <Input
          placeholder="Node label"
          value={node.data.label || ""}
          onChange={(e) => handleUpdate("label", e.target.value)}
          className="h-10 text-sm border-gray-400 rounded-xl"
        />
      </div>
    </div>
  );
}

// Condition Node Configuration
function ConditionConfig({
  node,
  handleUpdate,
}: {
  node: Node;
  handleUpdate: (
    fieldOrUpdates: string | Record<string, unknown>,
    value?: unknown,
  ) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-semibold mb-2 block">
          Condition Field
        </Label>
        <select
          className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          value={node.data.field || "contact.name"}
          onChange={(e) => handleUpdate("field", e.target.value)}
        >
          <option value="contact.name">Contact Name</option>
          <option value="contact.email">Contact Email</option>
          <option value="message.text">Message Text</option>
          <option value="variable">Custom Variable</option>
        </select>
      </div>

      {node.data.field === "variable" && (
        <div>
          <Label className="text-xs font-semibold mb-2 block">
            Variable Name
          </Label>
          <Input
            placeholder="e.g., user_choice"
            value={node.data.variableName || ""}
            onChange={(e) => handleUpdate("variableName", e.target.value)}
            className="h-10 text-sm border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl focus-visible:ring-emerald-500/20"
          />
        </div>
      )}

      <div>
        <Label className="text-xs font-semibold mb-2 block">Operator</Label>
        <select
          className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          value={node.data.operator || "contains"}
          onChange={(e) => handleUpdate("operator", e.target.value)}
        >
          <option value="equals">Equals</option>
          <option value="contains">Contains</option>
          <option value="startsWith">Starts With</option>
          <option value="endsWith">Ends With</option>
          <option value="greaterThan">Greater Than</option>
          <option value="lessThan">Less Than</option>
        </select>
      </div>

      <div>
        <Label className="text-xs font-semibold mb-2 block">Value</Label>
        <Input
          placeholder="Comparison value"
          value={node.data.value || ""}
          onChange={(e) => handleUpdate("value", e.target.value)}
          className="h-10 text-sm border-gray-400 rounded-xl"
        />
      </div>
    </div>
  );
}

// Message Node Configuration
function MessageConfig({
  node,
  handleUpdate,
}: {
  node: Node;
  handleUpdate: (
    fieldOrUpdates: string | Record<string, unknown>,
    value?: unknown,
  ) => void;
}) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (node.data.messageType === "template") {
      loadTemplates();
    }
  }, [node.data.messageType]);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const result = await getMessageTemplates();
      setTemplates(result.success ? (result.data as WhatsAppTemplate[]) : []);
    } catch (error) {
      console.error("Failed to load templates:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTemplateChange = (templateName: string) => {
    const selectedTemplate = templates.find(
      (t: WhatsAppTemplate) => t.name === templateName,
    );
    if (selectedTemplate) {
      // Batch update template fields
      handleUpdate({
        templateName: selectedTemplate.name,
        templateLanguage: selectedTemplate.language,
        templateComponents: selectedTemplate.components,
        templateParams: {}, // Reset params on template change
      });
    }
  };

  const getTemplateVariables = (components: Record<string, unknown>[]) => {
    const body = components?.find(
      (c: Record<string, unknown>) => c.type === "BODY",
    );
    if (!body || !body.text) return [];
    const matches = (body.text as string).match(/\{\{(\d+)\}\}/g);
    if (!matches) return [];
    // Extract unique variable numbers
    const uniqueMatches = Array.from(new Set(matches)) as string[];
    return uniqueMatches.map((m) => m.replace(/\{\{|\}\}/g, ""));
  };

  const variables = getTemplateVariables(node.data.templateComponents || []);

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-semibold mb-2 block">Message Type</Label>
        <select
          className="w-full h-10 px-3 rounded-xl border border-gray-400 bg-background text-sm"
          value={node.data.messageType || "text"}
          onChange={(e) => handleUpdate("messageType", e.target.value)}
        >
          <option value="text">Text</option>
          <option value="template">Template</option>
          <option value="image">Image</option>
        </select>
      </div>

      {node.data.messageType === "template" ? (
        <div>
          <Label className="text-xs font-semibold mb-2 flex items-center gap-2">
            Select Template
            {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
          </Label>
          <select
            className="w-full h-10 px-3 rounded-xl border border-gray-400 bg-background text-sm"
            value={node.data.templateName || ""}
            onChange={(e) => handleTemplateChange(e.target.value)}
            disabled={isLoading}
          >
            <option value="">Select a template...</option>
            {templates.map((t: WhatsAppTemplate) => (
              <option key={t.id} value={t.name}>
                {t.name} ({t.language})
              </option>
            ))}
          </select>
          {templates.length === 0 && !isLoading && (
            <p className="text-[10px] text-orange-500 mt-1">
              No approved templates found.
            </p>
          )}

          {variables.length > 0 && (
            <div className="mt-4 space-y-3 border-t border-border pt-3">
              <Label className="text-xs font-bold block">
                Template Variables
              </Label>
              {variables.map((varNum) => (
                <div key={varNum} className="space-y-1.5">
                  <Label className="text-[10px] font-medium text-muted-foreground mr-1">
                    Variable {"{{"}
                    {varNum}
                    {"}}"}
                  </Label>
                  <Input
                    placeholder={`Value for {{${varNum}}}`}
                    value={node.data.templateParams?.[varNum] || ""}
                    onChange={(e) => {
                      const newParams = {
                        ...node.data.templateParams,
                        [varNum]: e.target.value,
                      };
                      handleUpdate("templateParams", newParams);
                    }}
                    className="h-9 text-xs border-gray-400 rounded-lg border border-gray-400"
                  />
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground italic">
                Use {"{"}contact.name{"}"} for variables
              </p>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs font-semibold block">
              Message Content
            </Label>
            <div className="flex items-center gap-1">
              {COMMON_CONTACT_VARIABLES.slice(0, 2).map((v) => (
                <button
                  key={v.value}
                  type="button"
                  onClick={() =>
                    insertVariableAtCursor(
                      textareaRef.current,
                      node.data.message || "",
                      v.value,
                      (val) => handleUpdate("message", val)
                    )
                  }
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-200/50 hover:bg-blue-100 transition-colors cursor-pointer"
                  title={v.description}
                >
                  + {v.label}
                </button>
              ))}
            </div>
          </div>
          <Textarea
            ref={textareaRef}
            placeholder="Enter your WhatsApp message here..."
            value={node.data.message || ""}
            onChange={(e) => handleUpdate("message", e.target.value)}
            className="min-h-[120px] text-base border-gray-400 rounded-xl"
          />
          <div className="flex flex-wrap gap-1 mt-1.5 items-center">
            <span className="text-[10px] text-muted-foreground">Variables:</span>
            {COMMON_CONTACT_VARIABLES.map((v) => (
              <button
                key={v.value}
                type="button"
                onClick={() =>
                  insertVariableAtCursor(
                    textareaRef.current,
                    node.data.message || "",
                    v.value,
                    (val) => handleUpdate("message", val)
                  )
                }
                className="text-[10px] text-muted-foreground hover:text-foreground font-mono underline cursor-pointer"
              >
                {v.value}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <Label className="text-xs font-semibold mb-2 block">Node Label</Label>
        <Input
          placeholder="e.g., Send Welcome SMS"
          value={node.data.label || ""}
          onChange={(e) => handleUpdate("label", e.target.value)}
          className="h-10 text-sm border-gray-400 rounded-xl"
        />
      </div>
    </div>
  );
}

// Delay Node Configuration
function DelayConfig({
  node,
  handleUpdate,
}: {
  node: Node;
  handleUpdate: (
    fieldOrUpdates: string | Record<string, unknown>,
    value?: unknown,
  ) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-semibold mb-2 block">Duration</Label>
        <Input
          type="number"
          placeholder="5"
          value={node.data.duration || ""}
          onChange={(e) =>
            handleUpdate("duration", parseInt(e.target.value) || 0)
          }
          className="h-10 text-sm border-gray-400 rounded-xl"
        />
      </div>

      <div>
        <Label className="text-xs font-semibold mb-2 block">Unit</Label>
        <select
          className="w-full h-10 px-3 rounded-xl border border-gray-400 bg-background text-sm"
          value={node.data.unit || "seconds"}
          onChange={(e) => handleUpdate("unit", e.target.value)}
        >
          <option value="seconds">Seconds</option>
          <option value="minutes">Minutes</option>
          <option value="hours">Hours</option>
          <option value="days">Days</option>
        </select>
      </div>

      <div>
        <Label className="text-xs font-semibold mb-2 block">Label</Label>
        <Input
          placeholder="Node label"
          value={node.data.label || ""}
          onChange={(e) => handleUpdate("label", e.target.value)}
          className="h-10 text-sm border-gray-400 rounded-xl"
        />
      </div>
    </div>
  );
}

function WaitConfig({
  node,
  handleUpdate,
}: {
  node: Node;
  handleUpdate: (
    fieldOrUpdates: string | Record<string, unknown>,
    value?: unknown,
  ) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed font-medium">
          <strong>Wait for Response:</strong> This node will pause the flow
          until the user sends another message. The next incoming message will
          be used for conditions or stored in variables.
        </p>
      </div>

      <div>
        <Label className="text-xs font-semibold mb-2 block">
          Variable Name (Optional)
        </Label>
        <Input
          placeholder="e.g., user_choice"
          value={node.data.variableName || ""}
          onChange={(e) => handleUpdate("variableName", e.target.value)}
          className="h-10 text-sm border-gray-400 rounded-xl"
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          Store the user&apos;s response in this variable for later use.
        </p>
      </div>

      <div>
        <Label className="text-xs font-semibold mb-2 block">Label</Label>
        <Input
          placeholder="Wait for menu choice"
          value={node.data.label || ""}
          onChange={(e) => handleUpdate("label", e.target.value)}
          className="h-10 text-sm border-gray-400 rounded-xl"
        />
      </div>
    </div>
  );
}

function SetAttributeConfig({
  node,
  handleUpdate,
}: {
  node: any;
  handleUpdate: (
    fieldOrUpdates: string | Record<string, unknown>,
    value?: unknown,
  ) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
        <p className="text-xs text-emerald-600 dark:text-emerald-400 leading-relaxed font-medium">
          <strong>Set Attribute:</strong> This node allows you to manually set a
          variable value. You can use this to store user choices or results for
          later use in messages or conditions.
        </p>
      </div>

      <div>
        <Label className="text-xs font-semibold mb-2 block">
          Variable Name
        </Label>
        <Input
          placeholder="e.g., selected_ground"
          value={node.data.attribute || node.data.variable || ""}
          onChange={(e) => handleUpdate("attribute", e.target.value)}
          className="h-10 text-sm border-gray-400 rounded-xl"
        />
      </div>

      <div>
        <Label className="text-xs font-semibold mb-2 block">Value to Set</Label>
        <Input
          placeholder="e.g., Main Stadium"
          value={node.data.value || ""}
          onChange={(e) => handleUpdate("value", e.target.value)}
          className="h-10 text-sm border-gray-400 rounded-xl"
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          You can use variables here too, e.g., {"{{contact.name}}"}
        </p>
      </div>

      <div>
        <Label className="text-xs font-semibold mb-2 block">Node Label</Label>
        <Input
          placeholder="e.g., Set Ground"
          value={node.data.label || ""}
          onChange={(e) => handleUpdate("label", e.target.value)}
          className="h-10 text-sm border-gray-400 rounded-xl"
        />
      </div>
    </div>
  );
}

function OrderInfoConfig({
  node,
  handleUpdate,
}: {
  node: any;
  handleUpdate: (
    fieldOrUpdates: string | Record<string, unknown>,
    value?: unknown,
  ) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
        <p className="text-xs text-emerald-600 dark:text-emerald-400 leading-relaxed font-medium">
          <strong>Order Info:</strong> This node retrieves details of a Shopify
          order. You can fetch the latest order or specify a variable containing
          the order number.
        </p>
      </div>

      <div>
        <Label className="text-xs font-semibold mb-2 block">
          Order Number Source
        </Label>
        <select
          className="w-full h-10 px-3 rounded-xl border border-gray-400 bg-background text-sm"
          value={node.data.orderSource || "latest"}
          onChange={(e) => handleUpdate("orderSource", e.target.value)}
        >
          <option value="latest">Latest Order</option>
          <option value="variable">Specific Variable</option>
        </select>
      </div>

      {node.data.orderSource === "variable" && (
        <div>
          <Label className="text-xs font-semibold mb-2 block">
            Order Number Variable
          </Label>
          <Input
            placeholder="e.g., order_number"
            value={node.data.orderNumberVariable || ""}
            onChange={(e) =>
              handleUpdate("orderNumberVariable", e.target.value)
            }
            className="h-10 text-sm border-gray-400 rounded-xl"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            The variable that stores the order number (e.g. from an Ask Question
            node).
          </p>
        </div>
      )}

      <div>
        <Label className="text-xs font-semibold mb-2 block">Node Label</Label>
        <Input
          placeholder="e.g., Get Order Details"
          value={node.data.label || ""}
          onChange={(e) => handleUpdate("label", e.target.value)}
          className="h-10 text-sm border-gray-400 rounded-xl"
        />
      </div>
    </div>
  );
}

function ShopifyActionConfig({
  node,
  handleUpdate,
}: {
  node: any;
  handleUpdate: (
    fieldOrUpdates: string | Record<string, unknown>,
    value?: unknown,
  ) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
        <p className="text-xs text-emerald-600 dark:text-emerald-400 leading-relaxed font-medium">
          <strong>Shopify Action:</strong> Execute specific tasks in your
          Shopify store.
        </p>
      </div>

      <div>
        <Label className="text-xs font-semibold mb-2 block">
          Action to Perform
        </Label>
        <select
          className="w-full h-10 px-3 rounded-xl border border-gray-400 bg-background text-sm"
          value={node.data.action || "none"}
          onChange={(e) => handleUpdate("action", e.target.value)}
        >
          <option value="none">Select Action...</option>
          <option value="discount">Create Discount</option>
          <option value="fulfill">Fulfill Order</option>
          <option value="refund">Refund Order</option>
          <option value="stock">Update Stock</option>
        </select>
      </div>

      <div>
        <Label className="text-xs font-semibold mb-2 block">Node Label</Label>
        <Input
          placeholder="e.g., Refund Order"
          value={node.data.label || ""}
          onChange={(e) => handleUpdate("label", e.target.value)}
          className="h-10 text-sm border-gray-400 rounded-xl"
        />
      </div>
    </div>
  );
}

function CommentTriggerConfig({
  node,
  handleUpdate,
}: {
  node: Node;
  handleUpdate: (
    fieldOrUpdates: string | Record<string, unknown>,
    value?: unknown,
  ) => void;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const triggerType = node.data.triggerType;
  const selectedIds =
    triggerType === "story_reply"
      ? node.data.selectedStoryIds || []
      : node.data.selectedPostIds || [];

  const fetchContent = async () => {
    setLoading(true);
    try {
      if (triggerType === "story_reply") {
        const { getInstagramActiveStories } =
          await import("@/app/actions/instagram-page");
        const data = await getInstagramActiveStories();
        setItems(data);
      } else if (triggerType === "facebook_comment") {
        const { getConnectedFacebookPagePosts } =
          await import("@/app/actions/facebook-page");
        const data = await getConnectedFacebookPagePosts(30);
        setItems(data.posts);
      } else if (triggerType === "instagram_comment") {
        const { getConnectedInstagramAccountData } =
          await import("@/app/actions/instagram-page");
        const data = await getConnectedInstagramAccountData(30);
        setItems(data.media);
      }
    } catch (err) {
      console.error("Failed to fetch content:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContent();
  }, [triggerType]);

  const toggleSelection = (id: string) => {
    const field =
      triggerType === "story_reply" ? "selectedStoryIds" : "selectedPostIds";
    const nextIds = selectedIds.includes(id)
      ? selectedIds.filter((x: string) => x !== id)
      : [...selectedIds, id];
    handleUpdate(field, nextIds);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">
          Target {triggerType === "story_reply" ? "Stories" : "Posts"}
        </Label>
        <button
          onClick={fetchContent}
          disabled={loading}
          className="text-[10px] text-blue-600 font-bold hover:underline"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-2 border border-slate-100 dark:border-slate-800 max-h-[300px] overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 opacity-50">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-[10px]">Fetching latest content...</span>
          </div>
        ) : items.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => toggleSelection(item.id)}
                className={cn(
                  "relative aspect-square rounded-lg overflow-hidden border-2 transition-all",
                  selectedIds.includes(item.id)
                    ? "border-blue-600 ring-2 ring-blue-100"
                    : "border-transparent opacity-80",
                )}
              >
                <img
                  src={
                    item.thumbnail_url ||
                    item.media_url ||
                    item.full_picture ||
                    "https://placehold.co/100x100?text=Post"
                  }
                  className="w-full h-full object-cover"
                />
                {selectedIds.includes(item.id) && (
                  <div className="absolute inset-0 bg-blue-600/10 flex items-center justify-center">
                    <div className="bg-white rounded-full p-0.5">
                      <svg
                        className="w-3 h-3 text-blue-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="3"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-center py-4 text-slate-400">
            No content found.
          </p>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground italic">
        {selectedIds.length > 0
          ? `${selectedIds.length} items selected.`
          : "All posts monitored by default."}
      </p>
    </div>
  );
}

function PublicReplyConfig({
  node,
  handleUpdate,
}: {
  node: Node;
  handleUpdate: (
    fieldOrUpdates: string | Record<string, unknown>,
    value?: unknown,
  ) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed font-medium">
          <strong>Public Reply:</strong> This node will post a public response
          to the user's comment on Facebook or Instagram.
        </p>
      </div>

      <div>
        <Label className="text-xs font-semibold mb-2 block">
          Comment Reply Text
        </Label>
        <Textarea
          placeholder="Enter the text for your public comment reply..."
          value={node.data.message || ""}
          onChange={(e) => handleUpdate("message", e.target.value)}
          className="min-h-[120px] text-base border-gray-400 rounded-xl"
        />
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          This message will be visible to everyone on the post. You can use
          variables like {"{"}contact.name{"}"}.
        </p>
      </div>

      <div>
        <Label className="text-xs font-semibold mb-2 block">Node Label</Label>
        <Input
          placeholder="e.g., Public Thank You"
          value={node.data.label || ""}
          onChange={(e) => handleUpdate("label", e.target.value)}
          className="h-10 text-sm border-gray-400 rounded-xl"
        />
      </div>
    </div>
  );
}

function QuickReplyConfig({
  node,
  handleUpdate,
}: {
  node: Node;
  handleUpdate: (
    fieldOrUpdates: string | Record<string, unknown>,
    value?: unknown,
  ) => void;
}) {
  const [quickReplies, setQuickReplies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReplies = async () => {
      try {
        const data = await getQuickReplies();
        setQuickReplies(data);
      } catch (err) {
        console.error("Failed to fetch quick replies:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchReplies();
  }, []);

  const handleSelect = (id: string) => {
    const selected = quickReplies.find((qr) => qr.id === id);
    if (selected) {
      handleUpdate({
        quickReplyId: selected.id,
        quickReplyName: selected.name,
        quickReplyContent: selected.content || selected.fileName || "",
      });
    } else {
      handleUpdate({
        quickReplyId: "",
        quickReplyName: "",
        quickReplyContent: "",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
        <p className="text-xs text-indigo-600 dark:text-indigo-400 leading-relaxed font-medium">
          <strong>Quick Reply Node:</strong> Select a pre-configured quick reply. The bot will send this quick reply content to the user in the flow.
        </p>
      </div>

      <div>
        <Label className="text-xs font-semibold mb-2 block">
          Select Quick Reply
        </Label>
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading quick replies...
          </div>
        ) : (
          <select
            className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            value={node.data.quickReplyId || ""}
            onChange={(e) => handleSelect(e.target.value)}
          >
            <option value="">-- Select Quick Reply --</option>
            {quickReplies.map((qr) => (
              <option key={qr.id} value={qr.id}>
                {qr.name} ({qr.type})
              </option>
            ))}
          </select>
        )}
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          Quick replies are managed in the Live Chat settings.
        </p>
      </div>

      <div>
        <Label className="text-xs font-semibold mb-2 block">Node Label</Label>
        <Input
          placeholder="e.g., Send Welcome QR"
          value={node.data.label || ""}
          onChange={(e) => handleUpdate("label", e.target.value)}
          className="h-10 text-sm border-gray-400 rounded-xl"
        />
      </div>
    </div>
  );
}

function AIKnowledgeConfig({
  node,
  handleUpdate,
  aiAgents,
}: {
  node: Node;
  handleUpdate: (
    fieldOrUpdates: string | Record<string, unknown>,
    value?: unknown,
  ) => void;
  aiAgents: any[];
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs font-semibold block text-slate-500 uppercase tracking-wider">
          AI Agent / Knowledge Base
        </Label>
        <select
          className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          value={(node.data?.agentId as string) || ""}
          onChange={(e) => {
            const agentId = e.target.value;
            const selectedAgent = aiAgents.find(a => a.id === agentId);
            handleUpdate({
              agentId: agentId || null,
              agentName: selectedAgent ? selectedAgent.name : null,
            });
          }}
        >
          <option value="">Default Agent (Global KB)</option>
          {aiAgents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label className="text-xs font-semibold mb-2 block">Node Label</Label>
        <Input
          placeholder="e.g., Run Agent Q&A"
          value={node.data.label || ""}
          onChange={(e) => handleUpdate("label", e.target.value)}
          className="h-10 text-sm border-gray-400 rounded-xl"
        />
      </div>
    </div>
  );
}
