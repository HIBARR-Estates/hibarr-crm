<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * App\Models\Package
 *
 * @property int $id
 * @property string $name
 * @property float $value
 * @property string $currency
 * @property string|null $description
 * @property int|null $company_id
 * @property string|null $customer_type_name
 * @property string|null $customer_type_description
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Company|null $company
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Deal> $deals
 * @property-read int|null $deals_count
 */
class Package extends BaseModel
{
    use HasFactory, HasCompany, SoftDeletes;

    protected $fillable = [
        'name',
        'value',
        'currency',
        'description',
        'company_id',
        'customer_type_name',
        'customer_type_description',
    ];

    protected $casts = [
        'value' => 'decimal:2',
    ];

    /**
     * Get the deals associated with this package.
     */
    public function deals(): BelongsToMany
    {
        return $this->belongsToMany(Deal::class, 'deal_package');
    }

    /**
     * Get the company that owns the package.
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function packagePipeline(): HasOne
    {
        return $this->hasOne(PackagePipeline::class, 'package_id');
    }

    public function routingTriggers(): HasMany
    {
        return $this->hasMany(PackageRoutingTrigger::class, 'package_id');
    }
}
