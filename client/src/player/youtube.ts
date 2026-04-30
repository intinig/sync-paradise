import { decideDriftAction } from "./drift.js";
import { decideStartAction } from "./scheduling.js";

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string | HTMLElement,
        config: YTPlayerConfig,
      ) => YTPlayer;
      PlayerState: { ENDED: 0; PLAYING: 1; PAUSED: 2; BUFFERING: 3; CUED: 5 };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayerConfig {
  videoId: string;
  width?: number | string;
  height?: number | string;
  playerVars?: Record<string, number | string>;
  events?: { onReady?: (e: { target: YTPlayer }) => void };
}

interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  mute: () => void;
  unMute: () => void;
  setVolume: (v: number) => void;
  getCurrentTime: () => number;
  setPlaybackRate: (rate: number) => void;
  destroy: () => void;
}

let apiReadyPromise: Promise<void> | null = null;
function loadApi(): Promise<void> {
  if (apiReadyPromise) return apiReadyPromise;
  apiReadyPromise = new Promise<void>((resolve) => {
    if (window.YT?.Player) { resolve(); return; }
    window.onYouTubeIframeAPIReady = () => resolve();
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);
  });
  return apiReadyPromise;
}

export interface SyncedPlayerOptions {
  container: HTMLElement;
  videoId: string;
  muted: boolean;
  getOffsetMs: () => number;
}

export interface SyncedPlayer {
  scheduleStart(playAtServerMs: number): void;
  correctDrift(expectedSec: number): void;
  setMuted(muted: boolean): void;
  currentTime(): number;
  dispose(): void;
}

export async function createSyncedPlayer(opts: SyncedPlayerOptions): Promise<SyncedPlayer> {
  await loadApi();
  let player: YTPlayer;
  await new Promise<void>((resolve) => {
    player = new window.YT!.Player(opts.container, {
      videoId: opts.videoId,
      width: "100%",
      height: "100%",
      playerVars: { autoplay: 0, controls: 0, disablekb: 1, modestbranding: 1, playsinline: 1, rel: 0 },
      events: { onReady: () => resolve() },
    });
  });
  if (opts.muted) player!.mute();
  let scheduledTimeout: ReturnType<typeof setTimeout> | null = null;

  return {
    scheduleStart(playAtServerMs) {
      if (scheduledTimeout) clearTimeout(scheduledTimeout);
      const action = decideStartAction({
        playAtServerMs,
        offsetMs: opts.getOffsetMs(),
        nowMs: Date.now(),
      });
      if (action.kind === "live") {
        // Late open / reconnect — jump to the live playhead immediately.
        player.seekTo(action.playheadSec, true);
        if (!opts.muted) player.unMute();
        player.playVideo();
        return;
      }
      if (action.kind === "imminent") {
        // No pre-buffer phase — seek to 0 and play at T.
        player.seekTo(0, true);
        scheduledTimeout = setTimeout(() => {
          if (!opts.muted) player.unMute();
          player.playVideo();
        }, action.playInMs);
        return;
      }
      // future: pre-buffer at T-2s, then play at T.
      scheduledTimeout = setTimeout(() => {
        player.seekTo(0, true);
        scheduledTimeout = setTimeout(() => {
          if (!opts.muted) player.unMute();
          player.playVideo();
        }, Math.max(0, playAtServerMs - opts.getOffsetMs() - Date.now()));
      }, action.preDelayMs);
    },
    correctDrift(expectedSec) {
      const action = decideDriftAction({ expectedSec, currentSec: player.getCurrentTime() });
      if (action.kind === "none") return;
      // Single-strategy correction: hard seek. Rate-nudging produced audible
      // warbling at every 5s tick because real drift sat in the 50–200ms band
      // and the rate adjustment never settled.
      player.seekTo(action.toSec, true);
    },
    setMuted(muted) {
      if (muted) player.mute(); else player.unMute();
    },
    currentTime() { return player.getCurrentTime(); },
    dispose() {
      if (scheduledTimeout) clearTimeout(scheduledTimeout);
      try { player.destroy(); } catch { /* ignore */ }
    },
  };
}
