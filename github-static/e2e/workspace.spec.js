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

test("switches to the syntax tab without losing the workspace database", async ({ page }) => {
    const apiRequests = [];
    page.on("request", (request) => {
        if (request.url().includes("/api/")) apiRequests.push(request.url());
    });

    await page.goto("/index.html");
    await page.locator("#editor").fill("CREATE TABLE Student (StudentID INTEGER); INSERT INTO Student VALUES (1);");
    await page.getByRole("button", { name: "Run Query" }).click();
    await page.getByRole("tab", { name: "Syntax Reference" }).click();
    await expect(page).toHaveURL(/#syntax$/);
    await expect(page.getByRole("heading", { name: "CREATE TABLE" })).toBeVisible();
    await page.getByRole("button", { name: "DML" }).click();
    await expect(page.getByRole("heading", { name: "SELECT ... FROM" })).toBeVisible();
    await page.locator("#theme-toggle").click();
    await expect(page.getByRole("button", { name: "DML" })).toHaveCSS("color", "rgb(247, 251, 255)");
    await expect(page.locator("#syntax-error")).toHaveCount(0);
    await page.getByRole("tab", { name: "Workspace" }).click();
    await expect(page.getByRole("button", { name: /Student/ })).toBeVisible();
    await expect(page.locator("#editor")).toHaveValue("CREATE TABLE Student (StudentID INTEGER); INSERT INTO Student VALUES (1);");
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
