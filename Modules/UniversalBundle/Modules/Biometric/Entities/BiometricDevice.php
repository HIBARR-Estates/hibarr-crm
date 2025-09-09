<?php

namespace Modules\Biometric\Entities;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Model;

class BiometricDevice extends Model
{
    use HasCompany;

    protected $guarded = ['id'];

    protected $casts = [
        'last_online' => 'datetime',
    ];
}
