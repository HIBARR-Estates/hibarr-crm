<?php

namespace App\Models;

use App\Scopes\ActiveScope;
use App\Traits\CustomFieldsTrait;
use App\Traits\HasDynamicTranslations;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Notifications\Notifiable;
use App\Models\Payment;
use App\Models\LeadAgent;
use App\Models\MlmCommission;
use App\Models\DealOfferApplication;


/**
 * App\Models\Lead
 *
 * @property int $id
 * @property int|null $client_id
 * @property int|null $source_id
 * @property int|null $status_id
 * @property int $column_priority
 * @property int|null $agent_id
 * @property string|null $company_name
 * @property string|null $website
 * @property string|null $address
 * @property string|null $salutation
 * @property string $client_name
 * @property string $client_email
 * @property string|null $mobile
 * @property string|null $cell
 * @property string|null $office
 * @property string|null $city
 * @property string|null $state
 * @property string|null $country
 * @property string|null $postal_code
 * @property string|null $note
 * @property string $next_follow_up
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property float|null $value
 * @property float|null $total_value
 * @property int|null $currency_id
 * @property float|null $exchange_rate
 * @property \Illuminate\Support\Carbon|null $stage_entered_at
 * @property int|null $category_id
 * @property int|null $added_by
 * @property int|null $last_updated_by
 * @property-read \App\Models\User|null $client
 * @property-read \App\Models\Currency|null $currency
 * @property-read \Illuminate\Database\Eloquent\Collection|\App\Models\DealFile[] $files
 * @property-read int|null $files_count
 * @property-read \Illuminate\Database\Eloquent\Collection|\App\Models\DealFollowUp[] $follow
 * @property-read int|null $follow_count
 * @property-read \App\Models\DealFollowUp|null $followup
 * @property-read mixed $extras
 * @property-read mixed $icon
 * @property-read mixed $image_url
 * @property-read \App\Models\LeadAgent|null $leadAgent
 * @property-read \App\Models\LeadSource|null $leadSource
 * @property-read \App\Models\LeadStatus|null $leadStatus
 * @property-read \Illuminate\Notifications\DatabaseNotificationCollection|\Illuminate\Notifications\DatabaseNotification[] $notifications
 * @property-read int|null $notifications_count
 * @method static \Database\Factories\LeadFactory factory(...$parameters)
 * @method static \Illuminate\Database\Eloquent\Builder|Lead newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|Lead newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|Lead query()
 * @method static \Illuminate\Database\Eloquent\Builder|Lead whereAddedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Lead whereAddress($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Lead whereAgentId($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Lead whereCategoryId($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Lead whereCell($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Lead whereCity($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Lead whereClientEmail($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Lead whereClientId($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Lead whereClientName($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Lead whereColumnPriority($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Lead whereCompanyName($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Lead whereCountry($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Lead whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Lead whereCurrencyId($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Lead whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Lead whereLastUpdatedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Lead whereMobile($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Lead whereNextFollowUp($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Lead whereNote($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Lead whereOffice($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Lead wherePostalCode($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Lead whereSalutation($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Lead whereSourceId($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Lead whereState($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Lead whereStatusId($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Lead whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Lead whereValue($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Lead whereWebsite($value)
 * @property string|null $hash
 * @property-read \App\Models\LeadCategory|null $category
 * @method static \Illuminate\Database\Eloquent\Builder|Lead whereHash($value)
 * @property int|null $company_id
 * @property-read \App\Models\Company|null $company
 * @method static \Illuminate\Database\Eloquent\Builder|Lead whereCompanyId($value)
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Product> $products
 * @property-read int|null $products_count
 * @property-read int|null $follow_up_date_next
 * @property-read int|null $follow_up_date_past
 * @property string|null $name
 * @property int|null $lead_pipeline_id
 * @property int|null $pipeline_stage_id
 * @property int|null $lead_id
 * @property \Illuminate\Support\Carbon|null $close_date
 * @property-read \App\Models\Lead|null $contact
 * @property-read \App\Models\PipelineStage|null $leadStage
 * @property-read \App\Models\LeadPipeline|null $pipeline
 * @method static \Illuminate\Database\Eloquent\Builder|Deal whereCloseDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Deal whereLeadId($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Deal whereLeadPipelineId($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Deal whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Deal wherePipelineStageId($value)
 * @mixin \Eloquent
 */
class Deal extends BaseModel
{

    use Notifiable, HasFactory;
    use CustomFieldsTrait;
    use HasDynamicTranslations;
    use HasCompany;

    const CUSTOM_FIELD_MODEL = 'App\Models\Deal';

    /**
     * Fields eligible for dynamic translation background processing.
     *
     * @var array<int, string>
     */
    public array $translatableFields = [
        'name',
    ];

