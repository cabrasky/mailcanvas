export type GestureIntent = "align" | "resize";
export type GesturePhase = "pressed" | "resizing" | "aligning" | "reordering" | "committed" | "cancelled";
export type Gesture = Readonly<{intent:GestureIntent;phase:GesturePhase;x:number;y:number}>;
export function beginGesture(intent:GestureIntent,x:number,y:number):Gesture {
  return {intent,phase:"pressed",x,y};
}
export function advanceGesture(state:Gesture,x:number,y:number):Gesture {
  if (state.phase !== "pressed") return state;
  const dx=Math.abs(x-state.x),dy=Math.abs(y-state.y);
  const threshold=state.intent === "resize" ? 3 : 6;
  if (Math.hypot(dx,dy)<threshold) return state;
  const phase=state.intent === "resize" ? "resizing" : dy>dx ? "reordering" : "aligning";
  return {...state,phase};
}
export function finishGesture(state:Gesture,commit:boolean):Gesture {
  if (state.phase === "committed" || state.phase === "cancelled") return state;
  return {...state,phase:commit && state.phase !== "pressed" ? "committed" : "cancelled"};
}
