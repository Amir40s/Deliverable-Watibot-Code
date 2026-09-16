# External Integrations Reference

This document catalogues all third-party external services integrated into WatiBot, detailing authentication mechanisms, environment variable usage, endpoints called, database interactions, and error handling.

---

## 1. Meta Graph API (WhatsApp Cloud, Facebook & Instagram)

- **Purpose:** Official Meta integration for WhatsApp Cloud messaging, Facebook Page management, Instagram Direct messages, and Meta Lead Ads.
- **Graph API Version:** `v21.0`
- **Main Files:**
  - [lib/whatsapp/api.ts](file:///d:/web/watibot/lib/whatsapp/api.ts)
  - [lib/facebook/api.ts](file:///d:/web/watibot/lib/facebook/api.ts)
  - [lib/instagram/api.ts](file:///d:/web/watibot/lib/instagram/api.ts)
  - [app/api/webhooks/whatsapp/route.ts](file:///d:/web/watibot/app/api/webhooks/whatsapp/route.ts)
- **Configuration & Environment Variables:**
  - `META_APP_ID`: Meta Developer App ID
  - `META_APP_SECRET`: Meta App Secret for proof generation
  - `META_ACCESS_TOKEN`: System User Permanent Access Token fallback
  - `META_WEBHOOK_VERIFY_TOKEN`: Verification token for Meta webhook subscription challenges
- **APIs Called:**
  - `POST https://graph.facebook.com/v21.0/{phone_number_id}/messages` (Send WhatsApp messages)
  - `GET https://graph.facebook.com/v21.0/{waba_id}/message_templates` (Fetch approved WhatsApp templates)
  - `POST https://graph.facebook.com/v21.0/{page_id}/messages` (Send Facebook Messenger replies)
  - `POST https://graph.facebook.com/v21.0/{ig_user_id}/messages` (Send Instagram Direct replies)
- **Database Impact:** Updates `Organization.whatsappPhoneNumberId`, `Organization.metaAccessToken`, stores `Message`, `Contact`.
- **Error Handling:** Centralized in `handleMetaError()` in [lib/whatsapp/api.ts](file:///d:/web/watibot/lib/whatsapp/api.ts). Handles Code `190` (Token expired), Code `100` (Object does not exist / System User permissions mismatch), and Code `138000` (Calling not enabled).

---

## 2. OpenAI & Generative AI

- **Purpose:** Powers conversational chatbots, intent routing, e-commerce sales agents, tool calling, and vector embeddings.
- **Main Files:**
  - [lib/ai/openai.ts](file:///d:/web/watibot/lib/ai/openai.ts)
  - [lib/ai/router.ts](file:///d:/web/watibot/lib/ai/router.ts)
  - [lib/ai/embeddings.ts](file:///d:/web/watibot/lib/ai/embeddings.ts)
  - [lib/ai/sales-agent.ts](file:///d:/web/watibot/lib/ai/sales-agent.ts)
- **Configuration & Environment Variables:**
  - `OPENAI_API_KEY`: Organization-level or platform-level OpenAI key
  - Supports dynamic tenant override via `Organization.aiProviderApiKey`
- **Models Used:**
  - Chat Completion: `gpt-4o`, `gpt-4o-mini`
  - Embeddings: `text-embedding-3-small` (1536 dimensions)
- **Database Impact:** Creates `KnowledgeChunk` embeddings, logs `AIAgentExecution` tokens, persists AI bot replies in `Message`.

---

## 3. Realtime Push: Pusher Channels & Pusher Beams

- **Purpose:** WebSocket real-time live chat updates and browser push notifications.
- **Main Files:**
  - [lib/pusher.ts](file:///d:/web/watibot/lib/pusher.ts) (Server Pusher SDK)
  - [lib/pusher-client.ts](file:///d:/web/watibot/lib/pusher-client.ts) (Browser WebSocket client)
  - [lib/pusher-beams.ts](file:///d:/web/watibot/lib/pusher-beams.ts) (Push Notifications)
- **Configuration & Environment Variables:**
  - `PUSHER_APP_ID`: Application ID
  - `NEXT_PUBLIC_PUSHER_KEY`: Public client key
  - `PUSHER_SECRET`: Server secret key
  - `NEXT_PUBLIC_PUSHER_CLUSTER`: Geographic cluster (e.g. `ap2`, `eu`)
  - `PUSHER_BEAMS_INSTANCE_ID` & `PUSHER_BEAMS_SECRET_KEY`
- **Channels & Events:**
  - `private-org-{orgId}`: `new-message`, `message-status-updated`, `contact-updated`, `agent-assigned`
  - `chat-{contactId}`: `typing-indicator`, `message-delivered`

---

## 4. E-Commerce: Shopify & WooCommerce

- **Purpose:** Sync customer orders, query products, execute catalog tool queries, and send automated order confirmation/shipping updates over WhatsApp.
- **Main Files:**
  - [lib/shopify/api.ts](file:///d:/web/watibot/lib/shopify/api.ts) & [lib/shopify/actions.ts](file:///d:/web/watibot/lib/shopify/actions.ts)
  - [lib/woocommerce.ts](file:///d:/web/watibot/lib/woocommerce.ts) & [lib/woocommerce-actions.ts](file:///d:/web/watibot/lib/woocommerce-actions.ts)
  - [lib/whatsapp/order-notifications.ts](file:///d:/web/watibot/lib/whatsapp/order-notifications.ts)
- **Authentication:**
  - **Shopify:** Admin API Custom App Token (`X-Shopify-Access-Token`) or OAuth Integration Token.
  - **WooCommerce:** REST API Consumer Key & Consumer Secret with Basic Auth over HTTPS.
- **Database Impact:** Stores `ShopifyOrder`, `WooCommerceOrder`, and syncs `Product` catalog items.

---

## 5. Payment Gateways: Stripe, PayFast & GoFastPay

- **Purpose:** Subscription billing, add-on credit purchases, and automated plan renewals.
- **Main Files:**
  - [app/api/webhooks/stripe/route.ts](file:///d:/web/watibot/app/api/webhooks/stripe/route.ts)
  - [app/api/webhooks/payfast/route.ts](file:///d:/web/watibot/app/api/webhooks/payfast/route.ts)
  - [lib/payfast.ts](file:///d:/web/watibot/lib/payfast.ts)
  - [lib/subscription.ts](file:///d:/web/watibot/lib/subscription.ts)
- **Configuration & Environment Variables:**
  - `STRIPE_SECRET_KEY` & `STRIPE_WEBHOOK_SECRET`
  - `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`
- **Database Impact:** Creates `PaymentTransaction`, updates `Subscription.status`, `Subscription.endDate`, and `Organization.plan`.

---

## 6. Cloud Storage: Cloudinary, Cloudflare R2 / AWS S3 & Local

- **Purpose:** Upload and serve audio notes, video clips, PDF catalogs, and user avatars.
- **Main Files:**
  - [lib/storage/media-service.ts](file:///d:/web/watibot/lib/storage/media-service.ts)
  - [lib/storage/providers/cloudinary-provider.ts](file:///d:/web/watibot/lib/storage/providers/cloudinary-provider.ts)
  - [lib/storage/providers/r2-provider.ts](file:///d:/web/watibot/lib/storage/providers/r2-provider.ts)
  - [lib/storage/providers/local-provider.ts](file:///d:/web/watibot/lib/storage/providers/local-provider.ts)
- **Configuration & Environment Variables:**
  - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
  - `AWS_S3_BUCKET`, `AWS_S3_REGION`, `AWS_S3_ACCESS_KEY_ID`, `AWS_S3_SECRET_ACCESS_KEY`, `AWS_S3_ENDPOINT` (for R2)
- **Database Impact:** Persists file metadata in `MediaLibraryItem` and `Message.mediaUrl`.

---

## 7. Asynchronous Queue: Upstash QStash

- **Purpose:** High-throughput decoupled message queuing and scheduled HTTP callbacks for heavy webhook processing.
- **Main Files:**
  - [lib/qstash.ts](file:///d:/web/watibot/lib/qstash.ts)
  - [app/api/webhooks/whatsapp/queue/route.ts](file:///d:/web/watibot/app/api/webhooks/whatsapp/queue/route.ts)
- **Configuration & Environment Variables:**
  - `QSTASH_TOKEN`: Upstash QStash REST API Bearer token
  - `QSTASH_CURRENT_SIGNING_KEY` & `QSTASH_NEXT_SIGNING_KEY`: Webhook signature verification keys
