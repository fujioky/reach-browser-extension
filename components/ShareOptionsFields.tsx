import { EXPIRY_PRESETS, type ShareOptions } from '@/utils/access';

/** Expiry presets, a view cap and burn-after-read — shared by the popup and the options page. */
export function ShareOptionsFields({
  value,
  onChange,
}: {
  value: ShareOptions;
  onChange: (next: ShareOptions) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="w-14 shrink-0 text-[12px] text-muted">有效期</span>
        <div className="flex flex-1 gap-1 rounded-sm bg-surface-2 p-0.5" role="radiogroup" aria-label="有效期">
          {EXPIRY_PRESETS.map((preset) => {
            const selected = value.expiry === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange({ ...value, expiry: preset.value })}
                className={`flex-1 rounded-[6px] py-1 text-[12px] transition-colors ${
                  selected ? 'bg-surface font-semibold text-ink shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="w-14 shrink-0 text-[12px] text-muted">打开次数</span>
        <input
          type="number"
          min={1}
          inputMode="numeric"
          placeholder="不限"
          value={value.maxViews ?? ''}
          onChange={(e) => {
            const n = Math.floor(Number(e.target.value));
            onChange({ ...value, maxViews: e.target.value && n > 0 ? n : null });
          }}
          className="w-20 rounded-sm border border-border bg-surface px-2.5 py-1 text-[12px] text-ink outline-none placeholder:text-subtle focus:border-brand"
          aria-label="最多打开次数"
        />
        <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[12px] text-ink">
          <input
            type="checkbox"
            checked={value.burnAfterRead}
            onChange={(e) => onChange({ ...value, burnAfterRead: e.target.checked })}
            className="h-3.5 w-3.5 accent-brand"
          />
          阅后即焚
        </label>
      </div>
    </div>
  );
}
