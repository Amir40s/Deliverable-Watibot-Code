import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';

interface PolicyPageProps {
  params: Promise<{
    policy: string;
  }>;
}

const DEFAULT_POLICIES: Record<string, { title: string; content: string }> = {
  user_terms: {
    title: 'User Terms and Conditions',
    content: `Welcome to WatiBot. By accessing or using our platform, services, software, and applications (collectively, the "Service"), you agree to be bound by these User Terms and Conditions ("Terms"). Please read them carefully.

1. Account Registration & Responsibilities
You must provide accurate, current, and complete information during registration. You are responsible for safeguarding your account credentials and for all activities that occur under your account. You must notify us immediately upon becoming aware of any breach of security or unauthorized use of your account.

2. Permitted Use & Service Rules
You agree not to use the Service for any unlawful purpose or in any way that violates applicable laws or Meta WhatsApp Business Messaging Policies. You shall not send spam, unauthorized promotional messages, or abusive content through our WhatsApp Messaging APIs.

3. Intellectual Property Rights
All intellectual property rights in the Service, including software, design, logos, trademarks, and documentation, are owned by or licensed to WatiBot. You are granted a limited, non-exclusive, non-transferable license to use the Service in accordance with these Terms.

4. Service Availability & Modifications
We strive to maintain high service uptime, but we do not guarantee uninterrupted access. We reserve the right to modify, suspend, or discontinue any feature of the Service at any time with or without notice.

5. Limitation of Liability
To the maximum extent permitted by law, WatiBot and its affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your access to or use of, or inability to access or use, the Service.

6. Governing Law & Dispute Resolution
These Terms shall be governed by and construed in accordance with applicable laws. Any disputes arising under or in connection with these Terms shall be subject to the exclusive jurisdiction of the competent courts.`,
  },
  terms_of_service: {
    title: 'Terms of Service',
    content: `These Terms of Service ("Agreement") govern your access to and use of WatiBot's WhatsApp Automation, CRM, API integration, and messaging platform. By creating an account or using our platform, you agree to comply with this Agreement.

1. Scope of Service
WatiBot provides software tools to manage WhatsApp customer messaging, automated workflows, campaign scheduling, and CRM contact management through official WhatsApp Business APIs and cloud integrations.

2. User Compliance & Anti-Spam Policy
You are strictly required to adhere to Meta's WhatsApp Business Solution Terms and Commerce Policies. Sending spam, deceptive messages, or unsolicited bulk broadcasts to individuals who have not explicitly opted in is strictly prohibited. Failure to comply may result in immediate account suspension or termination.

3. Subscriptions, Payments & Billing
- Subscriptions are billed in advance on a recurring monthly or annual basis depending on your plan.
- All fees and charges are non-refundable except as required by law or specified in your subscription agreement.
- We reserve the right to adjust pricing for our services upon reasonable notice.

4. Account Suspension & Termination
We reserve the right to suspend or terminate your access to the Service immediately, without prior notice, if you breach any provision of this Agreement or engage in fraudulent or abusive activities.

5. Disclaimer of Warranties
The Service is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, whether express or implied, including fitness for a particular purpose or non-infringement.`,
  },
  privacy_policy: {
    title: 'Privacy Policy',
    content: `At WatiBot, we are committed to protecting your privacy and ensuring the security of your personal data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website or use our messaging platform.

1. Information We Collect
- Personal Information: Name, email address, phone number, billing details, and company details provided during registration.
- Message & Interaction Data: Phone numbers, message metadata, incoming/outgoing WhatsApp messages, tags, and notes created within your CRM account.
- Usage & Device Data: IP address, browser type, operating system, log files, and analytics information collected automatically when navigating our platform.

2. How We Use Your Information
We use the collected information to:
- Provide, maintain, and optimize our messaging and CRM services.
- Process transactions, manage subscriptions, and send transactional notifications.
- Facilitate WhatsApp message delivery via Meta WhatsApp Cloud APIs.
- Provide customer support and debug platform issues.
- Ensure security and compliance with legal and regulatory obligations.

3. Data Sharing & Third-Party Service Providers
We do not sell your personal data. We share information only with trusted third-party providers necessary to deliver our services, including:
- Meta / WhatsApp Cloud API for message transmission.
- Payment processors for billing handling.
- Infrastructure and database cloud hosting providers.

4. Data Security & Retention
We implement industry-standard administrative, technical, and physical security measures to safeguard your personal data. Data is retained only as long as necessary to fulfill the purposes outlined in this policy or as required by law.

5. Your Data Protection Rights
You have the right to access, update, export, or request deletion of your personal information stored in our system at any time by contacting our support team.`,
  },
  vendor_terms: {
    title: 'Vendor Terms and Conditions',
    content: `These Vendor Terms and Conditions apply to all third-party vendors, partners, and service providers integrating with or offering services on the WatiBot platform.

1. Vendor Obligations
Vendors must maintain high standards of reliability, security, and data protection. Vendors must comply with all applicable local and international laws, intellectual property rights, and data privacy regulations.

2. Service Level Agreements (SLA)
Vendors agree to maintain an average service availability of at least 99.9% and promptly inform WatiBot of any technical disruptions, security incidents, or maintenance schedules.

3. Confidentiality & Non-Disclosure
All proprietary technology, business information, customer data, and source code disclosed during the partnership shall remain strictly confidential and shall not be disclosed to any third party without prior written consent.`,
  },
};

