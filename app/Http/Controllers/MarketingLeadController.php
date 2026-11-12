<?php

namespace App\Http\Controllers;

use App\Http\Requests\Lead\StoreMarketingLeadRequest;
use App\Models\Lead;
use App\Models\LeadCategory;
use App\Models\LeadNote;
use App\Models\LeadSource;
use App\Services\FormDataService;
use App\Services\LeadAutomationService;
use App\Services\LeadCoreFieldsService;
use App\Services\LeadService;
use App\Services\LeadUtmService;
use App\Support\MarketingLeadIntake;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/**
 * The marketing lead flow: a multi-step modal for members of the departments
 * picked in Lead settings. Every lead saved here gets the configured origin
 * (Marketing by default); the person entering it never sees or sets it.
 * The lead owner defaults to the one picked in settings and can be changed
 * per lead; UTM values entered here become the lead's first touch.
 */
class MarketingLeadController extends AccountBaseController
{
    /** utm field => form-data type with the values leads already use, most used first. */
    private const UTM_SUGGESTION_TYPES = [
        'utm_source' => 'lead-utm-sources',
        'utm_medium' => 'lead-utm-mediums',
        'utm_campaign' => 'lead-utm-campaigns',
        'utm_content' => 'lead-utm-contents',
        'utm_term' => 'lead-utm-terms',
        'utm_audience' => 'lead-utm-audiences',
    ];

    public function __construct(
        private readonly LeadCoreFieldsService $coreFieldsService,
    ) {
        parent::__construct();
        $this->pageTitle = 'pages.marketing_leads.page_title';
        $this->middleware(function ($request, $next) {
            abort_403(! MarketingLeadIntake::allows(user()));

            return $next($request);
        });
    }

    /** A plain landing page so people without the leads list still reach the flow. */
    public function page()
    {
        return Inertia::render('MarketingLeads/Index', [
            'pageTitle' => __('pages.marketing_leads.page_title'),
        ]);
    }

    /**
     * Everything the modal's steps need, in one request made when it opens
     * (never on first paint of the page that hosts it).
     */
    public function options(Request $request, FormDataService $formData): JsonResponse
    {
        $customFields = app(LeadService::class)->getLeadCustomFieldsData();

        return response()->json([
            'status' => 'success',
            'salutations' => $formData->getData('salutations', $request)->values(),
            'genders' => $formData->getData('genders', $request)->values(),
            'temperatures' => $formData->getData('temperatures', $request)->values(),
            'preferredContactTimes' => $formData->getData('preferred-contact-times', $request)->values(),
            'ageRanges' => $formData->getData('age-ranges', $request)->values(),
            'languages' => $formData->getData('languages', $request)->values(),
            'countries' => collect(countries())
                ->map(fn ($country) => [
                    'iso' => $country['iso'] ?? null,
                    'nicename' => $country['nicename'] ?? null,
                    'phonecode' => $country['phonecode'] ?? null,
                ])
                ->values(),
            'sources' => LeadSource::query()->get(['id', 'type'])->values(),
            'categories' => LeadCategory::query()->orderBy('category_name')->get(['id', 'category_name'])->values(),
            'customFields' => collect($customFields['customFields'] ?? [])->values(),
            'customFieldCategories' => collect($customFields['customFieldCategories'] ?? [])->values(),
            'owners' => MarketingLeadIntake::ownerOptions(),
            'defaultOwnerId' => MarketingLeadIntake::ownerId(),
            'utmSuggestions' => collect(self::UTM_SUGGESTION_TYPES)
                ->map(fn (string $type) => $formData->getData($type, $request)
                    ->pluck('value')
                    ->filter(fn ($value) => is_string($value) && $value !== '')
                    ->take(50)
                    ->values())
                ->all(),
        ]);
    }

