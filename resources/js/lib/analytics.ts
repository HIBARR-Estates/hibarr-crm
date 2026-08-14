/**
 * PostHog product analytics for the Inertia/React screens.
 *
 * Wired outside React on purpose. Page views are driven by Inertia's router
 * events rather than a provider component, so tracking does not depend on where
 * anything sits in the component tree, cannot re-fire on re-render, and covers
 * every page including ones that never mount DashboardLayout.
 *
 * Configuration arrives as an Inertia shared prop (`posthog`), not a build-time
 * env var — two asset pipelines coexist in this repo (Mix inlines
 * `process.env.MIX_*`, Vite inlines `import.meta.env.VITE_*`) and a build-time
 * key would need declaring in both and a rebuild to rotate. No key configured
 * means the library is never even imported.
 */
import { router } from "@inertiajs/react";
import type { PostHog } from "posthog-js";

type PostHogConfig = { key: string; host: string };

type SharedProps = {
    posthog?: PostHogConfig | null;
    auth?: {
        user?: {
            id?: number | string;
            name?: string | null;
            email?: string | null;
        } | null;
    } | null;
    locale?: string;
};

type InertiaPage = {
    component?: string;
    url?: string;
    props?: SharedProps;
};

/**
 * Resolved once the async import lands. Everything below tolerates it being
 * null: analytics must never be the reason a page fails to render.
 */
let client: PostHog | null = null;

/** The identity currently sent to PostHog, so we only re-identify on a change. */
let identifiedAs: string | null = null;

let started = false;

/** Set when the import rejected, so we stop queueing for a client that will never arrive. */
let unavailable = false;

/**
 * Pages navigated to while posthog-js was still downloading.
 *
 * Without this they were dropped: the navigate listener is registered
 * synchronously but `client` only exists once the lazy chunk resolves, so a
 * fast click through that window lost its pageview.
 *
 * ponytail: bounded at 20 rather than tracked properly. A dynamic import that
 * neither resolves nor rejects (hung network) would otherwise grow this for the
 * life of the session; 20 is far more than the sub-second window can produce.
 */
let pending: InertiaPage[] = [];

const MAX_PENDING = 20;

/**
 * Traits attached to the person record.
 *
 * Plain `name` and `email`, not `$name`/`$email`. The `$` prefix is reserved for
 * properties PostHog sets itself ($browser, $os, $current_url); the project's
 * person display name setting reads the unprefixed keys, so prefixing them
 * stores the values as ordinary custom properties and leaves the Persons list
 * still showing a bare user id — the thing sending them was meant to fix.
 *
 * This is staff PII leaving the CRM for a third-party processor, enabled by an
 * explicit decision rather than by default. Two things follow from that, for
 * whoever revisits this:
 *   - it belongs in the PostHog DPA and the record of processing;
 *   - deletion requests have to reach PostHog too, not just this database.
 * Reverting is a one-line change here — the distinct id stays the user id
 * either way, so history is not orphaned by dropping these.
 *
 * Only ever the logged-in staff user. No lead or client data is sent from here.
 */
function personTraits(props: SharedProps): Record<string, unknown> {
    const user = props.auth?.user;

    return {
        name: user?.name ?? null,
        email: user?.email ?? null,
        locale: props.locale ?? null,
    };
}

/**
 * Sync PostHog's identity with whoever the server says is logged in.
 *
 * Driven off the shared props rather than the logout buttons: there are two
 * React logout paths plus the legacy Blade ones, and PostHog's distinct id
 * lives in a cookie that outlives the page. Watching "is there a user" here
 * covers every way a session can end, including expiry, with no call-site
 * changes — and cannot be forgotten by whoever adds the next logout button.
 */
function syncIdentity(props: SharedProps): void {
    if (!client) {
        return;
    }

    const userId = props.auth?.user?.id;

    if (userId === undefined || userId === null) {
        // Logged out. Drop the identity so the next person on a shared browser
        // does not inherit it.
        if (identifiedAs !== null) {
            client.reset();
            identifiedAs = null;
        }

        return;
    }

    const distinctId = String(userId);

    // Re-identifying on every navigation would issue a $set on each page view
    // for no new information.
    if (identifiedAs === distinctId) {
        return;
    }

    client.identify(distinctId, personTraits(props));
    identifiedAs = distinctId;
}

function capturePageview(page: InertiaPage): void {
    if (!client) {
        return;
    }

    // The Inertia component name is the useful dimension here. Raw URLs carry
    // record ids (/deals/8412), so grouping by them buries every screen under
    // thousands of one-hit paths; `component` gives "Deals/Redesign/DealView".
    client.capture("$pageview", {
        component: page.component ?? null,
    });
}

/**
 * Handle one page — record it, or hold it until the client exists.
 *
 * Both the initial load and every navigation go through here so the queueing
 * rule cannot be applied to one and forgotten on the other.
 */
function handlePage(page: InertiaPage): void {
    if (unavailable) {
        return;
    }

    if (!client) {
        if (pending.length < MAX_PENDING) {
            pending.push(page);
        }

        return;
    }

    syncIdentity(page.props ?? {});
    capturePageview(page);
}

/**
 * Start analytics. Safe to call when unconfigured — it simply does nothing.
 *
 * Called from inertia.tsx with the initial page, before first paint.
 */
export function initAnalytics(page: InertiaPage): void {
    const config = page.props?.posthog;

    // No key configured (the default, and every local dev environment): don't
    // load the library at all rather than initialising a dead client.
    if (!config?.key || started) {
        return;
    }

    started = true;

    // Dynamic import so posthog-js lands in its own chunk and is never part of
    // the initial bundle for environments that have analytics switched off.
    import("posthog-js")
        .then(({ default: posthog }) => {
            posthog.init(config.key, {
                api_host: config.host,

                // Inertia navigations are history.pushState, which posthog-js
                // would also count. Pageviews are captured explicitly below so
                // each one carries the component name and fires exactly once.
                capture_pageview: false,

                // Only create person records for logged-in users. Anonymous
                // profiles on an internal CRM are all the same handful of login
                // hits, and they bill per profile.
                person_profiles: "identified_only",
            });

            client = posthog;

            // The page the session started on, then anything navigated to while
            // the chunk was still in flight — in the order they were viewed.
            handlePage(page);

            const queued = pending;
            pending = [];
            queued.forEach(handlePage);
        })
        .catch(() => {
            // A blocked or failed analytics bundle is not a page error. Stop
            // queueing: no client is coming, and holding pages would leak.
            unavailable = true;
            pending = [];
        });

    router.on("navigate", (event) => {
        handlePage(event.detail.page as InertiaPage);
    });
}

/**
 * Record a product event.
 *
 * No-ops when analytics is unconfigured or still loading, so call sites never
 * need to guard. Use snake_case names describing what the user did
 * ("deal_outcome_changed"), and keep record ids out of the properties unless
 * the analysis genuinely needs them.
 */
export function track(event: string, properties?: Record<string, unknown>): void {
    client?.capture(event, properties);
}

/**
 * Clear the identity on logout, so a shared browser does not attribute the next
 * person's session to the one who just left.
 */
export function resetAnalytics(): void {
    client?.reset();
    identifiedAs = null;
}
