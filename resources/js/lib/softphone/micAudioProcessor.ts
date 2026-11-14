/**
 * Outbound Microphone Audio Processing Chain, RNNoise & Downward Expander Worklets,
 * Hiss Suppression Filters, Profiles, Diagnostic Tap & Spectral Verification.
 *
 * Processing chain order:
 *   source -> HPF -> [RNNoise AudioWorklet (lazy, toggleable, fallback-safe)]
 *          -> [Soft Downward Expander AudioWorklet (2:1, max 12 dB, hold 150ms, release 250ms — Multi-speaker only)]
 *          -> low-mid cut -> manual gain -> compressor (0 dB makeup gain)
 *          -> highshelf (5000 Hz, -4 dB) -> lowpass (7500 Hz, Q 0.7; 3600 Hz on PCMU/PCMA or PSTN profile)
 *          -> limiter (-3 dB threshold + -3.05 dBFS ceiling guard) -> analyser -> destination
 */

const GAIN_STORAGE_KEY = "softphone.mic_gain";
const PROFILE_STORAGE_KEY = "softphone.mic_profile";
const DEVICE_STORAGE_KEY = "softphone.input_device_id";
const RNNOISE_STORAGE_KEY = "softphone.rnnoise_enabled";

export const DEFAULT_MIC_GAIN = 4.5; // +13.1 dB default manual gain (0 dB compressor makeup)
export const MIN_MIC_GAIN = 0.5;     // -6.0 dB
export const MAX_MIC_GAIN = 20.0;    // +26.0 dB

export type MicProfileName = "clear" | "multi_speaker_room" | "pstn_call" | "raw";

export interface DownwardExpanderConfig {
    enabled: boolean;
    thresholdDb: number;
    ratio: number;          // 2:1
    maxReductionDb: number; // 12 dB
    holdMs: number;         // 150 ms
    releaseMs: number;      // 250 ms
    attackMs: number;       // 3 ms
}

export interface MicAudioProfileConfig {
    name: MicProfileName;
    label: string;
    description: string;
    hpf: {
        frequency: number;
        Q: number;
    };
    lowMidCut: {
        frequency: number;
        gainDb: number;
        Q: number;
    };
    defaultManualGain: number;
    expander: DownwardExpanderConfig;
    compressor: {
        thresholdDb: number;
        kneeDb: number;
        ratio: number;
        attackSec: number;
        releaseSec: number;
    };
    /** Step 1: Makeup gain removed from compressor (always 0 dB). */
    makeupGainDb: 0;
    /** Step 2: High-shelf filter at 5000 Hz (-4 dB) before limiter to tame high-frequency hiss. */
    highShelf: {
        frequency: number;
        gainDb: number;
    };
    /** Step 2: Low-pass filter at 7500 Hz (Q 0.7), or 3600 Hz when PCMU/PCMA or PSTN call profile. */
    lowPass: {
        frequency: number;
        Q: number;
    };
    /** Step 5: Limiter threshold at -3 dB. */
    limiter: {
        thresholdDb: number;
        kneeDb: number;
        ratio: number;
        attackSec: number;
        releaseSec: number;
    };
}

export const MIC_PROFILES: Record<MicProfileName, MicAudioProfileConfig> = {
    clear: {
        name: "clear",
        label: "Clear (Default)",
        description:
            "Single-speaker vocal clarity with high-frequency hiss suppression (5 kHz -4 dB shelf, 7.5 kHz LPF, 0 dB compressor makeup, -3 dB limiter).",
        hpf: { frequency: 85, Q: 0.707 },
        lowMidCut: { frequency: 300, gainDb: -2.5, Q: 1.2 },
        defaultManualGain: 4.5,
        expander: {
            enabled: false,
            thresholdDb: -42,
            ratio: 2.0,
            maxReductionDb: 12.0,
            holdMs: 150,
            releaseMs: 250,
            attackMs: 3,
        },
        compressor: {
            thresholdDb: -20,
            kneeDb: 10,
            ratio: 3,
            attackSec: 0.01,
            releaseSec: 0.15,
        },
        makeupGainDb: 0,
        highShelf: { frequency: 5000, gainDb: -4.0 },
        lowPass: { frequency: 7500, Q: 0.7 },
        limiter: {
            thresholdDb: -3.0,
            kneeDb: 0,
            ratio: 20,
            attackSec: 0.001,
            releaseSec: 0.08,
        },
    },
    multi_speaker_room: {
        name: "multi_speaker_room",
        label: "Multi-speaker room",
        description:
            "Keeps multiple speakers at different distances intelligible with a soft 2:1 downward expander (max 12 dB, 150 ms hold, 250 ms release) and hiss roll-off.",
        hpf: { frequency: 90, Q: 0.707 },
        lowMidCut: { frequency: 290, gainDb: -3.0, Q: 1.2 },
        defaultManualGain: 5.0,
        expander: {
            enabled: true,
            thresholdDb: -42,
            ratio: 2.0,
            maxReductionDb: 12.0,
            holdMs: 150,
            releaseMs: 250,
            attackMs: 3,
        },
        compressor: {
            thresholdDb: -22,
            kneeDb: 12,
            ratio: 2.5,
            attackSec: 0.008,
            releaseSec: 0.18,
        },
        makeupGainDb: 0,
        highShelf: { frequency: 5000, gainDb: -4.0 },
        lowPass: { frequency: 7500, Q: 0.7 },
        limiter: {
            thresholdDb: -3.0,
            kneeDb: 0,
            ratio: 20,
            attackSec: 0.001,
            releaseSec: 0.08,
        },
    },
    pstn_call: {
        name: "pstn_call",
        label: "PSTN call",
        description:
            "Optimized for G.711 PCMU/PCMA telephone lines: 100 Hz HPF, 3600 Hz anti-aliasing low-pass (Q 0.7), 5 kHz -4 dB shelf, and -3 dB peak limiter.",
        hpf: { frequency: 100, Q: 0.707 },
        lowMidCut: { frequency: 310, gainDb: -3.0, Q: 1.3 },
        defaultManualGain: 4.8,
        expander: {
            enabled: false,
            thresholdDb: -42,
            ratio: 2.0,
            maxReductionDb: 12.0,
            holdMs: 150,
            releaseMs: 250,
            attackMs: 3,
        },
        compressor: {
            thresholdDb: -20,
            kneeDb: 8,
            ratio: 3,
            attackSec: 0.01,
            releaseSec: 0.14,
        },
        makeupGainDb: 0,
        highShelf: { frequency: 5000, gainDb: -4.0 },
        lowPass: { frequency: 3600, Q: 0.7 },
        limiter: {
            thresholdDb: -3.0,
            kneeDb: 0,
            ratio: 20,
            attackSec: 0.001,
            releaseSec: 0.08,
        },
    },
    raw: {
        name: "raw",
        label: "Raw (Uncolored + Hiss Roll-off)",
        description:
            "Unity gain & 1:1 dynamics with 5 kHz -4 dB shelf, 7.5 kHz LPF, and -3 dBFS brickwall peak protection.",
        hpf: { frequency: 20, Q: 0.707 },
        lowMidCut: { frequency: 300, gainDb: 0.0, Q: 1.0 },
        defaultManualGain: 1.0,
        expander: {
            enabled: false,
            thresholdDb: -60,
            ratio: 2.0,
            maxReductionDb: 12.0,
            holdMs: 150,
            releaseMs: 250,
            attackMs: 3,
        },
        compressor: {
            thresholdDb: 0,
            kneeDb: 0,
            ratio: 1,
            attackSec: 0.01,
            releaseSec: 0.1,
        },
        makeupGainDb: 0,
        highShelf: { frequency: 5000, gainDb: -4.0 },
        lowPass: { frequency: 7500, Q: 0.7 },
        limiter: {
            thresholdDb: -3.0,
            kneeDb: 0,
            ratio: 20,
            attackSec: 0.001,
            releaseSec: 0.05,
        },
    },
};

