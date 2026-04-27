<?php

namespace App\Exports;

use App\Services\Reporting\ReportingService;
use Carbon\Carbon;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

class AgentReportExport implements WithMultipleSheets
{
    public function __construct(
        private ReportingService $reportingService,
        private ?array $agentIds,
        private Carbon $start,
        private Carbon $end,
    ) {}

    public function sheets(): array
    {
        return [
            'Leads' => new Sheets\LeadsSheet($this->reportingService->leadMetrics(), $this->agentIds, $this->start, $this->end),
            'Deals Created' => new Sheets\DealsCreatedSheet($this->reportingService->dealMetrics(), $this->agentIds, $this->start, $this->end),
            'Deals Closed' => new Sheets\DealsClosedSheet($this->reportingService->dealMetrics(), $this->agentIds, $this->start, $this->end),
            'Meetings' => new Sheets\MeetingsSheet($this->reportingService->meetingMetrics(), $this->agentIds, $this->start, $this->end),
        ];
    }
}
