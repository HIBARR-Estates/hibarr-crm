<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class ReferralCode extends Model
{
    use HasFactory;

    protected $table = 'referral_codes';

    protected $fillable = [
        'employee_id',
        'referral_code',
    ];

    /**
     * Get the employee details associated with this referral code.
     */
    public function employee(): BelongsTo
    {
        return $this->belongsTo(EmployeeDetails::class, 'employee_id');
    }


    
    /**
     * Generate a new unique referral code.
     */
    public static function generateCode(?string $companyName = null): string
    {
        // Get the company prefix from settings if needed, or from the employee's company
        $companyPrefix = $companyName ? Str::upper(Str::substr($companyName, 0, 3)).'-' : '';

        do {
            $code = $companyPrefix . Str::upper(Str::random(8));
        } while (self::where('referral_code', $code)->exists());

        return $code;
    }

    // getReferralLink
    public function getReferralLink(): string
    {
        // TODO: Ensure that a referral route is fleshed out
        return url('/referral/' . $this->referral_code);
    }
}