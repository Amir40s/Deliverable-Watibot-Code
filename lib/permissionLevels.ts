// lib/permissionLevels.ts
/**
 * Simplified 5-tier permission level definitions for modules/pages.
 * Each module stores one of the following string values:
 *   - "full"   -> View, Edit, Delete
 *   - "view"   -> View only
 *   - "edit"   -> View, Edit
 *   - "delete" -> View, Delete
 *   - "none"   -> No access
 */

import type { Session } from "next-auth";

/** Check if a session satisfies the required level for a module */
export function hasModulePermission(
  session: Session | null,
  module: string,
  required: "view" | "edit" | "delete" | "full"
): boolean {
  if (!session?.user) return false;

  // Ensure super admins have full access implicitly if needed
  let isAdmin = session.user.role === "SUPER_ADMIN" || session.user.role === "ADMIN";

  const planModules = (session.user.planModulesAccess as Record<string, boolean>) || {};
  if (planModules[module] === false) {
    return false; // Plan disabled this module completely
  }

  if (isAdmin) {
    return true; // Admin has full access to all plan-enabled modules
  }

  // permissions is expected to be Record<string, string | boolean> mapping moduleKey -> accessLevel
  const perms = (session.user.permissions ?? {}) as unknown as Record<string, any>;
  let userAccess = perms[module];

  const DEFAULT_AGENT_ACCESS: Record<string, string> = {
    dashboard: "view",
    chat: "full",
    contacts: "view",
    audience: "view",
    facebook_posts: "view",
    instagram_posts: "view",
    reports: "none",
    agents: "none",
    permissions: "none",
    tags: "none",
    notifications: "full",
    quick_replies: "view",
    templates: "view",
    media_library: "view",
    drip_campaign: "none",
    scheduler: "view",
    ad_campaign: "none",
    ad_manager: "none",
    flow: "none",
    leads_report: "none",
    quick_message: "view",
    knowledge_base: "none",
    settings: "none",
    integrations: "none",
    quota: "none",
    developer: "none",
    projects: "none",
  };

  const DEFAULT_VIEWER_ACCESS: Record<string, string> = {
    dashboard: "view",
    chat: "view",
    contacts: "view",
    audience: "view",
    facebook_posts: "view",
    instagram_posts: "view",
    reports: "view",
    agents: "none",
    permissions: "none",
    tags: "none",
    notifications: "view",
    quick_replies: "none",
    templates: "none",
    media_library: "none",
    drip_campaign: "none",
    scheduler: "none",
    ad_campaign: "none",
    ad_manager: "none",
    flow: "none",
    leads_report: "view",
    quick_message: "none",
    knowledge_base: "none",
    settings: "none",
    integrations: "none",
    quota: "view",
    developer: "none",
    projects: "none",
  };

  if (userAccess === undefined || userAccess === null) {
    const role = (session.user.role || "").toUpperCase();
    if (role === "GUEST" || role === "VIEWER") {
      userAccess = DEFAULT_VIEWER_ACCESS[module] || "none";
    } else {
      userAccess = DEFAULT_AGENT_ACCESS[module] || "none";
    }
  }

  // Handle nested object permissions if any
  if (typeof userAccess === "object" && userAccess !== null) {
    const values = Object.values(userAccess);
    if (values.length === 0 || values.every((v) => v === "none" || v === false || v === "false")) {
      return false;
    }
    if (values.some((v) => v === "full" || v === "custom" || v === true || v === "true")) {
      userAccess = "full";
    } else if (values.some((v) => v === "edit")) {
      userAccess = "edit";
    } else if (values.some((v) => v === "delete")) {
      userAccess = "delete";
    } else if (values.some((v) => v === "view")) {
      userAccess = "view";
    } else {
      return false;
    }
  }

  // Explicit No Access check
  if (userAccess === "none" || userAccess === "no_access" || userAccess === false || userAccess === "false") {
    return false;
  }

  // Full Access
  if (userAccess === "full" || userAccess === "custom" || userAccess === true || userAccess === "true") {
    return true;
  }

  // "view" requirement is satisfied by view, edit, or delete
  if (required === "view") {
    return userAccess === "view" || userAccess === "edit" || userAccess === "delete";
  }

  // "edit" requirement is satisfied by edit
  if (required === "edit") {
    return userAccess === "edit";
  }

  // "delete" requirement is satisfied by delete
  if (required === "delete") {
    return userAccess === "delete";
  }

  return false;
}

/** Convenience wrappers */
export const canView = (session: Session | null, module: string) =>
  hasModulePermission(session, module, "view");
export const canEdit = (session: Session | null, module: string) =>
  hasModulePermission(session, module, "edit");
export const canDelete = (session: Session | null, module: string) =>
  hasModulePermission(session, module, "delete");
export const canFull = (session: Session | null, module: string) =>
  hasModulePermission(session, module, "full");
