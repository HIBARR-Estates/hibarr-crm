<?php

namespace App\Services\AgentWorkspace;

use App\Models\CrmEvent;
use App\Models\Deal;
use App\Models\DealAutomation;
use App\Models\DealAutomationCondition;
use App\Models\PipelineStage;
use App\Services\ConditionEvaluatorService;
use App\Services\FieldResolverService;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * What the Deals board and list show on each deal beyond its row: how many of
 * the next stage's conditions it already meets, and when anything last
 * happened on it. Worked out for a whole page of deals at once.
 */
class DealPulse
{
    private const HIBARR_FIELDS = [
        'interested_in', 'motivation', 'purchase_timeline', 'budget_range', 'message',
        'strategy_meeting_booked', 'downpayment_paid', 'inspection_trip_date',
        'deposit_confirmation', 'reservation_agreement', 'sales_contract',
    ];

    public function __construct(
        private readonly FieldResolverService $fields,
        private readonly ConditionEvaluatorService $evaluator,
    ) {}

    /**
     * @param  Collection<int, Deal>  $deals  Open deals of one pipeline. Their
     *                                        `hibarrFields` and `contact` should
     *                                        be loaded.
     * @return array<int, array{conditions: array{met: int, total: int}, last_activity_at: string|null}>
     */
    public function forDeals(Collection $deals): array
    {
        if ($deals->isEmpty()) {
            return [];
        }

        $lastActivity = $this->lastActivity($deals->pluck('id')->map(fn ($id) => (int) $id)->all());
        $conditions = $this->conditionCounts($deals);

        return $deals->mapWithKeys(fn (Deal $deal) => [
            (int) $deal->id => [
                'conditions' => $conditions[(int) $deal->id] ?? ['met' => 0, 'total' => 0],
                'last_activity_at' => $lastActivity[(int) $deal->id] ?? null,
            ],
        ])->all();
    }

    /**
     * The newest CRM event on each deal, as an ISO time.
     *
     * @param  list<int>  $dealIds
     * @return array<int, string>
     */
    private function lastActivity(array $dealIds): array
    {
        return CrmEvent::query()
            ->where('model_type', Deal::class)
            ->whereIn('model_id', $dealIds)
            ->selectRaw('model_id, MAX(occurred_at) as last_at')
            ->groupBy('model_id')
            ->pluck('last_at', 'model_id')
            ->map(fn ($at) => Carbon::parse($at, config('app.timezone'))->toIso8601String())
            ->mapWithKeys(fn ($at, $id) => [(int) $id => $at])
            ->all();
    }

    /**
     * Met and total conditions of the stage each deal would move to next:
     * the stage-transition automations that lead there, checked the way the
     * deal page's requirements tooltip checks them.
     *
     * @param  Collection<int, Deal>  $deals
     * @return array<int, array{met: int, total: int}>
     */
    private function conditionCounts(Collection $deals): array
    {
        $byStage = $this->requirementsByTargetStage();
        if ($byStage === []) {
            return [];
        }

        $pipelineIds = $deals->pluck('lead_pipeline_id')->unique()->filter()->all();
        $nextStage = [];
        PipelineStage::query()
            ->whereIn('lead_pipeline_id', $pipelineIds)
            ->orderBy('priority')
            ->get(['id', 'lead_pipeline_id', 'priority'])
            ->groupBy('lead_pipeline_id')
            ->each(function (Collection $stages) use (&$nextStage) {
                $ids = $stages->pluck('id')->map(fn ($id) => (int) $id)->values();
                foreach ($ids as $index => $id) {
                    if ($ids->has($index + 1)) {
                        $nextStage[$id] = $ids[$index + 1];
                    }
                }
            });

        $customValues = $this->customFieldValues($deals, $byStage, $nextStage);

        $counts = [];
        foreach ($deals as $deal) {
            $target = $nextStage[(int) $deal->pipeline_stage_id] ?? null;
            $list = $target ? ($byStage[$target] ?? []) : [];
            $met = 0;
            foreach ($list as $condition) {
                if ($this->met($deal, $condition, $customValues)) {
                    $met++;
                }
            }
            $counts[(int) $deal->id] = ['met' => $met, 'total' => count($list)];
        }

        return $counts;
    }

    /**
     * Every active automation's conditions, grouped under the stage its
     * stage-transition action moves a deal to (the deal page's own grouping).
     *
     * @return array<int, list<DealAutomationCondition>>
     */
    private function requirementsByTargetStage(): array
    {
        $byStage = [];
        DealAutomation::query()
            ->where('active', true)
            ->with(['conditions', 'actions'])
            ->get()
            ->each(function (DealAutomation $automation) use (&$byStage) {
                if ($automation->conditions->isEmpty()) {
                    return;
                }
                foreach ($automation->actions as $action) {
                    if (($action->action_type ?? 'stage_transition') !== 'stage_transition' || ! $action->target_stage_id) {
                        continue;
                    }
                    foreach ($automation->conditions as $condition) {
                        $byStage[(int) $action->target_stage_id][] = $condition;
                    }
                }
            });

        return $byStage;
    }

    /**
     * The custom-field values the conditions look at, for every deal in one
     * query rather than one per deal and condition.
     *
     * @param  array<int, list<DealAutomationCondition>>  $byStage
     * @param  array<int, int>  $nextStage
     * @return array<string, mixed> keyed "dealId:fieldId"
     */
    private function customFieldValues(Collection $deals, array $byStage, array $nextStage): array
    {
        $fieldIds = [];
        foreach ($deals as $deal) {
            $target = $nextStage[(int) $deal->pipeline_stage_id] ?? null;
            foreach ($target ? ($byStage[$target] ?? []) : [] as $condition) {
                if (Str::startsWith((string) $condition->field, 'custom_field_')) {
                    $fieldIds[(int) Str::after($condition->field, 'custom_field_')] = true;
                }
            }
        }
        unset($fieldIds[0]);
        if ($fieldIds === []) {
            return [];
        }

        $values = [];
        DB::table('custom_fields_data')
            ->where('model', Deal::CUSTOM_FIELD_MODEL)
            ->whereIn('model_id', $deals->pluck('id'))
            ->whereIn('custom_field_id', array_keys($fieldIds))
            ->get(['model_id', 'custom_field_id', 'value'])
            ->each(function ($row) use (&$values) {
                $values[$row->model_id.':'.$row->custom_field_id] = $this->decodeList($row->value);
            });

        return $values;
    }

    /** Multi-select custom fields are stored as a JSON list; the evaluator wants the list itself. */
    private function decodeList(mixed $value): mixed
    {
        if (! is_string($value) || ! str_starts_with(ltrim($value), '[')) {
            return $value;
        }
        $decoded = json_decode($value, true);

        return is_array($decoded) ? $decoded : $value;
    }

    /** @param array<string, mixed> $customValues */
    private function met(Deal $deal, DealAutomationCondition $condition, array $customValues): bool
    {
        $field = (string) $condition->field;

        if (Str::startsWith($field, 'custom_field_')) {
            $resolved = $customValues[$deal->id.':'.(int) Str::after($field, 'custom_field_')] ?? null;
        } elseif (in_array($field, self::HIBARR_FIELDS, true)) {
            $resolved = $deal->hibarrFields?->{$field};
        } else {
            $resolved = $this->fields->resolve($deal, $field);
        }

        return $this->evaluator->evaluate($resolved, $condition);
    }
}
