import {it,expect} from "vitest";
import {readEdge,setSpacing} from "./boxModel";
it("resolves shorthand sides and replaces them atomically when linking padding",()=>{
 const styles={padding:"10px 20px",paddingTop:"0px",margin:"auto"};
 expect(readEdge(styles,"padding","Top")).toBe("0px");
 expect(readEdge(styles,"padding","Right")).toBe("20px");
 const linked=setSpacing(styles,"padding","2rem");
 expect(linked.paddingTop).toBeUndefined();expect(linked.padding).toBe("2rem");
 expect(linked.margin).toBe("auto");
});
