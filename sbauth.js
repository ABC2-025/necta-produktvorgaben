/* ABC Kochwerk – Login-Schutz (Supabase Auth, E-Mail + Passwort)
 * Einbinden im <head> VOR den App-Skripten:
 *   <script src="/necta-produktvorgaben/sbauth.js"></script>
 * Setzt window.SB_TOKEN (Nutzer-Token nach Login, sonst anon).
 * Kein externes Paket nötig.
 */
(function () {
  var SUPA_URL = 'https://ywmimuctohdmxkmexops.supabase.co';
  var ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3bWltdWN0b2hkbXhrbWV4b3BzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNzY5MjUsImV4cCI6MjA5MTk1MjkyNX0.eqyCjArkAla2oCxbTUMCAvYzlsJJY6AdI-QXnyKcpy0';
  var LS = 'abc_sb_session_v1';

  window.SUPA_URL = window.SUPA_URL || SUPA_URL;
  window.SB_ANON = ANON;

  function load() { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { return null; } }
  function save(s) { try { localStorage.setItem(LS, JSON.stringify(s)); } catch (e) {} }
  function clear() { try { localStorage.removeItem(LS); } catch (e) {} }

  function setSession(tok) {
    // tok: {access_token, refresh_token, expires_in, ...}
    var expires_at = Date.now() + ((tok.expires_in || 3600) * 1000);
    var s = { access_token: tok.access_token, refresh_token: tok.refresh_token, expires_at: expires_at, email: (tok.user && tok.user.email) || (load() || {}).email };
    save(s);
    window.SB_TOKEN = s.access_token;
    scheduleRefresh(s);
    return s;
  }

  // --- Token synchron setzen, bevor App-Skripte laufen ---
  var sess = load();
  var now = Date.now();
  if (sess && sess.access_token && sess.expires_at && sess.expires_at > now + 5000) {
    window.SB_TOKEN = sess.access_token;
  } else {
    window.SB_TOKEN = ANON; // noch nicht eingeloggt (oder abgelaufen -> unten behandelt)
  }

  function authHeaders() { return { 'apikey': ANON, 'Content-Type': 'application/json' }; }

  function passwordLogin(email, password) {
    return fetch(SUPA_URL + '/auth/v1/token?grant_type=password', {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ email: email, password: password })
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); });
  }

  function refresh(refresh_token) {
    return fetch(SUPA_URL + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ refresh_token: refresh_token })
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); });
  }

  var refreshTimer = null;
  function scheduleRefresh(s) {
    if (refreshTimer) clearTimeout(refreshTimer);
    var ms = (s.expires_at - Date.now()) - 60000; // 1 Min vor Ablauf
    if (ms < 5000) ms = 5000;
    refreshTimer = setTimeout(doRefresh, ms);
  }
  function doRefresh() {
    var s = load();
    if (!s || !s.refresh_token) return;
    refresh(s.refresh_token).then(function (res) {
      if (res.ok && res.j && res.j.access_token) { setSession(res.j); }
      else { clear(); showLogin('Sitzung abgelaufen – bitte neu anmelden.'); }
    }).catch(function () {});
  }

  window.sbLogout = function () { clear(); if (refreshTimer) clearTimeout(refreshTimer); location.reload(); };

  // --- UI ---
  function el(tag, attrs, txt) { var e = document.createElement(tag); if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]); if (txt != null) e.textContent = txt; return e; }

  function showLogin(msg) {
    if (document.getElementById('sbauth-overlay')) {
      if (msg) { var m = document.getElementById('sbauth-msg'); if (m) m.textContent = msg; }
      return;
    }
    var ov = el('div', { id: 'sbauth-overlay' });
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#0f2233;display:flex;align-items:center;justify-content:center;font-family:Arial,Helvetica,sans-serif;';
    var card = el('div');
    card.style.cssText = 'background:#fff;border-radius:12px;padding:28px 26px;width:340px;max-width:92vw;box-shadow:0 12px 40px rgba(0,0,0,.35);';
    var h = el('div', null, 'ABC Kochwerk – Anmeldung');
    h.style.cssText = 'font-size:18px;font-weight:700;color:#1F4E79;margin-bottom:4px;';
    var sub = el('div', null, 'Bitte mit deiner E-Mail und deinem Passwort anmelden.');
    sub.style.cssText = 'font-size:12px;color:#667;margin-bottom:18px;';
    var em = el('input', { type: 'email', placeholder: 'E-Mail', autocomplete: 'username' });
    var pw = el('input', { type: 'password', placeholder: 'Passwort', autocomplete: 'current-password' });
    [em, pw].forEach(function (i) { i.style.cssText = 'width:100%;box-sizing:border-box;padding:10px 12px;margin-bottom:10px;border:1px solid #cbd5e0;border-radius:8px;font-size:14px;'; });
    var btn = el('button', null, 'Anmelden');
    btn.style.cssText = 'width:100%;padding:11px;border:0;border-radius:8px;background:#1F4E79;color:#fff;font-size:15px;font-weight:600;cursor:pointer;';
    var msgEl = el('div', { id: 'sbauth-msg' }, msg || '');
    msgEl.style.cssText = 'min-height:18px;color:#c0392b;font-size:12px;margin-top:10px;text-align:center;';

    function attempt() {
      var e = (em.value || '').trim(), p = pw.value || '';
      if (!e || !p) { msgEl.textContent = 'Bitte E-Mail und Passwort eingeben.'; return; }
      btn.disabled = true; btn.textContent = 'Anmelden…'; msgEl.textContent = '';
      passwordLogin(e, p).then(function (res) {
        if (res.ok && res.j && res.j.access_token) {
          var s = setSession(res.j); s.email = e; save(s);
          location.reload();
        } else {
          btn.disabled = false; btn.textContent = 'Anmelden';
          msgEl.textContent = (res.j && (res.j.error_description || res.j.msg || res.j.error)) || 'Anmeldung fehlgeschlagen.';
        }
      }).catch(function () { btn.disabled = false; btn.textContent = 'Anmelden'; msgEl.textContent = 'Netzwerkfehler.'; });
    }
    btn.addEventListener('click', attempt);
    pw.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') attempt(); });

    card.appendChild(h); card.appendChild(sub); card.appendChild(em); card.appendChild(pw); card.appendChild(btn); card.appendChild(msgEl);
    ov.appendChild(card);
    (document.body || document.documentElement).appendChild(ov);
    setTimeout(function () { em.focus(); }, 50);
  }

  function addLogoutButton() {
    if (document.getElementById('sbauth-logout')) return;
    var s = load();
    var b = el('button', { id: 'sbauth-logout', title: (s && s.email) ? ('Angemeldet: ' + s.email) : 'Abmelden' }, 'Abmelden');
    b.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:2147483000;padding:6px 12px;border:1px solid #cbd5e0;border-radius:8px;background:#fff;color:#333;font:12px Arial;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.15);opacity:.85;';
    b.addEventListener('click', window.sbLogout);
    document.body.appendChild(b);
  }

  function boot() {
    var s = load();
    var t = Date.now();
    if (s && s.access_token && s.expires_at && s.expires_at > t + 5000) {
      // gültig -> nur Logout-Button + Refresh planen
      window.SB_TOKEN = s.access_token;
      scheduleRefresh(s);
      addLogoutButton();
    } else if (s && s.refresh_token) {
      // abgelaufen -> erneuern, dann neu laden
      showLogin('Sitzung wird erneuert…');
      refresh(s.refresh_token).then(function (res) {
        if (res.ok && res.j && res.j.access_token) { var ns = setSession(res.j); ns.email = s.email; save(ns); location.reload(); }
        else { clear(); showLogin('Bitte neu anmelden.'); }
      }).catch(function () { showLogin('Bitte neu anmelden.'); });
    } else {
      showLogin('');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
