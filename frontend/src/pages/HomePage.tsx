import { useCurrentUser } from "../auth";

// Becomes the Kanban board in slice 6.
export function HomePage() {
  const { data: user } = useCurrentUser();
  return (
    <div className="card">
      <h1>Welcome</h1>
      <p>
        You are logged in as <strong>{user?.email}</strong>.
      </p>
    </div>
  );
}
