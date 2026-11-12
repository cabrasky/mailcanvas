export type ContextMenuTarget = { id: string; x: number; y: number };
type Props = {
  target: ContextMenuTarget | null; onClose: () => void;
  onDuplicate: (id: string) => void; onMove: (id: string, direction: -1 | 1) => void; onDelete: (id: string) => void;
};

export default function EditorContextMenu({ target, onClose, onDuplicate, onMove, onDelete }: Props) {
  if (!target) return null;
  const act = (action: () => void) => { action(); onClose(); };
  return <div className="ee-context-menu" style={{ left: target.x, top: target.y }} role="menu" onClick={event => event.stopPropagation()}>
    <button role="menuitem" onClick={() => act(() => onDuplicate(target.id))}>⧉ <span>Duplicar</span><kbd>Ctrl+D</kbd></button>
    <button role="menuitem" onClick={() => act(() => onMove(target.id, -1))}>↑ <span>Mover arriba</span></button>
    <button role="menuitem" onClick={() => act(() => onMove(target.id, 1))}>↓ <span>Mover abajo</span></button>
    <div className="ee-divider-line" />
    <button className="danger" role="menuitem" onClick={() => act(() => onDelete(target.id))}>× <span>Eliminar</span><kbd>Supr</kbd></button>
  </div>;
}
