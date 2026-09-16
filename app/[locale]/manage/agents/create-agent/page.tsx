"use client"
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient"
import { useRouter } from "next/navigation"
import { useState } from "react"

export default function CreateAgentPage() {
 const router = useRouter()
 const [username, setUsername] = useState("")
 const [email, setEmail] = useState("")

 return (
 <DashboardLayoutClient mainClassName=" antialiased bg-gray-50 min-h-screen">
 {/* Top right button */}
 <div className="flex justify-end mb-10">
 <button
 onClick={() => router.push("/agents")}
 className="bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
 >
 Go to agent management
 </button>
 </div>

 {/* Form Card */}
 <div className="flex items-start justify-center">
 <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 w-full max-w-md">
 <h2 className="text-xl font-bold text-gray-900 text-center mb-6">Create Agent</h2>

 <div className="space-y-5">
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1.5">Username</label>
 <input
 type="text"
 value={username}
 onChange={(e) => setUsername(e.target.value)}
 placeholder="John Doe"
 className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
 <input
 type="email"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 placeholder="example@example.com"
 className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
 />
 </div>

 <div className="pt-2 flex justify-center">
 <button className="bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold px-10 py-2.5 rounded-lg transition-colors">
 Next
 </button>
 </div>
 </div>
 </div>
 </div>
 </DashboardLayoutClient>
 )
}
