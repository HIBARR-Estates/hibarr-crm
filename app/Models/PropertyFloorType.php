<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;

/**
 * Property Floor Type lookup model.
 *
 * Stores user-manageable floor types (Basement -1, Ground Floor, 1–15+, etc.)
 *
 * @property int         $id
 * @property int         $company_id
 * @property string      $name         Unique per company
 * @property string      $label        Human-readable display label
 * @property string|null $description
 */
class PropertyFloorType extends BaseModel
{
    use HasFactory, HasCompany;

    protected $table = 'property_floor_types';

    protected $fillable = [
        'company_id',
        'name',
        'label',
        'description',
    ];

    protected $hidden = ['pivot'];
}
