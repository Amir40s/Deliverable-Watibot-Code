"use client";

import { 
 Workflow, 
 Settings, 
 BookOpen, 
 ShoppingCart, 
 Facebook
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FlowsSidebarProps {
 currentView: string;
 setCurrentView: (view: string) => void;
}

export function FlowsSidebar({ currentView, setCurrentView }: FlowsSidebarProps) {
 const menuItems = [
 { id:'flow-builder', label:'Flow Builder', icon: Workflow },
 { id:'global-attributes', label:'Global Attributes', icon: Settings },
 { id:'manage-catalogues', label:'Manage Catalogues', icon: BookOpen },
 { id:'products', label:'Products', icon: ShoppingCart },
 { id:'connect-catalogue', label:'Connect Catalogue', icon: Facebook },
 ];

 return (
 <div className="w-[280px] bg-white dark:bg-slate-900 border-r border-gray-100 dark:border-slate-800 h-full flex flex-col shrink-0">
 <div className="p-6">
 <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Flows</h2>
 </div>
 <nav className="flex-1 px-4 space-y-1">
 {menuItems.map((item) => (
 <button
 key={item.id}
 onClick={() => setCurrentView(item.id)}
 className={cn(
 "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors",
 currentView === item.id
 ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
 : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800"
 )}
 >
 <item.icon className={cn("w-5 h-5", currentView === item.id ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500 dark:text-gray-500")} />
 {item.label}
 </button>
 ))}
 </nav>
 </div>
 );
}
