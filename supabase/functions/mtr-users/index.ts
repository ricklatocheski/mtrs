import {createClient} from 'npm:@supabase/supabase-js@2.89.0';
import {createUsersHandler} from './handler.ts';
const url=Deno.env.get('SUPABASE_URL')!;
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const publicKey=Deno.env.get('SUPABASE_ANON_KEY')!;
const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const handler=createUsersHandler({
 async authorize(token,workspace){
  const caller=createClient(url,publicKey,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false,autoRefreshToken:false}});
  const identity=await caller.auth.getUser(token);if(identity.error||!identity.data.user)return false;
  const context=await caller.rpc('mtr_session_context',{p_workspace:workspace});return !context.error&&context.data?.role==='admin';
 },
 async bootstrapAllowed(hash,workspace){const result=await admin.from('mtr_bootstrap').select('workspace_id').eq('workspace_id',workspace).eq('token_hash',hash).is('consumed_at',null).maybeSingle();return !result.error&&!!result.data;},
 async createUser(email,password){const result=await admin.auth.admin.createUser({email,password,email_confirm:true});if(result.error||!result.data.user)throw Error('Cadastro recusado.');return result.data.user.id;},
 async enroll(workspace,id,username,hash,token){
  const result=hash?await admin.rpc('mtr_bootstrap_admin',{p_workspace:workspace,p_hash:hash,p_user:id,p_username:username}):await createClient(url,publicKey,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false,autoRefreshToken:false}}).rpc('mtr_register_member',{p_workspace:workspace,p_user:id,p_username:username});
  if(result.error)throw Error('Vínculo recusado.');
 },
 async removeUser(id){const result=await admin.auth.admin.deleteUser(id);if(result.error)throw Error('Reversão recusada.');}
});
// Login/cadastro comum exige JWT validado pelo Auth + sessão de 24 h no RPC.
// A única ação anônima é a inicialização com segredo aleatório, de uso único.
Deno.serve(handler);
