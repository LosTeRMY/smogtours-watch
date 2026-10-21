// Bouton Refresh : interroge le serveur tout de suite.
// Grisé pendant la requête et quand la surveillance est en pause.

import { useState } from 'react';

export default function RefreshButton({ disabled }: { disabled: boolean }) {
  const [busy, setBusy] = useState(false); // état local : true pendant la requête

  async function refresh() {
    setBusy(true);
    await chrome.runtime.sendMessage({ type: 'pollNow' });
    setBusy(false);
  }

  return (
    <button title="Query the server now" disabled={disabled || busy} onClick={refresh}>
      Refresh
    </button>
  );
}
