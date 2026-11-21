import { test, expect } from "@playwright/test";
import { solveLoginChallenge } from "./helpers";

test("olhos acompanham o ponteiro, senha cobre os olhos e pausa interrompe o movimento", async ({
  page,
}) => {
  await page.goto("/");
  const pupils = page.locator(".guardian-pupils");
  await page.mouse.move(30, 30);
  await expect
    .poll(() => pupils.getAttribute("style"))
    .not.toContain("translate(0px, 0px)");
  const left = await pupils.getAttribute("style");
  await page.mouse.move(1200, 600);
  await expect.poll(() => pupils.getAttribute("style")).not.toBe(left);
  await page.getByLabel("Senha", { exact: true }).focus();
  await expect(page.locator(".guardian")).toHaveAttribute(
    "data-mood",
    "private",
  );
  await expect(page.getByLabel("Senha", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  await page
    .getByRole("button", { name: "Mostrar senha", exact: true })
    .click();
  await expect(page.getByLabel("Senha", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await expect(page.locator(".guardian")).toHaveAttribute(
    "data-mood",
    "private",
  );
  await page
    .getByRole("button", { name: "Pausar animações", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Ativar animações", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.mouse.move(20, 20);
  await expect(pupils).toHaveAttribute(
    "style",
    "transform: translate(0px, 0px);",
  );
});

test("desafio errado não envia credenciais, voltar preserva campos e só resposta certa inicia autenticação", async ({
  page,
}) => {
  let authRequests = 0;
  await page.route("**/auth/v1/token**", async (route) => {
    authRequests++;
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        error: "invalid_grant",
        error_description: "Invalid login credentials",
      }),
    });
  });
  await page.goto("/");
  await page.getByLabel("Usuário", { exact: true }).fill("teste-guardiao");
  await page.getByLabel("Senha", { exact: true }).fill("senha-sintetica");
  await page
    .getByRole("button", { name: "Entrar no painel", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Só mais uma continha", exact: true }),
  ).toBeVisible();
  expect(authRequests).toBe(0);
  await page.getByLabel("Sua resposta", { exact: true }).fill("99");
  await page
    .getByRole("button", { name: "Validar e entrar", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Quase!");
  await expect(page.getByLabel("Sua resposta", { exact: true })).toBeFocused();
  expect(authRequests).toBe(0);
  await page.getByRole("button", { name: "Outra conta", exact: true }).click();
  await expect(page.getByLabel("Sua resposta", { exact: true })).toHaveValue(
    "",
  );
  await page
    .getByRole("button", { name: "Voltar ao login", exact: true })
    .click();
  await expect(page.getByLabel("Usuário", { exact: true })).toHaveValue(
    "teste-guardiao",
  );
  await expect(page.getByLabel("Senha", { exact: true })).toHaveValue(
    "senha-sintetica",
  );
  await page
    .getByRole("button", { name: "Entrar no painel", exact: true })
    .click();
  await solveLoginChallenge(page);
  await expect(page.getByRole("alert")).toContainText(
    "Usuário ou senha inválidos",
  );
  expect(authRequests).toBe(1);
  await expect(page.getByLabel("Senha", { exact: true })).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "Importar relatório", exact: true }),
  ).toHaveCount(0);
});

test("celular e movimento reduzido mantêm o desafio acessível por teclado", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".guardian")).toBeVisible();
  await page.mouse.move(10, 10);
  await expect(page.locator(".guardian-head")).toHaveAttribute(
    "style",
    "transform: translate(0px, 0px) rotate(0deg);",
  );
  await expect
    .poll(() => page.locator(".guardian-pupils").getAttribute("style"))
    .not.toContain("translate(0px, 0px)");
  await page.getByLabel("Usuário", { exact: true }).fill("teste");
  await page.getByLabel("Senha", { exact: true }).fill("senha-sintetica");
  await page.getByLabel("Senha", { exact: true }).press("Enter");
  await expect(page.getByLabel("Sua resposta", { exact: true })).toBeFocused();
  await expect
    .poll(() =>
      page
        .locator(".guardian-eyes")
        .evaluate((node) => getComputedStyle(node).animationName),
    )
    .toBe("none");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Voltar ao login", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Bem-vindo de volta", exact: true }),
  ).toBeVisible();
});
