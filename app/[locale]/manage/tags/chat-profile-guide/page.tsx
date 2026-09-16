"use client"

import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient"
import { useRouter } from "next/navigation"
import { ArrowLeft, Star, ChevronRight } from "lucide-react"
import { useState } from "react"

export default function ChatProfileGuidePage() {
 const router = useRouter()
 const [rating, setRating] = useState(0)
 const [hovered, setHovered] = useState(0)

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

 {/* Article */}
 <article className="prose prose-sm max-w-none text-gray-700">
 <h1 className="text-2xl font-bold text-gray-900 mb-1">
 Using Chat Profile &amp; First Message Tag
 </h1>
 <p className="text-xs text-gray-400 mb-6">Last updated: February 2026</p>

 {/* What is a Chat Profile Tag */}
 <section className="mb-8">
 <h2 className="text-base font-bold text-gray-800 mb-2">What is a Chat Profile Tag?</h2>
 <p className="text-sm text-gray-600 leading-relaxed">
 A <strong>Chat Profile Tag</strong> allows you to label and categorize contacts based on their
 engagement behavior, interests, or any custom attribute you define. Tags are attached to a contact's
 profile and are visible in their chat window, making it easy for agents to understand context at a glance.
 </p>
 </section>

 {/* How to use */}
 <section className="mb-8">
 <h2 className="text-base font-bold text-gray-800 mb-2">How to Apply a Tag to a Chat Profile</h2>
 <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-600">
 <li>Open the <strong>Live Chat</strong> section from the sidebar.</li>
 <li>Select a conversation from the contact list.</li>
 <li>In the right panel, click <strong>+ Add Tag</strong> under the contact profile section.</li>
 <li>Search for an existing tag or type a new one and press Enter to create it.</li>
 <li>The tag is now saved to the contact profile and will appear on all future chats.</li>
 </ol>

 {/* Placeholder visual */}
 <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-6 flex flex-col items-center gap-2">
 <div className="w-full max-w-sm bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
 <div className="bg-[#00B074] px-4 py-3 flex items-center gap-3">
 <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold">JD</div>
 <span className="text-white text-sm font-medium">John Doe</span>
 </div>
 <div className="p-4 space-y-2">
 <div className="flex gap-2 flex-wrap">
 <span className="px-2 py-1 bg-teal-100 text-teal-700 text-xs rounded-full font-medium">VIP Customer</span>
 <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full font-medium">Interested</span>
 <button className="px-2 py-1 border border-dashed border-gray-300 text-gray-400 text-xs rounded-full hover:bg-gray-50 flex items-center gap-1">
 <span>+</span> Add Tag
 </button>
 </div>
 </div>
 </div>
 <p className="text-xs text-gray-400 mt-1">Tags attached to a contact profile in Live Chat</p>
 </div>
 </section>

 {/* First Message Tag */}
 <section className="mb-8">
 <h2 className="text-base font-bold text-gray-800 mb-2">What is a First Message Tag?</h2>
 <p className="text-sm text-gray-600 leading-relaxed">
 The <strong>First Message Tag</strong> is a special type of tag that is automatically applied to a contact
 when their first incoming message matches a keyword or phrase you have configured. This is useful for
 instantly categorizing new leads based on their initial intent.
 </p>
 <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
 <strong>💡 Example:</strong> If a contact's first message contains "pricing", they can automatically be tagged
 as "Price Inquiry" — so your team knows exactly what they need before the conversation even begins.
 </div>
 </section>

 {/* How to enable first message */}
 <section className="mb-8">
 <h2 className="text-base font-bold text-gray-800 mb-2">How to Enable First Message Tagging</h2>
 <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-600">
 <li>Go to <strong>Tags</strong> from the sidebar.</li>
 <li>Click <strong>+ Create</strong> to create a new tag.</li>
 <li>Fill in the <strong>Tag Name</strong> and <strong>Category</strong>.</li>
 <li>Toggle on <strong>First Message</strong>.</li>
 <li>Enter the keyword(s) that should trigger automatic tagging.</li>
 <li>Click <strong>Submit</strong> to save.</li>
 </ol>

 {/* Placeholder visual for create form */}
 <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-6">
 <div className="w-full max-w-sm bg-white rounded-lg border border-gray-200 p-4 shadow-sm space-y-3">
 <p className="text-xs font-semibold text-gray-700">Create Tag</p>
 <div className="bg-gray-100 rounded px-3 py-2 text-xs text-gray-400">Price Inquiry</div>
 <div className="bg-gray-100 rounded px-3 py-2 text-xs text-gray-400">Sales</div>
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs font-medium text-gray-700">First Message</p>
 <p className="text-[10px] text-gray-400">Auto-tag on first message match</p>
 </div>
 <div className="w-9 h-5 bg-teal-700 rounded-full relative">
 <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full" />
 </div>
 </div>
 <button className="bg-teal-800 text-white text-xs px-4 py-1.5 rounded-lg w-full">Submit</button>
 </div>
 <p className="text-xs text-gray-400 mt-2 text-center">Creating a tag with First Message enabled</p>
 </div>
 </section>

 {/* Tips */}
 <section className="mb-8">
 <h2 className="text-base font-bold text-gray-800 mb-3">Tips &amp; Best Practices</h2>
 <div className="space-y-3">
 {[
 { title: "Keep tag names short", desc: "Use concise, descriptive names like'High Value' or'Support Request' for quick identification." },
 { title: "Organize by category", desc: "Group related tags under the same category (e.g.,'Sales','Support') to keep your system tidy." },
 { title: "Use Customer Journey", desc: "Enable the Customer Journey toggle to track how contacts move through your funnel using tags." },
 { title: "Review inactive tags", desc: "Periodically audit and disable tags that are no longer in use to keep your workspace clean." },
 ].map((tip) => (
 <div key={tip.title} className="flex gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
 <ChevronRight className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
 <div>
 <p className="text-sm font-semibold text-gray-800">{tip.title}</p>
 <p className="text-xs text-gray-500 mt-0.5">{tip.desc}</p>
 </div>
 </div>
 ))}
 </div>
 </section>

 {/* Rating */}
 <div className="border-t border-gray-100 pt-6 flex flex-col items-center gap-2">
 <p className="text-sm text-gray-500 font-medium">Was this article helpful?</p>
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
 <p className="text-xs text-teal-700 font-medium">Thanks for your feedback!</p>
 )}
 </div>
 </article>
 </DashboardLayoutClient>
 )
}
