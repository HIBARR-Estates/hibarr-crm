/**
 * Flight itinerary OCR types.
 *
 * Mirrors the OL backend contract (hibarr-backend `src/controllers/v1/ocr/flight-itinerary.controller.ts`):
 * - POST {OL_BASE_URL}/ocr/flight-itineraries       — upload a ticket image, enqueue OCR job
 * - GET  {OL_BASE_URL}/ocr/flight-itineraries/:id   — poll job status / read extracted flights
 */

export enum GoogleVisionOcrRequestStatus {
    PROCESSING = "processing",
    COMPLETED = "completed",
    FAILED = "failed",
}

export enum FlightItineraryType {
    ARRIVAL = "Arrival",
    DEPARTURE = "Departure",
}

export interface IFlightItineraryEntry {
    /** 'Arrival' when Cyprus is the destination, 'Departure' when Cyprus is the origin. */
    flightType: FlightItineraryType | null;
    flightDateTime: string | null;
    flightNumber: string | null;
    /** Origin airport (code or name, as it appears on the ticket). */
    departureAirport: string | null;
    /** Destination airport (code or name, as it appears on the ticket). */
    arrivalAirport: string | null;
}

export interface IUploadFlightItineraryData {
    requestId: number;
    status: GoogleVisionOcrRequestStatus;
    reused: boolean;
    fileUrl: string;
}

export interface IFlightItineraryStatusData {
    requestId: number;
    status: GoogleVisionOcrRequestStatus;
    flights: IFlightItineraryEntry[];
    errorMessage: string | null;
}

export interface OcrApiResponse<T> {
    success: boolean;
    message: string;
    data: T;
}
