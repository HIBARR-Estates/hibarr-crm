<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\EmailTemplate;
use App\Services\AutomationFieldCatalog;
use App\Services\Notifications\UnsClient;
use App\Support\AutomationV2Feature;
use Illuminate\Http\Request;

class EmailTemplateController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'app.menu.emailTemplates';
        $this->activeSettingMenu = 'email_templates';
        $this->middleware(function ($request, $next) {
            abort_403(! AutomationV2Feature::enabled());

            return user()->permission('manage_company_setting') !== 'all' ? redirect()->route('profile-settings.index') : $next($request);
        });
    }

    public function index(Request $request)
    {
        $templates = EmailTemplate::withCount('automationActions')->orderBy('name')->get();

        if ($request->wantsJson() || $request->expectsJson()) {
            return Reply::dataOnly(['status' => 'success', 'data' => $templates]);
        }

        $this->templates = $templates;

        return view('company-settings.email-templates', $this->data);
    }

    public function create()
    {
        $this->template = new EmailTemplate;
        $this->shareFieldCatalog();

        return view('company-settings.email-template.edit', $this->data);
    }

    /**
     * Same "new template" form as create(), rendered as a bare fragment
     * (no sidebar/page chrome) for the "Add New" popup on the index page —
     * loaded into a modal via $.ajaxModal-style AJAX rather than navigated to.
     */
    public function createModal()
    {
        $this->template = new EmailTemplate;
        $this->shareFieldCatalog();

        return view('company-settings.email-template.ajax.create', $this->data);
    }

    public function store(Request $request)
    {
        $request->validate($this->validationRules());

        $template = EmailTemplate::create([
            'company_id' => company()->id,
            'name' => $request->name,
            'mode' => $request->mode === EmailTemplate::MODE_PLUNK_BODY ? EmailTemplate::MODE_PLUNK_BODY : EmailTemplate::MODE_CUSTOM,
            'subject' => $request->subject,
            'preheader' => $request->preheader ?: null,
            'body' => $request->body,
            'plunk_template_id' => $request->plunk_template_id ?: null,
            'variable_mappings' => $this->parseVariableMappings($request),
        ]);

        if ($request->wantsJson() || $request->expectsJson()) {
            return Reply::successWithData(__('messages.recordSaved'), ['data' => $template]);
        }

        return Reply::redirect(route('email-templates.index'), __('messages.recordSaved'));
    }

    public function edit($id)
    {
        $this->template = $this->findCompanyTemplate($id);
        $this->shareFieldCatalog();

        return view('company-settings.email-template.edit', $this->data);
    }

    public function update(Request $request, $id)
    {
        $template = $this->findCompanyTemplate($id);

        $request->validate($this->validationRules());

        $template->update([
            'name' => $request->name,
            'mode' => $request->mode === EmailTemplate::MODE_PLUNK_BODY ? EmailTemplate::MODE_PLUNK_BODY : EmailTemplate::MODE_CUSTOM,
            'subject' => $request->subject,
            'preheader' => $request->preheader ?: null,
            'body' => $request->body,
            'plunk_template_id' => $request->plunk_template_id ?: null,
            'variable_mappings' => $this->parseVariableMappings($request),
        ]);

        if ($request->wantsJson() || $request->expectsJson()) {
            return Reply::successWithData(__('messages.updateSuccess'), ['data' => $template]);
        }

        return Reply::redirect(route('email-templates.index'), __('messages.updateSuccess'));
    }

    public function destroy($id)
    {
        $this->findCompanyTemplate($id)->delete();

        return Reply::success(__('messages.deleteSuccess'));
    }

    /**
     * Live preview: renders the actual mail.deal-automation-template view with
     * the currently-typed (unsaved) Subject/Body/Preheader so what you see
     * matches exactly what a real send would produce — merge tags are shown
     * literally (unresolved) since there's no specific Deal/Lead here to
     * resolve them against.
     */
    public function preview(Request $request)
    {
        $request->validate([
            'template_id' => 'nullable|exists:email_templates,id',
            'subject' => 'nullable|string|max:255',
            'preheader' => 'nullable|string|max:255',
            'body' => 'nullable|string',
            'mode' => 'nullable|string|in:custom,plunk_body',
        ]);

        if ($request->filled('template_id')) {
            $template = $this->findCompanyTemplate($request->template_id);
            $subject = $template->subject;
            $preheader = $template->preheader;
            $body = (string) ($template->body ?? '');
            $mode = $template->mode;
        } else {
            $subject = (string) $request->input('subject', '');
            $preheader = $request->input('preheader');
            $body = (string) $request->input('body', '');
            $mode = $request->input('mode', EmailTemplate::MODE_CUSTOM);
        }

        $html = EmailTemplate::renderPreviewHtml($body, $subject, $preheader, $mode, resolveSamples: true);

        return response()->json([
            'status' => 'success',
            'html' => $html,
            'subject' => $subject,
        ]);
    }

    /**
     * Plunk templates known to UNS (v1/email/templates), for the "pick a
     * template" dropdown next to the raw Plunk Template ID field. Never
     * fails the request — UnsClient::listEmailTemplates() returns [] on any
     * error, so the UI just falls back to manual ID entry.
     */
    public function plunkTemplates(UnsClient $unsClient)
    {
        return Reply::dataOnly([
            'status' => 'success',
            'templates' => $unsClient->listEmailTemplates(),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    protected function validationRules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'mode' => 'required|string|in:custom,plunk_body',
            'subject' => 'required|string|max:255',
            'preheader' => 'nullable|string|max:255',
            'body' => 'required|string',
            'plunk_template_id' => 'required_if:mode,plunk_body|nullable|string|max:191',
        ];
    }

    /**
     * Field lists for the "Body/Subject merge tags" reference and the
     * Variable Mappings CRM-field dropdown — same catalog the deal
     * automation condition builder uses, so both stay in sync.
     */
    protected function shareFieldCatalog(): void
    {
        $this->hibarrFields = AutomationFieldCatalog::HIBARR_FIELDS;
        $this->relatedFields = AutomationFieldCatalog::RELATED_FIELDS;
        $this->leadFields = AutomationFieldCatalog::LEAD_FIELDS;
        $this->leadMarketingFields = AutomationFieldCatalog::LEAD_MARKETING_FIELDS;
        $this->customFields = AutomationFieldCatalog::dealCustomFields();
        $this->leadCustomFields = AutomationFieldCatalog::leadCustomFields();
        $this->ctaTargets = AutomationFieldCatalog::CTA_TARGETS;
        $this->templateModes = EmailTemplate::MODES;
    }

    /**
     * Normalize the variable_mappings[] rows submitted from the form.
     * Each row is either:
     *   ['variable' => ..., 'type' => 'field', 'field' => ...]
     *   ['variable' => ..., 'type' => 'cta_url', 'cta_target' => ..., 'cta_custom_url' => ?...]
     * Incomplete rows (no variable name, or a 'field' type with no field
     * selected) are dropped.
     *
     * @return array<int, array<string, mixed>>
     */
    protected function parseVariableMappings(Request $request): array
    {
        $mappings = [];

        foreach ($request->input('variable_mappings', []) as $row) {
            $variable = trim((string) ($row['variable'] ?? ''));

            if ($variable === '') {
                continue;
            }

            if (($row['type'] ?? 'field') === 'cta_url') {
                $ctaTarget = array_key_exists($row['cta_target'] ?? '', AutomationFieldCatalog::CTA_TARGETS)
                    ? $row['cta_target']
                    : 'record';

                $mappings[] = [
                    'variable' => $variable,
                    'type' => 'cta_url',
                    'cta_target' => $ctaTarget,
                    'cta_custom_url' => $ctaTarget === 'custom' ? trim((string) ($row['cta_custom_url'] ?? '')) : null,
                ];

                continue;
            }

            $field = trim((string) ($row['field'] ?? ''));

            if ($field !== '') {
                $mappings[] = ['variable' => $variable, 'type' => 'field', 'field' => $field];
            }
        }

        return $mappings;
    }

    protected function findCompanyTemplate(int|string $id): EmailTemplate
    {
        return EmailTemplate::where('company_id', company()->id)->findOrFail($id);
    }
}
