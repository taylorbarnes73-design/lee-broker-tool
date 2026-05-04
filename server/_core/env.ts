export const ENV = {
    // Public OAuth app metadata used by the custom OAuth service
    appId: process.env.VITE_APP_ID ?? process.env.APP_ID ?? "",
    oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? process.env.VITE_OAUTH_PORTAL_URL ?? "",

    // AWS identity configuration for future Cognito-based auth
    awsRegion: process.env.AWS_REGION ?? "",
    awsCognitoUserPoolId: process.env.AWS_COGNITO_USER_POOL_ID ?? "",
    awsCognitoClientId: process.env.AWS_COGNITO_CLIENT_ID ?? "",
    awsCognitoDomain: process.env.AWS_COGNITO_DOMAIN ?? "",

    // Session / cookies
    cookieSecret: process.env.JWT_SECRET ?? "",

    // Database
    databaseUrl: process.env.DATABASE_URL ?? "",

    // Owner identity subject / openId for the admin user
    ownerOpenId: process.env.OWNER_OPEN_ID ?? process.env.OWNER_USER_ID ?? "",

    // Runtime
    isProduction: process.env.NODE_ENV === "production",

    // Built-in Forge proxy backing storage, LLM, maps, and other managed services
    forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
    forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",

    // Google Maps (server-side only). Used to proxy Street View/static map assets so the key
    // is never exposed to the browser.
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",

    // Direct OpenAI fallback (used when Forge is not configured).
    // The LLM layer prefers Forge when set; otherwise falls back to OPENAI_API_KEY.
    openaiApiUrl: (process.env.OPENAI_API_URL ?? "https://api.openai.com/v1").replace(/\/$/, ""),
    openaiApiKey: process.env.OPENAI_API_KEY ?? "",
    openaiModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",

    // AWS storage placeholders for future direct-S3 integration
    awsS3Bucket: process.env.AWS_S3_BUCKET ?? "",
    awsS3Region: process.env.AWS_S3_REGION ?? process.env.AWS_REGION ?? "",

    // Admin
    adminEmail: process.env.ADMIN_EMAIL ?? "",
    // Sign request vendor
    cimarronEmail: process.env.CIMARRON_EMAIL ?? "",

    // Dealius (server-to-server integration)
    // Base URL should NOT include trailing slash, e.g. https://leenewportbeach.dealius.com
    dealiusBaseUrl: (process.env.DEALIUS_BASE_URL ?? "https://leenewportbeach.dealius.com").replace(/\/$/, ""),
    // Service credentials used when brokers do not provide per-user credentials.
    dealiusEmail: process.env.DEALIUS_EMAIL ?? "",
    dealiusPassword: process.env.DEALIUS_PASSWORD ?? "",
    /** Optional path to Dealius **Users** report (.xlsx) or JSON roster — improves `/brokers` matching on deal push. */
    dealiusUsersDirectory: process.env.DEALIUS_USERS_DIRECTORY ?? "",

    // SMTP email delivery for reliable PDF attachments
    smtpHost: process.env.SMTP_HOST ?? "",
    smtpPort: parseInt(process.env.SMTP_PORT ?? "587", 10),
    smtpSecure: (process.env.SMTP_SECURE ?? "").toLowerCase() === "true",
    smtpUser: process.env.SMTP_USER ?? "",
    smtpPass: process.env.SMTP_PASS ?? "",
    smtpFrom: process.env.SMTP_FROM ?? process.env.ADMIN_EMAIL ?? "",

    // Local broker auth
    localAuthEnabled:
        (process.env.LOCAL_AUTH_ENABLED ?? "").toLowerCase() === "true" ||
        !(process.env.OAUTH_SERVER_URL || process.env.VITE_OAUTH_PORTAL_URL),
    localAuthEmailDomain: process.env.LOCAL_AUTH_EMAIL_DOMAIN ?? "",
    localAdminEmails: (process.env.LOCAL_ADMIN_EMAILS ?? "")
        .split(",")
        .map(value => value.trim().toLowerCase())
        .filter(Boolean),
    localAdminNames: (process.env.LOCAL_ADMIN_NAMES ?? "")
        .split(",")
        .map(value => value.trim().toLowerCase())
        .filter(Boolean),
};
