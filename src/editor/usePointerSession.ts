import { useCallback, useEffect, useRef } from "react";

type Session = { move: (event: PointerEvent) => void; finish: (commit: boolean) => void };

/** One active gesture per owner. All exits release listeners and restore transient state. */
export function usePointerSession() {
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);
  return useCallback((session: Session) => {
    cleanup.current?.();
    let active = true;
    const finish = (commit: boolean) => {
      if (!active) return;
      active = false;
      window.removeEventListener("pointermove", session.move);
      window.removeEventListener("pointerup", commitSession);
      window.removeEventListener("pointercancel", cancelSession);
      window.removeEventListener("blur", cancelSession);
      window.removeEventListener("keydown", escape, true);
      cleanup.current = null;
      session.finish(commit);
    };
    const commitSession = () => finish(true);
    const cancelSession = () => finish(false);
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault(); event.stopPropagation(); finish(false);
    };
    cleanup.current = cancelSession;
    window.addEventListener("pointermove", session.move);
    window.addEventListener("pointerup", commitSession);
    window.addEventListener("pointercancel", cancelSession);
    window.addEventListener("blur", cancelSession);
    window.addEventListener("keydown", escape, true);
    return cancelSession;
  }, []);
}
