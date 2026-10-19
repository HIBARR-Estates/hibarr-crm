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

/**
 * Thin SIP.js wrapper that turns sipgate Neo into an in-browser softphone.
 *
 * The browser registers as the SIP user agent over WSS and owns the audio
 * path directly with sipgate. It deliberately does NOT talk to OL's call
 * bridge — the CRM timeline is still driven by the existing OL poll. This
 * class only manages registration + a single active call and publishes a
 * plain state object the UI subscribes to.
 */

interface SDHLike {
    peerConnection?: RTCPeerConnection | null;
}

/** A peer connection we already attached media-path listeners to. */
type WatchedPeerConnection = RTCPeerConnection & { __spWatched?: boolean };

type Listener = () => void;

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
    bye(): Promise<void>;
    state: SessionState;
}

class SoftphoneClient {
    private config: SoftphoneConfig | null = null;
    private userAgent: UserAgent | null = null;
    private registerer: Registerer | null = null;
    private session: ManagedSession | null = null;
    private answering = false;
    /** The agent pressed decline/hang up — not a failed call, so no notice. */
    private endedByUser = false;
    /** A reason is already on record for this attempt (don't overwrite it). */
    private failureRecorded = false;
    private remoteAudio: HTMLAudioElement | null = null;
    private listeners = new Set<Listener>();
    private callSeq = 0;
    private state: SoftphoneState = EMPTY_STATE;

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
                console.log("softphone remote audio ended; refreshing");
                this.refreshRemoteAudio();
            };
            el.onpause = () => {
                console.log("softphone remote audio paused; retrying play");
                window.setTimeout(() => {
                    void el.play().catch(() => undefined);
                }, 100);
            };
            el.onerror = () => {
                console.log("softphone remote audio error; refreshing");
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
        // Device switch: tear down any current registration/call first.
        if (this.userAgent) {
            this.session = null;
            await this.teardown();
            this.setState(EMPTY_STATE);
        }
        this.config = config;
        this.setState({ ...EMPTY_STATE, registration: "registering" });

        try {
            const uri = UserAgent.makeURI(config.uri);
            if (!uri) {
                throw new Error(`Invalid SIP URI: ${config.uri}`);
            }

            const userAgent = new UserAgent({
                uri,
                transportOptions: { server: config.wss_url },
                authorizationUsername: config.authorization_username || undefined,
                authorizationPassword: config.authorization_password || undefined,
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

            const registerer = new Registerer(userAgent);
            registerer.stateChange.addListener((state) => {
                if (state === RegistererState.Registered) {
                    this.setState({
                        registration: "registered",
                        registrationError: null,
                    });
                } else if (state === RegistererState.Unregistered) {
                    // Only meaningful if we didn't intentionally stop.
                    if (this.userAgent) {
                        this.setState({ registration: "unregistered" });
                    }
                }
            });
            await registerer.register();

            this.userAgent = userAgent;
            this.registerer = registerer;
        } catch (error: unknown) {
            await this.teardown();
            this.setState({
                registration: "failed",
                registrationError:
                    error instanceof Error ? error.message : "Registration failed",
            });
        }
    }

    async stop(): Promise<void> {
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
        if (!this.userAgent) {
            this.reportSetupFailure(
                target,
                "The softphone is not registered with sipgate. Pick a line in the softphone, then retry.",
                context,
            );
            throw new Error("The softphone is not registered.");
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
        const sipUri = domain ? `sip:${target}@${domain}` : `sip:${target}`;
        const targetUri = UserAgent.makeURI(sipUri);
        if (!targetUri) {
            this.reportSetupFailure(
                target,
                `"${target}" is not a number this line can dial.`,
                context,
            );
            throw new Error(`Could not build SIP target: ${sipUri}`);
        }

        const inviter = new Inviter(this.userAgent, targetUri, {
            sessionDescriptionHandlerOptions: {
                constraints: { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false }, video: false },
            },
        }) as unknown as ManagedSession;

        this.beginCall(inviter, "outbound", target, context);

        try {
            const extraHeaders = this.config.uri
                ? [`P-Preferred-Identity: ${this.config.uri.startsWith("sip:") ? `<${this.config.uri}>` : `<sip:${this.config.authorization_username || this.config.uri}@${domain || "sipgate.de"}>`}`]
                : [];
            await (inviter as unknown as Inviter).invite({
                requestOptions: {
                    extraHeaders,
                    // The only place sip.js 0.21 hands us the call's outcome:
                    // provisional responses (180 Ringing) and the negative final
                    // response. Without it an outbound call sat on "Calling…"
                    // until it ended, with no reason shown for a failed call.
                    delegate: this.inviteDelegate(),
                },
            } as never);
            // SessionDescriptionHandler exists only after invite() — attach remote audio now.
            if (this.session) {
                this.attachRemoteFromSession(this.session);
                this.refreshRemoteAudio();
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
        this.answering = true;
        const answeringCallId = this.state.call?.id ?? null;
        console.log("softphone answer() start", answeringCallId);
        try {
            if (this.state.call?.id !== answeringCallId) {
                throw new Error("active call changed during answer");
            }
            await session.accept({
                sessionDescriptionHandlerOptions: {
                    constraints: { audio: true, video: false },
                },
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
            // eslint-disable-next-line no-console
            console.log("softphone answer() failed", error);
            console.error("softphone answer() failed", error);
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
                await session.reject();
            } else {
                await session.bye();
            }
        } catch {
            // ignore
        }
        this.endCall();
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
        this.setState({ call: { ...call, muted } });
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

    // --- internals -------------------------------------------------------

/**
     * INVITE progress. sip.js 0.21 has no session state for either of these, so
     * this is where an outbound call learns that the far end started ringing and
     * — when it never connects — why.
     */
    private inviteDelegate() {
        return {
            onProgress: (response: { statusCode?: number }) => {
                // 180 Ringing: the callee's phone is buzzing.
                if (response.statusCode === 180) {
                    this.setStage("ringing");
                }
            },
            onRedirect: (response: { statusCode?: number; reasonPhrase?: string }) => {
                this.failFromStatus(response.statusCode, response.reasonPhrase);
            },
            onReject: (response: { statusCode?: number; reasonPhrase?: string }) => {
                this.failFromStatus(response.statusCode, response.reasonPhrase);
            },
        };
    }

    /**
     * A call that was never placed at all (no line, not registered, another
     * call live). There is no session to tear down, so this writes the notice
     * straight into state — otherwise the agent gets no explanation.
     */
    private reportSetupFailure(
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
            console.log("softphone onIncoming: busy — rejecting second invitation");
            void invitation.reject();
            return;
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
        const id = `call-${this.callSeq}`;
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
        console.log("softphone beginCall", id, direction, peer);

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
                console.log("softphone session terminated", this.state.call?.id);
                const call = this.state.call;
                // A call that never reached media and did not end by the agent's
                // own hand is a failed connection — say so instead of closing.
                if (
                    call &&
                    call.connectedAt === null &&
                    !this.endedByUser &&
                    !this.failureRecorded
                ) {
                    this.failCall(
                        "terminated",
                        call.direction === "inbound"
                            ? "The caller hung up before connecting."
                            : "The call ended before it connected.",
                    );
                    return;
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
                console.log("softphone media path failed");
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
            console.log("softphone attachRemoteFromSession: no peer connection");
            return;
        }
        console.log("softphone attachRemoteFromSession: pc", pc.connectionState, pc.iceConnectionState);
        pc.addEventListener("iceconnectionstatechange", () => {
            console.log("softphone iceConnectionState", pc.iceConnectionState);
        });
        pc.addEventListener("connectionstatechange", () => {
            console.log("softphone connectionState", pc.connectionState);
        });
        pc.addEventListener("track", () => {
            console.log("softphone remote track received");
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
        console.log("softphone refreshRemoteAudio receivers", receivers.length, "tracks", tracks.length);
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

    private async teardown(): Promise<void> {
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

export const softphone = new SoftphoneClient();
