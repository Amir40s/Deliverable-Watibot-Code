type MaybeRecord = Record<string, unknown> | null | undefined;

const SENSITIVE_SYSTEM_CONFIG_KEYS = new Set([
    'googleClientSecret',
    'facebookAppSecret',
    'embeddedSignupAppSecret',
    'metaAccessToken',
    'metaWebhookVerifyToken',
    'cloudinaryApiSecret',
    'smtpPassword',
    'stripeSecretKey',
    'stripeWebhookSecret',
    'payfastSecuredKey',
    'tiktokClientSecret',
    'aiProviderApiKey',
    'pusherSecret',
]);

export function redactSystemConfig<T extends MaybeRecord>(config: T): T {
    if (!config || typeof config !== 'object') {
        return config;
    }

    const redacted = { ...config } as Record<string, unknown>;
    for (const key of SENSITIVE_SYSTEM_CONFIG_KEYS) {
        if (key in redacted) {
            if (redacted[key] !== null && redacted[key] !== undefined && redacted[key] !== "") {
                redacted[key] = '********';
            } else {
                redacted[key] = null;
            }
        }
    }

    return redacted as T;
}
