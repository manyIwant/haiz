import { installAndroid } from './platform/android';
import { createRoot } from "react-dom/client";
import "./styles/fonts.generated.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/icons.css";
import "./ui/controls.css";
import "./app/shell.css";
import { App } from "./app/App";
import { installLight } from "./ui/light";

installLight();
installAndroid();

createRoot(document.getElementById("root")!).render(<App />);
