"use client"

import React from "react"
import WatiBotLoader from "@/components/WatiBotLoader"

export default function GlobalLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading WatiBot, syncing with Meta"
      className="fixed inset-0 z-[9999]"
    >
      <WatiBotLoader />
    </div>
  )
}

