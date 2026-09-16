export type KnownPlanFamily = string;

let cachedPlans: any[] = [];
let PLAN_ALIASES: Record<string, string[]> = {};

// Helper to build aliases dynamically from a list of plans
function populatePlans(plans: any[]) {
  if (!plans || plans.length === 0) return;
  cachedPlans = plans;
  const newAliases: Record<string, string[]> = {};

  for (const plan of plans) {
    const canonical = plan.slug.toLowerCase().trim();
    const name = plan.name.toLowerCase().trim();

    const aliasesSet = new Set<string>([canonical, name]);

    // Generate prefix abbreviations dynamically
    if (canonical.length > 3) {
      aliasesSet.add(canonical.substring(0, 3));
      aliasesSet.add(canonical.substring(0, 4));
    }
    if (name.length > 3) {
      aliasesSet.add(name.substring(0, 3));
      aliasesSet.add(name.substring(0, 4));
      
      // Also split multiple words (e.g. "Business Plan" -> "business", "plan")
      const words = name.split(/\s+/);
      for (const word of words) {
        if (word.length > 2) {
          aliasesSet.add(word);
          if (word.length > 3) {
            aliasesSet.add(word.substring(0, 3));
          }
        }
      }
    }

    newAliases[canonical] = Array.from(aliasesSet);
  }
  PLAN_ALIASES = newAliases;
}

// 1. Server-side initialization
if (typeof window === "undefined") {
  import("./prisma")
    .then(({ prisma }) => {
      prisma.plan
        .findMany()
        .then((plans) => {
          if (plans && plans.length > 0) {
            populatePlans(plans);
          }
        })
        .catch((err) => {
          console.error("[plan-slugs] Failed to query dynamic plans from database:", err);
        });
    })
    .catch(() => {
      // Safe fallback during build/bundling
    });
}

// 2. Client-side initialization (as background task)
if (typeof window !== "undefined") {
  fetch("/api/admin/configurations/plans")
    .then((res) => {
      if (res.ok) return res.json();
      throw new Error("API call failed");
    })
    .then((plans) => {
      if (plans && Array.isArray(plans)) {
        populatePlans(plans);
      }
    })
    .catch((err) => {
      console.warn("[plan-slugs] Client-side fetch of plans failed or pending:", err.message);
    });
}

export function normalizePlanSlug(slug?: string | null) {
  return slug?.trim().toLowerCase() || "free";
}

export function getPlanFamily(slug?: string | null, plans?: any[]) {
  if (plans && plans.length > 0) {
    populatePlans(plans);
  }
  const normalized = normalizePlanSlug(slug);

  // 1. Direct match with canonical plan slug first
  const directMatch = cachedPlans.find((p) => p.slug.toLowerCase().trim() === normalized);
  if (directMatch) return directMatch.slug.toLowerCase().trim();
  
  // 2. Search in dynamic PLAN_ALIASES mapping
  const entry = Object.entries(PLAN_ALIASES).find(([, aliases]) => aliases.includes(normalized));
  if (entry) return entry[0];

  // 3. Search in cachedPlans dynamically
  const matchedPlan = cachedPlans.find((p) => {
    const s = p.slug.toLowerCase().trim();
    const n = p.name.toLowerCase().trim();
    return s === normalized || n === normalized || s.startsWith(normalized) || n.startsWith(normalized);
  });
  if (matchedPlan) return matchedPlan.slug.toLowerCase().trim();

  return normalized;
}

export function getPlanSlugAliases(slug?: string | null, plans?: any[]) {
  if (plans && plans.length > 0) {
    populatePlans(plans);
  }
  const normalized = normalizePlanSlug(slug);
  const family = getPlanFamily(normalized);
  
  let aliases = PLAN_ALIASES[family];
  if (!aliases) {
    // Generate fallbacks dynamically on the fly if DB load is still pending
    const aliasesSet = new Set<string>([normalized, family]);
    const dbPlan = cachedPlans.find((p) => p.slug.toLowerCase() === family.toLowerCase());
    
    if (dbPlan) {
      const s = dbPlan.slug.toLowerCase().trim();
      const n = dbPlan.name.toLowerCase().trim();
      aliasesSet.add(s);
      aliasesSet.add(n);
      if (s.length > 3) {
        aliasesSet.add(s.substring(0, 3));
        aliasesSet.add(s.substring(0, 4));
      }
      if (n.length > 3) {
        aliasesSet.add(n.substring(0, 3));
        aliasesSet.add(n.substring(0, 4));
      }
    } else {
      if (family.length > 3) {
        aliasesSet.add(family.substring(0, 3));
        aliasesSet.add(family.substring(0, 4));
      }
      if (normalized.length > 3) {
        aliasesSet.add(normalized.substring(0, 3));
        aliasesSet.add(normalized.substring(0, 4));
      }
    }
    aliases = Array.from(aliasesSet);
  }

  return Array.from(new Set([...aliases, normalized]));
}

export function getCanonicalPlanSlug(slug?: string | null, plans?: any[]) {
  if (plans && plans.length > 0) {
    populatePlans(plans);
  }
  const family = getPlanFamily(slug);
  return PLAN_ALIASES[family]?.[0] ?? family;
}

export function getPlanDisplayName(slug?: string | null, plans?: any[]) {
  if (plans && plans.length > 0) {
    populatePlans(plans);
  }
  const family = getPlanFamily(slug);
  const dbPlan = cachedPlans.find((p) => p.slug.toLowerCase() === family.toLowerCase());
  if (dbPlan) {
    return dbPlan.name.trim();
  }
  return family.charAt(0).toUpperCase() + family.slice(1);
}

export function getPlanStorageLimit(slug?: string | null, plans?: any[]) {
  if (plans && plans.length > 0) {
    populatePlans(plans);
  }
  const family = getPlanFamily(slug);
  const dbPlan = cachedPlans.find((p) => p.slug.toLowerCase() === family.toLowerCase());
  
  if (dbPlan) {
    const maxContacts = dbPlan.maxContacts;
    if (maxContacts === -1 || maxContacts >= 20000) {
      return 100;
    }
    if (maxContacts >= 10000) {
      return 50;
    }
    if (maxContacts >= 2000) {
      return 10;
    }
  }

  return 5;
}

export function findPlanBySlug<T extends { slug: string }>(plans: T[], slug?: string | null) {
  if (!slug) return undefined;
  const norm = normalizePlanSlug(slug);
  const directMatch = plans.find((p) => normalizePlanSlug(p.slug) === norm);
  if (directMatch) return directMatch;

  if (plans && plans.length > 0) {
    populatePlans(plans);
  }
  const aliases = new Set(getPlanSlugAliases(slug));
  return plans.find((plan) => aliases.has(normalizePlanSlug(plan.slug)));
}
