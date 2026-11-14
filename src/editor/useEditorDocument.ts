import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { EditorDocument } from "./EditorDocument";

export function useEditorDocument(value: string, onChange: (html: string) => void) {
  const change = useRef(onChange);
  change.current = onChange;
  const [document] = useState(() => new EditorDocument(value, html => change.current(html)));
  const snapshot = useSyncExternalStore(document.subscribe, document.getSnapshot, document.getSnapshot);
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    if (document.receive(value)) setGeneration(current => current + 1);
  }, [document, value]);
  return { document, snapshot, generation };
}
