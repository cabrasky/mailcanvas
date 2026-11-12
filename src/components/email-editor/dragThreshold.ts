export function armThresholdDrag(event: React.PointerEvent, onStart: (clientX: number, clientY: number) => void, threshold = 4) {
  const startX = event.clientX;
  const startY = event.clientY;
  let started = false;
  const move = (moveEvent: PointerEvent) => {
    if (started) return;
    if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < threshold) return;
    started = true;
    moveEvent.preventDefault();
    cleanup();
    onStart(moveEvent.clientX, moveEvent.clientY);
  };
  const cleanup = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", cleanup);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", cleanup, { once: true });
}
