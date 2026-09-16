"use client";

import TutorialVideosForm from "@/components/admin/settings/TutorialVideosForm";

export default function TutorialVideosPage() {
  return (
    <div className="-mx-6 md:-mx-8 -mb-6 md:-mb-8 -mt-4 bg-[#fafbfc] dark:bg-slate-950 min-h-screen transition-colors duration-300 relative overflow-hidden plus-jakarta-forced">
      <div className="relative z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800/80 transition-colors">
        <div className="w-full px-8 py-6">
          <div className="space-y-1">
            <p className="text-[#00a884] font-black uppercase tracking-widest text-[9px]">CONFIGURATIONS</p>
            <h1 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">
              Tutorial Videos
            </h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
              Upload videos that help users understand the dashboard.
            </p>
          </div>
        </div>
      </div>

      <div className="relative z-10 w-full px-8 py-8 max-w-[1500px]">
        <TutorialVideosForm />
      </div>
    </div>
  );
}
