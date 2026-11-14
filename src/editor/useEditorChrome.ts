import { useEffect, useState } from "react";
import type React from "react";
import { usePointerSession } from "./usePointerSession";

const locks = new WeakMap<Document, { count: number; previous: string }>();

export function useEditorChrome(options: {
  maximized?: boolean; defaultMaximized?: boolean; onMaximizedChange?: (maximized: boolean) => void;
}) {
  const [internal, setInternal] = useState(options.defaultMaximized || false);
  const maximized = options.maximized ?? internal;
  const [leftWidth, setLeftWidth] = useState(280);
  const [inspectorWidth, setInspectorWidth] = useState(340);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const beginSession = usePointerSession();
  useEffect(() => {
    if (!maximized || typeof document === "undefined") return;
    const entry = locks.get(document) || { count: 0, previous: document.body.style.overflow };
    entry.count++;
    locks.set(document, entry);
    document.body.style.overflow = "hidden";
    return () => {
      entry.count--;
      if (entry.count === 0) { document.body.style.overflow = entry.previous; locks.delete(document); }
    };
  }, [maximized]);
  const resize = (panel: "left" | "inspector") => (event: React.PointerEvent) => {
    event.preventDefault();
    const startX = event.clientX;
    const initial = panel === "left" ? leftWidth : inspectorWidth;
    const update = panel === "left" ? setLeftWidth : setInspectorWidth;
    beginSession({
      move: pointer => {
        const delta = (pointer.clientX - startX) * (panel === "left" ? 1 : -1);
        update(Math.max(panel === "left" ? 160 : 220, Math.min(420, initial + delta)));
      },
      finish: commit => { if (!commit) update(initial); },
    });
  };
  return {
    maximized, leftWidth, inspectorWidth, leftCollapsed, inspectorCollapsed, resize,
    toggleLeft: () => setLeftCollapsed(value => !value),
    toggleInspector: () => setInspectorCollapsed(value => !value),
    toggleMaximized: () => {
      if (options.maximized === undefined) setInternal(!maximized);
      options.onMaximizedChange?.(!maximized);
    },
  };
}
