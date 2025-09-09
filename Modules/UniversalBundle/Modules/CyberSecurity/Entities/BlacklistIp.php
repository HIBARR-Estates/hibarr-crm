<?php

namespace Modules\CyberSecurity\Entities;

use App\Models\BaseModel;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class BlacklistIp extends BaseModel
{
    use HasFactory;

    protected $guarded = ['id'];

}
