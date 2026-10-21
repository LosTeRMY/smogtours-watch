// Bouton clair / sombre (composant Figma « Theme »).
// L'icône montre le mode vers lequel on bascule : lune en clair, soleil en sombre.
// Le thème lui-même est appliqué par public/theme.js (avant React, pour éviter un flash).

import { useState } from "react";
import { MoonIcon, SunIcon } from "./icons";

declare global {
  interface Window {
    setTheme(theme: "light" | "dark"): void; // défini dans public/theme.js
  }
}

export default function ThemeButton() {
  const [dark, setDark] = useState(
    document.documentElement.dataset.theme === "dark",
  );

  function toggle() {
    window.setTheme(dark ? "light" : "dark");
    setDark(!dark);
  }

  return (
    <button
      className="icon-btn"
      type="button"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggle}>
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
