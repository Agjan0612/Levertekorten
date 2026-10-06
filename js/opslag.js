/* Opslag van oordelen, voorstellen en besluiten.
   - Supabase (gedeeld): als js/config.js een Supabase-adres en -sleutel bevat.
     Inloggen gaat met een e-maillink; de database bepaalt wie wat mag zien.
   - Proefmodus: zonder Supabase. Alles blijft in deze browser; je kiest zelf
     een proefapotheker. Handig om de app te leren kennen.
   Beide uitvoeringen hebben dezelfde (async) functies. */
(function (root) {
'use strict';

const cfg = root.LT_CONFIG || {};
const MET_SUPABASE = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
const PAGINA = 1000; // Supabase geeft standaard maximaal 1000 rijen per verzoek

const lsGet = k => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
const lsDel = k => { try { localStorage.removeItem(k); } catch (e) { /* niets */ } };

/* Omzetten tussen databaserijen en het model van de app */
const naarOordeel = r => ({o: r.oordeel || null, t: r.toelichting || '', tijd: r.gewijzigd || null});
const naarVoorstel = r => ({
  id: r.id, tekortPrk: r.tekort_prk, prk: r.prk, categorie: r.categorie, positie: r.positie, toelichting: r.toelichting || '', tijd: r.gemaakt,
  ...(r.gegevens || {})
});
const naarBesluit = r => ({b: r.besluit || null, categorie: r.categorie || '', positie: r.positie ?? '', notitie: r.notitie || '', tijd: r.gewijzigd});

/* Wachtrij voor oordelen die (nog) niet zijn opgeslagen, bijvoorbeeld zonder internet.
   Blijft in de browser bewaard en wordt steeds opnieuw geprobeerd. */
function maakWachtrij(sleutel, schrijf, meldStatus) {
  let rij = lsGet(sleutel) || {};
  let bezig = false, timer = null;
  const bewaar = () => lsSet(sleutel, rij);
  async function verwerk() {
    if (bezig) return;
    bezig = true; clearTimeout(timer);
    try {
      for (const k of Object.keys(rij)) {
        const item = rij[k];
        meldStatus('bezig', Object.keys(rij).length);
        try { await schrijf(item); if (rij[k] === item) { delete rij[k]; bewaar(); } }
        catch (e) { meldStatus('wacht', Object.keys(rij).length, e); timer = setTimeout(verwerk, 10000); return; }
      }
      meldStatus('opgeslagen', 0);
    } finally { bezig = false; }
  }
  return {
    zet(k, item) { rij[k] = item; bewaar(); verwerk(); },
    open() { return rij; },
    verwerk
  };
}

/* ======================= Supabase ======================= */
function supabaseOpslag() {
  const sb = root.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit'}
  });
  let ik = null, wachtrij = null, statusFn = () => {};
  const fout = (error, wat) => { if (error) { const e = new Error(`${wat}: ${error.message || error}`); e.code = error.code; throw e; } };
  async function alles(maakQuery) {
    const uit = [];
    for (let van = 0; ; van += PAGINA) {
      const {data, error} = await maakQuery().range(van, van + PAGINA - 1);
      fout(error, 'Lezen mislukt');
      uit.push(...data);
      if (data.length < PAGINA) return uit;
    }
  }
  async function schrijfOordeel(item) {
    const {error} = await sb.from('oordelen').upsert({email: ik.email, bron: item.bron, sleutel: item.sleutel, oordeel: item.o || null, toelichting: item.t || ''}, {onConflict: 'email,bron,sleutel'});
    fout(error, 'Opslaan mislukt');
  }
  return {
    modus: 'supabase',
    async init() {
      const {data: {session}} = await sb.auth.getSession();
      if (location.hash.includes('access_token') || location.hash.includes('error')) history.replaceState(null, '', location.pathname + location.search);
      if (!session) return {gebruiker: null};
      const email = String(session.user.email || '').toLowerCase();
      const {data, error} = await sb.rpc('mijn_profiel');
      fout(error, 'Profiel ophalen mislukt');
      const p = (data || [])[0] || null;
      ik = {email, naam: p ? p.naam : '', beoordelaar: !!(p && p.beoordelaar), coordinator: !!(p && p.coordinator), opPanel: !!p};
      wachtrij = maakWachtrij('lt-wachtrij:' + email, schrijfOordeel, (...a) => statusFn(...a));
      wachtrij.verwerk();
      return {gebruiker: ik};
    },
    async stuurInloglink(email, terug) {
      const {error} = await sb.auth.signInWithOtp({email: email.trim().toLowerCase(), options: {emailRedirectTo: terug, shouldCreateUser: true}});
      if (error) {
        if (/rate limit|too many|seconds/i.test(error.message)) throw new Error('Er zijn net al inloglinks verstuurd. Wacht een paar minuten en probeer het opnieuw.');
        throw new Error('De inloglink kon niet worden verstuurd: ' + error.message);
      }
    },
    async uitloggen() { await sb.auth.signOut(); },
    opStatus(fn) { statusFn = fn; },
    async mijnWerk(bron) {
      const rijen = await alles(() => sb.from('oordelen').select('*').eq('email', ik.email).eq('bron', bron));
      const oordelen = {};
      for (const r of rijen) oordelen[r.sleutel] = naarOordeel(r);
      for (const item of Object.values(wachtrij.open())) if (item.bron === bron) oordelen[item.sleutel] = {o: item.o, t: item.t, tijd: item.tijd};
      const vs = await alles(() => sb.from('voorstellen').select('*').eq('email', ik.email).eq('bron', bron).order('gemaakt'));
      return {oordelen, voorstellen: vs.map(naarVoorstel)};
    },
    zetOordeel(bron, sleutel, oo) { wachtrij.zet(bron + '|' + sleutel, {bron, sleutel, o: oo.o || null, t: oo.t || '', tijd: new Date().toISOString()}); },
    async voegVoorstelToe(bron, v) {
      const {id, tekortPrk, prk, categorie, positie, toelichting, tijd, ...gegevens} = v;
      const {data, error} = await sb.from('voorstellen').insert({email: ik.email, bron, tekort_prk: tekortPrk, prk, categorie, positie, toelichting: toelichting || '', gegevens}).select().single();
      fout(error, 'Voorstel opslaan mislukt');
      return naarVoorstel(data);
    },
    async verwijderVoorstel(id) { const {error} = await sb.from('voorstellen').delete().eq('id', id); fout(error, 'Verwijderen mislukt'); },
    async mijnAndereVersies(bron) {
      const rijen = await alles(() => sb.from('oordelen').select('*').eq('email', ik.email).neq('bron', bron));
      return rijen.map(r => ({bron: r.bron, sleutel: r.sleutel, ...naarOordeel(r)}));
    },
    /* --- coördinator (de database geeft dit alleen aan de coördinator) --- */
    async panel() {
      const {data, error} = await sb.from('panel').select('*').order('naam');
      fout(error, 'Panel ophalen mislukt');
      return data;
    },
    async alleWerk(bron) {
      const per = {};
      const zorg = e => (per[e] = per[e] || {oordelen: {}, voorstellen: []});
      for (const r of await alles(() => sb.from('oordelen').select('*').eq('bron', bron))) zorg(r.email).oordelen[r.sleutel] = naarOordeel(r);
      for (const r of await alles(() => sb.from('voorstellen').select('*').eq('bron', bron).order('gemaakt'))) zorg(r.email).voorstellen.push(naarVoorstel(r));
      return per;
    },
    async besluiten(bron) {
      const uit = {regels: {}, voorstellen: {}};
      for (const r of await alles(() => sb.from('besluiten').select('*').eq('bron', bron))) uit[r.soort === 'voorstel' ? 'voorstellen' : 'regels'][r.sleutel] = naarBesluit(r);
      return uit;
    },
    async zetBesluit(bron, soort, sleutel, b) {
      if (!b) { const {error} = await sb.from('besluiten').delete().eq('bron', bron).eq('soort', soort).eq('sleutel', sleutel); return fout(error, 'Besluit wissen mislukt'); }
      const pos = parseInt(b.positie, 10);
      const {error} = await sb.from('besluiten').upsert({bron, soort, sleutel, besluit: b.b || null, categorie: b.categorie || null, positie: isNaN(pos) ? null : pos, notitie: b.notitie || ''}, {onConflict: 'bron,soort,sleutel'});
      fout(error, 'Besluit opslaan mislukt');
    },
    async coordinatie(bron) {
      const {data, error} = await sb.from('coordinatie').select('*').eq('bron', bron).maybeSingle();
      fout(error, 'Lezen mislukt');
      return data ? {gepubliceerd: data.gepubliceerd || null, verwijderAfgewezen: !!data.verwijder_afgewezen} : {gepubliceerd: null, verwijderAfgewezen: false};
    },
    async zetCoordinatie(bron, c) {
      const {error} = await sb.from('coordinatie').upsert({bron, gepubliceerd: c.gepubliceerd || null, verwijder_afgewezen: !!c.verwijderAfgewezen}, {onConflict: 'bron'});
      fout(error, 'Opslaan mislukt');
    },
    /* Live: roept fn aan zodra iemand iets wijzigt. Geeft een stop-functie terug. */
    luister(bron, fn) {
      const kanaal = sb.channel('bron-' + bron);
      for (const tabel of ['oordelen', 'voorstellen', 'besluiten', 'coordinatie']) kanaal.on('postgres_changes', {event: '*', schema: 'public', table: tabel, filter: 'bron=eq.' + bron}, () => fn(tabel));
      kanaal.subscribe();
      return () => sb.removeChannel(kanaal);
    }
  };
}

