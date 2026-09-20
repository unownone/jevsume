import {
  CHOOSE_FOR_ME_ID,
  CHOOSE_FOR_ME_LABEL,
  groupedResumePresets,
  resolvePresetSelection,
} from "../../shared/resume-presets.ts";

type PresetSelectProps = {
  id: string;
  value: string;
  onChange: (id: string) => void;
  allowEmpty?: boolean;
  emptyLabel?: string;
  label?: string;
  resumeText?: string;
};

export function PresetSelect({
  id,
  value,
  onChange,
  allowEmpty = false,
  emptyLabel = "Choose a default role",
  label = "Default role",
  resumeText,
}: PresetSelectProps) {
  return (
    <label className="job-field">
      <span>{label}</span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(resolvePresetSelection(event.target.value, { resumeText }))}
        aria-label={label}
      >
        {allowEmpty ? <option value="">{emptyLabel}</option> : null}
        <option value={CHOOSE_FOR_ME_ID}>{CHOOSE_FOR_ME_LABEL}</option>
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
