import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
const adminPassword = process.env.MTR_TEST_ADMIN_PASSWORD;
test("tela de login não expõe dados antes da autenticação", async ({
  page,
}) => {
  await page.goto("/registros");
  await expect(
    page.getByRole("heading", { name: "Bem-vindo de volta", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Importar relatório", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Usuário", { exact: true }).fill("inexistente");
  await page.getByLabel("Senha", { exact: true }).fill("credencial-invalida");
  await page
    .getByRole("button", { name: "Entrar no painel", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Bem-vindo de volta", exact: true }),
  ).toBeVisible();
});
test("admin cadastra usuário, operador entra e é bloqueado no servidor", async ({
  page,
  browser,
}) => {
  test.skip(
    !adminPassword,
    "Defina MTR_TEST_ADMIN_PASSWORD para testar o backend real.",
  );
  await page.goto("/");
  await page.getByLabel("Usuário", { exact: true }).fill("admin");
  await page.getByLabel("Senha", { exact: true }).fill(adminPassword!);
  await page
    .getByRole("button", { name: "Entrar no painel", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Visão geral", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cadastros", exact: true }).click();
  const username = "qa-" + Date.now().toString(36),
    password = randomBytes(16).toString("base64url");
  await page.getByLabel("Novo usuário", { exact: true }).fill(username);
  await page
    .getByLabel("Senha do novo usuário", { exact: true })
    .fill(password);
  await page
    .getByRole("button", { name: "Cadastrar usuário", exact: true })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: username }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Senha do novo usuário", { exact: true }),
  ).toHaveValue("");
  const context = await browser.newContext();
  const operator = await context.newPage();
  await operator.goto("/");
  await operator.getByLabel("Usuário", { exact: true }).fill(username);
  await operator.getByLabel("Senha", { exact: true }).fill(password);
  await operator
    .getByRole("button", { name: "Entrar no painel", exact: true })
    .click();
  await expect(
    operator.getByRole("heading", { name: "Visão geral", exact: true }),
  ).toBeVisible();
  await operator
    .getByRole("button", { name: "Cadastros", exact: true })
    .click();
  await expect(
    operator.getByRole("heading", { name: "Minha conta", exact: true }),
  ).toBeVisible();
  await expect(
    operator.getByLabel("Novo usuário", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("row")
    .filter({ hasText: username })
    .getByRole("button", { name: "Bloquear", exact: true })
    .click();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: username })
      .getByText("Bloqueado", { exact: true }),
  ).toBeVisible();
  await operator.reload();
  await expect(
    operator.getByRole("heading", { name: "Bem-vindo de volta", exact: true }),
  ).toBeVisible();
  await context.close();
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Bem-vindo de volta", exact: true }),
  ).toBeVisible();
});

test("a interface exige novo login depois de 24 horas", async ({ page }) => {
  test.skip(
    !adminPassword,
    "Defina MTR_TEST_ADMIN_PASSWORD para testar o backend real.",
  );
  await page.clock.install();
  await page.goto("/");
  await page.getByLabel("Usuário", { exact: true }).fill("admin");
  await page.getByLabel("Senha", { exact: true }).fill(adminPassword!);
  await page
    .getByRole("button", { name: "Entrar no painel", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Visão geral", exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(24 * 60 * 60 * 1000 + 2000);
  await expect(
    page.getByRole("heading", { name: "Bem-vindo de volta", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Importar relatório", exact: true }),
  ).toHaveCount(0);
});
