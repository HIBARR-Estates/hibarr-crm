<?php

namespace App\Http\Controllers;

use App\Models\DealAutomation;
use App\Models\DealAutomationLog;
use App\Models\EmailTemplate;
use App\Models\LeadPipeline;
use App\Models\MetaEvent;
use App\Models\PipelineStage;
use App\Models\User;
use App\Services\AutomationFieldCatalog;
use App\Support\AutomationV2Feature;
use Inertia\Inertia;

/**
 * Automation settings — a full-page section (own left sub-nav) covering
 * email templates and trigger-based automation management, reached from
 * the entity settings hub. Reads/writes the same deal_automations /
 * deal_automation_conditions / deal_automation_actions / email_templates
 * tables as the classic Blade UI (DealAutomationController /
 * EmailTemplateController) — both UIs share the same validation/model code.
 */
class AutomationSettingController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();

        $this->middleware(function ($request, $next) {
            abort_403(user()->permission('manage_company_setting') !== 'all');

            return $next($request);
        });
    }

    public function index()
    {
        abort_403(! AutomationV2Feature::enabled());

        return Inertia::render('Settings/Automation/Index', [
            'pageTitle' => __('app.menu.automation'),

            'automations' => Inertia::defer(fn () => DealAutomation::with([
                'conditions', 'actions.targetStage', 'actions.emailTemplate',
            ])->orderBy('priority')->orderBy('name')->get(), 'automation'),

            'automationStats' => Inertia::defer(fn () => DealAutomationLog::selectRaw('automation_id, COUNT(*) as runs, MAX(executed_at) as last_run_at')
                ->groupBy('automation_id')->get()->keyBy('automation_id'), 'automation'),

            'templates' => Inertia::defer(fn () => EmailTemplate::withCount('automationActions')
                ->orderBy('name')->get(), 'automation'),

            'metaEvents' => Inertia::defer(fn () => MetaEvent::allWithUsage(), 'automation'),

            'catalog' => Inertia::defer(fn () => [
                'pipelines' => LeadPipeline::all(['id', 'name']),
                'stages' => PipelineStage::all(['id', 'name', 'lead_pipeline_id']),
                'users' => User::allEmployees(null, false),
                'dealCustomFields' => AutomationFieldCatalog::dealCustomFields(),
                'leadCustomFields' => AutomationFieldCatalog::leadCustomFields(),
                ...AutomationFieldCatalog::leadLookups(),
                'hibarrFields' => AutomationFieldCatalog::HIBARR_FIELDS,
                'leadMarketingFields' => AutomationFieldCatalog::LEAD_MARKETING_FIELDS,
                'leadMarketingBooleanFields' => AutomationFieldCatalog::LEAD_MARKETING_BOOLEAN_FIELDS,
                'relatedFields' => AutomationFieldCatalog::RELATED_FIELDS,
                'leadFields' => AutomationFieldCatalog::LEAD_FIELDS,
                'leadSettableFields' => AutomationFieldCatalog::LEAD_SETTABLE_FIELDS,
                'dateFields' => AutomationFieldCatalog::DATE_FIELDS,
                'dateRecurrences' => AutomationFieldCatalog::DATE_RECURRENCES,
                'dealActionTypes' => AutomationFieldCatalog::DEAL_ACTION_TYPES,
                'leadActionTypes' => AutomationFieldCatalog::LEAD_ACTION_TYPES,
                'assignmentTypes' => AutomationFieldCatalog::ASSIGNMENT_TYPES,
                'recipientTypes' => AutomationFieldCatalog::RECIPIENT_TYPES,
                'dueDateDeltaUnits' => AutomationFieldCatalog::DUE_DATE_DELTA_UNITS,
                'waitDurationUnits' => AutomationFieldCatalog::WAIT_DURATION_UNITS,
                'ctaTargets' => AutomationFieldCatalog::CTA_TARGETS,
                'templateModes' => EmailTemplate::MODES,
            ], 'automation'),
        ]);
    }
}
