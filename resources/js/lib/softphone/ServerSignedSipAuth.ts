import axios from "axios";
import { UserAgent, Web } from "sip.js";

export interface DigestChallenge {
    algorithm: string;
    realm: string;
    nonce: string;
    qop: "auth" | "auth-int" | null;
    opaque?: string;
    stale: boolean;
}

export interface SignChallengeParams {
    method: string;
    uri: string;
    realm: string;
    nonce: string;
    qop: "auth" | "auth-int" | null;
    nc: string | null;
    cnonce: string | null;
    algorithm: string;
    body_md5?: string;
}

export interface SignedDigestResponse {
    username: string;
    realm: string;
    nonce: string;
    uri: string;
    response: string;
    algorithm: string;
    qop: "auth" | "auth-int" | null;
    nc: string | null;
    cnonce: string | null;
}

export type ChallengeSigner = (
    params: SignChallengeParams,
) => Promise<SignedDigestResponse | null>;

interface PendingRequest {
    method: string;
    uri: string;
    body: string;
    sentAt: number;
}

interface StoredSignedDigest extends SignedDigestResponse {
    storedAt: number;
}

interface SipRequestLike {
    method: string;
    ruri: { toString(): string } | string;
}

interface SipChallengeLike {
    algorithm?: string;
    realm?: string;
    nonce?: string;
    opaque?: string;
    stale?: boolean;
    qop?: string[];
}

const PENDING_TTL_MS = 120_000;
const SIGNED_TTL_MS = 60_000;
const EMPTY_BODY_MD5 = "d41d8cd98f00b204e9800998ecf8427e";

/**
 * Unfold RFC 3261 multi-line SIP headers (lines starting with SP/HTAB).
 */
function unfoldHeaderLines(headerBlock: string): string[] {
    const rawLines = headerBlock.split(/\r?\n/);
    const lines: string[] = [];
    for (const line of rawLines) {
        if (/^[ \t]/.test(line) && lines.length > 0) {
            lines[lines.length - 1] += " " + line.trim();
        } else if (line.length > 0) {
            lines.push(line);
        }
    }
    return lines;
}

/**
 * Extract the top-most Via branch parameter from SIP header lines.
 */
function extractTopViaBranch(headerLines: string[]): string | null {
    for (const line of headerLines) {
        const match = line.match(/^(?:Via|v)\s*:\s*(.+)$/i);
        if (!match) continue;
        // Multiple Via entries can be comma-separated; inspect the top-most one.
        const topVia = match[1].split(",")[0] ?? "";
        const branchMatch = topVia.match(/;\s*branch=([^;\s,]+)/i);
        if (branchMatch?.[1]) {
            return branchMatch[1].trim();
        }
    }
    return null;
}

/**
 * Extract the SIP method from the CSeq header (e.g., `CSeq: 2 REGISTER`).
 */
function extractCSeqMethod(headerLines: string[]): string | null {
    for (const line of headerLines) {
        const match = line.match(/^CSeq\s*:\s*\d+\s+([A-Z]+)/i);
        if (match?.[1]) {
            return match[1].toUpperCase();
        }
    }
    return null;
}

/**
 * Parse an outgoing raw SIP request to record its method, Request-URI, Via branch, and body.
 */
export function parseOutgoingSipRequest(
    rawSip: string,
): { branch: string; method: string; uri: string; body: string } | null {
    const sepIdx = rawSip.indexOf("\r\n\r\n");
    const altIdx = sepIdx === -1 ? rawSip.indexOf("\n\n") : sepIdx;
    const headerBlock = altIdx === -1 ? rawSip : rawSip.slice(0, altIdx);
    const body =
        altIdx === -1
            ? ""
            : rawSip.slice(altIdx + (sepIdx !== -1 ? 4 : 2));

    const lines = unfoldHeaderLines(headerBlock);
    if (lines.length === 0) return null;

    const reqMatch = lines[0].match(/^([A-Z]+)\s+(\S+)\s+SIP\/2\.0$/i);
    if (!reqMatch) return null;

    const method = reqMatch[1].toUpperCase();
    const uri = reqMatch[2];
    const branch = extractTopViaBranch(lines.slice(1));
    if (!branch) return null;

    return { branch, method, uri, body };
}

/**
 * Parse an RFC 2617 `Digest ...` challenge header value.
 */
