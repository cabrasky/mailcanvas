import {it,expect} from "vitest";
import {beginGesture,advanceGesture,finishGesture} from "./gestureMachine";
it("separates a click from a drag and locks the chosen axis",()=>{
 const pressed=beginGesture("align",10,10);
 expect(advanceGesture(pressed,12,12).phase).toBe("pressed");
 const horizontal=advanceGesture(pressed,30,11);
 expect(horizontal.phase).toBe("aligning");
 expect(advanceGesture(horizontal,31,200).phase).toBe("aligning");
 expect(advanceGesture(pressed,11,30).phase).toBe("reordering");
});
it("finishes gestures once and never commits a simple click",()=>{
 expect(finishGesture(beginGesture("align",0,0),true).phase).toBe("cancelled");
 const resizing=advanceGesture(beginGesture("resize",0,0),0,8);
 expect(resizing.phase).toBe("resizing");
 const cancelled=finishGesture(resizing,false);
 expect(finishGesture(cancelled,true)).toBe(cancelled);
 expect(finishGesture(resizing,true).phase).toBe("committed");
});
