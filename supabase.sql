-- =====================================================================
-- Gestão de Carregamento — banco de dados (Supabase)
-- Cole tudo no Supabase: SQL Editor → New query → Run.
-- Pode rodar de novo sem problema (ele recria as funções e regras).
-- =====================================================================

-- 1) Tabela única onde o app guarda tudo (ordens, contratos, cadastros...)
create table if not exists public.docs (
  col        text        not null,               -- coleção: ordens, contratos, veiculos, motoristas, config, cadastros, acessos
  id         text        not null,               -- identificador do registro
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (col, id)
);

-- 2) Funções de permissão (quem é admin, quem está ativo, quem pode escrever)
create or replace function public.meu_acesso() returns jsonb
language sql stable security definer set search_path = public as $$
  select data from public.docs where col = 'acessos' and id = auth.uid()::text
$$;

create or replace function public.is_ativo() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.meu_acesso()->>'status' = 'ativo', false)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.meu_acesso()->>'status' = 'ativo' and public.meu_acesso()->>'papel' = 'admin', false)
$$;

create or replace function public.can_write() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.meu_acesso()->>'status' = 'ativo' and public.meu_acesso()->>'papel' in ('admin','operador'), false)
$$;

-- 3) Regras de segurança (RLS): ninguém lê nem grava sem ser liberado
alter table public.docs enable row level security;

drop policy if exists docs_ler      on public.docs;
drop policy if exists docs_inserir  on public.docs;
drop policy if exists docs_alterar  on public.docs;
drop policy if exists docs_apagar   on public.docs;

-- Ler: admin lê tudo; usuário ativo lê os dados do app;
-- cada pessoa sempre lê o próprio cadastro e a própria situação de acesso.
create policy docs_ler on public.docs for select to authenticated using (
  public.is_admin()
  or (public.is_ativo() and col not in ('cadastros','acessos'))
  or (col in ('cadastros','acessos') and id = auth.uid()::text)
);

-- Gravar: admin grava tudo; cada pessoa grava só o próprio cadastro;
-- operador grava os dados do app; ninguém além do admin mexe em "acessos".
create policy docs_inserir on public.docs for insert to authenticated with check (
  public.is_admin()
  or (col = 'cadastros' and id = auth.uid()::text)
  or (public.can_write() and col not in ('cadastros','acessos'))
);
create policy docs_alterar on public.docs for update to authenticated using (
  public.is_admin()
  or (col = 'cadastros' and id = auth.uid()::text)
  or (public.can_write() and col not in ('cadastros','acessos'))
) with check (
  public.is_admin()
  or (col = 'cadastros' and id = auth.uid()::text)
  or (public.can_write() and col not in ('cadastros','acessos'))
);
create policy docs_apagar on public.docs for delete to authenticated using (
  public.is_admin()
  or (public.can_write() and col not in ('cadastros','acessos'))
);

grant select, insert, update, delete on public.docs to authenticated;
revoke all on public.docs from anon;

-- 4) Primeiro acesso: a primeira pessoa que entrar vira administradora.
--    Depois disso, só um admin libera os outros.
create or replace function public.entrar() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  perform pg_advisory_xact_lock(7001);
  if not exists (select 1 from public.docs where col = 'acessos'
                 and data->>'papel' = 'admin' and data->>'status' = 'ativo') then
    insert into public.docs(col, id, data)
    values ('acessos', auth.uid()::text,
            jsonb_build_object('status','ativo','papel','admin','unidade','BA','aprovadoEm', now()))
    on conflict (col, id) do update set data = excluded.data, updated_at = now();
  end if;
  return public.is_admin();
end $$;

-- 5) Numeração das ordens: o banco dá o número, sem repetir,
--    mesmo com várias pessoas emitindo ao mesmo tempo.
create or replace function public.emitir_ordem(body jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare
  n   int;
  ini int;
  num text;
begin
  if not public.can_write() then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(7002);
  select coalesce((data->>'ini')::int, 1) into ini from public.docs where col = 'config' and id = 'empresa';
  select coalesce(max((data->>'numero')::int), 0) into n
    from public.docs where col = 'ordens' and (data->>'numero') ~ '^[0-9]+$';
  n   := greatest(n + 1, coalesce(ini, 1));
  num := lpad(n::text, 4, '0');
  insert into public.docs(col, id, data)
  values ('ordens', num, body || jsonb_build_object('numero', num, 'criadoEm', now()));
  return num;
end $$;

grant execute on function public.entrar()              to authenticated;
grant execute on function public.emitir_ordem(jsonb)   to authenticated;
grant execute on function public.is_admin()            to authenticated;
grant execute on function public.is_ativo()            to authenticated;
grant execute on function public.can_write()           to authenticated;
grant execute on function public.meu_acesso()          to authenticated;

-- 6) Atualização em tempo real (todo mundo vê a fila mudar na hora)
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; when undefined_object then null;
end $$;
