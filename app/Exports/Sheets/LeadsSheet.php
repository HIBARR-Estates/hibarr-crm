<?php

namespace App\Exports\Sheets;

use App\Services\Reporting\LeadMetricsService;
use Carbon\Carbon;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithTitle;

class LeadsSheet implements FromCollection, WithHeadings, WithMapping, WithTitle
{
    public function __construct(
        private LeadMetricsService $service,
        private array $agentIds,
        private Carbon $start,
        private Carbon $end,
    ) {}

    public function title(): string
    {
        return 'Leads';
    }

    public function collection()
    {
        return $this->service->list($this->agentIds, $this->start, $this->end, 10000)->getCollection();
    }

    public function headings(): array
    {
        return ['Name', 'Email', 'Source', 'Created At'];
    }

    public function map($lead): array
    {
        return [
            $lead->client_name ?? $lead['client_name'] ?? '',
            $lead->client_email ?? $lead['client_email'] ?? '',
            $lead->leadSource?->type ?? '',
            $lead->created_at?->format('Y-m-d H:i') ?? '',
        ];
    }
}
