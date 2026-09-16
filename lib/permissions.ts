import { Session } from "next-auth";

export const hasPermission = (
  session: Session | null | undefined,
  itemPerms: string[]
): boolean => {
  const isAdminOrOwner =
    session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN" || session?.user?.role === "OWNER";
  
  if (isAdminOrOwner) return true;
  if (!itemPerms || itemPerms.length === 0) return true;

  const userPerms = (session?.user?.permissions || {}) as Record<string, any>;

  // Legacy support (flat boolean checks)
  if (itemPerms.some((p) => userPerms[p] === true)) return true;

  // Determine normalized role for default fallbacks
  let normalizedRole = (session?.user?.role || "").toLowerCase();
  if (normalizedRole === "user") normalizedRole = "agent";

  // Default module access for users who haven't had their new permissions explicitly saved yet
  // We specify exactly what they have "view" or "full" access to.
  const defaultModuleAccess: Record<string, string[]> = {
    agent: [
      "dashboard",
      "live_chat",
      "contacts",
      "contacts:Add / Edit Contacts",
      "audience",
      "facebook_posts",
      "instagram_posts",
      "quick_replies",
      "templates",
      "campaigns",
      "quick_message",
      "knowledge_base",
      "manage_reports",
      "manage_reports:Notification Preferences",
    ],
    viewer: [
      "dashboard",
      "live_chat",
      "contacts",
      "audience",
      "facebook_posts",
      "instagram_posts",
      "quick_replies",
      "templates",
      "campaigns",
      "quick_message",
      "knowledge_base",
      "manage_reports",
      "manage_reports:View Reports",
      "manage_reports:Notification Preferences",
      "system_settings",
      "system_settings:View Quota",
    ],
  };

  // Support for the new JSON nested permissions object
  for (const perm of itemPerms) {
    if (perm.includes(":")) {
      // Example: "manage_reports:Manage Agents"
      const [mod, row] = perm.split(":");
      if (userPerms[mod] && typeof userPerms[mod] === "object") {
        // If explicitly defined in user's perms
        if (userPerms[mod][row] === "full" || userPerms[mod][row] === "view") {
          return true;
        }
      } else if (defaultModuleAccess[normalizedRole]?.includes(perm)) {
        // Fallback to default role permissions
        return true;
      }
    } else {
      // Example: "dashboard" (check if any row in this module has access)
      const modulePerms = userPerms[perm];
      if (modulePerms && typeof modulePerms === "object") {
        // If explicitly defined in user's perms
        if (
          Object.values(modulePerms).some(
            (val) => val === "full" || val === "view"
          )
        ) {
          return true;
        }
      } else if (defaultModuleAccess[normalizedRole]?.includes(perm)) {
        // Fallback to default role permissions
        return true;
      }
    }
  }

  return false;
};