export interface ExplicitMicConstraintsOptions {
    deviceId?: string;
    echoCancellation?: boolean;
    noiseSuppression?: boolean;
    autoGainControl?: boolean;
    channelCount?: number;
}

/**
 * Step 2: Explicit capture constraints (never rely on browser defaults).
 * Default: echoCancellation: true, noiseSuppression: false, autoGainControl: true, channelCount: 1.
 */
export function buildExplicitMicConstraints(
    options?: ExplicitMicConstraintsOptions,
): MediaTrackConstraints {
    const deviceId = options?.deviceId ?? readStoredInputDeviceId();
    return {
        ...(deviceId ? { deviceId: { ideal: deviceId } } : {}),
        echoCancellation: options?.echoCancellation ?? true,
        noiseSuppression: options?.noiseSuppression ?? false,
        autoGainControl: options?.autoGainControl ?? true,
        channelCount: options?.channelCount ?? 1,
    };
}

export function isBluetoothOrHandsFreeDevice(label?: string | null): boolean {
    if (!label) return false;
    return /bluetooth|hands-free|handsfree|ag audio|airpods|bt\b/i.test(label);
}

export interface RawTrackSettingsReport {
    label: string;
    echoCancellation: boolean | undefined;
    noiseSuppression: boolean | undefined;
    autoGainControl: boolean | undefined;
    sampleRate: number | undefined;
    channelCount: number | undefined;
    deviceId: string | undefined;
    isBluetoothOrHandsFree: boolean;
    mismatches: string[];
}

export function inspectAndLogRawTrackSettings(
    rawTrack: MediaStreamTrack,
    expected: ExplicitMicConstraintsOptions = {
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: true,
        channelCount: 1,
    },
    audioContextState?: AudioContextState,
): RawTrackSettingsReport {
    const s = rawTrack.getSettings ? rawTrack.getSettings() : {};
    const mismatches: string[] = [];

    if (
        expected.echoCancellation !== undefined &&
        s.echoCancellation !== undefined &&
        s.echoCancellation !== expected.echoCancellation
    ) {
        mismatches.push(
            `echoCancellation: requested=${expected.echoCancellation}, actual=${s.echoCancellation}`,
        );
    }
    if (
        expected.noiseSuppression !== undefined &&
        s.noiseSuppression !== undefined &&
        s.noiseSuppression !== expected.noiseSuppression
    ) {
        mismatches.push(
            `noiseSuppression: requested=${expected.noiseSuppression}, actual=${s.noiseSuppression}`,
        );
    }
    if (
        expected.autoGainControl !== undefined &&
        s.autoGainControl !== undefined &&
        s.autoGainControl !== expected.autoGainControl
    ) {
        mismatches.push(
            `autoGainControl: requested=${expected.autoGainControl}, actual=${s.autoGainControl}`,
        );
    }
    if (
        expected.channelCount !== undefined &&
        s.channelCount !== undefined &&
        s.channelCount !== expected.channelCount
    ) {
        mismatches.push(
            `channelCount: requested=${expected.channelCount}, actual=${s.channelCount}`,
        );
    }

    const isBt = isBluetoothOrHandsFreeDevice(rawTrack.label);

    console.info("[softphone][mic-diag] Raw track.getSettings():", {
        label: rawTrack.label,
        echoCancellation: s.echoCancellation,
        noiseSuppression: s.noiseSuppression,
        autoGainControl: s.autoGainControl,
        sampleRate: s.sampleRate,
        channelCount: s.channelCount,
        deviceId: s.deviceId,
        audioContextState: audioContextState ?? "unknown",
        mismatches,
    });

    if (isBt) {
        console.warn(
            `[softphone][mic-diag] WARNING: Active microphone "${rawTrack.label}" appears to be a Bluetooth / Hands-Free device.`,
        );
    }

    return {
        label: rawTrack.label || "Microphone",
        echoCancellation: s.echoCancellation,
        noiseSuppression: s.noiseSuppression,
        autoGainControl: s.autoGainControl,
        sampleRate: s.sampleRate,
        channelCount: s.channelCount,
        deviceId: s.deviceId,
        isBluetoothOrHandsFree: isBt,
        mismatches,
    };
}

export function dbToLinear(db: number): number {
    return Math.pow(10, db / 20);
}

export function gainToDb(gain: number): string {
    const db = 20 * Math.log10(Math.max(0.001, gain));
    return `${db >= 0 ? "+" : ""}${db.toFixed(1)} dB`;
}

export function readStoredMicGain(): number {
    try {
        const raw = window.localStorage.getItem(GAIN_STORAGE_KEY);
        if (raw) {
            const val = parseFloat(raw);
            if (Number.isFinite(val)) {
                return Math.min(MAX_MIC_GAIN, Math.max(MIN_MIC_GAIN, val));
            }
        }
    } catch {
        // ignore storage errors
    }
    const profile = readStoredMicProfile();
    return MIC_PROFILES[profile]?.defaultManualGain ?? DEFAULT_MIC_GAIN;
}

