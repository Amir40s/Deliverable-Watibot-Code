"use client"

import {
 ArrowDown,
 ArrowUp,
 ChevronsUpDown,
 EyeOff,
 Menu,
} from "lucide-react"
import { Column } from "@tanstack/react-table"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuSeparator,
 DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface DataTableColumnHeaderProps<TData, TValue>
 extends React.HTMLAttributes<HTMLDivElement> {
 column: Column<TData, TValue>
 title: string
}

export function DataTableColumnHeader<TData, TValue>({
 column,
 title,
 className,
}: DataTableColumnHeaderProps<TData, TValue>) {
 if (!column.getCanSort()) {
 return <div className={cn(className)}>{title}</div>
 }

 return (
 <div className={cn("flex items-center space-x-2", className)}>
 <span className="text-sm font-semibold text-foreground">{title}</span>
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button
 variant="ghost"
 size="sm"
 className="-ml-3 h-8 data-[state=open]:bg-accent"
 >
 {/* {column.getIsSorted() === "desc" ? (
 <ArrowDown className="h-4 w-4" />
 ) : column.getIsSorted() === "asc" ? (
 <ArrowUp className="h-4 w-4" />
 ) : (
 <ChevronsUpDown className="h-4 w-4" />
 )} */}
 {/* The user's image shows a separate menu icon, but typically sorting and menu are combined or separate. 
 The request says "sorting icons add". 
 In standard shadcn/ui typical usage, clicking the header opens the sort menu.
 But the image specifically shows TWO icons side-by-side: Sort Icon AND Menu Icon.
 Let's try to replicate that visual strictness if possible, or stick to the shadcn standard which is cleaner.
 "Make table like that" -> Image shows: TEXT [SortIcon] [MenuIcon]
 
 If I implement exactly like the image:
 - Click Text -> Sort? or Nothing?
 - Click SortIcon -> Toggle Sort
 - Click MenuIcon -> Open Menu
 
 Let's try to make it look close to the image but functional.
 The standard Shadcn DataTableHeader combines them into one button that opens a menu with "Asc", "Desc", "Hide".
 However, the user might specifically want the VISUAL of the icons.
 
 Let's stick to a single button trigger for now that shows the Sort Icon.
 And maybe ANY column menu should be separate?
 
 Refined Idea:
 Just render the Sort Icon as requested.
 And render a Menu icon that opens the menu?
 
 Actually, looking at the image again:
 The Sort Icon is separate from the Menu Icon.
 
 Let's try to implement separate buttons if possible, or just one button that Has both icons?
 One button with Text + SortIcon + MenuIcon seems weird.
 
 Let's do:
 [Title]
 [SortButton (Icon only)]
 [MenuButton (Icon only)] -> Opens dropdown
 */}
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="start">
 <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
 <ArrowUp className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
 Asc
 </DropdownMenuItem>
 <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
 <ArrowDown className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
 Desc
 </DropdownMenuItem>
 <DropdownMenuSeparator />
 <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
 <EyeOff className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
 Hide
 </DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>
 </div>
 )
}
