import { useQuery } from "@tanstack/react-query";

export function useIsAdmin(): boolean {
  const { data } = useQuery<{ userId: string; isAdmin: boolean }>({
    queryKey: ["users-me-admin"],
    queryFn: async () => {
      const res = await fetch("/api/users/me", { credentials: "include" });
      if (!res.ok) return { userId: "", isAdmin: false };
      return res.json();
    },
    staleTime: 60_000,
    retry: false,
  });

  return data?.isAdmin ?? false;
}
