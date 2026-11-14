import {it,expect} from "vitest";
import {changeSizeMode,sizeMode} from "./blockLayout";
it("switches sizing modes without losing the other axis or padding",()=>{
 const initial={height:"90px",padding:"12px",width:"40%"};
 expect(sizeMode(initial.width)).toBe("relative");
 const auto=changeSizeMode(initial,"width","auto");
 expect(auto.width).toBeUndefined();expect(auto.height).toBe("90px");expect(auto.padding).toBe("12px");
 expect(changeSizeMode(auto,"width","fixed").width).toBe("300px");
 expect(changeSizeMode(auto,"width","relative").width).toBe("100%");
});
