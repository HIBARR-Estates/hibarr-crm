<?php

namespace App\Models;

use App\Traits\HasCompany;

/** A crypto asset a line may be denominated in, mapped to its rate-provider id. */
class FinancialCryptoAsset extends BaseModel
{
    use HasCompany;

    protected $table = 'financial_crypto_assets';

    protected $fillable = [
        'company_id',
        'ticker',
        'provider_id',
        'name',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];
}
