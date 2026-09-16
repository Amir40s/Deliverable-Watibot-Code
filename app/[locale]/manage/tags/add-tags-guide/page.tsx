"use client";

import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, Star } from "lucide-react";
import { useState } from "react";

export default function AddTagsGuidePage() {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);

  return (
    <DashboardLayoutClient mainClassName=" antialiased bg-white min-h-screen max-w-3xl">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Tags
      </button>

      <article className="prose prose-sm max-w-none text-gray-700">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          How to Create &amp; Add Tags to Contacts
        </h1>
        <p className="text-xs text-gray-400 mb-6">
          Last updated: February 2026
        </p>

        {/* Step 1 — Create a tag */}
        <section className="mb-8">
          <h2 className="text-base font-bold text-gray-800 mb-2">
            Step 1 — Create a Tag
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-3">
            Before adding tags to a contact, you need to create them in the Tags
            section.
          </p>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-600">
            <li>
              Navigate to <strong>Tags</strong> from the left sidebar.
            </li>
            <li>
              Click the <strong>+ Create</strong> button on the top right.
            </li>
            <li>
              Enter a <strong>Tag Name</strong>.
            </li>
            <li>
              Click <strong>Submit</strong> to save the tag.
            </li>
          </ol>

          {/* Visual */}
          <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-6 flex flex-col items-center gap-2">
            <div className="w-full max-w-sm bg-white rounded-lg border border-gray-200 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-700">Tags</p>
                <button className="bg-teal-800 text-white text-[10px] px-3 py-1 rounded-lg flex items-center gap-1">
                  <span>+</span> Create
                </button>
              </div>
              <div className="border-t border-gray-100 pt-2 text-[10px] text-gray-400 text-center py-4">
                No tags created yet!
              </div>
            </div>
            <p className="text-xs text-gray-400">
              Tags list — click Create to get started
            </p>
          </div>
        </section>

        {/* Step 2 — Add via Live Chat */}
        <section className="mb-8">
          <h2 className="text-base font-bold text-gray-800 mb-2">
            Step 2 — Add Tags to a Contact via Live Chat
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-3">
            Once tags exist, you can attach them to individual contacts directly
            from the Live Chat view.
          </p>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-600">
            <li>
              Go to <strong>Live Chat</strong> from the sidebar.
            </li>
            <li>Open a conversation with the contact you want to tag.</li>
            <li>
              In the right-side contact panel, scroll to the{" "}
              <strong>Tags</strong> section.
            </li>
            <li>
              Click <strong>+ Add Tag</strong> and search for or select a tag.
            </li>
            <li>The tag is instantly saved to the contact profile.</li>
          </ol>

          <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-6 flex flex-col items-center gap-2">
            <div className="w-full max-w-sm bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
              <div className="bg-[#00B074] px-4 py-2.5 flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white text-[10px] font-bold">
                  AB
                </div>
                <span className="text-white text-xs font-medium">
                  Alice Brown
                </span>
              </div>
              <div className="p-3 space-y-2">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Tags
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 bg-teal-100 text-teal-700 text-[10px] rounded-full font-medium">
                    Lead
                  </span>
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] rounded-full font-medium">
                    Newsletter
                  </span>
                  <button className="px-2 py-0.5 border border-dashed border-gray-300 text-gray-400 text-[10px] rounded-full">
                    + Add Tag
                  </button>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              Tagging a contact from the Live Chat panel
            </p>
          </div>
        </section>

        {/* Step 3 — Bulk tagging via Contacts */}
        <section className="mb-8">
          <h2 className="text-base font-bold text-gray-800 mb-2">
            Step 3 — Bulk Tag Contacts
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-3">
            You can apply tags to multiple contacts at once from the Contacts
            section.
          </p>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-600">
            <li>
              Go to <strong>Contacts</strong> from the sidebar.
            </li>
            <li>Select the checkboxes next to the contacts you want to tag.</li>
            <li>
              Click <strong>Actions → Add Tag</strong> from the bulk action
              toolbar.
            </li>
            <li>Choose the tag(s) to apply and confirm.</li>
          </ol>
        </section>

        {/* Tips */}
        <section className="mb-8">
          <h2 className="text-base font-bold text-gray-800 mb-3">Tips</h2>
          <div className="space-y-3">
            {[
              {
                title: "Tags are reusable",
                desc: "The same tag can be applied to unlimited contacts — create once, use everywhere.",
              },
              {
                title: "Filter by tags",
                desc: "Use the tag filter in Contacts or Live Chat to quickly find all contacts with a specific tag.",
              },
              {
                title: "Combine with automation",
                desc: "Use tags as triggers or conditions in Flows to automate messages based on contact categories.",
              },
            ].map((tip) => (
              <div
                key={tip.title}
                className="flex gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100"
              >
                <ChevronRight className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {tip.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{tip.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Rating */}
        <div className="border-t border-gray-100 pt-6 flex flex-col items-center gap-2">
          <p className="text-sm text-gray-500 font-medium">
            Was this article helpful?
          </p>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => setRating(star)}
              >
                <Star
                  className="w-6 h-6 transition-colors"
                  fill={(hovered || rating) >= star ? "#FCD34D" : "none"}
                  stroke={(hovered || rating) >= star ? "#FCD34D" : "#D1D5DB"}
                />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-xs text-teal-700 font-medium">
              Thanks for your feedback!
            </p>
          )}
        </div>
      </article>
    </DashboardLayoutClient>
  );
}
