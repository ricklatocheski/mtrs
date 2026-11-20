import { test, expect } from "@playwright/test";
import * as XLSX from "xlsx";
import { local, importFile, header } from "./helpers";
test("somente os campos de baixa e confirmação, cópia não conclui e fechar libera", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await local(page);
  const popup = await importFile(page);
  await expect(
    popup.getByRole("button", { name: "Pular por enquanto", exact: true }),
  ).toHaveCount(0);
  await expect(
    popup.getByRole("button", { name: "Anterior", exact: true }),
  ).toHaveCount(0);
  await expect(
    popup.getByRole("button", {
      name: "Desfazer última conclusão",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(popup.locator(".conference-actions button")).toHaveCount(1);
  await expect(
    popup.getByText("FORNECEDOR SINTÉTICO", { exact: true }),
  ).not.toBeVisible();
  await expect(
    popup.locator(".conference-field").filter({ hasText: "Gerador Nome" }),
  ).toHaveCount(0);
  for (const [name, value] of [
    ["número do MTR", "000101"],
    ["Data de Emissão", "20/11/2026"],
    ["Motorista", "MOTORISTA SINTÉTICO"],
    ["Placa", "ABC1D23"],
    ["Observações do Gerador", "Observação de teste"],
  ]) {
    const button = popup.getByRole("button", {
      name: "Copiar " + name,
      exact: true,
    });
    await button.click();
    await expect(button).toHaveText("Copiado");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      value,
    );
  }
  await expect(page.locator(".stat-card").nth(3).locator("strong")).toHaveText(
    "0",
  );
  await page.keyboard.press("Escape");
  await expect(popup).not.toBeVisible();
  await expect(page.locator(".stat-card").nth(1).locator("strong")).toHaveText(
    "2",
  );
});
test("clique duplo não confirma o próximo e resumo preserva reimportação", async ({
  page,
}) => {
  await local(page);
  let popup = await importFile(page);
  await popup
    .getByRole("button", { name: "Confirmar baixa realizada", exact: true })
    .dblclick();
  await expect(
    popup.getByRole("heading", { name: "000102", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".stat-card").nth(3).locator("strong")).toHaveText(
    "1",
  );
  await expect(popup.getByText("GRC", { exact: true })).toHaveCount(3);
  await popup
    .getByRole("button", { name: "Confirmar baixa realizada", exact: true })
    .click();
  await expect(
    popup.getByRole("heading", { name: "Fila concluída!", exact: true }),
  ).toBeVisible();
  await popup
    .getByRole("button", { name: "Voltar ao painel", exact: true })
    .click();
  popup = await importFile(page);
  await expect(popup.locator(".conference-summary-stats strong")).toHaveText([
    "2",
    "2",
    "0",
  ]);
});
test("arquivo com várias abas pede apenas a aba e importa ao selecionar; erro não grava", async ({
  page,
}) => {
  await local(page);
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
      name: "invalido.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("MTR Nº\n001"),
    });
  await expect(dialog.getByRole("alert")).toContainText("Colunas obrigatórias");
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.aoa_to_sheet([
      header.split(";"),
      ["000201", "Salvo", "20/11/2026", "", "", "GERADOR SINTÉTICO", ""],
    ]),
    "Principal",
  );
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.aoa_to_sheet([["outra"]]),
    "Outra",
  );
  await dialog
    .locator("input[type=file]")
    .setInputFiles({
      name: "abas.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from(
        XLSX.write(book, { type: "buffer", bookType: "xlsx" }),
      ),
    });
  await dialog.getByLabel("Aba da planilha", { exact: true }).selectOption("0");
  await expect(
    page
      .getByRole("dialog", { name: "Conferência de MTR" })
      .getByRole("heading", { name: "000201", exact: true }),
  ).toBeVisible();
});
test("janela móvel e lote sem elegíveis não usa pendentes de outro lote", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await local(page);
  const popup = await importFile(page);
  const box = await popup.boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await expect(popup.locator(".conference-brand")).toBeHidden();
  await popup
    .getByRole("button", { name: "Fechar conferência", exact: true })
    .click();
  await importFile(
    page,
    header + "\r\n000999;Cancelado;20/11/2026;;;GERADOR SINTÉTICO;",
  );
  await expect(
    popup.getByRole("heading", {
      name: "Nenhum MTR elegível nesta fila",
      exact: true,
    }),
  ).toBeVisible();
});
