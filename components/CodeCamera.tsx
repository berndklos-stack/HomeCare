"use client";

import { useEffect, useRef } from "react";
import type { IScannerControls } from "@zxing/browser";
import styles from "./OperationsWorkspace.module.css";

export function CodeCamera({ onCode, onError, label }: { onCode: (code: string) => void; onError: () => void; label: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const callbacks = useRef({ onCode, onError });
  useEffect(() => { callbacks.current = { onCode, onError }; }, [onCode, onError]);
  useEffect(() => {
    let cancelled = false, captured = false;
    let stream: MediaStream | undefined;
    let controls: IScannerControls | undefined;
    const stop = () => { controls?.stop(); stream?.getTracks().forEach((track) => track.stop()); };
    const hide = () => { if (document.hidden && !cancelled) { cancelled = true; stop(); callbacks.current.onError(); } };
    document.addEventListener("visibilitychange", hide);
    async function start() {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      if (cancelled) return;
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" } } });
      if (cancelled || !video.current) { stop(); return; }
      controls = await new BrowserMultiFormatReader().decodeFromStream(stream, video.current, (result, _error, scanner) => {
        if (!result || cancelled || captured) return;
        captured = true; scanner.stop(); stop();
        callbacks.current.onCode(result.getText());
      });
      if (cancelled || captured) stop();
    }
    void start().catch(() => { stop(); if (!cancelled) callbacks.current.onError(); });
    return () => { cancelled = true; stop(); document.removeEventListener("visibilitychange", hide); };
  }, []);
  return <video ref={video} className={styles.scanVideo} aria-label={label} muted playsInline />;
}
