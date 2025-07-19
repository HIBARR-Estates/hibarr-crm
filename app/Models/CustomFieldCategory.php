<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * App\Models\CustomFieldCategory
 *
 * @property int $id
 * @property string $name
 * @property int|null $custom_field_group_id
 * @property int|null $company_id
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Company|null $company
 * @property-read \App\Models\CustomFieldGroup|null $customFieldGroup
 * @property-read \Illuminate\Database\Eloquent\Collection|\App\Models\CustomField[] $customFields
 * @property-read int|null $custom_fields_count
 * @method static \Illuminate\Database\Eloquent\Builder|CustomFieldCategory newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|CustomFieldCategory newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|CustomFieldCategory query()
 * @method static \Illuminate\Database\Eloquent\Builder|CustomFieldCategory whereCompanyId($value)
 * @method static \Illuminate\Database\Eloquent\Builder|CustomFieldCategory whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder|CustomFieldCategory whereCustomFieldGroupId($value)
 * @method static \Illuminate\Database\Eloquent\Builder|CustomFieldCategory whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder|CustomFieldCategory whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder|CustomFieldCategory whereUpdatedAt($value)
 * @mixin \Eloquent
 */
class CustomFieldCategory extends BaseModel
{
    use HasCompany;

    protected $fillable = [
        'name',
        'custom_field_group_id',
        'company_id'
    ];

    protected $table = 'custom_field_categories';

    public function customFieldGroup(): BelongsTo
    {
        return $this->belongsTo(CustomFieldGroup::class, 'custom_field_group_id');
    }

    public function customFields(): HasMany
    {
        return $this->hasMany(CustomField::class, 'custom_field_category_id');
    }
} 