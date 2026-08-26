const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const GOOGLE_CLIENT_ID = '977641517971-23ouv33lu4s8ejrm6m4mgvuqcvpa9ucf.apps.googleusercontent.com';

function json(data, status = 200) {
  return Response.json(data, { status, headers: CORS });
}

async function verifyGoogleToken(token) {
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.aud !== GOOGLE_CLIENT_ID) return null;
    if (data.exp < Math.floor(Date.now() / 1000)) return null;
    return { sub: data.sub, email: data.email, name: data.name, picture: data.picture };
  } catch {
    return null;
  }
}

function parseJson(text, fallback) {
  try { const v = JSON.parse(text); return v == null ? fallback : v; } catch { return fallback; }
}

async function getOrCreateUser(env, user) {
  let row = await env.DB.prepare('SELECT liga_data, ligas_data FROM user_data WHERE google_sub = ?')
    .bind(user.sub).first();

  if (!row) {
    const empty = JSON.stringify({ jugadores: {}, sesiones: [] });
    await env.DB.prepare(
      'INSERT INTO user_data (google_sub, email, name, picture, liga_data, ligas_data, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(user.sub, user.email, user.name, user.picture || '', empty, '', Date.now()).run();
    return { ligaData: { jugadores: {}, sesiones: [] }, ligasData: null };
  }

  return {
    ligaData: parseJson(row.liga_data, { jugadores: {}, sesiones: [] }),
    ligasData: row.ligas_data ? parseJson(row.ligas_data, null) : null,
  };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const url = new URL(request.url);

    // POST /api/auth — verifica Google credential, devuelve user + ligaData + ligasData
    if (url.pathname === '/api/auth' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'Bad request' }, 400); }

      const user = await verifyGoogleToken(body.credential);
      if (!user) return json({ error: 'Token inválido' }, 401);

      const datos = await getOrCreateUser(env, user);
      return json({ ok: true, user, ligaData: datos.ligaData, ligasData: datos.ligasData });
    }

    // POST /api/sync — guarda ligaData (y ligasData si el cliente la manda).
    // ligasData es opcional para no romper clientes viejos: si no viene,
    // se conserva la que ya está guardada.
    if (url.pathname === '/api/sync' && request.method === 'POST') {
      const auth = request.headers.get('Authorization') || '';
      if (!auth.startsWith('Bearer ')) return json({ error: 'Sin autenticación' }, 401);

      const user = await verifyGoogleToken(auth.slice(7));
      if (!user) return json({ error: 'Token inválido' }, 401);

      let body;
      try { body = await request.json(); } catch { return json({ error: 'Bad request' }, 400); }

      if (body.ligasData !== undefined) {
        await env.DB.prepare(
          'UPDATE user_data SET liga_data = ?, ligas_data = ?, email = ?, name = ?, picture = ?, updated_at = ? WHERE google_sub = ?'
        ).bind(JSON.stringify(body.ligaData), JSON.stringify(body.ligasData), user.email, user.name, user.picture || '', Date.now(), user.sub).run();
      } else {
        await env.DB.prepare(
          'UPDATE user_data SET liga_data = ?, email = ?, name = ?, picture = ?, updated_at = ? WHERE google_sub = ?'
        ).bind(JSON.stringify(body.ligaData), user.email, user.name, user.picture || '', Date.now(), user.sub).run();
      }

      return json({ ok: true });
    }

    return json({ error: 'Not found' }, 404);
  },
};
