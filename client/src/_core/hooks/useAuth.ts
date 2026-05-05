import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

const SHARED_AUTH_STORAGE_KEY = "lee-broker-tool.auth";
const LEGACY_AUTH_STORAGE_KEY = "legacy-runtime-user-info";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } =
    options ?? {};
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!meQuery.data) {
      window.localStorage.removeItem(SHARED_AUTH_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
      return;
    }

    const payload = JSON.stringify({
      openId: meQuery.data.openId,
      name: meQuery.data.name ?? "",
      email: meQuery.data.email ?? "",
      role: meQuery.data.role ?? "user",
      office: meQuery.data.office ?? "",
    });

    window.localStorage.setItem(SHARED_AUTH_STORAGE_KEY, payload);
    window.localStorage.setItem(LEGACY_AUTH_STORAGE_KEY, payload);
  }, [meQuery.data]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (currentPath === redirectPath || window.location.pathname === redirectPath) return;

    const isInternalLogin = redirectPath === "/login" || redirectPath.startsWith("/login?");
    const nextPath =
      isInternalLogin && window.location.pathname !== "/login"
        ? `/login?next=${encodeURIComponent(currentPath)}`
        : redirectPath;

    window.location.href = nextPath;
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
