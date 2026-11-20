import { describe, expect, it } from "vitest";
import { challengeMatches, createLoginChallenge } from "../src/login-challenge";
describe("desafio de login", () => {
  it("aceita soma e subtração sem converter resposta vazia em zero", () => {
    expect(challengeMatches({ left: 5, right: 2, operator: "+" }, "7")).toBe(
      true,
    );
    expect(challengeMatches({ left: 5, right: 2, operator: "−" }, "3")).toBe(
      true,
    );
    expect(challengeMatches({ left: 5, right: 5, operator: "−" }, "0")).toBe(
      true,
    );
    for (const answer of ["", " ", "5+2", "7.0", "7e0", "-1", "99"]) {
      expect(
        challengeMatches({ left: 5, right: 2, operator: "+" }, answer),
      ).toBe(false);
    }
  });
  it("gera contas pequenas, válidas e sem resultado negativo", () => {
    for (let index = 0; index < 100; index++) {
      const challenge = createLoginChallenge();
      const result =
        challenge.operator === "+"
          ? challenge.left + challenge.right
          : challenge.left - challenge.right;
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(18);
      expect(challengeMatches(challenge, String(result))).toBe(true);
    }
  });
});
