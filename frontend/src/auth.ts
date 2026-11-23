import { useQuery } from "@tanstack/react-query";
import { fetchCurrentUser } from "./api/auth";

export const CURRENT_USER_KEY = ["auth", "me"] as const;

export function useCurrentUser() {
  return useQuery({
    queryKey: CURRENT_USER_KEY,
    queryFn: fetchCurrentUser,
    staleTime: Infinity,
  });
}
