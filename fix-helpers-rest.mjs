import fs from 'fs';
const PATH = 'c:/Users/Salvo/Desktop/vectork-ia/maquina-de-prospeccion/workflow-server-full.json';
const w = JSON.parse(fs.readFileSync(PATH, 'utf8'));

const SB = 'https://azqtuvgtmmswvqgyrvct.supabase.co';
const SK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6cXR1dmd0bW1zd3ZxZ3lydmN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NTQ4NjEsImV4cCI6MjA5MTUzMDg2MX0.YRPD8A5SUcJt0EG7tZU-Q9EUzx8RT5RwbRe_jCVO-OQ';

// ============================================
// Code in JavaScript (LinkedIn parser) — use this.helpers.httpRequest
// ============================================
const li = w.nodes.find(n => n.name === 'Code in JavaScript');
li.parameters.jsCode = `const items = $input.all();
const apolloItems = $('LinkedIn URLs1').all();
const SB = '${SB}';
const SK = '${SK}';
const headers = { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' };

const results = [];
const errors = [];

for (let i = 0; i < items.length; i++) {
  const liRaw = Array.isArray(items[i].json) ? items[i].json[0] : items[i].json;
  const liData0 = liRaw || {};
  const apollo = apolloItems[i]?.json || {};
  const leadDbId = apollo.lead_db_id || '';

  const exp = Array.isArray(liData0.experience)
    ? liData0.experience.slice(0,5).map(e => (e.title||'') + ' en ' + (e.companyName||'') + ' (' + (e.duration||'') + ')').join(' | ')
    : '';
  const edu = Array.isArray(liData0.education)
    ? liData0.education.slice(0,3).map(e => (e.degreeName||'') + ' ' + (e.fieldOfStudy||'') + ' - ' + (e.schoolName||'')).join(' | ')
    : '';
  const skills = Array.isArray(liData0.skills)
    ? liData0.skills.map(s => typeof s === 'string' ? s : s.name || '').join(', ')
    : '';
  const courses = Array.isArray(liData0.courses)
    ? liData0.courses.map(c => typeof c === 'string' ? c : c.name || '').join(', ')
    : '';
  const projects = Array.isArray(liData0.projects)
    ? liData0.projects.map(p => (p.title||'') + ': ' + (p.description||'')).join(' | ')
    : '';
  const pubs = Array.isArray(liData0.publications)
    ? liData0.publications.map(p => (p.name || p.title || '')).join(', ')
    : '';
  const curPos = Array.isArray(liData0.experience) && liData0.experience.length > 0
    ? (liData0.experience[0].title||'') + ' en ' + (liData0.experience[0].companyName||'')
    : '';

  const payload = {
    lead_id: leadDbId || null,
    linkedin_public_id: apollo.linkedinPublicIdentifier || '',
    linkedin_location: liData0.locationName || liData0.geoLocationName || liData0.location || '',
    headline: liData0.headline || '',
    summary: liData0.about || liData0.summary || '',
    experiencia: exp,
    educacion: edu,
    skills: skills,
    ubicacion: liData0.location || liData0.geoLocationName || '',
    conexiones: parseInt(liData0.connectionsCount) || null,
    seguidores: parseInt(liData0.followerCount || liData0.followersCount) || null,
    open_to_work: liData0.isOpenToWork || liData0.openToWork || false,
    courses: courses || null,
    hiring: liData0.isHiring || false,
    current_position: curPos || null,
    projects: projects || null,
    publications: pubs || null,
    recent_news: liData0.recentNews || null
  };

  if (leadDbId) {
    try {
      await this.helpers.httpRequest({
        method: 'POST',
        url: SB + '/rest/v1/leads_linkedin',
        headers,
        body: payload,
        json: true
      });
    } catch (e) {
      errors.push({ lead_db_id: leadDbId, err: e.message || String(e) });
    }
  }

  results.push({ json: {
    'Apollo ID': apollo['Apollo ID'] || '',
    lead_db_id: leadDbId,
    'LI Headline': payload.headline,
    'LI Summary': payload.summary,
    'LI Experiencia': exp,
    'LI Educación': edu,
    'LI Skills': skills,
    'LI Ubicación': payload.ubicacion,
    'LI Conexiones': String(payload.conexiones || ''),
    'LI Seguidores': String(payload.seguidores || ''),
    'LI Open to Work': payload.open_to_work,
    'LI Courses': courses,
    'LI Current Position': curPos,
    'LI Projects': projects,
    'LI Publications': pubs,
    'LI Hiring': payload.hiring,
    'LI Recent News': payload.recent_news,
    _errors: errors
  }});
}
return results;`;

