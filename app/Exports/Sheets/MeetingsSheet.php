<?php

namespace App\Exports\Sheets;

use App\Services\Reporting\MeetingMetricsService;
use Carbon\Carbon;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithTitle;

class MeetingsSheet implements FromCollection, WithHeadings, WithMapping, WithTitle
{
    public function __construct(
        private MeetingMetricsService $service,
        private ?array $agentIds,
        private Carbon $start,
        private Carbon $end,
    ) {}

    public function title(): string
    {
        return 'Meetings';
    }

    public function collection()
    {
        return $this->service->list($this->agentIds, $this->start, $this->end, 10000)->getCollection();
    }

    public function headings(): array
    {
        return ['Deal', 'Meeting Type', 'Date', 'Status', 'Duration (min)', 'Remark'];
    }

    public function map($meeting): array
    {
        return [
            $meeting->deal?->name ?? '',
            $meeting->meetingType?->name ?? '',
            $meeting->next_follow_up_date?->format('Y-m-d H:i') ?? '',
            $meeting->status ?? '',
            $meeting->duration ?? '',
            $meeting->remark ?? '',
        ];
    }
}
