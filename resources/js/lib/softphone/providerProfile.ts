import type {
    SipProviderMessages,
    SipProviderProfile,
    SoftphoneConfig,
} from "@/Types/api/softphone";

/**
 * Used when a config arrives without a profile (an older server, or a form
 * whose provider defaults did not load). Mirrors SipProviderRegistry::
 * DEFAULT_CLIENT_PROFILE so behaviour is the same either way; the server's
 * profile always wins when present.
 */
export const GENERIC_PROVIDER_PROFILE: SipProviderProfile = {
    key: null,
    label: "your SIP provider",
    sip_domain: null,
    ice_servers: [{ urls: "stun:stun.l.google.com:19302" }],
    digest_algorithms: ["MD5"],
    identity_header: "P-Preferred-Identity",
    messages: {
        not_registered:
            "Your phone line isn't connected to your SIP provider. Pick a line in the phone panel, then retry.",
        registration_auth_failed: "The line rejected the username or password.",
        registration_rejected: "The line rejected the registration (:status).",
        registration_timeout: "The line did not answer the registration in time.",
        transport_failed:
            "Could not connect to the WSS URL. Check the address and that the server is reachable.",
        invite_failed:
            "The call could not be placed — the request to your SIP provider failed.",
        call_status: {},
    },
};

/** The line's provider profile, filled in with generic defaults. */
export function resolveProviderProfile(
    config: Pick<SoftphoneConfig, "provider_profile" | "stun_url"> | null | undefined,
): SipProviderProfile {
    const profile = config?.provider_profile;
    if (!profile) {
        // Older payloads only carried the provider's STUN server.
        return config?.stun_url
            ? {
                  ...GENERIC_PROVIDER_PROFILE,
                  ice_servers: [
                      ...GENERIC_PROVIDER_PROFILE.ice_servers,
                      { urls: config.stun_url },
                  ],
              }
            : GENERIC_PROVIDER_PROFILE;
    }
    return {
        ...GENERIC_PROVIDER_PROFILE,
        ...profile,
        messages: {
            ...GENERIC_PROVIDER_PROFILE.messages,
            ...profile.messages,
            call_status: {
                ...GENERIC_PROVIDER_PROFILE.messages.call_status,
                ...(profile.messages?.call_status ?? {}),
            },
        },
    };
}

/** One of the profile's messages, with `:status` filled in. */
export function providerMessage(
    profile: SipProviderProfile,
    key: Exclude<keyof SipProviderMessages, "call_status">,
    vars: { status?: number | string | null } = {},
): string {
    return profile.messages[key].replace(":status", String(vars.status ?? "unknown"));
}
