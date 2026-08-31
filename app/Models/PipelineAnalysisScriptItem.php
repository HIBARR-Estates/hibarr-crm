<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PipelineAnalysisScriptItem extends Model
{
    public $timestamps = false;

    protected $fillable = ['analysis_script_id', 'type', 'item_key', 'label_override', 'guide_text', 'is_required', 'position'];

    protected $casts = ['position' => 'integer', 'is_required' => 'boolean'];

    public function script(): BelongsTo
    {
        return $this->belongsTo(PipelineAnalysisScript::class, 'analysis_script_id');
    }
}
