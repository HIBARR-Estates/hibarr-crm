<?php

namespace App\Exports\Sheets;

use App\Services\Reporting\DealMetricsService;
use Carbon\Carbon;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithTitle;

class DealsClosedSheet implements FromCollection, WithHeadings, WithMapping, WithTitle
{
    public function __construct(
        private DealMetricsService $service,
        private array $agentIds,
        private Carbon $start,
        private Carbon $end,
    ) {}

    public function title(): string
    {
        return 'Deals Closed';
    }

    public function collection()
    {
        return $this->service->listClosed($this->agentIds, $this->start, $this->end, 10000)->getCollection();
    }

    public function headings(): array
    {
        return ['Deal Name', 'Contact', 'Value', 'Agent', 'Won At'];
    }

    public function map($deal): array
    {
        return [
            $deal->name ?? '',
            $deal->contact?->client_name ?? '',
            $deal->value ?? '',
            $deal->leadAgent?->user?->name ?? '',
            $deal->won_at?->format('Y-m-d H:i') ?? '',
        ];
    }
}