    public function store(StoreMarketingLeadRequest $request): JsonResponse
    {
        $companyId = (int) company()->id;

        $lead = DB::transaction(function () use ($request, $companyId) {
            $lead = new Lead;
            $lead->company_id = $companyId;
            // Stamped before the first save, so lead_created automations can
            // already condition on it.
            $lead->lead_origin_id = MarketingLeadIntake::originId($companyId);
            // Validated against the people who can own leads; empty = no owner.
            $lead->lead_owner = $request->filled('lead_owner') ? (int) $request->lead_owner : null;
            $lead->salutation = $request->salutation ?: null;
            $lead->client_name = trim((string) $request->client_name);
            $lead->client_email = $request->client_email ?: null;
            $lead->gender = $request->gender ?: null;
            $lead->temperature = $request->temperature ?: null;
            $lead->company_name = $request->company_name;
            $lead->website = $request->website;
            $lead->address = $request->address;
            $lead->cell = $request->cell;
            $lead->office = $request->office;
            $lead->city = $request->city;
            $lead->state = $request->state;
            $lead->country = $request->country;
            $lead->postal_code = $request->postal_code;
            $lead->source_id = $request->source_id ?: null;
            $lead->mobile = $this->normalizeMobile($request->input('mobile'));

            if ($request->has('preferred_contact_times')) {
                $lead->syncPreferredContactTimes($request->input('preferred_contact_times', []));
            }

            $this->coreFieldsService->write($lead, $request->only([
                'languages', 'date_of_birth', 'age', 'age_range', 'nationality', 'occupation',
            ]));

            $lead->save();

            $categoryIds = $request->input('category_ids');
            if (is_array($categoryIds) && $categoryIds !== []) {
                $lead->syncCategories($categoryIds);
            }

            if (is_array($request->custom_fields_data) && $request->custom_fields_data !== []) {
                $filtered = $this->coreFieldsService->filterCustomFieldsFromPayload(
                    ['custom_fields_data' => $request->custom_fields_data],
                    $companyId,
                );
                $lead->updateCustomFieldData($filtered['custom_fields_data'] ?? []);
            }

            // Entered on creation, so this is the lead's first UTM touch.
            app(LeadUtmService::class)->record($lead, (array) $request->input('utm', []), 'marketing_flow');

            foreach ((array) $request->input('notes', []) as $entry) {
                $details = trim((string) ($entry['details'] ?? ''));
                if ($details === '') {
                    continue;
                }

                $note = new LeadNote;
                $note->lead_id = $lead->id;
                $note->title = filled($entry['title'] ?? null) ? (string) $entry['title'] : null;
                $note->details = $details;
                $note->type = 0; // public
                $note->ask_password = '';
                $note->save();
            }

            return $lead;
        });

        if (is_array($request->custom_fields_data) && $request->custom_fields_data !== []) {
            app(LeadAutomationService::class)->process($lead, 'custom_field_updated');
        }

        app(\App\Services\Reminders\LeadReminderSync::class)->syncFromLead($lead->fresh());
        $this->logSearchEntry($lead->id, $lead->client_name, 'lead-contact.show', 'lead');

        return response()->json([
            'status' => 'success',
            'message' => __('messages.leadSaved'),
            'lead' => [
                'id' => (int) $lead->id,
                'client_name' => (string) $lead->client_name,
                'client_email' => $lead->client_email,
                'url' => route('lead-contact.show', $lead->id),
            ],
        ]);
    }

    /**
     * The modal sends {countryCode, areaCode, phoneNumber, isoCode}, the same
     * shape antd-phone-input writes from the regular lead form, which the
     * rest of the app already reads (Lead::getMobileAttribute, search, export).
     */
    private function normalizeMobile(mixed $mobile): ?string
    {
        if (is_array($mobile)) {
            $number = preg_replace('/\D+/', '', (string) ($mobile['phoneNumber'] ?? ''));
            if ($number === '') {
                return null;
            }

            $countryCode = (int) ($mobile['countryCode'] ?? 0);
            if ($countryCode <= 0) {
                return $number;
            }

            return json_encode([
                'countryCode' => $countryCode,
                'areaCode' => (string) ($mobile['areaCode'] ?? ''),
                'phoneNumber' => $number,
                'isoCode' => isset($mobile['isoCode']) ? strtolower((string) $mobile['isoCode']) : null,
            ]);
        }

        $mobile = trim((string) $mobile);

        return $mobile === '' ? null : $mobile;
    }
}
