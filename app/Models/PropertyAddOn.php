<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;

/**
 * Property Add-On lookup model.
 *
 * @property int         $id
 * @property int         $company_id
 * @property string      $name
 * @property string      $label
 * @property string|null $description
 */
class PropertyAddOn extends BaseModel
{
    use HasFactory, HasCompany;

    protected $table = 'property_add_ons';

    protected $fillable = [
        'company_id',
        'name',
        'label',
        'description',
    ];

    protected $hidden = ['pivot'];
}
