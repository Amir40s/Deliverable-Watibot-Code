import { prisma } from '@/lib/prisma';

export interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: {
    id: string;
    username: string;
    name: string;
    profile_picture_url: string;
  };
}

export const facebookPageService = {
  /**
   * Fetches pages using Meta's granular permissions flow.
   * If granular_scopes are missing, falls back to /me/accounts.
   */
  async getUserPagesFromGranularToken(userAccessToken: string, clientId: string, clientSecret: string): Promise<FacebookPage[]> {
    const appToken = `${clientId}|${clientSecret}`;
    
    try {
      // 1. Call debug_token to inspect the token and get granular_scopes
      const debugRes = await fetch(`https://graph.facebook.com/debug_token?input_token=${userAccessToken}&access_token=${appToken}`);
      const debugData = await debugRes.json();

      if (!debugRes.ok || debugData?.error) {
        console.warn('[FacebookService] debug_token failed, falling back to /me/accounts:', debugData?.error);
        return this.getPagesFromMeAccounts(userAccessToken);
      }

      const granularScopes = debugData?.data?.granular_scopes || [];
      const targetIdsSet = new Set<string>();

      // First prioritize pages where pages_messaging or pages_show_list was explicitly granted
      for (const s of granularScopes) {
        if (s.scope === 'pages_messaging' || s.scope === 'pages_show_list' || s.scope === 'pages_manage_metadata') {
          if (Array.isArray(s.target_ids)) {
            for (const tid of s.target_ids) {
              targetIdsSet.add(tid);
            }
          }
        }
      }

      // If no page-specific scopes found, collect from all granular scopes
      if (targetIdsSet.size === 0) {
        for (const s of granularScopes) {
          if (Array.isArray(s.target_ids)) {
            for (const tid of s.target_ids) {
              targetIdsSet.add(tid);
            }
          }
        }
      }

      // 2. If granular_scopes are missing or empty, it might be an "Opt in to all pages" flow
      if (targetIdsSet.size === 0) {
        console.log('[FacebookService] No granular target_ids found across scopes, falling back to /me/accounts');
        return this.getPagesFromMeAccounts(userAccessToken);
      }

      const pageIds: string[] = Array.from(targetIdsSet);
      console.log(`[FacebookService] Discovered ${pageIds.length} pages from granular_scopes:`, pageIds);

      // 3. Fetch details (id, name, access_token) for each discovered page
      const pages: FacebookPage[] = [];
      for (const pageId of pageIds) {
        try {
          let pageRes = await fetch(`https://graph.facebook.com/v21.0/${pageId}?fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}&access_token=${userAccessToken}`);
          let pageData = await pageRes.json();
          
          if (!pageRes.ok || !pageData.access_token) {
            pageRes = await fetch(`https://graph.facebook.com/v21.0/${pageId}?fields=id,name,access_token&access_token=${userAccessToken}`);
            pageData = await pageRes.json();
          }

          if (pageRes.ok && pageData.access_token) {
            pages.push({
              id: pageData.id,
              name: pageData.name,
              access_token: pageData.access_token,
              instagram_business_account: pageData.instagram_business_account
            });
          } else {
            console.warn(`[FacebookService] Could not fetch PAT for page ${pageId}:`, pageData?.error);
          }
        } catch (err) {
          console.error(`[FacebookService] Error fetching details for page ${pageId}:`, err);
        }
      }

      if (pages.length === 0) {
        console.log('[FacebookService] Granular fetch returned empty, trying /me/accounts fallback');
        const fallbackPages = await this.getPagesFromMeAccounts(userAccessToken);
        if (fallbackPages.length > 0) {
          return fallbackPages;
        }
      }

      return pages;
    } catch (error) {
      console.error('[FacebookService] getUserPagesFromGranularToken error:', error);
      return this.getPagesFromMeAccounts(userAccessToken);
    }
  },

  /**
   * Standard fallback using /me/accounts
   */
  async getPagesFromMeAccounts(accessToken: string): Promise<FacebookPage[]> {
    try {
      console.log('[FacebookService] Fetching pages from /me/accounts');
      const res = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}&access_token=${accessToken}`);
      const data = await res.json();
      
      if (!res.ok || data?.error) {
        console.error('[FacebookService] /me/accounts failed:', data?.error);
        return [];
      }

      return (data.data || []).map((page: any) => ({
        id: page.id,
        name: page.name,
        access_token: page.access_token,
        instagram_business_account: page.instagram_business_account,
      }));
    } catch (error) {
      console.error('[FacebookService] getPagesFromMeAccounts error:', error);
      return [];
    }
  },

  /**
   * Subscribes the app to the page webhooks
   */
  async subscribePageToApp(pageId: string, pageAccessToken: string) {
    console.log(`[FacebookService] Subscribing page ${pageId} to app...`);
    const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,messaging_optins,messaging_referrals,feed&access_token=${pageAccessToken}`, {
      method: 'POST'
    });
    const data = await res.json();
    if (!res.ok || data?.error) {
      console.error(`[FacebookService] Failed to subscribe page ${pageId}:`, data?.error);
      return false;
    }
    console.log(`[FacebookService] Page ${pageId} subscribed successfully.`);
    return true;
  }
};
