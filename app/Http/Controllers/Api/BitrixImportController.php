<?php

namespace App\Http\Controllers\Api;

use App\Helper\Reply;
use App\Http\Controllers\Controller;
use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Models\EmployeeDetails;
use App\Models\HibarrDealFields;
use App\Models\Lead;
use App\Models\LeadAgent;
use App\Models\LeadMarketing;
use App\Models\LeadPipeline;
use App\Models\PipelineStage;
use App\Models\Role;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class BitrixImportController extends Controller
{
    public function store(Request $request)
    {
        $payload = $request->all();

        $dealData = Arr::get($payload, 'deal', []);
        $contactData = Arr::get($payload, 'contact', []);
        $responsibleData = Arr::get($payload, 'responsiblePerson', []);

        $dealName = trim((string) Arr::get($dealData, 'dealName'));
        if ($dealName === '') {
            return Reply::error('Deal name is required.');
        }

        $companyId = 1;

        try {
            $result = DB::transaction(function () use ($dealData, $contactData, $responsibleData, $dealName, $companyId) {
                // Ensure responsible user exists
                $responsibleUser = $this->resolveResponsibleUser($responsibleData, $companyId);

                if ($responsibleUser) {
                    auth()->setUser($responsibleUser);
                }

                // Create or update contact
                $lead = $this->upsertLead($contactData, $companyId, $responsibleUser);

                // Resolve pipeline and stage
                [$pipeline, $stage] = $this->resolvePipelineAndStage($dealData, $companyId);

                if (!$stage) {
                    throw new \RuntimeException('No matching pipeline stage could be resolved for the payload.');
                }
                $bitrixId = $this->toInt(Arr::get($dealData, 'bitrixId'));

                // Create or update deal
                // Use bitrix_id for lookup if provided, otherwise fallback to name-based lookup
                $dealQuery = Deal::withoutGlobalScopes()
                    ->where('company_id', $companyId);
                
                if ($bitrixId !== null) {
                    $dealQuery->where('bitrix_id', $bitrixId);
                } else {
                    
                }
                
                $deal = $dealQuery->first();

                $isNewDeal = false;
                if (!$deal) {
                    $deal = new Deal();
                    $deal->company_id = $companyId;
                    if ($bitrixId !== null) {
                        $deal->bitrix_id = $bitrixId;
                    }
                    $deal->name = $dealName;
                    $deal->column_priority = 0;
                    $deal->value = 0;
                    $isNewDeal = true;
                    
                    // Set created_at from payload if provided
                    if ($createdDate = $this->parseDate(Arr::get($dealData, 'createdDate'))) {
                        $deal->created_at = $createdDate;
                    }
                }

                $deal->lead_id = $lead->id;

                $dealValue = $this->toFloat(Arr::get($dealData, 'dealValue'))
                    ?? $this->toFloat(Arr::get($dealData, 'amountPaid'))
                    ?? $this->toFloat(Arr::get($dealData, 'customerBudget'));
                if ($dealValue !== null) {
                    $deal->value = $dealValue;
                }

                $deal->lead_pipeline_id = $stage->lead_pipeline_id;
                $deal->pipeline_stage_id = $stage->id;

                if ($responsibleUser) {
                    $leadAgent = LeadAgent::withoutGlobalScopes()
                        ->firstOrCreate(
                            [
                                'company_id' => $companyId,
                                'user_id' => $responsibleUser->id,
                            ],
                            [
                                'status' => 'enabled',
                            ]
                        );

                    $deal->agent_id = $leadAgent->id;
                }

                if ($date = $this->parseDate(Arr::get($dealData, 'kickoffMeetingDate'))) {
                    $deal->close_date = $date;
                }

                $note = $this->buildDealNotes($deal, $dealData, $contactData);
                if ($note !== null) {
                    $deal->note = $note;
                }

                // Use saveQuietly to prevent DealObserver from triggering automation
                // This ensures the deal stays at the stage specified in the payload
                $deal->saveQuietly();

                if ($responsibleUser) {
                    try {
                        $deal->dealWatchers()->syncWithoutDetaching([$responsibleUser->id]);
                    } catch (\Exception $e) {
                        // Log but don't fail the import if watcher sync fails
                        Log::warning('Bitrix import: Failed to sync deal watchers', [
                            'deal_id' => $deal->id,
                            'user_id' => $responsibleUser->id,
                        ]);
                    }
                }

                $this->scheduleFollowUpIfNeeded($deal, Arr::get($dealData, 'nextMeeting'));

                $this->upsertHibarrFields($deal, $dealData);

                return [
                    'deal' => $deal,
                    'lead' => $lead,
                    'responsible_user' => $responsibleUser,
                    'is_new_deal' => $isNewDeal,
                ];
            });
        } catch (Throwable $e) {
            $this->logoutIfAuthenticated();

            return $this->handleBitrixImportFailure($e, $payload);
        }

        $this->logoutIfAuthenticated();

        return Reply::successWithData('Bitrix deal synced successfully.', [
            'deal_id' => $result['deal']->id,
            'contact_id' => $result['lead']->id,
            'responsible_user_id' => optional($result['responsible_user'])->id,
            'is_new_deal' => $result['is_new_deal'],
        ]);
    }

    public function contactStore(Request $request)
    {
        $companyId = $request->header('X-COMPANY-ID');
        $responsible = Arr::get($request->all(), 'responsible', []);
        
        try {
            $result = DB::transaction(function () use ($request, $companyId, $responsible) {
                // Ensure responsible user exists (inside transaction for rollback consistency)
                $responsibleUser = $this->resolveResponsibleUser($responsible, $companyId);
                
                if ($responsibleUser) {
                    auth()->setUser($responsibleUser);
                }
                
                $lead = $this->upsertLead($request->all(), $companyId, $responsibleUser);
                
                if ($responsibleUser) {
                    $lead->added_by = $responsibleUser->id;
                    $lead->saveQuietly();
                }
                
                return $lead;
            });
        } catch (\Exception $e) {
            $this->logoutIfAuthenticated();
            
            Log::error('Bitrix import: Failed to upsert lead', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request' => $request->all(),
            ]);
            
            return Reply::error('Contact Creation Failed.');
        }
        
        $this->logoutIfAuthenticated();
        
        return Reply::success('Contact synced successfully.');
    }

    private function resolveResponsibleUser(array $responsibleData, int $companyId): ?User
    {
        $email = trim((string) Arr::get($responsibleData, 'email'));
        $name = trim((string) Arr::get($responsibleData, 'name'));

        if ($email === '') {
            return null;
        }

        $user = User::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('email', $email)
            ->first();

        if ($user) {
            return $user;
        }

        $password = Str::random(16);

        $user = new User();
        $user->company_id = $companyId;
        $user->email = $email;
        $user->name = $name !== '' ? $name : Str::before($email, '@');
        $user->password = Hash::make($password);
        $user->status = 'active';
        $user->save();

        // Create EmployeeDetails first (before attaching roles)
        // This matches the pattern in EmployeeController and may be expected by observers/events
        EmployeeDetails::firstOrCreate(
            [
                'user_id' => $user->id,
                'company_id' => $companyId,
            ],
            [
                'joining_date' => now(),
            ]
        );

        $employeeRole = Role::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('name', 'employee')
            ->first();

        $salesRole = Role::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('name', 'sales agent')
            ->first();

        // Only attach roles that exist
        $rolesToAttach = array_filter([$employeeRole, $salesRole]);
        
        if (empty($rolesToAttach)) {
            // If no roles exist, try to find any role or skip role assignment
            // This prevents errors when roles haven't been set up yet
            Log::warning('Bitrix import: No employee or sales agent roles found for company', [
                'company_id' => $companyId,
                'user_email' => $user->email,
            ]);
        } else {
            foreach ($rolesToAttach as $role) {
                if ($role && $role->id) {
                    // attachRole expects a Role object, not an ID
                    $user->attachRole($role);
                    $user->assignUserRolePermission($role->id);
                }
            }
        }

        return $user;
    }

    private function upsertLead(array $contactData, int $companyId, ?User $responsibleUser): Lead
    {
        $email = trim((string) Arr::get($contactData, 'email'));
        $phone = trim((string) Arr::get($contactData, 'phone'));
        $name = trim((string) Arr::get($contactData, 'name'));

        $lead = null;

        if ($email !== '') {
            $lead = Lead::withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->where('client_email', $email)
                ->first();
        }

        if (!$lead && $phone !== '') {
            $lead = Lead::withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->where('mobile', $phone)
                ->first();
        }

        if (!$lead && $name !== '') {
            $lead = Lead::withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->where('client_name', $name)
                ->first();
        }

        if (!$lead) {
            $lead = new Lead();
            $lead->company_id = $companyId;
            $lead->client_email = $email !== '' ? $email : null;
            $lead->client_name = $name !== '' ? $name : 'Unknown Lead';
            $lead->mobile = $phone !== '' ? $phone : null;
            $lead->address = Arr::get($contactData, 'address');
            $lead->note = Arr::get($contactData, 'comments');
            if ($responsibleUser) {
                $lead->lead_owner = $responsibleUser->id;
            }
            $lead->column_priority = 0;
            
            // Set created_at from payload if provided
            if ($createdDate = $this->parseDate(Arr::get($contactData, 'createdDate'))) {
                $lead->created_at = $createdDate;
            }
            
            $lead->saveQuietly();
        } else {
            $lead->client_name = $name !== '' ? $name : $lead->client_name;
            if ($email !== '' && $lead->client_email !== $email) {
                $lead->client_email = $email;
            }
            if ($phone !== '' && $lead->mobile !== $phone) {
                $lead->mobile = $phone;
            }
            $lead->address = Arr::get($contactData, 'address', $lead->address);
            $lead->note = $this->combineNotes($lead->note, Arr::get($contactData, 'comments'));
            if ($responsibleUser && !$lead->lead_owner) {
                $lead->lead_owner = $responsibleUser->id;
            }
            $lead->save();
        }

        $marketingPayload = [
            'utm_source' => Arr::get($contactData, 'utmSource'),
            'utm_medium' => Arr::get($contactData, 'utmMedium'),
            'utm_campaign' => Arr::get($contactData, 'utmCampaign'),
            'utm_term' => Arr::get($contactData, 'utmTerm'),
            'utm_content' => Arr::get($contactData, 'utmContent'),
            'facebook_click_id' => Arr::get($contactData, 'facebookClickId'),
            'facebook_lead_id' => Arr::get($contactData, 'facebookLeadId'),
            'last_webinar_date' => $this->parseDate(Arr::get($contactData, 'webinarDate')),
            'contact_score' => $this->toInt(Arr::get($contactData, 'score')),
            'has_registered_for_the_webinar' => $this->toBoolean(Arr::get($contactData, 'hasRegisteredTheWebinar')) ?? false,
            'has_joined_the_facebook_group' => $this->toBoolean(Arr::get($contactData, 'hasJoinedFacebookGroup')) ?? false,
            'has_downloaded_the_ebook' => $this->toBoolean(Arr::get($contactData, 'hasDownloadedEbook')) ?? false,
        ];

        try {
            $lead->marketing()->updateOrCreate(
                ['lead_id' => $lead->id],
                $marketingPayload
            );
        } catch (\Exception $e) {
            // Log but don't fail the import if marketing data fails
            Log::warning('Bitrix import: Failed to upsert lead marketing data', [
                'lead_id' => $lead->id,
            ]);
        }

        return $lead;
    }

    private function handleBitrixImportFailure(Throwable $e, array $payload)
    {
        $contactEmail = Arr::get($payload, 'contact.email');
        $responsibleEmail = Arr::get($payload, 'responsiblePerson.email');

        Log::error('Bitrix import failed', [
            'message' => $e->getMessage(),
            'exception_type' => get_class($e),
            'exception_code' => $e->getCode(),
            'exception_trace' => $e->getTraceAsString(),
            'deal_name' => Arr::get($payload, 'deal.dealName'),
            'contact_email_present' => !empty($contactEmail),
            'responsible_email_present' => !empty($responsibleEmail),
        ]);

        // Always return a generic message to avoid leaking internals even if debug is enabled.
        $message = 'Unable to sync Bitrix deal. Please verify the payload and try again.';

        return Reply::error($message);
    }

    private function logoutIfAuthenticated(): void
    {
        if (auth()->check()) {
            auth()->logout();
        }
    }

    private function resolvePipelineAndStage(array $dealData, int $companyId): array
    {
        $pipelineName = trim((string) Arr::get($dealData, 'pipeline'));
        $stageIdentifier = Arr::get($dealData, 'dealStage');

        $pipeline = null;
        if ($pipelineName !== '') {
            $pipeline = LeadPipeline::withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->where('name', $pipelineName)
                ->first();
        }

        $stage = null;

        if ($stageIdentifier !== null && $stageIdentifier !== '') {
            // If stageIdentifier is numeric, prioritize ID matching
            if (is_numeric($stageIdentifier)) {
                $stageId = (int) $stageIdentifier;
                
                // First, try to find the stage in the specified pipeline (if pipeline was found)
                if ($pipeline) {
                    $stage = PipelineStage::withoutGlobalScopes()
                        ->where('company_id', $companyId)
                        ->where('lead_pipeline_id', $pipeline->id)
                        ->where('id', $stageId)
                        ->first();
                }
                
                // If not found in the pipeline, try finding by ID globally (stage might exist in another pipeline)
                if (!$stage) {
                    $stage = PipelineStage::withoutGlobalScopes()
                        ->where('company_id', $companyId)
                        ->where('id', $stageId)
                        ->first();
                    
                    // Log a warning if stage was found but in a different pipeline
                    if ($stage && $pipeline && $stage->lead_pipeline_id !== $pipeline->id) {
                        Log::warning('Bitrix import: Stage found in different pipeline than specified', [
                            'stage_id' => $stageId,
                            'found_pipeline_id' => $stage->lead_pipeline_id,
                            'specified_pipeline_id' => $pipeline->id,
                            'specified_pipeline_name' => $pipeline->name,
                        ]);
                    }
                }
                
                // If still not found by ID, log an error
                if (!$stage) {
                    Log::warning('Bitrix import: Stage ID not found', [
                        'stage_id' => $stageId,
                        'company_id' => $companyId,
                        'pipeline_id' => $pipeline?->id,
                        'pipeline_name' => $pipeline?->name,
                    ]);
                }
            }
            
            // If not found by ID (or not numeric), try name and slug
            if (!$stage) {
                $stage = PipelineStage::withoutGlobalScopes()
                    ->where('company_id', $companyId)
                    ->when($pipeline, function ($query) use ($pipeline) {
                        $query->where('lead_pipeline_id', $pipeline->id);
                    })
                    ->where(function ($query) use ($stageIdentifier) {
                        $query->where('name', $stageIdentifier)
                            ->orWhere('slug', $stageIdentifier);
                    })
                    ->first();
            }
        }

        if (!$stage && $pipeline) {
            $stage = PipelineStage::withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->where('lead_pipeline_id', $pipeline->id)
                ->orderBy('priority')
                ->first();
        }

        if (!$stage) {
            $stage = PipelineStage::withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->orderBy('priority')
                ->first();
        }

        if (!$stage) {
            return [null, null];
        }

        if (!$pipeline) {
            $pipeline = $stage->pipeline;
            
            if ($pipeline === null) {
                Log::warning('Bitrix import: Failed to load pipeline from stage', [
                    'stage_id' => $stage->id,
                    'company_id' => $companyId,
                ]);
            }
        }

        return [$pipeline, $stage];
    }

    private function upsertHibarrFields(Deal $deal, array $dealData): void
    {
        $hibarrFields = [
            'budget_range' => Arr::get($dealData, 'customerBudget') ?? '',
            'inspection_trip_date' => $this->parseDate(Arr::get($dealData, 'nextMeeting')),
            'strategy_meeting_booked' => $this->toBoolean(Arr::get($dealData, 'strategyMeeting')) ? 1 : 0,
            'downpayment_paid' => $this->toBoolean(Arr::get($dealData, 'downpayment')) ? 1 : 0,
            'deposit_confirmation' => Arr::get($dealData, 'depositConfirmation') ?? '',
            'reservation_agreement' => Arr::get($dealData, 'reservationAgreement') ?? '',
            'sales_contract' => Arr::get($dealData, 'salesContract') ?? '',
            'motivation/comment' => Arr::get($dealData, 'motivation') ?? '',
        ];

        HibarrDealFields::updateOrCreate(
            ['deal_id' => $deal->id],
            $hibarrFields
        );
    }

    private function combineNotes(?string $existing, ?string $new): ?string
    {
        $existing = trim((string) $existing);
        $new = trim((string) $new);

        if ($existing === '') {
            return $new ?: null;
        }

        if ($new === '') {
            return $existing;
        }

        return $existing . "\n\n" . $new;
    }

    private function buildDealNotes(Deal $deal, array $dealData, array $contactData): ?string
    {
        $additional = [];

        if ($amount = Arr::get($dealData, 'amountPaid')) {
            $additional[] = 'Amount Paid: ' . $amount;
        }

        if ($passport = Arr::get($dealData, 'passport')) {
            $additional[] = 'Passport Details: ' . (is_array($passport) ? json_encode($passport) : (string) $passport);
        }

        if ($agentContract = Arr::get($dealData, 'agentContract')) {
            $additional[] = 'Agent Contract: ' . $agentContract;
        }

        if ($invoice = Arr::get($dealData, 'invoice')) {
            $additional[] = 'Invoice: ' . $invoice;
        }

        if ($receipts = Arr::get($dealData, 'recipts')) {
            $additional[] = 'Receipts: ' . $receipts;
        }

        if ($kickoffResult = Arr::get($dealData, 'KickoffMeetingResult_attendance')) {
            $additional[] = 'Kickoff Meeting Result: ' . $kickoffResult;
        }

        if ($language = Arr::get($contactData, 'language')) {
            $additional[] = 'Preferred Language: ' . $language;
        }

        if ($poa = Arr::get($contactData, 'POA')) {
            $additional[] = 'POA: ' . $poa;
        }

        if (empty($additional)) {
            return $deal->note;
        }

        $summary = "Bitrix Sync Summary:\n" . implode("\n", $additional);
        return $this->combineNotes($deal->note, $summary);
    }

    private function parseDate($value): ?Carbon
    {
        if (empty($value)) {
            return null;
        }

        try {
            return Carbon::parse($value);
        } catch (\Exception $exception) {
            return null;
        }
    }

    private function toBoolean($value): ?bool
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_bool($value)) {
            return $value;
        }

        $value = strtolower((string) $value);
        $truthy = ['yes', 'true', '1', 'y', 'on'];
        $falsy = ['no', 'false', '0', 'n', 'off'];

        if (in_array($value, $truthy, true)) {
            return true;
        }

        if (in_array($value, $falsy, true)) {
            return false;
        }

        return null;
    }

    private function toFloat($value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_numeric($value)) {
            return (float) $value;
        }

        $normalized = preg_replace('/[^0-9.\-]/', '', (string) $value);
        return is_numeric($normalized) ? (float) $normalized : null;
    }

    private function toInt($value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_numeric($value)) {
            return (int) $value;
        }

        return null;
    }

    private function scheduleFollowUpIfNeeded(Deal $deal, $nextMeeting): void
    {
        $date = $this->parseDate($nextMeeting);

        if (!$date) {
            return;
        }

        try {
            DealFollowUp::create([
                'deal_id' => $deal->id,
                'next_follow_up_date' => $date,
                'remark' => 'Imported from Bitrix',
                'added_by' => optional(auth()->user())->id,
            ]);
        } catch (\Exception $e) {
            // Log but don't fail the import if follow-up creation fails
            Log::warning('Bitrix import: Failed to create deal follow-up', [
                'deal_id' => $deal->id,
                'next_meeting' => $nextMeeting,
            ]);
        }
    }
}
