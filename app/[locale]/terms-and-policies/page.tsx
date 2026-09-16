import Link from 'next/link';
import { FileText, Shield, Building, ChevronRight } from 'lucide-react';

export default function TermsAndPoliciesIndex() {
  const policies = [
    {
      title: 'User Terms and Conditions',
      slug: 'user_terms',
      description: 'Terms governing platform account usage, user responsibilities, acceptable use, and service guidelines.',
      icon: FileText,
    },
    {
      title: 'Terms of Service',
      slug: 'terms_of_service',
      description: 'General agreement covering WhatsApp messaging API integrations, billing, subscriptions, and acceptable use policy.',
      icon: Shield,
    },
    {
      title: 'Privacy Policy',
      slug: 'privacy_policy',
      description: 'Comprehensive policy on data collection, privacy protection, WhatsApp message data security, and rights.',
      icon: Shield,
    },
    {
      title: 'Vendor Terms',
      slug: 'vendor_terms',
      description: 'Terms and conditions for third-party vendors, partners, and service integrations on the platform.',
      icon: Building,
    },
  ];

  return (
    <div className="min-h-screen bg-[#FDFDFD] dark:bg-[#0B0F19] p-6 md:p-12 lg:p-20 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="space-y-3 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
            Legal & Compliance Portal
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
            Terms & Policies
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm md:text-base">
            Review our official legal agreements, terms of service, and privacy policies.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {policies.map((p) => {
            const Icon = p.icon;
            return (
              <Link
                key={p.slug}
                href={`/terms-and-policies/${p.slug}`}
                className="group bg-white dark:bg-[#111827] border border-slate-200/70 dark:border-slate-800/70 rounded-3xl p-6 shadow-sm hover:shadow-md hover:border-[#00B074]/40 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-[#00B074] flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-[#00B074] transition-colors flex items-center justify-between">
                    {p.title}
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                    {p.description}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center text-xs font-bold text-[#00B074]">
                  Read Policy &rarr;
                </div>
              </Link>
            );
          })}
        </div>

        <div className="text-center pt-6">
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
