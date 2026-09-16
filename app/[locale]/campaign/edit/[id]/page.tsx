import { ScheduleCampaignForm } from "@/components/campaign/ScheduleCampaignForm";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient";

export default async function EditCampaignPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const orgIdToUse = session.user.organizationId || session.user.id;

  const campaignId = params.id;
  
  const message = await prisma.scheduledMessage.findUnique({
    where: { id: campaignId },
  });

  if (!message) {
    redirect("/campaign");
  }
  if (message.organizationId !== orgIdToUse) {
    redirect("/campaign");
  }

  const initialData = {
    id: message.id,
    content: message.content,
    scheduledAt: message.scheduledAt,
    contactId: message.contactId,
    groupId: message.groupId,
    mediaUrl: message.mediaUrl,
    templateName: message.templateName,
    templateLanguage: message.templateLanguage,
    templateParams: message.templateParams,
    buttons: message.buttons as any,
    platform: message.platform,
  };

  return (
    <DashboardLayoutClient mainClassName="bg-[#F8FAFC] dark:bg-[#0B0F1A] min-h-screen relative overflow-x-hidden transition-colors duration-300 pb-20 plus-jakarta-forced">
      <div className="max-w-[1400px] mx-auto space-y-8 px-4 md:px-8 pt-6">
        <div className="absolute top-0 right-0 w-[550px] h-[550px] bg-emerald-500/5 rounded-full blur-[130px] pointer-events-none -z-10" />
        <ScheduleCampaignForm initialData={initialData} />
      </div>
    </DashboardLayoutClient>
  );
}
