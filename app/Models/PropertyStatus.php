<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;

/**
 * Property Status lookup model.
 *
 * @property int         $id
 * @property int         $company_id
 * @property string      $name
 * @property string      $label
 * @property string|null $description
 */
class PropertyStatus extends BaseModel
{
    use HasFactory, HasCompany;

    protected $table = 'property_statuses';

    protected $fillable = [
        'company_id',
        'name',
        'label',
        'description',
    ];

    protected $hidden = ['pivot'];
}
