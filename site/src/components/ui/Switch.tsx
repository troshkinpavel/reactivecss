export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  title?: string;
}

/** A labelled switch for UI settings (not for example content). */
export function Switch({ checked, onChange, label, title }: SwitchProps) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} title={title} className="flex h-[30px] items-center gap-2 border-0 bg-transparent px-1.5 text-sm whitespace-nowrap">
      <span aria-hidden="true" className={`relative h-[18px] w-[30px] flex-none rounded-full transition-colors duration-200 ${checked ? 'bg-rx' : 'bg-[oklch(0.85_0.006_85)]'}`}>
        <span className={`absolute top-0.5 left-0.5 size-3.5 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.2)] transition-transform duration-200 ease-(--ease-state) ${checked ? 'translate-x-3' : ''}`} />
      </span>
      {label}
    </button>
  );
}
