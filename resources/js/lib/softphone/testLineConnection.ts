import { Registerer, RegistererState, UserAgent } from "sip.js";
import type { SoftphoneConfig } from "@/Types/api/softphone";
import {
    PreSignedDigestStore,
    bindServerSignedAuth,
    createDeviceChallengeSigner,
    createServerSignedTransportClass,
} from "./ServerSignedSipAuth";
import { providerMessage, resolveProviderProfile } from "./providerProfile";

/** Where a connection test stopped. `registered` is the only success. */
export type LineTestStage =
    | "registered"
    | "config"
    | "transport"
    | "auth"
    | "rejected"
    | "timeout";

export interface LineTestResult {
    ok: boolean;
    stage: LineTestStage;
    /** Agent-facing sentence. */
    message: string;
    latencyMs: number | null;
}

const TEST_TIMEOUT_MS = 12_000;

/**
 * Health check for a phone line: connects to its WSS endpoint and sends a real
 * SIP REGISTER with the line's credentials, then unregisters again.
 *
 * Deliberately independent of the `softphone` singleton — it uses its own
 * UserAgent, so testing a line never disturbs a live registration or call, and
 * it never places a call. A registration is the same thing the dock does to go
 * online, so "registered" here means the line will work.
 */
export async function testLineConnection(
    config: SoftphoneConfig,
): Promise<LineTestResult> {
    const startedAt = performance.now();
    const elapsed = () => Math.round(performance.now() - startedAt);
    const fail = (stage: LineTestStage, message: string): LineTestResult => ({
        ok: false,
        stage,
        message,
        latencyMs: null,
    });

    const profile = resolveProviderProfile(config);
    const uri = UserAgent.makeURI(config.uri);
    if (!uri) {
        return fail("config", "The SIP URI is not valid (expected e.g. sip:12345@domain.com).");
    }
    if (!/^wss:\/\//i.test(config.wss_url.trim())) {
        return fail("config", "The WSS URL must start with wss://.");
    }

    const useChallengeSigning =
        config.auth_mode === "challenge" ||
        (!config.authorization_password &&
            !config.authorization_ha1 &&
            typeof config.id === "number");

    const digestStore = useChallengeSigning
        ? new PreSignedDigestStore()
        : null;
    const transportConstructor =
        useChallengeSigning && digestStore && typeof config.id === "number"
            ? createServerSignedTransportClass(
                  createDeviceChallengeSigner(config.id),
                  digestStore,
                  profile.digest_algorithms,
              )
            : undefined;

    const userAgent = new UserAgent({
        uri,
        ...(transportConstructor ? { transportConstructor } : {}),
        transportOptions: { server: config.wss_url.trim() },
        authorizationUsername: config.authorization_username || undefined,
        // Saved lines authenticate via server-side challenge signing; unsaved
        // form tests use the password the admin just typed locally.
        ...(useChallengeSigning
            ? {}
            : config.authorization_ha1
              ? { authorizationHa1: config.authorization_ha1 }
              : {
                    authorizationPassword:
                        config.authorization_password || undefined,
                }),
        displayName: config.display_name || undefined,
        logLevel: "error",
    });

    if (useChallengeSigning && digestStore) {
        bindServerSignedAuth(
            userAgent,
            digestStore,
            config.authorization_username || uri.user || "",
        );
    }

    let registerer: Registerer | null = null;

    try {
        try {
            await withTimeout(userAgent.start(), TEST_TIMEOUT_MS);
        } catch (error) {
            return isTimeout(error)
                ? fail("timeout", "The WSS server did not answer in time.")
                : fail("transport", providerMessage(profile, "transport_failed"));
        }

        // Short expiry so a test that cannot unregister cleanly lapses quickly.
        registerer = new Registerer(userAgent, { expires: 60 });

        const outcome = await new Promise<LineTestResult>((resolve) => {
            const timer = window.setTimeout(
                () =>
                    resolve(
                        fail("timeout", providerMessage(profile, "registration_timeout")),
                    ),
                TEST_TIMEOUT_MS,
            );
            const done = (result: LineTestResult) => {
                window.clearTimeout(timer);
                resolve(result);
            };

            registerer!.stateChange.addListener((state) => {
                if (state === RegistererState.Registered) {
                    done({
                        ok: true,
                        stage: "registered",
                        message: "Connected — the line registered successfully.",
                        latencyMs: elapsed(),
                    });
                }
            });

            registerer!
                .register({
                    requestDelegate: {
                        onReject: (response) => {
                            const status = response.message.statusCode;
                            done(
                                status === 401 || status === 403
                                    ? fail("auth", providerMessage(profile, "registration_auth_failed"))
                                    : fail(
                                          "rejected",
                                          providerMessage(profile, "registration_rejected", { status }),
                                      ),
                            );
                        },
                    },
                })
                .catch(() =>
                    done(fail("transport", "Could not send the registration to the line.")),
                );
        });

        return outcome;
    } finally {
        // Best-effort cleanup; the 60s expiry covers a failure here.
        try {
            if (registerer && registerer.state === RegistererState.Registered) {
                await withTimeout(registerer.unregister(), 4_000);
            }
        } catch {
            // ignore
        }
        try {
            await withTimeout(userAgent.stop(), 4_000);
        } catch {
            // ignore
        }
    }
}

const TIMEOUT = Symbol("timeout");

function isTimeout(error: unknown): boolean {
    return error === TIMEOUT;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(TIMEOUT), ms);
        promise.then(
            (value) => {
                window.clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                window.clearTimeout(timer);
                reject(error);
            },
        );
    });
}
