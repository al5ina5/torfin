export type MkvPlayerSource = string | File | Blob;
export type PlaybackStrategy = "native" | "server-remux" | "server-transcode" | "server-hls" | "unsupported";
export type ServerConfig = {
    baseUrl: string;
    enabled?: boolean;
    delivery?: "cache" | "live" | "hls";
};
export type AudioTrack = {
    id: string;
    index: number;
    label?: string;
    language?: string;
    codec?: string;
    channels?: string;
    default?: boolean;
};
export type SubtitleTrack = {
    id: string;
    index?: number;
    src?: string;
    label?: string;
    language?: string;
    codec?: string;
    kind?: "subtitles" | "captions" | "forced";
    default?: boolean;
};
export type Chapter = {
    id: string;
    title: string;
    start: number;
    end?: number;
};
export type MkvPlayerMetadata = {
    duration?: number;
    title?: string;
    videoCodec?: string;
    audioTracks: AudioTrack[];
    subtitleTracks: SubtitleTrack[];
    chapters: Chapter[];
    strategy: PlaybackStrategy;
};
export type PlaybackState = {
    currentTime: number;
    duration: number;
    bufferedEnd: number;
    bufferedAhead: number;
    paused: boolean;
    waiting: boolean;
    canPlay: boolean;
    volume: number;
    muted: boolean;
    playbackRate: number;
    readyState: number;
    fullscreen: boolean;
    pictureInPicture: boolean;
};
export type SubtitleStyle = {
    size: number;
    color: string;
    backgroundOpacity: number;
    position: number;
    delay: number;
};
export type SubtitleCue = {
    start: number;
    end: number;
    text: string;
};
export type MkvPlayerError = {
    code: string;
    message: string;
    cause?: unknown;
};
export type DiagnosticLevel = "debug" | "info" | "warn" | "error";
export type DiagnosticEvent = {
    id: number;
    at: string;
    elapsedMs: number;
    level: DiagnosticLevel;
    category: string;
    message: string;
    data?: unknown;
};
export type DiagnosticsReport = {
    generatedAt: string;
    userAgent?: string;
    source: {
        kind: "url" | "file" | "blob";
        url?: string;
        fileName?: string;
        fileSize?: number;
        fileType?: string;
    };
    video: {
        currentSrc?: string;
        currentTime: number;
        duration: number;
        paused: boolean;
        readyState: number;
        networkState: number;
        buffered: Array<{
            start: number;
            end: number;
        }>;
        error?: {
            code: number;
            message: string;
        };
    };
    metadata?: MkvPlayerMetadata;
    selectedAudioId?: string;
    selectedSubtitleId?: string;
    events: DiagnosticEvent[];
};
export type DiagnosticsConfig = {
    enabled?: boolean;
    maxEvents?: number;
    exposeGlobal?: boolean;
    globalName?: string;
};
export type PopoutPlacement = "bottom-right" | "bottom-left" | "top-right" | "top-left";
export type PopoutSize = {
    width: number;
    height: number;
};
export type PopoutPosition = {
    x: number;
    y: number;
};
export type PopoutConfig = {
    enabled?: boolean;
    defaultOpen?: boolean;
    initialPlacement?: PopoutPlacement;
    initialSize?: PopoutSize;
    minSize?: PopoutSize;
    maxWidthRatio?: number;
    persistKey?: string;
    allowOffscreenPeek?: boolean;
};
export type PopoutState = {
    open: boolean;
    position: PopoutPosition;
    size: PopoutSize;
    dockedPlacement?: PopoutPlacement;
    minimized: boolean;
};
export type LoadingPreviewConfig = {
    src: string;
    poster?: string;
    type?: "video" | "image";
};
export type MkvPlayerProps = {
    src: MkvPlayerSource;
    title?: string;
    poster?: string;
    loadingPreview?: LoadingPreviewConfig;
    autoPlay?: boolean;
    muted?: boolean;
    server?: ServerConfig;
    subtitles?: SubtitleTrack[];
    className?: string;
    storageKey?: string;
    popout?: boolean | PopoutConfig;
    diagnostics?: DiagnosticsConfig;
    onDiagnosticsEvent?: (event: DiagnosticEvent) => void;
    onPopoutChange?: (state: PopoutState) => void;
    startAt?: number | null;
    onReady?: (metadata: MkvPlayerMetadata) => void;
    onError?: (error: MkvPlayerError) => void;
    onProgress?: (state: PlaybackState) => void;
    onEnded?: () => void;
};
//# sourceMappingURL=types.d.ts.map