import { cn } from '@/lib/utils';
import {
  THEME_PREFERENCES,
  useThemePreference,
  type ThemePreference,
} from '@/lib/theme';
import { SettingsSection } from './SettingsSection';

const LABELS: Record<ThemePreference, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

/**
 * The Appearance tab: Light, Dark or System as preview cards. The choice
 * goes through `useThemePreference`, so it applies at once, is remembered in
 * this browser, and agrees with the theme switch in the user menu.
 */
export function AppearanceTab() {
  const { preference, setPreference } = useThemePreference();

  return (
    <SettingsSection
      title="Theme"
      description="Applies to this browser. System follows your device setting."
    >
      <div
        role="radiogroup"
        aria-label="Theme"
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        {THEME_PREFERENCES.map((value) => {
          const checked = value === preference;
          return (
            <label
              key={value}
              className={cn(
                'bg-card has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-background flex cursor-pointer flex-col gap-3 rounded-xl has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2',
                checked ? 'border-primary border-2 p-[11px]' : 'border p-3'
              )}
            >
              <input
                type="radio"
                name="theme"
                value={value}
                aria-label={LABELS[value]}
                checked={checked}
                onChange={() => setPreference(value)}
                className="sr-only"
              />
              <ThemePreview preference={value} />
              <span className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    'size-[18px] shrink-0 rounded-full',
                    checked
                      ? 'border-primary border-[5px]'
                      : 'border-muted-foreground border-[1.5px]'
                  )}
                />
                <span className="text-sm font-medium">{LABELS[value]}</span>
              </span>
            </label>
          );
        })}
      </div>
    </SettingsSection>
  );
}

/** A small picture of the app in a theme: System shows both halves. */
function ThemePreview({ preference }: { preference: ThemePreference }) {
  return (
    <div
      aria-hidden="true"
      className="flex h-[150px] overflow-hidden rounded-lg border"
    >
      {preference !== 'dark' ? (
        // `.light` and `.dark` scope the tokens, so each half shows its own
        // palette whatever theme the page is in.
        <div className="light flex flex-1">
          <MiniApp />
        </div>
      ) : null}
      {preference !== 'light' ? (
        <div className="dark flex flex-1">
          <MiniApp />
        </div>
      ) : null}
    </div>
  );
}

function MiniApp() {
  return (
    <div className="bg-background flex h-full flex-1">
      <div className="bg-sidebar border-sidebar-border flex w-[30%] flex-col gap-1.5 border-r px-2 py-2.5">
        <span className="bg-primary h-2 w-[70%] rounded-[3px]" />
        <span className="bg-sidebar-accent h-2 rounded-[3px]" />
        <span className="bg-muted h-2 w-4/5 rounded-[3px]" />
        <span className="bg-muted h-2 w-3/5 rounded-[3px]" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <span className="bg-foreground h-2.5 w-1/2 rounded-[3px] opacity-85" />
        <span className="bg-card h-[34px] rounded-md border" />
        <span className="bg-card h-[34px] rounded-md border" />
      </div>
    </div>
  );
}
