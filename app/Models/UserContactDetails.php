<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserContactDetails extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'telegram_chat_id',
        'telegram_username',
        'whatsapp_username',
        'instagram_username',
    ];

    // relationships
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}