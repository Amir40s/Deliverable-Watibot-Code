import { getConnectedFacebookPagePosts } from "@/app/actions/facebook-page";
import FacebookPostsClient from "../facebook-posts/facebook-posts-client";
import { getSocialConnectionStatus } from "@/app/actions/organization";
import { LockedPageOverlay } from "@/components/dashboard/LockedPageOverlay";
import { Facebook } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FacebookAutomationPage() {
  const { facebookConnected } = await getSocialConnectionStatus();

  if (!facebookConnected) {
    return (
      <LockedPageOverlay
        title="Facebook Connection Required"
        description="To access Facebook Automation, you must first connect your Facebook Page in the settings."
        icon={<Facebook className="w-10 h-10" />}
        ctaText="Connect Facebook"
        ctaLink="/admin/configurations/social"
      />
    );
  }

  let payload: Awaited<ReturnType<typeof getConnectedFacebookPagePosts>> | null = null;
  let error: string | null = null;

  try {
    payload = await getConnectedFacebookPagePosts({ fetchAll: true });
  } catch (err: unknown) {
    error = err instanceof Error ? err.message : "Failed to fetch Facebook posts.";
  }

  return <FacebookPostsClient initialPayload={payload} initialError={error} />;
}