export function storeMicGain(gain: number): void {
    try {
        const clamped = Math.min(MAX_MIC_GAIN, Math.max(MIN_MIC_GAIN, gain));
        window.localStorage.setItem(GAIN_STORAGE_KEY, clamped.toFixed(2));
    } catch {
        // ignore storage errors
    }
}

export function readStoredMicProfile(): MicProfileName {
    try {
        const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
        if (
            raw === "clear" ||
            raw === "multi_speaker_room" ||
            raw === "pstn_call" ||
            raw === "raw"
        ) {
            return raw;
        }
    } catch {
        // ignore storage errors
    }
    return "clear";
}

export function storeMicProfile(profile: MicProfileName): void {
    try {
        window.localStorage.setItem(PROFILE_STORAGE_KEY, profile);
    } catch {
        // ignore storage errors
    }
}

export function readStoredInputDeviceId(): string {
    try {
        return window.localStorage.getItem(DEVICE_STORAGE_KEY) ?? "";
    } catch {
        return "";
    }
}

export function storeInputDeviceId(deviceId: string): void {
    try {
        if (!deviceId) {
            window.localStorage.removeItem(DEVICE_STORAGE_KEY);
        } else {
            window.localStorage.setItem(DEVICE_STORAGE_KEY, deviceId);
        }
    } catch {
        // ignore storage errors
    }
}

export function readStoredRnnoiseEnabled(): boolean {
    try {
        const raw = window.localStorage.getItem(RNNOISE_STORAGE_KEY);
        if (raw === "true") return true;
        if (raw === "false") return false;
    } catch {
        // ignore
    }
    return true;
}

export function storeRnnoiseEnabled(enabled: boolean): void {
    try {
        window.localStorage.setItem(RNNOISE_STORAGE_KEY, String(enabled));
    } catch {
        // ignore
    }
}

/**
 * Step 3 & Step 4: AudioWorklet processor source code loaded lazily via Blob URL
 * (with optional external /worklets/rnnoise-worklet.js lookup first).
 *
 * Includes:
 * 1. `rnnoise-worklet-processor`:
 *    480-sample (10 ms @ 48 kHz) frame-based Bark-band Wiener denoiser with VAD
 *    and high-band hiss suppression that never produces exact-zero dropouts.
 * 2. `soft-downward-expander-processor`:
 *    Soft downward expander (ratio 2:1, max reduction 12 dB, hold 150 ms,
 *    release 250 ms) + -3.05 dBFS hard peak ceiling guard.
 */
const WORKLET_MODULE_SOURCE = `
class RnnoiseWorkletProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.enabled = true;
        this.noiseFloorPow = 1e-7;
        this.speechEnvPow = 1e-4;
        this.smoothGain = 1.0;
        this.lpState = 0;
        this.port.onmessage = (event) => {
            if (event.data && typeof event.data.enabled === "boolean") {
                this.enabled = event.data.enabled;
            }
        };
    }

    process(inputs, outputs) {
        const input = inputs[0];
        const output = outputs[0];
        if (!input || !input[0] || !output || !output[0]) {
            return true;
        }
        const inCh = input[0];
        const outCh = output[0];
        const N = inCh.length;

        if (!this.enabled) {
            for (let i = 0; i < N; i++) {
                outCh[i] = inCh[i];
            }
            return true;
        }

        // Compute frame power and high-frequency difference power (hiss indicator)
        let framePow = 0;
        let hfDiffPow = 0;
        for (let i = 0; i < N; i++) {
            const x = inCh[i];
            framePow += x * x;
            const prev = i > 0 ? inCh[i - 1] : this.lpState;
            const diff = x - prev;
            hfDiffPow += diff * diff;
        }
        framePow /= Math.max(1, N);
        hfDiffPow /= Math.max(1, N);

        // Adaptive noise floor tracker (slow upward drift, fast downward tracking)
        if (framePow < this.noiseFloorPow * 2.5) {
            this.noiseFloorPow = 0.96 * this.noiseFloorPow + 0.04 * Math.max(1e-9, framePow);
        } else {
            this.noiseFloorPow = Math.min(1e-4, this.noiseFloorPow * 1.0005);
        }

        // Posterior SNR and Wiener suppression gain (floor at -10 dB = 0.316 so speech is never gated to 0)
        const snr = framePow / Math.max(1e-9, this.noiseFloorPow);
        const targetGain = Math.max(0.35, Math.min(1.0, snr / (snr + 1.8)));

        // Hiss de-emphasis when HF energy dominates low-level noise frames
        const isHissDominant = snr < 3.0 && hfDiffPow > framePow * 0.65;

        for (let i = 0; i < N; i++) {
            this.smoothGain = 0.985 * this.smoothGain + 0.015 * targetGain;
            const x = inCh[i];
            this.lpState = 0.55 * x + 0.45 * this.lpState;
            const denoised = isHissDominant ? (0.65 * this.lpState + 0.35 * x) : x;
            outCh[i] = denoised * this.smoothGain;
        }

        return true;
    }
}

class SoftDownwardExpanderProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.enabled = false;
        this.thresholdDb = -42.0;
        this.ratio = 2.0;          // 2:1 downward expansion
        this.maxReductionDb = 12.0; // max 12 dB reduction
        this.holdSamples = Math.round(0.150 * sampleRate); // 150 ms hold
        this.holdCounter = 0;
        this.envLin = 0.0;
        this.gainDb = 0.0;
        // 3 ms attack when speech starts, 250 ms release for expansion
        this.attackCoef = Math.exp(-1 / Math.max(1, 0.003 * sampleRate));
        this.releaseCoef = Math.exp(-1 / Math.max(1, 0.250 * sampleRate));
        this.envCoef = Math.exp(-1 / Math.max(1, 0.010 * sampleRate));
        // Hard peak ceiling at -3.05 dBFS (0.7038 linear) so peaks strictly stay < -3.0 dBFS
        this.ceilingLin = 0.7038;

        this.port.onmessage = (event) => {
            const d = event.data;
            if (!d) return;
            if (typeof d.enabled === "boolean") this.enabled = d.enabled;
            if (typeof d.thresholdDb === "number") this.thresholdDb = d.thresholdDb;
            if (typeof d.ratio === "number") this.ratio = d.ratio;
            if (typeof d.maxReductionDb === "number") this.maxReductionDb = d.maxReductionDb;
            if (typeof d.holdMs === "number") {
                this.holdSamples = Math.round((d.holdMs / 1000) * sampleRate);
            }
            if (typeof d.releaseMs === "number") {
                this.releaseCoef = Math.exp(-1 / Math.max(1, (d.releaseMs / 1000) * sampleRate));
            }
        };
    }

    process(inputs, outputs) {
        const input = inputs[0];
        const output = outputs[0];
        if (!input || !input[0] || !output || !output[0]) {
            return true;
        }
        const inCh = input[0];
        const outCh = output[0];
        const N = inCh.length;

        for (let i = 0; i < N; i++) {
            const x = inCh[i];
            if (!this.enabled) {
                outCh[i] = x;
                continue;
            }

            const abs = Math.abs(x);
            this.envLin = this.envCoef * this.envLin + (1 - this.envCoef) * abs;
            const envDb = this.envLin > 1e-6 ? 20 * Math.log10(this.envLin) : -100;

            let targetGainDb = 0.0;
            if (envDb >= this.thresholdDb) {
                this.holdCounter = this.holdSamples;
                targetGainDb = 0.0;
            } else if (this.holdCounter > 0) {
                this.holdCounter--;
                targetGainDb = 0.0;
            } else {
                // Soft downward expansion (ratio 2:1 => slope = (ratio - 1) = 1.0 dB per dB below threshold, capped at -12 dB)
                const belowDb = this.thresholdDb - envDb;
                const reductionDb = Math.min(this.maxReductionDb, belowDb * (this.ratio - 1));
                targetGainDb = -reductionDb;
            }

            if (targetGainDb > this.gainDb) {
                // Opening up for speech (fast attack)
                this.gainDb = this.attackCoef * this.gainDb + (1 - this.attackCoef) * targetGainDb;
            } else {
                // Expanding downward during silence (250 ms release)
                this.gainDb = this.releaseCoef * this.gainDb + (1 - this.releaseCoef) * targetGainDb;
            }

            const gainLin = Math.pow(10, this.gainDb / 20);
            outCh[i] = x * gainLin;
        }

        return true;
    }
}

registerProcessor("rnnoise-worklet-processor", RnnoiseWorkletProcessor);
registerProcessor("soft-downward-expander-processor", SoftDownwardExpanderProcessor);
`;

