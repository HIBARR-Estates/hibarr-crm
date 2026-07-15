<?php

namespace App\Models;

use App\Enums\ContactType;
use App\Enums\Salutation;
use App\Enums\Gender;
use App\Enums\AgeRange;
use App\Scopes\ActiveScope;
use App\Traits\CustomFieldsTrait;
use App\Traits\HasDynamicTranslations;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Notifications\Notifiable;

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
 * @property \Illuminate\Support\Carbon|null $date_of_birth
 * @property int|null $age
 * @property string|null $age_range
 * @property string|null $note
 * @property string $next_follow_up
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property float|null $value
 * @property float|null $total_value
 * @property int|null $currency_id
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
 * @method static \Illuminate\Database\Eloquent\Builder|Lead whereDateOfBirth($value)
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
 * @mixin \Eloquent
 */
class Lead extends BaseModel
{

    use Notifiable, HasFactory;
    use CustomFieldsTrait;
    use HasDynamicTranslations;
    use HasCompany;

    /**
     * Fields eligible for dynamic translation background processing.
     *
     * @var array<int, string>
     */
    public array $translatableFields = [
        'client_name',
        'company_name',
        'note',
    ];

    protected $hidden = ["pivot"];


    const CUSTOM_FIELD_MODEL = 'App\Models\Lead';

    protected $appends = ['image_url', 'client_name_salutation', 'mobile_with_phonecode', 'office_phone_formatted', 'lead_lifecycle_status'];

    protected $casts = [
        'salutation' => Salutation::class,
        'type' => ContactType::class,
        'gender' => Gender::class,
        'date_of_birth' => 'date',
        'age' => 'integer',
        'age_range' => AgeRange::class,
        'languages' => 'array',
    ];

    public function leadFlightItineraries()
    {
        return $this->hasMany(LeadFlightItinerary::class);
    }

    public function getImageUrlAttribute()
    {
        $gravatarHash = !is_null($this->client_email) ? md5(strtolower(trim($this->client_email))) : '';

        return 'https://www.gravatar.com/avatar/' . $gravatarHash . '.png?s=200&d=mp';
    }

    public function clientNameSalutation(): Attribute
    {
        return Attribute::make(
            get: fn($value) => ($this->salutation ? $this->salutation->label() . ' ' : '') . $this->client_name
        );
    }

    public function getMobileWithPhoneCodeAttribute()
    {
        if (empty($this->mobile)) {
            return '--';
        }

        // Try to decode JSON (mobile may be stored as JSON from antd-phone-input or legacy format)
        $decoded = json_decode($this->mobile, true);

        if (is_array($decoded)) {
            // antd-phone-input format: {countryCode, areaCode, phoneNumber, isoCode}
            if (isset($decoded['countryCode']) && isset($decoded['phoneNumber'])) {
                $parts = array_filter([
                    $decoded['countryCode'],
                    $decoded['areaCode'] ?? '',
                    $decoded['phoneNumber'],
                ]);
                return '+' . implode('', $parts);
            }

            // Legacy format: {phone, country_code, country_identifier}
            if (isset($decoded['phone'])) {
                $cleanPhone = preg_replace('/[^0-9]/', '', $decoded['phone']);
                return !empty($cleanPhone) ? '+' . $cleanPhone : '--';
            }

            return '--';
        }

        // Plain string phone number
        $cleanPhone = preg_replace('/[^0-9]/', '', $this->mobile);

        if (empty($cleanPhone)) {
            return '--';
        }

        return '+' . $cleanPhone;
    }

    public function getOfficePhoneFormattedAttribute()
    {
        if (empty($this->office)) {
            return '--';
        }

        // Clean the phone number (remove all non-numeric characters)
        $cleanPhone = preg_replace('/[^0-9]/', '', $this->office);
        
        // If the phone number is empty after cleaning, return -- 
        if (empty($cleanPhone)) {
            return '--';
        }

        // Add + prefix to match mobile phone format
        return '+' . $cleanPhone;
    }

