<?php

namespace App\Models;

use App\Enums\PackageCommissionType;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Per-agent override of a package's default commission.
 *
 * @property int $id
 * @property int $company_id
 * @property int $agent_id
 * @property int $package_id
 * @property PackageCommissionType $commission_type
 * @property float|null $commission_value null when commission_type is None
 */
class AgentPackageCommissionRate extends BaseModel
{
    use HasCompany;

    protected $table = 'agent_package_commission_rates';

    protected $fillable = [
        'company_id',
        'agent_id',
        'package_id',
        'commission_type',
        'commission_value',
    ];

    protected $casts = [
        'commission_type' => PackageCommissionType::class,
        'commission_value' => 'decimal:2',
    ];

    public function agent(): BelongsTo
    {
        return $this->belongsTo(LeadAgent::class, 'agent_id');
    }

    public function package(): BelongsTo
    {
        return $this->belongsTo(Package::class, 'package_id');
    }
}
