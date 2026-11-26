<?php

namespace App\Models;

use App\Enums\PackageCommissionType;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * What one agent earns on one package, in either role.
 *
 * As the closer: an override of the package's default commission. As the
 * referrer: the commission a partner earns when a lead they referred buys this
 * package. One row holds both, so an agent who is the closer on a package and
 * also refers deals onto it is configured, and read, in one place.
 *
 * @property int $id
 * @property int $company_id
 * @property int $agent_id
 * @property int $package_id
 * @property PackageCommissionType|null $commission_type null: no closer override, the package default applies
 * @property float|null $commission_value null when commission_type is None
 * @property PackageCommissionType|null $referral_commission_type null: no referral terms on this package
 * @property float|null $referral_commission_value
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
        'referral_commission_type',
        'referral_commission_value',
    ];

    protected $casts = [
        'commission_type' => PackageCommissionType::class,
        'commission_value' => 'decimal:2',
        'referral_commission_type' => PackageCommissionType::class,
        'referral_commission_value' => 'decimal:2',
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
