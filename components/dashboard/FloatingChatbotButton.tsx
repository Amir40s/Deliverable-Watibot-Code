"use client"

import { useEffect, useState } from "react"
import { Bot, Send, X } from "lucide-react"

interface ChatbotRuntimeConfig {
 aiProvider?: string
 aiProviderApiKey?: string | null
}

interface UIMessage {
 role: "user" | "assistant"
 content: string
}

export default function FloatingChatbotButton() {
 const [isVisible, setIsVisible] = useState(false)
 const [isOpen, setIsOpen] = useState(false)
 const [messages, setMessages] = useState<UIMessage[]>([
 { role: "assistant", content: "Hi! I am your AI chatbot. How can I help you today?" },
 ])
 const [input, setInput] = useState("")
 const [isSending, setIsSending] = useState(false)

 useEffect(() => {
 let isMounted = true

 const loadConfig = async () => {
 try {
 const response = await fetch("/api/admin/configurations/social", { cache: "no-store" })
 if (!response.ok) return

 const config: ChatbotRuntimeConfig = await response.json()
 const hasApiKey = Boolean(config.aiProviderApiKey && config.aiProviderApiKey.trim().length > 0)

 if (isMounted) {
 setIsVisible(hasApiKey)
 }
 } catch {
 if (isMounted) {
 setIsVisible(false)
 }
 }
 }

 loadConfig()

 return () => {
 isMounted = false
 }
 }, [])

 if (!isVisible) return null

 const handleSend = async () => {
 const text = input.trim()
 if (!text || isSending) return

 const nextMessages: UIMessage[] = [...messages, { role: "user", content: text }]
 setMessages(nextMessages)
 setInput("")
 setIsSending(true)

 try {
 const response = await fetch("/api/chatbot/message", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 message: text,
 history: nextMessages.slice(-12),
 }),
 })

 const data = await response.json()
 if (!response.ok) throw new Error(data?.error || "Failed to get response")

 setMessages((prev) => [...prev, { role: "assistant", content: data.reply || "Sorry, I could not answer that." }])
 } catch (error: any) {
 setMessages((prev) => [
 ...prev,
 { role: "assistant", content:`Error: ${error?.message || "Unable to connect to chatbot."}` },
 ])
 } finally {
 setIsSending(false)
 }
 }

 return (
 <>
 {isOpen && (
 <div className="fixed bottom-24 right-6 z-40 w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
 <div className="flex items-center justify-between border-b border-emerald-100 bg-emerald-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
 <div className="flex items-center gap-2">
 <Bot className="h-4 w-4 text-emerald-600" />
 <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">AI Chatbot</span>
 </div>
 <button
 type="button"
 onClick={() => setIsOpen(false)}
 className="rounded-md p-1 text-emerald-700 transition hover:bg-emerald-100 dark:text-slate-300 dark:hover:bg-slate-700"
 aria-label="Close chatbot"
 >
 <X className="h-4 w-4" />
 </button>
 </div>
 <div className="flex h-[520px] flex-col">
 <div className="flex-1 space-y-3 overflow-y-auto p-3">
 {messages.map((message, index) => (
 <div
 key={`${message.role}-${index}`}
 className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
 message.role === "user"
 ? "ml-auto bg-emerald-600 text-white"
 : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
 }`}
 >
 {message.content}
 </div>
 ))}
 {isSending && (
 <div className="max-w-[85%] rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-300">
 Typing...
 </div>
 )}
 </div>
 <div className="border-t border-slate-200 p-3 dark:border-slate-700">
 <div className="flex items-center gap-2">
 <input
 value={input}
 onChange={(e) => setInput(e.target.value)}
 onKeyDown={(e) => {
 if (e.key === "Enter") {
 e.preventDefault()
 handleSend()
 }
 }}
 placeholder="Type your message..."
 className="h-10 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-900"
 />
 <button
 type="button"
 onClick={handleSend}
 disabled={isSending || !input.trim()}
 className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
 aria-label="Send message"
 >
 <Send className="h-4 w-4" />
 </button>
 </div>
 </div>
 </div>
 </div>
 )}

 <button
 type="button"
 onClick={() => setIsOpen((prev) => !prev)}
 className="fixed bottom-6 right-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-700 hover:scale-105"
 aria-label={isOpen ? "Close AI chatbot" : "Open AI chatbot"}
 title={isOpen ? "Close AI chatbot" : "Open AI chatbot"}
 >
 {isOpen ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
 </button>
 </>
 )
}