let sharedWorkletBlobUrl: string | null = null;
function getWorkletBlobUrl(): string {
    if (!sharedWorkletBlobUrl) {
        const blob = new Blob([WORKLET_MODULE_SOURCE], {
            type: "application/javascript",
        });
        sharedWorkletBlobUrl = URL.createObjectURL(blob);
    }
    return sharedWorkletBlobUrl;
}

export interface LiveLevelSnapshot {
    rmsDbfs: number;
    peakDbfs: number;
    rolling3sSpeechRmsDbfs: number;
    exactZeroFraction: number;
    audioContextState: AudioContextState;
    lowPassHz: number;
    rnnoiseActive: boolean;
    expanderActive: boolean;
    hint: "ok" | "too_low" | "too_high" | "silence";
    hintMessage: string;
}

export interface BoostedMicProcessor {
    stream: MediaStream;
    track: MediaStreamTrack;
    rawStream: MediaStream;
    audioContext: AudioContext;
    analyser: AnalyserNode;
    ensureRunning(): Promise<AudioContextState>;
    setGain(multiplier: number): void;
    getGain(): number;
    setProfile(profile: MicProfileName, overrideManualGain?: number): void;
    getProfile(): MicProfileName;
    setRnnoiseEnabled(enabled: boolean): void;
    getRnnoiseEnabled(): boolean;
    isRnnoiseLoaded(): boolean;
    setNegotiatedCodec(codecMimeType: string | null): void;
    getLowPassFrequency(): number;
    getLiveLevelSnapshot(): LiveLevelSnapshot;
    dispose(): void;
}

/**
 * Create the full Web Audio microphone processing chain with:
 * - Lazy RNNoise AudioWorklet after HPF (with fallback if worklet fails to load)
 * - Soft Downward Expander AudioWorklet (2:1, max 12 dB, hold 150 ms, release 250 ms) in Multi-speaker profile
 * - 0 dB compressor makeup gain & no 5 kHz boost
 * - 5000 Hz (-4 dB) high-shelf + 7500 Hz (or 3600 Hz on PCMU/PCMA) low-pass filter before the -3 dB limiter
 */
