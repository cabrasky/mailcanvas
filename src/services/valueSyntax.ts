export const singleVariable = (value:string) => value.trim().match(/^\$\{([^{}]+)\}$/)?.[1];
export const displayDynamicValue = (value:string) => !value || value.includes("${") ? value : `\${${value}}`;
export function templateExpression(value:string):string {
  const single=value.match(/^\$\{([^{}]+)\}$/)?.[1];
  if(single)return single;
  const quote=(text:string)=>`'${text.replace(/\\/g,"\\\\").replace(/'/g,"\\'")}'`;
  const parts:string[]=[];let end=0;
  for(const match of value.matchAll(/\$\{([^{}]+)\}/g)){
    if(match.index!>end)parts.push(quote(value.slice(end,match.index)));
    parts.push(`(${match[1]})`);end=match.index!+match[0].length;
  }
  if(end<value.length)parts.push(quote(value.slice(end)));
  return parts.join(" + ")||"''";
}