export function parseDigestChallengeHeader(
    headerValue: string,
): DigestChallenge | null {
    const trimmed = headerValue.trim();
    if (!/^Digest\s+/i.test(trimmed)) {
        return null;
    }

    const paramsStr = trimmed.replace(/^Digest\s+/i, "");
    const params: Record<string, string> = {};
    const tokenRegex =
        /([a-zA-Z0-9_-]+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^,\s]+))/g;
    let match: RegExpExecArray | null;
    while ((match = tokenRegex.exec(paramsStr)) !== null) {
        const key = match[1].toLowerCase();
        const value =
            match[2] !== undefined
                ? match[2].replace(/\\(.)/g, "$1")
                : (match[3] ?? "");
        params[key] = value;
    }

    const algorithm = (params.algorithm || "MD5").toUpperCase();
    if (algorithm !== "MD5") {
        return null;
    }

    const realm = params.realm ?? "";
    const nonce = params.nonce ?? "";
    if (!realm || !nonce) {
        return null;
    }

    let qop: "auth" | "auth-int" | null = null;
    if (params.qop !== undefined && params.qop.trim() !== "") {
        const options = params.qop
            .split(",")
            .map((v) => v.trim().toLowerCase())
            .filter(Boolean);
        if (options.includes("auth")) {
            qop = "auth";
        } else if (options.includes("auth-int")) {
            qop = "auth-int";
        } else {
            return null;
        }
    }

    return {
        algorithm: "MD5",
        realm,
        nonce,
        qop,
        opaque: params.opaque,
        stale: (params.stale ?? "").toLowerCase() === "true",
    };
}

/**
 * Inspect an incoming raw SIP message; returns challenge details ONLY for
 * `401 Unauthorized` and `407 Proxy Authentication Required` with a Digest challenge.
 */
export function parseIncomingSipChallenge(rawSip: string): {
    statusCode: 401 | 407;
    branch: string | null;
    cseqMethod: string | null;
    challenge: DigestChallenge;
} | null {
    const sepIdx = rawSip.indexOf("\r\n\r\n");
    const altIdx = sepIdx === -1 ? rawSip.indexOf("\n\n") : sepIdx;
    const headerBlock = altIdx === -1 ? rawSip : rawSip.slice(0, altIdx);
    const lines = unfoldHeaderLines(headerBlock);
    if (lines.length === 0) return null;

    const statusMatch = lines[0].match(/^SIP\/2\.0\s+(401|407)\b/i);
    if (!statusMatch) return null;

    const statusCode = Number(statusMatch[1]) as 401 | 407;
    const targetHeader =
        statusCode === 401 ? "www-authenticate" : "proxy-authenticate";
    const headerLines = lines.slice(1);

    let challenge: DigestChallenge | null = null;
    for (const line of headerLines) {
        const idx = line.indexOf(":");
        if (idx === -1) continue;
        const name = line.slice(0, idx).trim().toLowerCase();
        if (name !== targetHeader) continue;
        const parsed = parseDigestChallengeHeader(line.slice(idx + 1));
        if (parsed) {
            challenge = parsed;
            break;
        }
    }

    if (!challenge) return null;

    return {
        statusCode,
        branch: extractTopViaBranch(headerLines),
        cseqMethod: extractCSeqMethod(headerLines),
        challenge,
    };
}

/**
 * Format a SIP `Authorization` / `Proxy-Authorization` Digest header value
 * matching RFC 2617 and sip.js's `DigestAuthentication.toString()`.
 */
export function formatDigestAuthorizationHeader(
    signed: SignedDigestResponse & { opaque?: string },
): string {
    const authParams: string[] = [
        `algorithm=${signed.algorithm || "MD5"}`,
        `username="${signed.username}"`,
        `realm="${signed.realm}"`,
        `nonce="${signed.nonce}"`,
        `uri="${signed.uri}"`,
        `response="${signed.response}"`,
    ];
    if (signed.opaque) {
        authParams.push(`opaque="${signed.opaque}"`);
    }
    if (signed.qop && signed.cnonce && signed.nc) {
        authParams.push(`qop=${signed.qop}`);
        authParams.push(`cnonce="${signed.cnonce}"`);
        authParams.push(`nc=${signed.nc}`);
    }
    return `Digest ${authParams.join(", ")}`;
}

