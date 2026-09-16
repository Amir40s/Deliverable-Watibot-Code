import { getFlow } from'@/app/actions/flows';
import { FlowEditor } from'@/components/flows/flow-editor';
import DashboardLayoutClient from'@/components/dashboard/DashboardLayoutClient';
import { notFound } from'next/navigation';

export default async function FlowEditorPage({ params }: { params: Promise<{ id: string }> }) {
 try {
 const { id } = await params;
 const { flow } = await getFlow(id);
 return (
 <DashboardLayoutClient mainClassName="p-0" mainFullBleed={true}>
 <FlowEditor flow={flow} />
 </DashboardLayoutClient>
 );
 } catch (error) {
 notFound();
 }
}
