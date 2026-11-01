import React from "react";
import { createRoot } from "react-dom/client";

async function mount() {
  const tools = /^\/tools(?:\/|$)/.test(location.pathname);
  const [{ App }] = await Promise.all(tools
    ? [import("./tools/ToolsApp.jsx"), import("./tools/tools.css")]
    : [import("./App.jsx"), import("./styles.css")]);
  createRoot(document.getElementById("root")).render(
    <React.StrictMode><App /></React.StrictMode>,
  );
}

mount().catch(() => {
  const message = document.createElement("p");
  message.textContent = "页面未能载入。请重新加载；已保存的本机记录不会被删除。";
  document.getElementById("root").replaceChildren(message);
});
