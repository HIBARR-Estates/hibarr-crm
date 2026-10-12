<?php

namespace App\Email\Sending;

use App\Enums\LeadContactMethodType;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\LeadContactMethod;
use Illuminate\Database\Eloquent\Model;

/**
 * The lead addresses a record-scoped send may use. A deal uses its lead.
 * Primary client_email comes first, then other email contact methods.
 */
class KnownAddresses
{
    /**
     * @return list<string> Lower-cased addresses, primary first.
     */
    public function forRecord(Model $record): array
    {
        $lead = $this->leadFor($record);

        if ($lead === null) {
            return [];
        }

        $addresses = [];
        $primary = strtolower(trim((string) $lead->client_email));

        if ($primary !== '') {
            $addresses[] = $primary;
        }

        $methods = LeadContactMethod::withoutGlobalScopes()
            ->where('lead_id', $lead->id)
            ->where('type', LeadContactMethodType::Email->value)
            ->get(['identifier', 'normalized']);

        foreach ($methods as $method) {
            $address = strtolower(trim((string) ($method->normalized ?: $method->identifier)));

            if ($address !== '') {
                $addresses[] = $address;
            }
        }

        $unique = [];

        foreach ($addresses as $address) {
            if (! in_array($address, $unique, true)) {
                $unique[] = $address;
            }
        }

        return $unique;
    }

    /**
     * @return list<array{address: string}>
     */
    public function present(Model $record): array
    {
        return array_map(
            fn (string $address) => ['address' => $address],
            $this->forRecord($record),
        );
    }

    private function leadFor(Model $record): ?Lead
    {
        if ($record instanceof Lead) {
            return $record;
        }

        if (! $record instanceof Deal || $record->lead_id === null) {
            return null;
        }

        return Lead::withoutGlobalScopes()->find($record->lead_id);
    }
}
