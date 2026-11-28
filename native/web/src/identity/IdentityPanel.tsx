/**
 * 校园身份 · managing identities in 我: every identity as a lamp, the current one lit; edit it,
 * switch (the lamp wall), back everything up to a file, import a backup, delete one. All local.
 */
import { useEffect, useState } from "react";
import { useStore, setState, toast, getState } from "../app/store";
import { listIdentities, updateIdentity, deleteIdentity, exportBackup, importBackup, type Identity, type LampTone } from "./repo";
import { activate, flush } from "./session";
import { saveText, openText } from "../platform/native";
import { DotField } from "../ui/DotField";
import "./identity.css";

const TONE: Record<LampTone, string> = { amber: "#f0a35a", ivory: "#e9c99c", jade: "#5fbf91", dusk: "#a98ad8" };
const NAMES: Record<LampTone, string> = { amber: "琥珀", ivory: "月白", jade: "青玉", dusk: "暮紫" };

export function IdentityPanel() {
  const cur = useStore((s) => s.identity);
  const [list, setList] = useState<Identity[]>([]);
  const [edit, setEdit] = useState<Identity | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const reload = () => listIdentities().then((l) => setList(l.sort((a, b) => a.seq - b.seq))).catch(() => {});
  useEffect(() => { void reload(); }, [cur?.id, cur?.updatedAt]);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(null), 3000); return () => clearTimeout(t); }, [armed]);

  const save = async () => {
    if (!edit || !edit.name.trim() || !edit.school.trim()) { toast("学校和姓名不能为空"); return; }
    await updateIdentity(edit.id, { school: edit.school, name: edit.name, cls: edit.cls, no: edit.no, lamp: edit.lamp, role: edit.role });
    if (edit.id === cur?.id) await activate(edit.id);
    setEdit(null); void reload();
    toast("身份已更新", { tone: "lit" });
  };
  const remove = async (i: Identity) => {
    if (armed !== i.id) { setArmed(i.id); return; }
    setArmed(null);
    await flush();
    await deleteIdentity(i.id);
    const rest = (await listIdentities()).sort((a, b) => b.lastUsedAt - a.lastUsedAt);
    if (i.id === cur?.id) {
      if (rest[0]) await activate(rest[0].id);
      else setState({ identity: null });              // the last one: back to the wall
    }
    void reload();
    toast(`已删除「${i.name}」及其全部数据`);
  };
  const backup = async () => {
    await flush();
    const b = await exportBackup();
    try { await saveText(`HAIZ-身份备份-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(b, null, 1)); toast(`已导出 ${b.identities.length} 个身份`, { tone: "lit" }); }
    catch (e: any) { if (!/cancel/i.test(String(e?.message))) toast("导出没有完成"); }
  };
  const restore = async () => {
    try {
      const text = await openText();
      await flush();
      const n = await importBackup(JSON.parse(text));
      const id = getState().identity?.id;
      if (id) await activate(id);                       // the current identity may have been replaced
      void reload();
      toast(`已导入 ${n} 个身份`, { tone: "lit" });
    } catch (e: any) { if (!/cancel/i.test(String(e?.message))) toast(e?.message?.includes("备份") ? e.message : "无法读取这个文件"); }
  };

  return (
    <div className="idp">
      <ul className="idp-list">
        {list.map((i) => (
          <li key={i.id} className={"idp-row" + (i.id === cur?.id ? " is-cur" : "")} style={{ ["--c" as any]: TONE[i.lamp] }}>
            <i className="idp-lamp" aria-hidden="true" />
            <div className="idp-t"><b>{i.name}</b><span>{[i.school, i.cls, i.role === "teacher" ? "教师" : "学生"].filter(Boolean).join(" · ")}</span></div>
            <div className="idp-a">
              {i.id === cur?.id ? <span className="idp-now">当前</span> : <button type="button" onClick={() => void activate(i.id)}>切换</button>}
              <button type="button" onClick={() => setEdit({ ...i })}>编辑</button>
              <button type="button" className={"idp-del" + (armed === i.id ? " is-armed" : "")} onClick={() => void remove(i)}>{armed === i.id ? "再点一次删除" : "删除"}</button>
            </div>
          </li>
        ))}
      </ul>
      {edit && (
        <div className="idp-edit glaze" style={{ ["--dotf-lit" as any]: TONE[edit.lamp] }}>
          <DotField label="学校" value={edit.school} onChange={(v) => setEdit({ ...edit, school: v })} />
          <DotField label="姓名" value={edit.name} onChange={(v) => setEdit({ ...edit, name: v })} />
          <div className="idp-two">
            <DotField label="班级" value={edit.cls} onChange={(v) => setEdit({ ...edit, cls: v })} dots={12} />
            <DotField label="学号" value={edit.no} onChange={(v) => setEdit({ ...edit, no: v })} dots={12} inputMode="numeric" />
          </div>
          <div className="idp-tones" role="radiogroup" aria-label="灯色">
            {(Object.keys(TONE) as LampTone[]).map((t) => <button key={t} type="button" role="radio" aria-checked={edit.lamp === t} className={edit.lamp === t ? "is-on" : ""} style={{ ["--c" as any]: TONE[t] }} onClick={() => setEdit({ ...edit, lamp: t })}><i />{NAMES[t]}</button>)}
          </div>
          <div className="idp-ea"><button type="button" onClick={() => setEdit(null)}>取消</button><button type="button" className="is-pri" onClick={() => void save()}>保存</button></div>
        </div>
      )}
      <div className="idp-foot">
        <button type="button" className="set-btn" onClick={() => setState({ wallOpen: true })}>灯墙 · 切换或新建</button>
        <button type="button" className="set-btn" onClick={() => void backup()}>导出备份</button>
        <button type="button" className="set-btn" onClick={() => void restore()}>导入备份</button>
      </div>
      <p className="idp-note">每个身份的学校、姓名、课表、待办、笔记、收藏、成长记录与偏好分开保存在这台设备的 SQLite 数据库里，不上传任何服务器；应用更新会保留它们。卸载应用会清除它们，请先导出备份。</p>
    </div>
  );
}
