import { useQuery } from "@tanstack/react-query";
import { useAuthActions } from "@/contexts/auth-actions";

export function useIsAdmin(): boolean {
  const { getAuthHeaders } = useAuthActions();

  const { data } = useQuery<{ userId: string; isAdmin: boolean }>({
    queryKey: ["users-me-admin"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/users/me", { credentials: "include", headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 30_000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
  });

  return data?.isAdmin ?? false;
}