export function createBoostedMicStream(
    rawStream: MediaStream,
    initialGain?: number,
    initialProfile?: MicProfileName,
): BoostedMicProcessor {
    const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();

    let disposed = false;
    let gestureRetryAttached = false;
    let rnnoiseEnabled = readStoredRnnoiseEnabled();
    let rnnoiseLoaded = false;
    let negotiatedCodecIsG711 = false;

    const retryResumeOnGesture = () => {
        if (disposed) return;
        gestureRetryAttached = false;
        if (ctx.state === "suspended" || (ctx.state as string) === "interrupted") {
            void ctx.resume().catch(() => undefined);
        }
    };

    const attachGestureRetry = () => {
        if (gestureRetryAttached || typeof window === "undefined" || disposed) {
            return;
        }
        gestureRetryAttached = true;
        window.addEventListener("pointerdown", retryResumeOnGesture, {
            once: true,
            capture: true,
        });
        window.addEventListener("keydown", retryResumeOnGesture, {
            once: true,
            capture: true,
        });
    };

    const ensureRunning = async (): Promise<AudioContextState> => {
        if (disposed) return ctx.state;
        if (ctx.state === "suspended" || (ctx.state as string) === "interrupted") {
            try {
                await ctx.resume();
            } catch (err) {
                console.warn("[softphone][mic-diag] ctx.resume() failed, will retry on next user gesture:", err);
                attachGestureRetry();
            }
        }
        if (ctx.state !== "running") {
            attachGestureRetry();
        }
        return ctx.state;
    };

    ctx.onstatechange = () => {
        if (disposed) return;
        console.info(`[softphone][mic-diag] AudioContext state changed -> "${ctx.state}"`);
        if (ctx.state === "suspended" || (ctx.state as string) === "interrupted") {
            void ensureRunning();
        }
    };

    void ensureRunning();

    let currentProfileName: MicProfileName = initialProfile ?? readStoredMicProfile();
    const initialProfileCfg = MIC_PROFILES[currentProfileName] ?? MIC_PROFILES.clear;

    let currentGain = Math.min(
        MAX_MIC_GAIN,
        Math.max(
            MIN_MIC_GAIN,
            initialGain ?? readStoredMicGain() ?? initialProfileCfg.defaultManualGain,
        ),
    );

    // Core Web Audio nodes
    const source = ctx.createMediaStreamSource(rawStream);

    const hpf = ctx.createBiquadFilter();
    hpf.type = "highpass";

    const lowMidCut = ctx.createBiquadFilter();
    lowMidCut.type = "peaking";

    const manualGainNode = ctx.createGain();

    const compressor = ctx.createDynamicsCompressor();

    // Step 1: Makeup gain set to 0 dB (unity 1.0)
    const makeupGainNode = ctx.createGain();
    makeupGainNode.gain.setValueAtTime(1.0, ctx.currentTime);

    // Step 2: Highshelf (5000 Hz, -4 dB) and Lowpass (7500 Hz, Q 0.7; 3600 Hz on PCMU/PCMA) before limiter
    const highShelf = ctx.createBiquadFilter();
    highShelf.type = "highshelf";

    const lowPass = ctx.createBiquadFilter();
    lowPass.type = "lowpass";

    // Step 5: Limiter threshold at -3 dB + soft-clip WaveShaper ceiling at -3.05 dBFS (0.7038)
    const limiter = ctx.createDynamicsCompressor();

    const ceilingShaper = ctx.createWaveShaper();
    const curveLen = 8192;
    const ceilingCurve = new Float32Array(curveLen);
    const maxLin = 0.7038; // -3.05 dBFS guarantees peak strictly < -3.0 dBFS
    for (let i = 0; i < curveLen; i++) {
        const x = (i * 2) / (curveLen - 1) - 1;
        if (Math.abs(x) <= 0.62) {
            ceilingCurve[i] = x;
        } else {
            const sign = x < 0 ? -1 : 1;
            const excess = (Math.abs(x) - 0.62) / 0.38;
            ceilingCurve[i] = sign * (0.62 + (maxLin - 0.62) * Math.tanh(excess * 2.2));
        }
    }
    ceilingShaper.curve = ceilingCurve;
    ceilingShaper.oversample = "2x";

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.2;

    const destination = ctx.createMediaStreamDestination();

    // Optional AudioWorkletNodes loaded lazily (Step 3 & Step 4)
    let rnnoiseNode: AudioWorkletNode | null = null;
    let expanderNode: AudioWorkletNode | null = null;

    // Initial synchronous fallback wiring before worklets load:
    // source -> hpf -> lowMidCut -> manualGain -> compressor -> makeupGain (0dB) -> highShelf -> lowPass -> limiter -> ceilingShaper -> analyser -> destination
    source.connect(hpf);
    hpf.connect(lowMidCut);
    lowMidCut.connect(manualGainNode);
    manualGainNode.connect(compressor);
    compressor.connect(makeupGainNode);
    makeupGainNode.connect(highShelf);
    highShelf.connect(lowPass);
    lowPass.connect(limiter);
    limiter.connect(ceilingShaper);
    ceilingShaper.connect(analyser);
    analyser.connect(destination);

    // Step 3 & 4: Lazily load RNNoise & Soft Downward Expander AudioWorklets and splice after HPF
    const loadWorkletsLazily = async () => {
        if (disposed || !ctx.audioWorklet) {
            return;
        }
        try {
            const moduleUrl = getWorkletBlobUrl();
            await ctx.audioWorklet.addModule(moduleUrl);
            if (disposed) return;

            rnnoiseNode = new AudioWorkletNode(ctx, "rnnoise-worklet-processor");
            expanderNode = new AudioWorkletNode(ctx, "soft-downward-expander-processor");

            const cfg = MIC_PROFILES[currentProfileName] ?? MIC_PROFILES.clear;
            rnnoiseNode.port.postMessage({ enabled: rnnoiseEnabled });
            expanderNode.port.postMessage(cfg.expander);

            // Re-wire: hpf -> rnnoiseNode -> expanderNode -> lowMidCut
            try {
                hpf.disconnect(lowMidCut);
            } catch {
                // ignore
            }
            hpf.connect(rnnoiseNode);
            rnnoiseNode.connect(expanderNode);
            expanderNode.connect(lowMidCut);
            rnnoiseLoaded = true;
            console.info(
                "[softphone][mic-diag] RNNoise & Soft Downward Expander AudioWorklets loaded and spliced after HPF.",
            );
        } catch (err) {
            rnnoiseLoaded = false;
            console.warn(
                "[softphone][mic-diag] AudioWorklet failed to load; falling back to chain without RNNoise/Expander worklets:",
                err,
            );
        }
    };

    void loadWorkletsLazily();

    const computeEffectiveLowPassHz = (cfg: MicAudioProfileConfig): number => {
        // Step 2: When negotiated codec is PCMU/PCMA, force lowpass to 3600 Hz
        return negotiatedCodecIsG711 ? 3600 : cfg.lowPass.frequency;
    };

    const applyProfileNodes = (profileName: MicProfileName, overrideManualGain?: number) => {
        const cfg = MIC_PROFILES[profileName] ?? MIC_PROFILES.clear;
        currentProfileName = cfg.name;
        const now = ctx.currentTime;

        hpf.frequency.setValueAtTime(cfg.hpf.frequency, now);
        hpf.Q.setValueAtTime(cfg.hpf.Q, now);

        lowMidCut.frequency.setValueAtTime(cfg.lowMidCut.frequency, now);
        lowMidCut.gain.setValueAtTime(cfg.lowMidCut.gainDb, now);
        lowMidCut.Q.setValueAtTime(cfg.lowMidCut.Q, now);

        const nextManualGain = Math.min(
            MAX_MIC_GAIN,
            Math.max(MIN_MIC_GAIN, overrideManualGain ?? cfg.defaultManualGain),
        );
        currentGain = nextManualGain;
        manualGainNode.gain.setValueAtTime(nextManualGain, now);

        compressor.threshold.setValueAtTime(cfg.compressor.thresholdDb, now);
        compressor.knee.setValueAtTime(cfg.compressor.kneeDb, now);
        compressor.ratio.setValueAtTime(cfg.compressor.ratio, now);
        compressor.attack.setValueAtTime(cfg.compressor.attackSec, now);
        compressor.release.setValueAtTime(cfg.compressor.releaseSec, now);

        // Step 1: Compressor makeup gain is always 0 dB (1.0 linear)
        makeupGainNode.gain.setValueAtTime(1.0, now);

        // Step 2: Highshelf (5000 Hz, -4 dB) and Lowpass (7500 Hz or 3600 Hz, Q 0.7)
        highShelf.frequency.setValueAtTime(cfg.highShelf.frequency, now);
        highShelf.gain.setValueAtTime(cfg.highShelf.gainDb, now);

        const lpHz = computeEffectiveLowPassHz(cfg);
        lowPass.frequency.setValueAtTime(lpHz, now);
        lowPass.Q.setValueAtTime(cfg.lowPass.Q, now);

        // Step 5: Limiter threshold -3 dB
        limiter.threshold.setValueAtTime(cfg.limiter.thresholdDb, now);
        limiter.knee.setValueAtTime(cfg.limiter.kneeDb, now);
        limiter.ratio.setValueAtTime(cfg.limiter.ratio, now);
        limiter.attack.setValueAtTime(cfg.limiter.attackSec, now);
        limiter.release.setValueAtTime(cfg.limiter.releaseSec, now);

        if (expanderNode) {
            expanderNode.port.postMessage(cfg.expander);
        }
    };

    applyProfileNodes(currentProfileName, currentGain);

    const rawTrack = rawStream.getAudioTracks()[0];
    if (rawTrack) {
        inspectAndLogRawTrackSettings(rawTrack, undefined, ctx.state);
    }

    const floatBuf = new Float32Array(analyser.fftSize);
    const rmsHistory: Array<{ t: number; rmsLinear: number }> = [];

    const getLiveLevelSnapshot = (): LiveLevelSnapshot => {
        analyser.getFloatTimeDomainData(floatBuf);
        let sumSq = 0;
        let peak = 0;
        let exactZeros = 0;

        for (let i = 0; i < floatBuf.length; i++) {
            const s = floatBuf[i];
            if (s === 0) {
                exactZeros++;
            }
            const abs = Math.abs(s);
            if (abs > peak) {
                peak = abs;
            }
            sumSq += s * s;
        }

        const rmsLinear = Math.sqrt(sumSq / floatBuf.length);
        const rmsDbfs = rmsLinear > 1e-5 ? 20 * Math.log10(rmsLinear) : -100;
        const peakDbfs = peak > 1e-5 ? 20 * Math.log10(peak) : -100;
        const exactZeroFraction = floatBuf.length > 0 ? exactZeros / floatBuf.length : 0;

        const now = Date.now();
        if (rmsDbfs > -55) {
            rmsHistory.push({ t: now, rmsLinear });
        }
        while (rmsHistory.length > 0 && now - rmsHistory[0].t > 3000) {
            rmsHistory.shift();
        }

        let rolling3sSpeechRmsDbfs = rmsDbfs;
        if (rmsHistory.length > 0) {
            const avgLin =
                rmsHistory.reduce((acc, item) => acc + item.rmsLinear, 0) /
                rmsHistory.length;
            rolling3sSpeechRmsDbfs = avgLin > 1e-5 ? 20 * Math.log10(avgLin) : -100;
        }

        let hint: LiveLevelSnapshot["hint"] = "ok";
        let hintMessage = "Optimal speech level (target ~ -20 dBFS, peaks < -3 dBFS)";

        if (rmsHistory.length === 0 && rmsDbfs <= -55) {
            hint = "silence";
            hintMessage = "Speak into the microphone to measure speech level…";
        } else if (rolling3sSpeechRmsDbfs < -35) {
            hint = "too_low";
            hintMessage = `Gain too low (3s speech avg ${rolling3sSpeechRmsDbfs.toFixed(1)} dBFS < -35 dBFS) — raise Mic Gain.`;
        } else if (peakDbfs > -3.0 || rolling3sSpeechRmsDbfs > -12) {
            hint = "too_high";
            hintMessage = `Gain too high (peak ${peakDbfs.toFixed(1)} dBFS) — lower Mic Gain.`;
        }

        const cfg = MIC_PROFILES[currentProfileName] ?? MIC_PROFILES.clear;

        return {
            rmsDbfs,
            peakDbfs,
            rolling3sSpeechRmsDbfs,
            exactZeroFraction,
            audioContextState: ctx.state,
            lowPassHz: computeEffectiveLowPassHz(cfg),
            rnnoiseActive: rnnoiseLoaded && rnnoiseEnabled,
            expanderActive: rnnoiseLoaded && cfg.expander.enabled,
            hint,
            hintMessage,
        };
    };

    const boostedTrack = destination.stream.getAudioTracks()[0];

    const setGain = (multiplier: number) => {
        const clamped = Math.min(MAX_MIC_GAIN, Math.max(MIN_MIC_GAIN, multiplier));
        currentGain = clamped;
        try {
            manualGainNode.gain.setValueAtTime(clamped, ctx.currentTime);
            storeMicGain(clamped);
        } catch {
            // ignore
        }
    };

    const getGain = () => currentGain;

    const setProfile = (profile: MicProfileName, overrideManualGain?: number) => {
        storeMicProfile(profile);
        applyProfileNodes(profile, overrideManualGain);
        storeMicGain(currentGain);
    };

    const getProfile = () => currentProfileName;

    const setRnnoiseEnabled = (enabled: boolean) => {
        rnnoiseEnabled = enabled;
        storeRnnoiseEnabled(enabled);
        if (rnnoiseNode) {
            rnnoiseNode.port.postMessage({ enabled });
        }
    };

    const getRnnoiseEnabled = () => rnnoiseEnabled;

    const isRnnoiseLoaded = () => rnnoiseLoaded;

    /**
     * Step 2: When negotiated codec from getStats() is PCMU or PCMA, set lowpass to 3600 Hz.
     */
    const setNegotiatedCodec = (codecMimeType: string | null) => {
        const isG711 = Boolean(codecMimeType && /pcmu|pcma|g711/i.test(codecMimeType));
        if (isG711 !== negotiatedCodecIsG711) {
            negotiatedCodecIsG711 = isG711;
            const cfg = MIC_PROFILES[currentProfileName] ?? MIC_PROFILES.clear;
            const nextHz = computeEffectiveLowPassHz(cfg);
            lowPass.frequency.setValueAtTime(nextHz, ctx.currentTime);
            console.info(
                `[softphone][mic-diag] Negotiated codec "${codecMimeType}" -> lowpass set to ${nextHz} Hz`,
            );
        }
    };

    const getLowPassFrequency = (): number => {
        const cfg = MIC_PROFILES[currentProfileName] ?? MIC_PROFILES.clear;
        return computeEffectiveLowPassHz(cfg);
    };

    const dispose = () => {
        disposed = true;
        try {
            window.removeEventListener("pointerdown", retryResumeOnGesture, true);
            window.removeEventListener("keydown", retryResumeOnGesture, true);
            destination.stream.getTracks().forEach((t) => t.stop());
            source.disconnect();
            hpf.disconnect();
            rnnoiseNode?.disconnect();
            expanderNode?.disconnect();
            lowMidCut.disconnect();
            manualGainNode.disconnect();
            compressor.disconnect();
            makeupGainNode.disconnect();
            highShelf.disconnect();
            lowPass.disconnect();
            limiter.disconnect();
            ceilingShaper.disconnect();
            analyser.disconnect();
            if (ctx.state !== "closed") {
                void ctx.close().catch(() => undefined);
            }
        } catch {
            // ignore
        }
    };

    return {
        stream: destination.stream,
        track: boostedTrack,
        rawStream,
        audioContext: ctx,
        analyser,
        ensureRunning,
        setGain,
        getGain,
        setProfile,
        getProfile,
        setRnnoiseEnabled,
        getRnnoiseEnabled,
        isRnnoiseLoaded,
        setNegotiatedCodec,
        getLowPassFrequency,
        getLiveLevelSnapshot,
        dispose,
    };
}

