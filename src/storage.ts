import { openDB } from "idb";
import { BACKEND } from "./backend";
import { createClient } from "@supabase/supabase-js";
import { empty, reduce, type Command, type Snapshot } from "./domain";
const db = openDB("guararapes-mtr-v1", 1, {
  upgrade(db) {
    db.createObjectStore("state");
  },
});
const channel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("guararapes-mtr")
    : null;
export const localActor = () => {
  let id = localStorage.getItem("mtr-operator");
  if (!id) {
    id = "Local " + crypto.randomUUID().slice(0, 8);
    localStorage.setItem("mtr-operator", id);
  }
  return id;
};
// A distinct tab owns its reservation; tabs share durable data, not leases.
export const tabActor = () => {
  let id = sessionStorage.getItem("mtr-tab");
  if (!id) {
    id = crypto.randomUUID().slice(0, 6);
    sessionStorage.setItem("mtr-tab", id);
  }
  return localActor() + " / " + id;
};
export const localLoad = async (): Promise<Snapshot> =>
  (await (await db).get("state", "snapshot")) ?? empty();
export async function localApply(cmd: Command, actor: string) {
  const tx = (await db).transaction("state", "readwrite");
  const current = (await tx.store.get("snapshot")) ?? empty();
  let next: Snapshot;
  try {
    next = reduce(current, cmd, actor);
  } catch (e) {
    tx.abort();
    await tx.done.catch(() => {});
    throw e;
  }
  await tx.store.put(next, "snapshot");
  await tx.done;
  channel?.postMessage("changed");
  return next;
}
export function localSubscribe(cb: () => void) {
  const fn = () => cb();
  channel?.addEventListener("message", fn);
  return () => channel?.removeEventListener("message", fn);
}
const url =
  import.meta.env.VITE_LOCAL_ONLY === "true"
    ? ""
    : import.meta.env.VITE_SUPABASE_URL || BACKEND.url;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || BACKEND.key;
export const workspace =
  import.meta.env.VITE_SUPABASE_WORKSPACE_ID || BACKEND.workspace;
export const supabase = url && key && workspace ? createClient(url, key) : null;
export type RemoteSnapshot = { version: number; doc: Snapshot };
export async function remoteLoad(): Promise<RemoteSnapshot> {
  if (!supabase) throw Error("Supabase não configurado.");
  const { data, error } = await supabase
    .from("mtr_workspaces")
    .select("version,doc")
    .eq("id", workspace)
    .single();
  if (error) throw Error(error.message);
  return data;
}
export async function remoteApply(
  cmd: Command,
  current: RemoteSnapshot,
  actor: string,
): Promise<RemoteSnapshot> {
  if (!supabase) throw Error("Supabase não configurado.");
  if (cmd.type === "restore" && cmd.replace)
    throw Error(
      "No modo compartilhado, restaure por mesclagem para preservar o histórico do servidor.",
    );
  const next = reduce(current.doc, cmd, actor);
  const { data, error } = await supabase.rpc("mtr_apply", {
    p_workspace: workspace,
    p_expected: current.version,
    p_next: next,
    p_action: cmd.type,
    p_target: "id" in cmd ? cmd.id : null,
  });
  if (error) throw Error(error.message);
  return data;
}
