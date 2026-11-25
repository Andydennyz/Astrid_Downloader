import { copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const clientOutput = resolve(projectRoot, "dist", "android", "client");

await copyFile(
  resolve(clientOutput, "_shell.html"),
  resolve(clientOutput, "index.html"),
);
