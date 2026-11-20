-- Execute uma vez no SQL Editor do seu projeto Supabase.
-- Não exponha a chave service_role. Membros são cadastrados somente pelo administrador SQL.
create table public.mtr_workspaces (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 version bigint not null default 0,
 doc jsonb not null default '{"records":[],"batches":[],"events":[]}'::jsonb,
 updated_at timestamptz not null default now()
);
create table public.mtr_members (
 workspace_id uuid not null references public.mtr_workspaces(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 primary key(workspace_id,user_id)
);
alter table public.mtr_workspaces enable row level security;
alter table public.mtr_members enable row level security;
revoke all on public.mtr_workspaces,public.mtr_members from anon,authenticated;
grant select on public.mtr_workspaces,public.mtr_members to authenticated;
create policy "membership_self" on public.mtr_members for select to authenticated using (user_id=auth.uid());
create policy "workspace_members_only" on public.mtr_workspaces for select to authenticated
 using (exists(select 1 from public.mtr_members m where m.workspace_id=id and m.user_id=auth.uid()));

-- A linha do workspace é bloqueada na transação. O número de versão impede
-- perda de atualizações e dupla conclusão, inclusive se a reserva acabou de expirar.
create or replace function public.mtr_normalize(s text) returns text language sql immutable set search_path='' as $$
 select trim(regexp_replace(translate(upper(coalesce(s,'')), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC'), '[[:space:]]+', ' ', 'g'));
$$;
revoke all on function public.mtr_normalize(text) from public,anon,authenticated;

create or replace function public.mtr_apply(p_workspace uuid,p_expected bigint,p_next jsonb,p_action text,p_target text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 w public.mtr_workspaces; old_r jsonb; new_r jsonb; r jsonb; rows_out jsonb='[]';
 events_out jsonb; audit_action text; audit_detail text=''; server_time text; actor text; ts timestamptz=clock_timestamp();
 live_lease boolean; target_found boolean=false; n bigint; backup_event jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.mtr_members m where m.workspace_id=p_workspace and m.user_id=auth.uid()) then
  raise exception 'Acesso negado: operador não autorizado neste workspace.' using errcode='42501';
 end if;
 actor=auth.uid()::text;
 select * into w from public.mtr_workspaces where id=p_workspace for update;
 if not found then raise exception 'Workspace não encontrado.'; end if;
 if w.version is distinct from p_expected then raise exception 'Conflito: dados alterados por outro operador. A base foi atualizada; revise e tente novamente.' using errcode='40001';end if;
 if p_action is null or p_action not in ('import','restore','claim','release','complete','reopen','undo','resolve') then raise exception 'Ação inválida.';end if;
 if p_action not in ('import','restore') and p_target is null then raise exception 'MTR alvo obrigatório.';end if;
 if jsonb_typeof(p_next->'records') is distinct from 'array' or jsonb_typeof(p_next->'batches') is distinct from 'array' or jsonb_typeof(p_next->'events') is distinct from 'array' then raise exception 'Documento inválido.';end if;
 if pg_column_size(p_next)>40*1024*1024 then raise exception 'Base excede o limite de 40 MB por workspace. Arquive os dados ou migre para tabelas normalizadas.';end if;
 if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(p_next->'records')) then raise exception 'MTRs duplicados.';end if;
 if exists(select 1 from jsonb_array_elements(w.doc->'records') a where not exists(select 1 from jsonb_array_elements(p_next->'records') b where b->>'id'=a->>'id')) then raise exception 'Remoção de MTRs não permitida.';end if;
 if p_action not in ('import','restore') and (p_next->'batches') is distinct from (w.doc->'batches') then raise exception 'Alteração de lotes indevida.';end if;
 if p_action in ('import','restore') and not ((p_next->'batches') @> (w.doc->'batches')) then raise exception 'Lotes anteriores devem ser preservados.';end if;
 server_time=to_char(ts at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 events_out=w.doc->'events';
 for new_r in select value from jsonb_array_elements(p_next->'records') loop
  if coalesce(new_r->>'id','') !~ '^\d+$' or (new_r->>'id') is distinct from (new_r->'data'->>'MTR Nº') or coalesce(new_r->>'state','') not in ('pendente','conferencia','concluido') or jsonb_typeof(new_r->'sources') is distinct from 'array' or jsonb_array_length(new_r->'sources')=0 then raise exception 'Registro inválido.';end if;
  if public.mtr_normalize(new_r->'data'->>'Situação')<>'SALVO' or public.mtr_normalize(new_r->'data'->>'Gerador Nome')='' or public.mtr_normalize(new_r->'data'->>'Gerador Nome') ~ '^GUARARAPES PAINEIS S[[:space:]]*[/.]?[[:space:]]*A[.]?$' then raise exception 'Registro não elegível.';end if;
  if coalesce(new_r->'data'->>'Data de Emissão','') !~ '^\d{2}/\d{2}/\d{4}$' or to_char(to_date(new_r->'data'->>'Data de Emissão','DD/MM/YYYY'),'DD/MM/YYYY') is distinct from (new_r->'data'->>'Data de Emissão') then raise exception 'Data de emissão inválida.';end if;
  select value into old_r from jsonb_array_elements(w.doc->'records') where value->>'id'=new_r->>'id';
  if old_r is null then
   if p_action not in ('import','restore') then raise exception 'Inclusão de registro não permitida nesta ação.';end if;
   if p_action='import' and (new_r->>'state'<>'pendente' or new_r->>'completedAt' is not null or new_r->>'completedBy' is not null) then raise exception 'Importação não pode criar conclusões.';end if;
   if p_action='import' then new_r=new_r||jsonb_build_object('owner',null,'lease',null);end if;
   -- Backups são informação externa e ficam explicitamente identificados no histórico.
   if p_action='restore' and new_r->>'state'='conferencia' then new_r=new_r||jsonb_build_object('state','pendente','owner',null,'lease',null);end if;
   if p_action='restore' and new_r->>'state'='concluido' then
    if new_r->>'completedAt' is null or new_r->>'completedBy' is null then raise exception 'Conclusão de backup inválida.';end if;
    perform (new_r->>'completedAt')::timestamptz;
    new_r=new_r||jsonb_build_object('completedBy','Backup: '||(new_r->>'completedBy'),'owner',null,'lease',null);
   end if;
  elsif p_action in ('import','restore') then
   if (new_r - 'sources' - 'conflict') is distinct from (old_r - 'sources' - 'conflict') or not((new_r->'sources') @> (old_r->'sources')) or (old_r->>'conflict'='true' and new_r->>'conflict'<>'true') then raise exception 'Reimportação deve preservar dados vigentes, conclusões e reservas.';end if;
  elsif new_r->>'id'<>p_target then
   if new_r is distinct from old_r then raise exception 'Uma ação só pode alterar o MTR selecionado.';end if;
  else
   target_found=true;
   if (new_r - 'data' - 'state' - 'completedAt' - 'completedBy' - 'owner' - 'lease' - 'conflict') is distinct from (old_r - 'data' - 'state' - 'completedAt' - 'completedBy' - 'owner' - 'lease' - 'conflict') then raise exception 'Origens não podem ser alteradas nesta ação.';end if;
   if p_action<>'resolve' and ((new_r->'data') is distinct from (old_r->'data') or (new_r->'conflict') is distinct from (old_r->'conflict')) then raise exception 'Dados importados são imutáveis nesta ação.';end if;
   live_lease=old_r->>'state'='conferencia' and (old_r->>'lease')::timestamptz>ts;
   if live_lease and old_r->>'owner'<>actor then raise exception 'MTR reservado por outro operador.' using errcode='40001';end if;
   -- Reconstituir os campos de acompanhamento no servidor, sem confiar no cliente.
   if p_action='claim' then
    if old_r->>'state'='concluido' then raise exception 'MTR já concluído.';end if;
    new_r=old_r||jsonb_build_object('state','conferencia','owner',actor,'lease',to_char((ts+interval '5 minutes') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
    audit_action='Em conferência';
   elsif p_action='release' then
    if old_r->>'state'='concluido' then raise exception 'MTR já concluído.';end if;
    new_r=old_r||jsonb_build_object('state','pendente','owner',null,'lease',null);audit_action='Pulado / liberado';
   elsif p_action='complete' then
    if old_r->>'state'='concluido' then raise exception 'MTR já concluído.';end if;
    if not live_lease or old_r->>'owner'<>actor then raise exception 'Reserva expirada. Reserve novamente.';end if;
    if old_r->>'conflict'='true' then raise exception 'Revise as origens divergentes antes de concluir.';end if;
    new_r=old_r||jsonb_build_object('state','concluido','completedAt',server_time,'completedBy',actor,'owner',null,'lease',null);audit_action='Baixa informada pelo operador';
   elsif p_action in ('reopen','undo') then
    if old_r->>'state'<>'concluido' then raise exception 'MTR não está concluído.';end if;
    if p_action='undo' then
     select value into r from jsonb_array_elements(events_out) with ordinality e(value,ord) where value->>'actor'=actor and value->>'action'='Baixa informada pelo operador' order by ord desc limit 1;
     if r is null or r->>'mtr'<>p_target or (r->>'at') is distinct from (old_r->>'completedAt') then raise exception 'A última conclusão foi alterada.';end if;
    end if;
    new_r=old_r||jsonb_build_object('state','pendente','completedAt',null,'completedBy',null);audit_action=case when p_action='undo' then 'Conclusão desfeita' else 'Reaberto' end;
   elsif p_action='resolve' then
    if not exists(select 1 from jsonb_array_elements(old_r->'sources') src where src->'data'=new_r->'data') then raise exception 'Origem inválida.';end if;
    new_r=old_r||jsonb_build_object('data',new_r->'data','conflict',false);audit_action='Divergência revisada';audit_detail='Origem escolhida: '||(new_r->'data')::text;
   end if;
  end if;
  rows_out=rows_out||jsonb_build_array(new_r);
 end loop;
 if p_action not in ('import','restore') and not target_found then raise exception 'MTR não encontrado.';end if;
 if p_action='import' then audit_action='Importação';end if;
 if p_action='restore' then
  audit_action='Backup restaurado';
  for backup_event in select value from jsonb_array_elements(p_next->'events') loop
   if not exists(select 1 from jsonb_array_elements(events_out) e where e->>'id'=backup_event->>'id') then
    events_out=events_out||jsonb_build_array(backup_event||jsonb_build_object('actor','Backup: '||(backup_event->>'actor'),'action','Backup importado · '||(backup_event->>'action')));
   end if;
  end loop;
 end if;
 events_out=events_out||jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'at',server_time,'actor',actor,'action',audit_action,'mtr',coalesce(p_target,''),'detail',case when p_action='import' then 'Lote importado; dados e conclusões existentes preservados.' when p_action='restore' then 'Mesclagem de backup externo. Eventos de origem identificados como Backup.' else audit_detail end));
 update public.mtr_workspaces set doc=jsonb_build_object('records',rows_out,'batches',p_next->'batches','events',events_out),version=version+1,updated_at=ts where id=p_workspace returning version into n;
 return jsonb_build_object('version',n,'doc',jsonb_build_object('records',rows_out,'batches',p_next->'batches','events',events_out));
end $$;
revoke all on function public.mtr_apply(uuid,bigint,jsonb,text,text) from public,anon;
grant execute on function public.mtr_apply(uuid,bigint,jsonb,text,text) to authenticated;
alter publication supabase_realtime add table public.mtr_workspaces;

-- Após criar os operadores em Authentication > Users:
-- insert into public.mtr_workspaces(name) values ('Guararapes — MTR') returning id;
-- insert into public.mtr_members(workspace_id,user_id) values ('UUID_WORKSPACE','UUID_USUARIO');
-- Cadastre cada operador autorizado. Não conceda INSERT/UPDATE de membros ao frontend.
