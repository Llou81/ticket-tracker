import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type FlashState = { notice?: string; noticeTimeoutMs?: number } & Record<string, unknown>;

/**
 * A one-time message passed via navigation state (e.g. "Ticket deleted."). It is read once and then removed
 * from the history entry, so a browser refresh doesn't show it again. Other state keys are preserved.
 * With `noticeTimeoutMs` in the state, the message also hides itself after that many milliseconds.
 */
export function useFlashNotice() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as FlashState | null;
  const [notice, setNotice] = useState<string | null>(state?.notice ?? null);
  const [timeoutMs] = useState(state?.noticeTimeoutMs);

  useEffect(() => {
    if (state?.notice) {
      const { notice: _consumed, noticeTimeoutMs: _t, ...rest } = state;
      navigate(location.pathname + location.search, { replace: true, state: rest });
    }
  }, []); // only on mount: consume the notice of the entry we arrived with

  useEffect(() => {
    if (!notice || !timeoutMs) return;
    const timer = setTimeout(() => setNotice(null), timeoutMs);
    return () => clearTimeout(timer);
  }, [notice, timeoutMs]);

  return [notice, setNotice] as const;
}
