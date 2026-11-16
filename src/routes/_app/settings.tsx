import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { PageContainer, Panel } from "@/components/layout.tsx";
import DataLoadError from "@/components/data-load-error.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { SETTINGS_QUERY_KEY, useSettings } from "@/hooks/use-media-data.ts";
import { getServices, type AppSettings } from "@/services/index.ts";
import { errorMessage } from "@/services/errors.ts";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings · MediaDock" }] }),
  component: Page,
});

function SettingsRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-border/80 pb-4 last:border-0 last:pb-0 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="font-medium">{label}</div>
        {hint && <div className="text-sm text-muted-foreground">{hint}</div>}
      </div>
      <div className="min-w-[220px] max-w-[320px] flex-1 md:flex md:justify-end">{children}</div>
    </div>
  );
}

function Page() {
  const queryClient = useQueryClient();
  const settingsQuery = useSettings();
  const settings = settingsQuery.data;

  const update = async (updater: (current: AppSettings) => AppSettings) => {
    if (!settings) return;
    const next = updater(settings);
    try {
      await getServices().settings.update(next);
      queryClient.setQueryData(SETTINGS_QUERY_KEY, next);
    } catch (error) {
      toast.error(errorMessage(error, "Could not save your settings."));
    }
  };

  if (!settings) {
    return (
      <PageContainer>
        {settingsQuery.isError ? (
          <DataLoadError error={settingsQuery.error} onRetry={() => void settingsQuery.refetch()} />
        ) : (
          <Panel className="p-8 text-sm text-muted-foreground">Loading preferences…</Panel>
        )}
      </PageContainer>
    );
  }

  return (
    <PageContainer className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Customize the app</p>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Settings</h2>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            void getServices().settings.reset()
              .then((next) => queryClient.setQueryData(SETTINGS_QUERY_KEY, next))
              .catch((error: unknown) => toast.error(errorMessage(error, "Could not reset settings.")));
          }}
        >
          Reset defaults
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">General</h3>
          </div>
          <div className="space-y-4">
            <SettingsRow label="Download location" hint="A folder under the backend STORAGE_PATH; use a relative folder.">
              <input
                value={settings.general.downloadLocation}
                onChange={(event) => void update((current) => ({ ...current, general: { ...current.general, downloadLocation: event.target.value } }))}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-primary"
              />
            </SettingsRow>
            <SettingsRow label="Default video quality" hint="Chosen when you start a fresh download.">
              <select
                value={settings.general.defaultVideoQuality}
                onChange={(event) => void update((current) => ({ ...current, general: { ...current.general, defaultVideoQuality: event.target.value as AppSettings["general"]["defaultVideoQuality"] } }))}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-primary"
              >
                <option value="best">Best available</option>
                <option value="2160p">2160p</option>
                <option value="1440p">1440p</option>
                <option value="1080p">1080p</option>
                <option value="720p">720p</option>
                <option value="480p">480p</option>
                <option value="360p">360p</option>
              </select>
            </SettingsRow>
            <SettingsRow label="Default audio format" hint="Used when the source is an audio-first page.">
              <select
                value={settings.general.defaultAudioFormat}
                onChange={(event) => void update((current) => ({ ...current, general: { ...current.general, defaultAudioFormat: event.target.value as AppSettings["general"]["defaultAudioFormat"] } }))}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-primary"
              >
                <option value="best">Best available</option>
                <option value="mp3">MP3</option>
                <option value="m4a">M4A</option>
                <option value="wav">WAV</option>
                <option value="flac">FLAC</option>
              </select>
            </SettingsRow>
            <SettingsRow label="Container preference" hint="Select MP4 or WebM where allowed.">
              <select
                value={settings.general.defaultContainer}
                onChange={(event) => void update((current) => ({ ...current, general: { ...current.general, defaultContainer: event.target.value as AppSettings["general"]["defaultContainer"] } }))}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-primary"
              >
                <option value="mp4">MP4</option>
                <option value="webm">WebM</option>
              </select>
            </SettingsRow>
            <SettingsRow label="Auto-organize by type" hint="Create separate folders for audio and video downloads.">
              <Switch checked={settings.general.organizeByType} onCheckedChange={(checked) => void update((current) => ({ ...current, general: { ...current.general, organizeByType: Boolean(checked) } }))} />
            </SettingsRow>
            <SettingsRow label="Auto-organize by creator" hint="Group media into creator folders when available.">
              <Switch checked={settings.general.organizeByCreator} onCheckedChange={(checked) => void update((current) => ({ ...current, general: { ...current.general, organizeByCreator: Boolean(checked) } }))} />
            </SettingsRow>
            <SettingsRow label="Launch at startup" hint="Open MediaDock when your computer starts.">
              <Switch checked={settings.general.launchAtStartup} onCheckedChange={(checked) => void update((current) => ({ ...current, general: { ...current.general, launchAtStartup: Boolean(checked) } }))} />
            </SettingsRow>
            <SettingsRow label="Start minimized" hint="Open in the tray instead of the full window.">
              <Switch checked={settings.general.startMinimized} onCheckedChange={(checked) => void update((current) => ({ ...current, general: { ...current.general, startMinimized: Boolean(checked) } }))} />
            </SettingsRow>
          </div>
        </Panel>

        <Panel className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Download behavior</h3>
          </div>
          <div className="space-y-4">
            <SettingsRow label="Maximum simultaneous downloads" hint="Limits active jobs at one time.">
              <input
                type="number"
                min={1}
                max={10}
                value={settings.downloads.maxSimultaneous}
                onChange={(event) => void update((current) => ({ ...current, downloads: { ...current.downloads, maxSimultaneous: Number(event.target.value) || 1 } }))}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-primary"
              />
            </SettingsRow>
            <SettingsRow label="Default mode" hint="The initial download mode when opening the composer.">
              <select
                value={settings.downloads.defaultMode}
                onChange={(event) => void update((current) => ({ ...current, downloads: { ...current.downloads, defaultMode: event.target.value as AppSettings["downloads"]["defaultMode"] } }))}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-primary"
              >
                <option value="video+audio">Video + audio</option>
                <option value="video">Video only</option>
                <option value="audio">Audio only</option>
              </select>
            </SettingsRow>
            <SettingsRow label="Automatically start new downloads" hint="Queue items begin processing immediately.">
              <Switch checked={settings.downloads.autoStart} onCheckedChange={(checked) => void update((current) => ({ ...current, downloads: { ...current.downloads, autoStart: Boolean(checked) } }))} />
            </SettingsRow>
            <SettingsRow label="Clear completed downloads from queue" hint="Remove items from the queue once they finish.">
              <Switch checked={settings.downloads.clearCompletedFromQueue} onCheckedChange={(checked) => void update((current) => ({ ...current, downloads: { ...current.downloads, clearCompletedFromQueue: Boolean(checked) } }))} />
            </SettingsRow>
            <SettingsRow label="Auto retry failed jobs" hint="Attempt a retry automatically after a brief delay.">
              <Switch checked={settings.downloads.autoRetry} onCheckedChange={(checked) => void update((current) => ({ ...current, downloads: { ...current.downloads, autoRetry: Boolean(checked) } }))} />
            </SettingsRow>
            <SettingsRow label="Retry attempts" hint="How many times to retry on failure.">
              <input
                type="number"
                min={1}
                max={10}
                value={settings.downloads.retryAttempts}
                onChange={(event) => void update((current) => ({ ...current, downloads: { ...current.downloads, retryAttempts: Number(event.target.value) || 1 } }))}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-primary"
              />
            </SettingsRow>
          </div>
        </Panel>

        <Panel className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Appearance</h3>
          </div>
          <div className="space-y-4">
            <SettingsRow label="Accent color" hint="Sets the application highlight tone.">
              <div className="flex flex-wrap gap-2">
                {(["violet", "indigo", "cyan", "emerald", "rose"] as const).map((accent) => (
                  <button
                    key={accent}
                    type="button"
                    onClick={() => void update((current) => ({ ...current, appearance: { ...current.appearance, accent } }))}
                    className={`h-9 w-9 rounded-full border-2 ${settings.appearance.accent === accent ? "border-foreground" : "border-transparent"} ${accent === "violet" ? "bg-violet-500" : accent === "indigo" ? "bg-indigo-500" : accent === "cyan" ? "bg-cyan-500" : accent === "emerald" ? "bg-emerald-500" : "bg-rose-500"}`}
                    aria-label={`Use ${accent} accent`}
                  />
                ))}
              </div>
            </SettingsRow>
            <SettingsRow label="Interface density" hint="Compact or roomy spacing for lists and panels.">
              <select
                value={settings.appearance.density}
                onChange={(event) => void update((current) => ({ ...current, appearance: { ...current.appearance, density: event.target.value as AppSettings["appearance"]["density"] } }))}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-primary"
              >
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </select>
            </SettingsRow>
          </div>
        </Panel>

        <Panel className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Advanced</h3>
          </div>
          <div className="space-y-4">
            <SettingsRow label="Preferred format ID" hint="Optional backend override for raw format selection.">
              <input
                value={settings.advanced.preferredFormatId}
                onChange={(event) => void update((current) => ({ ...current, advanced: { ...current.advanced, preferredFormatId: event.target.value } }))}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-primary"
              />
            </SettingsRow>
            <SettingsRow label="Filename template" hint="Template used when naming a download.">
              <input
                value={settings.advanced.filenameTemplate}
                onChange={(event) => void update((current) => ({ ...current, advanced: { ...current.advanced, filenameTemplate: event.target.value } }))}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-primary"
              />
            </SettingsRow>
            <SettingsRow label="Write metadata" hint="Store title, artist and source information in the output file.">
              <Switch checked={settings.advanced.writeMetadata} onCheckedChange={(checked) => void update((current) => ({ ...current, advanced: { ...current.advanced, writeMetadata: Boolean(checked) } }))} />
            </SettingsRow>
            <SettingsRow label="Download subtitles" hint="Include subtitle tracks where available.">
              <Switch checked={settings.advanced.downloadSubtitles} onCheckedChange={(checked) => void update((current) => ({ ...current, advanced: { ...current.advanced, downloadSubtitles: Boolean(checked) } }))} />
            </SettingsRow>
            <SettingsRow label="Subtitle language" hint="Preferred language for subtitle downloads.">
              <select
                value={settings.advanced.subtitleLanguage}
                onChange={(event) => void update((current) => ({ ...current, advanced: { ...current.advanced, subtitleLanguage: event.target.value } }))}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-primary"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="ja">Japanese</option>
              </select>
            </SettingsRow>
            <SettingsRow label="Embed thumbnail" hint="Include cover art in the final media file.">
              <Switch checked={settings.advanced.embedThumbnail} onCheckedChange={(checked) => void update((current) => ({ ...current, advanced: { ...current.advanced, embedThumbnail: Boolean(checked) } }))} />
            </SettingsRow>
            <SettingsRow label="Embed audio metadata" hint="Store artist and album metadata in audio files.">
              <Switch checked={settings.advanced.embedAudioMetadata} onCheckedChange={(checked) => void update((current) => ({ ...current, advanced: { ...current.advanced, embedAudioMetadata: Boolean(checked) } }))} />
            </SettingsRow>
          </div>
        </Panel>
      </div>
    </PageContainer>
  );
}