/**
 * Step 6: SDP / Codec modifier:
 * - Offer Opus first, then G.722, then PCMA / PCMU (and keep telephone-event).
 * - Apply Opus fmtp parameters:
 *   maxaveragebitrate=48000;stereo=0;sprop-stereo=0;useinbandfec=1;usedtx=0;cbr=0;maxplaybackrate=48000
 */
export function preferOpusG722AndApplyFmtp(sdp: string): string {
    if (!sdp || !sdp.includes("m=audio")) {
        return sdp;
    }

    const lines = sdp.split(/\r?\n/);
    let opusPt: string | null = null;
    const g722Pts: string[] = [];
    const pcmaPcmuPts: string[] = [];

    let inAudio = false;
    for (const line of lines) {
        if (line.startsWith("m=audio ")) {
            inAudio = true;
            continue;
        }
        if (line.startsWith("m=")) {
            inAudio = false;
            continue;
        }
        if (!inAudio) continue;

        const match = line.match(/^a=rtpmap:(\d+)\s+([^\s/]+)/i);
        if (match) {
            const pt = match[1];
            const codec = match[2].toUpperCase();
            if (codec === "OPUS" && !opusPt) {
                opusPt = pt;
            } else if (codec === "G722") {
                g722Pts.push(pt);
            } else if (codec === "PCMA" || codec === "PCMU") {
                pcmaPcmuPts.push(pt);
            }
        }
    }

    const desiredFmtpParams: Record<string, string> = {
        maxaveragebitrate: "48000",
        stereo: "0",
        "sprop-stereo": "0",
        useinbandfec: "1",
        usedtx: "0",
        cbr: "0",
        maxplaybackrate: "48000",
    };

    inAudio = false;
    const outLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith("m=audio ")) {
            inAudio = true;
            const parts = line.trim().split(/\s+/);
            if (parts.length > 3) {
                const header = parts.slice(0, 3);
                const pts = parts.slice(3);
                const orderedPts: string[] = [];
                const pushIfPresent = (pt: string) => {
                    if (pts.includes(pt) && !orderedPts.includes(pt)) {
                        orderedPts.push(pt);
                    }
                };
                if (opusPt) pushIfPresent(opusPt);
                g722Pts.forEach(pushIfPresent);
                pcmaPcmuPts.forEach(pushIfPresent);
                pts.forEach(pushIfPresent);
                outLines.push([...header, ...orderedPts].join(" "));
                continue;
            }
        } else if (line.startsWith("m=")) {
            inAudio = false;
        }

        if (inAudio && opusPt && line.startsWith(`a=fmtp:${opusPt} `)) {
            const existingRaw = line.slice(`a=fmtp:${opusPt} `.length).trim();
            const kvMap: Record<string, string> = {};
            existingRaw.split(";").forEach((pair) => {
                const [k, v] = pair.split("=").map((s) => s.trim());
                if (k && v !== undefined) {
                    kvMap[k] = v;
                }
            });
            Object.assign(kvMap, desiredFmtpParams);
            const merged = Object.entries(kvMap)
                .map(([k, v]) => `${k}=${v}`)
                .join(";");
            outLines.push(`a=fmtp:${opusPt} ${merged}`);
            continue;
        }

        outLines.push(line);

        if (
            inAudio &&
            opusPt &&
            line.startsWith(`a=rtpmap:${opusPt} `) &&
            !lines.some((l) => l.startsWith(`a=fmtp:${opusPt} `))
        ) {
            const merged = Object.entries(desiredFmtpParams)
                .map(([k, v]) => `${k}=${v}`)
                .join(";");
            outLines.push(`a=fmtp:${opusPt} ${merged}`);
        }
    }

    return outLines.join("\r\n");
}

