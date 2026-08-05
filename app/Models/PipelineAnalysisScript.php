<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PipelineAnalysisScript extends Model
{
    protected $fillable = ['pipeline_id', 'company_id'];

    public function pipeline(): BelongsTo
    {
        return $this->belongsTo(LeadPipeline::class, 'pipeline_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(PipelineAnalysisScriptItem::class, 'analysis_script_id')->orderBy('position');
    }
}
