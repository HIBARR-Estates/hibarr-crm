<?php

namespace Modules\CyberSecurity\Entities;

use App\Models\BaseModel;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class BlacklistEmail extends BaseModel
{
    use HasFactory;

    protected $guarded = ['id'];
}
