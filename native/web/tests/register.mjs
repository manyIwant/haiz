// Lets node --test load the app's TypeScript as Vite does: extensionless relative imports resolve to
// .ts / .tsx, and stylesheet imports are empty modules.
import { register } from "node:module";
register("data:text/javascript," + encodeURIComponent(`
  export async function resolve(spec, ctx, next) {
    if (/\\.css$/.test(spec)) return { url: "data:text/javascript,export default {}", shortCircuit: true };
    if ((spec.startsWith("./") || spec.startsWith("../")) && !/\\.[cm]?[jt]sx?$/.test(spec)) {
      for (const ext of [".ts", ".tsx", "/index.ts"]) { try { return await next(spec + ext, ctx); } catch {} }
    }
    return next(spec, ctx);
  }
`));
