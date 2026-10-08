-- Test van de toegangsregels: elke controle die faalt geeft een foutmelding.
\set ON_ERROR_STOP on
insert into public.panel values
  ('jan@test.nl', 'Jan Test', true, false),
  ('femke@test.nl', 'Femke Test', true, false),
  ('arnout@test.nl', 'Arnout Test', true, true),
  ('coord@test.nl', 'Alleen Coördinator', false, true);

create function pg_temp.als(email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('email', email, 'role', 'authenticated')::text, false);
  set role authenticated;
end $$;
create function pg_temp.verwacht(ok boolean, wat text) returns void language plpgsql as $$
begin if not ok then raise exception 'MISLUKT: %', wat; end if; raise notice 'ok: %', wat; end $$;

-- Jan geeft oordelen en doet een voorstel
select pg_temp.als('jan@test.nl');
insert into oordelen (bron, sleutel, oordeel, toelichting) values ('v5', '1|2', 'akkoord', ''), ('v5', '1|3', 'niet', 'te zwak');
insert into voorstellen (bron, tekort_prk, prk, categorie, positie) values ('v5', '1', '9', 'AndereStof', 1);
select pg_temp.verwacht((select count(*) from oordelen) = 2, 'Jan ziet zijn eigen 2 oordelen');
select pg_temp.verwacht((select email from oordelen limit 1) = 'jan@test.nl', 'e-mail automatisch ingevuld');
reset role;

-- Femke ziet niets van Jan (blind) en kan niet namens Jan schrijven
select pg_temp.als('femke@test.nl');
select pg_temp.verwacht((select count(*) from oordelen) = 0, 'Femke ziet de oordelen van Jan niet');
select pg_temp.verwacht((select count(*) from voorstellen) = 0, 'Femke ziet het voorstel van Jan niet');
select pg_temp.verwacht((select count(*) from panel) = 1, 'Femke ziet alleen haar eigen panelregel');
do $$ begin
  insert into oordelen (email, bron, sleutel, oordeel) values ('jan@test.nl', 'v5', '1|4', 'akkoord');
  raise exception 'MISLUKT: Femke kon namens Jan schrijven';
exception when insufficient_privilege then raise notice 'ok: Femke kan niet namens Jan schrijven'; end $$;
update oordelen set oordeel = 'niet' where email = 'jan@test.nl';
delete from oordelen where email = 'jan@test.nl';
insert into oordelen (bron, sleutel, oordeel) values ('v5', '1|2', 'akkoord');
-- upsert zoals de app doet
insert into oordelen (email, bron, sleutel, oordeel, toelichting) values ('femke@test.nl', 'v5', '1|2', 'bespreken', 'graag overleg')
  on conflict (email, bron, sleutel) do update set oordeel = excluded.oordeel, toelichting = excluded.toelichting;
do $$ begin
  insert into besluiten (bron, soort, sleutel, besluit) values ('v5', 'regel', '1|2', 'akkoord');
  raise exception 'MISLUKT: Femke kon een besluit vastleggen';
exception when insufficient_privilege then raise notice 'ok: Femke kan geen eindbesluit vastleggen'; end $$;
select pg_temp.verwacht((select count(*) from besluiten) = 0, 'Femke ziet geen besluiten');
reset role;
select pg_temp.verwacht((select oordeel from oordelen where email = 'jan@test.nl' and sleutel = '1|3') = 'niet', 'Jans oordeel ongewijzigd na poging van Femke');
select pg_temp.verwacht((select count(*) from oordelen where email = 'jan@test.nl') = 2, 'Jans oordelen niet verwijderd door Femke');

-- Coördinator die ook beoordeelt (Arnout): ziet alles en legt besluiten vast
select pg_temp.als('arnout@test.nl');
select pg_temp.verwacht((select count(*) from oordelen) = 3, 'coördinator ziet alle oordelen');
select pg_temp.verwacht((select count(*) from voorstellen) = 1, 'coördinator ziet alle voorstellen');
select pg_temp.verwacht((select count(*) from panel) = 4, 'coördinator ziet het hele panel');
insert into besluiten (bron, soort, sleutel, besluit, notitie) values ('v5', 'regel', '1|2', 'akkoord', 'na overleg');
insert into coordinatie (bron, verwijder_afgewezen) values ('v5', true);
insert into oordelen (bron, sleutel, oordeel) values ('v5', '1|2', 'akkoord');
update oordelen set oordeel = 'akkoord' where email = 'jan@test.nl';
reset role;
select pg_temp.verwacht((select count(*) from oordelen where email = 'jan@test.nl' and oordeel = 'akkoord') = 1, 'coördinator kan oordelen van anderen niet wijzigen');

-- Alleen coördinator (geen beoordelaar) kan geen oordelen geven
select pg_temp.als('coord@test.nl');
do $$ begin
  insert into oordelen (bron, sleutel, oordeel) values ('v5', '1|2', 'akkoord');
  raise exception 'MISLUKT: coördinator zonder beoordelaarsrol kon oordelen';
exception when insufficient_privilege then raise notice 'ok: niet-beoordelaar kan geen oordeel geven'; end $$;
select pg_temp.verwacht((select count(*) from besluiten) = 1, 'tweede coördinator ziet het besluit');
reset role;

-- Iemand die niet op het panel staat, en een niet-ingelogde bezoeker
select pg_temp.als('vreemde@test.nl');
select pg_temp.verwacht((select count(*) from oordelen) = 0 and (select count(*) from panel) = 0, 'buitenstaander ziet niets');
select pg_temp.verwacht((select count(*) from mijn_profiel()) = 0, 'buitenstaander heeft geen profiel');
do $$ begin
  insert into oordelen (bron, sleutel, oordeel) values ('v5', '1|2', 'akkoord');
  raise exception 'MISLUKT: buitenstaander kon oordelen';
exception when insufficient_privilege then raise notice 'ok: buitenstaander kan niets schrijven'; end $$;
reset role;
set role anon;
do $$ begin
  perform count(*) from oordelen;
  raise exception 'MISLUKT: niet-ingelogd kon oordelen lezen';
exception when insufficient_privilege then raise notice 'ok: niet-ingelogd kan niets lezen'; end $$;
select pg_temp.verwacht(public.wakker(), 'niet-ingelogd kan de database wakker houden (wakker() geeft true)');
do $$ begin
  perform * from mijn_profiel();
  raise exception 'MISLUKT: niet-ingelogd kon mijn_profiel aanroepen';
exception when insufficient_privilege then raise notice 'ok: niet-ingelogd kan verder geen functies aanroepen'; end $$;
reset role;

-- Realtime-publicatie bevat de tabellen; gewijzigd wordt bijgewerkt
select pg_temp.verwacht((select count(*) from pg_publication_tables where pubname = 'supabase_realtime') = 4, 'realtime staat aan voor 4 tabellen');
select pg_temp.verwacht((select count(*) from mijn_profiel()) = 0, 'zonder inlog geen profiel');
select pg_temp.als('jan@test.nl');
select pg_temp.verwacht((select naam from mijn_profiel()) = 'Jan Test', 'mijn_profiel geeft naam');
reset role;
\echo ALLE RLS-TESTS GESLAAGD
