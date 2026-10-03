/* PP CORE V2 · núcleo: acceso, menú, conexión e indicador de sincronización.
   Los módulos (Registro del día, Compras, Bitácora...) se agregan por etapas. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var db = window.supabase.createClient(window.PP_CORE_SUPABASE_URL, window.PP_CORE_SUPABASE_KEY,
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  window.ppDb = db;
  var est = { miembro: null, despacho: null, ultimaSync: null, vista: 'home' };

  var AREAS = { home: 'CENTRO DE OPERACIONES', agenda: 'AGENDA',
    projects: 'ÁREA DE CONTROL', logs: 'ÁREA DE CONTROL', purchases: 'ÁREA DE CONTROL', inventory: 'ÁREA DE CONTROL',
    budgets: 'ÁREA DE COSTOS', apu: 'ÁREA DE COSTOS', materials: 'ÁREA DE COSTOS', suppliers: 'ÁREA DE COSTOS',
    dispatch: 'ÁREA ADMINISTRATIVA', people: 'ÁREA ADMINISTRATIVA', clients: 'ÁREA ADMINISTRATIVA',
    payroll: 'ÁREA ADMINISTRATIVA', finance: 'ÁREA ADMINISTRATIVA' };

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ---------- Indicador de sincronización (pastilla arriba + pie lateral) ---------- */
  var pill, pPrim, pSec;
  function pastilla() {
    if (pill) return pill;
    var acc = $('.header-actions'); if (!acc) return null;
    pill = document.createElement('button'); pill.type = 'button'; pill.id = 'cloudAccountStatus';
    pill.className = 'cloud-account-status';
    pill.innerHTML = '<span data-cloud-icon>○</span><span><b data-cloud-primary>Comprobando nube</b><small data-cloud-secondary></small></span>';
    acc.insertBefore(pill, acc.querySelector('.avatar'));
    pPrim = pill.querySelector('[data-cloud-primary]'); pSec = pill.querySelector('[data-cloud-secondary]');
    pill.addEventListener('click', function () {
      if (confirm('¿Cerrar la sesión en este dispositivo?')) db.auth.signOut();
    });
    var st = document.createElement('style');
    st.textContent = '.cloud-account-status{display:flex;align-items:center;gap:8px;max-width:245px;padding:7px 10px;border:1px solid #dfe7e4;border-radius:12px;background:#f4f8f6;color:#17343b;text-align:left;cursor:pointer}.cloud-account-status>span:first-child{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:#dff1ea;color:#08795f;font-weight:900}.cloud-account-status b,.cloud-account-status small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cloud-account-status b{font-size:11px}.cloud-account-status small{font-size:10px;color:#68777a;margin-top:1px}.cloud-account-status.is-error>span:first-child{background:#fde8e8;color:#bd3131}.cloud-account-status.is-saving>span:first-child{background:#fff0d7;color:#a66700}@media(max-width:760px){.cloud-account-status{max-width:142px}.cloud-account-status small{display:none}}';
    document.head.appendChild(st);
    return pill;
  }
  function hora(d) { return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }); }
  function estado(tipo, titulo, detalle) {
    if (!pastilla()) return;
    pill.classList.toggle('is-error', tipo === 'error');
    pill.classList.toggle('is-saving', tipo === 'saving');
    pill.querySelector('[data-cloud-icon]').textContent = tipo === 'saved' ? '✓' : tipo === 'saving' ? '↻' : tipo === 'error' ? '!' : '○';
    pPrim.textContent = titulo; pSec.textContent = detalle || '';
    var pie = $('.side-foot div:last-child');
    if (pie) pie.innerHTML = '<span class="online-dot"></span> ' +
      (tipo === 'saved' ? 'En línea · Sincronizado' : tipo === 'saving' ? 'En línea · Sincronizando' :
       tipo === 'error' ? 'Sin conexión · Reintentando' : 'Comprobando conexión');
  }
  function sincronizado() {
    est.ultimaSync = new Date();
    estado('saved', 'Sincronizado', 'Última sincronización: ' + hora(est.ultimaSync));
  }
  function sinConexion() {
    estado('error', 'Sin conexión', est.ultimaSync ? 'Última sincronización: ' + hora(est.ultimaSync) : 'Reintentando…');
  }
  /* Comprobación de conexión: cada minuto y al recuperar señal (enseguida) */
  async function comprobar() {
    if (!navigator.onLine) { sinConexion(); return false; }
    estado('saving', 'Sincronizando', '');
    var r = await db.from('miembros').select('id', { count: 'exact', head: true });
    if (r.error) { sinConexion(); return false; }
    sincronizado(); return true;
  }
  window.addEventListener('online', function () { if (est.miembro) comprobar().then(function () { render(est.vista); }); });
  window.addEventListener('offline', sinConexion);
  setInterval(function () { if (est.miembro) comprobar(); }, 60000);

  /* ---------- Acceso ---------- */
  var gate = $('#authGate'), form = $('#authForm'), msg = $('#authMessage');
  function aviso(t, ok) { msg.textContent = t || ''; msg.classList.toggle('ok', !!ok); }
  var btnRegistro = $('#signUpButton'); if (btnRegistro) btnRegistro.style.display = 'none'; // registro cerrado
  form.addEventListener('submit', async function (e) {
    e.preventDefault(); aviso('Entrando…', true);
    var d = new FormData(form);
    var r = await db.auth.signInWithPassword({ email: String(d.get('email')).trim(), password: String(d.get('password')) });
    if (r.error) aviso(/invalid/i.test(r.error.message) ? 'Correo o contraseña incorrectos.' : 'No se pudo entrar: ' + r.error.message);
  });
  $('#forgotPasswordButton').addEventListener('click', async function () {
    var email = String(new FormData(form).get('email') || '').trim();
    if (!email) return aviso('Escribe tu correo arriba y vuelve a pulsar «Olvidé mi contraseña».');
    var r = await db.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    aviso(r.error ? 'No se pudo enviar el correo: ' + r.error.message : 'Te enviamos un correo para crear una contraseña nueva.', !r.error);
  });
  db.auth.onAuthStateChange(function (evento, sesion) {
    if (evento === 'PASSWORD_RECOVERY') {
      var p = prompt('Escribe tu nueva contraseña (mínimo 8 caracteres):');
      if (p && p.length >= 8) db.auth.updateUser({ password: p }).then(function (r) { alert(r.error ? 'No se pudo cambiar: ' + r.error.message : 'Contraseña cambiada.'); });
    }
    if (sesion) entrar(); else salir();
  });
  function salir() {
    est.miembro = null; est.despacho = null; gate.hidden = false; form.reset(); aviso('');
  }
  var entrando = false;
  async function entrar() {
    if (entrando || est.miembro) return; entrando = true;
    var r = await db.from('miembros').select('nombre,rol,organizacion_id,organizaciones(nombre)').limit(1);
    entrando = false;
    if (r.error || !r.data || !r.data.length) {
      aviso('Esta cuenta no pertenece a ningún despacho. Pide acceso al director.');
      await db.auth.signOut(); return;
    }
    est.miembro = r.data[0]; est.despacho = r.data[0].organizaciones && r.data[0].organizaciones.nombre;
    gate.hidden = true;
    var av = $('.avatar'); if (av) av.title = est.miembro.nombre + ' · ' + est.miembro.rol;
    sincronizado(); go('home');
  }

  /* ---------- Menú y vistas ---------- */
  function saludo() {
    var h = new Date().getHours(), p = (est.miembro.nombre || '').trim().split(/\s+/);
    var nombre = p.length === 2 ? p[1] : p[0];
    return (h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches') + ', ' + nombre;
  }
  async function cuenta(tabla, filtro) {
    var q = db.from(tabla).select('id', { count: 'exact', head: true });
    if (filtro) q = q.eq(filtro[0], filtro[1]);
    var r = await q; return r.error ? '—' : r.count;
  }
  async function render(vista) {
    var app = $('#app'); if (!est.miembro) return;
    if (vista === 'home') {
      app.innerHTML = '<div class="stats"><div class="card"><div class="stat-label">PROYECTOS ACTIVOS</div><div class="stat-value" id="k1">…</div><span class="change">Obras y servicios</span></div>' +
        '<div class="card"><div class="stat-label">SOLICITUDES POR AUTORIZAR</div><div class="stat-value" id="k2">…</div><span class="change">Material pendiente</span></div>' +
        '<div class="card"><div class="stat-label">PRESUPUESTOS EN REVISIÓN</div><div class="stat-value" id="k3">…</div><span class="change">Sin autorizar</span></div>' +
        '<div class="card"><div class="stat-label">HOJAS DEL DÍA ABIERTAS</div><div class="stat-value" id="k4">…</div><span class="change">Sin cerrar</span></div></div>' +
        '<section class="panel"><h2>Conexión con PP CORE V2</h2><p style="margin:10px 0 0;line-height:1.6">Despacho: <b>' + esc(est.despacho) + '</b> · Rol: <b>' + esc(est.miembro.rol) + '</b><br>' +
        'La nueva versión está conectada a tu base de datos. Los módulos se irán activando por etapas: Registro del día, Compras y Bitácora, y después Costos y Administración.</p></section>';
      var v = await Promise.all([cuenta('proyectos', ['estado', 'activo']), cuenta('solicitudes_compra', ['estado', 'por_autorizar']),
        cuenta('presupuestos', ['estado', 'en_revision']), (async function () {
          var r = await db.from('bitacoras').select('id', { count: 'exact', head: true }).is('cerrada_en', null); return r.error ? '—' : r.count; })()]);
      ['k1', 'k2', 'k3', 'k4'].forEach(function (id, i) { var el = $('#' + id); if (el) el.textContent = v[i]; });
      sincronizado();
    } else {
      var t = $('.nav[data-view="' + vista + '"] span');
      app.innerHTML = '<section class="panel"><div class="empty"><h2>' + esc(t ? t.textContent : vista) + '</h2><p>Este módulo se está reconstruyendo sobre la base nueva.<br>Conserva el mismo aspecto y flujo; se activará en su etapa.</p></div></section>';
    }
  }
  function go(vista) {
    if (!est.miembro) return;
    est.vista = vista;
    document.querySelectorAll('#navigation .nav').forEach(function (b) { b.classList.toggle('active', b.dataset.view === vista); });
    $('#crumb').textContent = AREAS[vista] || 'PP CORE';
    var t = $('.nav[data-view="' + vista + '"] span');
    $('#pageTitle').textContent = vista === 'home' ? saludo() : (t ? t.textContent : '');
    $('#sidebar').classList.remove('open');
    render(vista);
  }
  window.navigate = go;
  $('#navigation').addEventListener('click', function (e) { var b = e.target.closest('.nav'); if (b) go(b.dataset.view); });
  $('#menuButton').onclick = function () { $('#sidebar').classList.toggle('open'); };
  var ex = $('#exportButton'); if (ex) ex.onclick = function () { alert('El respaldo de datos se reconstruye en una etapa posterior. Tus datos ya están guardados en la nube.'); };

  /* ---------- Inicio ---------- */
  gate.hidden = false;
  estado('idle', 'Comprobando nube', '');
  db.auth.getSession().then(function (r) { if (!r.data.session) { gate.hidden = false; estado('error', 'Sin sesión', 'Inicia sesión'); } });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(function () {});
})();
