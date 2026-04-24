import fs from 'fs';
const PATH = 'c:/Users/Salvo/Desktop/vectork-ia/maquina-de-prospeccion/workflow-server-full.json';
const w = JSON.parse(fs.readFileSync(PATH, 'utf8'));

const c = w.nodes.find(n => n.name === 'Combinar Apollo + LinkedIn1');
if (c) {
  c.parameters = {
    mode: 'combineByPosition',
    options: {}
  };
  console.log('Combinar Apollo + LinkedIn1 → combineByPosition');
}

// Also guard UPDATE leads_agentes1: skip if lead_db_id empty via IF-alike
// Add alwaysOutputData + onError continueRegularOutput, so empty-uuid doesn't kill workflow
const up = w.nodes.find(n => n.name === 'UPDATE leads_agentes1');
if (up) {
  up.onError = 'continueRegularOutput';
  up.alwaysOutputData = true;
  console.log('UPDATE leads_agentes1 → continueRegularOutput');
}

fs.writeFileSync(PATH, JSON.stringify(w, null, 2));
console.log('done');
