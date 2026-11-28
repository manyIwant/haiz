import { useState } from "react";
import { useStore, setState, readNotice } from "../app/store";
import { go } from "../app/router";
import { CLUBS, PHOTOS } from "../data/demo";
import { PageHead } from "../ui/PageHead";
import { Section } from "../ui/Section";
import { Demo, Segmented, Icon } from "../ui/controls";
import { CampusMap, useBuildings } from "./CampusMap";
import "./pages.css";

type Sub = "notice" | "club" | "map" | "culture";

export function Campus({ phone, sub }: { phone: boolean; sub: string }) {
  const tab: Sub = (["notice", "club", "map", "culture"] as Sub[]).includes(sub as Sub) ? (sub as Sub) : "notice";
  return (
    <div className="campus">
      <PageHead kicker="Campus · 海南中学府城校区" title="校园" sub="公告、社团、地图与文化。建筑与照片来自 HAIZ 校园模型与学校官网。"
        aside={!phone && <Segmented<Sub> value={tab} onChange={(v) => go("campus/" + v)} label="校园分区" options={[{ id: "notice", label: "公告" }, { id: "club", label: "社团" }, { id: "map", label: "地图" }, { id: "culture", label: "文化" }]} />} />
      {phone && (
        <div className="campus-seg" data-rv>
          <Segmented<Sub> value={tab} onChange={(v) => go("campus/" + v)} label="校园分区" options={[{ id: "notice", label: "公告" }, { id: "club", label: "社团" }, { id: "map", label: "地图" }, { id: "culture", label: "文化" }]} />
        </div>
      )}
      {tab === "notice" && <Notices phone={phone} />}
      {tab === "club" && <Clubs />}
      {tab === "map" && <MapView phone={phone} />}
      {tab === "culture" && <Culture />}
    </div>
  );
}

function Notices({ phone }: { phone: boolean }) {
  const notices = useStore((s) => s.notices);
  const [lead, ...rest] = notices;
  const featured = notices.find((n) => n.img) ?? lead;
  return (
    <>
      <Section kicker="Notices" title="公告" action={<Demo>公告内容为演示</Demo>}>
        <div className={"notice-grid" + (phone ? " is-phone" : "")}>
          <button type="button" className="notice-feature" onClick={(e) => { readNotice(featured.id); setState({ inspector: { kind: "notice", id: featured.id, from: e.currentTarget.getBoundingClientRect() } }); }}>
            {featured.img && <img src={featured.img} alt="" loading="lazy" />}
            <span className="nf-cap">
              <span className="nf-k">{featured.tag} · {featured.from}</span>
              <b>{featured.title}</b>
              <span className="nf-x">{featured.body}</span>
              {featured.credit && <small>{featured.credit}</small>}
            </span>
          </button>
          <ul className="nlist">
            {[lead, ...rest].filter((n) => n !== featured).map((n) => (
              <li key={n.id}>
                <button type="button" className={"nrow" + (n.unread ? " is-unread" : "")} onClick={(e) => { readNotice(n.id); setState({ inspector: { kind: "notice", id: n.id, from: e.currentTarget.getBoundingClientRect() } }); }}>
                  <i className="nrow-dot" /><span className="nrow-t">{n.title}</span><span className="nrow-m">{n.from} · {n.time}</span><span className="nrow-tag">{n.tag}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Section>
    </>
  );
}

function Clubs() {
  return (
    <Section kicker="Clubs" title="社团" action={<Demo>活动安排为演示</Demo>}>
      <ul className="clubs">
        {CLUBS.map((c) => (
          <li key={c.id}>
            <button type="button" className="club" onClick={(e) => setState({ inspector: { kind: "club", id: c.id, from: e.currentTarget.getBoundingClientRect() } })}>
              <span className="club-img">{c.img ? <img src={c.img} alt="" loading="lazy" /> : <Icon kind="club" size={34} />}</span>
              <span className="club-b">
                <b>{c.name}</b>
                <span>{c.meta}</span>
                <span className="club-next"><i />{c.next}</span>
              </span>
              <span className="club-n t-num">{c.members}<small>人</small></span>
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function MapView({ phone }: { phone: boolean }) {
  const list = useBuildings();
  const [hl, setHl] = useState<string | null>(null);
  const [hov, setHov] = useState<string | null>(null);
  return (
    <Section kicker="Map · 校园本地坐标" title="地图" action={<span className="t-meta">{list.length} 处地点</span>}>
      <div className={"mapview" + (phone ? " is-phone" : "")}>
        <div className="mapview-map"><CampusMap height={phone ? 400 : 430} focus={hl} onHover={setHov} /></div>
        <ul className="mapview-list" onPointerLeave={() => setHl(null)}>
          {list.map((b) => (
            <li key={b.key}>
              <button type="button" className={"bl" + ((hl ?? hov) === b.key ? " is-on" : "")} onPointerEnter={() => setHl(b.key)} onFocus={() => setHl(b.key)} onBlur={() => setHl(null)}
                onClick={(e) => setState({ inspector: { kind: "building", id: b.name, from: e.currentTarget.getBoundingClientRect() } })}>
                <span className="bl-t">{b.name}</span><span className="bl-m">{b.category}</span>{PHOTOS[b.name] && <i className="bl-photo" title="有照片" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <p className="foot-note">平面来自 HAIZ 校园模型（实测平面图导出，项目说明精度与绝对方向尚未独立复核）；仅供认识校园，不用于导航。</p>
    </Section>
  );
}

function Culture() {
  const items = [
    { to: "rings", t: "年轮", s: "1940 年以来每一天的天气，画成一段横截面", img: "img/render/tree_poster.jpg", k: "ERA5 再分析" },
    { to: "tree", t: "榄仁", s: "一株大叶榄仁的一年：新叶、浓荫、红叶与落叶", img: "img/web/lanshu-1600.jpg", k: "物候 · 约" },
    { to: "wander", t: "入画", s: "把校园的一角，交给画笔", img: "img/painted/lanshu-golden-lab-painting.jpg", k: "绘画实验" },
  ];
  return (
    <>
      <Section kicker="Culture" title="文化">
        <ul className="culture">
          {items.map((it) => (
            <li key={it.to}>
              <button type="button" className="cult" onClick={(e) => go(it.to, e.currentTarget)}>
                <img src={it.img} alt="" loading="lazy" />
                <span className="cult-cap"><small>{it.k}</small><b>{it.t}</b><span>{it.s}</span></span>
              </button>
            </li>
          ))}
        </ul>
      </Section>
      <Section kicker="Since 1923" title="一百年">
        <div className="century">
          <figure><img src="img/campus/old_photo.jpg" alt="海南中学旧时校门与学生的老照片" loading="lazy" /><figcaption>旧时校园 · 图：海南中学官网</figcaption></figure>
          <figure><img src="img/campus/centennial_2020.jpg" alt="海南中学师生在操场上列队集会" loading="lazy" /><figcaption>今天的操场 · 师生集会 · 图：海南中学官网</figcaption></figure>
        </div>
      </Section>
    </>
  );
}
