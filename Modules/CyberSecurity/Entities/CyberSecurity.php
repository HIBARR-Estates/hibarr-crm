<?php

namespace Modules\CyberSecurity\Entities;

use App\Models\BaseModel;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class CyberSecurity extends BaseModel
{
    use HasFactory;

    protected $guarded = ['id'];
}
