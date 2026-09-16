export const INTERNAL_CUSTOM_ATTRIBUTE_KEYS = new Set([
  'leaddata',
  'whatsappjid',
  'whatsapplid',
  'lastmediaurl',
  'lastmediatype',
  'lastmediafilename',
  'adid',
  'adbody',
  'referral',
  'adsourceurl',
  'source',
  'contactsource',
  'adsource',
  'campaignname',
  'adtitle',
  'ad_source_id',
  'ad_source_type',
  'ctwa_click_id',
  'ad_headline',
  'ad_body',
  'ad_attributed_at',
  'ad_media_type',
  'starred',
  'isstarred',
  'wa_id',
  'profile',
  'user_id',
  'lastupdate',
  'messengerid',
  'resolvedname',
  'resolvedprofilepic',
  'verifiedname',
]);

/**
 * Returns true if the given custom attribute key is an internal system field
 * that should not be displayed in custom attributes lists or tables.
 */
export function isInternalCustomAttribute(key: string): boolean {
  if (!key) return true;
  return INTERNAL_CUSTOM_ATTRIBUTE_KEYS.has(key.toLowerCase().trim());
}