    protected $hidden = ["pivot"];


    // total_discount is an aggregate — appending it globally cost one extra query
    // per deal on every list that gets serialized. Only the deal show page reads
    // it, and that appends it explicitly.
    protected $appends = ['image_url'];

    protected $casts = [
        'close_date' => 'datetime',
        'next_follow_up_date' => 'datetime',
        'bitrix_id' => 'integer',
        'outcome_status' => \App\Enums\OutcomeStatus::class,
        'is_locked' => 'boolean',
        'locked_at' => 'datetime',
        'commission_locked' => 'boolean',
        'commission_locked_at' => 'datetime',
        'max_commission_percentage' => 'decimal:2',
        'manual_value' => 'decimal:2',
        'calculated_value' => 'decimal:2',
        'discount_value' => 'decimal:2',
        'deduction_amount' => 'decimal:2',
        'won_at' => 'datetime',
        'stage_entered_at' => 'datetime',
        'exchange_rate' => 'double',
        'analysis_completed_at' => 'datetime',
        'analysis_completed_by' => 'integer',
        'analysis_unanswered' => 'array',
        'remind_at' => 'datetime',
        'reminders' => 'array',
    ];

    public function leadFlightItineraries()
    {
        return $this->hasMany(LeadFlightItinerary::class);
    }

    public function getImageUrlAttribute()
    {
        $gravatarHash = md5(strtolower(trim($this->name)));

        return 'https://www.gravatar.com/avatar/' . $gravatarHash . '.png?s=200&d=mp';
    }

    /**
     * Route notifications for the mail channel.
     *
     * @param \Illuminate\Notifications\Notification $notification
     * @return string
     */
    // phpcs:ignore
    public function routeNotificationForMail($notification)
    {
        return $this->contact->client_email;
    }

    public function leadAgent(): BelongsTo
    {
        return $this->belongsTo(LeadAgent::class, 'agent_id');
    }

    public function dealWatchers()
    {
        return $this->belongsToMany(User::class, 'deal_watchers', 'deal_id', 'user_id')->using(DealWatcher::class);
    }

    public function dealWatcher()
    {
        return $this->belongsToMany(User::class, 'deal_watchers', 'deal_id', 'user_id')->using(DealWatcher::class)->first();
    }

    public function dealParticipants()
    {
        return $this->belongsToMany(User::class, 'deal_participants', 'deal_id', 'user_id')->using(DealParticipant::class);
    }

    /**
     * Whether $userId has full team access to this deal — participants act with the
     * same read/write rights as the assigned agent. Use this for any "can edit/write"
     * gate. Watchers are intentionally excluded here (view-only, see isVisibleToUser()).
     */
    public function hasTeamMemberAccess(int $userId): bool
    {
        if ($this->leadAgent && (int) $this->leadAgent->user_id === $userId) {
            return true;
        }

        return $this->dealParticipants()->where('users.id', $userId)->exists();
    }

