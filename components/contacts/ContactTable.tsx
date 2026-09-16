"use client"

import { DataTable } from "@/components/ui/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"

interface Contact {
 id: string
 name: string
 phone: string
 status: string
 tags: string
 createdAt: string
 createdBy: string
 country: string
 isOpted: boolean
 isBlocked: boolean
 liveChatLink: string
}

const columns: ColumnDef<Contact>[] = [
 {
 accessorKey: "name",
 header: ({ column }) => (
 <DataTableColumnHeader column={column} title="Name" />
 ),
 },
 {
 accessorKey: "phone",
 header: ({ column }) => (
 <DataTableColumnHeader column={column} title="Phone Number" />
 ),
 },
 {
 accessorKey: "status",
 header: ({ column }) => (
 <DataTableColumnHeader column={column} title="Status" />
 ),
 },
 {
 accessorKey: "tags",
 header: ({ column }) => (
 <DataTableColumnHeader column={column} title="Tags" />
 ),
 },
 {
 accessorKey: "createdAt",
 header: ({ column }) => (
 <DataTableColumnHeader column={column} title="Created At" />
 ),
 },
 {
 accessorKey: "createdBy",
 header: ({ column }) => (
 <DataTableColumnHeader column={column} title="Created By" />
 ),
 },
 {
 accessorKey: "country",
 header: ({ column }) => (
 <DataTableColumnHeader column={column} title="Country" />
 ),
 },
 {
 accessorKey: "isOpted",
 header: ({ column }) => (
 <DataTableColumnHeader column={column} title="Is Opted" />
 ),
 },
 {
 accessorKey: "isBlocked",
 header: ({ column }) => (
 <DataTableColumnHeader column={column} title="Is Blocked" />
 ),
 },
 {
 accessorKey: "liveChatLink",
 header: ({ column }) => (
 <DataTableColumnHeader column={column} title="Live Chat Link" />
 ),
 },
]

const MOCK_DATA: Contact[] = []

export default function ContactTable() {
 return (
 <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-2xl rounded-[28px] border border-white/50 dark:border-slate-800 flex flex-col p-6 shadow-sm">
 <DataTable columns={columns} data={MOCK_DATA} searchKey="name" />
 </div>
 )
}
