import fs from 'fs';
const PATH = 'c:/Users/Salvo/Desktop/vectork-ia/maquina-de-prospeccion/workflow-server-full.json';
const w = JSON.parse(fs.readFileSync(PATH, 'utf8'));

const OLD = "LinkedIn url's1";
const NEW = "LinkedIn URLs1";

// Rename node
const n = w.nodes.find(x => x.name === OLD);
if (n) { n.name = NEW; console.log('node renamed'); }

// Update connections keys
if (w.connections[OLD]) {
  w.connections[NEW] = w.connections[OLD];
  delete w.connections[OLD];
}
// Update connection targets
for (const src of Object.keys(w.connections)) {
  const sc = w.connections[src];
  for (const type of Object.keys(sc)) {
    for (const arr of sc[type]) {
      for (const c of arr) {
        if (c.node === OLD) c.node = NEW;
      }
    }
  }
}

// Update references in jsCode of all code nodes
let refFixed = 0;
for (const node of w.nodes) {
  if (node.parameters && node.parameters.jsCode) {
    const before = node.parameters.jsCode;
    let code = before;
    // $('LinkedIn url\'s1') or $("LinkedIn url's1")
    code = code.replace(/\$\(\s*'LinkedIn url\\?'s1'\s*\)/g, `$('${NEW}')`);
    code = code.replace(/\$\(\s*"LinkedIn url's1"\s*\)/g, `$("${NEW}")`);
    // $node['LinkedIn url\'s1'] or $node["LinkedIn url's1"]
    code = code.replace(/\$node\[\s*'LinkedIn url\\?'s1'\s*\]/g, `$node['${NEW}']`);
    code = code.replace(/\$node\[\s*"LinkedIn url's1"\s*\]/g, `$node["${NEW}"]`);
    if (code !== before) {
      node.parameters.jsCode = code;
      refFixed++;
      console.log('refs fixed in', node.name);
    }
  }
}
console.log('total code nodes with refs fixed:', refFixed);

fs.writeFileSync(PATH, JSON.stringify(w, null, 2));

// Verify
const w2 = JSON.parse(fs.readFileSync(PATH, 'utf8'));
const still = JSON.stringify(w2).match(/LinkedIn url['\\]*s1/g);
console.log('leftover OLD refs:', still ? still.length : 0);
