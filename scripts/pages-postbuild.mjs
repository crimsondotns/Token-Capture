import { copyFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const out = join(process.cwd(), "dist-pages");
copyFileSync(join(out, "index.html"), join(out, "404.html"));
writeFileSync(join(out, ".nojekyll"), "");
console.log("pages postbuild: 404.html + .nojekyll");
