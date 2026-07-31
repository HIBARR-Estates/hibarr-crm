import { useEffect, useRef, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { IFlightItineraryEntry } from "@/Types/api/ocr";
import { formatDateWithTime } from "../../adapters/dateFormat";
import useDealFlightItineraryOcr from "../../hooks/useDealFlightItineraryOcr";
import DealButton from "../primitives/DealButton";
import DealIcon from "../primitives/DealIcon";
import {
    DEAL_REDESIGN_RADIUS as R,
    DEAL_REDESIGN_TOKENS as T,
    DEAL_REDESIGN_TYPE as TY,
} from "../../tokens";

interface DealItineraryOcrScannerProps {
    disabled?: boolean;
    /** Called with the flight the user picked (or the sole detected flight). */
    onApply: (entry: IFlightItineraryEntry, fileUrl: string | null) => void;
}

function flightSummaryLabel(entry: IFlightItineraryEntry): string {
    const parts: string[] = [];
    if (entry.flightNumber) parts.push(entry.flightNumber.toUpperCase());
    if (entry.flightType) parts.push(entry.flightType);
    if (entry.flightDateTime) parts.push(formatDateWithTime(entry.flightDateTime));
    return parts.length > 0 ? parts.join(" · ") : "Flight";
}

/**
 * Upload-a-ticket-image entry point for DealItineraryModal. Sends the image
 * to the OL flight-itinerary OCR endpoint (same host/API key as the rest of
 * the app's image uploads), polls until the job resolves, and lets the user
 * apply a detected flight onto the itinerary form.
 */
export default function DealItineraryOcrScanner({
    disabled = false,
    onApply,
}: DealItineraryOcrScannerProps) {
    const { td } = useTd();
    const inputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [appliedIndex, setAppliedIndex] = useState<number | null>(null);
    const { scanState, flights, fileUrl, errorMessage, scanTicketImage, reset } =
        useDealFlightItineraryOcr();

    const busy = scanState === "uploading" || scanState === "processing";

    // Single detected flight — apply it automatically instead of making the
    // user click a chip for the one option available.
    useEffect(() => {
        if (scanState === "completed" && flights.length === 1 && appliedIndex === null) {
            setAppliedIndex(0);
            onApply(flights[0], fileUrl);
        }
    }, [scanState, flights, appliedIndex, fileUrl, onApply]);

    const handleFile = (file: File | null | undefined) => {
        if (!file || disabled || busy) return;
        setAppliedIndex(null);
        void scanTicketImage(file);
    };

    const handleApply = (entry: IFlightItineraryEntry, index: number) => {
        setAppliedIndex(index);
        onApply(entry, fileUrl);
    };

    const handleReset = () => {
        setAppliedIndex(null);
        reset();
    };

    if (scanState === "idle") {
        return (
            <div
                role="button"
                tabIndex={disabled ? -1 : 0}
                onClick={() => !disabled && inputRef.current?.click()}
                onKeyDown={(event) => {
                    if (disabled) return;
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        inputRef.current?.click();
                    }
                }}
                onDragOver={(event) => {
                    if (disabled) return;
                    event.preventDefault();
                    setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => {
                    event.preventDefault();
                    setIsDragging(false);
                    if (disabled) return;
                    handleFile(event.dataTransfer.files?.[0]);
                }}
                className="mb-4 cursor-pointer text-center transition-colors"
                style={{
                    borderRadius: R.MD,
                    border: `2px dashed ${isDragging ? T.BLUE : T.BORDER}`,
                    background: isDragging ? T.BLUE_LIGHT : T.SURFACE_2,
                    padding: "16px 14px",
                    cursor: disabled ? "default" : "pointer",
                    opacity: disabled ? 0.6 : 1,
                }}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={disabled}
                    onChange={(event) => {
                        handleFile(event.target.files?.[0]);
                        event.target.value = "";
                    }}
                />
                <DealIcon
                    name="image"
                    size={20}
                    color={T.TEXT_HINT}
                    className="mx-auto mb-1.5 opacity-70"
                />
                <div
                    className="font-medium"
                    style={{ fontSize: TY.BODY, color: T.TEXT }}
                >
                    {td("Scan a ticket or boarding pass image")}
                </div>
                <div style={{ fontSize: TY.CAPTION, color: T.TEXT_HINT, marginTop: 2 }}>
                    {td("We'll try to fill in the flight details for you")}
                </div>
            </div>
        );
    }

    return (
        <div
            className="mb-4"
            style={{
                borderRadius: R.MD,
                border: `1px solid ${T.BORDER}`,
                background: T.SURFACE_2,
                padding: "12px 14px",
            }}
        >
            {busy && (
                <div className="flex items-center gap-2.5">
                    <span
                        className="inline-flex shrink-0 items-center justify-center"
                        style={{ width: 16, height: 16 }}
                    >
                        <span
                            className="animate-spin rounded-full border-2 border-solid"
                            style={{
                                width: "100%",
                                height: "100%",
                                borderColor: T.BLUE,
                                borderTopColor: "transparent",
                            }}
                        />
                    </span>
                    <span style={{ fontSize: TY.BODY, color: T.TEXT }}>
                        {scanState === "uploading"
                            ? td("Uploading image…")
                            : td("Scanning ticket for flight details…")}
                    </span>
                </div>
            )}

            {scanState === "failed" && (
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                        <DealIcon
                            name="info"
                            size={16}
                            color={T.RED}
                            className="mt-0.5 shrink-0"
                        />
                        <div>
                            <div
                                className="font-medium"
                                style={{ fontSize: TY.BODY, color: T.TEXT }}
                            >
                                {td("Couldn't scan that image")}
                            </div>
                            <div style={{ fontSize: TY.CAPTION, color: T.TEXT_MUTED }}>
                                {errorMessage
                                    ? td(errorMessage)
                                    : td("Please try again or fill in the details manually.")}
                            </div>
                        </div>
                    </div>
                    <DealButton variant="ghost" size="sm" onClick={handleReset}>
                        <DealIcon name="refresh" size={12} />
                        {td("Try again")}
                    </DealButton>
                </div>
            )}

            {scanState === "completed" && (
                <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <DealIcon
                                name="check"
                                size={14}
                                color={flights.length === 0 ? T.RED : T.GREEN}
                            />
                            <span
                                className="font-medium"
                                style={{
                                    fontSize: TY.BODY,
                                    color: flights.length === 0 ? T.RED : T.TEXT,
                                }}
                            >
                                {flights.length === 0
                                    ? td("No flight details found in this image")
                                    : flights.length === 1
                                      ? td("Flight details filled in below — please review")
                                      : td("We found more than one flight — pick the right one")}
                            </span>
                        </div>
                        <DealButton variant="ghost" size="sm" onClick={handleReset}>
                            <DealIcon name="refresh" size={12} />
                            {td("Scan another")}
                        </DealButton>
                    </div>

                    {flights.length > 1 && (
                        <div className="flex flex-wrap gap-1.5">
                            {flights.map((entry, index) => {
                                const selected = appliedIndex === index;
                                return (
                                    <button
                                        key={`${entry.flightNumber ?? "flight"}-${index}`}
                                        type="button"
                                        onClick={() => handleApply(entry, index)}
                                        className="font-medium"
                                        style={{
                                            fontSize: TY.CAPTION,
                                            padding: "6px 10px",
                                            borderRadius: R.FULL,
                                            border: `1px solid ${
                                                selected ? T.BLUE_MID : T.BORDER
                                            }`,
                                            background: selected
                                                ? T.BLUE_LIGHT
                                                : T.SURFACE,
                                            color: selected ? T.BLUE_DARK : T.TEXT,
                                            cursor: "pointer",
                                        }}
                                    >
                                        {flightSummaryLabel(entry)}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