    /**
     * Get the 2-letter ISO country code from the stored country value (nicename, iso, or iso3).
     */
    public function getCountryIsoAttribute(): ?string
    {
        if (empty($this->country)) {
            return null;
        }

        $countryValue = trim($this->country);

        // Already 2-letter ISO (uppercase or lowercase)
        if (strlen($countryValue) === 2) {
            return strtoupper($countryValue);
        }

        $countries = \Illuminate\Support\Facades\Cache::remember('countries_list', 3600, fn () => Country::all());

        $match = $countries->first(function ($c) use ($countryValue) {
            return strcasecmp($c->nicename, $countryValue) === 0
                || strcasecmp($c->name ?? '', $countryValue) === 0
                || strcasecmp($c->iso3 ?? '', $countryValue) === 0
                || strcasecmp($c->iso, $countryValue) === 0;
        });

        return $match ? strtoupper($match->iso) : null;
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
        return $this->client_email;
    }

    public function leadSource(): BelongsTo
    {
        return $this->belongsTo(LeadSource::class, 'source_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(LeadCategory::class, 'category_id');
    }

    public function note(): BelongsTo
    {
        return $this->belongsTo(LeadNote::class, 'lead_id');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'client_id');
    }

    public function addedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'added_by')->withoutGlobalScope(ActiveScope::class);
    }

    public function leadOwner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'lead_owner')->withoutGlobalScope(ActiveScope::class);
    }

    public function marketing(): HasOne
    {
        return $this->hasOne(LeadMarketing::class, 'lead_id');
    }

    public function lifecycleStatus(): BelongsTo
    {
        return $this->belongsTo(LeadLifecycleStatus::class, 'lead_lifecycle_status_id');
    }

    /**
     * Alias so the frontend (which reads `lead_lifecycle_status`) gets the
     * `lifecycleStatus` relation under the key it expects. Uses whatever's
     * already loaded/lazy-loaded on `lifecycleStatus` — no extra query when
     * the relation has been eager-loaded.
     */
    public function getLeadLifecycleStatusAttribute()
    {
        return $this->lifecycleStatus;
    }

    public function qualifications(): HasMany
    {
        return $this->hasMany(LeadQualification::class, 'lead_id');
    }

    public function activeQualification(): HasOne
    {
        return $this->hasOne(LeadQualification::class, 'lead_id')
            ->where('status', \App\Enums\QualificationStatus::InProgress->value)
            ->latestOfMany('started_at');
    }

    public static function allLeads($contactId = null)
    {
        // Retrieve user's lead view permission
        $viewLeadPermission = user()->permission('view_lead');

        // If the user has no permission to view leads
        if ($viewLeadPermission === 'none') {
            return collect();
        }

        // Initialize lead query
        $leadsQuery = Lead::select('*')->orderBy('client_name');

        if ($viewLeadPermission == 'owned') {
            $leadsQuery = $leadsQuery->where('lead_owner', user()->id);
        }

        if ($viewLeadPermission == 'added') {
            $leadsQuery = $leadsQuery->where('added_by', user()->id);
        }

        if ($viewLeadPermission == 'both') {
            $leadsQuery = $leadsQuery->where(function ($query) {
                $query->where('lead_owner', user()->id)
                      ->orWhere('added_by', user()->id);
            });
        }

        // Apply contact ID filter if provided
        if ($contactId) {
            $leadsQuery->where('id', $contactId);
        }

        // Retrieve leads
        return $leadsQuery->get();
    }

    public function communicationActivities(): HasMany
    {
        return $this->hasMany(CommunicationActivity::class, 'lead_id')->orderByDesc('timestamp');
    }

    public function deals(): HasMany
    {
        return $this->hasMany(Deal::class, 'lead_id');
    }

    public function tasks()
    {
        return $this->morphToMany(Task::class, 'taskable');
    }
}
