export type LoginChallenge = {
  left: number;
  right: number;
  operator: "+" | "−";
};
export function createLoginChallenge(): LoginChallenge {
  const values = crypto.getRandomValues(new Uint32Array(3));
  const a = 2 + (values[0] % 8),
    b = 1 + (values[1] % 9);
  return values[2] % 2
    ? { left: a, right: b, operator: "+" }
    : { left: Math.max(a, b), right: Math.min(a, b), operator: "−" };
}
export function challengeMatches(challenge: LoginChallenge, answer: string) {
  if (!/^\d{1,2}$/.test(answer.trim())) return false;
  const result =
    challenge.operator === "+"
      ? challenge.left + challenge.right
      : challenge.left - challenge.right;
  return Number(answer.trim()) === result;
}
