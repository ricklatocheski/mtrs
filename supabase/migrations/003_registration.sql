-- Vínculo de novos usuários: revalida sessão/admin no momento da gravação.
create function public.mtr_register_member(p_workspace uuid,p_user uuid,p_username text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.mtr_can_access(p_workspace) or not exists(select 1 from public.mtr_members where workspace_id=p_workspace and user_id=auth.uid() and role='admin' and active) then raise exception 'Sessão expirada ou permissão insuficiente.' using errcode='42501';end if;
 insert into public.mtr_members(workspace_id,user_id,username,role,active) values(p_workspace,p_user,p_username,'operator',true);
end $$;
revoke all on function public.mtr_register_member(uuid,uuid,text) from public,anon;
grant execute on function public.mtr_register_member(uuid,uuid,text) to authenticated;
