import { useState, useEffect } from "react";
import { Download, Loader2, CheckCircle, AlertTriangle, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

type DownloadSlug = "oneshot" | "setup" | "agent";

type ReleaseInfo = {
  version: string;
  sizeBytes: number;
  downloadUrl: string;
};

type FetchState =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "ready"; info: ReleaseInfo }
  | { phase: "downloading" }
  | { phase: "error"; message: string; releasesUrl?: string }
  | { phase: "unavailable"; message: string };

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Props = {
  slug: DownloadSlug;
  label: string;
  recommended?: boolean;
  /** If true, eagerly fetches release info on mount */
  preload?: boolean;
};

export default function DownloadButton({ slug, label, recommended, preload = true }: Props) {
  const [state, setState] = useState<FetchState>({ phase: "idle" });

  function cleanErrorMessage(msg?: string): string {
    if (!msg) return "Could not reach download server. Check that the API is running.";
    const normalized = msg.toLowerCase();
    if (
      normalized.includes("failed to fetch") ||
      normalized.includes("network error") ||
      normalized.includes("download unavailable") ||
      normalized.includes("opaque")
    ) {
      return "Could not reach download server. Check that the API is running.";
    }
    return msg;
  }

  async function fetchRelease(): Promise<ReleaseInfo | null> {
    const res = await fetch(`/api/downloads/latest/${slug}`, { method: "GET", redirect: "manual" });

    // Opaque redirect (e.g. redirected to GitHub Releases)
    if (res.type === "opaqueredirect" || res.status === 0) {
      return {
        version: "latest",
        sizeBytes: 0,
        downloadUrl: `/api/downloads/latest/${slug}`,
      };
    }

    // Direct binary served by local API
    if (res.ok) {
      const contentLength = res.headers.get("Content-Length");
      return {
        version: res.headers.get("X-Sentinel-Version") ?? "latest",
        sizeBytes: contentLength ? parseInt(contentLength, 10) : 0,
        downloadUrl: `/api/downloads/latest/${slug}`,
      };
    }

    const body = (await res.json().catch(() => null)) as {
      error?: string;
      releasesUrl?: string;
    } | null;

    if (res.status === 503 || res.status === 404) {
      return null; // signal unavailable
    }

    throw { message: body?.error ?? "Download unavailable.", releasesUrl: body?.releasesUrl };
  }

  // Preload release info on mount so users see version before clicking
  useEffect(() => {
    if (!preload) return;
    setState({ phase: "checking" });
    fetchRelease()
      .then((info) => {
        if (!info) {
          setState({
            phase: "unavailable",
            message: "Not yet published — binaries are built on first deploy. Use the script flow below as an alternative.",
          });
        } else {
          setState({ phase: "ready", info });
        }
      })
      .catch((err: { message?: string; releasesUrl?: string }) => {
        setState({
          phase: "error",
          message: cleanErrorMessage(err?.message),
          releasesUrl: err?.releasesUrl,
        });
      });
   
  }, [slug]);

  async function handleClick() {
    if (state.phase === "ready") {
      setState({ phase: "downloading" });
      window.location.assign(state.info.downloadUrl);
      setTimeout(() => setState({ phase: "ready", info: (state as { phase: "ready"; info: ReleaseInfo }).info }), 3000);
      return;
    }
    if (state.phase === "idle" || state.phase === "error") {
      setState({ phase: "checking" });
      try {
        const info = await fetchRelease();
        if (!info) {
          setState({ phase: "unavailable", message: "Binaries are not yet published. Use the script flow below." });
        } else {
          setState({ phase: "ready", info });
        }
      } catch (err: unknown) {
        const e = err as { message?: string; releasesUrl?: string };
        setState({ phase: "error", message: cleanErrorMessage(e?.message), releasesUrl: e?.releasesUrl });
      }
    }
  }

  const isLoading = state.phase === "checking" || state.phase === "downloading";
  const isReady = state.phase === "ready";
  const isUnavailable = state.phase === "unavailable" || state.phase === "error";

  return (
    <div className="flex flex-col gap-2">
      <motion.button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        initial={recommended ? { scale: 1 } : false}
        animate={recommended ? { scale: [1, 1.02, 1] } : false}
        transition={{ duration: 0.3, type: "spring", bounce: 0.4 }}
        className={`inline-flex w-full items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-semibold transition-all duration-200 disabled:opacity-70 ${
          isUnavailable
            ? "bg-card border border-amber-500/40 text-amber-400/80 cursor-default"
            : recommended
            ? "bg-primary text-background hover:bg-primary/90 glow-cyan hover:scale-[1.02] active:scale-[0.98]"
            : "bg-card border border-border/60 text-foreground hover:border-primary/40 hover:bg-primary/5 hover:scale-[1.02] active:scale-[0.98]"
        }`}
      >
        {state.phase === "checking" && <Loader2 className="w-4 h-4 animate-spin" />}
        {state.phase === "downloading" && <Loader2 className="w-4 h-4 animate-spin" />}
        {state.phase === "ready" && <Download className="w-4 h-4" />}
        {state.phase === "idle" && <Download className="w-4 h-4" />}
        {state.phase === "unavailable" && <AlertTriangle className="w-4 h-4" />}
        {state.phase === "error" && <AlertTriangle className="w-4 h-4" />}

        {state.phase === "checking" && "Checking for latest release…"}
        {state.phase === "downloading" && "Starting download…"}
        {state.phase === "idle" && label}
        {state.phase === "ready" && label}
        {state.phase === "unavailable" && "Not yet published"}
        {state.phase === "error" && "Retry download"}
      </motion.button>

      {/* Status line under button */}
      {state.phase === "ready" && (
        <div className="flex items-center gap-1.5 text-xs text-green-400 font-mono">
          <CheckCircle className="w-3 h-3" />
          Version {state.info.version} ready
          {state.info.sizeBytes > 0 && ` · ${formatBytes(state.info.sizeBytes)}`}
        </div>
      )}

      {state.phase === "unavailable" && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-400/90 leading-relaxed">
          <p className="font-medium mb-1">Installer not yet published</p>
          <p className="text-amber-400/70">
            {state.message} Use the{" "}
            <a href="/health-test" className="underline underline-offset-2 hover:text-amber-300 transition-colors">
              script paste-back flow
            </a>{" "}
            in the meantime — it produces the identical report.
          </p>
        </div>
      )}

      {state.phase === "error" && (
        <div className="rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2.5 text-xs text-red-400/90 leading-relaxed">
          <p className="font-medium mb-1">Download server unreachable</p>
          <p className="text-red-400/70">{state.message}</p>
          {state.releasesUrl && (
            <a
              href={state.releasesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 underline underline-offset-2 hover:text-red-300 transition-colors"
            >
              Open GitHub Releases <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {state.phase === "checking" && (
        <div className="flex flex-col gap-1.5 mt-1">
          <div className="text-[10px] text-muted-foreground/50 font-mono tracking-widest uppercase">Checking for latest release…</div>
          <div className="w-full bg-border/40 rounded-full h-1 overflow-hidden relative">
            <motion.div 
              className="absolute top-0 left-0 h-full bg-primary"
              initial={{ width: "0%" }}
              animate={{ width: "90%" }}
              transition={{ duration: 10, ease: "easeOut" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
