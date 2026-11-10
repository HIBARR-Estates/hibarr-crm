import {
    Invitation,
    Inviter,
    Registerer,
    RegistererState,
    SessionState,
    UserAgent,
} from "sip.js";
import type {
    SoftphoneCall,
    SoftphoneCallContext,
    SoftphoneCallFailure,
    SoftphoneCallFailureCode,
    SoftphoneCallStage,
    SoftphoneConfig,
    SoftphoneState,
} from "@/Types/api/softphone";
import {
    buildExplicitMicConstraints,
    createBoostedMicStream,
    ensureAudioSenderBitrateUncapped,
    inspectAndLogRawTrackSettings,
    preferOpusG722AndApplyFmtp,
    readStoredMicGain,
    readStoredMicProfile,
    readStoredRnnoiseEnabled,
    storeMicGain,
    storeMicProfile,
    storeRnnoiseEnabled,
    type BoostedMicProcessor,
    type MicProfileName,
} from "./micAudioProcessor";

/**
 * Thin SIP.js wrapper that turns sipgate Neo into an in-browser softphone.
 *
 * The browser registers as the SIP user agent over WSS and owns the audio
 * path directly with sipgate. It deliberately does NOT talk to OL's call
 * bridge — the CRM timeline is still driven by the existing OL poll. This
 * class only manages registration + a single active call and publishes a
 * plain state object the UI subscribes to.
 */

export interface OutboundAudioDiagnostics {
    trackSettings: MediaTrackSettings | null;
    trackLabel: string | null;
    enabled: boolean;
    muted: boolean;
    bytesSent: number;
    packetsSent: number;
    audioLevel: number | null;
    codec: string | null;
}

interface SDHLike {
    peerConnection?: RTCPeerConnection | null;
}

/** A peer connection we already attached media-path listeners to. */
type WatchedPeerConnection = RTCPeerConnection & { __spWatched?: boolean };

type Listener = () => void;

/**
 * Dev-only trace.
 *
 * Driving SIP from the browser needs a lot of chatter, but none of it may
 * reach a user's browser console in production: the console is shared over
 * screen shares and ends up pasted into support tickets. Customer data (the
 * counterparty's phone number) is never logged, not even here.
 */
