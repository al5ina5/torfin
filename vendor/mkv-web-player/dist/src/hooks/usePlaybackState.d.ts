import { PlaybackState } from '../types';
export declare function usePlaybackState(videoRef: React.RefObject<HTMLVideoElement>, onProgress?: (state: PlaybackState) => void, resetKey?: string): {
    state: PlaybackState;
    sync: () => void;
};
//# sourceMappingURL=usePlaybackState.d.ts.map