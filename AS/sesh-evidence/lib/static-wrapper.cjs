const acorn=require('acorn');
function literal(node,constants=new Map(),depth=0) {
  if(depth>50)throw new Error('Static literal depth budget');
  const read=n=>literal(n,constants,depth+1);
  if(!node)throw new Error('Missing argument');
  if(node.type==='Identifier'&&constants.has(node.name))return constants.get(node.name);
  if(node.type==='Literal')return node.value;
  if(node.type==='TemplateLiteral'){
    let text=node.quasis[0].value.cooked;
    for(let i=0;i<node.expressions.length;i++){const v=read(node.expressions[i]);if(!['string','number','boolean'].includes(typeof v))throw new Error('Nonprimitive interpolation');text+=String(v)+node.quasis[i+1].value.cooked;}
    return text;
  }
  if(node.type==='BinaryExpression'&&node.operator==='+'){const a=read(node.left),b=read(node.right);if(!['string','number'].includes(typeof a)||!['string','number'].includes(typeof b))throw new Error('Nonprimitive concatenation');return a+b;}
  if(node.type==='ArrayExpression')return node.elements.map(read);
  if(node.type==='ObjectExpression'){
    const value=Object.create(null);
    for(const p of node.properties){if(p.type!=='Property'||p.computed||p.kind!=='init')throw new Error('Dynamic object');value[p.key.name??p.key.value]=read(p.value);}
    return value;
  }
  throw new Error('Dynamic expression');
}
function staticWrapperCalls(code) {
  const calls=[],gaps=[];
  let ast;
  try{ast=acorn.parse(code,{ecmaVersion:'latest',allowAwaitOutsideFunction:true,sourceType:'module'});}catch{return {calls,gaps:['wrapper-parse-failed']};}
  // Resolve only unique top-level const bindings composed of literals. Calls are never evaluated.
  const declarations=new Map(),blocked=new Set(),counts=new Map();
  const inventory=[ast];
  while(inventory.length){const n=inventory.pop();if(n.type==='VariableDeclarator'&&n.id.type==='Identifier')counts.set(n.id.name,(counts.get(n.id.name)||0)+1);
    if((n.type==='AssignmentExpression'||n.type==='UpdateExpression')&&(n.left||n.argument)?.type==='Identifier')blocked.add((n.left||n.argument).name);
    if(/Function/.test(n.type))for(const p of n.params||[])if(p.type==='Identifier')blocked.add(p.name);
    for(const v of Object.values(n))if(v&&typeof v==='object'){if(Array.isArray(v)){for(const x of v)if(x?.type)inventory.push(x);}else if(v.type)inventory.push(v);}}
  for(const n of ast.body)if(n.type==='VariableDeclaration'&&n.kind==='const')for(const d of n.declarations)if(d.id.type==='Identifier'&&counts.get(d.id.name)===1&&!blocked.has(d.id.name))declarations.set(d.id.name,d.init);
  const constants=new Map();for(let pass=0;pass<10;pass++){let changed=false;for(const [name,node] of declarations)if(!constants.has(name)){try{constants.set(name,literal(node,constants));changed=true;}catch{}}if(!changed)break;}
  const stack=[ast];let nodes=0;
  while(stack.length){
    const node=stack.pop();if(++nodes>100000)throw new Error('Wrapper AST node budget exceeded');
    if(node.type==='CallExpression'&&node.callee.type==='MemberExpression'&&node.callee.object.type==='Identifier'&&node.callee.object.name==='tools'){
      const name=node.callee.computed?node.callee.property.value:node.callee.property.name;
      try{calls.push({name:String(name),args:literal(node.arguments[0],constants),offset:node.start});}catch{gaps.push('dynamic-wrapper-argument');}
    }
    for(const value of Object.values(node))if(value&&typeof value==='object'){
      if(Array.isArray(value)){for(let i=value.length-1;i>=0;i--)if(value[i]?.type)stack.push(value[i]);}
      else if(value.type)stack.push(value);
    }
  }
  return {calls,gaps};
}
module.exports={staticWrapperCalls};
