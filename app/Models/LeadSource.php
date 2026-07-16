<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * App\Models\LeadSource
 *
 * @property int $id
 * @property string $type
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property int|null $added_by
 * @property int|null $last_updated_by
 * @property-read mixed $icon
 * @property-read \Illuminate\Database\Eloquent\Collection|\App\Models\Lead[] $leads
 * @property-read int|null $leads_count
 * @method static \Illuminate\Database\Eloquent\Builder|LeadSource newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|LeadSource newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|LeadSource query()
 * @method static \Illuminate\Database\Eloquent\Builder|LeadSource whereAddedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder|LeadSource whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder|LeadSource whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder|LeadSource whereLastUpdatedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder|LeadSource whereType($value)
 * @method static \Illuminate\Database\Eloquent\Builder|LeadSource whereUpdatedAt($value)
 * @property int|null $company_id
 * @property-read \App\Models\Company|null $company
 * @method static \Illuminate\Database\Eloquent\Builder|LeadSource whereCompanyId($value)
 * @mixin \Eloquent
 */
class LeadSource extends BaseModel
{

    use HasCompany;

    protected $table = 'lead_sources';

    protected $guarded = ['id'];

    public static function boot()
    {
        parent::boot();

        static::addGlobalScope('order', function (\Illuminate\Database\Eloquent\Builder $builder) {
            $builder->orderBy('sort_order', 'asc');
        });

        static::creating(function ($model) {
            if (is_null($model->sort_order)) {
                $maxOrder = static::withoutGlobalScope('order')->where('company_id', $model->company_id)->max('sort_order');
                $model->sort_order = is_numeric($maxOrder) ? $maxOrder + 1 : 1;
            }
        });
    }

    public function leads(): HasMany
    {
        return $this->hasMany(Lead::class, 'source_id')->orderBy('column_priority');
    }

    /**
     * Resolve a source from free text (e.g. a spreadsheet cell during import),
     * matching case-insensitively against the source type. Returns null on no
     * match rather than creating one, so callers should treat that as "leave
     * unset".
     */
    public static function resolveFromText(int $companyId, ?string $value): ?self
    {
        $value = trim((string) $value);

        if ($value === '') {
            return null;
        }

        return static::where('company_id', $companyId)
            ->whereRaw('LOWER(type) = ?', [mb_strtolower($value)])
            ->first();
    }

}
