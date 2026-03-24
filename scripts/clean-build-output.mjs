import { rm } from "node:fs/promises";
import { resolve } from "node:path";

await rm(resolve("out"), { force: true, recursive: true });
