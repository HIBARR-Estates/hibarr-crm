<?php

namespace App\Services\FinancialAssessment;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The starting vocabulary for a company's financial assessments: kinds, the
 * types inside them, and the crypto assets rates can be fetched for.
 *
 * Idempotent and non-destructive: a row that already exists (matched by key
 * or ticker) is left exactly as the admin has it, so a rename or deactivation
 * survives re-seeding. Plain query builder on purpose, so it behaves the same
 * from a migration, an observer or a test, regardless of global scopes.
 */
class FinancialAssessmentDefaults
{
    /** @return list<array{key: string, label: string, role: string, sort: int}> */
    public static function kinds(): array
    {
        return [
            ['key' => 'income', 'label' => 'Income', 'role' => 'income', 'sort' => 10],
            ['key' => 'saving_asset', 'label' => 'Savings and assets', 'role' => 'asset', 'sort' => 20],
            ['key' => 'funding_source', 'label' => 'Funding sources', 'role' => 'funding', 'sort' => 30],
            ['key' => 'commitment', 'label' => 'Commitments', 'role' => 'commitment', 'sort' => 40],
        ];
    }

    /** @return list<array{key: string, label: string, kind: string, frequency: string, certainty: string}> */
    public static function types(): array
    {
        return [
            ['key' => 'salary', 'label' => 'Salary', 'kind' => 'income', 'frequency' => 'monthly', 'certainty' => 'confirmed'],
            ['key' => 'rent', 'label' => 'Rent', 'kind' => 'income', 'frequency' => 'monthly', 'certainty' => 'likely'],
            ['key' => 'pension', 'label' => 'Pension', 'kind' => 'income', 'frequency' => 'monthly', 'certainty' => 'confirmed'],
            ['key' => 'business_income', 'label' => 'Business income', 'kind' => 'income', 'frequency' => 'monthly', 'certainty' => 'likely'],
            ['key' => 'bank', 'label' => 'Bank', 'kind' => 'saving_asset', 'frequency' => 'once', 'certainty' => 'confirmed'],
            ['key' => 'crypto', 'label' => 'Crypto', 'kind' => 'saving_asset', 'frequency' => 'once', 'certainty' => 'likely'],
            ['key' => 'investments', 'label' => 'Investments', 'kind' => 'saving_asset', 'frequency' => 'once', 'certainty' => 'likely'],
            ['key' => 'property_sale', 'label' => 'Property sale', 'kind' => 'funding_source', 'frequency' => 'once', 'certainty' => 'likely'],
            ['key' => 'family_gift', 'label' => 'Family gift', 'kind' => 'funding_source', 'frequency' => 'once', 'certainty' => 'uncertain'],
            ['key' => 'inheritance', 'label' => 'Inheritance', 'kind' => 'funding_source', 'frequency' => 'once', 'certainty' => 'likely'],
            ['key' => 'mortgage', 'label' => 'Mortgage', 'kind' => 'commitment', 'frequency' => 'monthly', 'certainty' => 'confirmed'],
            ['key' => 'loan_repayment', 'label' => 'Loan repayment', 'kind' => 'commitment', 'frequency' => 'monthly', 'certainty' => 'confirmed'],
            ['key' => 'child_support', 'label' => 'Child support', 'kind' => 'commitment', 'frequency' => 'monthly', 'certainty' => 'confirmed'],
        ];
    }

    /** @return list<array{ticker: string, provider_id: string, name: string}> */
    public static function cryptoAssets(): array
    {
        return [
            ['ticker' => 'BTC', 'provider_id' => 'bitcoin', 'name' => 'Bitcoin'],
            ['ticker' => 'ETH', 'provider_id' => 'ethereum', 'name' => 'Ethereum'],
            ['ticker' => 'USDT', 'provider_id' => 'tether', 'name' => 'Tether'],
            ['ticker' => 'USDC', 'provider_id' => 'usd-coin', 'name' => 'USD Coin'],
            ['ticker' => 'SOL', 'provider_id' => 'solana', 'name' => 'Solana'],
        ];
    }

    public static function seedForCompany(int $companyId): void
    {
        // A company can be created before the tables exist (fresh install order, rolling deploy).
        if (! Schema::hasTable('financial_assessment_kinds')
            || ! Schema::hasTable('financial_assessment_line_types')
            || ! Schema::hasTable('financial_crypto_assets')) {
            return;
        }

        $now = now();

        $kindIds = [];
        foreach (self::kinds() as $kind) {
            $id = DB::table('financial_assessment_kinds')
                ->where('company_id', $companyId)->where('key', $kind['key'])->value('id');

            if (! $id) {
                $id = DB::table('financial_assessment_kinds')->insertGetId([
                    'company_id' => $companyId,
                    'key' => $kind['key'],
                    'label' => $kind['label'],
                    'role' => $kind['role'],
                    'sort_order' => $kind['sort'],
                    'is_active' => true,
                    'is_system' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            $kindIds[$kind['key']] = (int) $id;
        }

        foreach (self::types() as $index => $type) {
            $exists = DB::table('financial_assessment_line_types')
                ->where('company_id', $companyId)->where('key', $type['key'])->exists();

            if ($exists) {
                continue;
            }

            DB::table('financial_assessment_line_types')->insert([
                'company_id' => $companyId,
                'kind_id' => $kindIds[$type['kind']],
                'key' => $type['key'],
                'label' => $type['label'],
                'default_frequency' => $type['frequency'],
                'default_certainty' => $type['certainty'],
                'sort_order' => ($index + 1) * 10,
                'is_active' => true,
                'is_system' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        foreach (self::cryptoAssets() as $asset) {
            $exists = DB::table('financial_crypto_assets')
                ->where('company_id', $companyId)->where('ticker', $asset['ticker'])->exists();

            if ($exists) {
                continue;
            }

            DB::table('financial_crypto_assets')->insert([
                'company_id' => $companyId,
                'ticker' => $asset['ticker'],
                'provider_id' => $asset['provider_id'],
                'name' => $asset['name'],
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }
}
