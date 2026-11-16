import "@/index.css"
import { VoiceProvider } from "@/voice/context"
import { VoiceOverlay } from "@/voice/composer"
import { DialogProvider } from "@opencode/ui/context/dialog"
import { FileComponentProvider } from "@opencode/ui/context/file"
import { Font } from "@opencode/ui/font"
import { ThemeProvider } from "@opencode/ui/theme/context"
import { MetaProvider, Title } from "@solidjs/meta"
import { type BaseRouterProps, Router } from "@solidjs/router"
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query"
import {
  type Component,
  createEffect,
  createRenderEffect,
  createSignal,
  ErrorBoundary,
  type JSX,
  onCleanup,
  type ParentProps,
  Show,
} from "solid-js"
import { Dynamic } from "solid-js/web"
import { CommandProvider } from "@/shell/commands/command"
import { DesktopCommands } from "@/shell/commands/desktop"
import { ProjectIconsProvider } from "@/shell/layout/project-icons"
import { GlobalProvider } from "@/runtime/server/runtime"
import { LanguageProvider, UiI18nBridge, type Locale } from "@/runtime/i18n/language"
import { usePlatform } from "@/runtime/platform/platform"
import { ServerConnection, ServersProvider } from "@/runtime/server/registry"
import { SettingsProvider, useSettings } from "@/settings/model"
import { TabsProvider } from "@/shell/tabs/tabs"
import { ErrorPage } from "@/shell/errors/error"
import { AppRoutes, File, preloadRoute } from "@/shell/routes/routes"
import { PluginRoot } from "@/runtime/plugin/root"

export { preloadRoute }

function QueryProvider(props: ParentProps) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
      },
    },
  })

  return <QueryClientProvider client={client}>{props.children}</QueryClientProvider>
}

function BodyTypography() {
  createRenderEffect(() => {
    if (typeof document === "undefined") return
    document.body.classList.remove("text-12-regular")
    document.body.classList.add("font-(family-name:--font-family-text)", "text-[13px]", "font-[440]")
  })

  return null
}

function AppBackground() {
  const platform = usePlatform()
  const settings = useSettings()
  const [imageUrl, setImageUrl] = createSignal<string>()

  createEffect(() => {
    const path = settings.appearance.backgroundImage()
    if (!settings.appearance.backgroundEnabled() || !path || !platform.getLocalFileUrl) return

    let active = true
    let url: string | undefined
    onCleanup(() => {
      active = false
      if (url) URL.revokeObjectURL(url)
      setImageUrl(undefined)
    })

    void platform
      .getLocalFileUrl(path)
      .then((result) => {
        if (!result) return
        if (!active) {
          URL.revokeObjectURL(result)
          return
        }
        url = result
        setImageUrl(result)
      })
      .catch(() => undefined)
  })

  return (
    <Show when={imageUrl()}>
      {(url) => (
        <div
          aria-hidden="true"
          class="fixed inset-0 z-[9999] pointer-events-none bg-center"
          style={{
            "background-image": `url("${url()}")`,
            "background-size":
              settings.appearance.backgroundFit() === "repeat" ? "auto" : settings.appearance.backgroundFit(),
            "background-repeat": settings.appearance.backgroundFit() === "repeat" ? "repeat" : "no-repeat",
            opacity: settings.appearance.backgroundOpacity(),
            filter: settings.appearance.backgroundBlur()
              ? `blur(${settings.appearance.backgroundBlur()}px)`
              : undefined,
            transform: settings.appearance.backgroundBlur() ? "scale(1.02)" : undefined,
          }}
        />
      )}
    </Show>
  )
}

export function AppBaseProviders(
  props: ParentProps<{
    locale?: Locale
    onNativeTranslations?: Parameters<typeof LanguageProvider>[0]["onNativeTranslations"]
    onThemeApplied?: (mode: "light" | "dark", scheme: "system" | "light" | "dark") => void
  }>,
) {
  return (
    <MetaProvider>
      <Title>OpenCode</Title>
      <Font />
      <ThemeProvider onThemeApplied={(mode, scheme) => props.onThemeApplied?.(mode, scheme)}>
        <LanguageProvider locale={props.locale} onNativeTranslations={props.onNativeTranslations}>
          <UiI18nBridge>
            <ErrorBoundary
              fallback={(error) => {
                void import("@sentry/solid").then(({ captureException }) => captureException(error))

                return <ErrorPage error={error} />
              }}
            >
              <QueryProvider>
                <DialogProvider>
                  <PluginRoot>
                    <FileComponentProvider component={File}>{props.children}</FileComponentProvider>
                  </PluginRoot>
                </DialogProvider>
              </QueryProvider>
            </ErrorBoundary>
          </UiI18nBridge>
        </LanguageProvider>
      </ThemeProvider>
    </MetaProvider>
  )
}

export function AppInterface(props: {
  children?: JSX.Element
  canonicalLocalServer?: ServerConnection.Key
  servers?: Array<ServerConnection.Any>
  router?: Component<BaseRouterProps>
}) {
  // The visual layout lives in the router root so it remains mounted across
  // route changes. Draft and session routes override only their server-bound data
  // providers beneath it.
  const Root = (rootProps: ParentProps) => (
    <TabsProvider>
      <GlobalProvider>
        <ProjectIconsProvider>
          <BodyTypography />
          <CommandProvider>
            <DesktopCommands />
            <VoiceProvider>
              {props.children}
              {rootProps.children}
              <VoiceOverlay />
            </VoiceProvider>
          </CommandProvider>
        </ProjectIconsProvider>
      </GlobalProvider>
    </TabsProvider>
  )

  return (
    <ServersProvider canonicalLocalServer={props.canonicalLocalServer} servers={props.servers}>
      <SettingsProvider>
        <AppBackground />
        <Dynamic component={props.router ?? Router} root={Root}>
          <AppRoutes />
        </Dynamic>
      </SettingsProvider>
    </ServersProvider>
  )
}
