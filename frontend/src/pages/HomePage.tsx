import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

export function HomePage() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: () => api<{ status: string; database: string }>("/health"),
  });

  if (health.isPending) return <p className="muted">Checking API…</p>;
  if (health.isError) return <p className="error">API unavailable: {health.error.message}</p>;
  return (
    <p>
      API: <strong>{health.data.status}</strong>, database: <strong>{health.data.database}</strong>
    </p>
  );
}