// ============================================
// Preparar Data para Agentes1 — use this.helpers.httpRequest
// ============================================
const pa = w.nodes.find(n => n.name === 'Preparar Data para Agentes1');
pa.parameters.jsCode = `const items = $input.all();
const sol = $('Preparar1').first().json;
const SB = '${SB}';
const SK = '${SK}';
const headers = { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' };

const results = [];
const errors = [];

for (const item of items) {
  const d = item.json;
  const perfil = '=== DATOS DEL PROSPECTO ===\\n' +
    'Nombre: ' + (d.nombre||d.Nombre||'') + ' ' + (d.apellido||d.Apellido||'') + '\\n' +
    'Cargo: ' + (d.cargo||d.Cargo||'') + '\\n' +
    'Headline: ' + (d.headline||d.Headline||'') + '\\n' +
    'Seniority: ' + (d.seniority||d.Seniority||'') + '\\n\\n' +
    'Empresa: ' + (d.empresa||d.Empresa||'') + '\\n' +
    'Industria: ' + (d.industria_empresa||'') + '\\n' +
    'Tamaño: ' + (d.tamano_empresa||'') + ' empleados\\n' +
    'Website: ' + (d.website_empresa||'') + '\\n' +
    'Keywords web: ' + ((d.org_keywords||[]).join(', ')) + '\\n' +
    'Descripción: ' + (d.org_short_description||'') + '\\n' +
    'Tecnologías: ' + ((d.org_technology_names||[]).join(', ')) + '\\n\\n' +
    'Ciudad: ' + (d.ciudad||d.Ciudad||'') + '\\n' +
    'País: ' + (d.pais||d['País']||'Chile') + '\\n' +
    'LinkedIn: ' + (d.linkedin_url||d['LinkedIn URL']||'') + '\\n' +
    'Email: ' + (d.email||d.Email||'') + '\\n' +
    'Teléfono: ' + (d.telefono||'') + '\\n\\n' +
    '=== PERFIL LINKEDIN ===\\n' +
    'Headline LI: ' + (d['LI Headline']||'N/A') + '\\n' +
    'Summary: ' + (d['LI Summary']||'N/A') + '\\n' +
    'Experiencia: ' + (d['LI Experiencia']||'N/A') + '\\n' +
    'Educación: ' + (d['LI Educación']||'N/A') + '\\n' +
    'Skills: ' + (d['LI Skills']||'N/A') + '\\n' +
    'Cursos: ' + (d['LI Courses']||'N/A') + '\\n' +
    'Proyectos: ' + (d['LI Projects']||'N/A') + '\\n' +
    'Publicaciones: ' + (d['LI Publications']||'N/A') + '\\n' +
    'Conexiones: ' + (d['LI Conexiones']||'N/A') + '\\n' +
    'Seguidores: ' + (d['LI Seguidores']||'N/A') + '\\n' +
    'Open to Work: ' + (d['LI Open to Work']||false) + '\\n' +
    'Hiring: ' + (d['LI Hiring']||false) + '\\n' +
    'Recent News: ' + (d['LI Recent News']||'N/A') + '\\n\\n' +
    '=== CONTEXTO SOLICITANTE ===\\n' +
    'Organización: ' + (sol.input?.organizacion||'') + '\\n' +
    'Solución: ' + (sol.contexto?.solucion||'') + '\\n' +
    'Problema: ' + (sol.contexto?.problema_resuelve||'') + '\\n' +
    'Casos éxito: ' + (sol.contexto?.casos_exito||'') + '\\n' +
    'Diferenciador: ' + (sol.contexto?.diferenciador||'');

  if (d.lead_db_id) {
    try {
      await this.helpers.httpRequest({
        method: 'POST',
        url: SB + '/rest/v1/leads_agentes',
        headers,
        body: { lead_id: d.lead_db_id, perfil_para_agente: perfil, status: 'pending' },
        json: true
      });
    } catch (e) {
      errors.push({ lead_db_id: d.lead_db_id, err: e.message || String(e) });
    }
  }
  results.push({ json: { ...d, perfilParaAgente: perfil, _agent_errors: errors } });
}

try {
  if (sol.solicitudId) {
    await this.helpers.httpRequest({
      method: 'PATCH',
      url: SB + '/rest/v1/solicitudes_leads?id=eq.' + sol.solicitudId,
      headers,
      body: { status: 'completed', leads_found: results.length, processed_at: new Date().toISOString() },
      json: true
    });
  }
} catch (e) { errors.push({ step: 'patch_solicitud', err: e.message }); }

return results;`;

fs.writeFileSync(PATH, JSON.stringify(w, null, 2));
console.log('LinkedIn parser + Preparar Data para Agentes1 converted to this.helpers.httpRequest');
