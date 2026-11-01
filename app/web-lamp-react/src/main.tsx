import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { motion, MotionConfig, useReducedMotion } from "motion/react";
import "./styles.css";

// Faithful wall-lamp scene from the user-provided reference.
// Account authentication is not available in Pocket yet, so these two
// input-shaped elements are visual only and never collect credentials.
function AccountOutline({ label, icon }: { label: string; icon: "user" | "lock" }) {
  return (
    <div className="input-outline" aria-hidden="true">
      <span>{label}</span>
      {icon === "user" ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="7" r="4" /><path d="M4 21c0-4.5 3.5-8 8-8s8 3.5 8 8z"/>
        </svg>
      ) : (
        <svg width="14" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 9V7a5 5 0 0 1 10 0v2h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2zm2 0h6V7a3 3 0 1 0-6 0z"/>
        </svg>
      )}
    </div>
  );
}

function Entrance() {
  const reduced = useReducedMotion();
  const [sequence, setSequence] = useState(0);
  const initial = reduced ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 24, scale: 0.985 };
  return (
    <main className="wall-scene">
      <div className="lighting-stage" key={sequence} aria-hidden="true">
        <div className="wall-photo" />
        <div className="wall-illumination" />
        <div className="wall-ray" />
        <div className="light-bloom" />
        <div className="lamp-halo" />
        <div className="lamp-highlight" />
      </div>
      <motion.section
        key={sequence}
        className="login-card"
        initial={initial}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: reduced ? 0 : 1, delay: reduced ? 0 : 1.18, ease: [0.16, 1, 0.3, 1] }}
        aria-labelledby="login-title"
      >
        <h1 id="login-title">Login</h1>
        <div className="account-outlines" aria-label="账号及密码输入栏仅作视觉预览；目前不提供账户登录">
          <AccountOutline label="Username" icon="user" />
          <AccountOutline label="Password" icon="lock" />
        </div>
        <div className="login-options" aria-hidden="true">
          <span><span className="checkbox-square" />Remember me</span>
          <span>Forgot password?</span>
        </div>
        <a href="./app/?fromLamp=1" className="primary-enter"
          aria-label="进入 HAIZ Pocket 本机访客空间，没有账户认证">
          Login
        </a>
        <p className="register" aria-hidden="true">Don't have an account? <strong>Register</strong></p>
      </motion.section>
      <p className="access-note">HAIZ POCKET · 本机访客体验，不需要填写账号或密码</p>
      <button className="replay-light" type="button" onClick={() => setSequence((previous) => previous + 1)} aria-label="重新播放壁灯点亮动画">
        <span aria-hidden="true">↺</span> 重播灯光
      </button>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user"><Entrance /></MotionConfig>
  </React.StrictMode>
);
