// Hook : garde la fenêtre de la bibliothèque à 1100 × 620 de contenu.
// La taille demandée à Chrome inclut barre de titre et bordures : on mesure l'écart et on compense.

import { useEffect } from "react";

const CONTENT_W = 1100;
const CONTENT_H = 620;

export function useFixedWindowSize() {
  useEffect(() => {
    let fixed: { id: number; width: number; height: number } | null = null; // taille extérieure voulue

    (async () => {
      const win = await chrome.windows.getCurrent();
      if (win.type !== "popup" || win.id == null) return; // ouverte dans un onglet : rien à faire
      fixed = {
        id: win.id,
        width: (win.width ?? 0) + (CONTENT_W - innerWidth),
        height: (win.height ?? 0) + (CONTENT_H - innerHeight),
      };
      if (win.width !== fixed.width || win.height !== fixed.height) {
        await chrome.windows.update(win.id, {
          width: fixed.width,
          height: fixed.height,
        });
      }
    })();

    // Redimensionnée ou agrandie : on remet la taille d'origine.
    const onBounds = (win: chrome.windows.Window) => {
      if (!fixed || win.id !== fixed.id) return;
      if (
        win.state === "normal" &&
        win.width === fixed.width &&
        win.height === fixed.height
      )
        return;
      chrome.windows.update(win.id, {
        state: "normal",
        width: fixed.width,
        height: fixed.height,
      });
    };
    chrome.windows.onBoundsChanged.addListener(onBounds);
    return () => chrome.windows.onBoundsChanged.removeListener(onBounds);
  }, []);
}
