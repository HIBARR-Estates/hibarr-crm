<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Support\Collection;

/**
 * A company-managed Meta Conversion API event definition — name + a default
 * value — offered as a picker in a deal_automations "meta_conversion" action
 * instead of free-typing both fields every time.
 */
class MetaEvent extends BaseModel
{
    use HasCompany;
    use HasFactory;

    protected $table = 'meta_events';

    protected $fillable = [
        'company_id',
        'name',
        'value',
        'description',
    ];

    protected $casts = [
        'value' => 'float',
    ];

    /**
     * Every Meta Event, each annotated with a `using_automations` list —
     * the {id, name} of every DealAutomation with a meta_conversion action
     * referencing it by name. Shared by MetaEventController@index (JSON
     * API) and AutomationSettingController's deferred catalog load, so the
     * usage cross-reference logic lives in exactly one place.
     */
    public static function allWithUsage(): Collection
    {
        $events = self::orderBy('name')->get();
        $companyId = (int) company()->id;
        $pipelineIds = LeadPipeline::query()
            ->where('company_id', $companyId)
            ->pluck('id');

        $usageByEventName = DealAutomationAction::where('action_type', 'meta_conversion')
            ->whereNotNull('meta_event_name')
            ->whereHas('automation', function ($query) use ($pipelineIds) {
                $query->where(function ($scoped) use ($pipelineIds) {
                    $scoped->where('subject_type', DealAutomation::SUBJECT_LEAD)
                        ->orWhereIn('pipeline_id', $pipelineIds)
                        ->orWhere(function ($dealAnyPipeline) {
                            $dealAnyPipeline
                                ->where('subject_type', DealAutomation::SUBJECT_DEAL)
                                ->whereNull('pipeline_id');
                        });
                });
            })
            ->with('automation:id,name')
            ->get(['id', 'deal_automation_id', 'meta_event_name'])
            ->groupBy('meta_event_name');

        return $events->each(function (self $event) use ($usageByEventName) {
            $event->setAttribute(
                'using_automations',
                ($usageByEventName->get($event->name) ?? collect())
                    ->pluck('automation')
                    ->filter()
                    ->unique('id')
                    ->values(),
            );
        });
    }
}
