<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * App\Models\MetaConversionTrigger
 *
 * @property int $id
 * @property int $lead_pipeline_id
 * @property int $lead_pipeline_stage_id
 * @property string $event_name
 * @property float $value
 * @property bool $active
 * @property int|null $company_id
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Company|null $company
 * @property-read \App\Models\LeadPipeline $pipeline
 * @property-read \App\Models\PipelineStage $stage
 * @method static \Illuminate\Database\Eloquent\Builder|MetaConversionTrigger active()
 * @method static \Illuminate\Database\Eloquent\Builder|MetaConversionTrigger newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|MetaConversionTrigger newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|MetaConversionTrigger query()
 * @method static \Illuminate\Database\Eloquent\Builder|MetaConversionTrigger whereActive($value)
 * @method static \Illuminate\Database\Eloquent\Builder|MetaConversionTrigger whereCompanyId($value)
 * @method static \Illuminate\Database\Eloquent\Builder|MetaConversionTrigger whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder|MetaConversionTrigger whereEventName($value)
 * @method static \Illuminate\Database\Eloquent\Builder|MetaConversionTrigger whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder|MetaConversionTrigger whereLeadPipelineId($value)
 * @method static \Illuminate\Database\Eloquent\Builder|MetaConversionTrigger whereLeadPipelineStageId($value)
 * @method static \Illuminate\Database\Eloquent\Builder|MetaConversionTrigger whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder|MetaConversionTrigger whereValue($value)
 * @mixin \Eloquent
 */
class MetaConversionTrigger extends BaseModel
{
    use HasCompany;

    protected $fillable = [
        'lead_pipeline_id',
        'lead_pipeline_stage_id',
        'event_name',
        'value',
        'active',
        'company_id',
    ];

    protected $casts = [
        'active' => 'boolean',
        'value' => 'float',
        'lead_pipeline_id' => 'integer',
        'lead_pipeline_stage_id' => 'integer',
        'company_id' => 'integer',
    ];

    protected $attributes = [
        'value' => 0,
    ];

    /**
     * Validation rules for the model
     *
     * @return array
     */
    public static function validationRules(): array
    {
        return [
            'lead_pipeline_id' => 'required|exists:lead_pipelines,id',
            'lead_pipeline_stage_id' => 'required|exists:pipeline_stages,id',
            'event_name' => 'required|string|max:255',
            'value' => 'nullable|numeric|min:0',
            'active' => 'boolean',
        ];
    }

    /**
     * Get the pipeline that this trigger belongs to
     */
    public function pipeline(): BelongsTo
    {
        return $this->belongsTo(LeadPipeline::class, 'lead_pipeline_id');
    }

    /**
     * Get the stage that this trigger belongs to
     */
    public function stage(): BelongsTo
    {
        return $this->belongsTo(PipelineStage::class, 'lead_pipeline_stage_id');
    }

    /**
     * Scope to query only active triggers
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeActive($query)
    {
        return $query->where('active', true);
    }
}

