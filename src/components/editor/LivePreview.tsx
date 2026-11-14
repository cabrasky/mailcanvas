import { useEffect, useMemo, useRef, useState } from "react";
import { previewDocument, PREVIEW_SANDBOX } from "../../services/previewDocument";
import type { EmailBlock } from "../../services/emailBlocks";
import { describeLength } from "./canvasMeasurements";

type PreviewIssue = { id: string; label: string; width: number; available: number };
type Dimensions = { width: number; height: number };
type Props = {
  style?: React.CSSProperties;
  html: string;
  warnings: string[];
  viewport: "desktop" | "mobile";
  onViewportChange: (viewport: "desktop" | "mobile") => void;
  selected?: EmailBlock;
  onSelectBlock?: (id: string) => void;
};

function sameIssues(left: PreviewIssue[], right: PreviewIssue[]) {
  return left.length === right.length && left.every((issue, index) => {
    const other = right[index];
    return issue.id === other.id && issue.label === other.label && issue.width === other.width && issue.available === other.available;
  });
}

/** The frame owns navigation. The editor reads geometry without modifying its document styles. */
export default function LivePreview(props: Props) {
  const { style, html, warnings, viewport, onViewportChange, selected } = props;
  const source = useMemo(() => previewDocument(html), [html]);
  const frame = useRef<HTMLIFrameElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const refresh = useRef<() => void>(() => {});
  const [generation, setGeneration] = useState(0);
  const [issues, setIssues] = useState<PreviewIssue[]>([]);
  const [dimensions, setDimensions] = useState<Dimensions | null>(null);
  const [outline, setOutline] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  useEffect(() => {
    const document = frame.current?.contentDocument;
    const window = document?.defaultView;
    if (!document?.body || !window) return;
    let animation = 0;
    let disposed = false;
    const measure = () => {
      animation = 0;
      if (disposed || !frame.current) return;
      const available = document.documentElement.clientWidth;
      if (!available) return;
      const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-ee-block-id]"));
      const overflowing = nodes.filter(node => {
        const box = node.getBoundingClientRect();
        return box.width > 0 && (box.left < -1 || box.right > available + 1);
      });
      const nextIssues = overflowing.filter(node => !overflowing.some(child => child !== node && node.contains(child))).map(node => ({
        id: node.dataset.eeBlockId!,
        label: node.textContent?.trim().slice(0, 55) || node.getAttribute("alt") || node.dataset.eeBlockKind || "Bloque",
        width: Math.round(node.getBoundingClientRect().width),
        available,
      }));
      setIssues(previous => sameIssues(previous, nextIssues) ? previous : nextIssues);
      const selectedNode = nodes.find(node => node.dataset.eeBlockId === latest.current.selected?.id);
      const box = selectedNode?.getBoundingClientRect();
      const nextDimensions = box ? { width: Math.round(box.width), height: Math.round(box.height) } : null;
      setDimensions(previous => previous?.width === nextDimensions?.width && previous?.height === nextDimensions?.height ? previous : nextDimensions);
      const nextOutline = box ? { left: box.left, top: box.top, width: box.width, height: box.height } : null;
      setOutline(previous => JSON.stringify(previous) === JSON.stringify(nextOutline) ? previous : nextOutline);
    };
    const schedule = () => {
      if (!animation) animation = window.requestAnimationFrame(measure);
    };
    const click = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof window.Element)) return;
      const node = target.closest<HTMLElement>("[data-ee-block-id]");
      if (node?.dataset.eeBlockId) latest.current.onSelectBlock?.(node.dataset.eeBlockId);
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    observer?.observe(document.body);
    document.addEventListener("click", click);
    document.addEventListener("load", schedule, true);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule);
    refresh.current = schedule;
    measure();
    return () => {
      disposed = true;
      window.cancelAnimationFrame(animation);
      observer?.disconnect();
      document.removeEventListener("click", click);
      document.removeEventListener("load", schedule, true);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule);
      refresh.current = () => {};
    };
  }, [generation]);

  useEffect(() => { refresh.current(); }, [selected, viewport]);

  return <section className="ee-preview-pane" style={style} aria-label="Vista previa">
    <div className="ee-preview-toolbar">
      <span className="ee-eyebrow">VISTA PREVIA</span>
      <div className="ee-device-picker" role="group" aria-label="Tamaño de vista previa">
        {([['desktop', '▰ 600px'], ['mobile', '▯ 375px']] as const).map(([value, label]) => <button key={value}
          className={viewport === value ? "selected" : ""} aria-pressed={viewport === value} onClick={() => onViewportChange(value)}>{label}</button>)}
      </div>
    </div>
    {selected && dimensions && <div className="ee-preview-measurements" role="status">
      Selección · {describeLength(selected.styles?.width || (selected.type === "image" && selected.width ? `${selected.width}px` : undefined))}
      {` → ${dimensions.width} × ${dimensions.height} px en ${viewport === "mobile" ? "móvil" : "escritorio"}`}
    </div>}
    <div className="ee-preview-diagnostics" aria-live="polite">
      {issues.length > 0 && <div className="ee-preview-warnings"><strong>Bloques que desbordan</strong>
        {issues.map(issue => <button className="ee-btn" type="button" key={issue.id} onClick={() => latest.current.onSelectBlock?.(issue.id)}>
          {issue.label} · {issue.width} px / vista de {issue.available} px
        </button>)}
      </div>}
    </div>
    <div className="ee-preview-stage">
      <div className={`ee-device ee-device-${viewport}`}>
        <div className="ee-device-top"><i /><i /><i /><span>{viewport === "mobile" ? "375 px" : "600 px"}</span></div>
        <div className="ee-preview-frame">
          {html ? <iframe ref={frame} title="Correo renderizado localmente" sandbox={`allow-same-origin ${PREVIEW_SANDBOX}`}
            srcDoc={source} onLoad={() => setGeneration(current => current + 1)} /> : <div className="ee-preview-placeholder">Todavía no hay contenido para mostrar.</div>}
          {outline && <div aria-hidden="true" className="ee-preview-selection" style={outline} />}
        </div>
      </div>
    </div>
    {warnings.length > 0 && <div className="ee-preview-warnings"><strong>Datos sin muestra</strong><span>{warnings.slice(0, 4).join(" · ")}</span></div>}
  </section>;
}
