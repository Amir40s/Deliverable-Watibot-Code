"use client";

import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface PaginationProps {
 currentPage: number;
 totalPages: number;
 onPageChange: (page: number) => void;
 totalRecords: number;
 pageSize: number;
}

export function Pagination({
 currentPage,
 totalPages,
 onPageChange,
 totalRecords,
 pageSize,
}: PaginationProps) {
 if (totalPages <= 1) return null;

 const startRecord = (currentPage - 1) * pageSize + 1;
 const endRecord = Math.min(currentPage * pageSize, totalRecords);

 // Generate page numbers to show
 const getPageNumbers = () => {
 const pages = [];
 const showMax = 5;

 if (totalPages <= showMax) {
 for (let i = 1; i <= totalPages; i++) pages.push(i);
 } else {
 if (currentPage <= 3) {
 for (let i = 1; i <= 4; i++) pages.push(i);
 pages.push('...');
 pages.push(totalPages);
 } else if (currentPage >= totalPages - 2) {
 pages.push(1);
 pages.push('...');
 for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
 } else {
 pages.push(1);
 pages.push('...');
 pages.push(currentPage - 1);
 pages.push(currentPage);
 pages.push(currentPage + 1);
 pages.push('...');
 pages.push(totalPages);
 }
 }
 return pages;
 };

 return (
 <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800">
 <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
 Showing <span className="text-slate-900 dark:text-slate-200">{startRecord}</span> to <span className="text-slate-900 dark:text-slate-200">{endRecord}</span> of <span className="text-slate-900 dark:text-slate-200">{totalRecords}</span> records
 </div>
 
 <div className="flex items-center gap-1">
 <Button
 variant="ghost"
 size="icon"
 onClick={() => onPageChange(currentPage - 1)}
 disabled={currentPage === 1}
 className="h-8 w-8 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 disabled:opacity-30"
 >
 <ChevronLeft className="w-4 h-4" />
 </Button>

 <div className="flex items-center gap-1 mx-2">
 {getPageNumbers().map((page, idx) => (
 page ==='...' ? (
 <div key={`dots-${idx}`} className="w-8 h-8 flex items-center justify-center text-slate-400">
 <MoreHorizontal className="w-4 h-4" />
 </div>
 ) : (
 <Button
 key={`page-${page}`}
 variant={currentPage === page ? "default" : "ghost"}
 size="sm"
 onClick={() => onPageChange(page as number)}
 className={cn(
 "h-8 w-8 rounded-lg text-xs font-bold transition-all",
 currentPage === page 
 ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
 : "text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/10"
 )}
 >
 {page}
 </Button>
 )
 ))}
 </div>

 <Button
 variant="ghost"
 size="icon"
 onClick={() => onPageChange(currentPage + 1)}
 disabled={currentPage === totalPages}
 className="h-8 w-8 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 disabled:opacity-30"
 >
 <ChevronRight className="w-4 h-4" />
 </Button>
 </div>
 </div>
 );
}
