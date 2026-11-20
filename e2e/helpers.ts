import { expect, type Page } from "@playwright/test";
export const header =
  "MTR Nº;Situação;Data de Emissão;Motorista;Placa;Gerador Nome;Observações do Gerador";
export const sample =
  header +
  "\r\n000101;Salvo;20/11/2026;MOTORISTA SINTÉTICO;ABC1D23;FORNECEDOR SINTÉTICO;Observação de teste\r\n000102;Salvo;19/11/2026;;;OUTRO GERADOR SINTÉTICO;";
export async function local(page: Page, path = "/") {
  await page.goto(path);
  const button = page.getByRole("button", {
    name: "Abrir modo local neste computador",
    exact: true,
  });
  if (await button.isVisible()) await button.click();
  await expect(
    page.getByRole("heading", {
      name: path === "/registros" ? "Todos os MTRs" : "Visão geral",
      exact: true,
    }),
  ).toBeVisible();
}
export async function importFile(page: Page, csv = sample) {
  await page
    .getByRole("button", { name: "Importar relatório", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Importar relatório",
    exact: true,
  });
  await dialog
    .locator("input[type=file]")
    .setInputFiles({
      name: "teste-sintetico.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
  const popup = page.getByRole("dialog", {
    name: "Conferência de MTR",
    exact: true,
  });
  await expect(popup).toBeVisible();
  return popup;
}
