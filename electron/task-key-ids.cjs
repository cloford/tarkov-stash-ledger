const validItemId=value=>typeof value==="string"&&/^[a-f0-9]{24}$/i.test(value);

function collectArrayIds(value,add){
  if(validItemId(value)){add(value);return}
  if(Array.isArray(value))for(const entry of value)collectArrayIds(entry,add);
}

function collectTaskKeyIds(task){
  const result=[],seen=new Set(),add=id=>{if(!seen.has(id)){seen.add(id);result.push(id)}};
  const neededKeys=Array.isArray(task?.neededKeys)?task.neededKeys:[];
  for(const needed of neededKeys)collectArrayIds(needed?.keys,add);
  const objectives=Array.isArray(task?.objectives)?task.objectives:[];
  for(const objective of objectives)collectArrayIds(objective?.requiredKeys,add);
  return result;
}

module.exports={collectTaskKeyIds};
