<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PipelineFieldScope extends BaseModel
{
    use HasCompany;

    public const TYPE_CUSTOM_FIELD = 'custom_field';
    public const TYPE_NATIVE_FIELD = 'native_field';
    public const TYPE_HIBARR_FIELD = 'hibarr_field';

    protected $fillable = [
        'company_id',
        'scopeable_type',
        'scopeable_key',
        'model',
        'pipeline_id',
        'pipeline_stage_id',
    ];

    public function pipeline(): BelongsTo
    {
        return $this->belongsTo(LeadPipeline::class, 'pipeline_id');
    }

    public function pipelineStage(): BelongsTo
    {
        return $this->belongsTo(PipelineStage::class, 'pipeline_stage_id');
    }
}
