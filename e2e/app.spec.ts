import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { local, importFile } from "./helpers";
test("importa automaticamente, persiste após recarga e outra aba, exporta e restaura", async ({
  page,
  context,
}) => {
  await local(page);
  const popup = await importFile(page);
  await expect(
    popup.getByRole("heading", { name: "000101", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Confirmar importação/ }),
  ).toHaveCount(0);
  await popup
    .getByRole("button", { name: "Confirmar baixa realizada", exact: true })
    .click();
  await expect(
    popup.getByRole("heading", { name: "000102", exact: true }),
  ).toBeVisible();
  await popup
    .getByRole("button", { name: "Fechar conferência", exact: true })
    .click();
  await expect(popup).not.toBeVisible();
  await page.reload();
  await expect(page.locator(".stat-card").nth(3).locator("strong")).toHaveText(
    "1",
  );
  await page
    .getByRole("button", { name: "Todos os MTRs", exact: true })
    .click();
  const second = await context.newPage();
  await local(second, "/registros");
  await page
    .getByRole("row")
    .filter({ hasText: "000101" })
    .getByRole("button", { name: "Reabrir", exact: true })
    .click();
  await expect(
    second
      .getByRole("row")
      .filter({ hasText: "000101" })
      .getByText("Pendente", { exact: true }),
  ).toBeVisible();
  await second.close();
  for (const format of ["csv", "xlsx"]) {
    await page.getByRole("button", { name: "Exportar", exact: true }).click();
    await page.getByLabel("Formato", { exact: true }).selectOption(format);
    const wait = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Baixar arquivo", exact: true })
      .click();
    const download = await wait;
    const bytes = readFileSync((await download.path())!);
    if (format === "csv") expect(bytes.toString("utf8")).toContain("000101");
    else {
      const book = XLSX.read(bytes);
      expect(
        XLSX.utils.sheet_to_json<Record<string, unknown>>(
          book.Sheets[book.SheetNames[0]],
        )[0]["MTR Nº"],
      ).toBe("000101");
    }
  }
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  const wait = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar backup JSON", exact: true })
    .click();
  const backup = readFileSync((await (await wait).path())!);
  expect(JSON.parse(backup.toString()).snapshot.records).toHaveLength(2);
  await page
    .locator("input[type=file]")
    .setInputFiles({
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
});
test("rotas e navegação móvel", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await local(page, "/registros");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Visão geral", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Visão geral", exact: true }),
  ).toBeVisible();
});
