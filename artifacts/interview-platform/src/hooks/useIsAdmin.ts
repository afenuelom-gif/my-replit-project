import { useQuery } from "@tanstack/react-query";
import { useAuthActions } from "@/contexts/auth-actions";

export function useIsAdmin(): boolean {
  const { getAuthHeaders } = useAuthActions();

  const { data } = useQuery<{ userId: string; isAdmin: boolean }>({
    queryKey: ["users-me-admin"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/users/me", { credentials: "include", headers });
      if (!res.ok) return { userId: "", isAdmin: false };
      return res.json();
    },
    staleTime: 60_000,
    retry: false,
  });

  return data?.isAdmin ?? false;
}
