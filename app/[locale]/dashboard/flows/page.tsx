"use client";

import { useState, useEffect } from'react';
import { getFlows } from'@/app/actions/flows';
import DashboardLayoutClient from'@/components/dashboard/DashboardLayoutClient';
import { FlowsSidebar } from'@/components/flows/FlowsSidebar';
import {
 GlobalAttributesView,
 ManageCataloguesView,
 ProductsView,
 ConnectCatalogueView
} from'@/components/flows/PlaceholderViews';
import { FlowBuilderView } from'@/components/flows/FlowBuilderView';
import { Flow } from'@/types/flow';

export default function FlowsPage() {
 const [flows, setFlows] = useState<Flow[]>([]);
 const [isLoading, setIsLoading] = useState(true);

 useEffect(() => {
 const fetchFlows = async () => {
 try {
 const { flows } = await getFlows();
 setFlows(flows);
 } catch (error) {
 console.error("Failed to fetch flows", error);
 } finally {
 setIsLoading(false);
 }
 };
 fetchFlows();
 }, []);

 return (
 <DashboardLayoutClient mainClassName="bg-[#F8FAFC] dark:bg-slate-950 min-h-screen relative overflow-x-hidden font-[family-name:var(--dashboard-font)]">
 <div className="h-full overflow-y-auto">
 <FlowBuilderView flows={flows} isLoading={isLoading} />
 </div>
 </DashboardLayoutClient>
 );
}
