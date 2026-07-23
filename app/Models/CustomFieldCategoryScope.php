<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomFieldCategoryScope extends BaseModel
{
    use HasCompany;

    protected $fillable = [
        'company_id',
        'category_id',
        'pipeline_id',
        'pipeline_stage_id',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(CustomFieldCategory::class, 'category_id');
    }

    public function pipeline(): BelongsTo
    {
        return $this->belongsTo(LeadPipeline::class, 'pipeline_id');
    }

    public function pipelineStage(): BelongsTo
    {
        return $this->belongsTo(PipelineStage::class, 'pipeline_stage_id');
    }
}
