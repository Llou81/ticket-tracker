import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useCurrentUser } from "../auth";
import { BrandMenu } from "./BrandMenu";
import { UserMenu } from "./UserMenu";

export function Layout({ children }: { children: ReactNode }) {
  const { data: user } = useCurrentUser();

  return (
    <div className="app">
      <header className="header">
        <BrandMenu signedIn={!!user} />
        <nav className="nav">
          {user ? (
            <UserMenu user={user} />
          ) : (
            <>
              <Link to="/login">Log in</Link>
              <Link to="/signup">Sign up</Link>
            </>
          )}
        </nav>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
