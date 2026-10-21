// Point d'entrée de la bibliothèque : React prend la main sur <div id="root"> de library.html.

import { createRoot } from "react-dom/client";
import "../ui.css";
import Library from "./Library";

createRoot(document.getElementById("root")!).render(<Library />);
