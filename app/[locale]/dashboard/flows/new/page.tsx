import DashboardLayoutClient from'@/components/dashboard/DashboardLayoutClient';
import { CreateFlowModal } from'@/components/flows/create-flow-modal';

export default function NewFlowPage() {
 return (
 <DashboardLayoutClient>
 <CreateFlowModal />
 </DashboardLayoutClient>
 );
}
