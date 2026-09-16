"use client";

import React from'react';
import { BookOpen, RefreshCw, ArrowRight, ShoppingBag, Store } from'lucide-react';
import { Button } from'@/components/ui/button';
import { Switch } from'@/components/ui/switch';
import { Input } from'@/components/ui/input';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import { cn } from'@/lib/utils';
import Image from'next/image';

const QuickGuide = () => (
 <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-gray-100 dark:border-slate-800 mb-6">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Quick Guide</h3>
 <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
 You can connect with facebook to fetch catalogue and manage it from our platform.
 </p>
 <div className="flex flex-col sm:flex-row gap-6">
 <a href="#" className="flex items-center text-sm font-medium text-[#00B074] hover:underline">
 <BookOpen className="w-4 h-4 mr-2" />
 How to create a catalogue in Commerce Manager ?
 </a>
 <a href="#" className="flex items-center text-sm font-medium text-[#00B074] hover:underline">
 <BookOpen className="w-4 h-4 mr-2" />
 How to manage your Meta catalogue with Shopify ?
 </a>
 </div>
 </div>
);

const EmptyStateTable = ({ message }: { message: string }) => (
 <div className="flex flex-col items-center justify-center py-20">
 <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 font-medium cursor-pointer hover:text-[#00B074] transition-colors">
 {message} <ArrowRight className="w-4 h-4" />
 </div>
 </div>
);

export const GlobalAttributesView = () => (
 <div className="p-8 max-w-[1200px] mx-auto">
 <h2 className="text-2xl font-semibold mb-6">Global Attributes</h2>
 <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-gray-100 dark:border-slate-800 text-center">
 <p className="text-gray-500">Global attributes configuration coming soon.</p>
 </div>
 </div>
);

export const ManageCataloguesView = () => (
 <div className="p-8 max-w-[1200px] mx-auto space-y-6">
 <h2 className="text-2xl font-semibold mb-6">Manage Catalogues</h2>
 
 <QuickGuide />

 <div className="flex items-center justify-between gap-4">
 <div className="relative flex-1 max-w-sm">
 <Input 
 placeholder="Search by catalogue name" 
 className="bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 h-10"
 />
 </div>
 <Button className="bg-[#0f3d3e] hover:bg-[#0b2d2e] text-white gap-2">
 <RefreshCw className="w-4 h-4" />
 Sync
 </Button>
 </div>

 <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden min-h-[400px]">
 <table className="w-full">
 <thead>
 <tr className="border-b border-gray-100 dark:border-slate-800">
 <th className="text-left py-4 px-6 text-sm font-medium text-gray-500">Name</th>
 <th className="text-left py-4 px-6 text-sm font-medium text-gray-500">Catalogue Id</th>
 <th className="text-left py-4 px-6 text-sm font-medium text-gray-500">Type</th>
 <th className="text-left py-4 px-6 text-sm font-medium text-gray-500">Product Count</th>
 <th className="text-left py-4 px-6 text-sm font-medium text-gray-500">Status</th>
 </tr>
 </thead>
 <tbody>
 <tr>
 <td colSpan={5}>
 <EmptyStateTable message="Connect and Setup Meta Catologue Account to continue!" />
 </td>
 </tr>
 </tbody>
 </table>
 </div>
 
 <div className="flex items-center justify-end gap-2 text-xs text-gray-500">
 <span>0-0 of 0</span>
 <button disabled className="p-1 hover:bg-gray-100 rounded disabled:opacity-50">{'<'}</button>
 <button disabled className="p-1 hover:bg-gray-100 rounded disabled:opacity-50">{'>'}</button>
 </div>
 </div>
);

export const ProductsView = () => (
 <div className="p-8 max-w-[1200px] mx-auto space-y-6">
 <h2 className="text-2xl font-semibold mb-6">Products</h2>
 
 <QuickGuide />

 <div className="flex items-center justify-between gap-4">
 <div className="relative flex-1 max-w-sm">
 <Input 
 placeholder="Search by product name" 
 className="bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 h-10"
 />
 </div>
 <Button className="bg-[#0f3d3e] hover:bg-[#0b2d2e] text-white gap-2">
 <RefreshCw className="w-4 h-4" />
 Sync
 </Button>
 </div>

 <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden min-h-[400px]">
 <table className="w-full">
 <thead>
 <tr className="border-b border-gray-100 dark:border-slate-800">
 <th className="text-left py-4 px-6 text-sm font-medium text-gray-500">Product</th>
 <th className="text-left py-4 px-6 text-sm font-medium text-gray-500">Status</th>
 <th className="text-left py-4 px-6 text-sm font-medium text-gray-500">Price</th>
 <th className="text-left py-4 px-6 text-sm font-medium text-gray-500">Created At</th>
 <th className="text-left py-4 px-6 text-sm font-medium text-gray-500">Action</th>
 </tr>
 </thead>
 <tbody>
 <tr>
 <td colSpan={5}>
 <EmptyStateTable message="Connect and Setup Meta Catologue Account to continue!" />
 </td>
 </tr>
 </tbody>
 </table>
 </div>

 <div className="flex items-center justify-end gap-2 text-xs text-gray-500">
 <span>0-0 of 0</span>
 <button disabled className="p-1 hover:bg-gray-100 rounded disabled:opacity-50">{'<'}</button>
 <button disabled className="p-1 hover:bg-gray-100 rounded disabled:opacity-50">{'>'}</button>
 </div>
 </div>
);

export const ConnectCatalogueView = () => (
 <div className="p-8 max-w-[1200px] mx-auto space-y-6">
 <h2 className="text-2xl font-semibold mb-6">Connect Catalogue</h2>
 
 <QuickGuide />

 <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-gray-100 dark:border-slate-800 space-y-10">
 {/* Section 1 */}
 <div className="flex flex-col md:flex-row md:items-start justify-between gap-8 border-b border-gray-100 dark:border-slate-800 pb-10">
 <div className="space-y-1 max-w-md">
 <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">Connect your facebook account</h3>
 <p className="text-xs text-gray-500 dark:text-gray-400">
 Allow AiSensy to fetch catalogues and products from Facebook.
 </p>
 </div>
 <div className="flex flex-col items-start gap-3">
 <span className="text-[#00B074] font-bold text-sm tracking-wide">PENDING</span>
 <Button variant="outline" className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 h-9 px-6">
 Connect
 </Button>
 </div>
 </div>

 {/* Section 2 */}
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 border-b border-gray-100 dark:border-slate-800 pb-10">
 <div className="space-y-1 max-w-md">
 <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">Choose your facebook catalogue</h3>
 </div>
 <div className="w-full max-w-xs">
 <Select>
 <SelectTrigger className="w-full text-gray-500">
 <SelectValue placeholder="Choose your catalogue" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="cat1">Catalogue 1</SelectItem>
 <SelectItem value="cat2">Catalogue 2</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>

 {/* Section 3 */}
 <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
 <div className="space-y-1 max-w-md">
 <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">Display catalogue on Business profile</h3>
 <p className="text-xs text-gray-500 dark:text-gray-400">
 Enable to showcase the product catalogue on the business profile to end users.
 </p>
 </div>
 
 <div className="flex items-center gap-12">
 <Switch />
 
 {/* Phone Mockup Placeholder */}
 <div className="relative w-[280px] h-[140px] bg-[#00B074] rounded-t-2xl p-4 overflow-hidden border-4 border-b-0 border-gray-800 shadow-xl">
 <div className="flex items-center justify-between text-white mb-4">
 <span className="text-[10px]">12:25</span>
 <div className="flex gap-1">
 <span className="w-2 h-2 bg-white rounded-full opacity-60"></span>
 <span className="w-2 h-2 bg-white rounded-full opacity-60"></span>
 </div>
 </div>
 <div className="flex items-center gap-3 text-white">
 <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
 <Store className="w-4 h-4" />
 </div>
 <span className="font-medium text-sm">Your Brand Name</span>
 <div className="w-3 h-3 bg-green-400 rounded-full flex items-center justify-center text-[8px] text-black">✓</div>
 <div className="ml-auto">
 <Store className="w-4 h-4" />
 </div>
 </div>
 <div className="absolute -bottom-8 left-0 right-0 h-16 bg-white transform -rotate-1"></div>
 </div>
 </div>
 </div>
 </div>
 </div>
);
