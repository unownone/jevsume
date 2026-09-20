import { groupedResumePresets } from "../../shared/resume-presets.ts";

type PresetSelectProps = {
  id: string;
  value: string;
  onChange: (id: string) => void;
  allowEmpty?: boolean;
  emptyLabel?: string;
  label?: string;
};

export function PresetSelect({
  id,
  value,
  onChange,
  allowEmpty = false,
  emptyLabel = "Choose a default role",
  label = "Default role",
}: PresetSelectProps) {
  return (
    <label className="job-field">
      <span>{label}</span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
      >
        {allowEmpty ? <option value="">{emptyLabel}</option> : null}
        {groupedResumePresets().map((group) => (
          <optgroup key={group.track} label={group.label}>
            {group.items.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.title}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
