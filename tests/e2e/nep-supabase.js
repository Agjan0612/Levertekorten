/* Nagebootste Supabase voor de browsertests. Bewaart alles in localStorage
   (gedeeld tussen tabbladen), houdt per tabblad bij wie is ingelogd
   (sessionStorage) en past dezelfde toegangsregels toe als supabase/schema.sql. */
(function () {
'use strict';
const KEY = 'nep-db';
const leeg = () => ({panel: [], oordelen: [], voorstellen: [], besluiten: [], coordinatie: []});
const db = () => JSON.parse(localStorage.getItem(KEY) || 'null') || leeg();
const bewaar = d => localStorage.setItem(KEY, JSON.stringify(d));
const ik = () => (sessionStorage.getItem('nep-sessie') || '').toLowerCase();
const panelRij = () => db().panel.find(p => p.email === ik()) || {};
const PK = {oordelen: ['email', 'bron', 'sleutel'], voorstellen: ['id'], besluiten: ['bron', 'soort', 'sleutel'], coordinatie: ['bron'], panel: ['email']};
const offline = () => localStorage.getItem('nep-offline') === '1';
function magLezen(t, r) {
  if (!ik()) return false;
  if (t === 'panel' || t === 'oordelen' || t === 'voorstellen') return r.email === ik() || !!panelRij().coordinator;
  return !!panelRij().coordinator;
}
function magSchrijven(t, r) {
  if (!ik()) return false;
  if (t === 'oordelen' || t === 'voorstellen') return r.email === ik() && !!panelRij().beoordelaar;
  if (t === 'besluiten' || t === 'coordinatie') return !!panelRij().coordinator;
  return false;
}
function magVerwijderen(t, r) { return (t === 'oordelen' || t === 'voorstellen') ? r.email === ik() : magSchrijven(t, r); }
const rlsFout = {message: 'new row violates row-level security policy', code: '42501'};
class Query {
  constructor(t) { this.t = t; this.f = []; this.op = 'select'; }
  select() { return this; }
  eq(k, v) { this.f.push(r => String(r[k]) === String(v)); return this; }
  neq(k, v) { this.f.push(r => String(r[k]) !== String(v)); return this; }
  order(k) { this.ord = k; return this; }
  range(a, b) { this.rng = [a, b]; return this; }
  single() { this.een = true; return this; }
  maybeSingle() { this.misschien = true; return this; }
  upsert(v) { this.op = 'upsert'; this.val = v; return this; }
  insert(v) { this.op = 'insert'; this.val = v; return this; }
  delete() { this.op = 'delete'; return this; }
  then(ok, fout) { new Promise(r => setTimeout(r, 5)).then(() => ok(this.voerUit())).catch(fout); }
  voerUit() {
    if (offline()) return {data: null, error: {message: 'Failed to fetch'}};
    const d = db(), rijen = d[this.t];
    if (this.op === 'select') {
      let r = rijen.filter(x => magLezen(this.t, x) && this.f.every(f => f(x)));
      if (this.ord) r.sort((a, b) => String(a[this.ord]).localeCompare(String(b[this.ord])));
      if (this.rng) r = r.slice(this.rng[0], this.rng[1] + 1);
      return this.misschien ? {data: r[0] || null, error: null} : {data: r, error: null};
    }
    if (this.op === 'insert' || this.op === 'upsert') {
      const nu = new Date().toISOString(), v = {...this.val};
      if (this.t === 'voorstellen' && !v.id) v.id = 'id-' + Math.random().toString(36).slice(2);
      if (this.t === 'voorstellen') v.gemaakt = nu; else v.gewijzigd = nu;
      if (!magSchrijven(this.t, v)) return {data: null, error: rlsFout};
      const i = rijen.findIndex(x => PK[this.t].every(k => String(x[k]) === String(v[k])));
      if (i >= 0) { if (this.op === 'insert') return {data: null, error: {message: 'duplicate key'}}; rijen[i] = {...rijen[i], ...v}; } else rijen.push(v);
      bewaar(d);
      return {data: this.een ? v : [v], error: null};
    }
    const weg = rijen.filter(x => this.f.every(f => f(x)) && magVerwijderen(this.t, x));
    d[this.t] = rijen.filter(x => !weg.includes(x)); bewaar(d);
    return {data: null, error: null};
  }
}
window.supabase = {
  createClient() {
    const kanalen = new Set();
    return {
      auth: {
        async getSession() { return {data: {session: ik() ? {user: {email: ik()}} : null}}; },
        async signInWithOtp({email, options}) {
          const l = JSON.parse(localStorage.getItem('nep-links') || '[]'); l.push({email, redirect: options.emailRedirectTo}); localStorage.setItem('nep-links', JSON.stringify(l));
          return {error: null};
        },
        // De "mail" bevat altijd code 123456 en knop ?inlog=hash-<adres>; alleen geldig voor een adres
        // waarvoor een mail is aangevraagd, en elk inlogbewijs werkt één keer (zoals bij Supabase).
        async verifyOtp({email, token, token_hash, type}) {
          const l = JSON.parse(localStorage.getItem('nep-links') || '[]');
          if (token_hash) email = token_hash.replace(/^hash-/, '');
          const i = l.findIndex(x => x.email === email && !x.gebruikt);
          if (type !== 'email' || i < 0 || (token_hash ? !token_hash.startsWith('hash-') : token !== '123456')) return {data: null, error: {message: 'Token has expired or is invalid'}};
          l[i].gebruikt = true; localStorage.setItem('nep-links', JSON.stringify(l));
          sessionStorage.setItem('nep-sessie', email);
          return {data: {session: {user: {email}}}, error: null};
        },
        async signOut() { sessionStorage.removeItem('nep-sessie'); return {error: null}; }
      },
      from: t => new Query(t),
      async rpc(naam) { return naam === 'mijn_profiel' ? {data: db().panel.filter(p => p.email === ik()), error: null} : {data: null, error: {message: 'onbekend'}}; },
      channel() {
        const k = {cbs: [], on(_, __, cb) { this.cbs.push(cb); return this; }, subscribe() { this.h = e => { if (e.key === KEY) this.cbs.forEach(cb => cb({})); }; window.addEventListener('storage', this.h); kanalen.add(this); return this; }};
        return k;
      },
      removeChannel(k) { window.removeEventListener('storage', k.h); kanalen.delete(k); }
    };
  }
};
})();
