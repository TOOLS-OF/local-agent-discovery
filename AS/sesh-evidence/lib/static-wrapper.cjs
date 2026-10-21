const acorn=require('acorn');
function literal(node) {
  if(!node)throw new Error('Missing argument');
  if(node.type==='Literal')return node.value;
  if(node.type==='TemplateLiteral'&&!node.expressions.length)return node.quasis[0].value.cooked;
  if(node.type==='ArrayExpression')return node.elements.map(literal);
  if(node.type==='ObjectExpression'){
    const value=Object.create(null);
    for(const p of node.properties){if(p.type!=='Property'||p.computed||p.kind!=='init')throw new Error('Dynamic object');value[p.key.name??p.key.value]=literal(p.value);}
    return value;
  }
  throw new Error('Dynamic expression');
}
function staticWrapperCalls(code) {
  const calls=[],gaps=[];
  let ast;
  try{ast=acorn.parse(code,{ecmaVersion:'latest',allowAwaitOutsideFunction:true,sourceType:'module'});}catch{return {calls,gaps:['wrapper-parse-failed']};}
  const stack=[ast];let nodes=0;
  while(stack.length){
    const node=stack.pop();if(++nodes>100000)throw new Error('Wrapper AST node budget exceeded');
    if(node.type==='CallExpression'&&node.callee.type==='MemberExpression'&&node.callee.object.type==='Identifier'&&node.callee.object.name==='tools'){
      const name=node.callee.computed?node.callee.property.value:node.callee.property.name;
      try{calls.push({name:String(name),args:literal(node.arguments[0]),offset:node.start});}catch{gaps.push('dynamic-wrapper-argument');}
    }
    for(const value of Object.values(node))if(value&&typeof value==='object'){
      if(Array.isArray(value)){for(let i=value.length-1;i>=0;i--)if(value[i]?.type)stack.push(value[i]);}
      else if(value.type)stack.push(value);
    }
  }
  return {calls,gaps};
}
module.exports={staticWrapperCalls};
