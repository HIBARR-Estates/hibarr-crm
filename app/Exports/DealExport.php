<?php

namespace App\Exports;

use App\Models\Deal;
use App\Support\DealExportFields;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class DealExport implements FromCollection, WithHeadings, WithMapping
{
    /** @var list<int> */
    protected array $dealIds;

    /** @var list<string> */
    protected array $fieldKeys;

    /**
     * @param  list<int>  $dealIds
     * @param  list<string>  $fieldKeys  Allowlisted keys in desired column order
     */
    public function __construct(array $dealIds, array $fieldKeys)
    {
        $this->dealIds = array_values(array_map('intval', $dealIds));
        $this->fieldKeys = DealExportFields::filterRequested($fieldKeys);
    }

    public function collection(): Collection
    {
        if ($this->dealIds === [] || $this->fieldKeys === []) {
            return collect();
        }

        // Preserve the resolved ID order from the bulk target.
        $order = array_flip($this->dealIds);

        $eager = [];
        foreach (DealExportFields::relationsFor($this->fieldKeys) as $relation) {
            // User::$with pulls session/clientContact — skip for export mapping.
            if ($relation === 'addedBy') {
                $eager[$relation] = static function ($query) {
                    $query->without(['session', 'clientContact'])->select('id', 'name');
                };
            } else {
                $eager[] = $relation;
            }
        }

        return Deal::query()
            ->whereIn('id', $this->dealIds)
            ->when($eager !== [], fn ($q) => $q->with($eager))
            ->get()
            ->sortBy(fn (Deal $deal) => $order[$deal->id] ?? PHP_INT_MAX)
            ->values();
    }

    public function headings(): array
    {
        return DealExportFields::headings($this->fieldKeys);
    }

    /**
     * @param  Deal  $deal
     */
    public function map($deal): array
    {
        return DealExportFields::mapDeal($deal, $this->fieldKeys);
    }
}
