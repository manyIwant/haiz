import React from "react";
import { createRoot } from "react-dom/client";
import { motion, MotionConfig, useReducedMotion } from "motion/react";
import { LampContainer } from "./components/ui/lamp";
import "./styles.css";

function Entrance() {
  const reduced = useReducedMotion();
  const appear = reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 26 };
  const motionTo = { opacity: 1, y: 0 };
  const timing = (delay: number) => ({
    duration: reduced ? 0 : .85,
    delay: reduced ? 0 : delay,
    ease: "easeOut" as const,
  });
  return (
    <main className="entry-shell">
      {/* This is the unmodified official Aceternity LampContainer, loaded from its registry. */}
      <LampContainer className="original-lamp !min-h-[100svh] !rounded-none">
        <span aria-hidden="true" />
      </LampContainer>
      <div className="entry-overlay">
        <motion.header className="identity" initial={appear} animate={motionTo} transition={timing(.32)}>
          <h1>HAIZ</h1>
          <p>POCKET / CAMPUS</p>
        </motion.header>
        <motion.section className="login-panel" initial={appear} animate={motionTo} transition={timing(.46)} aria-labelledby="welcome">
          <p className="eyebrow">HAIZ / 本机空间</p>
          <h2 id="welcome">欢迎回来</h2>
          <p className="desc">你的课表、待办与校园空间，<br />从这里开始。</p>
          <a className="enter" href="./app/?fromLamp=1">进入本机空间&nbsp; →</a>
          <p className="privacy">仅打开此设备的访客数据 · 无账号验证或云端同步</p>
        </motion.section>
        <motion.p className="footer" initial={appear} animate={motionTo} transition={timing(.66)}>
          A QUIETER WAY TO STAY CONNECTED
        </motion.p>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <Entrance />
    </MotionConfig>
  </React.StrictMode>
);