function generateCnonce(length = 12): string {
    const alphabet = "0123456789abcdef";
    if (
        typeof crypto !== "undefined" &&
        typeof crypto.getRandomValues === "function"
    ) {
        const bytes = new Uint8Array(length);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
    }
    let out = "";
    for (let i = 0; i < length; i++) {
        out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return out;
}

function formatNc(count: number): string {
    return count.toString(16).padStart(8, "0");
}

/**
 * Ephemeral store bridging async server signing (in the Transport) to sip.js's
 * synchronous `UserAgentClient.authenticationGuard()` call.
 */
export class PreSignedDigestStore {
    private entries = new Map<string, StoredSignedDigest>();

    private keyOf(
        method: string,
        uri: string,
        realm: string,
        nonce: string,
    ): string {
        return `${method.toUpperCase()}|${uri}|${realm}|${nonce}`;
    }

    putForMethod(method: string, signed: SignedDigestResponse): void {
        this.prune();
        this.entries.set(
            this.keyOf(method, signed.uri, signed.realm, signed.nonce),
            { ...signed, storedAt: Date.now() },
        );
    }

    take(
        method: string,
        uri: string,
        realm: string,
        nonce: string,
    ): SignedDigestResponse | null {
        this.prune();
        const key = this.keyOf(method, uri, realm, nonce);
        const found = this.entries.get(key);
        if (!found) {
            return null;
        }
        this.entries.delete(key);
        return found;
    }

    clear(): void {
        this.entries.clear();
    }

    createAuthenticationFactory(fallbackUsername: string) {
        return () => ({
            headerValue: null as string | null,
            authenticate(
                request: SipRequestLike,
                challenge: SipChallengeLike,
            ): boolean {
                const realm = challenge.realm ?? "";
                const nonce = challenge.nonce ?? "";
                const uri = String(request.ruri);
                if (!realm || !nonce || !uri) {
                    return false;
                }
                const signed = this.takeFromStore(
                    request.method,
                    uri,
                    realm,
                    nonce,
                );
                if (!signed) {
                    return false;
                }
                this.headerValue = formatDigestAuthorizationHeader({
                    ...signed,
                    username: signed.username || fallbackUsername,
                    opaque: challenge.opaque,
                });
                return true;
            },
            takeFromStore: (
                method: string,
                uri: string,
                realm: string,
                nonce: string,
            ) => this.take(method, uri, realm, nonce),
            toString(): string {
                if (!this.headerValue) {
                    throw new Error(
                        "No server-signed SIP Digest response available for this challenge.",
                    );
                }
                return this.headerValue;
            },
        });
    }

    private prune(): void {
        const now = Date.now();
        for (const [key, entry] of this.entries.entries()) {
            if (now - entry.storedAt > SIGNED_TTL_MS) {
                this.entries.delete(key);
            }
        }
    }
}

/**
 * Creates a `sip.js` `Web.Transport` subclass that intercepts `401`/`407`
 * SIP Digest challenges, asks the backend to sign each single-use challenge
 * response, caches it in `store`, and then delivers the `401`/`407` to sip.js
 * so its native `UserAgentClient` retries with the signed header.
 */
export function createServerSignedTransportClass(
    signChallenge: ChallengeSigner,
    store: PreSignedDigestStore,
) {
    return class ServerSignedSipTransport extends Web.Transport {
        private pendingByBranch = new Map<string, PendingRequest>();
        private lastByMethod = new Map<string, PendingRequest>();
        private nonceCounts = new Map<string, number>();
        private inFlightKeys = new Set<string>();
        private signedBranches = new Set<string>();
        private upstreamOnMessage?: (message: string) => void;

        constructor(
            logger: ConstructorParameters<typeof Web.Transport>[0],
            options?: ConstructorParameters<typeof Web.Transport>[1],
        ) {
            super(logger, options);
            Object.defineProperty(this, "onMessage", {
                configurable: true,
                enumerable: true,
                get: () =>
                    this.upstreamOnMessage
                        ? (rawMessage: string) => {
                              this.handleIncomingMessage(rawMessage);
                          }
                        : undefined,
                set: (handler: ((message: string) => void) | undefined) => {
                    this.upstreamOnMessage = handler;
                },
            });
        }

        override send(message: string): Promise<void> {
            const parsed = parseOutgoingSipRequest(message);
            if (parsed) {
                this.prunePending();
                const entry: PendingRequest = {
                    method: parsed.method,
                    uri: parsed.uri,
                    body: parsed.body,
                    sentAt: Date.now(),
                };
                this.pendingByBranch.set(parsed.branch, entry);
                this.lastByMethod.set(parsed.method, entry);
            }
            return super.send(message);
        }

        override disconnect(): Promise<void> {
            this.pendingByBranch.clear();
            this.lastByMethod.clear();
            this.inFlightKeys.clear();
            this.signedBranches.clear();
            store.clear();
            return super.disconnect();
        }

        private handleIncomingMessage(rawMessage: string): void {
            const challengeInfo = parseIncomingSipChallenge(rawMessage);
            if (!challengeInfo) {
                this.upstreamOnMessage?.(rawMessage);
                return;
            }

            const { branch, cseqMethod, challenge, statusCode } = challengeInfo;
            const branchKey = `${branch ?? "none"}|${statusCode}|${challenge.nonce}`;

            // Retransmitted 401/407 for a branch we already signed and delivered:
            // pass straight through so sip.js can ACK it without re-signing.
            if (this.signedBranches.has(branchKey)) {
                this.upstreamOnMessage?.(rawMessage);
                return;
            }

            // Deduplicate retransmissions while the server sign call is in flight.
            if (this.inFlightKeys.has(branchKey)) {
                return;
            }

            const pending =
                (branch ? this.pendingByBranch.get(branch) : undefined) ??
                (cseqMethod ? this.lastByMethod.get(cseqMethod) : undefined);

            if (!pending) {
                // Unknown request — let sip.js process the response as-is.
                this.upstreamOnMessage?.(rawMessage);
                return;
            }

            // If a server demands auth-int on a request with a non-empty body,
            // we cannot compute body MD5 without shipping the body; pass through.
            if (challenge.qop === "auth-int" && pending.body.length > 0) {
                this.upstreamOnMessage?.(rawMessage);
                return;
            }

            this.inFlightKeys.add(branchKey);

            const nextCount = (this.nonceCounts.get(challenge.nonce) ?? 0) + 1;
            this.nonceCounts.set(challenge.nonce, nextCount);
            const nc = challenge.qop ? formatNc(nextCount) : null;
            const cnonce = challenge.qop ? generateCnonce(12) : null;

            void signChallenge({
                method: pending.method,
                uri: pending.uri,
                realm: challenge.realm,
                nonce: challenge.nonce,
                qop: challenge.qop,
                nc,
                cnonce,
                algorithm: challenge.algorithm,
                ...(challenge.qop === "auth-int"
                    ? { body_md5: EMPTY_BODY_MD5 }
                    : {}),
            })
                .then((signed) => {
                    if (signed) {
                        store.putForMethod(pending.method, signed);
                    }
                })
                .catch((err) => {
                    // Signing failed (e.g., user revoked or line disabled):
                    // delivering the 401/407 without a cached response causes
                    // sip.js to reject the registration/call cleanly.
                    console.warn(
                        "[softphone] server challenge signing failed",
                        axios.isAxiosError(err) ? err.response?.status : undefined,
                    );
                })
                .finally(() => {
                    this.inFlightKeys.delete(branchKey);
                    this.signedBranches.add(branchKey);
                    if (this.signedBranches.size > 100) {
                        this.signedBranches.clear();
                    }
                    if (this.isConnected()) {
                        this.upstreamOnMessage?.(rawMessage);
                    }
                });
        }

        private prunePending(): void {
            const now = Date.now();
            for (const [key, item] of this.pendingByBranch.entries()) {
                if (now - item.sentAt > PENDING_TTL_MS) {
                    this.pendingByBranch.delete(key);
                }
            }
        }
    };
}

/**
 * Calls the Laravel server-side SIP Digest challenge-signing endpoint for a saved line.
 */
export function createDeviceChallengeSigner(deviceId: number): ChallengeSigner {
    return async (params: SignChallengeParams) => {
        let url: string;
        try {
            url = route("telephony.softphone.devices.sign-challenge", {
                id: deviceId,
            });
        } catch {
            url = `/account/telephony/softphone/devices/${deviceId}/sign-challenge`;
        }
        const res = await axios.post<{
            status: string;
            data?: SignedDigestResponse;
        }>(url, params, {
            headers: { Accept: "application/json" },
            timeout: 8_000,
        });
        return res.data?.status === "success" && res.data.data
            ? res.data.data
            : null;
    };
}

/**
 * Wires server-side Digest challenge authentication onto a freshly constructed
 * `sip.js` `UserAgent` instance (before `userAgent.start()` is called).
 */
export function bindServerSignedAuth(
    userAgent: UserAgent,
    store: PreSignedDigestStore,
    fallbackUsername: string,
): void {
    const coreConfig = (
        userAgent as unknown as {
            userAgentCore?: {
                configuration?: {
                    authenticationFactory?: () => unknown;
                };
            };
        }
    ).userAgentCore?.configuration;

    if (coreConfig) {
        coreConfig.authenticationFactory =
            store.createAuthenticationFactory(fallbackUsername);
    }
}
