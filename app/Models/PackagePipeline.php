<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PackagePipeline extends BaseModel
{
    use HasCompany;

    protected $table = 'package_pipeline';

    protected $fillable = [
        'company_id',
        'package_id',
        'pipeline_id',
        'default_stage_id',
    ];

    public function package(): BelongsTo
    {
        return $this->belongsTo(Package::class);
    }

    public function pipeline(): BelongsTo
    {
        return $this->belongsTo(LeadPipeline::class, 'pipeline_id');
    }

    public function defaultStage(): BelongsTo
    {
        return $this->belongsTo(PipelineStage::class, 'default_stage_id');
    }
}
