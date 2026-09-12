import { expect, test } from "playwright/test";

test("runs SQL locally, updates the table viewer, and exports a database", async ({ page }) => {
    const apiRequests = [];
    page.on("request", (request) => {
        if (request.url().includes("/api/")) apiRequests.push(request.url());
    });

    await page.goto("/index.html");
    await page.locator("#editor").fill("CREATE TABLE Student (StudentID INTEGER, Name VARCHAR(20)); INSERT INTO Student VALUES (1, 'Amina'); SELECT * FROM Student;");
    await page.getByRole("button", { name: "Run Query" }).click();

    await expect(page.getByText("Query executed successfully")).toBeVisible();
    await expect(page.getByRole("button", { name: /Student/ })).toBeVisible();
    await expect(page.locator("#table-view-content").getByText("Amina")).toBeVisible();
    await expect(apiRequests).toEqual([]);

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export Database" }).click();
    expect((await download).suggestedFilename()).toBe("cambridge-practice.db");
});

test("renders syntax reference without an API request", async ({ page }) => {
    const apiRequests = [];
    page.on("request", (request) => {
        if (request.url().includes("/api/")) apiRequests.push(request.url());
    });

    await page.goto("/syntax.html");
    await expect(page.getByRole("heading", { name: "CREATE TABLE" })).toBeVisible();
    await page.getByRole("button", { name: "DML" }).click();
    await expect(page.getByRole("heading", { name: "SELECT ... FROM" })).toBeVisible();
    await page.getByRole("button", { name: "Toggle dark mode" }).click();
    await expect(page.getByRole("button", { name: "DML" })).toHaveCSS("color", "rgb(247, 251, 255)");
    await expect(page.locator("#syntax-error")).toHaveCount(0);
    await expect(apiRequests).toEqual([]);
});

test("shows only the storage workflow supported by the browser", async ({ page }) => {
    await page.goto("/index.html");
    const supportsFileSystemAccess = await page.evaluate(() => typeof window.showOpenFilePicker === "function" && typeof window.showSaveFilePicker === "function");

    await expect(page.getByRole("button", { name: "Export Database" })).toBeVisible();
    if (supportsFileSystemAccess) {
        await expect(page.getByRole("button", { name: "Open Database" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Save Database As" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Import Database" })).toBeHidden();
    } else {
        await expect(page.getByRole("button", { name: "Open Database" })).toBeHidden();
        await expect(page.getByRole("button", { name: "Save Database As" })).toBeHidden();
        await expect(page.getByRole("button", { name: "Import Database" })).toBeVisible();
    }
});
