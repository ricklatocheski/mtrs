-- Após setup.sql. Executar uma vez. A sessão é validada no servidor por 24 h.
alter table public.mtr_members add column username text;
alter table public.mtr_members add column role text not null default 'operator' check(role in ('admin','operator'));
alter table public.mtr_members add column active boolean not null default true;
alter table public.mtr_members add column created_at timestamptz not null default now();
alter table public.mtr_members add constraint mtr_username_format check(username is null or username ~ '^[a-z0-9][a-z0-9._-]{2,39}$');
create unique index mtr_username_unique on public.mtr_members(workspace_id,username);
grant select,insert,update,delete on public.mtr_members to service_role;

create table public.mtr_bootstrap(workspace_id uuid primary key references public.mtr_workspaces(id) on delete cascade,token_hash text not null,consumed_at timestamptz);
alter table public.mtr_bootstrap enable row level security;
revoke all on public.mtr_bootstrap from public,anon,authenticated;
grant all on public.mtr_bootstrap to service_role;

create function public.mtr_session_valid() returns boolean language sql security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from auth.sessions s where s.id::text=auth.jwt()->>'session_id' and s.user_id=auth.uid() and s.created_at+interval '24 hours'>clock_timestamp());
$$;
create function public.mtr_can_access(p_workspace uuid) returns boolean language sql security definer set search_path='' as $$
 select public.mtr_session_valid() and exists(select 1 from public.mtr_members where workspace_id=p_workspace and user_id=auth.uid() and active);
$$;
revoke all on function public.mtr_session_valid(),public.mtr_can_access(uuid) from public,anon;
grant execute on function public.mtr_session_valid(),public.mtr_can_access(uuid) to authenticated;
drop policy "membership_self" on public.mtr_members;
create policy "membership_self" on public.mtr_members for select to authenticated using(user_id=auth.uid() and active and public.mtr_session_valid());
drop policy "workspace_members_only" on public.mtr_workspaces;
create policy "workspace_members_only" on public.mtr_workspaces for select to authenticated using(public.mtr_can_access(id));

create function public.mtr_session_context(p_workspace uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare member public.mtr_members; started timestamptz;
begin
 if not public.mtr_can_access(p_workspace) then raise exception 'Sessão expirada ou acesso não autorizado. Entre novamente.' using errcode='42501';end if;
 select * into member from public.mtr_members where workspace_id=p_workspace and user_id=auth.uid();
 select created_at into started from auth.sessions where id::text=auth.jwt()->>'session_id' and user_id=auth.uid();
 return jsonb_build_object('userId',member.user_id,'username',coalesce(member.username,'operador'),'role',member.role,'expiresAt',started+interval '24 hours','serverNow',clock_timestamp());
end $$;
create function public.mtr_list_members(p_workspace uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.mtr_can_access(p_workspace) or not exists(select 1 from public.mtr_members where workspace_id=p_workspace and user_id=auth.uid() and role='admin' and active) then raise exception 'Somente administradores podem consultar os cadastros.' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('userId',user_id,'username',coalesce(username,'operador'),'role',role,'active',active,'createdAt',created_at) order by created_at) from public.mtr_members where workspace_id=p_workspace),'[]'::jsonb);
end $$;
create function public.mtr_set_member_active(p_workspace uuid,p_user uuid,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
declare target public.mtr_members;
begin
 perform 1 from public.mtr_workspaces where id=p_workspace for update;
 if not public.mtr_can_access(p_workspace) or not exists(select 1 from public.mtr_members where workspace_id=p_workspace and user_id=auth.uid() and role='admin' and active) then raise exception 'Somente administradores podem alterar os cadastros.' using errcode='42501';end if;
 select * into target from public.mtr_members where workspace_id=p_workspace and user_id=p_user;
 if not found then raise exception 'Usuário não encontrado.';end if;
 if p_active is null then raise exception 'Estado inválido.';end if;
 if not p_active and target.role='admin' and not exists(select 1 from public.mtr_members where workspace_id=p_workspace and role='admin' and active and user_id<>p_user) then raise exception 'O último administrador ativo não pode ser bloqueado.';end if;
 update public.mtr_members set active=p_active where workspace_id=p_workspace and user_id=p_user;
end $$;
revoke all on function public.mtr_session_context(uuid),public.mtr_list_members(uuid),public.mtr_set_member_active(uuid,uuid,boolean) from public,anon;
grant execute on function public.mtr_session_context(uuid),public.mtr_list_members(uuid),public.mtr_set_member_active(uuid,uuid,boolean) to authenticated;

-- O RPC anterior fica inacessível diretamente; o invólucro impõe a sessão de 24 h.
alter function public.mtr_apply(uuid,bigint,jsonb,text,text) rename to mtr_apply_internal;
revoke all on function public.mtr_apply_internal(uuid,bigint,jsonb,text,text) from public,anon,authenticated;
create function public.mtr_apply(p_workspace uuid,p_expected bigint,p_next jsonb,p_action text,p_target text default null) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.mtr_can_access(p_workspace) then raise exception 'Sessão expirada ou acesso não autorizado. Entre novamente.' using errcode='42501';end if;
 return public.mtr_apply_internal(p_workspace,p_expected,p_next,p_action,p_target);
end $$;
revoke all on function public.mtr_apply(uuid,bigint,jsonb,text,text) from public,anon;
grant execute on function public.mtr_apply(uuid,bigint,jsonb,text,text) to authenticated;

create function public.mtr_bootstrap_admin(p_workspace uuid,p_hash text,p_user uuid,p_username text) returns void language plpgsql security definer set search_path='' as $$
declare boot public.mtr_bootstrap;
begin
 perform 1 from public.mtr_workspaces where id=p_workspace for update;
 select * into boot from public.mtr_bootstrap where workspace_id=p_workspace for update;
 if not found or boot.consumed_at is not null or boot.token_hash<>p_hash or p_hash is null or length(p_hash)<>64 then raise exception 'Inicialização indisponível.';end if;
 if exists(select 1 from public.mtr_members where workspace_id=p_workspace and role='admin') then raise exception 'Inicialização já concluída.';end if;
 insert into public.mtr_members(workspace_id,user_id,username,role) values(p_workspace,p_user,p_username,'admin');
 update public.mtr_bootstrap set token_hash='',consumed_at=clock_timestamp() where workspace_id=p_workspace;
end $$;
revoke all on function public.mtr_bootstrap_admin(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.mtr_bootstrap_admin(uuid,text,uuid,text) to service_role;
