/**
 * HAIZ Native 001 · boot. A returning identity is restored straight into the app; the first launch
 * is the lamp wall. The App is keyed by the identity, so switching re-renders it from the new
 * identity's data and nothing of one identity can linger in another.
 */
import { useEffect, useState, lazy, Suspense } from "react";
import { App } from "./App";
import { useStore, setState } from "./store";
import { restoreLastIdentity, activate } from "../identity/session";
import { createIdentity } from "../identity/repo";
import { pushBack } from "../platform/native";
import { Overlays } from "./Overlays";

const WallLogin = lazy(() => import("../login/WallLogin").then((m) => ({ default: m.WallLogin })));

export function Root() {
  const [boot, setBoot] = useState<"loading" | "wall" | "app">("loading");
  const ident = useStore((s) => s.identity);
  const wallOpen = useStore((s) => s.wallOpen);

  useEffect(() => {
    (async () => {
      let i = await restoreLastIdentity();
      // ?demo=1 makes a sample identity without the wall (the perf bench and quick reviews use it)
      if (!i && /[?&]demo=1/.test(location.search)) {
        const n = await createIdentity({ school: "海南中学", name: "林知夏", cls: "高二（3）班", no: "2024-0317", startFrom: "sample" });
        i = await activate(n.id);
      }
      setBoot(i ? "app" : "wall");
    })();
  }, []);

  useEffect(() => { if (wallOpen) return pushBack(() => setState({ wallOpen: false })); }, [wallOpen]);

  return (
    <>
      {boot === "app" && ident && <App key={ident.id} />}
      {boot !== "loading" && <Overlays />}
      <Suspense fallback={null}>
        {(boot === "wall" || (boot === "app" && !ident)) && <WallLogin mode="first" onDone={() => setBoot("app")} />}
        {boot === "app" && ident && wallOpen && <WallLogin mode="switch" onDone={() => setState({ wallOpen: false })} onCancel={() => setState({ wallOpen: false })} />}
      </Suspense>
    </>
  );
}
