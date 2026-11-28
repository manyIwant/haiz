import type { Analysis, Kind } from "./analyze";

export type SourceKey = "wechat" | "qq" | "tim" | "dingtalk" | "chaoxing" | "share" | "paste";
export const SOURCE_LABEL: Record<SourceKey, string> = { wechat: "微信", qq: "QQ", tim: "TIM", dingtalk: "钉钉", chaoxing: "学习通", share: "系统分享", paste: "手动粘贴" };
/** the apps intake can listen to, in the order the settings list them (each has its own switch) */
export const LISTEN_SOURCES: SourceKey[] = ["wechat", "qq", "dingtalk", "chaoxing", "tim"];

export type InboxItem = {
  id: string;
  source: SourceKey;
  group: string;
  sender: string;
  text: string;
  receivedAt: number;
  result: Analysis;
  status: "pending" | "confirmed" | "dismissed";
  /** what the student changed before confirming */
  edit?: { title?: string; subject?: string; kind?: Kind; due?: string | null };
  /** other groups the same notice arrived from (dedupe) */
  also?: string[];
  linked?: { taskId?: string; eventId?: string };
  decidedAt?: number;
};
export type IntakeConfig = { enabled: boolean; groups: string[]; sources: Partial<Record<SourceKey, boolean>> };
