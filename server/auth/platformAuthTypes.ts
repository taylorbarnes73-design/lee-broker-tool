export type PlatformRole = "admin" | "broker" | "readonly";

export type PlatformAuthUser = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: PlatformRole;
  office: string | null;
};
