import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const baseDir = dirname(fileURLToPath(import.meta.url));

describe("transaction responsive styles", () => {
  test("stacks the transaction workspace before the ledger becomes cramped", () => {
    const styles = readFileSync(resolve(baseDir, "../styles.css"), "utf8");

    expect(styles).toMatch(/@media\s*\(max-width:\s*1440px\)[\s\S]*?\.transaction-workspace[\s\S]*?grid-template-columns:\s*1fr;/);
    expect(styles).toMatch(/@media\s*\(max-width:\s*1440px\)[\s\S]*?\.transaction-settings-panel[\s\S]*?position:\s*static;/);
  });

  test("returns transaction filters to one column on phone-sized screens", () => {
    const styles = readFileSync(resolve(baseDir, "../styles.css"), "utf8");

    expect(styles).toMatch(/@media\s*\(max-width:\s*620px\)[\s\S]*?\.transaction-settings-content[\s\S]*?grid-template-columns:\s*1fr;/);
    expect(styles).toMatch(/@media\s*\(max-width:\s*620px\)[\s\S]*?\.transaction-filter-actions[\s\S]*?grid-template-columns:\s*1fr;/);
  });
});
