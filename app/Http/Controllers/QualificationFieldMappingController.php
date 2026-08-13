<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\QualificationFieldMapping;
use App\Models\QualificationScriptSetting;
use App\Services\Qualification\LeadFieldCatalog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * Qualification script field mapping (settings page + its read/write endpoints).
 *
 * Reading a mapping is open to anyone who can see leads — the qualification tab
 * uses it to label which answers reach the lead. Editing needs
 * `manage_qualification_mapping`.
 */
class QualificationFieldMappingController extends AccountBaseController
{
    public function __construct(private LeadFieldCatalog $catalog)
    {
        parent::__construct();

        $this->pageTitle = 'Qualification script field mapping';

        $this->middleware(function ($request, $next) {
            if (! in_array('leads', user_modules())) {
                abort_403(true);
            }

            return $next($request);
        });
    }

    /** The settings page itself — write-gated. */
    public function index()
    {
        $this->assertCanManage();

        return Inertia::render('Leads/QualificationMapping/Index', [
            'pageTitle' => $this->pageTitle,
            'leadFields' => $this->catalog->fields((int) company()->id),
            'writeModes' => [
                ['value' => QualificationFieldMapping::MODE_FILL_EMPTY, 'label' => 'Only if empty'],
                ['value' => QualificationFieldMapping::MODE_OVERWRITE, 'label' => 'Always overwrite'],
            ],
        ]);
    }

    /** Saved mapping for one script. Readable by anyone with lead access. */
    public function show(string $templateId)
    {
        $setting = $this->settingFor($templateId);
        $fields = $this->catalog->fieldsByKey((int) company()->id);

        return Reply::dataOnly([
            'template_id' => $templateId,
            'auto_write' => $setting?->auto_write ?? true,
            'mappings' => $setting
                ? $setting->mappings->map(fn (QualificationFieldMapping $mapping) => [
                    'segment_key' => $mapping->segment_key,
                    'lead_field' => $mapping->lead_field,
                    // Resolved here so callers never have to decode `custom_field_<id>`.
                    'lead_field_label' => $fields[$mapping->lead_field]['label'] ?? $mapping->lead_field,
                    'write_mode' => $mapping->write_mode,
                    'option_map' => $mapping->option_map ?? new \stdClass,
                ])->values()
                : [],
        ]);
    }

    public function update(Request $request, string $templateId)
    {
        $this->assertCanManage();

        $allowedFields = array_keys($this->catalog->fieldsByKey((int) company()->id));

        $validated = $request->validate([
            'template_name' => ['nullable', 'string', 'max:255'],
            'auto_write' => ['required', 'boolean'],
            'mappings' => ['present', 'array'],
            'mappings.*.segment_key' => ['required', 'string', 'max:191'],
            'mappings.*.lead_field' => ['nullable', 'string', Rule::in($allowedFields)],
            'mappings.*.write_mode' => ['nullable', Rule::in(QualificationFieldMapping::WRITE_MODES)],
            'mappings.*.option_map' => ['nullable', 'array'],
            'mappings.*.option_map.*' => ['nullable', 'string', 'max:255'],
        ]);

        DB::transaction(function () use ($templateId, $validated) {
            $setting = QualificationScriptSetting::updateOrCreate(
                ['company_id' => company()->id, 'template_id' => $templateId],
                [
                    'template_name' => $validated['template_name'] ?? null,
                    'auto_write' => $validated['auto_write'],
                ]
            );

            $keptKeys = [];

            foreach ($validated['mappings'] as $row) {
                // A row with no target field carries no mapping — drop it rather
                // than storing an empty placeholder.
                if (blank($row['lead_field'] ?? null)) {
                    continue;
                }

                $keptKeys[] = $row['segment_key'];

                QualificationFieldMapping::updateOrCreate(
                    ['script_setting_id' => $setting->id, 'segment_key' => $row['segment_key']],
                    [
                        'lead_field' => $row['lead_field'],
                        'write_mode' => $row['write_mode'] ?? QualificationFieldMapping::MODE_FILL_EMPTY,
                        'option_map' => array_filter($row['option_map'] ?? [], fn ($value) => filled($value)),
                    ]
                );
            }

            QualificationFieldMapping::where('script_setting_id', $setting->id)
                ->whereNotIn('segment_key', $keptKeys ?: [''])
                ->delete();
        });

        return Reply::success(__('messages.updateSuccess'));
    }

    private function settingFor(string $templateId): ?QualificationScriptSetting
    {
        return QualificationScriptSetting::where('template_id', $templateId)
            ->with('mappings')
            ->first();
    }

    private function assertCanManage(): void
    {
        abort_403(user()->permission('manage_qualification_mapping') !== 'all');
    }
}
