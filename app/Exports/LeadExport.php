<?php

namespace App\Exports;

use App\Models\Lead;
use App\Support\LeadExportFields;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class LeadExport implements FromCollection, WithHeadings, WithMapping
{
    /** @var list<int> */
    protected array $leadIds;

    /** @var list<string> */
    protected array $fieldKeys;

    /**
     * @param  list<int>  $leadIds
     * @param  list<string>  $fieldKeys  Allowlisted keys in desired column order
     */
    public function __construct(array $leadIds, array $fieldKeys)
    {
        $this->leadIds = array_values(array_map('intval', $leadIds));
        $this->fieldKeys = LeadExportFields::filterRequested($fieldKeys);
    }

    public function collection(): Collection
    {
        if ($this->leadIds === [] || $this->fieldKeys === []) {
            return collect();
        }

        $relations = LeadExportFields::relationsFor($this->fieldKeys);

        // Preserve the resolved ID order from the bulk target.
        $order = array_flip($this->leadIds);

        $eager = [];
        foreach ($relations as $relation) {
            // User::$with pulls session/clientContact — skip for export mapping.
            if (in_array($relation, ['leadOwner', 'addedBy'], true)) {
                $eager[$relation] = static function ($query) {
                    $query->without(['session', 'clientContact'])->select('id', 'name');
                };
            } else {
                $eager[] = $relation;
            }
        }

        return Lead::query()
            ->whereIn('id', $this->leadIds)
            ->when($eager !== [], fn ($q) => $q->with($eager))
            ->get()
            ->sortBy(fn (Lead $lead) => $order[$lead->id] ?? PHP_INT_MAX)
            ->values();
    }

    public function headings(): array
    {
        return LeadExportFields::headings($this->fieldKeys);
    }

    /**
     * @param  Lead  $lead
     */
    public function map($lead): array
    {
        return LeadExportFields::mapLead($lead, $this->fieldKeys);
    }
}
