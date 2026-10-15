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

type Listener = () => void;

const EMPTY_STATE: SoftphoneState = {
    registration: "idle",
    registrationError: null,
    call: null,
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

    async call(rawTarget: string): Promise<void> {
        const target = rawTarget.trim();
        if (!this.userAgent || !this.config || !target) {
            return;
        }
        if (this.session) {
            // One call at a time in v1 — a second dial replaces nothing; bail.
            return;
        }

        const domain = domainOf(this.config.uri);
        const sipUri = domain ? `sip:${target}@${domain}` : `sip:${target}`;
        const targetUri = UserAgent.makeURI(sipUri);
        if (!targetUri) {
            throw new Error(`Could not build SIP target: ${sipUri}`);
        }

        const inviter = new Inviter(this.userAgent, targetUri, {
            sessionDescriptionHandlerOptions: {
                constraints: { audio: true, video: false },
            },
        }) as unknown as ManagedSession;

        this.beginCall(inviter, "outbound", target);

        try {
            await (inviter as unknown as Inviter).invite();
        } catch (error: unknown) {
            this.endCall();
            throw error;
        }
    }

    async answer(): Promise<void> {
        const session = this.session;
        if (!session || this.state.call?.phase !== "inbound") {
            return;
        }
        try {
            await session.accept({
                sessionDescriptionHandlerOptions: {
                    constraints: { audio: true, video: false },
                },
            });
        } catch {
            this.endCall();
        }
    }

    async reject(): Promise<void> {
        const session = this.session;
        if (!session) {
            return;
        }
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

    // --- internals -------------------------------------------------------

    private onIncoming(invitation: Invitation): void {
        // One call at a time — busy out any second simultaneous inbound.
        if (this.session) {
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
    ): void {
        this.session = session;
        this.callSeq += 1;
        const id = `call-${this.callSeq}`;

        this.setState({
            call: {
                id,
                direction,
                peer,
                phase: direction,
                answeredAt: null,
                muted: false,
                onHold: false,
            },
        });

        this.attachRemoteFromSession(session);

        session.stateChange.addListener((state) => {
            if (this.session !== session) {
                return;
            }
            if (state === SessionState.Established) {
                const call = this.state.call;
                if (call && call.answeredAt === null) {
                    this.setState({
                        call: { ...call, phase: "active", answeredAt: Date.now() },
                    });
                }
            } else if (state === SessionState.Terminated) {
                this.endCall();
            }
        });
    }

    private endCall(): void {
        this.session = null;
        if (this.state.call) {
            this.setState({ call: null });
        }
    }

    private attachRemoteFromSession(session: ManagedSession): void {
        const pc = this.peerConnectionOf(session);
        if (!pc) {
            return;
        }
        pc.addEventListener("track", () => this.refreshRemoteAudio());
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
        const tracks = pc
            .getReceivers()
            .map((receiver) => receiver.track)
            .filter((track): track is MediaStreamTrack => track !== null);
        if (tracks.length > 0) {
            this.remoteAudio.srcObject = new MediaStream(tracks);
            void this.remoteAudio.play().catch(() => {
                // autoplay may be blocked until a user gesture; dock handles that
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
