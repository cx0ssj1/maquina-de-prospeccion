import fs from 'fs';
const PATH = 'c:/Users/Salvo/Desktop/vectork-ia/maquina-de-prospeccion/workflow-server-full.json';
const w = JSON.parse(fs.readFileSync(PATH, 'utf8'));

for (const name of ['Code in JavaScript', 'Preparar Data para Agentes1']) {
  const n = w.nodes.find(x => x.name === name);
  if (!n) continue;
  let c = n.parameters.jsCode;
  const before = c;
  // Fix broken pattern: fetch(...) })});}catch  ->  fetch(...) });}catch
  c = c.replace(/\}\s*\)\s*\}\s*\)\s*;\s*\}\s*catch/g, '});}catch');
  // Also handle variant with space/newline
  c = c.replace(/\}\)\}\);\}catch/g, '});}catch');
  n.parameters.jsCode = c;
  console.log(name, 'changed:', before !== c);
}

fs.writeFileSync(PATH, JSON.stringify(w, null, 2));

// verify
const w2 = JSON.parse(fs.readFileSync(PATH, 'utf8'));
for (const name of ['Code in JavaScript', 'Preparar Data para Agentes1']) {
  const c = w2.nodes.find(x => x.name === name).parameters.jsCode;
  console.log('---', name);
  const bad = c.match(/\}\s*\)\s*\}\s*\)/g);
  console.log('bad sequences remaining:', bad ? bad.length : 0);
  // Syntax test
  try {
    new Function('$input','$node','fetch', 'return (async ()=>{ ' + c + ' })()');
    console.log('SYNTAX OK');
  } catch(e) {
    console.log('SYNTAX ERR:', e.message);
  }
}
