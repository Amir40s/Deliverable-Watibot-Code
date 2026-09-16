"use client"

import * as React from "react"
import {
 ColumnDef,
 ColumnFiltersState,
 SortingState,
 VisibilityState,
 flexRender,
 getCoreRowModel,
 getFilteredRowModel,
 getPaginationRowModel,
 getSortedRowModel,
 useReactTable,
} from "@tanstack/react-table"
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
 DropdownMenu,
 DropdownMenuCheckboxItem,
 DropdownMenuContent,
 DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select"
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from "@/components/ui/table"

interface DataTableProps<TData, TValue> {
 columns: ColumnDef<TData, TValue>[]
 data: TData[]
 searchKey?: string
 dense?: boolean
}

export function DataTable<TData, TValue>({
 columns,
 data,
 searchKey,
 dense = false,
}: DataTableProps<TData, TValue>) {
 const [sorting, setSorting] = React.useState<SortingState>([])
 const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
 const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
 const [rowSelection, setRowSelection] = React.useState({})
 const [globalFilter, setGlobalFilter] = React.useState("")

 const table = useReactTable({
 data,
 columns,
 onSortingChange: setSorting,
 onColumnFiltersChange: setColumnFilters,
 getCoreRowModel: getCoreRowModel(),
 getPaginationRowModel: getPaginationRowModel(),
 getSortedRowModel: getSortedRowModel(),
 getFilteredRowModel: getFilteredRowModel(),
 onColumnVisibilityChange: setColumnVisibility,
 onRowSelectionChange: setRowSelection,
 onGlobalFilterChange: setGlobalFilter,
 state: {
 sorting,
 columnFilters,
 columnVisibility,
 rowSelection,
 globalFilter,
 },
 })

 return (
 <div className="space-y-4">
 <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4">
 <div className="flex items-center gap-2">
 <p className="text-sm text-muted-foreground whitespace-nowrap">Show</p>
 <Select
 value={`${table.getState().pagination.pageSize}`}
 onValueChange={(value) => {
 table.setPageSize(Number(value))
 }}
 >
 <SelectTrigger className="h-8 w-[70px] border-0 bg-muted/50 shadow-none focus:ring-0">
 <SelectValue placeholder={table.getState().pagination.pageSize} />
 </SelectTrigger>
 <SelectContent side="top">
 {[10, 25, 50, 100].map((pageSize) => (
 <SelectItem key={pageSize} value={`${pageSize}`}>
 {pageSize}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 <p className="text-sm text-muted-foreground whitespace-nowrap">entries</p>
 </div>
 <div className="flex items-center gap-4 w-full md:w-auto">
 <div className="relative flex-1 md:w-64">
 <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
 <Input
 placeholder="Search..."
 value={globalFilter ?? ""}
 onChange={(event) => setGlobalFilter(event.target.value)}
 className="pl-9 h-9 border-0 bg-muted/50 shadow-none focus-visible:ring-0"
 />
 </div>
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="ghost" size="sm" className="h-9 ml-auto flex border-0 bg-muted/50 shadow-none">
 Filter Columns <ChevronDown className="ml-2 h-4 w-4" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="w-48 border-0 shadow-xl">
 {table
 .getAllColumns()
 .filter((column) => column.getCanHide())
 .map((column) => {
 return (
 <DropdownMenuCheckboxItem
 key={column.id}
 className="capitalize"
 checked={column.getIsVisible()}
 onCheckedChange={(value) =>
 column.toggleVisibility(!!value)
 }
 >
 {column.id}
 </DropdownMenuCheckboxItem>
 )
 })}
 </DropdownMenuContent>
 </DropdownMenu>
 </div>
 </div>
 <div className="overflow-x-auto">
 <Table>
 <TableHeader className="bg-transparent border-0">
 {table.getHeaderGroups().map((headerGroup) => (
 <TableRow key={headerGroup.id}>
 {headerGroup.headers.map((header) => {
 return (
 <TableHead key={header.id} className="font-semibold text-foreground">
 {header.isPlaceholder
 ? null
 : flexRender(
 header.column.columnDef.header,
 header.getContext()
 )}
 </TableHead>
 )
 })}
 </TableRow>
 ))}
 </TableHeader>
 <TableBody>
 {table.getRowModel().rows?.length ? (
 table.getRowModel().rows.map((row) => (
 <TableRow
 key={row.id}
 data-state={row.getIsSelected() && "selected"}
 >
 {row.getVisibleCells().map((cell) => (
 <TableCell key={cell.id} className={dense ? "py-2" : ""}>
 {flexRender(
 cell.column.columnDef.cell,
 cell.getContext()
 )}
 </TableCell>
 ))}
 </TableRow>
 ))
 ) : (
 <TableRow>
 <TableCell
 colSpan={columns.length}
 className="h-24 text-center"
 >
 No results.
 </TableCell>
 </TableRow>
 )}
 </TableBody>
 </Table>
 </div>
 <div className="flex items-center justify-between px-4 py-4">
 <div className="flex-1 text-sm text-muted-foreground font-medium">
 Showing {table.getFilteredRowModel().rows.length === 0 ? 0 : table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)} of {table.getFilteredRowModel().rows.length} entries
 </div>
 <div className="flex items-center space-x-2">
 <Button
 variant="ghost"
 size="sm"
 className="hidden lg:flex h-8 w-8 p-0 bg-muted/50 border-0 shadow-none"
 onClick={() => table.setPageIndex(0)}
 disabled={!table.getCanPreviousPage()}
 >
 <span className="sr-only">Go to first page</span>
 <ChevronsLeft className="h-4 w-4" />
 </Button>
 <Button
 variant="ghost"
 size="sm"
 className="bg-muted/50 border-0 shadow-none px-4"
 onClick={() => table.previousPage()}
 disabled={!table.getCanPreviousPage()}
 >
 Previous
 </Button>
 <div className="flex items-center justify-center text-sm font-bold h-8 w-8 rounded-full bg-emerald-600 text-white shadow-none">
 {table.getState().pagination.pageIndex + 1}
 </div>
 <Button
 variant="ghost"
 size="sm"
 className="bg-muted/50 border-0 shadow-none px-4"
 onClick={() => table.nextPage()}
 disabled={!table.getCanNextPage()}
 >
 Next
 </Button>
 <Button
 variant="ghost"
 size="sm"
 className="hidden lg:flex h-8 w-8 p-0 bg-muted/50 border-0 shadow-none"
 onClick={() => table.setPageIndex(table.getPageCount() - 1)}
 disabled={!table.getCanNextPage()}
 >
 <span className="sr-only">Go to last page</span>
 <ChevronsRight className="h-4 w-4" />
 </Button>
 </div>
 </div>
 </div>
 )
}
