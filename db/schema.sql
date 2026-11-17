-- =====================================================================
-- ShoppingList — schema inicial (schema `shoppinglist`, mesmo projeto
-- Supabase das outras apps). IDEMPOTENTE: pode correr mais que uma vez.
--
-- Depois de correr: Supabase → Project Settings → API → "Exposed schemas"
-- → acrescentar `shoppinglist` (sem isso o REST responde 406).
-- =====================================================================

create schema if not exists shoppinglist;

-- ── Acesso (igual às outras apps) ────────────────────────────────────
create table if not exists shoppinglist.allowed_users (
  email text primary key
);
create table if not exists shoppinglist.access_requests (
  email        text primary key,
  requested_at timestamptz not null default now()
);

create or replace function shoppinglist.is_admin() returns boolean
  language sql stable security definer set search_path = shoppinglist, public
  as $$ select lower(coalesce(auth.email(), '')) = 'diogo.andre.f.silva@gmail.com' $$;

create or replace function shoppinglist.is_allowed() returns boolean
  language sql stable security definer set search_path = shoppinglist, public
  as $$ select exists (select 1 from shoppinglist.allowed_users
                        where lower(email) = lower(coalesce(auth.email(), ''))) $$;

-- ── Perfis: o nome que aparece ao lado de cada artigo ────────────────
create table if not exists shoppinglist.perfis (
  email text primary key,
  nome  text not null check (char_length(nome) between 1 and 40)
);

-- ── Listas ───────────────────────────────────────────────────────────
-- `fixa` = a lista da casa (dia a dia): nunca se apaga nem se conclui.
-- As outras são listas de ocasião (um jantar, uma festa…): concluem-se
-- (`concluida_em`) quando as compras estão feitas e ficam no histórico.
create table if not exists shoppinglist.listas (
  id           bigint generated always as identity primary key,
  nome         text not null check (char_length(nome) between 1 and 60),
  emoji        text not null default '🛒' check (char_length(emoji) <= 8),
  data         date,
  fixa         boolean not null default false,
  criado_por   text not null default lower(auth.email()),
  criado_em    timestamptz not null default now(),
  concluida_em timestamptz
);

-- ── Artigos ──────────────────────────────────────────────────────────
create table if not exists shoppinglist.artigos (
  id          bigint generated always as identity primary key,
  lista_id    bigint not null references shoppinglist.listas(id) on delete cascade,
  nome        text not null check (char_length(nome) between 1 and 120),
  qtd         text check (qtd is null or char_length(qtd) <= 30),
  criado_por  text not null default lower(auth.email()),
  criado_em   timestamptz not null default now(),
  tratado     boolean not null default false,
  tratado_por text,
  tratado_em  timestamptz
);
create index if not exists artigos_lista_idx on shoppinglist.artigos (lista_id);

-- Quem criou e quem tratou decide-se AQUI, não no cliente: assim o nome que
-- aparece ao lado de cada artigo é sempre o da sessão que fez a ação.
create or replace function shoppinglist.artigos_carimbo() returns trigger
  language plpgsql set search_path = shoppinglist, public as $$
begin
  if tg_op = 'INSERT' then
    new.criado_por := lower(coalesce(auth.email(), new.criado_por));
    new.criado_em  := now();
    if new.tratado then
      new.tratado_por := new.criado_por; new.tratado_em := now();
    else
      new.tratado_por := null; new.tratado_em := null;
    end if;
  else
    new.criado_por := old.criado_por;
    new.criado_em  := old.criado_em;
    if new.tratado is distinct from old.tratado then
      if new.tratado then
        new.tratado_por := lower(coalesce(auth.email(), '')); new.tratado_em := now();
      else
        new.tratado_por := null; new.tratado_em := null;
      end if;
    else
      new.tratado_por := old.tratado_por; new.tratado_em := old.tratado_em;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists artigos_carimbo on shoppinglist.artigos;
create trigger artigos_carimbo before insert or update on shoppinglist.artigos
  for each row execute function shoppinglist.artigos_carimbo();

create or replace function shoppinglist.listas_carimbo() returns trigger
  language plpgsql set search_path = shoppinglist, public as $$