/* ======================= Proefmodus ======================= */
function proefOpslag() {
  const PANEL = [
    {email: 'apotheker.a@proef', naam: 'Apotheker A', beoordelaar: true, coordinator: false},
    {email: 'apotheker.b@proef', naam: 'Apotheker B', beoordelaar: true, coordinator: false},
    {email: 'apotheker.c@proef', naam: 'Apotheker C', beoordelaar: true, coordinator: true}
  ];
  const K = (...d) => 'lt-proef:' + d.join(':');
  let ik = null;
  const werk = (bron, email) => ({oordelen: lsGet(K('oordelen', bron, email)) || {}, voorstellen: lsGet(K('voorstellen', bron, email)) || []});
  return {
    modus: 'proef',
    proefPanel: PANEL,
    async init() {
      const e = lsGet(K('wie'));
      const p = PANEL.find(x => x.email === e);
      ik = p ? {...p, opPanel: true} : null;
      return {gebruiker: ik};
    },
    async kiesProefpersoon(email) { lsSet(K('wie'), email); return this.init(); },
    async uitloggen() { lsDel(K('wie')); ik = null; },
    opStatus(fn) { setTimeout(() => fn('opgeslagen', 0), 0); this._status = fn; },
    async mijnWerk(bron) { return werk(bron, ik.email); },
    zetOordeel(bron, sleutel, oo) {
      const k = K('oordelen', bron, ik.email), o = lsGet(k) || {};
      if (!oo.o && !(oo.t || '').trim()) delete o[sleutel]; else o[sleutel] = {o: oo.o || null, t: oo.t || '', tijd: new Date().toISOString()};
      const ok = lsSet(k, o);
      if (this._status) this._status(ok ? 'opgeslagen' : 'wacht', ok ? 0 : 1);
    },
    async voegVoorstelToe(bron, v) {
      const k = K('voorstellen', bron, ik.email), lijst = lsGet(k) || [];
      const nieuw = {...v, id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), tijd: new Date().toISOString()};
      lijst.push(nieuw); lsSet(k, lijst); return nieuw;
    },
    async verwijderVoorstel(id) {
      for (const k of Object.keys(localStorage).filter(x => x.startsWith(K('voorstellen', '')))) {
        const lijst = lsGet(k) || []; if (lijst.some(v => v.id === id)) lsSet(k, lijst.filter(v => v.id !== id));
      }
    },
    async mijnAndereVersies(bron) {
      const uit = [], pre = K('oordelen', '');
      for (const k of Object.keys(localStorage).filter(x => x.startsWith(pre) && x.endsWith(':' + ik.email))) {
        const b = k.slice(pre.length, k.length - ik.email.length - 1);
        if (b === bron) continue;
        for (const [sleutel, oo] of Object.entries(lsGet(k) || {})) uit.push({bron: b, sleutel, ...oo});
      }
      return uit;
    },
    async panel() { if (!ik || !ik.coordinator) throw new Error('Alleen voor de coördinator.'); return PANEL; },
    async alleWerk(bron) { const per = {}; for (const p of PANEL) per[p.email] = werk(bron, p.email); return per; },
    async besluiten(bron) { return lsGet(K('besluiten', bron)) || {regels: {}, voorstellen: {}}; },
    async zetBesluit(bron, soort, sleutel, b) {
      const alle = lsGet(K('besluiten', bron)) || {regels: {}, voorstellen: {}}, deel = soort === 'voorstel' ? 'voorstellen' : 'regels';
      if (b) alle[deel][sleutel] = {...b, tijd: new Date().toISOString()}; else delete alle[deel][sleutel];
      lsSet(K('besluiten', bron), alle);
    },
    async coordinatie(bron) { return lsGet(K('coordinatie', bron)) || {gepubliceerd: null, verwijderAfgewezen: false}; },
    async zetCoordinatie(bron, c) { if (!lsSet(K('coordinatie', bron), c)) throw new Error('Opslaan in de browser is mislukt.'); },
    luister(bron, fn) {
      const h = e => { if (e.key && e.key.startsWith('lt-proef:')) fn('proef'); };
      window.addEventListener('storage', h);
      return () => window.removeEventListener('storage', h);
    }
  };
}

root.Opslag = MET_SUPABASE && root.supabase ? supabaseOpslag() : proefOpslag();
root.Opslag.geconfigureerd = MET_SUPABASE;
})(window);
