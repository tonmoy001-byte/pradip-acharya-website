"use client"

import { useEffect, useRef } from "react"

/** How long the hero holds the final frame before playing again. */
const DEFAULT_LOOP_PAUSE_MS = 15_000

interface HeroVideoProps {
  src: string
  poster?: string
  className?: string
  /** Milliseconds of stillness between the end of one play and the next. */
  loopPauseMs?: number
}

/**
 * Decorative background video with a deliberate pause between plays.
 *
 * The `loop` attribute cannot be used here: while it is set the browser
 * restarts the video without ever firing `ended`, so there is nowhere to hang
 * a delay. The pause is therefore driven from the `ended` event, which also
 * means the wait starts exactly when playback finishes rather than from a
 * fixed offset.
 *
 * The element is intentionally not `loop`ed as a fallback: if hydration fails
 * the video plays once and holds its last frame, which reads as intentional
 * rather than broken.
 */
export default function HeroVideo({
  src,
  poster,
  className,
  loopPauseMs = DEFAULT_LOOP_PAUSE_MS,
}: HeroVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // A self-playing background loop is decorative motion. Users who have
    // asked for reduced motion get the poster instead.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.pause()
      return
    }

    function clearPendingLoop() {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    function scheduleNextPlay() {
      clearPendingLoop()
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        if (!video) return
        video.currentTime = 0
        // Autoplay can still be refused (low-power mode, reduced data); the
        // poster remains visible, so a rejection here is not worth surfacing.
        video.play().catch(() => {})
      }, loopPauseMs)
    }

    video.addEventListener("ended", scheduleNextPlay)

    return () => {
      video.removeEventListener("ended", scheduleNextPlay)
      clearPendingLoop()
    }
  }, [loopPauseMs])

  return (
    <video
      ref={videoRef}
      className={className}
      autoPlay
      muted
      playsInline
      preload="metadata"
      poster={poster}
      aria-hidden="true"
      tabIndex={-1}
    >
      <source src={src} type="video/mp4" />
    </video>
  )
}
