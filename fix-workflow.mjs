import fs from 'fs';

const PATH = 'c:/Users/Salvo/Desktop/vectork-ia/maquina-de-prospeccion/workflow-server-full.json';
const w = JSON.parse(fs.readFileSync(PATH, 'utf8'));

const SB_URL = 'https://azqtuvgtmmswvqgyrvct.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6cXR1dmd0bW1zd3ZxZ3lydmN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NTQ4NjEsImV4cCI6MjA5MTUzMDg2MX0.YRPD8A5SUcJt0EG7tZU-Q9EUzx8RT5RwbRe_jCVO-OQ';

function findNode(name) {
  return w.nodes.find(n => n.name === name);
}

// ============================================
// 1. Preparar1 — rewrite with fetch
// ============================================
const preparar = findNode('Preparar1');
if (preparar) {
  preparar.parameters.jsCode = `const body = $input.first().json.body || $input.first().json;
const input = body.record || body;
const solicitudId = input.id || null;

const SB = '${SB_URL}';
const SK = '${SB_KEY}';
const h = { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };

let organizacionId = input.organizacion_id || null;
if (!organizacionId && input.organizacion) {
  try {
    const r = await fetch(SB + '/rest/v1/organizaciones', {
      method: 'POST',
      headers: { ...h, 'Prefer': 'return=representation,resolution=merge-duplicates' },
      body: JSON.stringify({
        nombre: input.organizacion || 'Sin nombre',
        industria: input.industry || null,
        pais: input.company_country || input.person_country || null
      })
    });
    const j = await r.json();
    organizacionId = (Array.isArray(j) ? j[0] : j)?.id || null;
  } catch (e) {}
}

if (solicitudId && organizacionId) {
  try {
    await fetch(SB + '/rest/v1/solicitudes_leads?id=eq.' + solicitudId, {
      method: 'PATCH',
      headers: h,
      body: JSON.stringify({ organizacion_id: organizacionId, status: 'processing' })
    });
  } catch (e) {}
}

const base = 'https://api.apollo.io/api/v1/mixed_people/api_search';
const parts = [];
const enc = encodeURIComponent;
const add = (k, v) => { if (v !== null && v !== undefined && v !== '') parts.push(enc(k) + '=' + enc(String(v))); };

add('per_page', input.max_results || input.cantidad_leads || 25);

const titles = [...(input.job_titles || []), ...(input.titulos_adicionales || [])];
titles.forEach(t => add('person_titles[]', t));
(input.seniority || []).forEach(s => add('person_seniorities[]', s));
(input.departments || []).forEach(d => add('person_departments[]', d));

if (input.person_country) add('person_locations[]', input.person_country);
if (input.company_name) add('q_organization_name', input.company_name);
if (input.company_country) add('organization_locations[]', input.company_country);
if (input.company_city) add('organization_locations[]', input.company_city);
if (input.employee_min && input.employee_max) {
  add('organization_num_employees_ranges[]', input.employee_min + ',' + input.employee_max);
}
(input.keywords || []).forEach(k => add('q_keywords', k));

const apolloUrl = base + '?' + parts.join('&');

return [{
  json: {
    solicitudId,
    organizacionId,
    apolloUrl,
    input,
    contexto: {
      solucion: input.solucion,
      problema_resuelve: input.problema_resuelve,
      casos_exito: input.casos_exito,
      diferenciador: input.diferenciador
    }
  }
}];`;
  console.log('[OK] Preparar1 rewritten');
}

// ============================================
// 2. Procesar Datos Apollo — rewrite with fetch
// ============================================
const procesar = findNode('Procesar Datos Apollo');
if (procesar) {
  procesar.parameters.jsCode = `const items = $input.all();
const prep = $('Preparar1').first().json;
const solicitudId = prep.solicitudId;
const organizacionId = prep.organizacionId;

const SB = '${SB_URL}';
const SK = '${SB_KEY}';
const h = { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };

const results = [];

for (const item of items) {
  const data = item.json;
  const person = data.person || data;
  if (!person || !person.id) continue;

  let linkedinUrl = person.linkedin_url || '';
  if (linkedinUrl && linkedinUrl.startsWith('http://')) {
    linkedinUrl = linkedinUrl.replace('http://', 'https://');
  }
  if (linkedinUrl && !linkedinUrl.includes('linkedin.com')) linkedinUrl = '';

  const org = person.organization || {};

  const leadData = {
    solicitud_id: solicitudId,
    organizacion_id: organizacionId,
    apollo_id: person.id,
    nombre: person.first_name || null,
    apellido: person.last_name || null,
    cargo: person.title || null,
    headline: person.headline || null,
    seniority: person.seniority || null,
    departamentos: (person.departments || []).join(', ') || null,
    linkedin_url: linkedinUrl || null,
    email: person.email || null,
    email_status: person.email_status || null,
    telefono: (person.phone_numbers && person.phone_numbers[0]?.raw_number) || null,
    ciudad: person.city || null,
    estado_region: person.state || null,
    pais: person.country || null,
    foto_url: person.photo_url || null,
    empresa: org.name || null,
    industria_empresa: org.industry || null,
    tamano_empresa: org.estimated_num_employees || null,
    website_empresa: org.website_url || null,
    linkedin_empresa: org.linkedin_url || null,
    org_keywords: org.keywords || null,
    org_short_description: org.short_description || null,
    org_technology_names: org.technology_names || null
  };

  let leadDbId = '';
  try {
    const r = await fetch(SB + '/rest/v1/leads', {
      method: 'POST',
      headers: h,
      body: JSON.stringify(leadData)
    });
    const j = await r.json();
    leadDbId = (Array.isArray(j) ? j[0] : j)?.id || '';
  } catch (e) {}

  results.push({
    json: {
      lead_db_id: leadDbId,
      apollo_id: person.id,
      nombre: person.first_name,
      apellido: person.last_name,
      nombre_completo: (person.first_name || '') + ' ' + (person.last_name || ''),
      cargo: person.title,
      linkedin_url: linkedinUrl,
      email: person.email,
      empresa: org.name,
      ...leadData
    }
  });
}

return results;`;
  console.log('[OK] Procesar Datos Apollo rewritten');
}

