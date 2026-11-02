import { useCallback, useRef, useState } from "react";
import axios from "axios";
import {
    testLineConnection,
    type LineTestResult,
} from "@/lib/softphone/testLineConnection";
import type {
    SoftphoneConfig,
    SoftphoneDeviceCredentialsResponse,
} from "@/Types/api/softphone";

export type LineTestState =
    | { status: "testing" }
    | { status: "done"; result: LineTestResult; testedAt: number };

/**
 * Connection health checks for phone lines, keyed by line id (`"draft"` for
 * the unsaved form). Each check is a real SIP registration — see
 * testLineConnection — and the outcome is kept so the lines table can show it.
 */
export default function useSoftphoneLineTest() {
    const [states, setStates] = useState<Record<string, LineTestState>>({});
    // Ignore a result that arrives after a newer test of the same line began.
    const runIds = useRef<Record<string, number>>({});

    const run = useCallback(
        async (key: string, getConfig: () => Promise<SoftphoneConfig>) => {
            const runId = (runIds.current[key] ?? 0) + 1;
            runIds.current[key] = runId;
            setStates((s) => ({ ...s, [key]: { status: "testing" } }));

            let result: LineTestResult;
            try {
                result = await testLineConnection(await getConfig());
            } catch (error) {
                result = {
                    ok: false,
                    stage: "config",
                    message:
                        error instanceof Error
                            ? error.message
                            : "The connection test could not run.",
                    latencyMs: null,
                };
            }

            if (runIds.current[key] === runId) {
                setStates((s) => ({
                    ...s,
                    [key]: { status: "done", result, testedAt: Date.now() },
                }));
            }
            return result;
        },
        [],
    );

    /** Stored credentials for a saved line (needs make_softphone_calls). */
    const fetchStored = useCallback(async (deviceId: number) => {
        try {
            const response = await axios.get<SoftphoneDeviceCredentialsResponse>(
                route("telephony.softphone.devices.credentials", deviceId),
                { headers: { Accept: "application/json" } },
            );
            const data = response.data.data;
            if (!data) throw new Error();
            return data;
        } catch (error) {
            const forbidden = axios.isAxiosError(error) && error.response?.status === 403;
            throw new Error(
                forbidden
                    ? "Testing a saved line needs the make softphone calls permission."
                    : "Could not load this line's saved settings.",
            );
        }
    }, []);

    /** Test a saved line with its stored credentials. */
    const testSaved = useCallback(
        (deviceId: number) =>
            run(String(deviceId), async () => fetchStored(deviceId)),
        [run, fetchStored],
    );

    /**
     * Test the settings typed into the form. On edit a blank password means
     * "the stored one", which is fetched for the test only.
     */
    const testDraft = useCallback(
        (draft: SoftphoneConfig, editingId: number | null) =>
            run(editingId ? String(editingId) : "draft", async () => {
                if (editingId && !draft.authorization_password) {
                    const stored = await fetchStored(editingId);
                    return {
                        ...draft,
                        authorization_password: stored.authorization_password,
                    };
                }
                return draft;
            }),
        [run, fetchStored],
    );

    const clear = useCallback((key: string) => {
        runIds.current[key] = (runIds.current[key] ?? 0) + 1;
        setStates((s) => {
            const { [key]: _removed, ...rest } = s;
            return rest;
        });
    }, []);

    return { states, testSaved, testDraft, clear };
}
