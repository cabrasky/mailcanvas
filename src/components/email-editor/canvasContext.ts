import { createContext, useContext } from "react";
import type { BlockKind } from "../../services/emailBlocks";
import type { EmailToken } from "../../services/emailTemplateRenderer";
import type { EmailComponent } from "../../services/emailComponents";

export type DragPayload = { type: "move"; id: string } | { type: "insert"; kind: BlockKind };
export type DragEdge = "before" | "after" | "into";
export type DragState = { payload: DragPayload; overId: string | null; overEdge: DragEdge; x: number; y: number };

export type CanvasContextValue = {
  tokens: EmailToken[];
  components?: EmailComponent[];
  selectedIds: Set<string>;
  hoverId: string | null;
  editingId: string | null;
  tableSelection: { id: string; fields: string[] } | null;
  drag: DragState | null;
  onSelect: (id: string, additive: boolean) => void;
  onHover: (id: string | null) => void;
  onStartEdit: (id: string) => void;
  onCommitEdit: (id: string, kind: string, html: string) => void;
  onContextMenu: (id: string, x: number, y: number) => void;
  onBeginDrag: (id: string, clientX: number, clientY: number) => void;
  onTableCellSelect: (id: string, fields: string[], additive: boolean) => void;
  onTableWidthChange: (id: string, width: string) => void;
  onTableColumnWidthChange: (id: string, field: string, width: string) => void;
  onTableColumnLabelChange: (id: string, field: string, label: string) => void;
  onEditVariableExpression: (id: string, expression: string) => void;
};

export const CanvasContext = createContext<CanvasContextValue | null>(null);
export const useCanvasContext = (): CanvasContextValue => {
  const ctx = useContext(CanvasContext);
  if (!ctx) throw new Error("useCanvasContext must be used within CanvasContext.Provider");
  return ctx;
};
