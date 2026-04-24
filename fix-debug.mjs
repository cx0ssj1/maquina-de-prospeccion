import fs from 'fs';
const PATH = 'c:/Users/Salvo/Desktop/vectork-ia/maquina-de-prospeccion/workflow-server-full.json';
const w = JSON.parse(fs.readFileSync(PATH, 'utf8'));

const SB = 'https://azqtuvgtmmswvqgyrvct.supabase.co';
const SK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6cXR1dmd0bW1zd3ZxZ3lydmN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NTQ4NjEsImV4cCI6MjA5MTUzMDg2MX0.YRPD8A5SUcJt0EG7tZU-Q9EUzx8RT5RwbRe_jCVO-OQ';

// Preparar1: use this.helpers.httpRequest (n8n built-in), surface errors
const p = w.nodes.find(n => n.name === 'Preparar1');
p.parameters.jsCode = `const body = $input.first().json.body || $input.first().json;
const input = body.record || body;
const solicitudId = input.id || null;

const SB = '${SB}';
const SK = '${SK}';

const debug = { fetchAvailable: typeof fetch, helpersAvailable: typeof this.helpers };
let organizacionId = input.organizacion_id || null;
let orgError = null;

if (!organizacionId && input.organizacion) {
  try {
    const resp = await this.helpers.httpRequest({
      method: 'POST',
      url: SB + '/rest/v1/organizaciones',
      headers: {
        apikey: SK,
        Authorization: 'Bearer ' + SK,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation,resolution=merge-duplicates'
      },
      body: {
        nombre: input.organizacion || 'Sin nombre',
        industria: input.industry || null,
        pais: input.company_country || input.person_country || null
      },
      json: true
    });
    organizacionId = (Array.isArray(resp) ? resp[0] : resp)?.id || null;
  } catch (e) {
    orgError = e.message || String(e);
  }
}

let patchError = null;
if (solicitudId && organizacionId) {
  try {
    await this.helpers.httpRequest({
      method: 'PATCH',
      url: SB + '/rest/v1/solicitudes_leads?id=eq.' + solicitudId,
      headers: {
        apikey: SK,
        Authorization: 'Bearer ' + SK,
        'Content-Type': 'application/json'
      },
      body: { organizacion_id: organizacionId, status: 'processing' },
      json: true
    });
  } catch (e) {
    patchError = e.message || String(e);
  }
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
if (input.employee_min && input.employee_max) add('organization_num_employees_ranges[]', input.employee_min + ',' + input.employee_max);
(input.keywords || []).forEach(k => add('q_keywords', k));
const apolloUrl = base + '?' + parts.join('&');

return [{
  json: {
    solicitudId,
    organizacionId,
    apolloUrl,
    _debug: debug,
    _orgError: orgError,
    _patchError: patchError,
    input,
    contexto: {
      solucion: input.solucion,
      problema_resuelve: input.problema_resuelve,
      casos_exito: input.casos_exito,
      diferenciador: input.diferenciador
    }
  }
}];`;

// Procesar Datos Apollo: use this.helpers.httpRequest
const pd = w.nodes.find(n => n.name === 'Procesar Datos Apollo');
pd.parameters.jsCode = `const items = $input.all();
const prep = $('Preparar1').first().json;
const solicitudId = prep.solicitudId;
const organizacionId = prep.organizacionId;

const SB = '${SB}';
const SK = '${SK}';
const headers = { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };

const results = [];
const errors = [];

for (const item of items) {
  const data = item.json;
  const person = data.person || data;
  if (!person || !person.id) continue;

  let linkedinUrl = person.linkedin_url || '';
  if (linkedinUrl && linkedinUrl.startsWith('http://')) linkedinUrl = linkedinUrl.replace('http://', 'https://');
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
    const resp = await this.helpers.httpRequest({
      method: 'POST',
      url: SB + '/rest/v1/leads',
      headers,
      body: leadData,
      json: true
    });
    leadDbId = (Array.isArray(resp) ? resp[0] : resp)?.id || '';
  } catch (e) {
    errors.push({ apollo_id: person.id, err: e.message || String(e) });
  }

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
      _errors: errors,
      ...leadData
    }
  });
}

return results;`;

fs.writeFileSync(PATH, JSON.stringify(w, null, 2));
console.log('Preparar1 and Procesar Datos Apollo now use this.helpers.httpRequest with error surfacing');
