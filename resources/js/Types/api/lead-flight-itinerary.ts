export enum FlightDirection {
    ARRIVAL = 'arrival',
    DEPARTURE = 'departure',
}

export interface ILeadFlightItinerary {
    id?: number;
    lead_id?: number;
    deal_id?: number;
    direction: FlightDirection;       // arrival or departure
    airport_name?: string;
    flight_number?: string;
    flight_date?: string;                // date/time string of this arrival or departure
    status: string; // arrived/not arrived or for departures left/still on the island
    is_transfer_required?: boolean;
    ticket_image_url?: string;
}
