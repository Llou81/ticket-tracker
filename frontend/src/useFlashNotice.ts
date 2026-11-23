import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * A one-time message passed via navigation state (e.g. "Ticket deleted."). It is read once and then removed
 * from the history entry, so a browser refresh doesn't show it again. Other state keys are preserved.
 */
export function useFlashNotice() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as ({ notice?: string } & Record<string, unknown>) | null;
  const [notice, setNotice] = useState<string | null>(state?.notice ?? null);

  useEffect(() => {
    if (state?.notice) {
      const { notice: _consumed, ...rest } = state;
      navigate(location.pathname + location.search, { replace: true, state: rest });
    }
  }, []); // only on mount: consume the notice of the entry we arrived with

  return [notice, setNotice] as const;
}
