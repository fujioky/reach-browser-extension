import { EXPIRY_PRESETS, PASSWORD_CHOICES, type ShareOptions } from '@/utils/access';

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; label: string; title?: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-1 gap-1 rounded-sm bg-surface-2 p-0.5" role="radiogroup" aria-label={label}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={`flex-1 rounded-[6px] py-1 text-[12px] transition-colors ${
              selected ? 'bg-surface font-semibold text-ink shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Link limits and the mirror's access password — shared by the popup and the options page. */
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
        <Segmented
          label="有效期"
          options={EXPIRY_PRESETS}
          value={value.expiry}
          onChange={(expiry) => onChange({ ...value, expiry })}
        />
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

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-3">
          <span className="w-14 shrink-0 text-[12px] text-muted">访问密码</span>
          <Segmented
            label="访问密码"
            options={PASSWORD_CHOICES}
            value={value.passwordMode}
            onChange={(passwordMode) => onChange({ ...value, passwordMode })}
          />
        </div>
        {value.passwordMode === 'custom' && (
          <input
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="设置访问密码"
            value={value.password}
            onChange={(e) => onChange({ ...value, password: e.target.value })}
            maxLength={200}
            className="ml-[68px] rounded-sm border border-border bg-surface px-2.5 py-1 text-[12px] text-ink outline-none placeholder:text-subtle focus:border-brand"
            aria-label="访问密码"
          />
        )}
        {value.passwordMode !== 'keep' && (
          <p className="ml-[68px] text-[11px] leading-snug text-subtle">
            密码设在镜像上，这条帖子已有的分享链接也会一起需要它。
          </p>
        )}
      </div>
    </div>
  );
}
