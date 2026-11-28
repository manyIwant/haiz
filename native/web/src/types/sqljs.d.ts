declare module "sql.js" {
  const init: (cfg?: { locateFile?: (f: string) => string; wasmBinary?: ArrayBuffer }) => Promise<any>;
  export default init;
}