begin
  if tg_op = 'INSERT' then
    new.criado_por := lower(coalesce(auth.email(), new.criado_por));
    new.criado_em  := now();
    -- pela API (com sessão) nunca se cria uma lista fixa: a da casa só nasce
    -- nesta migração, corrida no SQL Editor (sem sessão)
    if auth.uid() is not null then new.fixa := false; end if;
  else
    new.criado_por := old.criado_por;
    new.criado_em  := old.criado_em;
    if auth.uid() is not null then new.fixa := old.fixa; end if;
    if old.fixa then new.concluida_em := null; end if;
  end if;
  return new;
end $$;
drop trigger if exists listas_carimbo on shoppinglist.listas;
create trigger listas_carimbo before insert or update on shoppinglist.listas
  for each row execute function shoppinglist.listas_carimbo();

-- ── RLS ──────────────────────────────────────────────────────────────
alter table shoppinglist.allowed_users   enable row level security;
alter table shoppinglist.access_requests enable row level security;
alter table shoppinglist.perfis          enable row level security;
alter table shoppinglist.listas          enable row level security;
alter table shoppinglist.artigos         enable row level security;

do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies where schemaname = 'shoppinglist' loop
    execute format('drop policy %I on shoppinglist.%I', p.policyname, p.tablename);
  end loop;
end $$;

create policy au_select on shoppinglist.allowed_users for select to authenticated
  using (lower(email) = lower(auth.email()) or shoppinglist.is_admin());
create policy au_admin_ins on shoppinglist.allowed_users for insert to authenticated
  with check (shoppinglist.is_admin());
create policy au_admin_del on shoppinglist.allowed_users for delete to authenticated
  using (shoppinglist.is_admin());

create policy ar_insert_own on shoppinglist.access_requests for insert to authenticated
  with check (lower(email) = lower(auth.email()));
create policy ar_admin_select on shoppinglist.access_requests for select to authenticated
  using (shoppinglist.is_admin());
create policy ar_admin_delete on shoppinglist.access_requests for delete to authenticated
  using (shoppinglist.is_admin());

create policy pf_select on shoppinglist.perfis for select to authenticated
  using (shoppinglist.is_allowed());
create policy pf_insert on shoppinglist.perfis for insert to authenticated
  with check (shoppinglist.is_allowed() and lower(email) = lower(auth.email()));
create policy pf_update on shoppinglist.perfis for update to authenticated
  using (shoppinglist.is_allowed() and lower(email) = lower(auth.email()))
  with check (lower(email) = lower(auth.email()));

-- A casa é partilhada: quem tem acesso vê e mexe em tudo.
create policy li_select on shoppinglist.listas for select to authenticated
  using (shoppinglist.is_allowed());
create policy li_insert on shoppinglist.listas for insert to authenticated
  with check (shoppinglist.is_allowed());
create policy li_update on shoppinglist.listas for update to authenticated
  using (shoppinglist.is_allowed()) with check (shoppinglist.is_allowed());
create policy li_delete on shoppinglist.listas for delete to authenticated
  using (shoppinglist.is_allowed() and not fixa);

create policy ar_select on shoppinglist.artigos for select to authenticated
  using (shoppinglist.is_allowed());
create policy ar_insert on shoppinglist.artigos for insert to authenticated
  with check (shoppinglist.is_allowed());
create policy ar_update on shoppinglist.artigos for update to authenticated
  using (shoppinglist.is_allowed()) with check (shoppinglist.is_allowed());
create policy ar_delete on shoppinglist.artigos for delete to authenticated
  using (shoppinglist.is_allowed());

-- ── Privilégios (sem anon: tudo exige sessão) ────────────────────────
grant usage on schema shoppinglist to authenticated, service_role;
revoke all on all tables in schema shoppinglist from anon;
grant select, insert, update, delete on all tables in schema shoppinglist to authenticated;
grant all on all tables in schema shoppinglist to service_role;
revoke execute on all functions in schema shoppinglist from public, anon;
grant execute on function shoppinglist.is_admin(), shoppinglist.is_allowed() to authenticated, service_role;

-- ── Dados iniciais ───────────────────────────────────────────────────
insert into shoppinglist.allowed_users (email)
  values ('diogo.andre.f.silva@gmail.com') on conflict do nothing;

insert into shoppinglist.listas (nome, emoji, fixa, criado_por)
  select 'Casa', '🏠', true, 'diogo.andre.f.silva@gmail.com'
   where not exists (select 1 from shoppinglist.listas where fixa);
