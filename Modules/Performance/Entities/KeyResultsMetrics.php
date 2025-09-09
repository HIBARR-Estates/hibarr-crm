<?php

namespace Modules\Performance\Entities;

use App\Models\BaseModel;
use App\Traits\HasCompany;

class KeyResultsMetrics extends BaseModel
{
    use HasCompany;

    protected $table = 'key_results_metrics';

    public static function defaultKeyResultsMetrics($company)
    {
        return [
            [
                'company_id' => $company->id,
                'name' => 'Percentage',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'company_id' => $company->id,
                'name' => 'Revenue',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'company_id' => $company->id,
                'name' => 'Units',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ];
    }
    public function keyResults()
    {
        return $this->hasMany(KeyResults::class, 'metrics_id');
    }
}
