<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;

/**
 * App\Models\LeadCategory
 *
 * @property int $id
 * @property string $category_name
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property int|null $added_by
 * @property int|null $last_updated_by
 * @method static \Illuminate\Database\Eloquent\Builder|LeadCategory newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|LeadCategory newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|LeadCategory query()
 * @method static \Illuminate\Database\Eloquent\Builder|LeadCategory whereAddedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder|LeadCategory whereCategoryName($value)
 * @method static \Illuminate\Database\Eloquent\Builder|LeadCategory whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder|LeadCategory whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder|LeadCategory whereLastUpdatedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder|LeadCategory whereUpdatedAt($value)
 * @property int|null $company_id
 * @property-read \App\Models\Company|null $company
 * @method static \Illuminate\Database\Eloquent\Builder|LeadCategory whereCompanyId($value)
 * @property string|null $name
 * @property string|null $slug
 * @property int $priority
 * @property string $label_color
 * @property int $default
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Deal> $deals
 * @property-read int|null $deals_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\PipelineStage> $stages
 * @property-read int|null $stages_count
 * @method static \Illuminate\Database\Eloquent\Builder|LeadPipeline whereDefault($value)
 * @method static \Illuminate\Database\Eloquent\Builder|LeadPipeline whereLabelColor($value)
 * @method static \Illuminate\Database\Eloquent\Builder|LeadPipeline whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder|LeadPipeline wherePriority($value)
 * @method static \Illuminate\Database\Eloquent\Builder|LeadPipeline whereSlug($value)
 * @mixin \Eloquent
 */
class LeadPipeline extends BaseModel
{

    use HasCompany;

    public const OFFERING_PROPERTY = 'property';
    public const OFFERING_PACKAGE = 'package';
    public const OFFERING_BOTH = 'both';

    protected $default = ['id', 'name'];
    protected $with = [];

    protected $casts = [
        'hidden_from_nav' => 'boolean',
        'hidden_from_system' => 'boolean',
        'hide_all_categories' => 'boolean',
    ];

    public function offeringType(): string
    {
        return match ($this->offering_type) {
            self::OFFERING_PACKAGE => self::OFFERING_PACKAGE,
            self::OFFERING_BOTH => self::OFFERING_BOTH,
            default => self::OFFERING_PROPERTY,
        };
    }

    /** Package-only pipeline — hides properties, recommendations and offers. */
    public function isPackageOffering(): bool
    {
        return $this->offeringType() === self::OFFERING_PACKAGE;
    }

    /** Property-only pipeline — hides the package selector. */
    public function isPropertyOffering(): bool
    {
        return $this->offeringType() === self::OFFERING_PROPERTY;
    }

    public function allowsPackages(): bool
    {
        return in_array($this->offeringType(), [self::OFFERING_PACKAGE, self::OFFERING_BOTH], true);
    }

    public function allowsProperties(): bool
    {
        return in_array($this->offeringType(), [self::OFFERING_PROPERTY, self::OFFERING_BOTH], true);
    }

    public function scopeVisibleInNav($query)
    {
        return $query->where('hidden_from_nav', false);
    }

    /**
     * Pipelines that may appear in dropdowns, selects, and forms.
     * The default pipeline is always included even if the flag was set somehow.
     */
    public function scopeVisibleInSystem($query)
    {
        return $query->where(function ($q) {
            $q->where('hidden_from_system', false)->orWhere('default', 1);
        });
    }

    public function stages(): HasMany
    {
        return $this->hasMany(PipelineStage::class, 'lead_pipeline_id', 'id')->orderBy('pipeline_stages.priority');
    }

    public function deals(): HasMany
    {
        return $this->hasMany(Deal::class, 'lead_pipeline_id', 'id');
    }

    public function customFieldCategoryScopes(): HasMany
    {
        return $this->hasMany(CustomFieldCategoryScope::class, 'pipeline_id');
    }

    /**
     * Pipeline-wide custom field categories (no stage assigned).
     */
    public function customFieldCategories(): BelongsToMany
    {
        return $this->belongsToMany(
            CustomFieldCategory::class,
            'custom_field_category_scopes',
            'pipeline_id',
            'category_id'
        )->whereNull('custom_field_category_scopes.pipeline_stage_id');
    }

    public function packages(): BelongsToMany
    {
        return $this->belongsToMany(Package::class, 'package_pipeline', 'pipeline_id', 'package_id')
            ->withPivot('default_stage_id')
            ->withTimestamps();
    }

    /**
     * Category IDs assigned to this pipeline (pipeline-wide scopes only).
     */
    public function pipelineWideCategoryIds(): Collection
    {
        return $this->customFieldCategoryScopes()
            ->whereNull('pipeline_stage_id')
            ->pluck('category_id');
    }

}
