"use client";

import React from "react";
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient";
import WatiBotLoader from "@/components/WatiBotLoader";

export default function WelcomeMessagesLoading() {
  return (
    <DashboardLayoutClient mainClassName="bg-[#F8FAFC] dark:bg-slate-950 min-h-screen flex items-center justify-center relative overflow-x-hidden font-[family-name:var(--dashboard-font)]">
      <WatiBotLoader />
    </DashboardLayoutClient>
  );
}
