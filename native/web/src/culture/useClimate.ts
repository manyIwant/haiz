import { now as clockNow } from "../app/time";
/** The 年轮 archive (ERA5 via Open-Meteo, CC BY 4.0), loaded once and shared. */
import { useEffect, useState } from "react";
import { loadClimate, indexOfDate, parts } from "./rings/climate";

let cache: any = null;
let pending: Promise<any> | null = null;
export function getClimate(): Promise<any> {
  if (cache) return Promise.resolve(cache);
  if (!pending) pending = loadClimate(new URL("./data/", document.baseURI)).then((c: any) => (cache = c));
  return pending;
}
export function useClimate() {
  const [c, setC] = useState<any>(cache);
  useEffect(() => { if (!c) getClimate().then(setC).catch(() => {}); }, [c]);
  return c;
}
const WMO: Record<number, string> = { 0: "晴", 1: "大致晴", 2: "多云", 3: "阴", 45: "雾", 48: "雾", 51: "小毛毛雨", 53: "毛毛雨", 55: "毛毛雨", 61: "小雨", 63: "中雨", 65: "大雨", 80: "阵雨", 81: "阵雨", 82: "强阵雨", 95: "雷阵雨", 96: "雷阵雨", 99: "强雷阵雨" };
export const wmo = (code: number | null) => (code == null ? "—" : WMO[code] ?? "多变");
/** the same calendar day one year ago (the archive lags about a week behind today) */
export function sameDayLastYear(c: any) {
  const d = clockNow();
  let i = indexOfDate(d.getFullYear() - 1, d.getMonth() + 1, d.getDate());
  i = c.clampIndex(i);
  const r = c.row(i), p = parts(i);
  return { i, tmax: r.tmax ?? 0, tmin: r.tmin ?? 0, rain: r.rain ?? 0, gust: r.gust ?? 0, code: r.code, label: `${p.y} 年 ${p.m} 月 ${p.d} 日 · ${wmo(r.code)}` };
}
