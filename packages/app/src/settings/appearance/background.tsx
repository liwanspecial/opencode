import { Show, createSignal } from "solid-js"
import { Button } from "@opencode/ui/button"
import { Select } from "@opencode/ui/select"
import { Switch } from "@opencode/ui/switch"
import { useLanguage } from "@/runtime/i18n/language"
import { usePlatform } from "@/runtime/platform/platform"
import { SettingsList } from "@/settings/list"
import { useSettings, type BackgroundFit } from "@/settings/model"
import { SettingsRow } from "@/settings/row"
import { showToast } from "@/shell/notifications/toast"

const fitOptions: BackgroundFit[] = ["cover", "contain", "repeat"]

type Action = "choose" | "clear"

type ActionState = "idle" | Action

function transition(state: ActionState, event: Action | "settled"): ActionState {
  if (event === "settled") return "idle"

  return state === "idle" ? event : state
}

export function BackgroundSettings() {
  const platform = usePlatform()
  const language = useLanguage()
  const appearance = useSettings().appearance
  const [state, setState] = createSignal<ActionState>("idle")
  const busy = () => state() !== "idle"
  const opacity = () => `${Math.round(appearance.backgroundOpacity() * 100)}%`
  const blur = () => `${appearance.backgroundBlur()}px`

  const perform = async (action: Action) => {
    if (action === "clear") {
      await platform.clearBackgroundImage?.()
      appearance.clearBackground()

      return
    }

    const path = await platform.openBackgroundImagePickerDialog?.({
      title: language.t("settings.general.background.choose.title"),
    })

    if (path) appearance.setBackgroundImage(path)
  }

  const run = (action: Action) => {
    const current = state()
    const next = transition(current, action)

    if (next === current) return

    setState(next)
    void perform(action)
      .catch(() => showToast({ variant: "error", title: language.t("common.requestFailed") }))
      .finally(() => setState((current) => transition(current, "settled")))
  }

  return (
    <Show
      when={
        platform.platform === "desktop" &&
        platform.getLocalFileUrl &&
        platform.openBackgroundImagePickerDialog &&
        platform.clearBackgroundImage
      }
    >
      <div class="settings-section">
        <SettingsList>
          <SettingsRow
            title={language.t("settings.general.background.image.title")}
            description={
              <Show
                when={appearance.backgroundImage()}
                fallback={language.t("settings.general.background.image.description")}
              >
                {(path) => (
                  <span class="block truncate" title={path()}>
                    {path()}
                  </span>
                )}
              </Show>
            }
          >
            <div class="flex items-center gap-2">
              <Button size="small" variant="neutral" disabled={busy()} onClick={() => run("choose")}>
                {language.t("settings.general.background.choose")}
              </Button>
              <Button
                size="small"
                variant="ghost"
                disabled={busy() || !appearance.backgroundImage()}
                onClick={() => run("clear")}
              >
                {language.t("settings.general.background.clear")}
              </Button>
            </div>
          </SettingsRow>

          <SettingsRow
            title={language.t("settings.general.background.enabled.title")}
            description={language.t("settings.general.background.enabled.description")}
          >
            <Switch
              hideLabel
              checked={appearance.backgroundEnabled()}
              disabled={busy() || !appearance.backgroundImage()}
              onChange={appearance.setBackgroundEnabled}
            >
              {language.t("settings.general.background.enabled.title")}
            </Switch>
          </SettingsRow>

          <SettingsRow
            title={language.t("settings.general.background.fit.title")}
            description={language.t("settings.general.background.fit.description")}
          >
            <Select
              aria-label={language.t("settings.general.background.fit.title")}
              options={fitOptions}
              current={appearance.backgroundFit()}
              placement="bottom-end"
              gutter={6}
              label={(fit) => language.t(`settings.general.background.fit.${fit}`)}
              onSelect={(fit) => fit && appearance.setBackgroundFit(fit)}
            />
          </SettingsRow>

          <SettingsRow title={language.t("settings.general.background.opacity.title")} description={opacity()}>
            <input
              aria-label={language.t("settings.general.background.opacity.title")}
              aria-valuetext={opacity()}
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={appearance.backgroundOpacity()}
              onInput={(event) => appearance.setBackgroundOpacity(event.currentTarget.valueAsNumber)}
              class="w-full sm:w-[180px] accent-[var(--v2-background-bg-accent)]"
            />
          </SettingsRow>

          <SettingsRow title={language.t("settings.general.background.blur.title")} description={blur()}>
            <input
              aria-label={language.t("settings.general.background.blur.title")}
              aria-valuetext={blur()}
              type="range"
              min="0"
              max="24"
              step="1"
              value={appearance.backgroundBlur()}
              onInput={(event) => appearance.setBackgroundBlur(event.currentTarget.valueAsNumber)}
              class="w-full sm:w-[180px] accent-[var(--v2-background-bg-accent)]"
            />
          </SettingsRow>
        </SettingsList>
      </div>
    </Show>
  )
}