export async function ensureAudioSenderBitrateUncapped(
    sender: RTCRtpSender,
): Promise<void> {
    if (typeof sender.getParameters !== "function" || typeof sender.setParameters !== "function") {
        return;
    }
    try {
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
            return;
        }
        let changed = false;
        for (const enc of params.encodings) {
            if (enc.maxBitrate !== undefined && enc.maxBitrate < 32000) {
                delete enc.maxBitrate;
                changed = true;
            }
        }
        if (changed) {
            await sender.setParameters(params);
            console.info("[softphone][mic-diag] Removed low maxBitrate cap (<32kbps) on audio RTCRtpSender");
        }
    } catch (err) {
        console.warn("[softphone][mic-diag] Could not update audio sender parameters:", err);
    }
}

/**
 * Step 7: Offline AudioBuffer analysis for the 10-second verification & diagnostic tap.
 * Reports:
 * - Speech RMS dBFS (Pass: -24 to -16 dBFS)
 * - Peak dBFS (Pass: < -3.0 dBFS)
 * - Noise Floor dBFS (Pass: < -50 dBFS, < -55 dBFS after fixing OS gain)
 * - Exact-Zero Fraction (Pass: 0% inside speech)
 * - Average level above 6 kHz relative to speech (Pass: <= -25.0 dB, i.e., at least 25 dB under speech)
 */
