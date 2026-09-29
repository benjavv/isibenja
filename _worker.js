const ENDPOINT = 'https://script.google.com/macros/s/AKfycbwM1Dq6wO_3ns6nJ2e7mYZ_l6wJwtPvS2xsutd5b_R3Br4IamY5k_fs3if4vjlb31zS/exec';
const reply = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/regalos') return env.ASSETS.fetch(request);
    if (request.method !== 'POST') return reply({ ok: false, message: 'Método no permitido.' }, 405);
    const origin = request.headers.get('Origin');
    if (origin && origin !== url.origin) return reply({ ok: false, message: 'Origen no permitido.' }, 403);
    if (!request.headers.get('Content-Type')?.includes('application/json')) {
      return reply({ ok: false, message: 'Formato no válido.' }, 415);
    }
    const body = await request.text();
    if (body.length > 10000) return reply({ ok: false, message: 'El mensaje es demasiado largo.' }, 413);
    let data;
    try { data = JSON.parse(body); }
    catch { return reply({ ok: false, message: 'Formato no válido.' }, 400); }
    const limits = { requestId: 120, experiencia: 160, nombre: 160, mensaje: 1000 };
    const values = {};
    for (const [key, limit] of Object.entries(limits)) {
      if (typeof data?.[key] !== 'string' || !data[key].trim() || data[key].trim().length > limit) {
        return reply({ ok: false, message: 'Revisa tu nombre y mensaje antes de continuar.' }, 400);
      }
      values[key] = data[key].trim();
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);
    try {
      const target = new URL(ENDPOINT);
      target.search = new URLSearchParams({ ...values, formType: 'gift' }).toString();
      const response = await fetch(target, { signal: controller.signal, redirect: 'follow' });
      const result = await response.json();
      if (!response.ok || result?.type !== 'wedding-gift' || result.requestId !== values.requestId || typeof result.ok !== 'boolean') {
        throw new Error('Respuesta sin confirmación');
      }
      return reply({
        type: 'wedding-gift', requestId: values.requestId, ok: result.ok,
        ...(result.ok ? {} : { message: 'No pudimos guardar tu mensaje. Intenta nuevamente.' })
      });
    } catch {
      return reply({
        type: 'wedding-gift', requestId: values.requestId, ok: false,
        message: 'No pudimos confirmar el guardado. Reintenta con el mismo mensaje.'
      }, 502);
    } finally { clearTimeout(timeout); }
  }
};
