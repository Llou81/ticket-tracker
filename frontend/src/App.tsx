import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { PublicOnly, RequireAuth } from "./components/RouteGuards";
import { CheckEmailPage } from "./pages/CheckEmailPage";
import { EpicsPage } from "./pages/EpicsPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { NewTicketPage } from "./pages/NewTicketPage";
import { TicketPage } from "./pages/TicketPage";
import { SignUpPage } from "./pages/SignUpPage";
import { TeamsPage } from "./pages/TeamsPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";

export function App() {
  return (
    <Layout>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
        <Route path="/signup" element={<PublicOnly><SignUpPage /></PublicOnly>} />
        <Route path="/check-email" element={<CheckEmailPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />

        {/* Authenticated */}
        <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
        <Route path="/teams" element={<RequireAuth><TeamsPage /></RequireAuth>} />
        <Route path="/epics" element={<RequireAuth><EpicsPage /></RequireAuth>} />
        <Route path="/tickets/new" element={<RequireAuth><NewTicketPage /></RequireAuth>} />
        <Route path="/tickets/:id" element={<RequireAuth><TicketPage /></RequireAuth>} />
        <Route path="*" element={<RequireAuth><p>Page not found.</p></RequireAuth>} />
      </Routes>
    </Layout>
  );
}
