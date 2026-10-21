// Pastille de statut = interrupteur pause / reprise (composant Figma « Statut »).
// Rond à droite = surveillance active, à gauche = pause. Style : .status dans ui.css.

interface Props {
  enabled: boolean; // surveillance active ?
  connected: boolean; // WebSocket connecté ?
  onToggle: () => void;
}

export default function StatusPill({ enabled, connected, onToggle }: Props) {
  const text = enabled && connected ? 'connected' : 'offline';
  const cls = !enabled ? 'status off paused' : connected ? 'status ok' : 'status off';

  return (
    <button
      className={cls}
      type="button"
      role="switch"
      aria-checked={enabled}
      title={enabled ? 'Pause monitoring' : 'Resume monitoring'}
      onClick={onToggle}>
      <span className="status-label">
        <span>{text}</span>
        {/* Mot invisible qui réserve la largeur de « connected » : la pastille ne change pas de taille */}
        <span className="sizer" aria-hidden="true">
          connected
        </span>
      </span>
      <span className="knob"></span>
    </button>
  );
}