// ============================================
// 3. Code in JavaScript (LinkedIn parser) — replace $helpers with fetch
// ============================================
const liParser = findNode('Code in JavaScript');
if (liParser && liParser.parameters.jsCode) {
  let code = liParser.parameters.jsCode;
  // Replace any $helpers.httpRequest pattern for leads_linkedin POST
  code = code.replace(
    /\}\s*\)\s*\}\s*\)\s*;\s*\}\s*catch/g,
    '});}catch'
  );
  liParser.parameters.jsCode = code;
  console.log('[OK] Code in JavaScript patched');
}

// ============================================
// 4. Preparar Data para Agentes1 — replace $helpers with fetch
// ============================================
const prepAgentes = findNode('Preparar Data para Agentes1');
if (prepAgentes && prepAgentes.parameters.jsCode) {
  let code = prepAgentes.parameters.jsCode;
  // Replace all $helpers.httpRequest calls generically — will need manual review if complex
  // Find patterns for leads_agentes INSERT and solicitudes PATCH
  code = code.replace(
    /await\s+\$helpers\.httpRequest\s*\(\s*\{[\s\S]*?url:[^,]*leads_agentes[^,]*,[\s\S]*?\}\s*\)/g,
    `await fetch(SB + '/rest/v1/leads_agentes', { method: 'POST', headers: h, body: JSON.stringify({ lead_id: d.lead_db_id, perfil_para_agente: perfil, status: 'pending' }) })`
  );
  code = code.replace(
    /await\s+\$helpers\.httpRequest\s*\(\s*\{[\s\S]*?url:[^,]*solicitudes_leads[^,]*,[\s\S]*?\}\s*\)/g,
    `await fetch(SB + '/rest/v1/solicitudes_leads?id=eq.' + sol.solicitudId, { method: 'PATCH', headers: h, body: JSON.stringify({ status: 'completed', leads_found: results.length, processed_at: new Date().toISOString() }) })`
  );
  prepAgentes.parameters.jsCode = code;
  console.log('[OK] Preparar Data para Agentes1 patched');
}

// ============================================
// 5. Merge1 — set mode to append
// ============================================
const merge = findNode('Merge1');
if (merge) {
  merge.parameters = merge.parameters || {};
  merge.parameters.mode = 'append';
  console.log('[OK] Merge1.mode = append');
}

// ============================================
// 6. Delete Enriquecer Lead + Execute Workflow Trigger
// ============================================
const toDelete = ['Enriquecer Lead (Paralelo)1', 'Execute Workflow Trigger'];
const beforeCount = w.nodes.length;
w.nodes = w.nodes.filter(n => !toDelete.includes(n.name));
for (const name of toDelete) {
  delete w.connections[name];
}
// Also remove any connections pointing TO deleted nodes
for (const src of Object.keys(w.connections)) {
  const srcConn = w.connections[src];
  for (const type of Object.keys(srcConn)) {
    srcConn[type] = srcConn[type].map(arr =>
      arr.filter(c => !toDelete.includes(c.node))
    );
  }
}
console.log('[OK] Deleted ' + (beforeCount - w.nodes.length) + ' nodes');

// ============================================
// 7. Connect Preparar Data para Agentes1 -> Extraer Campos1
// ============================================
const extraer = findNode('Extraer Campos1');
if (extraer && findNode('Preparar Data para Agentes1')) {
  w.connections['Preparar Data para Agentes1'] = {
    main: [[{ node: 'Extraer Campos1', type: 'main', index: 0 }]]
  };
  console.log('[OK] Preparar Data para Agentes1 -> Extraer Campos1');
}

fs.writeFileSync(PATH, JSON.stringify(w, null, 2));
console.log('\nDone. Nodes: ' + w.nodes.length);
