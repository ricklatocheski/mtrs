export type MemberSession = {
  userId: string;
  username: string;
  role: "admin" | "operator";
  expiresAt: string;
  serverNow: string;
};
export type UserAccount = {
  userId: string;
  username: string;
  role: "admin" | "operator";
  active: boolean;
  createdAt: string;
};
export const SESSION_MS = 24 * 60 * 60 * 1000;
export const normalizedUsername = (value: string) => value.trim().toLowerCase();
export const validUsername = (value: string) =>
  /^[a-z0-9][a-z0-9._-]{2,39}$/.test(value);
export function usernameEmail(value: string, workspace: string) {
  const user = normalizedUsername(value);
  if (user.includes("@")) return user;
  if (!validUsername(user)) throw Error("Informe um usuário válido.");
  return `${user}.${workspace.replaceAll("-", "")}@usuarios.mtr.invalid`;
}
export function sessionRemaining(session: MemberSession) {
  return Math.max(
    0,
    Math.min(
      SESSION_MS,
      Date.parse(session.expiresAt) - Date.parse(session.serverNow),
    ),
  );
}
