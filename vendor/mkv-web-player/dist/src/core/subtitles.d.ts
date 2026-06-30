import { SubtitleCue } from '../types';
export declare function timestampToSeconds(value: string): number;
export declare function secondsToTimestamp(value: number): string;
export declare function srtToVtt(input: string): string;
export declare function parseSubtitles(input: string): SubtitleCue[];
export declare function loadSubtitleCues(url: string): Promise<SubtitleCue[]>;
export declare function activeCue(cues: SubtitleCue[], currentTime: number, delay: number): SubtitleCue | undefined;
//# sourceMappingURL=subtitles.d.ts.map