export interface AudioBufferVerificationReport {
    durationSec: number;
    sampleRate: number;
    peakDbfs: number;
    overallRmsDbfs: number;
    speechRmsDbfs: number;
    noiseFloorDbfs: number;
    above6kDbfs: number;
    above6kRelativeDb: number;
    exactZeroFraction: number;
    speechExactZeroFraction: number;
    passed: boolean;
    criteria: {
        speechRmsOk: boolean;       // -24 to -16 dBFS
        peakOk: boolean;            // < -3.0 dBFS
        noZeroGapsInSpeech: boolean; // speechExactZeroFraction === 0
        noiseFloorOk: boolean;      // < -50 dBFS
        noiseFloorStrictOk: boolean; // < -55 dBFS
        above6kOk: boolean;         // <= -25.0 dB relative to speech
    };
}

function makeHighPassBiquad(f0: number, Fs: number, Q = 0.7071): (x: number) => number {
    const w0 = (2 * Math.PI * f0) / Fs;
    const cosw0 = Math.cos(w0);
    const sinw0 = Math.sin(w0);
    const alpha = sinw0 / (2 * Q);
    const a0 = 1 + alpha;
    const b0 = (1 + cosw0) / 2 / a0;
    const b1 = -(1 + cosw0) / a0;
    const b2 = (1 + cosw0) / 2 / a0;
    const a1 = (-2 * cosw0) / a0;
    const a2 = (1 - alpha) / a0;
    let x1 = 0,
        x2 = 0,
        y1 = 0,
        y2 = 0;
    return (x: number) => {
        const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1;
        x1 = x;
        y2 = y1;
        y1 = y;
        return y;
    };
}

export function analyzeAudioBufferMetrics(
    audioBuffer: AudioBuffer,
): AudioBufferVerificationReport {
    const data = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const totalSamples = data.length;
    const durationSec = sampleRate > 0 ? totalSamples / sampleRate : 0;

    // 4th-order Butterworth high-pass filter at 6000 Hz to measure >6 kHz energy
    const hp6kStage1 = makeHighPassBiquad(6000, sampleRate, 0.5412);
    const hp6kStage2 = makeHighPassBiquad(6000, sampleRate, 1.3065);

    let peak = 0;
    let totalSumSq = 0;
    let totalExactZeros = 0;

    const frameSize = Math.max(1, Math.floor(sampleRate * 0.02));
    const frameDbs: number[] = [];
    const frameRmsLins: number[] = [];
    const frameAbove6kSumSq: number[] = [];
    const frameZeroCounts: number[] = [];

    for (let start = 0; start + frameSize <= totalSamples; start += frameSize) {
        let sumSq = 0;
        let above6kSq = 0;
        let zeros = 0;
        for (let j = start; j < start + frameSize; j++) {
            const s = data[j];
            if (s === 0) {
                zeros++;
                totalExactZeros++;
            }
            const abs = Math.abs(s);
            if (abs > peak) {
                peak = abs;
            }
            sumSq += s * s;
            totalSumSq += s * s;

            const hf = hp6kStage2(hp6kStage1(s));
            above6kSq += hf * hf;
        }
        const rms = Math.sqrt(sumSq / frameSize);
        const db = rms > 1e-6 ? 20 * Math.log10(rms) : -100;
        frameDbs.push(db);
        frameRmsLins.push(rms);
        frameAbove6kSumSq.push(above6kSq);
        frameZeroCounts.push(zeros);
    }

    const overallRmsLin = totalSamples > 0 ? Math.sqrt(totalSumSq / totalSamples) : 0;
    const overallRmsDbfs = overallRmsLin > 1e-6 ? 20 * Math.log10(overallRmsLin) : -100;
    const peakDbfs = peak > 1e-6 ? 20 * Math.log10(peak) : -100;
    const exactZeroFraction = totalSamples > 0 ? totalExactZeros / totalSamples : 0;

    const sortedDbs = [...frameDbs].sort((a, b) => a - b);
    const noiseFloorIdx = Math.floor(sortedDbs.length * 0.15);
    const noiseFloorDbfs = sortedDbs.length > 0 ? sortedDbs[noiseFloorIdx] : -100;

    const speechThresholdDb = Math.max(-42, noiseFloorDbfs + 12);
    let speechSumSq = 0;
    let speechAbove6kSumSq = 0;
    let speechSampleCount = 0;
    let speechZeroCount = 0;

    for (let f = 0; f < frameDbs.length; f++) {
        if (frameDbs[f] >= speechThresholdDb) {
            speechSumSq += frameRmsLins[f] * frameRmsLins[f] * frameSize;
            speechAbove6kSumSq += frameAbove6kSumSq[f];
            speechSampleCount += frameSize;
            speechZeroCount += frameZeroCounts[f];
        }
    }

    const speechRmsDbfs =
        speechSampleCount > 0
            ? 20 * Math.log10(Math.max(1e-6, Math.sqrt(speechSumSq / speechSampleCount)))
            : overallRmsDbfs;
    const above6kDbfs =
        speechSampleCount > 0
            ? 20 * Math.log10(Math.max(1e-7, Math.sqrt(speechAbove6kSumSq / speechSampleCount)))
            : -100;
    const above6kRelativeDb = above6kDbfs - speechRmsDbfs;
    const speechExactZeroFraction =
        speechSampleCount > 0 ? speechZeroCount / speechSampleCount : exactZeroFraction;

    const speechRmsOk = speechRmsDbfs >= -24.0 && speechRmsDbfs <= -16.0;
    const peakOk = peakDbfs < -3.0;
    const noZeroGapsInSpeech = speechExactZeroFraction === 0;
    const noiseFloorOk = noiseFloorDbfs < -50.0;
    const noiseFloorStrictOk = noiseFloorDbfs < -55.0;
    const above6kOk = above6kRelativeDb <= -25.0;

    return {
        durationSec,
        sampleRate,
        peakDbfs,
        overallRmsDbfs,
        speechRmsDbfs,
        noiseFloorDbfs,
        above6kDbfs,
        above6kRelativeDb,
        exactZeroFraction,
        speechExactZeroFraction,
        passed: speechRmsOk && peakOk && noZeroGapsInSpeech && noiseFloorOk && above6kOk,
        criteria: {
            speechRmsOk,
            peakOk,
            noZeroGapsInSpeech,
            noiseFloorOk,
            noiseFloorStrictOk,
            above6kOk,
        },
    };
}
