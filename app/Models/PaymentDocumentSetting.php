<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * One company's settings for deal payment invoices and receipts: the seller
 * details, tax office approval, number ranges, KDV rate and bank details.
 *
 * @property int $id
 * @property int $company_id
 * @property string|null $legal_name
 * @property string|null $address
 * @property string|null $phone
 * @property string|null $email
 * @property string|null $tax_office
 * @property string|null $tax_number
 * @property string|null $registration_number
 * @property string|null $logo
 * @property string $brand_color
 * @property string $invoice_series
 * @property int $invoice_number_start
 * @property int|null $invoice_number_end
 * @property string $receipt_series
 * @property int $receipt_number_start
 * @property int|null $receipt_number_end
 * @property int $number_padding
 * @property float $vat_rate
 * @property string|null $approval_number
 * @property bool $show_stamp_duty
 * @property bool $show_approval_seal
 * @property string|null $bank_name
 * @property string|null $bank_account_name
 * @property string|null $iban
 * @property string|null $swift
 * @property int $payment_term_days
 * @property bool $show_try_equivalent
 * @property bool $bilingual_labels
 * @property string|null $footer_note
 * @property int|null $updated_by
 * @property-read string|null $logo_url
 */
class PaymentDocumentSetting extends Model
{
    public const LOGO_PATH = 'payment-document-logos';

    public const DEFAULTS = [
        'brand_color' => '#1d4d5c',
        'invoice_series' => 'A',
        'invoice_number_start' => 1,
        'invoice_number_end' => null,
        'receipt_series' => 'T',
        'receipt_number_start' => 1,
        'receipt_number_end' => null,
        'number_padding' => 6,
        'vat_rate' => 16,
        'show_stamp_duty' => true,
        'show_approval_seal' => true,
        'payment_term_days' => 14,
        'show_try_equivalent' => true,
        'bilingual_labels' => true,
    ];

    protected $guarded = ['id', 'company_id'];

    protected $casts = [
        'invoice_number_start' => 'integer',
        'invoice_number_end' => 'integer',
        'receipt_number_start' => 'integer',
        'receipt_number_end' => 'integer',
        'number_padding' => 'integer',
        'vat_rate' => 'float',
        'show_stamp_duty' => 'boolean',
        'show_approval_seal' => 'boolean',
        'payment_term_days' => 'integer',
        'show_try_equivalent' => 'boolean',
        'bilingual_labels' => 'boolean',
    ];

    protected $appends = ['logo_url'];

    /**
     * The company's saved settings, or an unsaved row prefilled from the
     * company profile so a fresh company still prints its own name and
     * address before anyone opens the settings page.
     */
    public static function forCompany(int $companyId): self
    {
        $existing = self::query()->where('company_id', $companyId)->first();
        if ($existing) {
            return $existing;
        }

        $setting = new self(self::DEFAULTS);
        $setting->company_id = $companyId;

        foreach (self::companyProfile($companyId) as $key => $value) {
            $setting->{$key} = $value;
        }

        return $setting;
    }

    public function getLogoUrlAttribute(): ?string
    {
        if (! $this->logo) {
            return null;
        }

        return function_exists('asset_url_local_s3')
            ? asset_url_local_s3(self::LOGO_PATH.'/'.$this->logo)
            : null;
    }

    /**
     * @return array<string, string|null>
     */
    private static function companyProfile(int $companyId): array
    {
        if (! Schema::hasTable('companies')) {
            return [];
        }

        $columns = ['id', 'company_name'];
        foreach (['address', 'company_email', 'company_phone'] as $column) {
            if (Schema::hasColumn('companies', $column)) {
                $columns[] = $column;
            }
        }

        $row = DB::table('companies')->where('id', $companyId)->first($columns);
        if ($row === null) {
            return [];
        }

        $profile = [
            'legal_name' => $row->company_name ?? null,
            'address' => $row->address ?? null,
            'email' => $row->company_email ?? null,
            'phone' => $row->company_phone ?? null,
        ];

        if (Schema::hasTable('company_addresses')) {
            $office = DB::table('company_addresses')
                ->where('company_id', $companyId)
                ->orderByDesc('is_default')
                ->first();
            if ($office) {
                $profile['address'] = ($office->address ?? null) ?: $profile['address'];
                $profile['tax_number'] = $office->tax_number ?? null;
            }
        }

        return $profile;
    }
}