    /**
     * Whether $userId may view this deal — team members (agent/participant) plus
     * watchers, who can see everything but never write. Use this for any "can view" gate.
     */
    public function isVisibleToUser(int $userId): bool
    {
        if ($this->hasTeamMemberAccess($userId)) {
            return true;
        }

        return $this->dealWatchers()->where('users.id', $userId)->exists();
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Lead::class, 'lead_id');
    }

    public function note(): BelongsTo
    {
        return $this->belongsTo(DealNote::class, 'deal_id');
    }

    public function leadSource(): BelongsTo
    {
        return $this->belongsTo(LeadSource::class, 'source_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(LeadCategory::class, 'category_id');
    }

    public function leadStage(): BelongsTo
    {
        return $this->belongsTo(PipelineStage::class, 'pipeline_stage_id');
    }

    public function pipeline(): BelongsTo
    {
        return $this->belongsTo(LeadPipeline::class, 'lead_pipeline_id');
    }

    public function packages(): BelongsToMany
    {
        return $this->belongsToMany(Package::class, 'deal_package');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_id');
    }

    public function currency(): BelongsTo
    {
        return $this->belongsTo(Currency::class, 'currency_id');
    }

    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'lead_products', 'deal_id')->using(LeadProduct::class);
    }

    public function follow()
    {
        if (user()) {
            $viewLeadFollowUpPermission = user()->permission('view_lead_follow_up');

            if ($viewLeadFollowUpPermission == 'all') {
                return $this->hasMany(DealFollowUp::class);
            }

            if ($viewLeadFollowUpPermission == 'added') {
                return $this->hasMany(DealFollowUp::class)->where('added_by', user()->id);
            }

            return null;
        }

        return $this->hasMany(DealFollowUp::class);
    }

    public function followup(): HasOne
    {
        return $this->hasOne(DealFollowUp::class, 'deal_id')->orderByDesc('created_at');
    }

    /**
     * Simple followups relationship for counting (without permission checks)
     */
    public function followups(): HasMany
    {
        return $this->hasMany(DealFollowUp::class, 'deal_id');
    }

    public function files(): HasMany
    {
        return $this->hasMany(DealFile::class, 'deal_id')->orderByDesc('created_at');
    }

    public static function allLeads($contactId = null)
    {

        $leads = Deal::select('*')->orderBy('name');

        if ($contactId) {
            $leads->where('lead_id', $contactId);
        }

        return $leads->get();
    }

    public function addedBy()
    {
        return $this->belongsTo(User::class, 'added_by')->withoutGlobalScope(ActiveScope::class);
    }


    public function communicationActivities(): HasMany
    {
        return $this->hasMany(CommunicationActivity::class, 'deal_id')->orderByDesc('timestamp');
    }

    // payments relation
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class, 'deal_id');

    }

    // Hibarr custom fields relation
    public function hibarrFields(): HasOne
    {
        return $this->hasOne(HibarrDealFields::class, 'deal_id');
    }

    public function tasks()
    {
        return $this->morphToMany(Task::class, 'taskable');
    }

    // ── Offers ────────────────────────────────────────────────────

    public function offerApplications(): HasMany
    {
        return $this->hasMany(DealOfferApplication::class, 'deal_id');
    }

    /**
     * Get the total discount amount from all applied offers.
     */
    public function getTotalDiscountAttribute(): float
    {
        return (float) $this->offerApplications()->sum('discount_amount');
    }

    // ── MLM ──────────────────────────────────────────────────────

    public function mlmCommissions(): HasMany
    {
        return $this->hasMany(MlmCommission::class, 'deal_id');
    }

    /**
     * Only the explicit is_locked flag locks a deal — winning a deal does
     * NOT lock it on its own. Use the lock_deal automation action (or a
     * manual lock) when that protection is wanted. Mirrors
     * isDealEffectivelyLocked() in resources/js/lib/dealOutcome.ts.
     */
    public function isLocked(): bool
    {
        return (bool) $this->is_locked;
    }

    /**
     * Commission having been calculated is a narrower, separate fact from the
     * deal being fully locked: a deal can be commission_locked (its value can
     * no longer change, because a commission was already computed against it)
     * while stage and notes stay editable. The agent is also frozen: payout
     * already ran against that agent. Set by ProcessDealWonJob once
     * distribution completes; cleared by DealOutcomeService::apply() when a
     * won deal is reverted.
     */
    public function isCommissionLocked(): bool
    {
        return (bool) $this->commission_locked;
    }

    /**
     * Request keys that feed the deal's value (directly or via recalculation)
     * — the single list every entry point checks before allowing a write,
     * so "what counts as a value-affecting field" is defined once. Package
     * and product attachment are included: DealValueResolver derives
     * calculated_value from both.
     *
     * @var array<int, string>
     */
    public const VALUE_AFFECTING_KEYS = [
        'value',
        'manual_value',
        'calculated_value',
        'value_source',
        'currency_id',
        // Currency and adjustments change what the deal is worth in company
        // currency just as directly as the raw amount does, so a
        // commission-locked deal has to refuse them too.
        'exchange_rate',
        'discount_type',
        'discount_value',
        'deduction_amount',
        'package_id',
        'product_id',
        'products',
    ];

    /**
     * True when $data (a request's input, however it's keyed) touches any
     * field that feeds this deal's value.
     *
     * @param array<string, mixed> $data
     */
    public static function touchesValueFields(array $data): bool
    {
        foreach (self::VALUE_AFFECTING_KEYS as $key) {
            if (array_key_exists($key, $data)) {
                return true;
            }
        }

        return false;
    }

    /**
     * True when $data includes agent_id. Distinct from VALUE_AFFECTING_KEYS:
     * changing the agent does not change the deal's value, but it is still
     * refused once commission has been calculated against the current agent.
     *
     * @param array<string, mixed> $data
     */
    public static function touchesAgentField(array $data): bool
    {
        return array_key_exists('agent_id', $data);
    }

    /**
     * True when $newAgentId is a different agent (or a clear) from the one
     * currently stored. Presence of the same id is not a change.
     */
    public function agentWouldChange(mixed $newAgentId): bool
    {
        $current = $this->agent_id === null ? null : (int) $this->agent_id;

        if ($newAgentId === null || $newAgentId === '') {
            $incoming = null;
        } else {
            $incoming = (int) $newAgentId;
        }

        return $current !== $incoming;
    }
}
