<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EntityAiSummary extends BaseModel
{
    use HasCompany;

    public const TYPE_LEAD = 'lead';

    public const TYPE_DEAL = 'deal';

    protected $table = 'entity_ai_summaries';

    protected $fillable = [
        'company_id',
        'entity_type',
        'entity_id',
        'summary_json',
        'input_hash',
        'prompt_version',
        'generated_at',
        'generated_by',
    ];

    protected $casts = [
        'summary_json' => 'array',
        'generated_at' => 'datetime',
    ];

    public function generatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'generated_by');
    }
}
