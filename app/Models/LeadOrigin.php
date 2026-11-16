<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Where a lead entered the CRM from (Marketing, and whatever else a company
 * defines in Lead settings). Set automatically by the marketing lead flow;
 * filterable on the leads list and usable in lead automation conditions.
 *
 * @property int $id
 * @property int $company_id
 * @property string $name
 * @property int $sort_order
 * @property int|null $added_by
 * @property int|null $last_updated_by
 */
class LeadOrigin extends BaseModel
{
    use HasCompany;

    /** The option every company starts with; the marketing flow's default. */
    public const MARKETING = 'Marketing';

    protected $table = 'lead_origins';

    protected $guarded = ['id'];

    public static function boot()
    {
        parent::boot();

        static::addGlobalScope('order', function (Builder $builder) {
            $builder->orderBy('sort_order')->orderBy('id');
        });

        static::creating(function (self $model) {
            if ($model->sort_order === null || $model->sort_order === 0) {
                $max = static::withoutGlobalScope('order')
                    ->where('company_id', $model->company_id)
                    ->max('sort_order');
                $model->sort_order = is_numeric($max) ? ((int) $max) + 1 : 1;
            }
        });
    }

    public function leads(): HasMany
    {
        return $this->hasMany(Lead::class, 'lead_origin_id');
    }

    /** The company's "Marketing" origin, created if a company never had one. */
    public static function marketingFor(int $companyId): self
    {
        return static::withoutGlobalScopes()->firstOrCreate(
            ['company_id' => $companyId, 'name' => self::MARKETING],
        );
    }
}
