<?php

namespace Modules\Performance\Entities;

use App\Models\BaseModel;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class KeyResults extends BaseModel
{

    use HasCompany;

    protected $table = 'key_results';

    public function objective(): BelongsTo
    {
        return $this->belongsTo(Objective::class, 'objective_id');
    }

    public function metrics(): BelongsTo
    {
        return $this->belongsTo(KeyResultsMetrics::class, 'metrics_id');
    }

    public function checkIns(): HasMany
    {
        return $this->hasMany(CheckIn::class, 'key_result_id');
    }

    public function calculateProgress()
    {
        $latestCheckInVal = CheckIn::where('key_result_id', $this->id)->latest()->first();
        $currentVal = $latestCheckInVal ? $latestCheckInVal->current_value : $this->current_value;

        return round($currentVal / $this->target_value * 100, 2);
    }

}
