// Builds public/aisle/water-layer.js: resolves the WGSL (validating it against a
// real device when one is available), bundles the browser runtime with vgpu inlined,
// then rejects the output if it would trip scripts/verify.mjs's forbidden-pattern scan.
import { writeFileSync, readFileSync, statSync } from "node:fs";
import { resolveShader } from "@vgpu/wgsl/runtime";
import { build } from "esbuild";

const resolved = await resolveShader({
  entry: new URL("./water.wgsl", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
  validate: "auto",
  minify: true,
});
if (resolved.validation?.attempted && !resolved.validation.ok) {
  console.error(resolved.validation.error);
  throw new Error("WGSL validation failed");
}
writeFileSync(new URL("./water.resolved.json", import.meta.url),
  JSON.stringify({ wgsl: resolved.wgsl }));

const out = new URL("../../public/aisle/water-layer.js", import.meta.url);
await build({
  entryPoints: [new URL("./entry.js", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")],
  outfile: out.pathname.replace(/^\/([A-Za-z]:)/, "$1"),
  bundle: true, format: "esm", minify: true, sourcemap: false,
  target: ["chrome121", "safari18", "firefox141"],
  legalComments: "none",
  banner: { js: "// Built artifact. Source: tools/water/ (entry.js + water.wgsl). Rebuild: cd tools/water && npm install && npm run build" },
});

// scripts/verify.mjs scans every served .js for these; fail the build, not the check.
const bundled = readFileSync(out, "utf8");
const forbidden = /(?:\/(?:Users|Volumes|home)\/[^\s"']+|file:\/\/|sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/;
const hit = bundled.match(forbidden);
if (hit) throw new Error("Bundle contains a verify.mjs forbidden pattern: " + hit[0].slice(0, 60));

console.log("water-layer.js:", statSync(out).size, "bytes");
