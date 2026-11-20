import { test, expect, type Page } from "@playwright/test";

const header =
  "MTR Nº;Situação;Data de Emissão;Motorista;Placa;Gerador Nome;Observações do Gerador";
const sample =
  header +
  '\r\n000101;Salvo;20/11/2026;MOTORISTA SINTÉTICO;ABC1D23;FORNECEDOR SINTÉTICO;"Observação; de teste"\r\n000102;Salvo;19/11/2026;;;OUTRO GERADOR SINTÉTICO;';
async function importFile(page: Page, csv = sample) {
  await page
    .getByRole("button", { name: "Importar relatório", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Importar relatório", exact: true })
    .locator("input[type=file]")
    .setInputFiles({
      name: "teste-sintetico.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
  await page.getByRole("button", { name: /Confirmar importação/ }).click();
  const dialog = page.getByRole("dialog", {
    name: "Conferência de MTR",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  return dialog;
}
test("importação abre a conferência automaticamente e cada campo pode ser copiado sem concluir", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  const dialog = await importFile(page);
  await expect(
    dialog.getByRole("heading", { name: "000101", exact: true }),
  ).toBeVisible();
  for (const [name, value] of [
    ["número do MTR", "000101"],
    ["Situação", "Salvo"],
    ["Data de Emissão", "20/11/2026"],
    ["Motorista", "MOTORISTA SINTÉTICO"],
    ["Placa", "ABC1D23"],
    ["Gerador Nome", "FORNECEDOR SINTÉTICO"],
    ["Observações do Gerador", "Observação; de teste"],
  ]) {
    const button = dialog.getByRole("button", {
      name: "Copiar " + name,
      exact: true,
    });
    await button.click();
    await expect(button).toHaveText("Copiado");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      value,
    );
  }
  await dialog
    .getByRole("button", { name: "Copiar resumo completo", exact: true })
    .click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "Motorista: MOTORISTA SINTÉTICO",
  );
  await expect(
    dialog.getByText("Em conferência", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".stat-card").nth(3).locator("strong")).toHaveText(
    "0",
  );
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".stat-card").nth(1).locator("strong")).toHaveText(
    "2",
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Iniciar conferência", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "000101", exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Pular por enquanto", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "000102", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Copiar Motorista", exact: true }),
  ).toHaveText("Copiar");
  await dialog.getByRole("button", { name: "Anterior", exact: true }).click();
  await expect(
    dialog.getByRole("heading", { name: "000101", exact: true }),
  ).toBeVisible();
});
test("confirma, avança dentro da janela, mostra resumo e desfaz a última conclusão", async ({
  page,
}) => {
  await page.goto("/");
  const dialog = await importFile(page);
  await dialog
    .getByRole("button", { name: "Confirmar baixa realizada", exact: true })
    .dblclick();
  await expect(
    dialog.getByRole("heading", { name: "000102", exact: true }),
  ).toBeVisible();
  await expect(dialog.locator(".conference-last-done")).toContainText("000101");
  await expect(page.locator(".stat-card").nth(3).locator("strong")).toHaveText(
    "1",
  );
  await expect(dialog.locator(".conference-last-done")).toHaveCSS(
    "background-color",
    "rgb(240, 246, 233)",
  );
  await expect(dialog.getByText("GRC", { exact: true })).toHaveCount(3);
  await dialog
    .getByRole("button", { name: "Confirmar baixa realizada", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "Fila concluída!", exact: true }),
  ).toBeVisible();
  await expect(dialog.locator(".conference-summary-stats strong")).toHaveText([
    "2",
    "2",
    "0",
  ]);
  await dialog
    .getByRole("button", { name: "Desfazer última conclusão", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "000102", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Em conferência", { exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Fechar conferência", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Todos os MTRs", exact: true })
    .click();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "000101" })
      .getByText("Concluído", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("row")
    .filter({ hasText: "000101" })
    .getByRole("button", { name: "Abrir", exact: true })
    .click();
  await expect(dialog.getByText("Concluído", { exact: true })).toBeVisible();
  await dialog
    .getByRole("button", { name: "Reabrir MTR", exact: true })
    .click();
  await expect(
    dialog.getByText("Em conferência", { exact: true }),
  ).toBeVisible();
});
test("pular toda a fila mostra pendências e reimportar lote concluído preserva o progresso", async ({
  page,
}) => {
  await page.goto("/");
  const dialog = await importFile(page);
  await dialog
    .getByRole("button", { name: "Pular por enquanto", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "000102", exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Pular por enquanto", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "Há MTRs para retomar", exact: true }),
  ).toBeVisible();
  await expect(dialog.locator(".conference-summary-stats strong")).toHaveText([
    "2",
    "0",
    "2",
  ]);
  await dialog
    .getByRole("button", { name: "Retomar pendentes", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Confirmar baixa realizada", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "000102", exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Confirmar baixa realizada", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "Fila concluída!", exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Voltar ao painel", exact: true })
    .click();
  await importFile(page);
  await expect(
    dialog.getByRole("heading", { name: "Fila concluída!", exact: true }),
  ).toBeVisible();
  await expect(dialog.locator(".conference-summary-stats strong")).toHaveText([
    "2",
    "2",
    "0",
  ]);
});
test("conferência funciona no celular e lote sem elegíveis não abre documento de outro lote", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const dialog = await importFile(page);
  const box = await dialog.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await expect(dialog.locator(".conference-brand")).toBeHidden();
  await dialog
    .getByRole("button", { name: "Confirmar baixa realizada", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "000102", exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Fechar conferência", exact: true })
    .click();
  await importFile(
    page,
    header + "\r\n000999;Cancelado;20/11/2026;;;GERADOR SINTÉTICO;",
  );
  await expect(
    dialog.getByRole("heading", {
      name: "Nenhum MTR elegível nesta fila",
      exact: true,
    }),
  ).toBeVisible();
  await expect(dialog.locator(".conference-summary-stats strong")).toHaveText([
    "0",
    "0",
    "0",
  ]);
});
