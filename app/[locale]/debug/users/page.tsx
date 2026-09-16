
import { prisma } from "@/lib/prisma"

export const dynamic ='force-dynamic'

export default async function DebugUsersPage() {
 const users = await prisma.user.findMany({
 select: {
 id: true,
 email: true,
 name: true,
 phoneNumber: true,
 role: true,
 createdAt: true
 },
 orderBy: {
 createdAt:'desc'
 }
 })

 return (
 <div className="p-8">
 <h1 className="text-2xl font-bold mb-4">Debug: All Users</h1>
 <table className="min-w-full border-collapse border border-gray-300">
 <thead>
 <tr className="bg-gray-100">
 <th className="border p-2">Email</th>
 <th className="border p-2">Name</th>
 <th className="border p-2">Role</th>
 <th className="border p-2">Phone</th>
 <th className="border p-2">ID</th>
 </tr>
 </thead>
 <tbody>
 {users.map(u => (
 <tr key={u.id}>
 <td className="border p-2">{u.email}</td>
 <td className="border p-2">{u.name}</td>
 <td className="border p-2">{u.role}</td>
 <td className="border p-2">{u.phoneNumber}</td>
 <td className="border p-2 font-mono text-xs">{u.id}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )
}
