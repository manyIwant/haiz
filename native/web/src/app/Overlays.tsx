/**
 * Things that float over every page in HAIZ Native: the keyboard and its voice capsule, the update
 * sheet, the developer performance panel, the long-press action wheel. Each costs nothing while
 * closed (the keyboard stays mounted but hidden, so it opens on the first touch without a render).
 */
import { useEffect, lazy, Suspense } from "react";
import { useStore, setState, toast } from "./store";
import { HaizKeyboard } from "../keyboard/Keyboard";
import { Recorder } from "../keyboard/Recorder";
import { autoCheck } from "../update/updater";
import { ActionWheel } from "../ui/ActionWheel";

const UpdateSheet = lazy(() => import("../update/UpdateSheet").then((m) => ({ default: m.UpdateSheet })));
const PerfPanel = lazy(() => import("../ui/PerfPanel").then((m) => ({ default: m.PerfPanel })));

export function Overlays() {
  const upd = useStore((s) => s.updateOpen);
  const perf = useStore((s) => s.perfPanel);
  useEffect(() => { autoCheck((m) => toast(`HAIZ ${m.versionName} 可以更新了 · 在「我」里一键更新`, { tone: "lit" })); }, []);
  return (
    <>
      <HaizKeyboard />
      <Recorder />
      <ActionWheel />
      <Suspense fallback={null}>
        {upd && <UpdateSheet />}
        {perf && <PerfPanel />}
      </Suspense>
    </>
  );
}
export const openUpdate = () => setState({ updateOpen: true });
