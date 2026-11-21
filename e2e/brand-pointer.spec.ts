import { test, expect } from "@playwright/test";

test("símbolo original e ponteiro visível: olhar acompanha em campos e no desafio", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".guardian")).toHaveAttribute(
    "data-artwork",
    "original-guararapes-symbol",
  );
  await expect(page.locator(".guardian-original-symbol")).toHaveAttribute(
    "href",
    "/guararapes.png",
  );
  await expect(page.locator(".guardian-body")).toHaveCount(0);
  const pupils = page.locator(".guardian-pupils");
  await expect(pupils).toHaveAttribute("style", /transform:/);
  await page.mouse.move(20, 20);
  await expect
    .poll(() => pupils.getAttribute("style"))
    .toContain("translate(-");
  const left = await pupils.getAttribute("style");
  await page.mouse.move(1200, 650);
  await expect.poll(() => pupils.getAttribute("style")).not.toBe(left);
  const halo = page.locator(".guardian-pointer");
  await expect(halo).toHaveCSS("opacity", "1");
  await expect(halo).toHaveCSS("pointer-events", "none");
  await expect
    .poll(async () => Math.round((await halo.boundingBox()).x + 10))
    .toBe(1200);
  await expect
    .poll(async () => Math.round((await halo.boundingBox()).y + 10))
    .toBe(650);
  await page.getByLabel("Usuário", { exact: true }).fill("demonstracao");
  await page.getByLabel("Senha", { exact: true }).fill("senha-sintetica");
  await page
    .getByRole("button", { name: "Entrar no painel", exact: true })
    .click();
  await expect(page.getByLabel("Sua resposta", { exact: true })).toBeVisible();
  await expect(page.locator(".guardian")).toHaveAttribute(
    "data-mood",
    "challenge",
  );
  await page.mouse.move(15, 200);
  await expect
    .poll(() => pupils.getAttribute("style"))
    .toContain("translate(-");
  const challengeLeft = await pupils.getAttribute("style");
  await page.mouse.move(1150, 450);
  await expect.poll(() => pupils.getAttribute("style")).not.toBe(challengeLeft);
});

test("movimento reduzido mantém o olho responsivo e login não mostra elementos removidos", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const pupils = page.locator(".guardian-pupils");
  await expect(pupils).toHaveAttribute("style", /transform:/);
  await page.mouse.move(20, 20);
  await expect
    .poll(() => pupils.getAttribute("style"))
    .toContain("translate(-");
  const left = await pupils.getAttribute("style");
  const leftPixels = await page.locator(".guardian").screenshot();
  await page.mouse.move(1150, 600);
  await expect.poll(() => pupils.getAttribute("style")).not.toBe(left);
  const rightPixels = await page.locator(".guardian").screenshot();
  expect(Buffer.compare(leftPixels, rightPixels)).not.toBe(0);
  await expect(page.locator(".guardian-head")).toHaveAttribute(
    "style",
    "transform: translate(0px, 0px) rotate(0deg);",
  );
  await expect(
    page.getByRole("button", { name: "Pausar animações", exact: true }),
  ).toHaveCount(0);
  for (const selector of [
    ".guardian-speech",
    ".guardian-intro",
    ".guardian-brand-footer",
    ".access-session",
    ".login-step-label",
    ".guardian-page-footer",
  ]) {
    await expect(page.locator(selector)).toHaveCount(0);
  }
  await expect(
    page.getByRole("heading", { name: "Bem-vindo de volta", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Usuário", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();
});
