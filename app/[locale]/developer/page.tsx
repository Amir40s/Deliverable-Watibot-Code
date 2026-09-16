"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient";
import {
  getDeveloperKeys,
  getDeveloperSampleData,
  regenerateProjectApiKey,
} from "@/app/actions/developer";
import { toast } from "sonner";
import {
  BarChart3,
  BookTemplate,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Clock3,
  ContactRound,
  Copy,
  Bell,
  Database,
  Eye,
  EyeOff,
  Facebook,
  FileText,
  Focus,
  Headphones,
  Instagram,
  Key,
  LayoutDashboard,
  Loader2,
  Megaphone,
  MessageCircle,
  MessageSquareText,
  RefreshCw,
  Reply,
  ScrollText,
  Search,
  Send,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Tags,
  UserCog,
  Webhook,
  Workflow,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

const RTL_LOCALES = new Set(["ar", "ur"]);
const AUTH_HEADER = "X-WatiBot-Project-API-Key";

interface Keys {
  campaignApiKey: string | null;
  projectApiKey: string | null;
  webhookSecret: string | null;
  webhookUrl: string;
}

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

type EndpointDoc = {
  id: string;
  method: HttpMethod;
  path: string;
  title: string;
  description: string;
  query?: string[];
  body?: unknown;
};

type ApiGroup = {
  id: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  endpoints: EndpointDoc[];
};

function stringifyBody(body: unknown) {
  return JSON.stringify(body, null, 2);
}

function methodClasses(method: HttpMethod) {
  const styles: Record<HttpMethod, string> = {
    GET: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
    POST: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
    PATCH: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
    DELETE: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900",
  };
  return styles[method];
}

export default function DeveloperHubPage() {
  const t = useTranslations("DeveloperPage");
  const locale = useLocale();
  const isRtl = RTL_LOCALES.has(locale);
  const [keys, setKeys] = useState<Keys | null>(null);
  const [loading, setLoading] = useState(true);
  const [regeneratingProject, setRegeneratingProject] = useState(false);
  const [showProjectKey, setShowProjectKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState("https://your-domain.com");
  const [sampleMobileNumber, setSampleMobileNumber] = useState("923037771186");
  const [sampleCampaignId, setSampleCampaignId] = useState("CAMPAIGN_ID");
  const [expandedGroup, setExpandedGroup] = useState("dashboard");
  const [expandedEndpoint, setExpandedEndpoint] = useState("dashboard-get");

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [data, sampleData] = await Promise.all([
          getDeveloperKeys(),
          getDeveloperSampleData(),
        ]);
        setKeys(data);
        if (sampleData.mobileNumber) setSampleMobileNumber(sampleData.mobileNumber);
        if (sampleData.campaignId) setSampleCampaignId(sampleData.campaignId);
      } catch {
        toast.error(t("toasts.loadFailed"));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [t]);

  const projectToken = keys?.projectApiKey || "wbpk_PROJECT_TOKEN";
  const encodedSampleMobileNumber = encodeURIComponent(sampleMobileNumber);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(t("toasts.copied", { label }));
    });
  };

  const handleRegenerateProject = async () => {
    setRegeneratingProject(true);
    try {
      const res = await regenerateProjectApiKey();
      setKeys((prev) => prev ? { ...prev, projectApiKey: res.projectApiKey } : prev);
      toast.success(t("toasts.projectKeyRegenerated"));
    } catch {
      toast.error(t("toasts.regenerateFailed"));
    } finally {
      setRegeneratingProject(false);
    }
  };

  const maskKey = (key: string | null) => {
    if (!key) return "-";
    return key.slice(0, 8) + "*".repeat(Math.max(0, key.length - 12)) + key.slice(-4);
  };

  const apiGroups = useMemo<ApiGroup[]>(() => [
    {
      id: "auth",
      title: "Authentication",
      description: "Mobile app authentication endpoints for login, signup, and password recovery.",
      icon: Key,
      endpoints: [
        {
          id: "auth-login",
          method: "POST",
          path: "/api/v1/auth/login",
          title: "Login Agent",
          description: "Authenticates an agent and returns their basic details along with the project API key.",
          body: {
            email: "agent@example.com",
            password: "ChangeMe123!",
          },
        },
        {
          id: "auth-register",
          method: "POST",
          path: "/api/v1/auth/register",
          title: "Register User",
          description: "Registers a new user and optionally creates an organization, generating a new project API key.",
          body: {
            name: "New User",
            email: "newuser@example.com",
            password: "ChangeMe123!",
            organizationName: "My Business",
            phoneNumber: "1234567890",
          },
        },
        {
          id: "auth-forgot-password",
          method: "POST",
          path: "/api/v1/auth/forgot-password",
          title: "Forgot Password",
          description: "Sends a 6-digit password reset code to the user's email address.",
          body: {
            email: "agent@example.com",
          },
        },
      ],
    },
    {
      id: "dashboard",
      title: "Dashboard",
      description: "Use this endpoint to load the mobile dashboard summary for the current project token.",
      icon: LayoutDashboard,
      endpoints: [
        {
          id: "dashboard-get",
          method: "GET",
          path: "/api/v1/dashboard",
          title: "Get Dashboard Data",
          description: "Returns project profile, channel counts, dashboard metrics, recent conversations, and recent messages.",
        },
      ],
    },
    {
      id: "live-chat",
      title: "Live Chat",
      description: "Live chat APIs for list, send, search, and starting a template conversation.",
      icon: MessageSquareText,
      endpoints: [
        {
          id: "live-chat-get",
          method: "GET",
          path: "/api/v1/live-chat?limit=50",
          title: "Get Live Chat Data",
          description: "Returns live chat contacts, tab counts, selected contact, and full conversation messages for mobile.",
          query: ["limit", "message_limit", "mobile_number", "search", "platform"],
        },
        {
          id: "live-chat-post",
          method: "POST",
          path: "/api/v1/live-chat",
          title: "Post Live Chat Message",
          description: "Sends a text, media, or template message to an existing live chat contact by WhatsApp number.",
          body: {
            mobile_number: sampleMobileNumber,
            message: "Hello from mobile app",
            message_limit: 500,
            skip_window_check: false,
          },
        },
        {
          id: "live-chat-post-media",
          method: "POST",
          path: "/api/v1/live-chat",
          title: "Post Live Chat Media Message",
          description: "Sends a media message (image, audio, document) to an existing live chat contact by WhatsApp number. Use the media_url obtained from the media upload endpoint.",
          body: {
            mobile_number: sampleMobileNumber,
            media_url: "https://res.cloudinary.com/.../audio.mp3",
            content_type: "audio",
            sender_id: "agent_id_here",
            skip_window_check: false,
          },
        },
        {
          id: "live-chat-search",
          method: "GET",
          path: `/api/v1/live-chat/search?mobile_number=${encodedSampleMobileNumber}`,
          title: "Search Live Chat Contact",
          description: "Searches live chat contacts by name, email, or phone number and returns the matched conversation messages.",
          query: ["q", "contact", "mobile_number", "message_limit", "platform", "limit"],
        },
        {
          id: "live-chat-conversation",
          method: "POST",
          path: "/api/v1/live-chat/conversations",
          title: "Start New Conversation",
          description: "Creates or finds a WhatsApp contact and sends an approved template to open the conversation.",
          body: {
            mobile_number: sampleMobileNumber,
            name: "John Doe",
            template_name: "order_confirmation",
            language: "en",
            template_params: ["John", "ORD-1001"],
          },
        },
      ],
    },
    {
      id: "history",
      title: "History",
      description: "Read message and conversation history for the current project token.",
      icon: Clock3,
      endpoints: [
        {
          id: "history-get",
          method: "GET",
          path: "/api/v1/history?limit=100",
          title: "Get History Data",
          description: "Returns expired or closed conversations where the last inbound message is older than 24 hours.",
          query: ["limit", "message_limit", "mobile_number", "direction", "search"],
        },
      ],
    },
    {
      id: "contacts",
      title: "Contacts",
      description: "Saved contact-list CRUD APIs. Edit and delete can use the contact phone number in the path.",
      icon: ContactRound,
      endpoints: [
        {
          id: "contacts-get",
          method: "GET",
          path: "/api/v1/contacts?limit=50",
          title: "Get Contacts",
          description: "Lists saved Contacts page records for the project. Chat-only contacts are excluded.",
          query: ["page", "limit", "search", "platform", "tag_id", "group_id", "mobile_number"],
        },
        {
          id: "contacts-post",
          method: "POST",
          path: "/api/v1/contacts",
          title: "Create Contact",
          description: "Creates or updates a contact in the current project.",
          body: {
            name: "Jane Smith",
            mobile_number: sampleMobileNumber,
            email: "jane@example.com",
            attributes: {
              city: "Lahore",
              source: "mobile_app",
            },
          },
        },
        {
          id: "contacts-patch",
          method: "PATCH",
          path: `/api/v1/contacts/${encodedSampleMobileNumber}`,
          title: "Edit Contact By Number",
          description: "Updates contact fields using the contact phone number in the URL path.",
          body: {
            name: "Jane Smith Updated",
            is_blocked: false,
            attributes: {
              plan: "premium",
            },
          },
        },
        {
          id: "contacts-delete",
          method: "DELETE",
          path: `/api/v1/contacts/${encodedSampleMobileNumber}`,
          title: "Delete Contact By Number",
          description: "Deletes a contact from the token-scoped project.",
        },
      ],
    },
    {
      id: "audience",
      title: "Audience",
      description: "Audience data for tags, groups, chat audience, and top country breakdown.",
      icon: Tags,
      endpoints: [
        {
          id: "audience-get",
          method: "GET",
          path: "/api/v1/audience",
          title: "Get Audience Data",
          description: "Returns audience summary, tag segments, group segments, and country distribution.",
        },
      ],
    },
    {
      id: "catalogs",
      title: "Catalogs",
      description: "Catalog page data for WABA catalog status and local product records.",
      icon: ShoppingBag,
      endpoints: [
        {
          id: "catalogs-get",
          method: "GET",
          path: "/api/v1/catalogs?limit=50",
          title: "Get Catalog Page Data",
          description: "Returns WABA catalog settings, linked Meta catalogs when connected, and local catalog product records.",
          query: ["limit", "search", "status", "platform"],
        },
        {
          id: "catalogs-post",
          method: "POST",
          path: "/api/v1/catalogs",
          title: "Create Catalog Product",
          description: "Creates a new manual catalog product record for this project.",
          body: {
            name: "Premium Support Plan",
            description: "Monthly support package",
            price: 2500,
            currency: "PKR",
            sku: "support_plan_01",
            image_url: "https://example.com/product.jpg",
          },
        },
        {
          id: "catalogs-patch",
          method: "PATCH",
          path: "/api/v1/catalogs/PRODUCT_ID",
          title: "Edit Catalog Product",
          description: "Updates a catalog product record by product id in the URL path.",
          body: {
            name: "Premium Support Plan Updated",
            price: 3000,
            status: "active",
          },
        },
        {
          id: "catalogs-delete",
          method: "DELETE",
          path: "/api/v1/catalogs/PRODUCT_ID",
          title: "Delete Catalog Product",
          description: "Deletes a catalog product record from this project.",
        },
      ],
    },
    {
      id: "ad-manager",
      title: "Ad Manager",
      description: "Read the ad-manager page data for the connected Meta ad account.",
      icon: BarChart3,
      endpoints: [
        {
          id: "ad-manager-get",
          method: "GET",
          path: "/api/v1/ad-manager?date_preset=last_30d",
          title: "Get Ad Manager Data",
          description: "Returns connected pages, ad accounts, insights, campaigns, audience breakdown, and leads where Meta credentials are configured.",
          query: ["date_preset", "limit", "page_id", "ad_account_id"],
        },
      ],
    },
    {
      id: "facebook-posts",
      title: "Facebook Posts",
      description: "Read connected Facebook Page posts for the mobile app.",
      icon: Facebook,
      endpoints: [
        {
          id: "facebook-posts-get",
          method: "GET",
          path: "/api/v1/facebook-posts?limit=20",
          title: "Get Facebook Posts",
          description: "Returns posts from the connected Facebook Page, including message, media, permalink, and timestamps.",
          query: ["limit"],
        },
      ],
    },
    {
      id: "instagram-posts",
      title: "Instagram Posts",
      description: "Read connected Instagram Business account data for the mobile app.",
      icon: Instagram,
      endpoints: [
        {
          id: "instagram-posts-get",
          method: "GET",
          path: "/api/v1/instagram-posts?limit=20",
          title: "Get Instagram Posts",
          description: "Returns Instagram profile, media posts, and active stories from the connected business account.",
          query: ["limit"],
        },
      ],
    },
    {
      id: "templates",
      title: "Templates",
      description: "Approved WhatsApp template records available for this project.",
      icon: BookTemplate,
      endpoints: [
        {
          id: "templates-get",
          method: "GET",
          path: "/api/v1/templates?limit=100",
          title: "Get Templates",
          description: "Returns all WhatsApp message templates available through the connected Meta business account.",
          query: ["limit", "after", "before"],
        },
      ],
    },
    {
      id: "quick-replies",
      title: "Quick Replies",
      description: "Create, edit, list, and delete reusable quick reply records.",
      icon: Reply,
      endpoints: [
        {
          id: "quick-replies-get",
          method: "GET",
          path: "/api/v1/quick-replies?limit=50",
          title: "Get Quick Reply Data",
          description: "Returns quick reply records scoped to the current project token.",
          query: ["limit", "search", "type"],
        },
        {
          id: "quick-replies-post",
          method: "POST",
          path: "/api/v1/quick-replies",
          title: "Create Quick Reply",
          description: "Creates a new text or media quick reply.",
          body: {
            name: "support_intro",
            type: "text",
            content: "Hi, how can we help you today?",
          },
        },
        {
          id: "quick-replies-patch",
          method: "PATCH",
          path: "/api/v1/quick-replies/support_intro",
          title: "Edit Quick Reply",
          description: "Updates an existing quick reply record by its current name in the path. The database id also works.",
          body: {
            content: "Hi, our support team is here. How can we help?",
          },
        },
        {
          id: "quick-replies-delete",
          method: "DELETE",
          path: "/api/v1/quick-replies/support_intro",
          title: "Delete Quick Reply",
          description: "Deletes an existing quick reply record by its current name in the path. If you renamed it, delete with the new name returned from GET.",
        },
      ],
    },
    {
      id: "quick-messages",
      title: "Quick Messages",
      description: "Welcome and trigger message records used by the Quick Message page.",
      icon: MessageCircle,
      endpoints: [
        {
          id: "quick-messages-get",
          method: "GET",
          path: "/api/v1/quick-messages?limit=50",
          title: "Get Quick Message Records",
          description: "Returns welcome and trigger message records for this project.",
          query: ["limit", "search", "is_active", "platform"],
        },
        {
          id: "quick-messages-post",
          method: "POST",
          path: "/api/v1/quick-messages",
          title: "Create Quick Message",
          description: "Creates a welcome or trigger message rule.",
          body: {
            name: "hello Sir",
            content: "Hello. Welcome to Asaan Khata!",
            is_active: true,
            priority: 0,
            conditions: [
              {
                id: "first-message-of-day",
                type: "first_message_of_day",
              },
            ],
          },
        },
        {
          id: "quick-messages-patch",
          method: "PATCH",
          path: "/api/v1/quick-messages/hello%20Sir",
          title: "Update Quick Message",
          description: "Updates a quick message by its current name in the path. The database id also works.",
          body: {
            content: "Hello. Our support team is here. How can we help?",
            is_active: true,
          },
        },
        {
          id: "quick-messages-delete",
          method: "DELETE",
          path: "/api/v1/quick-messages/hello%20Sir",
          title: "Delete Quick Message",
          description: "Deletes a quick message by its current name in the path. The database id also works.",
        },
      ],
    },
    {
      id: "drip-campaigns",
      title: "Drip Campaigns",
      description: "Campaign records used by the drip campaign page.",
      icon: Megaphone,
      endpoints: [
        {
          id: "drip-campaigns-get",
          method: "GET",
          path: "/api/v1/drip-campaigns?limit=50",
          title: "Get Campaign Records",
          description: "Returns all drip campaign records for this project.",
          query: ["limit", "status"],
        },
        {
          id: "drip-campaigns-post",
          method: "POST",
          path: "/api/v1/drip-campaigns",
          title: "Create Campaign",
          description: "Creates a new drip campaign record for a contact by phone number. Use group_id only for group campaigns.",
          body: {
            mobile_number: sampleMobileNumber,
            content: "Campaign message body",
            scheduled_at: "2026-07-07T10:00:00.000Z",
            template_name: "order_confirmation",
            template_language: "en",
            template_params: ["John", "ORD-1001"],
          },
        },
        {
          id: "drip-campaigns-patch",
          method: "PATCH",
          path: `/api/v1/drip-campaigns/${sampleCampaignId}`,
          title: "Edit Campaign",
          description: "Updates an existing drip campaign record by id from the GET response.",
          body: {
            content: "Updated campaign message body",
            scheduled_at: "2026-07-08T10:00:00.000Z",
            status: "PENDING",
          },
        },
        {
          id: "drip-campaigns-delete",
          method: "DELETE",
          path: `/api/v1/drip-campaigns/${sampleCampaignId}`,
          title: "Delete Campaign",
          description: "Deletes a drip campaign record by id from the GET response.",
        },
      ],
    },
    {
      id: "flows",
      title: "Flows",
      description: "Read all automation flows built inside the system.",
      icon: Workflow,
      endpoints: [
        {
          id: "flows-get",
          method: "GET",
          path: "/api/v1/flows?limit=50",
          title: "Get Flow Records",
          description: "Returns all flow records created in this project.",
          query: ["limit", "active", "platform"],
        },
      ],
    },
    {
      id: "knowledge-base",
      title: "Knowledge Base",
      description: "Read uploaded knowledge-base records, including uploaded PDFs.",
      icon: FileText,
      endpoints: [
        {
          id: "knowledge-base-get",
          method: "GET",
          path: "/api/v1/knowledge-base?limit=50",
          title: "Get Uploaded Knowledge Files",
          description: "Returns uploaded knowledge-base records for the Files tab. Use file_type=pdf, file_type=txt, or file_type=google_sheet to filter.",
          query: ["limit", "status", "file_type"],
        },
      ],
    },
    {
      id: "manage-reports",
      title: "Manage Reports",
      description: "Read the reports page data for mobile dashboards.",
      icon: BarChart3,
      endpoints: [
        {
          id: "manage-reports-get",
          method: "GET",
          path: "/api/v1/reports?limit=20",
          title: "Get Report Page Data",
          description: "Returns report KPIs, channel split, agents, segments, flows, and campaign data.",
          query: ["start_date", "end_date", "agent_id", "limit"],
        },
      ],
    },
    {
      id: "manage-agents",
      title: "Agents",
      description: "Agent directory APIs for listing, creating, editing, and deleting team users.",
      icon: Headphones,
      endpoints: [
        {
          id: "agents-get",
          method: "GET",
          path: "/api/v1/agents?limit=50",
          title: "Get Agent Page Details",
          description: "Returns agents, departments, permissions, device summary, and counts.",
          query: ["limit", "search", "status", "role", "department_id"],
        },
        {
          id: "agents-post",
          method: "POST",
          path: "/api/v1/agents",
          title: "Create Agent",
          description: "Creates a new project team user.",
          body: {
            name: "Support Agent",
            email: "agent@example.com",
            password: "ChangeMe123!",
            role: "USER",
            status: "ACTIVE",
            department_name: "Support",
            permissions: {
              chat: "full",
              contacts: "view",
            },
          },
        },
        {
          id: "agents-patch",
          method: "PATCH",
          path: "/api/v1/agents/AGENT_ID",
          title: "Edit Agent",
          description: "Updates an agent record by user id.",
          body: {
            name: "Senior Support Agent",
            status: "ACTIVE",
            role: "USER",
            permissions: {
              reports: "view",
            },
          },
        },
        {
          id: "agents-delete",
          method: "DELETE",
          path: "/api/v1/agents/AGENT_ID",
          title: "Delete Agent",
          description: "Deletes an agent from this project.",
        },
      ],
    },
    {
      id: "manage-permissions",
      title: "Permissions",
      description: "Permission matrix APIs for users and module access levels.",
      icon: ShieldCheck,
      endpoints: [
        {
          id: "permissions-get",
          method: "GET",
          path: "/api/v1/permissions",
          title: "Get Permission Records",
          description: "Returns permission modules, role counts, and user permission records.",
        },
        {
          id: "permissions-patch",
          method: "PATCH",
          path: "/api/v1/permissions/AGENT_ID",
          title: "Update User Permissions",
          description: "Updates module access levels for one agent.",
          body: {
            permissions: {
              dashboard: "view",
              chat: "full",
              reports: "none",
            },
          },
        },
      ],
    },
    {
      id: "manage-tags",
      title: "Tags",
      description: "Tag page APIs for list, create, edit, and delete.",
      icon: Tags,
      endpoints: [
        {
          id: "tags-get",
          method: "GET",
          path: "/api/v1/tags?limit=100",
          title: "Get Tag Records",
          description: "Returns all project tags with category, color, and contact counts.",
          query: ["limit", "search", "category"],
        },
        {
          id: "tags-post",
          method: "POST",
          path: "/api/v1/tags",
          title: "Create Tag",
          description: "Creates a new tag record.",
          body: {
            name: "VIP Customer",
            color: "#10B981",
            category: "General",
          },
        },
        {
          id: "tags-patch",
          method: "PATCH",
          path: "/api/v1/tags/TAG_ID",
          title: "Edit Tag",
          description: "Updates an existing tag by id.",
          body: {
            name: "VIP Customer Updated",
            color: "#2563EB",
            category: "Label",
          },
        },
        {
          id: "tags-delete",
          method: "DELETE",
          path: "/api/v1/tags/TAG_ID",
          title: "Delete Tag",
          description: "Deletes a tag record by id.",
        },
      ],
    },
    {
      id: "manage-notifications",
      title: "Notifications",
      description: "Read notification center records for mobile.",
      icon: Bell,
      endpoints: [
        {
          id: "notifications-get",
          method: "GET",
          path: "/api/v1/notifications?limit=20",
          title: "Get Notification Records",
          description: "Returns activity-log backed notifications with unread count and module summary.",
          query: ["page", "limit", "tab", "days", "unread_since", "last_read_at"],
        },
      ],
    },
    {
      id: "manage-activity-log",
      title: "Activity Log",
      description: "Read audit activity log data for mobile.",
      icon: ScrollText,
      endpoints: [
        {
          id: "activity-log-get",
          method: "GET",
          path: "/api/v1/activity-log?limit=20",
          title: "Get Activity Log Records",
          description: "Returns audit logs, pagination, and status KPI counts.",
          query: ["page", "limit", "module", "action", "status", "search", "date_from", "date_to"],
        },
      ],
    },
    {
      id: "manage-settings",
      title: "Settings",
      description: "Read and update project settings, channel state, and business profile fields.",
      icon: Settings,
      endpoints: [
        {
          id: "settings-get",
          method: "GET",
          path: "/api/v1/settings",
          title: "Get Settings Data",
          description: "Returns project settings, business profile, WhatsApp/Facebook/Instagram connection state, and AI settings.",
        },
        {
          id: "settings-patch",
          method: "PATCH",
          path: "/api/v1/settings",
          title: "Update Settings",
          description: "Updates editable project settings while preserving developer key metadata.",
          body: {
            name: "John's Project",
            business_email: "support@example.com",
            business_description: "Customer support and commerce automation",
            timezone: "Asia/Karachi",
            is_ai_bot_enabled: true,
          },
        },
      ],
    },
    {
      id: "manage-integrations",
      title: "Integrations",
      description: "Read and update Shopify and WooCommerce integration data.",
      icon: UserCog,
      endpoints: [
        {
          id: "integrations-get",
          method: "GET",
          path: "/api/v1/integrations",
          title: "Get Integration Data",
          description: "Returns Shopify and WooCommerce connection details, local orders, products, customers, and automation settings.",
        },
        {
          id: "integrations-patch",
          method: "PATCH",
          path: "/api/v1/integrations",
          title: "Update Integration",
          description: "Updates Shopify or WooCommerce connection and automation settings.",
          body: {
            integration: "woocommerce",
            store_url: "https://store.example.com",
            order_automation_enabled: true,
            automation: {
              order_created: {
                enabled: true,
                template: "order_confirmation",
              },
            },
          },
        },
      ],
    },
    {
      id: "manage-webhooks",
      title: "Webhooks",
      description: "External webhook CRUD APIs for the webhook page.",
      icon: Webhook,
      endpoints: [
        {
          id: "webhooks-get",
          method: "GET",
          path: "/api/v1/webhooks",
          title: "Get Webhook Records",
          description: "Returns all external webhook records for this project.",
        },
        {
          id: "webhooks-post",
          method: "POST",
          path: "/api/v1/webhooks",
          title: "Create Webhook",
          description: "Creates a new external webhook and returns the generated secret once.",
          body: {
            name: "Order Sync",
            target_url: "https://example.com/webhooks/watibot",
            events: ["message.received", "contact.created"],
            is_active: true,
          },
        },
        {
          id: "webhooks-patch",
          method: "PATCH",
          path: "/api/v1/webhooks/WEBHOOK_ID",
          title: "Update Webhook",
          description: "Updates an external webhook by id.",
          body: {
            name: "Order Sync Updated",
            events: ["message.received"],
            is_active: false,
          },
        },
        {
          id: "webhooks-delete",
          method: "DELETE",
          path: "/api/v1/webhooks/WEBHOOK_ID",
          title: "Delete Webhook",
          description: "Deletes an external webhook by id.",
        },
      ],
    },
    {
      id: "manage-quota",
      title: "Quota",
      description: "Read the quota page records for mobile.",
      icon: Database,
      endpoints: [
        {
          id: "quota-get",
          method: "GET",
          path: "/api/v1/quota",
          title: "Get Quota Records",
          description: "Returns plan limits, usage, remaining quota, and per-resource percentages.",
        },
      ],
    },
    {
      id: "manage-projects",
      title: "All Projects",
      description: "Read all projects owned by the current project owner.",
      icon: Focus,
      endpoints: [
        {
          id: "projects-get",
          method: "GET",
          path: "/api/v1/projects",
          title: "Get All Project Records",
          description: "Returns all projects owned by the same owner as the token-scoped project.",
        },
      ],
    },
  ], [encodedSampleMobileNumber, sampleCampaignId, sampleMobileNumber]);

  const buildCurl = (endpoint: EndpointDoc) => {
    const lines = [
      `curl -X ${endpoint.method} "${baseUrl}${endpoint.path}"`,
      `  -H "${AUTH_HEADER}: ${projectToken}"`,
    ];

    if (endpoint.body) {
      lines.push('  -H "Content-Type: application/json"');
      lines.push(`  -d '${stringifyBody(endpoint.body)}'`);
    }

    return lines.join(" \\\n");
  };

  if (loading) {
    return (
      <DashboardLayoutClient mainClassName="pb-16">
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#00B074]" />
        </div>
      </DashboardLayoutClient>
    );
  }

  return (
    <DashboardLayoutClient mainClassName="pb-16">
      <div dir={isRtl ? "rtl" : "ltr"} className="flex w-full flex-col gap-6 text-start">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00B074]">Mobile API</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("title")}</h1>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-base font-bold text-foreground">{t("credentialsTitle")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("credentialsDescription")}</p>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center gap-3">
                  <Key className="h-5 w-5 text-[#00B074]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{t("projectApiKey")}</p>
                    <div className="mt-1 flex min-w-0 items-center gap-2">
                      <code className="truncate text-sm font-bold text-foreground">
                        {showProjectKey ? (keys?.projectApiKey ?? "-") : maskKey(keys?.projectApiKey ?? null)}
                      </code>
                      <button
                        type="button"
                        onClick={() => setShowProjectKey((value) => !value)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-slate-100"
                        aria-label={showProjectKey ? "Hide project key" : "Show project key"}
                      >
                        {showProjectKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 lg:justify-end">
                <button
                  type="button"
                  onClick={() => copyToClipboard(keys?.projectApiKey ?? "", t("projectApiKey"))}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-foreground shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                >
                  <Copy className="h-4 w-4" />
                  {t("copyKey")}
                </button>
                <button
                  type="button"
                  onClick={handleRegenerateProject}
                  disabled={regeneratingProject}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#00B074] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#009662] disabled:opacity-60"
                >
                  {regeneratingProject ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {t("regenerateKey")}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Mobile API cURL Reference</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Every request is scoped by the project token in the {AUTH_HEADER} header.
                </p>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(`${AUTH_HEADER}: ${projectToken}`, "Authorization header")}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                <Copy className="h-4 w-4" />
                Copy Header
              </button>
            </div>
            <code className="block overflow-auto rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-xs text-emerald-300">
              {AUTH_HEADER}: {projectToken}
            </code>
          </div>

          <div className="grid gap-4">
            {apiGroups.map((group) => {
              const Icon = group.icon;
              const isOpen = expandedGroup === group.id;
              return (
                <div key={group.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <button
                    type="button"
                    onClick={() => setExpandedGroup(isOpen ? "" : group.id)}
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-start transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#00B074]/10 text-[#00B074]">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold uppercase tracking-wider text-foreground">{group.title}</span>
                        <span className="mt-0.5 block text-sm text-muted-foreground">{group.description}</span>
                      </span>
                    </span>
                    {isOpen ? <ChevronUp className="h-5 w-5 shrink-0 text-slate-500" /> : <ChevronDown className="h-5 w-5 shrink-0 text-slate-500" />}
                  </button>

                  {isOpen && (
                    <div className="border-t border-slate-200 p-4 dark:border-slate-800">
                      <div className="grid gap-3">
                        {group.endpoints.map((endpoint) => {
                          const endpointOpen = expandedEndpoint === endpoint.id;
                          const curl = buildCurl(endpoint);
                          return (
                            <div key={endpoint.id} className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
                              <button
                                type="button"
                                onClick={() => setExpandedEndpoint(endpointOpen ? "" : endpoint.id)}
                                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start"
                              >
                                <span className="flex min-w-0 flex-wrap items-center gap-2">
                                  <span className={`rounded-md border px-2.5 py-1 text-xs font-black ${methodClasses(endpoint.method)}`}>
                                    {endpoint.method}
                                  </span>
                                  <code className="break-all text-sm font-bold text-foreground">{endpoint.path}</code>
                                  <span className="w-full text-sm font-semibold text-foreground md:w-auto">{endpoint.title}</span>
                                </span>
                                {endpointOpen ? <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" /> : <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />}
                              </button>

                              {endpointOpen && (
                                <div className="border-t border-slate-200 p-4 dark:border-slate-800">
                                  <p className="text-sm text-muted-foreground">{endpoint.description}</p>

                                  {endpoint.query && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {endpoint.query.map((query) => (
                                        <span key={query} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                                          {query}
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950">
                                    <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-2">
                                      <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                                        <BookOpen className="h-3.5 w-3.5" />
                                        cURL
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => copyToClipboard(curl, `${endpoint.title} cURL`)}
                                        className="inline-flex h-8 items-center gap-2 rounded-md px-2.5 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
                                      >
                                        <Copy className="h-3.5 w-3.5" />
                                        Copy
                                      </button>
                                    </div>
                                    <pre className="max-h-96 overflow-auto p-4 text-xs leading-6 text-emerald-300">
                                      <code>{curl}</code>
                                    </pre>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <Send className="h-5 w-5 text-[#00B074]" />
            <span className="font-semibold text-foreground">Mobile requests use header auth only.</span>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <Search className="h-5 w-5 text-[#00B074]" />
            <span className="font-semibold text-foreground">Search APIs are read-only GET requests.</span>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <Key className="h-5 w-5 text-[#00B074]" />
            <span className="font-semibold text-foreground">Regenerating the token replaces access for this project.</span>
          </div>
        </div>
      </div>
    </DashboardLayoutClient>
  );
}
