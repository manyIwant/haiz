import { installAndroid } from './platform/android';
import { installNative } from './platform/native';
import { createRoot } from "react-dom/client";
import "./styles/fonts.generated.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/icons.css";
import "./ui/controls.css";
import "./app/shell.css";
import { Root } from "./app/Root";
import { installLight } from "./ui/light";

installLight();
installAndroid();
installNative();

createRoot(document.getElementById("root")!).render(<Root />);
