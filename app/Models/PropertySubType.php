<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;

/**
 * Property Sub Type / Unit Style lookup model.
 *
 * Stores user-manageable unit styles (Standard, Penthouse, Duplex, etc.)
 * that were previously hardcoded as constants.
 *
 * @property int         $id
 * @property int         $company_id
 * @property string      $name         Unique per company, used as string reference in properties.unit_style
 * @property string      $label        Human-readable display label
 * @property string|null $description
 * @property string|null $parent_type  References property_types.name
 */
class PropertySubType extends BaseModel
{
    use HasFactory, HasCompany;

    protected $table = 'property_sub_types';

    protected $fillable = [
        'company_id',
        'name',
        'label',
        'description',
        'parent_type',
    ];

    protected $hidden = ['pivot'];

    /**
     * Get the parent property type (by name).
     */
    public function parentPropertyType()
    {
        return $this->belongsTo(PropertyType::class, 'parent_type', 'name');
    }

    /**
     * Get all properties using this sub type/unit style.
     */
    public function properties()
    {
        return $this->hasMany(Property::class, 'unit_style', 'name');
    }
}
