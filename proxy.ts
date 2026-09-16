import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { verifyAdminPermission, mapPathToModule, isPlatformAdminUser, getDefaultAdminRoute } from '@/lib/admin/rbac';

const handleI18nRouting = createIntlMiddleware(routing);

// NextAuth middleware wrapper configuration
const authMiddleware = withAuth(
    function middleware(req) {
        const token = req.nextauth.token;
        const isAuth = !!token;
        const pathname = req.nextUrl.pathname;
        const pathnameWithoutLocale = pathname.replace(/^\/(en|ur|hi|ar|bn)/, '') || '/';
        const isOnboardingPage = pathnameWithoutLocale.startsWith('/onboarding');
        const isAdminRoute = pathnameWithoutLocale.startsWith('/admin');
        const isAdminApiRoute = pathnameWithoutLocale.startsWith('/api/admin');
        const isPendingPage = pathnameWithoutLocale.startsWith('/account-under-review');
        const isSuspendedPage = pathnameWithoutLocale.startsWith('/account-suspended');
        const isPublicAuthPage = [
            '/login',
            '/register',
            '/verify-email',
            '/forgot-password',
            '/reset-password'
        ].some(p => pathnameWithoutLocale === p || pathnameWithoutLocale.startsWith(p + '/'));
        const isSuperAdmin = token?.role === 'SUPER_ADMIN';
        const isImpersonating = !!token?.originalAdminId;
        const isAdminStaff = token?.role === 'ADMIN' && (!token?.organizationId || !!(token?.permissions as any)?.modules);
        const hasAdminAccess = isSuperAdmin || isAdminStaff;
        const isPlatformAdmin = hasAdminAccess && !isImpersonating;
        const userStatus = (token?.status as string) || (hasAdminAccess ? 'ACTIVE' : 'PENDING');
        const currentLocale = pathname.match(/^\/(en|ur|hi|ar|bn)/)?.[1] || 'en';
        if (isAuth && !hasAdminAccess && !isImpersonating) {
            if (userStatus === 'PENDING') {
                if (pathnameWithoutLocale.startsWith('/api/auth')) {
                    return NextResponse.next();
                }
                if (pathnameWithoutLocale.startsWith('/api/')) {
                    return NextResponse.json({ error: 'Account under review' }, { status: 403 });
                }
                if (!isPendingPage) {
                    return NextResponse.redirect(new URL(`/${currentLocale}/account-under-review`, req.url));
                }
                return handleI18nRouting(req);
            }

            if (userStatus === 'SUSPENDED') {
                if (pathnameWithoutLocale.startsWith('/api/auth')) {
                    return NextResponse.next();
                }
                if (pathnameWithoutLocale.startsWith('/api/')) {
                    return NextResponse.json({ error: 'Account suspended' }, { status: 403 });
                }
                if (!isSuspendedPage) {
                    return NextResponse.redirect(new URL(`/${currentLocale}/account-suspended`, req.url));
                }
                return handleI18nRouting(req);
            }
        }

        if (isAuth && (isPendingPage || isSuspendedPage)) {
            if (isPlatformAdmin) {
                return NextResponse.redirect(new URL(`/${currentLocale}${getDefaultAdminRoute(token)}`, req.url));
            }
            return NextResponse.redirect(new URL('/dashboard', req.url));
        }

        if (isAuth && isPublicAuthPage) {
            if (isPlatformAdmin) {
                return NextResponse.redirect(new URL(`/${currentLocale}${getDefaultAdminRoute(token)}`, req.url));
            }
            if (userStatus === 'PENDING') {
                return NextResponse.redirect(new URL('/account-under-review', req.url));
            }
            if (userStatus === 'SUSPENDED') {
                return NextResponse.redirect(new URL('/account-suspended', req.url));
            }
            return NextResponse.redirect(new URL(`/${currentLocale}/dashboard`, req.url));
        }

        // Platform Admin restriction: Admin staff and Super Admins should never land on vendor client pages unless impersonating
        const isVendorPageRoute = 
            pathnameWithoutLocale === '/dashboard' ||
            pathnameWithoutLocale.startsWith('/dashboard/') ||
            pathnameWithoutLocale === '/live-chat' ||
            pathnameWithoutLocale.startsWith('/live-chat/') ||
            pathnameWithoutLocale === '/campaign' ||
            pathnameWithoutLocale.startsWith('/campaign/') ||
            pathnameWithoutLocale === '/templates' ||
            pathnameWithoutLocale.startsWith('/templates/') ||
            pathnameWithoutLocale === '/catalogs' ||
            pathnameWithoutLocale.startsWith('/catalogs/') ||
            pathnameWithoutLocale.startsWith('/manage/') ||
            pathnameWithoutLocale === '/developer' ||
            pathnameWithoutLocale.startsWith('/developer/') ||
            pathnameWithoutLocale === '/projects' ||
            pathnameWithoutLocale.startsWith('/projects/') ||
            pathnameWithoutLocale === '/profile' ||
            pathnameWithoutLocale.startsWith('/profile/');

        if (isAuth && isPlatformAdmin && isVendorPageRoute) {
            return NextResponse.redirect(new URL(`/${currentLocale}${getDefaultAdminRoute(token)}`, req.url));
        }

        const isPublicTutorialRoute = pathnameWithoutLocale.startsWith('/api/admin/configurations/tutorial-videos') && req.nextUrl.searchParams.get('public') === '1';
        const isPublicGeneralConfigRoute = pathnameWithoutLocale === '/api/admin/configurations/general' && req.method?.toUpperCase() === 'GET';
        const isPublicSocialConfigRoute = pathnameWithoutLocale === '/api/admin/configurations/social' && req.method?.toUpperCase() === 'GET';
        const isPublicPlansRoute = pathnameWithoutLocale === '/api/admin/configurations/plans' && req.method?.toUpperCase() === 'GET';
        const isExemptAdminApiRoute = isPublicTutorialRoute || isPublicGeneralConfigRoute || isPublicSocialConfigRoute || isPublicPlansRoute;

        if ((isAdminRoute || isAdminApiRoute) && !isExemptAdminApiRoute) {
            if (!hasAdminAccess) {
                if (isAdminApiRoute) {
                    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
                }
                return NextResponse.redirect(new URL('/dashboard', req.url));
            }

            // For sub-admins (staff with granular RBAC), verify module-level permission
            if (isAdminStaff && !isSuperAdmin) {
                const targetModule = mapPathToModule(pathnameWithoutLocale);
                if (targetModule) {
                    const reqMethod = req.method?.toUpperCase();
                    const actionType = (reqMethod === 'POST' || reqMethod === 'PUT' || reqMethod === 'PATCH' || reqMethod === 'DELETE') ? 'write' : 'read';
                    const check = verifyAdminPermission(token, targetModule, actionType);
                    if (!check.allowed) {
                        if (isAdminApiRoute) {
                            return NextResponse.json({ error: check.error || 'Forbidden: Insufficient module permission' }, { status: 403 });
                        }
                        // If they don't have read permission for this module page, redirect to default allowed module
                        return NextResponse.redirect(new URL(`/${currentLocale}${getDefaultAdminRoute(token)}`, req.url));
                    }
                }
            }
        }

        // Onboarding is completely disabled: Any authenticated user trying to access onboarding goes directly to dashboard
        if (isAuth && isOnboardingPage) {
            return NextResponse.redirect(new URL(`/${currentLocale}/dashboard`, req.url));
        }

        // Module Access Restriction Guard for Vendor Users
        const routeToModuleMap: Record<string, string> = {
            "/live-chat": "chat",
            "/dashboard/contacts": "contacts",
            "/dashboard/audience": "audience",
            "/dashboard/pipeline": "contacts",
            "/templates": "templates",
            "/manage/quick-replies": "quick_replies",
            "/dashboard/welcome-messages": "quick_message",
            "/campaign": "drip_campaign",
            "/dashboard/flows": "flow",
            "/dashboard/knowledge-base": "knowledge_base",
            "/catalogs": "dashboard",
            "/manage/ad-manager": "ad_manager",
            "/dashboard/facebook-posts": "facebook_posts",
            "/dashboard/instagram-posts": "instagram_posts",
            "/dashboard/facebook-automation": "facebook_posts",
            "/dashboard/instagram-automation": "instagram_posts",
            "/manage/reports": "reports",
            "/dashboard/settings": "settings",
            "/dashboard/integrations": "integrations",
            "/dashboard/webhooks": "integrations",
            "/developer": "developer",
            "/projects": "projects",
            "/manage/agents": "agents",
            "/manage/permissions": "permissions",
            "/manage/tags": "tags",
            "/manage/notifications": "notifications"
        };

        if (isAuth && token?.planModulesAccess && !isSuperAdmin) {
            const planModules = (token.planModulesAccess as Record<string, boolean>) || {};
            for (const [routePrefix, moduleKey] of Object.entries(routeToModuleMap)) {
                if (pathnameWithoutLocale === routePrefix || (routePrefix !== '/' && pathnameWithoutLocale.startsWith(routePrefix + '/'))) {
                    if (planModules[moduleKey] === false) {
                        if (pathname.startsWith('/api/')) {
                            return NextResponse.json({ error: 'Access to this module is restricted by administrator' }, { status: 403 });
                        }
                        return NextResponse.redirect(new URL(`/${currentLocale}/dashboard`, req.url));
                    }
                }
            }
        }

        // Admin-Controlled Knowledge Base Access Restriction
        const isKnowledgeBaseRoute = pathnameWithoutLocale === '/dashboard/knowledge-base' || pathnameWithoutLocale.startsWith('/dashboard/knowledge-base/');
        const kbManagement = (token?.knowledgeBaseManagement as string) || 'user';
        if (isAuth && isKnowledgeBaseRoute && kbManagement === 'admin' && !isSuperAdmin && !isImpersonating) {
            return NextResponse.redirect(new URL(`/${currentLocale}/dashboard`, req.url));
        }

        // If it's an API or Webhook route, bypass i18n routing
        if (pathname.startsWith('/api/') || pathnameWithoutLocale.startsWith('/api/') || pathname.startsWith('/whatsapp-webhook') || pathnameWithoutLocale.startsWith('/whatsapp-webhook')) {
            return NextResponse.next();
        }

        // Run the next-intl middleware for locale detection and routing
        return handleI18nRouting(req);
    },
    {
        callbacks: {
            authorized: ({ req, token }) => {
                const pathname = req.nextUrl.pathname;
                const pathnameWithoutLocale = pathname.replace(/^\/(en|ur|hi|ar|bn)/, '') || '/';
                
                const publicPaths = [
                    '/login', 
                    '/register', 
                    '/verify-email', 
                    '/forgot-password', 
                    '/reset-password', 
                    '/terms-and-policies', 
                    '/whatsapp-webhook',
                    '/account-under-review',
                    '/account-suspended',
                    '/' 
                ];
                
                if (publicPaths.some(p => pathnameWithoutLocale === p || pathnameWithoutLocale.startsWith(p + '/'))) {
                    return true;
                }
                
                if (pathname.startsWith('/api/') || pathnameWithoutLocale.startsWith('/api/')) return true;
                
                return !!token;
            },
        },
        pages: {
            signIn: '/login',
        },
    }
);

// Main middleware wrapper to chain next-intl (first) and next-auth (second)
export default function middleware(req: any, event: any) {
    const pathname = req.nextUrl.pathname;
    
    // API and Webhook routes are global (located outside [locale]) and must NOT be prefixed by next-intl locale!
    if (pathname.startsWith('/api/upload')) {
        return NextResponse.next();
    }

    if (pathname.startsWith('/api/') || pathname.startsWith('/whatsapp-webhook')) {
        return authMiddleware(req, event);
    }

    // 1. Run next-intl middleware first to check for locale redirects (e.g. /login -> /en/login)
    const response = handleI18nRouting(req);

    // If next-intl returned a redirect response, return it immediately to redirect the browser
    const isRedirect = response.status === 307 || response.status === 308 || response.headers.get('Location') || response.headers.get('x-middleware-redirect');
    if (isRedirect) {
        return response;
    }

    // 2. Otherwise, pass control to the authentication middleware
    return authMiddleware(req, event);
}

export const config = {
    // Match all routes except API, _next (static assets), and files with extensions
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)', '/api/((?!upload).*)']
};
