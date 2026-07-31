import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { getFileUploadConfig } from "@/lib/config";
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
 * (same base URL / API key as the existing image upload flow — see
 * FileUploadService) and polls the job until it completes or fails.
 */
export default function useDealFlightItineraryOcr() {
    const [scanState, setScanState] = useState<OcrScanState>("idle");
    const [flights, setFlights] = useState<IFlightItineraryEntry[]>([]);
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const cancelledRef = useRef(false);

    const clearPoll = useCallback(() => {
        if (pollTimeoutRef.current) {
            clearTimeout(pollTimeoutRef.current);
            pollTimeoutRef.current = null;
        }
    }, []);

    useEffect(() => {
        return () => {
            cancelledRef.current = true;
            clearPoll();
        };
    }, [clearPoll]);

    const checkStatus = useCallback(
        async (
            requestId: number,
            attempt: number,
            config: { baseUrl: string; apiKey: string },
        ) => {
            if (cancelledRef.current) return;

            try {
                const response = await axios.get<
                    OcrApiResponse<IFlightItineraryStatusData>
                >(`${config.baseUrl}/ocr/flight-itineraries/${requestId}`, {
                    headers: { "X-Api-Key": config.apiKey },
                });
                if (cancelledRef.current) return;

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
                    void checkStatus(requestId, attempt + 1, config);
                }, POLL_INTERVAL_MS);
            } catch (error) {
                if (cancelledRef.current) return;
                setErrorMessage(
                    extractErrorMessage(
                        error,
                        "Failed to check the scan status.",
                    ),
                );
                setScanState("failed");
            }
        },
        [],
    );

    const scanTicketImage = useCallback(
        async (file: File) => {
            cancelledRef.current = false;
            clearPoll();
            setErrorMessage(null);
            setFlights([]);
            setFileUrl(null);
            setScanState("uploading");

            const config = getFileUploadConfig();
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
                });
                if (cancelledRef.current) return;

                const data = response.data.data;
                setFileUrl(data.fileUrl);
                setScanState("processing");
                void checkStatus(data.requestId, 0, config);
            } catch (error) {
                if (cancelledRef.current) return;
                setErrorMessage(
                    extractErrorMessage(
                        error,
                        "Failed to upload the ticket image.",
                    ),
                );
                setScanState("failed");
            }
        },
        [checkStatus, clearPoll],
    );

    const reset = useCallback(() => {
        cancelledRef.current = true;
        clearPoll();
        cancelledRef.current = false;
        setScanState("idle");
        setFlights([]);
        setFileUrl(null);
        setErrorMessage(null);
    }, [clearPoll]);

    return { scanState, flights, fileUrl, errorMessage, scanTicketImage, reset };
}
