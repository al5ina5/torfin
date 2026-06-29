import { useCallback, useRef, useState } from 'react'

import type { MediaInfo } from '../types'

type PlaybackSessionState = {
  playbackUrl: string
  playbackTitle: string
  playbackStatus: string
  playbackError: string
  playbackStartAt: number | null
  playbackDuration: number | null
  playbackMediaOffset: number
  mediaInfo: MediaInfo | null
  selectedAudioIndex: number | null
  selectedSubtitleIndex: number | null
  currentSourceUrl: string
  nativePlayback: { player: string; title: string; mode: 'external' | 'window' } | null
}

const initialPlaybackState = (): PlaybackSessionState => ({
  playbackUrl: '',
  playbackTitle: '',
  playbackStatus: '',
  playbackError: '',
  playbackStartAt: null,
  playbackDuration: null,
  playbackMediaOffset: 0,
  mediaInfo: null,
  selectedAudioIndex: null,
  selectedSubtitleIndex: null,
  currentSourceUrl: '',
  nativePlayback: null,
})

export function usePlaybackSession() {
  const [state, setState] = useState<PlaybackSessionState>(initialPlaybackState)
  const playbackGenerationRef = useRef(0)
  const playbackRecoveryCountRef = useRef(0)
  const lastPlaybackErrorRef = useRef('')
  const activePlaybackStreamRef = useRef<{ stream: import('../types').StreamResult; index: number } | null>(null)

  const resetPlayback = useCallback(() => {
    playbackGenerationRef.current += 1
    playbackRecoveryCountRef.current = 0
    setState(initialPlaybackState())
  }, [])

  const patchPlayback = useCallback((patch: Partial<PlaybackSessionState>) => {
    setState((current) => ({ ...current, ...patch }))
  }, [])

  return {
    ...state,
    patchPlayback,
    resetPlayback,
    playbackGenerationRef,
    playbackRecoveryCountRef,
    lastPlaybackErrorRef,
    activePlaybackStreamRef,
  }
}
