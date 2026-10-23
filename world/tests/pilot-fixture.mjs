import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import http from "node:http";
import https from "node:https";
import { createPilotServer } from "../pilot/server.mjs";
export async function pilotFixture(options = {}) {
  const directory = mkdtempSync(join(tmpdir(), "haiz-pilot-"));
  const certPath = join(directory, "cert.pem"),
    keyPath = join(directory, "key.pem");
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      keyPath,
      "-out",
      certPath,
      "-days",
      "1",
      "-subj",
      "/CN=localhost",
      "-addext",
      "subjectAltName=DNS:localhost,IP:127.0.0.1",
    ],
    { stdio: "ignore" },
  );
  const reserve = http.createServer();
  await new Promise((r) => reserve.listen(0, "127.0.0.1", r));
  const port = reserve.address().port;
  await new Promise((r) => reserve.close(r));
  const origin = `https://127.0.0.1:${port}`,
    tls = { key: readFileSync(keyPath), cert: readFileSync(certPath) };
  let pilot = createPilotServer({ directory, origin, tls, ...options });
  await new Promise((r) => pilot.server.listen(port, "127.0.0.1", r));
  const call = (route, { cookie = "", body, headers = {} } = {}) =>
    new Promise((resolve, reject) => {
      const req = https.request(
        origin + route,
        {
          ca: tls.cert,
          agent: false,
          method: body ? "POST" : "GET",
          headers: {
            Origin: origin,
            ...(cookie ? { Cookie: cookie } : {}),
            ...(body
              ? {
                  "Content-Type": "application/json",
                  "Idempotency-Key": crypto.randomUUID(),
                }
              : {}),
            ...headers,
          },
        },
        (res) => {
          let raw = "";
          res.on("data", (c) => (raw += c));
          res.on("end", () => {
            let value;
            try {
              value = JSON.parse(raw);
            } catch {
              value = raw;
            }
            resolve({
              status: res.statusCode,
              body: value,
              headers: res.headers,
              cookie: res.headers["set-cookie"]?.[0].split(";")[0],
            });
          });
        },
      );
      req.on("error", reject);
      req.end(body ? JSON.stringify(body) : undefined);
    });
  return {
    origin,
    call,
    directory,
    get pilot() {
      return pilot;
    },
    bootstrap: readFileSync(pilot.bootstrapFile, "utf8"),
    restart: async () => {
      await pilot.close();
      pilot = createPilotServer({ directory, origin, tls, ...options });
      await new Promise((r) => pilot.server.listen(port, "127.0.0.1", r));
    },
    close: async () => {
      await pilot.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
