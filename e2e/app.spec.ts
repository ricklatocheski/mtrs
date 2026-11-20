import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
const csv =
  'MTR Nº;Situação;Data de Emissão;Motorista;Placa;Gerador Nome;Observações do Gerador;Destinador Nome\r\n000001;Salvo;20/11/2026;;;FORNECEDOR SINTÉTICO;"Madeira; limpa\nConferir";GUARARAPES PAINEIS S/A\r\n000002;Salvo;20/11/2026;OPERADOR SINTÉTICO;ABC1D23;INDUSTRIA DE COMPENSADOS GUARARAPES;;\r\n000003;Cancelado;20/11/2026;;;OUTRO;;';
test("fluxo local completo, recarga, segunda aba, exportações e backup", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(page.getByText("Seu controle começa aqui")).toBeVisible();
  await page
    .getByRole("button", { name: "Importar relatório", exact: true })
    .click();
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "relatorio-sintetico.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
  await expect(
    page.getByText("MTRs únicos elegíveis", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Confirmar importação/ }).click();
  await expect(page.locator(".stat-card").nth(0).locator("strong")).toHaveText(
    "2",
  );
  await page
    .getByRole("button", { name: "Iniciar conferência", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "000001", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("GRC", { exact: true })).toHaveCount(2);
  await expect(page.locator(".stat-card").nth(2).locator("strong")).toHaveText(
    "1",
  );
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page
    .getByRole("button", { name: "Copiar número do MTR", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Copiado");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "000001",
  );
  await page
    .getByRole("button", { name: "Confirmar baixa realizada", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "000002", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Desfazer última conclusão", exact: true })
    .click();
  await expect(
    page.getByText("Conclusão desfeita.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Pular por enquanto", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "000001", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirmar baixa realizada", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "000002", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Todos os MTRs", exact: true })
    .click();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "000001" })
      .getByText("Concluído", { exact: true }),
  ).toBeVisible();
  const second = await context.newPage();
  await second.goto("/registros");
  await expect(
    second
      .getByRole("row")
      .filter({ hasText: "000001" })
      .getByText("Concluído", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("row")
    .filter({ hasText: "000001" })
    .getByRole("button", { name: "Reabrir", exact: true })
    .click();
  await expect(
    second
      .getByRole("row")
      .filter({ hasText: "000001" })
      .getByText("Pendente", { exact: true }),
  ).toBeVisible();
  await second.close();
  for (const format of ["csv", "xlsx"]) {
    await page.getByRole("button", { name: "Exportar", exact: true }).click();
    await page.getByLabel("Formato", { exact: true }).selectOption(format);
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Baixar arquivo", exact: true })
      .click();
    const result = await download;
    expect(result.suggestedFilename().endsWith("." + format)).toBe(true);
    const bytes = readFileSync((await result.path())!);
    if (format === "csv") {
      expect(bytes.toString("utf8")).toContain("000001");
      expect(bytes.toString("utf8")).toContain("Situação");
    } else {
      const book = XLSX.read(bytes);
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        book.Sheets[book.SheetNames[0]],
      );
      expect(rows[0]["MTR Nº"]).toBe("000001");
    }
  }
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar backup JSON", exact: true })
    .click();
  const result = await download;
  expect(result.suggestedFilename()).toContain("backup");
  const backup = readFileSync((await result.path())!);
  expect(JSON.parse(backup.toString()).snapshot.records).toHaveLength(2);
  await page.locator("input[type=file]").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: backup,
  });
  await page
    .getByRole("button", { name: "Mesclar backup", exact: true })
    .click();
  await expect(
    page.getByText("Backup restaurado.", { exact: true }),
  ).toBeVisible();
  await page.goto("/historico");
  await expect(
    page.getByRole("heading", { name: "Registro de atividades" }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Reaberto", exact: true }),
  ).toBeVisible();
});
test("layout móvel e acesso direto às rotas", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/registros");
  await expect(
    page.getByRole("heading", { name: "Todos os MTRs", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Visão geral", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Visão geral", exact: true }),
  ).toBeVisible();
});
