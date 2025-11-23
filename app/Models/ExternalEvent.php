<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ExternalEvent extends Model
{
    use HasFactory, HasCompany;

    protected $fillable = [
        'company_id',
        'event_type',
        'payload',
        'metadata',
        'status',
        'processed_at',
        'error_message',
    ];

    protected $casts = [
        'payload' => 'array',
        'metadata' => 'array',
        'processed_at' => 'datetime',
    ];
}
