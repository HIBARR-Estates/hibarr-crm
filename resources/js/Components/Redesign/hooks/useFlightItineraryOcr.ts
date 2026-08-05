import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { getOlConfig } from "@/lib/config";
import {
    GoogleVisionOcrRequestStatus,
    IFlightItineraryEntry,
    IFlightItineraryStatusData,
    IUploadFlightItineraryData,
    OcrApiResponse,
} from "@/Types/api/ocr";

export type OcrScanState =
    | "idle"
    | "uploading"
    | "processing"
    | "completed"
    | "failed";

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 30; // ~1 minute of polling
/** Matches config/file_storage.php FILE_UPLOAD_TIMEOUT default (120s). */
const REQUEST_TIMEOUT_MS = 120_000;

function extractErrorMessage(error: unknown, fallback: string): string {
    if (axios.isAxiosError(error)) {
        return (
            (error.response?.data as { message?: string } | undefined)
                ?.message || fallback
        );
    }
    return error instanceof Error ? error.message : fallback;
}

/**
 * Uploads a flight ticket image to the OL flight-itinerary OCR endpoint
 * (MIX_OL_BASE_URL / MIX_OL_API_KEY) and polls until recognition completes.
 */
export default function useFlightItineraryOcr() {
    const [scanState, setScanState] = useState<OcrScanState>("idle");
    const [flights, setFlights] = useState<IFlightItineraryEntry[]>([]);
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const generationRef = useRef(0);

    const clearPoll = useCallback(() => {
        if (pollTimeoutRef.current) {
            clearTimeout(pollTimeoutRef.current);
            pollTimeoutRef.current = null;
        }
    }, []);

    const bumpGeneration = useCallback(() => {
        generationRef.current += 1;
        return generationRef.current;
    }, []);

    const isStaleGeneration = useCallback(
        (generation: number) => generationRef.current !== generation,
        [],
    );

    useEffect(() => {
        return () => {
            bumpGeneration();
            clearPoll();
        };
    }, [bumpGeneration, clearPoll]);

    const checkStatus = useCallback(
        async (
            requestId: number,
            attempt: number,
            config: { baseUrl: string; apiKey: string },
            generation: number,
        ) => {
            if (isStaleGeneration(generation)) return;

            try {
                const response = await axios.get<
                    OcrApiResponse<IFlightItineraryStatusData>
                >(`${config.baseUrl}/ocr/flight-itineraries/${requestId}`, {
                    headers: { "X-Api-Key": config.apiKey },
                    timeout: REQUEST_TIMEOUT_MS,
                });
                if (isStaleGeneration(generation)) return;

                const data = response.data.data;

                if (data.status === GoogleVisionOcrRequestStatus.COMPLETED) {
                    setFlights(data.flights ?? []);
                    setScanState("completed");
                    return;
                }

                if (data.status === GoogleVisionOcrRequestStatus.FAILED) {
                    setErrorMessage(
                        data.errorMessage || "Flight itinerary scan failed.",
                    );
                    setScanState("failed");
                    return;
                }

                if (attempt >= MAX_POLL_ATTEMPTS) {
                    setErrorMessage(
                        "The scan is taking longer than expected. Please try again.",
                    );
                    setScanState("failed");
                    return;
                }

                pollTimeoutRef.current = setTimeout(() => {
                    void checkStatus(
                        requestId,
                        attempt + 1,
                        config,
                        generation,
                    );
                }, POLL_INTERVAL_MS);
            } catch (error) {
                if (isStaleGeneration(generation)) return;
                setErrorMessage(
                    extractErrorMessage(
                        error,
                        "Failed to check the scan status.",
                    ),
                );
                setScanState("failed");
            }
        },
        [isStaleGeneration],
    );

    const scanTicketImage = useCallback(
        async (file: File) => {
            const generation = bumpGeneration();
            clearPoll();
            setErrorMessage(null);
            setFlights([]);
            setFileUrl(null);
            setScanState("uploading");

            // OCR lives on the OL API — not the generic file-upload service.
            const config = getOlConfig();
            const formData = new FormData();
            formData.append("file", file);

            try {
                const response = await axios.post<
                    OcrApiResponse<IUploadFlightItineraryData>
                >(`${config.baseUrl}/ocr/flight-itineraries`, formData, {
                    headers: {
                        "X-Api-Key": config.apiKey,
                        "Content-Type": "multipart/form-data",
                    },
                    timeout: REQUEST_TIMEOUT_MS,
                });
                if (isStaleGeneration(generation)) return;

                const data = response.data.data;
                setFileUrl(data.fileUrl);
                setScanState("processing");
                void checkStatus(data.requestId, 0, config, generation);
            } catch (error) {
                if (isStaleGeneration(generation)) return;
                setErrorMessage(
                    extractErrorMessage(
                        error,
                        "Failed to upload the ticket image.",
                    ),
                );
                setScanState("failed");
            }
        },
        [bumpGeneration, checkStatus, clearPoll, isStaleGeneration],
    );

    const reset = useCallback(() => {
        bumpGeneration();
        clearPoll();
        setScanState("idle");
        setFlights([]);
        setFileUrl(null);
        setErrorMessage(null);
    }, [bumpGeneration, clearPoll]);

    return { scanState, flights, fileUrl, errorMessage, scanTicketImage, reset };
}
