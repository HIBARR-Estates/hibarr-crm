import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    AlertTriangle,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Download,
    Headphones,
    Mic,
    PhoneCall,
    Radio,
    RefreshCw,
    Sliders,
    Square,
    Volume2,
} from "lucide-react";
import { softphone, type OutboundAudioDiagnostics } from "@/lib/softphone/SoftphoneClient";
import {
    buildExplicitMicConstraints,
    createBoostedMicStream,
    ensureAudioSenderBitrateUncapped,
    gainToDb,
    inspectAndLogRawTrackSettings,
    isBluetoothOrHandsFreeDevice,
    MAX_MIC_GAIN,
    MIC_PROFILES,
    MIN_MIC_GAIN,
    preferOpusG722AndApplyFmtp,
    readStoredInputDeviceId,
    readStoredMicGain,
    readStoredMicProfile,
    readStoredRnnoiseEnabled,
    storeInputDeviceId,
    storeMicGain,
    storeMicProfile,
    storeRnnoiseEnabled,
    type AudioBufferVerificationReport,
    type BoostedMicProcessor,
    type LiveLevelSnapshot,
    type MicProfileName,
    type RawTrackSettingsReport,
} from "@/lib/softphone/micAudioProcessor";
import {
    AUDIO_MIME_CANDIDATES,
    formatBytes,
    formatTimer,
    getSupportedMimeType,
    toStandardAudioBlobWithMetrics,
} from "./micDiagnosticsUtils";

interface SoftphoneMicDiagnosticsProps {
    inCall: boolean;
    activeCallId?: string | null;
    isCallConnected?: boolean;
}

type AudioPipelineMode = "webrtc_loopback" | "pstn_simulation" | "direct_mic";

interface TapRecordingArtifact {
    url: string;
    size: number;
    ext: string;
    metrics: AudioBufferVerificationReport | null;
}

interface DualTapComparisonResult {
    timestamp: number;
    profile: MicProfileName;
    manualGain: number;
    rawSettings: RawTrackSettingsReport | null;
    audioContextState: AudioContextState;
    raw: TapRecordingArtifact;
    processed: TapRecordingArtifact;
}

