export const ENV = {
    // Microsoft Entra ID (Azure AD) OAuth
    azureClientId: process.env.AZURE_CLIENT_ID ?? "",
    azureClientSecret: process.env.AZURE_CLIENT_SECRET ?? "",
    azureTenantId: process.env.AZURE_TENANT_ID ?? "",

    // Session / cookies
    cookieSecret: process.env.JWT_SECRET ?? "",

    // Database
    databaseUrl: process.env.DATABASE_URL ?? "",

    // Owner identity (Microsoft object ID of the admin user)
    ownerOpenId: process.env.OWNER_OPEN_ID ?? "",

    // Runtime
    isProduction: process.env.NODE_ENV === "production",

    // Azure Blob Storage
    azureStorageConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING ?? "",
    azureStorageContainer: process.env.AZURE_STORAGE_CONTAINER ?? "uploads",

    // Admin
    adminEmail: process.env.ADMIN_EMAIL ?? "",
};
