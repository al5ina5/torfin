import { DiagnosticEvent, DiagnosticsConfig, DiagnosticsReport, MkvPlayerMetadata, MkvPlayerSource } from '../types';
export declare function useDiagnostics({ config, src, videoRef, metadata, selectedAudioId, selectedSubtitleId, onEvent }: {
    config?: DiagnosticsConfig;
    src: MkvPlayerSource;
    videoRef: React.RefObject<HTMLVideoElement>;
    metadata?: MkvPlayerMetadata;
    selectedAudioId?: string;
    selectedSubtitleId?: string;
    onEvent?: (event: DiagnosticEvent) => void;
}): {
    add: (level: DiagnosticEvent["level"], category: string, message: string, data?: unknown) => void;
    report: () => DiagnosticsReport;
    download: () => void;
};
//# sourceMappingURL=useDiagnostics.d.ts.map