const trace = (...args: unknown[]): void => {
    // `import.meta.env` only exists under Vite. The Mix/webpack bundle leaves
    // it undefined, and reading `.DEV` off it threw inside beginCall() — before
    // the INVITE was sent (outbound never rang) and before an inbound call
    // could be answered.
    const dev =
        (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") ||
        (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true;
    if (dev) {
        console.log(...args);
    }
};

const EMPTY_STATE: SoftphoneState = {
    registration: "idle",
    registrationError: null,
    call: null,
    callFailure: null,
    lastCallError: null,
    quality: "unknown",
};

/**
 * Maps a negative final SIP response onto something an agent can act on.
 * sip.js 0.21 exposes the status code only through the INVITE request
 * delegate, so these are the codes a carrier realistically returns for a call
 * that never connects.
 */
const FAILURE_BY_STATUS: Record<
    number,
    { code: SoftphoneCallFailureCode; reason: string }
> = {
    403: {
        code: "unknown",
        reason: "This extension is not allowed to place calls.",
    },
    404: {
        code: "not-found",
        reason: "That number was not found on the network.",
    },
    408: { code: "no-answer", reason: "Nobody answered the call." },
    480: {
        code: "unreachable",
        reason: "That number is temporarily unavailable.",
    },
    486: { code: "busy", reason: "The line is busy." },
    487: { code: "cancelled", reason: "The call was cancelled." },
    603: { code: "declined", reason: "The call was declined." },
    606: { code: "declined", reason: "The call was declined." },
};

/**
 * sip.js 0.21 exposes only these session states. Progress beyond them (180
 * Ringing, and the negative final response) arrives on the INVITE request
 * delegate instead — see inviteDelegate().
 */
const STAGE_BY_SESSION_STATE: Record<string, SoftphoneCallStage> = {
    [SessionState.Established]: "connecting",
    [SessionState.Terminating]: "ended",
    [SessionState.Terminated]: "ended",
};

/** sip.js session shapes we touch (avoids brittle deep type imports). */
interface ManagedSession {
    stateChange: { addListener(cb: (state: SessionState) => void): void };
    sessionDescriptionHandler?: unknown;
    invite(options?: unknown): Promise<void>;
    accept(options?: unknown): Promise<void>;
    reject(options?: unknown): Promise<void>;
    /** Cancels an outbound INVITE that has not been answered yet. */
    cancel(options?: unknown): Promise<void>;
    bye(): Promise<void>;
    state: SessionState;
}

class SoftphoneClient {
    private config: SoftphoneConfig | null = null;
    private userAgent: UserAgent | null = null;
    private registerer: Registerer | null = null;
    private startCancels: Set<() => void> = new Set();
    private session: ManagedSession | null = null;
    private answering = false;
    /** The agent pressed decline/hang up — not a failed call, so no notice. */
    private endedByUser = false;
    /** A reason is already on record for this attempt (don't overwrite it). */
    private failureRecorded = false;
    /** Tracks whether an inbound INVITE was canceled due to answer elsewhere. */
    private inboundCanceledReason: "answered_elsewhere" | "caller_canceled" | null = null;
    private remoteAudio: HTMLAudioElement | null = null;
    private listeners = new Set<Listener>();
    private callSeq = 0;
    private state: SoftphoneState = EMPTY_STATE;
    private outboundMicProcessor: BoostedMicProcessor | null = null;
    private rawSenderTrack: MediaStreamTrack | null = null;

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    getState(): SoftphoneState {
        return this.state;
    }

    /** Attach the <audio> element that plays remote (callee/caller) audio. */
    attachRemoteAudio(el: HTMLAudioElement | null): void {
        this.remoteAudio = el;
        if (el) {
            el.autoplay = true;
            el.muted = false;
            el.volume = 1;
            el.onended = () => {
                trace("softphone remote audio ended; refreshing");
                this.refreshRemoteAudio();
            };
            el.onpause = () => {
                trace("softphone remote audio paused; retrying play");
                window.setTimeout(() => {
                    void el.play().catch(() => undefined);
                }, 100);
            };
            el.onerror = () => {
                trace("softphone remote audio error; refreshing");
                this.refreshRemoteAudio();
            };
        }
        // Re-attach an already-running call's stream (e.g. after a remount).
        this.refreshRemoteAudio();
    }

    get enabled(): boolean {
        return this.config !== null;
    }

    async start(config: SoftphoneConfig): Promise<void> {
        const run = async (): Promise<void> => {
            // Cancel any previous in-flight start before tearing down.
            this.startCancels.forEach((cancel) => cancel());
            this.startCancels.clear();

            // Cancellation flag: if stop() or another start() is called while
            // start() is in flight, this prevents the locally created
            // UserAgent/Registerer from taking over after cancellation.
            let cancelled = false;
            const cancel = () => {
                cancelled = true;
            };
            this.startCancels.add(cancel);

            try {
                // Device switch: tear down any current registration/call first.
                if (this.userAgent) {
                    this.session = null;
                    await this.teardown();
                    if (cancelled) {
                        return;
                    }
                    this.setState(EMPTY_STATE);
                }

                if (cancelled) {
                    return;
                }

                this.config = config;
                this.setState({ ...EMPTY_STATE, registration: "registering" });
                const rawUri = (config.uri || "").trim();
                const normalizedUri = /^sips?:/i.test(rawUri)
                    ? rawUri
                    : rawUri.includes("@")
                        ? `sip:${rawUri}`
                        : config.authorization_username
                            ? `sip:${config.authorization_username}@sipgate.de`
                            : `sip:${rawUri}`;
                const uri = UserAgent.makeURI(normalizedUri);
                if (!uri) {
                    throw new Error(`Invalid SIP URI: ${config.uri}`);
                }

                const userAgent = new UserAgent({
                    uri,
                    transportOptions: { server: config.wss_url },
                    authorizationUsername:
                        config.authorization_username || undefined,
                    authorizationPassword:
                        config.authorization_password || undefined,
                    displayName: config.display_name || undefined,
                    sessionDescriptionHandlerFactoryOptions: {
                        peerConnectionConfiguration: {
                            iceServers: [
                                { urls: "stun:stun.l.google.com:19302" },
                                { urls: "stun:stun.sipgate.de:3478" },
                            ],
                        },
                    },
                    logLevel: "error",
                });

                userAgent.delegate = {
                    onInvite: (invitation) => this.onIncoming(invitation),
                };

                await userAgent.start();

                if (cancelled) {
                    await userAgent.stop();
                    return;
                }

                const registerer = new Registerer(userAgent);
                this.userAgent = userAgent;
                this.registerer = registerer;

                await new Promise<void>((resolve, reject) => {
                    const timer = window.setTimeout(() => {
                        cleanup();
                        reject(
                            new Error(
                                "The line did not answer the registration in time.",
                            ),
                        );
                    }, 10_000);

                    const cancelWait = () => {
                        cleanup();
                        resolve();
                    };
                    this.startCancels.add(cancelWait);

                    const cleanup = () => {
                        window.clearTimeout(timer);
                        this.startCancels.delete(cancelWait);
                    };

                    registerer.stateChange.addListener((state) => {
                        if (cancelled) {
                            cleanup();
                            resolve();
                            return;
                        }
                        if (state === RegistererState.Registered) {
                            this.setState({
                                registration: "registered",
                                registrationError: null,
                            });
                            cleanup();
                            resolve();
                        } else if (state === RegistererState.Unregistered) {
                            // Only meaningful if we didn't intentionally stop.
                            if (this.userAgent === userAgent) {
                                this.setState({ registration: "unregistered" });
                            }
                        }
                    });

                    registerer
                        .register({
                            requestDelegate: {
                                onReject: (response) => {
                                    const status = response?.message?.statusCode;
                                    cleanup();
                                    reject(
                                        new Error(
                                            status === 401 || status === 403
                                                ? "The line rejected the username or password."
                                                : `The line rejected the registration (${status ?? "unknown"}).`,
                                        ),
                                    );
                                },
                            },
                        })
                        .catch((err) => {
                            cleanup();
                            reject(err);
                        });
                });

                if (cancelled) {
                    await registerer.unregister().catch(() => undefined);
                    await userAgent.stop().catch(() => undefined);
                    if (this.userAgent === userAgent) {
                        this.userAgent = null;
                        this.registerer = null;
                    }
                    return;
                }
            } catch (error: unknown) {
                // A cancelled start is not a failure: a newer attempt owns the
                // resources now, so don't tear them down and don't report a
                // failure state for a start nobody is waiting for.
                if (cancelled) {
                    return;
                }
                await this.teardown();
                this.setState({
                    registration: "failed",
                    registrationError:
                        error instanceof Error
                            ? error.message
                            : "Registration failed",
                });
            } finally {
                this.startCancels.delete(cancel);
            }
        };

        const promise = run();
        this.startPromise = promise;
        try {
            await promise;
        } finally {
            if (this.startPromise === promise) {
                this.startPromise = null;
            }
        }
    }

    private startPromise: Promise<void> | null = null;

    async stop(): Promise<void> {
        // Cancel all in-flight start attempts before tearing down
        this.startCancels.forEach((cancel) => cancel());
        this.startCancels.clear();
        this.startPromise = null;
        await this.hangup();
        await this.teardown();
        this.config = null;
        this.setState(EMPTY_STATE);
    }

    /**
     * Place an outbound call.
     *
     * `context` is the lead the caller already had in hand (a task's
     * quick-action, a phone rendered next to a lead). Nothing is looked up here
     * — a call started from a screen that has no lead carries just the number.
     */
    async call(
        rawTarget: string,
        context: SoftphoneCallContext | null = null,
    ): Promise<void> {
        const target = rawTarget.trim();
        if (!target) {
            return;
        }

        if (this.startPromise) {
            await this.startPromise;
        }

        // Every reason a call cannot be placed has to reach the agent. These
        // paths used to return quietly, leaving the dock closed with nothing to
        // explain the miss.
        if (!this.config) {
            this.reportSetupFailure(
                target,
                "No phone line is set up. Add one in Settings → Call Bridge.",
                null,
            );
            throw new Error("No phone line is registered for this browser.");
        }
        if (!this.userAgent || this.state.registration !== "registered") {
            const reason =
                this.state.registrationError ||
                "Your phone line isn't connected to sipgate. Pick a line in the phone panel, then retry.";
            this.reportSetupFailure(target, reason, context);
            throw new Error(
                this.state.registrationError ||
                "Your phone line isn't connected.",
            );
        }
        if (this.session) {
            // One call at a time in v1 — a second dial replaces nothing; say so.
            this.reportSetupFailure(
                target,
                "Another call is already in progress. End it first.",
                context,
            );
            return;
        }

        const domain = domainOf(this.config.uri);
        const dialTarget = normalizePhoneForSip(target, domain);
        if (!dialTarget) {
            this.reportSetupFailure(
                target,
                `"${target}" is not a number this line can dial.`,
                context,
            );
            throw new Error(`Invalid phone number: ${target}`);
        }
        const sipUri = domain ? `sip:${dialTarget}@${domain}` : `sip:${dialTarget}`;
        const targetUri = UserAgent.makeURI(sipUri);
        if (!targetUri) {
            this.reportSetupFailure(
                target,
                `"${target}" is not a number this line can dial.`,
                context,
            );
            throw new Error(`Could not build SIP target: ${sipUri}`);
        }

        const sdpModifier = (desc: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> =>
            Promise.resolve({
                ...desc,
                sdp: preferOpusG722AndApplyFmtp(desc.sdp ?? ""),
            });

        const inviter = new Inviter(this.userAgent, targetUri, {
            sessionDescriptionHandlerOptions: {
                constraints: {
                    audio: buildExplicitMicConstraints(),
                    video: false,
                },
            },
            sessionDescriptionHandlerModifiers: [sdpModifier],
        }) as unknown as ManagedSession;

        this.beginCall(inviter, "outbound", target, context);

        try {
            // Same identity header as before the regressions: the line's own
            // SIP URI (this is what sipgate accepted when calls last worked).
            const extraHeaders = this.config.uri
                ? [`P-Preferred-Identity: ${this.config.uri.startsWith("sip:") ? `<${this.config.uri}>` : `<sip:${this.config.authorization_username || this.config.uri}@${domain || "sipgate.de"}>`}`]
                : [];
            trace("softphone INVITE sent", dialTarget.startsWith("+") ? "e164+" : "digits");
            await (inviter as unknown as Inviter).invite({
                requestDelegate: this.inviteDelegate(),
                requestOptions: {
                    extraHeaders,
                },
            } as never);
            // SessionDescriptionHandler exists only after invite() — attach remote audio now.
            if (this.session) {
                this.attachRemoteFromSession(this.session);
                this.refreshRemoteAudio();
                this.watchMediaPath(this.session);
            }
        } catch (error: unknown) {
            console.error("[softphone] INVITE failed");
            const detail = error instanceof Error ? error.message.trim() : "";
            // The INVITE never got out — the transport failed, or sipjs refused
            // to build the request. This is the failure agents hit most often
            // (offline, no line, bad number) and it used to look like nothing
            // had happened at all.
            this.failCall(
                "unknown",
                detail
                    ? `The call could not be placed: ${detail}`
                    : "The call could not be placed — the request to sipgate failed.",
            );
            throw error;
        }
    }

    async answer(): Promise<void> {
        const session = this.session;
        if (!session || this.state.call?.phase !== "inbound" || this.answering) {
            return;
        }
        if (session.state === SessionState.Terminated) {
            // The caller (or the network) already ended this leg.
            this.failCall("disconnected", "The caller hung up before the call could be answered.");
            return;
        }
        this.answering = true;
        const answeringCallId = this.state.call?.id ?? null;
        trace("softphone answer() start", answeringCallId);
        try {
            if (this.state.call?.id !== answeringCallId) {
                throw new Error("active call changed during answer");
            }
            const sdpModifier = (desc: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> =>
                Promise.resolve({
                    ...desc,
                    sdp: preferOpusG722AndApplyFmtp(desc.sdp ?? ""),
                });

            await session.accept({
                sessionDescriptionHandlerOptions: {
                    constraints: {
                        audio: buildExplicitMicConstraints(),
                        video: false,
                    },
                },
                sessionDescriptionHandlerModifiers: [sdpModifier],
            });
            this.attachRemoteFromSession(session);
            this.refreshRemoteAudio();
            window.setTimeout(() => this.refreshRemoteAudio(), 250);
            window.setTimeout(() => this.refreshRemoteAudio(), 1000);
            const call = this.state.call;
            if (call && call.phase === "inbound") {
                // Answered, but the caller is not audible until ICE settles —
                // "connecting" until watchMediaPath() promotes us.
                this.setState({
                    call: { ...call, phase: "active", stage: "connecting", answeredAt: Date.now() },
                    lastCallError: null,
                });
            }
        } catch (error) {
            // Only the fixed message is logged: the rejected error carries the
            // SIP URI and other customer data.
            trace("softphone answer() failed");
            // The failure is shown to the agent in the UI already, so the
            // production console only records that it happened — never the
            // error object, which carries a stack trace and the SIP URI.
            console.error("softphone answer() failed");
            this.setState({
                lastCallError:
                    error instanceof Error ? error.message : "Unable to answer call",
            });
        } finally {
            this.answering = false;
        }
    }

    async reject(): Promise<void> {
        const session = this.session;
        if (!session) {
            return;
        }
        // Declining is a choice, not a failure — no notice for it.
        this.endedByUser = true;
        try {
            await session.reject();
        } catch {
            // ignore — session will terminate regardless
        }
        this.endCall();
    }

    async hangup(): Promise<void> {
        const session = this.session;
        if (!session) {
            return;
        }
        this.endedByUser = true;
        try {
            if (this.state.call?.phase === "inbound") {
                // An inbound session is still in the INVITE phase; reject() is
                // the valid way to refuse it.
                await session.reject();
            } else if (session.state === SessionState.Terminated) {
                // Already gone; nothing to tear down.
            } else if (session.state !== SessionState.Established) {
                // bye() is only valid on an established session. Cancelling an
                // outbound INVITE that never got a 200 OK throws otherwise.
                await session.cancel();
            } else {
                await session.bye();
            }
        } catch {
            // ignore
        }
        this.endCall();
    }

    /**
     * Terminate the session and immediately surface an informative call notice
     * (e.g. "Answered on another device") without presenting an alarming error.
     */
    notifyCallNotice(code: SoftphoneCallFailureCode, reason: string): void {
        const call = this.state.call;
        const session = this.session;
        if (!call) {
            return;
        }
        this.endedByUser = true;
        // An inbound leg is never rejected from here: reject() sends a final
        // 603 that can end the forked call for every other device too. Another
        // device already won (or sipgate will CANCEL this leg itself), so just
        // drop it locally.
        if (session && call.phase !== "inbound") {
            try {
                void session.cancel();
            } catch {
                // ignore
            }
        }
        this.failCall(code, reason);
    }

    setMuted(muted: boolean): void {
        const call = this.state.call;
        if (!call) {
            return;
        }
        this.withSenders((sender) => {
            if (sender.track) {
                sender.track.enabled = !muted;
            }
        });
        if (this.outboundMicProcessor) {
            this.outboundMicProcessor.track.enabled = !muted;
        }
        if (this.rawSenderTrack) {
            this.rawSenderTrack.enabled = !muted;
        }
        this.setState({ call: { ...call, muted } });
    }

    getMicGain(): number {
        return this.outboundMicProcessor ? this.outboundMicProcessor.getGain() : readStoredMicGain();
    }

    setMicGain(gain: number): void {
        storeMicGain(gain);
        if (this.outboundMicProcessor) {
            this.outboundMicProcessor.setGain(gain);
        }
    }

    getMicProfile(): MicProfileName {
        return this.outboundMicProcessor ? this.outboundMicProcessor.getProfile() : readStoredMicProfile();
    }

    setMicProfile(profile: MicProfileName, overrideManualGain?: number): void {
        storeMicProfile(profile);
        if (this.outboundMicProcessor) {
            this.outboundMicProcessor.setProfile(profile, overrideManualGain);
        }
    }

    getRnnoiseEnabled(): boolean {
        return this.outboundMicProcessor
            ? this.outboundMicProcessor.getRnnoiseEnabled()
            : readStoredRnnoiseEnabled();
    }

    setRnnoiseEnabled(enabled: boolean): void {
        storeRnnoiseEnabled(enabled);
        if (this.outboundMicProcessor) {
            this.outboundMicProcessor.setRnnoiseEnabled(enabled);
        }
    }

    getRawSendStream(): MediaStream | null {
        if (!this.rawSenderTrack) {
            return null;
        }
        try {
            return new MediaStream([this.rawSenderTrack.clone()]);
        } catch {
            return null;
        }
    }

    getActiveMicProcessor(): BoostedMicProcessor | null {
        return this.outboundMicProcessor;
    }

    setHold(onHold: boolean): void {
        const session = this.session;
        const call = this.state.call;
        if (!session || !call) {
            return;
        }
        void session
            .invite({
                inviteOptions: {
                    sessionDescriptionHandlerOptions: { hold: onHold },
                },
            })
            .then(() => {
                this.setState({ call: { ...this.state.call!, onHold } });
            })
            .catch(() => {
                // no-op — state stays as-is if the re-INVITE fails
            });
    }

    /** The agent dismissed the notice (Close / Try again). */
    clearCallFailure(): void {
        if (this.state.callFailure) {
            this.setState({ callFailure: null });
        }
    }

    async getStats(): Promise<RTCStatsReport | null> {
        if (!this.session) {
            return null;
        }
        const peerConnection = this.peerConnectionOf(this.session);
        if (!peerConnection) {
            return null;
        }
        try {
            return await peerConnection.getStats();
        } catch {
            return null;
        }
    }

    /**
     * Clones the active outbound audio WebRTC sender track sent to sipgate.
     * Returning a clone ensures diagnostic recording or level meters can be
     * stopped or inspected without stopping or mutating the live call track.
     */
    getLocalSendStream(): MediaStream | null {
        if (!this.session) {
            return null;
        }
        const pc = this.peerConnectionOf(this.session);
        if (!pc) {
            return null;
        }
        const senders = pc.getSenders();
        const audioSender = senders.find(
            (sender) => sender.track && sender.track.kind === "audio",
        );
        if (!audioSender || !audioSender.track) {
            return null;
        }
        try {
            return new MediaStream([audioSender.track.clone()]);
        } catch {
            return null;
        }
    }

    /**
     * Inspects the outbound audio RTCRtpSender track and pc.getStats()
     * for WebRTC outbound-rtp / media-source statistics.
     */
    async getOutboundAudioDiagnostics(): Promise<OutboundAudioDiagnostics | null> {
        if (!this.session) {
            return null;
        }
        const pc = this.peerConnectionOf(this.session);
        if (!pc) {
            return null;
        }
        const senders = pc.getSenders();
        const audioSender = senders.find(
            (sender) => sender.track && sender.track.kind === "audio",
        );
        const track = audioSender?.track ?? null;
        const trackSettings = track ? track.getSettings() : null;
        const trackLabel = track ? track.label : null;
        const enabled = track ? track.enabled : false;
        const muted = track ? track.muted : false;

        let bytesSent = 0;
        let packetsSent = 0;
        let audioLevel: number | null = null;
        let codecId: string | null = null;
        let codec: string | null = null;

        try {
            const stats = await pc.getStats();
            stats.forEach((report: Record<string, unknown>) => {
                if (
                    report.type === "outbound-rtp" &&
                    (report.kind === "audio" || report.mediaType === "audio")
                ) {
                    bytesSent = Number(report.bytesSent || 0);
                    packetsSent = Number(report.packetsSent || 0);
                    if (report.codecId && typeof report.codecId === "string") {
                        codecId = report.codecId;
                    }
                    if (typeof report.audioLevel === "number") {
                        audioLevel = report.audioLevel;
                    }
                }
                if (
                    report.type === "media-source" &&
                    (report.kind === "audio" || report.mediaType === "audio")
                ) {
                    if (typeof report.audioLevel === "number") {
                        audioLevel = report.audioLevel;
                    }
                }
            });

            if (codecId && stats.has(codecId)) {
                const codecReport = stats.get(codecId) as
                    | Record<string, unknown>
                    | undefined;
                if (codecReport && typeof codecReport.mimeType === "string") {
                    codec = codecReport.mimeType;
                }
            }
            if (!codec) {
                stats.forEach((report: Record<string, unknown>) => {
                    if (
                        report.type === "codec" &&
                        typeof report.mimeType === "string" &&
                        report.mimeType.toLowerCase().includes("audio")
                    ) {
                        codec = report.mimeType;
                    }
                });
            }
            if (codec && this.outboundMicProcessor) {
                this.outboundMicProcessor.setNegotiatedCodec(codec);
            }
        } catch {
            // stats query error or pc closing
        }

        return {
            trackSettings,
            trackLabel,
            enabled,
            muted,
            bytesSent,
            packetsSent,
            audioLevel,
            codec,
        };
    }

    // --- internals -------------------------------------------------------

    /**
         * INVITE progress. sip.js 0.21 has no session state for either of these, so
         * this is where an outbound call learns that the far end started ringing and
         * — when it never connects — why.
         */
    private inviteDelegate() {
        return {
            onProgress: (response: { statusCode?: number; message?: { statusCode?: number } }) => {
                const code = response.message?.statusCode ?? response.statusCode;
                console.info("[softphone] INVITE progress", code);
                // 180 Ringing or 183 Session Progress with early media
                if (code === 180 || code === 183) {
                    this.setStage("ringing");
                }
            },
            onRedirect: (response: { statusCode?: number; reasonPhrase?: string; message?: { statusCode?: number; reasonPhrase?: string } }) => {
                const code = response.message?.statusCode ?? response.statusCode;
                const phrase = response.message?.reasonPhrase ?? response.reasonPhrase;
                this.failFromStatus(code, phrase);
            },
            onReject: (response: { statusCode?: number; reasonPhrase?: string; message?: { statusCode?: number; reasonPhrase?: string } }) => {
                const code = response.message?.statusCode ?? response.statusCode;
                const phrase = response.message?.reasonPhrase ?? response.reasonPhrase;
                console.warn("[softphone] INVITE rejected", code, phrase);
                this.failFromStatus(code, phrase);
            },
        };
    }

    /**
     * A call that was never placed at all (no line, not registered, another
     * call live). There is no session to tear down, so this writes the notice
     * straight into state — otherwise the agent gets no explanation.
     */
    public reportSetupFailure(
        peer: string,
        reason: string,
        context: SoftphoneCallContext | null,
    ): void {
        this.setState({
            callFailure: {
                code: "unknown",
                reason,
                peer,
                direction: "outbound",
                context,
            },
            lastCallError: reason,
        });
    }

    /**
     * Attach a lead to the live call once it is known — an inbound caller that
     * matches a lead only once the number has been looked up. Keeps the failed-
     * call notice able to name who the call was about.
     */
    setCallContext(context: SoftphoneCallContext | null): void {
        const call = this.state.call;
        if (!call || !context) {
            return;
        }
        this.setState({ call: { ...call, context } });
    }

    /** A negative final response: remember why, then tear the session down. */
    private failFromStatus(statusCode?: number, reasonPhrase?: string): void {
        const mapped =
            statusCode != null ? FAILURE_BY_STATUS[statusCode] : undefined;

        this.failCall(mapped?.code ?? "unknown", mapped?.reason ??
            (reasonPhrase
                ? `The call could not be completed (${statusCode ?? ""} ${reasonPhrase}).`.trim()
                : "The call could not be completed."));
    }

    /**
     * Record why the call never connected and end it.
     *
     * The reason survives `endCall()` on purpose: the dock keeps this open with
     * an explanation instead of disappearing without a word.
     */
    private failCall(code: SoftphoneCallFailureCode, reason: string): void {
        const call = this.state.call;
        if (!call) {
            return;
        }
        const failure: SoftphoneCallFailure = {
            code,
            reason,
            peer: call.peer,
            direction: call.direction,
            context: call.context,
        };
        this.setState({
            callFailure: failure,
            lastCallError: reason,
        });
        this.failureRecorded = true;
        this.endCall();
    }

    private onIncoming(invitation: Invitation): void {
        // One call at a time — busy out any second simultaneous inbound.
        if (this.session) {
            trace("softphone onIncoming: busy - rejecting second invitation");
            void invitation.reject();
            return;
        }

        this.inboundCanceledReason = null;
        try {
            (invitation as unknown as { delegate?: unknown }).delegate = {
                onCancel: (cancel: unknown) => {
                    try {
                        const req = (cancel as { request?: { getHeader?: (name: string) => string | undefined } })?.request;
                        const reason = req?.getHeader ? req.getHeader("reason") : "";
                        if (reason && /cause=200|completed elsewhere|answered/i.test(reason)) {
                            this.inboundCanceledReason = "answered_elsewhere";
                        }
                    } catch {
                        // ignore
                    }
                },
            };
        } catch {
            // ignore
        }

        const peer =
            invitation.remoteIdentity?.uri?.user ?? "Unknown caller";
        const managed = invitation as unknown as ManagedSession;
        this.beginCall(managed, "inbound", peer);
    }

    private beginCall(
        session: ManagedSession,
        direction: "outbound" | "inbound",
        peer: string,
        context: SoftphoneCallContext | null = null,
    ): void {
        this.session = session;
        this.callSeq += 1;
        const sipCallId =
            (session as unknown as { incomingInviteRequest?: { message?: { callId?: string } } })?.incomingInviteRequest?.message?.callId ??
            (session as unknown as { outgoingRequestMessage?: { callId?: string } })?.outgoingRequestMessage?.callId ??
            (session as unknown as { id?: string })?.id;
        const id = sipCallId && sipCallId.trim() !== "" ? sipCallId.trim() : `call-${this.callSeq}`;
        // A fresh attempt starts from a clean slate: no stale failure notice,
        // and nothing here counts as "the agent hung up".
        this.endedByUser = false;
        this.failureRecorded = false;

        this.setState({
            callFailure: null,
            call: {
                id,
                direction,
                peer,
                phase: direction,
                // An inbound session is already ringing us the moment it
                // arrives; an outbound one is still dialling.
                stage: direction === "inbound" ? "ringing" : "calling",
                context,
                answeredAt: null,
                connectedAt: null,
                muted: false,
                onHold: false,
            },
            lastCallError: null,
            quality: "good",
        });
        // The counterparty number is deliberately not logged — it is customer data.
        trace("softphone beginCall", id, direction);

        if (direction !== "inbound") {
            this.attachRemoteFromSession(session);
        }

        session.stateChange.addListener((state) => {
            if (this.session !== session) {
                return;
            }

            // SIP progress → the lifecycle narrative. sip.js 0.21 exposes only
            // Initial / Establishing / Established / Terminating / Terminated —
            // it has no provisional-response event, so an outbound call cannot
            // learn that the callee's phone started ringing and stays
            // "Calling…" until the answer arrives.
            const nextStage = STAGE_BY_SESSION_STATE[state as unknown as string];
            if (nextStage) {
                this.setStage(nextStage);
            }

            if (state === SessionState.Established) {
                const call = this.state.call;
                if (call && call.answeredAt === null) {
                    this.setState({
                        call: { ...call, phase: "active", answeredAt: Date.now() },
                    });
                }
                // Established only means SIP is done — the user is not audible
                // until ICE completes, so "connected" waits for that.
                this.watchMediaPath(session);
            } else if (state === SessionState.Terminated) {
                trace("softphone session terminated", this.state.call?.id);
                const call = this.state.call;
                if (call && !this.endedByUser && !this.failureRecorded) {
                    if (call.connectedAt === null) {
                        if (call.direction === "inbound") {
                            const isAnsweredElsewhere = this.inboundCanceledReason === "answered_elsewhere";
                            this.failCall(
                                isAnsweredElsewhere ? "answered_elsewhere" : "disconnected",
                                isAnsweredElsewhere
                                    ? "This call was answered on another device."
                                    : "The caller disconnected before the call was answered.",
                            );
                            return;
                        }
                        // Outbound call that never connected:
                        // SIP.js transitions the session to Terminated before calling onReject/onRedirect delegates.
                        // Defer fallback termination to allow the final-response delegate to record the specific status first.
                        setTimeout(() => {
                            if (!this.failureRecorded && !this.endedByUser && this.state.call) {
                                this.failCall(
                                    "terminated",
                                    "The call ended before it connected.",
                                );
                            } else if (!this.state.call) {
                                // Already cleaned up
                            } else {
                                this.endCall();
                            }
                        }, 0);
                        return;
                    } else if (call.direction === "inbound") {
                        // The inbound call was active, but disconnected from the caller's end
                        this.failCall(
                            "disconnected",
                            "The call was disconnected from the client's end.",
                        );
                        return;
                    }
                }
                this.endCall();
            }
        });

        // An inbound call may already be past Answered/Established before the
        // listener above is attached, so start watching the media path now too.
        this.watchMediaPath(session);
    }

    /** Move the call to a lifecycle stage (no-op once the call is over). */
    private setStage(stage: SoftphoneCallStage): void {
        const call = this.state.call;
        if (!call || call.stage === stage) {
            return;
        }
        if (stage === "connected" && this.outboundMicProcessor) {
            const ctxState = this.outboundMicProcessor.audioContext.state;
            if (ctxState !== "running") {
                console.warn(
                    `[softphone] WARNING: Outbound mic AudioContext state is "${ctxState}" (not "running") when call connected. Attempting resume...`,
                );
                void this.outboundMicProcessor.ensureRunning();
            }
            // Step 2: Check negotiated codec from getStats() when connected so PCMU/PCMA switches lowpass to 3600 Hz
            void this.getOutboundAudioDiagnostics();
        }
        this.setState({
            call: {
                ...call,
                stage,
                connectedAt: stage === "connected" ? Date.now() : call.connectedAt,
            },
        });
    }

    /**
     * Promote the call to "connected" only once RTP can actually flow. WebRTC
     * reports ICE completion on the session's peer connection; on failure the
     * user is not connected, so surface that instead of claiming "Connected".
     */
    private watchMediaPath(session: ManagedSession): void {
        const peerConnection = this.peerConnectionOf(session) as WatchedPeerConnection | null;
        if (!peerConnection || peerConnection.__spWatched) {
            return;
        }
        peerConnection.__spWatched = true;

        const evaluate = () => {
            if (this.session !== session) {
                return;
            }
            const ice = peerConnection.iceConnectionState;
            if (ice === "connected" || ice === "completed") {
                this.setStage("connected");
            } else if (ice === "failed") {
                trace("softphone media path failed");
                this.failureRecorded = true;
                this.failCall(
                    "media",
                    "The audio connection could not be established.",
                );
            }
        };

        peerConnection.addEventListener("iceconnectionstatechange", evaluate);
        peerConnection.addEventListener("connectionstatechange", evaluate);
        // ICE may already be connected by the time we start listening.
        evaluate();
    }

    private endCall(): void {
        this.session = null;
        if (this.outboundMicProcessor) {
            this.outboundMicProcessor.dispose();
            this.outboundMicProcessor = null;
        }
        this.rawSenderTrack = null;
        if (this.remoteAudio) {
            const audio = this.remoteAudio;
            try {
                audio.pause();
                const stream = audio.srcObject;
                if (stream instanceof MediaStream) {
                    stream.getTracks().forEach((track) => track.stop());
                }
                audio.srcObject = null;
                audio.removeAttribute("src");
                audio.volume = 0;
                audio.muted = true;
                audio.load();
            } catch {
                // ignore cleanup errors
            }
        }
        if (this.state.call) {
            this.setState({ call: null });
        }
    }

    private attachRemoteFromSession(session: ManagedSession): void {
        const pc = this.peerConnectionOf(session);
        if (!pc) {
            trace("softphone attachRemoteFromSession: no peer connection");
            return;
        }
        void this.applyOutboundMicBoost(session);
        trace("softphone attachRemoteFromSession: pc", pc.connectionState, pc.iceConnectionState);
        pc.addEventListener("iceconnectionstatechange", () => {
            trace("softphone iceConnectionState", pc.iceConnectionState);
        });
        pc.addEventListener("connectionstatechange", () => {
            trace("softphone connectionState", pc.connectionState);
        });
        pc.addEventListener("track", () => {
            trace("softphone remote track received");
            this.refreshRemoteAudio();
        });
        this.refreshRemoteAudio();
    }

    /** Pull whatever remote audio currently exists onto the <audio> element. */
    private refreshRemoteAudio(): void {
        if (!this.remoteAudio || !this.session) {
            return;
        }
        const pc = this.peerConnectionOf(this.session);
        if (!pc) {
            return;
        }
        const receivers = pc.getReceivers();
        const tracks = receivers
            .map((receiver) => receiver.track)
            .filter((track): track is MediaStreamTrack => track !== null);
        trace("softphone refreshRemoteAudio receivers", receivers.length, "tracks", tracks.length);
        if (tracks.length === 0) {
            return;
        }

        // Reassigning srcObject resets playback and fires `pause`, which in turn
        // re-triggered this method (reassign -> pause -> retry loop). Only
        // re-attach when the current element is not already carrying these
        // tracks; otherwise just make sure it is playing.
        const currentStream = this.remoteAudio.srcObject;
        const alreadyAttached =
            currentStream instanceof MediaStream &&
            currentStream.getAudioTracks().length > 0 &&
            tracks.every((track) =>
                currentStream.getAudioTracks().some((existing) => existing.id === track.id),
            );

        if (!alreadyAttached) {
            this.remoteAudio.srcObject = new MediaStream(tracks);
        }

        this.remoteAudio.muted = false;
        this.remoteAudio.volume = 1;
        this.remoteAudio.autoplay = true;

        if (this.remoteAudio.paused) {
            void this.remoteAudio.play().catch(() => {
                // Autoplay may need a user gesture; the answer click usually is one.
            });
        }
    }

    private peerConnectionOf(session: ManagedSession): RTCPeerConnection | null {
        const sdh = session.sessionDescriptionHandler as unknown as
            | SDHLike
            | undefined;
        return sdh?.peerConnection ?? null;
    }

    private withSenders(fn: (sender: RTCRtpSender) => void): void {
        this.peerConnectionOf(this.session as ManagedSession)
            ?.getSenders()
            .forEach(fn);
    }

    private async applyOutboundMicBoost(session: ManagedSession): Promise<void> {
        const pc = this.peerConnectionOf(session);
        if (!pc) {
            return;
        }

        const findAndBoost = async () => {
            if (this.session !== session) {
                return;
            }
            const sender = pc.getSenders().find((s) => s.track && s.track.kind === "audio");
            if (!sender || !sender.track) {
                return;
            }

            // Already boosted this sender track
            if (this.outboundMicProcessor && this.outboundMicProcessor.track.id === sender.track.id) {
                return;
            }

            const rawTrack = sender.track;
            this.rawSenderTrack = rawTrack;
            const rawStream = new MediaStream([rawTrack]);

            const processor = createBoostedMicStream(rawStream);
            this.outboundMicProcessor = processor;
            await processor.ensureRunning();
            inspectAndLogRawTrackSettings(rawTrack, undefined, processor.audioContext.state);

            try {
                await sender.replaceTrack(processor.track);
                await ensureAudioSenderBitrateUncapped(sender);
                trace("softphone outbound mic boost applied to sender");
            } catch (err) {
                console.warn("[softphone] replaceTrack with boosted mic failed:", err);
            }
        };

        void findAndBoost();
        setTimeout(() => void findAndBoost(), 250);
        setTimeout(() => void findAndBoost(), 1000);
    }

    private async teardown(): Promise<void> {
        if (this.outboundMicProcessor) {
            this.outboundMicProcessor.dispose();
            this.outboundMicProcessor = null;
        }
        this.rawSenderTrack = null;
        try {
            await this.registerer?.unregister();
        } catch {
            // ignore
        }
        try {
            await this.userAgent?.stop();
        } catch {
            // ignore
        }
        this.registerer = null;
        this.userAgent = null;
    }

    private setState(next: Partial<SoftphoneState>): void {
        this.state = { ...this.state, ...next };
        this.listeners.forEach((listener) => listener());
    }
}

function domainOf(uri: string): string {
    const at = uri.indexOf("@");
    return at >= 0 ? uri.slice(at + 1).trim() : "";
}

export function uriUserOf(uri: string): string {
    const withoutScheme = uri.replace(/^sip:/i, "");
    const at = withoutScheme.indexOf("@");
    return at >= 0 ? withoutScheme.slice(0, at).trim() : withoutScheme.trim();
}

/**
 * Clean a dial target: drop spaces/brackets/hyphens but keep a leading "+",
 * exactly as the number was dialled before the regression. The number itself
 * is not rewritten.
 */
export function normalizePhoneForSip(phone: string, _domain?: string): string {
    const trimmed = phone.trim();
    if (/(?:\b(?:ext\.?|extension)\b|\bx\b|\bx(?=\d)|[#;])/i.test(trimmed)) {
        return "";
    }
    return trimmed.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
}

export const softphone = new SoftphoneClient();
