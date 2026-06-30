import { MkvPlayerMetadata, MkvPlayerSource, PlaybackStrategy, ServerConfig, SubtitleTrack } from '../types';
export type ResolvedSource = {
    objectUrl?: string;
    originalUrl?: string;
    videoUrl: string;
    strategy: PlaybackStrategy;
    metadata?: Partial<MkvPlayerMetadata>;
};
export declare function sourceToUrl(src: MkvPlayerSource): {
    url: string;
    objectUrl?: string;
    isObject: boolean;
};
export declare function resolvePlaybackSource(src: MkvPlayerSource, server?: ServerConfig): Promise<ResolvedSource>;
export declare function buildSubtitleUrl(server: ServerConfig | undefined, src: MkvPlayerSource, track: SubtitleTrack): string | undefined;
export declare function getNativeSupport(url: string): "probably" | "maybe" | "";
//# sourceMappingURL=source.d.ts.map