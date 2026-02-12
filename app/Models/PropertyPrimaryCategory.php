<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;

/**
 * Property Primary Category lookup model.
 *
 * Stores user-manageable primary categories (Residential, Commercial, Land, etc.)
 *
 * @property int         $id
 * @property int         $company_id
 * @property string      $name         Unique per company
 * @property string      $label        Human-readable display label
 * @property string|null $description
 */
class PropertyPrimaryCategory extends BaseModel
{
    use HasFactory, HasCompany;

    protected $table = 'property_primary_categories';

    protected $fillable = [
        'company_id',
        'name',
        'label',
        'description',
    ];

    protected $hidden = ['pivot'];
}
