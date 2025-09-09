<?php

namespace Modules\QRCode\Entities;

use App\Models\BaseModel;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Modules\QRCode\Database\factories\QrCodeDataFactory;
use Modules\QRCode\Enums\Type;

class QrCodeData extends BaseModel
{

    use HasCompany, HasFactory;

    const LOGO_PATH = 'qrcode-logo';

    protected $guarded = ['id'];

    protected $casts = [
        'type' => Type::class,
        'form_data' => 'json',
    ];

    protected $appends = [
        'logo_url',
    ];

    /**
     * Create a new factory instance for the model.
     *
     * @return \Illuminate\Database\Eloquent\Factories\Factory
     */
    protected static function newFactory()
    {
        return QrCodeDataFactory::new();
    }

    public function logoUrl(): Attribute
    {
        return Attribute::make(
            get: function () {
                if ($this->logo) {
                    return str($this->logo)->contains('http') ? $this->logo : asset_url_local_s3(self::LOGO_PATH . '/' . $this->logo);
                }

                return null;
            },
        );
    }

}
