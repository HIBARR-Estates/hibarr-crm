<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;

/**
 * Property Type lookup model.
 *
 * Stores user-manageable property types (Villa, Apartment, etc.)
 * that were previously hardcoded as constants.
 *
 * @property int    $id
 * @property int    $company_id
 * @property string $name        Unique per company, used as string reference in properties.property_type
 * @property string $label       Human-readable display label
 * @property string|null $description
 */
class PropertyType extends BaseModel
{
    use HasFactory, HasCompany;

    protected $table = 'property_types';

    protected $fillable = [
        'company_id',
        'name',
        'label',
        'description',
    ];

    protected $hidden = ['pivot'];

    /**
     * Get all properties of this type.
     */
    public function properties()
    {
        return $this->hasMany(Property::class, 'property_type', 'name');
    }
}
