const fs = require("node:fs/promises");
const path = require("node:path");
const { PurgeCSS } = require("purgecss");
const config = require("../purgecss.config.js");

async function main() {
  const site = path.resolve(process.argv[2] || "_site");
  const options = { ...config };
  for (const key of ["content", "css", "skippedContentGlobs"]) {
    options[key] = config[key].map((pattern) => pattern.replace(/^_site/, site));
  }

  // Use the API so CommonJS configuration is loaded consistently across Node
  // versions. An empty result must fail instead of silently skipping the step.
  const results = await new PurgeCSS().purge(options);
  if (!results.length) throw new Error(`No CSS files found in ${site}`);
  for (const result of results) {
    if (!result.file || !result.css.trim()) throw new Error("CSS optimization produced an empty stylesheet");
    await fs.writeFile(result.file, result.css);
  }
  console.log(`Optimized ${results.length} stylesheets in ${site}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
