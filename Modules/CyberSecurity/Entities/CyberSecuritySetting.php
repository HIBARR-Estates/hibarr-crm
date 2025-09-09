<?php

namespace Modules\CyberSecurity\Entities;

use App\Models\BaseModel;
use Illuminate\Database\Eloquent\Model;

class CyberSecuritySetting extends BaseModel
{
    protected $guarded = ['id'];

    const MODULE_NAME = 'cybersecurity';

}
