// Ligne avec un libellé à gauche et un interrupteur à droite. Style : .switch-row / .switch dans ui.css.

interface Props {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export default function Switch({ label, checked, onChange }: Props) {
  return (
    <label className="switch-row">
      <span>{label}</span>
      <input
        type="checkbox"
        className="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
