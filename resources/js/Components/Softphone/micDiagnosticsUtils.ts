import {
    analyzeAudioBufferMetrics,
    type AudioBufferVerificationReport,
} from "@/lib/softphone/micAudioProcessor";

export const AUDIO_MIME_CANDIDATES = [
    "audio/mp4",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/webm;codecs=opus",
    "audio/webm",
];

export function getSupportedMimeType(): string | undefined {
    if (typeof MediaRecorder === "undefined") return undefined;
    return AUDIO_MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
}

/**
 * Encode Web Audio API AudioBuffer into a standard 16-bit PCM WAV Blob.
 */
export function encodeAudioBufferToWav(audioBuffer: AudioBuffer): Blob {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const numFrames = audioBuffer.length;
    const dataSize = numFrames * blockAlign;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, "data");
    view.setUint32(40, dataSize, true);

    const channels: Float32Array[] = [];
    for (let ch = 0; ch < numChannels; ch++) {
        channels.push(audioBuffer.getChannelData(ch));
    }

    let offset = 44;
    for (let i = 0; i < numFrames; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
            const sample = Math.max(-1, Math.min(1, channels[ch][i]));
            const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
            view.setInt16(offset, int16, true);
            offset += 2;
        }
    }

    return new Blob([buffer], { type: "audio/wav" });
}

export async function toStandardAudioBlobWithMetrics(rawBlob: Blob): Promise<{
    blob: Blob;
    ext: string;
    metrics: AudioBufferVerificationReport | null;
}> {
    try {
        const AudioCtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        try {
            const arrayBuffer = await rawBlob.arrayBuffer();
            const decoded = await ctx.decodeAudioData(arrayBuffer);
            const metrics = analyzeAudioBufferMetrics(decoded);
            const wavBlob = encodeAudioBufferToWav(decoded);
            return { blob: wavBlob, ext: "wav", metrics };
        } finally {
            void ctx.close().catch(() => undefined);
        }
    } catch {
        const mime = (rawBlob.type || "").toLowerCase();
        if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) {
            return { blob: rawBlob, ext: "m4a", metrics: null };
        }
        if (mime.includes("ogg")) {
            return { blob: rawBlob, ext: "ogg", metrics: null };
        }
        return { blob: rawBlob, ext: "wav", metrics: null };
    }
}

export function formatBytes(bytes: number): string {
    if (bytes <= 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatTimer(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