export default function SoftphoneMicDiagnostics({
    inCall,
    activeCallId,
    isCallConnected = false,
}: SoftphoneMicDiagnosticsProps) {
    const { t } = useTranslation();

    const [isExpanded, setIsExpanded] = useState<boolean>(() => {
        try {
            return window.localStorage.getItem("softphone.mic_test.expanded") === "true";
        } catch {
            return false;
        }
    });

    // Test Audio Pipeline: WebRTC local loopback (default, 0-cost), PSTN telephone filter, or direct
    const [pipelineMode, setPipelineMode] = useState<AudioPipelineMode>("webrtc_loopback");

    // Step 2: Explicit capture constraints (default: echoCancellation=true, noiseSuppression=false, autoGainControl=true, channelCount=1)
    const [echoCancellation, setEchoCancellation] = useState<boolean>(true);
    const [noiseSuppression, setNoiseSuppression] = useState<boolean>(false);
    const [autoGainControl, setAutoGainControl] = useState<boolean>(true);

    // Step 3, 4 & 6: Processing profile, RNNoise AudioWorklet toggle, & manual gain (up to 20x / +26 dB)
    const [profile, setProfile] = useState<MicProfileName>(() => readStoredMicProfile());
    const [micGain, setMicGain] = useState<number>(() => readStoredMicGain());
    const [rnnoiseEnabled, setRnnoiseEnabled] = useState<boolean>(() => readStoredRnnoiseEnabled());

    // Step 2: Audio Input Devices + Bluetooth/Hands-Free detection
    const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>(() => readStoredInputDeviceId());
    const [rawTrackReport, setRawTrackReport] = useState<RawTrackSettingsReport | null>(null);

    // Live Monitor in headphones
    const [liveMonitor, setLiveMonitor] = useState<boolean>(false);

    // Auto-record preference for real calls
    const [autoRecordCallMic, setAutoRecordCallMic] = useState<boolean>(() => {
        try {
            return window.localStorage.getItem("softphone.auto_record_call_mic") === "true";
        } catch {
            return false;
        }
    });

    // Diagnostics stats (real call or WebRTC loopback)
    const [diagnostics, setDiagnostics] = useState<OutboundAudioDiagnostics | null>(null);

    // Step 5: Live audio level meter (RMS dBFS, Peak dBFS, 3s speech avg, hint)
    const [audioLevelPct, setAudioLevelPct] = useState<number>(0);
    const [liveSnapshot, setLiveSnapshot] = useState<LiveLevelSnapshot | null>(null);

    // Recording states
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [isRunningDualTap, setIsRunningDualTap] = useState<boolean>(false);
    const [recordDuration, setRecordDuration] = useState<number>(0);
    const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
    const [recordedBlobSize, setRecordedBlobSize] = useState<number | null>(null);
    const [recordedExt, setRecordedExt] = useState<string>("wav");
    const [recordedSummary, setRecordedSummary] = useState<string | null>(null);
    const [recordedMetrics, setRecordedMetrics] = useState<AudioBufferVerificationReport | null>(null);

    // Step 1: 10s Dual-Tap result (Raw vs Processed)
    const [dualTapResult, setDualTapResult] = useState<DualTapComparisonResult | null>(null);

    // Step 7: Per-profile verification reports
    const [profileReports, setProfileReports] = useState<
        Partial<Record<MicProfileName, AudioBufferVerificationReport>>
    >({});

    // References for cleanup and media nodes
    const localStreamRef = useRef<MediaStream | null>(null);
    const remoteStreamRef = useRef<MediaStream | null>(null);
    const pc1Ref = useRef<RTCPeerConnection | null>(null);
    const pc2Ref = useRef<RTCPeerConnection | null>(null);
    const animFrameRef = useRef<number | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const rawRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const rawRecordedChunksRef = useRef<Blob[]>([]);
    const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const autoStopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const monitorAudioElRef = useRef<HTMLAudioElement | null>(null);
    const prevUrlRef = useRef<string | null>(null);
    const prevDualTapUrlsRef = useRef<string[]>([]);
    const autoStartedCallRef = useRef<string | null>(null);
    const testMicProcessorRef = useRef<BoostedMicProcessor | null>(null);

    const handleProfileChange = (nextProfile: MicProfileName) => {
        const cfg = MIC_PROFILES[nextProfile] ?? MIC_PROFILES.clear;
        setProfile(nextProfile);
        storeMicProfile(nextProfile);
        setMicGain(cfg.defaultManualGain);
        storeMicGain(cfg.defaultManualGain);
        softphone.setMicProfile(nextProfile, cfg.defaultManualGain);
        if (testMicProcessorRef.current) {
            testMicProcessorRef.current.setProfile(nextProfile, cfg.defaultManualGain);
        }
    };

    const handleMicGainChange = (newGain: number) => {
        const clamped = Math.min(MAX_MIC_GAIN, Math.max(MIN_MIC_GAIN, newGain));
        setMicGain(clamped);
        storeMicGain(clamped);
        softphone.setMicGain(clamped);
        if (testMicProcessorRef.current) {
            testMicProcessorRef.current.setGain(clamped);
        }
    };

    const handleRnnoiseToggle = (enabled: boolean) => {
        setRnnoiseEnabled(enabled);
        storeRnnoiseEnabled(enabled);
        softphone.setRnnoiseEnabled(enabled);
        if (testMicProcessorRef.current) {
            testMicProcessorRef.current.setRnnoiseEnabled(enabled);
        }
    };

    const handleDeviceChange = (deviceId: string) => {
        setSelectedDeviceId(deviceId);
        storeInputDeviceId(deviceId);
    };

    const toggleExpanded = () => {
        setIsExpanded((prev) => {
            const next = !prev;
            try {
                window.localStorage.setItem("softphone.mic_test.expanded", String(next));
            } catch {
                // ignore
            }
            return next;
        });
    };

    const handleAutoRecordToggle = (checked: boolean) => {
        setAutoRecordCallMic(checked);
        try {
            window.localStorage.setItem("softphone.auto_record_call_mic", String(checked));
        } catch {
            // ignore
        }
    };

    // Load available audio input devices
    const refreshAudioDevices = useCallback(async () => {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const inputs = devices.filter((d) => d.kind === "audioinput");
            setAudioDevices(inputs);
            if (!selectedDeviceId && inputs.length > 0) {
                setSelectedDeviceId(inputs[0].deviceId);
            }
        } catch {
            // ignore listing error
        }
    }, [selectedDeviceId]);

    useEffect(() => {
        if (isExpanded) {
            void refreshAudioDevices();
        }
    }, [isExpanded, refreshAudioDevices]);

    const selectedDeviceLabel =
        audioDevices.find((d) => d.deviceId === selectedDeviceId)?.label ||
        rawTrackReport?.label ||
        diagnostics?.trackLabel ||
        "";
    const showBluetoothWarning =
        isBluetoothOrHandsFreeDevice(selectedDeviceLabel) ||
        Boolean(rawTrackReport?.isBluetoothOrHandsFree);

    // Live level meter driven by BoostedMicProcessor.getLiveLevelSnapshot()
    const stopAudioMeter = useCallback(() => {
        if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = null;
        }
        setAudioLevelPct(0);
        setLiveSnapshot(null);
    }, []);

    const startProcessorMeter = useCallback(
        (processor: BoostedMicProcessor) => {
            stopAudioMeter();
            let lastConsoleLog = 0;
            const updateMeter = () => {
                const snap = processor.getLiveLevelSnapshot();
                setLiveSnapshot(snap);
                // Scale -55 dBFS ... 0 dBFS to 0% ... 100%
                const pct = Math.min(100, Math.max(0, ((snap.rmsDbfs + 55) / 55) * 100));
                setAudioLevelPct(pct);

                const now = Date.now();
                if (now - lastConsoleLog >= 1000) {
                    lastConsoleLog = now;
                    console.info("[softphone][mic-diag] Live Processed Level:", {
                        rmsDbfs: Number(snap.rmsDbfs.toFixed(1)),
                        peakDbfs: Number(snap.peakDbfs.toFixed(1)),
                        rolling3sSpeechRmsDbfs: Number(snap.rolling3sSpeechRmsDbfs.toFixed(1)),
                        exactZeroFraction: Number(snap.exactZeroFraction.toFixed(4)),
                        audioContextState: snap.audioContextState,
                    });
                }

                animFrameRef.current = requestAnimationFrame(updateMeter);
            };
            animFrameRef.current = requestAnimationFrame(updateMeter);
        },
        [stopAudioMeter],
    );

    // Cleanup all media, WebRTC peers, and timers on unmount
    useEffect(() => {
        return () => {
            if (prevUrlRef.current) {
                URL.revokeObjectURL(prevUrlRef.current);
            }
            prevDualTapUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
            stopAudioMeter();
            if (testMicProcessorRef.current) {
                testMicProcessorRef.current.dispose();
                testMicProcessorRef.current = null;
            }
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((t) => t.stop());
                localStreamRef.current = null;
            }
            if (remoteStreamRef.current) {
                remoteStreamRef.current.getTracks().forEach((t) => t.stop());
                remoteStreamRef.current = null;
            }
            if (pc1Ref.current) {
                pc1Ref.current.close();
                pc1Ref.current = null;
            }
            if (pc2Ref.current) {
                pc2Ref.current.close();
                pc2Ref.current = null;
            }
            if (recordTimerRef.current) {
                clearInterval(recordTimerRef.current);
                recordTimerRef.current = null;
            }
            if (autoStopTimeoutRef.current) {
                clearTimeout(autoStopTimeoutRef.current);
                autoStopTimeoutRef.current = null;
            }
            if (statsTimerRef.current) {
                clearInterval(statsTimerRef.current);
                statsTimerRef.current = null;
            }
        };
    }, [stopAudioMeter]);

    // Live diagnostics polling during real inCall
    useEffect(() => {
        if (!inCall) {
            if (!isRecording) {
                setDiagnostics(null);
            }
            return;
        }

        let cancelled = false;
        const pollDiagnostics = async () => {
            const diag = await softphone.getOutboundAudioDiagnostics();
            if (!cancelled && diag) {
                setDiagnostics(diag);
            }
            const activeProc = softphone.getActiveMicProcessor();
            if (!cancelled && activeProc && !animFrameRef.current && isExpanded) {
                startProcessorMeter(activeProc);
            }
        };

        void pollDiagnostics();
        const interval = setInterval(pollDiagnostics, 1000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [inCall, isRecording, isExpanded, startProcessorMeter]);

    // Stop recording and teardown active test/call recorder
    const stopRecording = useCallback(() => {
        if (recordTimerRef.current) {
            clearInterval(recordTimerRef.current);
            recordTimerRef.current = null;
        }
        if (autoStopTimeoutRef.current) {
            clearTimeout(autoStopTimeoutRef.current);
            autoStopTimeoutRef.current = null;
        }
        if (statsTimerRef.current) {
            clearInterval(statsTimerRef.current);
            statsTimerRef.current = null;
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            try {
                mediaRecorderRef.current.stop();
            } catch {
                // ignore
            }
        }
        if (rawRecorderRef.current && rawRecorderRef.current.state !== "inactive") {
            try {
                rawRecorderRef.current.stop();
            } catch {
                // ignore
            }
        }
        setIsRecording(false);
        setIsRunningDualTap(false);
        stopAudioMeter();

        if (monitorAudioElRef.current) {
            monitorAudioElRef.current.pause();
            monitorAudioElRef.current.srcObject = null;
        }

        if (pc1Ref.current) {
            pc1Ref.current.close();
            pc1Ref.current = null;
        }
        if (pc2Ref.current) {
            pc2Ref.current.close();
            pc2Ref.current = null;
        }

        if (testMicProcessorRef.current) {
            testMicProcessorRef.current.dispose();
            testMicProcessorRef.current = null;
        }

        if (!inCall && localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((t) => t.stop());
            localStreamRef.current = null;
        }
        if (remoteStreamRef.current) {
            remoteStreamRef.current.getTracks().forEach((t) => t.stop());
            remoteStreamRef.current = null;
        }
    }, [inCall, stopAudioMeter]);

    // Start In-Call Mic Stream Recording (real call)
    const startCallMicRecording = useCallback(() => {
        if (isRecording) return;
        const stream = softphone.getLocalSendStream();
        if (!stream) {
            console.warn("[softphone] No active outbound audio track to record.");
            return;
        }

        localStreamRef.current = stream;
        const activeProc = softphone.getActiveMicProcessor();
        if (activeProc) {
            void activeProc.ensureRunning();
            startProcessorMeter(activeProc);
        }

        const mimeType = getSupportedMimeType();
        recordedChunksRef.current = [];
        const activeProfile = softphone.getMicProfile();

        try {
            const recorder = new MediaRecorder(
                stream,
                mimeType ? { mimeType, audioBitsPerSecond: 128000 } : { audioBitsPerSecond: 128000 },
            );

            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    recordedChunksRef.current.push(e.data);
                }
            };

            recorder.onstop = async () => {
                const rawBlob = new Blob(recordedChunksRef.current, {
                    type: recorder.mimeType || mimeType || "audio/mp4",
                });
                recordedChunksRef.current = [];
                const { blob: finalBlob, ext, metrics } = await toStandardAudioBlobWithMetrics(rawBlob);
                if (prevUrlRef.current) {
                    URL.revokeObjectURL(prevUrlRef.current);
                }
                const url = URL.createObjectURL(finalBlob);
                prevUrlRef.current = url;
                setRecordedUrl(url);
                setRecordedBlobSize(finalBlob.size);
                setRecordedExt(ext);
                setRecordedMetrics(metrics);
                if (metrics) {
                    setProfileReports((prev) => ({ ...prev, [activeProfile]: metrics }));
                }
                setRecordedSummary(
                    `Live Call Outbound Mic · Profile: ${MIC_PROFILES[activeProfile].label} · Gain: ${softphone.getMicGain().toFixed(1)}x (${gainToDb(softphone.getMicGain())})`,
                );
                stream.getTracks().forEach((t) => t.stop());
            };

            recorder.start(250);
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
            setRecordDuration(0);

            recordTimerRef.current = setInterval(() => {
                setRecordDuration((prev) => prev + 1);
            }, 1000);
        } catch (err) {
            console.error("[softphone] Failed to initialize outbound mic recorder:", err);
            stream.getTracks().forEach((t) => t.stop());
        }
    }, [isRecording, startProcessorMeter]);

    // Auto-record trigger when activeCall connects
    useEffect(() => {
        if (inCall && isCallConnected && autoRecordCallMic && !isRecording) {
            if (activeCallId && autoStartedCallRef.current !== activeCallId) {
                autoStartedCallRef.current = activeCallId;
                startCallMicRecording();
            }
        }
        if (!inCall && isRecording && autoStartedCallRef.current) {
            stopRecording();
            autoStartedCallRef.current = null;
        }
    }, [inCall, isCallConnected, autoRecordCallMic, isRecording, activeCallId, startCallMicRecording, stopRecording]);

    /**
     * Step 1 & Step 7: Record 10 seconds simultaneously from BOTH the raw getUserMedia track
     * and the processed track out of createBoostedMicStream (same timestamps) and save as two files.
     */
    const runDiagnosticTap10s = async () => {
        if (isRecording) return;
        stopAudioMeter();
        setDualTapResult(null);

        try {
            const explicitAudio = buildExplicitMicConstraints({
                deviceId: selectedDeviceId || undefined,
                echoCancellation,
                noiseSuppression,
                autoGainControl,
                channelCount: 1,
            });

            const rawStream = await navigator.mediaDevices.getUserMedia({
                audio: explicitAudio,
                video: false,
            });
            localStreamRef.current = rawStream;
            void refreshAudioDevices();

            const boostedProcessor = createBoostedMicStream(rawStream, micGain, profile);
            boostedProcessor.setRnnoiseEnabled(rnnoiseEnabled);
            if (pipelineMode === "pstn_simulation" || profile === "pstn_call") {
                boostedProcessor.setNegotiatedCodec("audio/PCMU");
            }
            testMicProcessorRef.current = boostedProcessor;

            // Step 3: Await ctx.resume() inside user gesture
            const ctxState = await boostedProcessor.ensureRunning();

            const rawTrack = rawStream.getAudioTracks()[0];
            const settingsReport = rawTrack
                ? inspectAndLogRawTrackSettings(
                      rawTrack,
                      {
                          deviceId: selectedDeviceId || undefined,
                          echoCancellation,
                          noiseSuppression,
                          autoGainControl,
                          channelCount: 1,
                      },
                      ctxState,
                  )
                : null;
            setRawTrackReport(settingsReport);

            startProcessorMeter(boostedProcessor);

            const mimeType = getSupportedMimeType();
            rawRecordedChunksRef.current = [];
            recordedChunksRef.current = [];

            const rawMediaForRecorder = new MediaStream([rawTrack.clone()]);
            const procMediaForRecorder = new MediaStream([boostedProcessor.track.clone()]);

            const rawRecorder = new MediaRecorder(
                rawMediaForRecorder,
                mimeType ? { mimeType, audioBitsPerSecond: 128000 } : { audioBitsPerSecond: 128000 },
            );
            const procRecorder = new MediaRecorder(
                procMediaForRecorder,
                mimeType ? { mimeType, audioBitsPerSecond: 128000 } : { audioBitsPerSecond: 128000 },
            );

            rawRecorderRef.current = rawRecorder;
            mediaRecorderRef.current = procRecorder;

            rawRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    rawRecordedChunksRef.current.push(e.data);
                }
            };
            procRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    recordedChunksRef.current.push(e.data);
                }
            };

            const tapTimestamp = Date.now();
            const activeProfileSnapshot = profile;
            const activeGainSnapshot = micGain;

            const rawDonePromise = new Promise<Blob>((resolve) => {
                rawRecorder.onstop = () => {
                    rawMediaForRecorder.getTracks().forEach((t) => t.stop());
                    resolve(
                        new Blob(rawRecordedChunksRef.current, {
                            type: rawRecorder.mimeType || mimeType || "audio/mp4",
                        }),
                    );
                };
            });

            const procDonePromise = new Promise<Blob>((resolve) => {
                procRecorder.onstop = () => {
                    procMediaForRecorder.getTracks().forEach((t) => t.stop());
                    resolve(
                        new Blob(recordedChunksRef.current, {
                            type: procRecorder.mimeType || mimeType || "audio/mp4",
                        }),
                    );
                };
            });

            // Start BOTH recorders at the exact same timestamp
            rawRecorder.start(250);
            procRecorder.start(250);

            setIsRecording(true);
            setIsRunningDualTap(true);
            setRecordDuration(0);

            recordTimerRef.current = setInterval(() => {
                setRecordDuration((prev) => prev + 1);
            }, 1000);

            // Auto-stop at 10 seconds
            autoStopTimeoutRef.current = setTimeout(() => {
                stopRecording();
            }, 10_000);

            const [rawBlob, procBlob] = await Promise.all([rawDonePromise, procDonePromise]);
            rawRecordedChunksRef.current = [];
            recordedChunksRef.current = [];

            const [rawConv, procConv] = await Promise.all([
                toStandardAudioBlobWithMetrics(rawBlob),
                toStandardAudioBlobWithMetrics(procBlob),
            ]);

            prevDualTapUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
            const rawUrl = URL.createObjectURL(rawConv.blob);
            const procUrl = URL.createObjectURL(procConv.blob);
            prevDualTapUrlsRef.current = [rawUrl, procUrl];

            if (procConv.metrics) {
                setProfileReports((prev) => ({
                    ...prev,
                    [activeProfileSnapshot]: procConv.metrics!,
                }));
            }

            console.info("[softphone][mic-diag] 10s Dual-Tap Verification Report:", {
                profile: activeProfileSnapshot,
                manualGain: activeGainSnapshot,
                rawMetrics: rawConv.metrics,
                processedMetrics: procConv.metrics,
            });

            setDualTapResult({
                timestamp: tapTimestamp,
                profile: activeProfileSnapshot,
                manualGain: activeGainSnapshot,
                rawSettings: settingsReport,
                audioContextState: ctxState,
                raw: {
                    url: rawUrl,
                    size: rawConv.blob.size,
                    ext: rawConv.ext,
                    metrics: rawConv.metrics,
                },
                processed: {
                    url: procUrl,
                    size: procConv.blob.size,
                    ext: procConv.ext,
                    metrics: procConv.metrics,
                },
            });
        } catch (err) {
            console.error("[softphone] 10s dual diagnostic tap failed:", err);
            stopRecording();
        }
    };

    // Start Standalone Simulated Call (0-cost WebRTC loopback or PSTN filter)
    const startSimulatedTestCall = async (autoStopSec?: number) => {
        if (isRecording) return;
        stopAudioMeter();
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((t) => t.stop());
            localStreamRef.current = null;
        }

        try {
            // Step 2: Explicit capture constraints
            const explicitAudio = buildExplicitMicConstraints({
                deviceId: selectedDeviceId || undefined,
                echoCancellation,
                noiseSuppression,
                autoGainControl,
                channelCount: 1,
            });

            const rawMicStream = await navigator.mediaDevices.getUserMedia({
                audio: explicitAudio,
                video: false,
            });
            localStreamRef.current = rawMicStream;
            void refreshAudioDevices();

            const rawMicTrack = rawMicStream.getAudioTracks()[0];

            // Step 3 & 4: Create profile-driven Web Audio processor & await resume inside click gesture
            const boostedProcessor = createBoostedMicStream(rawMicStream, micGain, profile);
            boostedProcessor.setRnnoiseEnabled(rnnoiseEnabled);
            testMicProcessorRef.current = boostedProcessor;
            const ctxState = await boostedProcessor.ensureRunning();

            const settingsReport = rawMicTrack
                ? inspectAndLogRawTrackSettings(
                      rawMicTrack,
                      {
                          deviceId: selectedDeviceId || undefined,
                          echoCancellation,
                          noiseSuppression,
                          autoGainControl,
                          channelCount: 1,
                      },
                      ctxState,
                  )
                : null;
            setRawTrackReport(settingsReport);

            const micStream = boostedProcessor.stream;
            const micSettings = rawMicTrack ? rawMicTrack.getSettings() : null;

            let captureStream: MediaStream = micStream;

            if (pipelineMode === "webrtc_loopback") {
                const pc1 = new RTCPeerConnection();
                const pc2 = new RTCPeerConnection();

                pc1Ref.current = pc1;
                pc2Ref.current = pc2;

                pc1.onicecandidate = (e) => {
                    if (e.candidate) void pc2.addIceCandidate(e.candidate).catch(() => undefined);
                };
                pc2.onicecandidate = (e) => {
                    if (e.candidate) void pc1.addIceCandidate(e.candidate).catch(() => undefined);
                };

                const remotePromise = new Promise<MediaStream>((resolve) => {
                    pc2.ontrack = (event) => {
                        const rStream = event.streams[0] || new MediaStream([event.track]);
                        resolve(rStream);
                    };
                });

                micStream.getTracks().forEach((track) => {
                    const sender = pc1.addTrack(track, micStream);
                    void ensureAudioSenderBitrateUncapped(sender);
                });

                // Step 6: Offer Opus first, then G.722, then PCMA/PCMU, and apply Opus fmtp
                const rawOffer = await pc1.createOffer();
                const modifiedOffer: RTCSessionDescriptionInit = {
                    type: rawOffer.type,
                    sdp: preferOpusG722AndApplyFmtp(rawOffer.sdp ?? ""),
                };
                await pc1.setLocalDescription(modifiedOffer);
                await pc2.setRemoteDescription(modifiedOffer);

                const rawAnswer = await pc2.createAnswer();
                const modifiedAnswer: RTCSessionDescriptionInit = {
                    type: rawAnswer.type,
                    sdp: preferOpusG722AndApplyFmtp(rawAnswer.sdp ?? ""),
                };
                await pc2.setLocalDescription(modifiedAnswer);
                await pc1.setRemoteDescription(modifiedAnswer);

                const loopbackRemoteStream = await remotePromise;
                remoteStreamRef.current = loopbackRemoteStream;
                captureStream = loopbackRemoteStream;

                statsTimerRef.current = setInterval(async () => {
                    if (!pc1Ref.current) return;
                    try {
                        const stats = await pc1Ref.current.getStats();
                        let bytesSent = 0;
                        let packetsSent = 0;
                        let audioLevel: number | null = null;
                        let codecName: string | null = null;

                        stats.forEach((r: Record<string, unknown>) => {
                            if (r.type === "outbound-rtp" && (r.kind === "audio" || r.mediaType === "audio")) {
                                bytesSent = Number(r.bytesSent || 0);
                                packetsSent = Number(r.packetsSent || 0);
                            }
                            if (r.type === "media-source" && typeof r.audioLevel === "number") {
                                audioLevel = r.audioLevel;
                            }
                            if (r.type === "codec" && typeof r.mimeType === "string" && r.mimeType.toLowerCase().includes("audio")) {
                                codecName = r.mimeType;
                            }
                        });

                        // Step 2: Update processor's negotiated codec from getStats()
                        boostedProcessor.setNegotiatedCodec(codecName);

                        setDiagnostics({
                            trackSettings: micSettings,
                            trackLabel: rawMicTrack?.label || "Local Mic",
                            enabled: rawMicTrack?.enabled ?? true,
                            muted: rawMicTrack?.muted ?? false,
                            bytesSent,
                            packetsSent,
                            audioLevel,
                            codec: codecName || "audio/opus (48kbps FEC, DTX=0)",
                        });
                    } catch {
                        // ignore stats error
                    }
                }, 1000);
            } else if (pipelineMode === "pstn_simulation") {
                // Step 2: When PCMU/PCMA is negotiated, set lowpass to 3600 Hz
                boostedProcessor.setNegotiatedCodec("audio/PCMU");

                const AudioCtx =
                    window.AudioContext ||
                    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
                const ctx = new AudioCtx();
                if (ctx.state === "suspended") {
                    await ctx.resume().catch(() => undefined);
                }
                const source = ctx.createMediaStreamSource(micStream);
                const highpass = ctx.createBiquadFilter();
                highpass.type = "highpass";
                highpass.frequency.setValueAtTime(300, ctx.currentTime);

                const lowpass = ctx.createBiquadFilter();
                lowpass.type = "lowpass";
                lowpass.frequency.setValueAtTime(3600, ctx.currentTime);

                const dest = ctx.createMediaStreamDestination();
                source.connect(highpass).connect(lowpass).connect(dest);

                captureStream = dest.stream;
                remoteStreamRef.current = dest.stream;

                setDiagnostics({
                    trackSettings: micSettings,
                    trackLabel: `${rawMicTrack?.label || "Mic"} (PSTN G.711)`,
                    enabled: true,
                    muted: false,
                    bytesSent: 0,
                    packetsSent: 0,
                    audioLevel: null,
                    codec: "audio/PCMU (3600 Hz LowPass)",
                });
            } else {
                boostedProcessor.setNegotiatedCodec(profile === "pstn_call" ? "audio/PCMU" : "audio/opus");
                setDiagnostics({
                    trackSettings: micSettings,
                    trackLabel: rawMicTrack?.label || "Direct Mic",
                    enabled: true,
                    muted: false,
                    bytesSent: 0,
                    packetsSent: 0,
                    audioLevel: null,
                    codec: "PCM Linear (Processed Chain)",
                });
            }

            // Start Live Level Meter on the BoostedMicProcessor's AnalyserNode
            startProcessorMeter(boostedProcessor);

            if (liveMonitor && monitorAudioElRef.current) {
                monitorAudioElRef.current.srcObject = captureStream;
                void monitorAudioElRef.current.play().catch(() => undefined);
            }

            const activeProfileSnapshot = profile;
            const pipelineName =
                pipelineMode === "webrtc_loopback"
                    ? "WebRTC Opus Loopback"
                    : pipelineMode === "pstn_simulation"
                      ? "PSTN G.711 (3600Hz LP)"
                      : "Direct Processed";
            const summary = `${pipelineName} · Profile: ${MIC_PROFILES[activeProfileSnapshot].label} · RNNoise: ${rnnoiseEnabled ? "ON" : "OFF"} · Gain: ${micGain.toFixed(1)}x (${gainToDb(micGain)}) · ${micSettings?.sampleRate || 48000}Hz (AEC:${micSettings?.echoCancellation ? "ON" : "OFF"}, NS:${micSettings?.noiseSuppression ? "ON" : "OFF"}, AGC:${micSettings?.autoGainControl ? "ON" : "OFF"})`;
            setRecordedSummary(summary);

            const mimeType = getSupportedMimeType();
            recordedChunksRef.current = [];

            const recorder = new MediaRecorder(
                captureStream,
                mimeType ? { mimeType, audioBitsPerSecond: 128000 } : { audioBitsPerSecond: 128000 },
            );

            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    recordedChunksRef.current.push(e.data);
                }
            };

            recorder.onstop = async () => {
                const rawBlob = new Blob(recordedChunksRef.current, {
                    type: recorder.mimeType || mimeType || "audio/mp4",
                });
                recordedChunksRef.current = [];
                const { blob: finalBlob, ext, metrics } = await toStandardAudioBlobWithMetrics(rawBlob);
                if (prevUrlRef.current) {
                    URL.revokeObjectURL(prevUrlRef.current);
                }
                const url = URL.createObjectURL(finalBlob);
                prevUrlRef.current = url;
                setRecordedUrl(url);
                setRecordedBlobSize(finalBlob.size);
                setRecordedExt(ext);
                setRecordedMetrics(metrics);
                if (metrics) {
                    setProfileReports((prev) => ({
                        ...prev,
                        [activeProfileSnapshot]: metrics,
                    }));
                    console.info(
                        `[softphone][mic-diag] Profile "${activeProfileSnapshot}" Verification Metrics:`,
                        metrics,
                    );
                }
            };

            recorder.start(250);
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
            setRecordDuration(0);

            recordTimerRef.current = setInterval(() => {
                setRecordDuration((prev) => prev + 1);
            }, 1000);

            if (autoStopSec && autoStopSec > 0) {
                autoStopTimeoutRef.current = setTimeout(() => {
                    stopRecording();
                }, autoStopSec * 1000);
            }
        } catch (err) {
            console.error("[softphone] Standalone simulated call failed:", err);
            stopRecording();
        }
    };

    const renderMetricsBadge = (m: AudioBufferVerificationReport) => (
        <div style={{ fontSize: 10.5, marginTop: 6, padding: "6px 8px", borderRadius: 6, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, fontWeight: 600 }}>
                <span>Signal Verification ({m.durationSec.toFixed(1)}s)</span>
                <span style={{ color: m.passed ? "#16a34a" : "#d97706" }}>
                    {m.passed ? "PASS (All Criteria Met)" : "CHECK METRICS"}
                </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 8px", color: "#334155" }}>
                <span>
                    Speech RMS:{" "}
                    <strong style={{ color: m.criteria.speechRmsOk ? "#16a34a" : "#dc2626" }}>
                        {m.speechRmsDbfs.toFixed(1)} dBFS
                    </strong>{" "}
                    <small>(-24..-16)</small>
                </span>
                <span>
                    Peak:{" "}
                    <strong style={{ color: m.criteria.peakOk ? "#16a34a" : "#dc2626" }}>
                        {m.peakDbfs.toFixed(1)} dBFS
                    </strong>{" "}
                    <small>(&lt;-3)</small>
                </span>
                <span>
                    Noise floor:{" "}
                    <strong style={{ color: m.criteria.noiseFloorOk ? "#16a34a" : "#d97706" }}>
                        {m.noiseFloorDbfs.toFixed(1)} dBFS
                    </strong>{" "}
                    <small>(&lt;-50)</small>
                </span>
                <span>
                    Speech Zeros:{" "}
                    <strong style={{ color: m.criteria.noZeroGapsInSpeech ? "#16a34a" : "#dc2626" }}>
                        {(m.speechExactZeroFraction * 100).toFixed(3)}%
                    </strong>{" "}
                    <small>(0%)</small>
                </span>
                <span style={{ gridColumn: "1 / span 2" }}>
                    &gt;6 kHz vs Speech:{" "}
                    <strong style={{ color: m.criteria.above6kOk ? "#16a34a" : "#dc2626" }}>
                        {m.above6kRelativeDb.toFixed(1)} dB
                    </strong>{" "}
                    <small>(&le;-25 dB · abs {m.above6kDbfs.toFixed(1)} dBFS)</small>
                </span>
            </div>
        </div>
    );

    const activeLowPassHz =
        profile === "raw"
            ? "Bypass"
            : profile === "pstn_call" ||
                pipelineMode === "pstn_simulation" ||
                (diagnostics?.codec &&
                    (diagnostics.codec.toLowerCase().includes("pcmu") ||
                        diagnostics.codec.toLowerCase().includes("pcma")))
              ? "3600 Hz"
              : "7500 Hz";

    return (
        <div className="sp__mic-diag">
            <audio ref={monitorAudioElRef} className="hidden" />

            {/* Header Accordion Toggle */}
            <button
                type="button"
                className="sp__mic-diag-toggle"
                onClick={toggleExpanded}
                aria-expanded={isExpanded}
            >
                <span className="sp__mic-diag-title">
                    <Mic size={14} className="sp__mic-icon" />
                    <span>{t("pages.softphone.mic_test")}</span>
                    {inCall ? (
                        <span className="sp__badge sp__badge--live">{t("pages.softphone.call_mic")}</span>
                    ) : (
                        <span className="sp__badge">{t("pages.softphone.idle_test")}</span>
                    )}
                </span>
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {isExpanded && (
                <div className="sp__mic-diag-body">
                    {/* Step 2: Bluetooth / Hands-Free Warning */}
                    {showBluetoothWarning && (
                        <div
                            style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 6,
                                padding: "6px 8px",
                                marginBottom: 8,
                                borderRadius: 6,
                                background: "#fffbeb",
                                border: "1px solid #f59e0b",
                                color: "#92400e",
                                fontSize: 11,
                                lineHeight: 1.35,
                            }}
                        >
                            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1, color: "#d97706" }} />
                            <div>
                                <strong>Bluetooth / Hands-Free Mic Detected:</strong>{" "}
                                <span>
                                    "{selectedDeviceLabel}" uses narrowband Bluetooth HFP (8–16 kHz) with hardware gating. Switch to a wired/USB or built-in mic for full wideband clarity.
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Step 5: Live Audio Level Meter & Target Hint */}
                    <div className="sp__mic-meter-box">
                        <div className="sp__mic-meter-labels">
                            <span className="sp__mic-meter-name">
                                <Volume2 size={12} style={{ display: "inline", marginRight: 4, verticalAlign: "-1px" }} />
                                {t("pages.softphone.mic_level")}
                            </span>
                            <span className="sp__mic-meter-db">
                                {liveSnapshot && liveSnapshot.rmsDbfs > -80
                                    ? `RMS ${liveSnapshot.rmsDbfs.toFixed(1)} dB · Peak ${liveSnapshot.peakDbfs.toFixed(1)} dB`
                                    : "-∞ dBFS"}
                            </span>
                        </div>
                        <div className="sp__mic-meter-bar-track">
                            <div
                                className={`sp__mic-meter-bar-fill ${
                                    audioLevelPct > 85
                                        ? "sp__mic-meter-bar-fill--peak"
                                        : audioLevelPct > 55
                                          ? "sp__mic-meter-bar-fill--mid"
                                          : ""
                                }`}
                                style={{ width: `${audioLevelPct}%` }}
                            />
                        </div>
                        {liveSnapshot && (
                            <div
                                style={{
                                    marginTop: 5,
                                    fontSize: 10.5,
                                    fontWeight: 500,
                                    color:
                                        liveSnapshot.hint === "too_low"
                                            ? "#dc2626"
                                            : liveSnapshot.hint === "too_high"
                                              ? "#d97706"
                                              : liveSnapshot.hint === "ok"
                                                ? "#16a34a"
                                                : "#64748b",
                                }}
                            >
                                {liveSnapshot.hintMessage}
                            </div>
                        )}
                    </div>

                    {/* Step 3, 4 & 6: Audio Profile Selector + RNNoise Worklet Toggle + Manual Gain Slider */}
                    <div className="sp__mic-gain-box">
                        <div style={{ marginBottom: 8 }}>
                            <label className="sp__mic-field-label" style={{ display: "block", marginBottom: 3 }}>
                                Processing Profile (HPF → RNNoise → Expander → Low-Mid → Gain → Comp 0dB → HS -4dB → LP → -3dB Limiter)
                            </label>
                            <select
                                value={profile}
                                onChange={(e) => handleProfileChange(e.target.value as MicProfileName)}
                                className="sp__select"
                                style={{ width: "100%", fontSize: 11.5 }}
                            >
                                {(Object.keys(MIC_PROFILES) as MicProfileName[]).map((key) => (
                                    <option key={key} value={key}>
                                        {MIC_PROFILES[key].label}
                                    </option>
                                ))}
                            </select>
                            <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 3 }}>
                                {MIC_PROFILES[profile].description}
                            </div>
                        </div>

                        {/* Step 3: RNNoise AudioWorklet Toggle */}
                        <div style={{ marginBottom: 8, padding: "5px 7px", borderRadius: 5, background: "#f1f5f9", border: "1px solid #cbd5e1" }}>
                            <label className="sp__mic-checkbox-row" style={{ margin: 0 }}>
                                <input
                                    type="checkbox"
                                    checked={rnnoiseEnabled}
                                    onChange={(e) => handleRnnoiseToggle(e.target.checked)}
                                />
                                <span style={{ fontSize: 11, fontWeight: 600 }}>
                                    RNNoise AudioWorklet (Post-HPF Hiss &amp; Stationary Noise Denoiser)
                                </span>
                            </label>
                            <div style={{ fontSize: 10, color: "#475569", marginTop: 2, paddingLeft: 18 }}>
                                LowPass: <strong>{activeLowPassHz}</strong> · HighShelf 5kHz: <strong>{profile === "raw" ? "0 dB" : "-4 dB"}</strong> · Soft Expander (2:1, 12dB): <strong>{MIC_PROFILES[profile].expander.enabled ? "ACTIVE" : "OFF"}</strong>
                            </div>
                        </div>

                        <div className="sp__mic-gain-header">
                            <span className="sp__mic-gain-label">
                                <Sliders size={12} style={{ display: "inline", marginRight: 4, verticalAlign: "-1px" }} />
                                {t("pages.softphone.mic_gain_boost")}
                            </span>
                            <div className="sp__mic-gain-value-group">
                                <span className="sp__mic-gain-badge">
                                    {micGain.toFixed(1)}x ({gainToDb(micGain)})
                                </span>
                                {Math.abs(micGain - MIC_PROFILES[profile].defaultManualGain) > 0.05 && (
                                    <button
                                        type="button"
                                        className="sp__mic-gain-reset"
                                        onClick={() => handleMicGainChange(MIC_PROFILES[profile].defaultManualGain)}
                                    >
                                        {t("pages.softphone.reset_gain")}
                                    </button>
                                )}
                            </div>
                        </div>
                        <input
                            type="range"
                            min={MIN_MIC_GAIN}
                            max={MAX_MIC_GAIN}
                            step={0.2}
                            value={micGain}
                            onChange={(e) => handleMicGainChange(parseFloat(e.target.value))}
                            className="sp__mic-gain-slider"
                            aria-label={t("pages.softphone.mic_gain_boost")}
                        />
                        <div className="sp__mic-gain-bounds">
                            <span>0.5x (-6 dB)</span>
                            <span>4.0x (+12 dB)</span>
                            <span>20.0x (+26 dB)</span>
                        </div>
                    </div>

                    {/* Step 1 & 3: Live RTP & Raw Track.getSettings() + AudioContext.state Grid */}
                    {(diagnostics || rawTrackReport || liveSnapshot) && (
                        <div className="sp__diag-grid">
                            <div className="sp__diag-item">
                                <span className="sp__diag-key">{t("pages.softphone.microphone")}</span>
                                <span className="sp__diag-val" title={rawTrackReport?.label ?? diagnostics?.trackLabel ?? ""}>
                                    {rawTrackReport?.label || diagnostics?.trackLabel || "Mic"}
                                </span>
                            </div>
                            <div className="sp__diag-item">
                                <span className="sp__diag-key">AudioContext</span>
                                <span
                                    className={`sp__diag-val ${
                                        (liveSnapshot?.audioContextState ?? "running") === "running"
                                            ? "sp__diag-val--ok"
                                            : "sp__diag-val--off"
                                    }`}
                                >
                                    {liveSnapshot?.audioContextState ?? "running"}
                                </span>
                            </div>
                            <div className="sp__diag-item">
                                <span className="sp__diag-key">{t("pages.softphone.sample_rate")}</span>
                                <span className="sp__diag-val">
                                    {rawTrackReport?.sampleRate ?? diagnostics?.trackSettings?.sampleRate ?? 48000} Hz ·{" "}
                                    {rawTrackReport?.channelCount ?? diagnostics?.trackSettings?.channelCount ?? 1}ch
                                </span>
                            </div>
                            <div className="sp__diag-item">
                                <span className="sp__diag-key">AEC / NS / AGC</span>
                                <span className="sp__diag-val">
                                    {String(rawTrackReport?.echoCancellation ?? diagnostics?.trackSettings?.echoCancellation ?? echoCancellation)} /{" "}
                                    {String(rawTrackReport?.noiseSuppression ?? diagnostics?.trackSettings?.noiseSuppression ?? noiseSuppression)} /{" "}
                                    {String(rawTrackReport?.autoGainControl ?? diagnostics?.trackSettings?.autoGainControl ?? autoGainControl)}
                                </span>
                            </div>
                            {diagnostics?.codec && (
                                <div className="sp__diag-item">
                                    <span className="sp__diag-key">{t("pages.softphone.codec")}</span>
                                    <span className="sp__diag-val">{diagnostics.codec}</span>
                                </div>
                            )}
                            {diagnostics && diagnostics.packetsSent > 0 && (
                                <div className="sp__diag-item">
                                    <span className="sp__diag-key">RTP Sent</span>
                                    <span className="sp__diag-val">
                                        {diagnostics.packetsSent.toLocaleString()} pkts ({formatBytes(diagnostics.bytesSent)})
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Mode 1: During an Active Call */}
                    {inCall ? (
                        <div className="sp__mic-call-section">
                            <label className="sp__mic-checkbox-row">
                                <input
                                    type="checkbox"
                                    checked={autoRecordCallMic}
                                    onChange={(e) => handleAutoRecordToggle(e.target.checked)}
                                />
                                <span>{t("pages.softphone.auto_record_call_mic")}</span>
                            </label>

                            <div className="sp__mic-actions">
                                {isRecording ? (
                                    <button
                                        type="button"
                                        className="sp__btn-mic-rec sp__btn-mic-rec--recording"
                                        onClick={stopRecording}
                                    >
                                        <Square size={13} fill="currentColor" />
                                        <span>
                                            {t("pages.softphone.stop_recording_mic")} ({formatTimer(recordDuration)})
                                        </span>
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        className="sp__btn-mic-rec"
                                        onClick={startCallMicRecording}
                                    >
                                        <Radio size={13} />
                                        <span>{t("pages.softphone.record_call_mic")}</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Mode 2: Idle Standalone Simulated Call & Step 1 Dual-Tap Environment */
                        <div className="sp__mic-idle-section">
                            {/* Pipeline Mode Selector */}
                            <div className="sp__mic-field">
                                <label className="sp__mic-field-label">{t("pages.softphone.audio_pipeline")}</label>
                                <select
                                    value={pipelineMode}
                                    onChange={(e) => setPipelineMode(e.target.value as AudioPipelineMode)}
                                    disabled={isRecording}
                                    className="sp__select"
                                    style={{ width: "100%", fontSize: 11.5 }}
                                >
                                    <option value="webrtc_loopback">
                                        {t("pages.softphone.webrtc_loopback")}
                                    </option>
                                    <option value="pstn_simulation">
                                        {t("pages.softphone.pstn_simulation")}
                                    </option>
                                    <option value="direct_mic">
                                        {t("pages.softphone.direct_mic")}
                                    </option>
                                </select>
                            </div>

                            {/* Step 2: Device Picker */}
                            {audioDevices.length > 0 && (
                                <div className="sp__mic-field">
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <label className="sp__mic-field-label">{t("pages.softphone.select_microphone")}</label>
                                        <button
                                            type="button"
                                            className="sp__mic-refresh-btn"
                                            onClick={() => void refreshAudioDevices()}
                                            title="Refresh device list"
                                        >
                                            <RefreshCw size={11} />
                                        </button>
                                    </div>
                                    <select
                                        value={selectedDeviceId}
                                        onChange={(e) => handleDeviceChange(e.target.value)}
                                        disabled={isRecording}
                                        className="sp__select"
                                        style={{ width: "100%", fontSize: 11.5 }}
                                    >
                                        {audioDevices.map((d) => (
                                            <option key={d.deviceId} value={d.deviceId}>
                                                {d.label || `Microphone (${d.deviceId.slice(0, 5)}...)`}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Step 2: Explicit Capture Constraints */}
                            <div className="sp__mic-constraints">
                                <label className="sp__mic-checkbox-row">
                                    <input
                                        type="checkbox"
                                        checked={echoCancellation}
                                        onChange={(e) => setEchoCancellation(e.target.checked)}
                                        disabled={isRecording}
                                    />
                                    <span>{t("pages.softphone.echo_cancellation")} (default: ON)</span>
                                </label>
                                <label className="sp__mic-checkbox-row">
                                    <input
                                        type="checkbox"
                                        checked={noiseSuppression}
                                        onChange={(e) => setNoiseSuppression(e.target.checked)}
                                        disabled={isRecording}
                                    />
                                    <span>{t("pages.softphone.noise_suppression")} (default: OFF — avoids gating)</span>
                                </label>
                                <label className="sp__mic-checkbox-row">
                                    <input
                                        type="checkbox"
                                        checked={autoGainControl}
                                        onChange={(e) => setAutoGainControl(e.target.checked)}
                                        disabled={isRecording}
                                    />
                                    <span>{t("pages.softphone.auto_gain_control")} (default: ON)</span>
                                </label>
                                <label className="sp__mic-checkbox-row" style={{ marginTop: 4, paddingTop: 4, borderTop: "1px dashed var(--line, #e2e8f0)" }}>
                                    <input
                                        type="checkbox"
                                        checked={liveMonitor}
                                        onChange={(e) => setLiveMonitor(e.target.checked)}
                                        disabled={isRecording}
                                    />
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                        <Headphones size={11} />
                                        {t("pages.softphone.live_monitor")}
                                    </span>
                                </label>
                            </div>

                            {/* Action Buttons: Simulated Call + Step 1 10s Dual-Track Diagnostic Tap */}
                            <div className="sp__mic-actions" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {isRecording ? (
                                    <button
                                        type="button"
                                        className="sp__btn-mic-rec sp__btn-mic-rec--recording"
                                        onClick={stopRecording}
                                    >
                                        <Square size={13} fill="currentColor" />
                                        <span>
                                            {isRunningDualTap
                                                ? `Recording 10s Dual Tap (${recordDuration}/10s)… Click to stop`
                                                : `${t("pages.softphone.stop_test_call")} (${formatTimer(recordDuration)})`}
                                        </span>
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            className="sp__btn-mic-rec"
                                            onClick={() => void startSimulatedTestCall(10)}
                                        >
                                            <PhoneCall size={13} />
                                            <span>{t("pages.softphone.start_test_call")} (10s Profile Verify)</span>
                                        </button>
                                        <button
                                            type="button"
                                            className="sp__btn-mic-rec"
                                            style={{ background: "#0f172a", color: "#fff" }}
                                            onClick={() => void runDiagnosticTap10s()}
                                        >
                                            <Radio size={13} />
                                            <span>Step 1: Record 10s Dual Tap (Raw vs Processed)</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 1: Dual-Tap Comparison Card (Raw vs Processed) */}
                    {dualTapResult && (
                        <div className="sp__mic-playback-card" style={{ marginTop: 10, borderColor: "#6366f1" }}>
                            <div className="sp__mic-playback-header">
                                <span className="sp__mic-playback-title">
                                    Step 1: 10s Diagnostic Tap (Raw vs Processed)
                                </span>
                                <span className="sp__mic-playback-meta">
                                    Profile: {MIC_PROFILES[dualTapResult.profile].label}
                                </span>
                            </div>

                            {/* 1. Raw Track */}
                            <div style={{ marginTop: 6, padding: 6, borderRadius: 6, background: "#fff", border: "1px solid #e2e8f0" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600 }}>
                                    <span>1. Raw getUserMedia Track</span>
                                    <span>{formatBytes(dualTapResult.raw.size)}</span>
                                </div>
                                {dualTapResult.raw.metrics && renderMetricsBadge(dualTapResult.raw.metrics)}
                                <audio
                                    controls
                                    preload="metadata"
                                    src={dualTapResult.raw.url}
                                    className="sp__mic-audio-el"
                                    style={{ marginTop: 6 }}
                                />
                                <a
                                    href={dualTapResult.raw.url}
                                    download={`hibarr-tap-raw-${dualTapResult.timestamp}.${dualTapResult.raw.ext}`}
                                    className="sp__btn-download"
                                    style={{ marginTop: 4 }}
                                >
                                    <Download size={12} />
                                    <span>Download Raw Track (.{dualTapResult.raw.ext})</span>
                                </a>
                            </div>

                            {/* 2. Processed Track */}
                            <div style={{ marginTop: 8, padding: 6, borderRadius: 6, background: "#fff", border: "1px solid #e2e8f0" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600 }}>
                                    <span>2. Processed Track (createBoostedMicStream)</span>
                                    <span>{formatBytes(dualTapResult.processed.size)}</span>
                                </div>
                                {dualTapResult.processed.metrics && renderMetricsBadge(dualTapResult.processed.metrics)}
                                <audio
                                    controls
                                    preload="metadata"
                                    src={dualTapResult.processed.url}
                                    className="sp__mic-audio-el"
                                    style={{ marginTop: 6 }}
                                />
                                <a
                                    href={dualTapResult.processed.url}
                                    download={`hibarr-tap-processed-${dualTapResult.timestamp}.${dualTapResult.processed.ext}`}
                                    className="sp__btn-download"
                                    style={{ marginTop: 4 }}
                                >
                                    <Download size={12} />
                                    <span>Download Processed Track (.{dualTapResult.processed.ext})</span>
                                </a>
                            </div>
                        </div>
                    )}

                    {/* Single Test Playback & Download Card */}
                    {recordedUrl && (
                        <div className="sp__mic-playback-card">
                            <div className="sp__mic-playback-header">
                                <span className="sp__mic-playback-title">{t("pages.softphone.recorded_clip")}</span>
                                {recordedBlobSize !== null && (
                                    <span className="sp__mic-playback-meta">
                                        {formatBytes(recordedBlobSize)}
                                    </span>
                                )}
                            </div>
                            {recordedSummary && (
                                <p className="sp__mic-playback-settings">{recordedSummary}</p>
                            )}
                            {recordedMetrics && renderMetricsBadge(recordedMetrics)}
                            <audio
                                controls
                                preload="metadata"
                                src={recordedUrl}
                                className="sp__mic-audio-el"
                            />
                            <div className="sp__mic-playback-actions">
                                <a
                                    href={recordedUrl}
                                    download={`hibarr-call-mic-${Date.now()}.${recordedExt}`}
                                    className="sp__btn-download"
                                >
                                    <Download size={13} />
                                    <span>{t("pages.softphone.download_mic_recording")} (.{recordedExt})</span>
                                </a>
                                <button
                                    type="button"
                                    className="sp__btn-clear"
                                    onClick={() => {
                                        if (recordedUrl) {
                                            URL.revokeObjectURL(recordedUrl);
                                        }
                                        setRecordedUrl(null);
                                        setRecordedBlobSize(null);
                                        setRecordedSummary(null);
                                        setRecordedMetrics(null);
                                    }}
                                >
                                    {t("pages.softphone.dismiss")}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 7: Profile Verification Matrix */}
                    {Object.keys(profileReports).length > 0 && (
                        <div style={{ marginTop: 10, padding: 8, borderRadius: 6, background: "#f8fafc", border: "1px solid #cbd5e1", fontSize: 10.5 }}>
                            <div style={{ fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                                <CheckCircle2 size={12} color="#16a34a" />
                                <span>Step 7: Profile Verification Summary</span>
                            </div>
                            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                                <thead>
                                    <tr style={{ borderBottom: "1px solid #cbd5e1", color: "#475569" }}>
                                        <th style={{ padding: "2px 3px" }}>Profile</th>
                                        <th style={{ padding: "2px 3px" }}>RMS</th>
                                        <th style={{ padding: "2px 3px" }}>Peak</th>
                                        <th style={{ padding: "2px 3px" }}>Floor</th>
                                        <th style={{ padding: "2px 3px" }}>Zeros</th>
                                        <th style={{ padding: "2px 3px" }}>&gt;6kHz</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(Object.keys(profileReports) as MicProfileName[]).map((pKey) => {
                                        const r = profileReports[pKey];
                                        if (!r) return null;
                                        return (
                                            <tr key={pKey} style={{ borderBottom: "1px solid #e2e8f0" }}>
                                                <td style={{ padding: "3px 3px", fontWeight: 600 }}>{pKey}</td>
                                                <td style={{ padding: "3px 3px", color: r.criteria.speechRmsOk ? "#16a34a" : "#dc2626" }}>
                                                    {r.speechRmsDbfs.toFixed(1)}
                                                </td>
                                                <td style={{ padding: "3px 3px", color: r.criteria.peakOk ? "#16a34a" : "#dc2626" }}>
                                                    {r.peakDbfs.toFixed(1)}
                                                </td>
                                                <td style={{ padding: "3px 3px", color: r.criteria.noiseFloorOk ? "#16a34a" : "#d97706" }}>
                                                    {r.noiseFloorDbfs.toFixed(1)}
                                                </td>
                                                <td style={{ padding: "3px 3px", color: r.criteria.noZeroGapsInSpeech ? "#16a34a" : "#dc2626" }}>
                                                    {(r.speechExactZeroFraction * 100).toFixed(2)}%
                                                </td>
                                                <td style={{ padding: "3px 3px", color: r.criteria.above6kOk ? "#16a34a" : "#dc2626" }}>
                                                    {r.above6kRelativeDb.toFixed(1)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
