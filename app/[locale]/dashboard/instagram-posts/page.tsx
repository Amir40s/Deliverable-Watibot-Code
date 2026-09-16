import { getConnectedInstagramAccountData } from "@/app/actions/instagram-page";
import InstagramPostsClient from "./instagram-posts-client";
import { getSocialConnectionStatus } from "@/app/actions/organization";
import { LockedPageOverlay } from "@/components/dashboard/LockedPageOverlay";
import { Instagram } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function InstagramPostsPage() {
  const { instagramConnected } = await getSocialConnectionStatus();

  if (!instagramConnected) {
    return (
      <LockedPageOverlay
        title="Instagram Connection Required"
        description="To access Instagram Posts, you must first connect your Instagram Business Account in the settings."
        icon={<Instagram className="w-10 h-10" />}
        ctaText="Connect Instagram"
        ctaLink="/admin/configurations/social"
      />
    );
  }

  let payload: Awaited<ReturnType<typeof getConnectedInstagramAccountData>> | null = null;
  let error: string | null = null;

  try {
    payload = await getConnectedInstagramAccountData({ fetchAll: true });
  } catch (err: unknown) {
    error = err instanceof Error ? err.message : "Failed to fetch Instagram data.";
  }

  return <InstagramPostsClient initialPayload={payload} initialError={error} />;
}