export default async function PolicyPage({ params }: PolicyPageProps) {
  const { policy } = await params;

  if (!DEFAULT_POLICIES[policy]) {
    return notFound();
  }

  const config = await prisma.systemConfig.findFirst({
    orderBy: { createdAt: 'desc' },
  }).catch(() => null);

  const fallback = DEFAULT_POLICIES[policy];
  let title = fallback.title;
  let content = fallback.content;

  if (config) {
    if (policy === 'user_terms' && config.userTerms?.trim()) {
      content = config.userTerms;
    } else if (policy === 'vendor_terms' && config.vendorTerms?.trim()) {
      content = config.vendorTerms;
    } else if (policy === 'terms_of_service' && config.termsOfService?.trim()) {
      content = config.termsOfService;
    } else if (policy === 'privacy_policy' && config.privacyPolicy?.trim()) {
      content = config.privacyPolicy;
    }
  }

  const platformName = config?.platformName || 'WatiBot';
  const lastUpdated = config?.updatedAt
    ? new Date(config.updatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'August 19, 2026';

  return (
    <div className="min-h-screen bg-[#FDFDFD] dark:bg-[#0B0F19] p-6 md:p-12 lg:p-20 selection:bg-emerald-100 selection:text-emerald-900 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Navigation Quick Links Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white dark:bg-[#111827] border border-slate-200/60 dark:border-slate-800/60 rounded-2xl shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Helpful Links</span>
          <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
            <Link
              href="/terms-and-policies/user_terms"
              className={`px-3 py-1.5 rounded-xl transition-colors ${
                policy === 'user_terms'
                  ? 'bg-[#00B074] text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              User Terms
            </Link>
            <Link
              href="/terms-and-policies/terms_of_service"
              className={`px-3 py-1.5 rounded-xl transition-colors ${
                policy === 'terms_of_service'
                  ? 'bg-[#00B074] text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Terms of Service
            </Link>
            <Link
              href="/terms-and-policies/privacy_policy"
              className={`px-3 py-1.5 rounded-xl transition-colors ${
                policy === 'privacy_policy'
                  ? 'bg-[#00B074] text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms-and-policies/vendor_terms"
              className={`px-3 py-1.5 rounded-xl transition-colors ${
                policy === 'vendor_terms'
                  ? 'bg-[#00B074] text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Vendor Terms
            </Link>
          </div>
        </div>

        {/* Main Legal Card */}
        <div className="bg-white dark:bg-[#111827] border border-slate-200/60 dark:border-slate-800/60 rounded-3xl shadow-xl shadow-slate-200/20 dark:shadow-none overflow-hidden">
          <header className="px-8 pt-12 pb-8 md:px-16 md:pt-16 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/20">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
                Official Legal Policy
              </div>
              <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                {title}
              </h1>
              <div className="h-1.5 w-24 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full" />
              <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">
                Last updated: {lastUpdated}
              </p>
            </div>
          </header>

          <main className="px-8 py-12 md:px-16 md:py-16">
            <div className="prose prose-slate dark:prose-invert max-w-none">
              <div className="whitespace-pre-wrap text-slate-700 dark:text-slate-300 leading-relaxed text-base md:text-lg font-normal space-y-4">
                {content}
              </div>
            </div>
          </main>

          <footer className="px-8 py-8 md:px-16 border-t border-slate-100 dark:border-slate-800/50 bg-slate-50/30 dark:bg-slate-900/10 text-sm text-slate-500 dark:text-slate-400 flex flex-col md:flex-row justify-between items-center gap-4">
            <p>© {new Date().getFullYear()} {platformName}. All rights reserved.</p>
            <div className="flex gap-6 font-medium">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Verified Compliance Document</span>
            </div>
          </footer>
        </div>

        <div className="text-center">
          <Link
            href="/login"
            className="text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-sm font-semibold"
          >
            ← Return to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
