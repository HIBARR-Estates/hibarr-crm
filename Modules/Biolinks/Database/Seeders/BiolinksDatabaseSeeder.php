<?php

namespace Modules\Biolinks\Database\Seeders;

use App\Models\Company;
use Illuminate\Support\Str;
use Illuminate\Database\Seeder;
use Modules\Biolinks\Entities\Biolink;
use Modules\Biolinks\Entities\BiolinkBlocks;
use Modules\Biolinks\Entities\BiolinkSetting;
use Modules\Biolinks\Enums\Font;
use Modules\Biolinks\Enums\Heading;
use Modules\Biolinks\Enums\PaypalType;

class BiolinksDatabaseSeeder extends Seeder
{

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        config(['app.seeding' => true]);

        $faker = \Faker\Factory::create();

        if (! app()->environment('codecanyon')) {
            $companies = Company::all();

            foreach ($companies as $company) {
                Biolink::factory()->count(5)->make()->each(function (Biolink $biolink) use ($faker, $company) {
                    $biolink->company_id = $company->id;
                    $biolink->save();

                    BiolinkSetting::create([
                        'custom_color_one' => $faker->hexColor,
                        'custom_color_two' => $faker->hexColor,
                        'biolink_id' => $biolink->id,
                    ]);

                    BiolinkBlocks::create([
                        'biolink_id' => $biolink->id,
                        'type' => 'heading',
                        'name' => $faker->sentence,
                        'text_color' => $faker->hexColor,
                        'heading_type' => Heading::H1,
                        'position' => 1,
                    ]);

                    BiolinkBlocks::create([
                        'biolink_id' => $biolink->id,
                        'type' => 'paragraph',
                        'paragraph' => $faker->paragraph,
                        'background_color' => $faker->hexColor,
                        'position' => 2,
                    ]);
                    BiolinkBlocks::create([
                        'biolink_id' => $biolink->id,
                        'type' => 'link',
                        'name' => $faker->name(),
                        'url' => $faker->url,
                        'background_color' => $faker->hexColor,
                        'position' => 3,
                    ]);
                    BiolinkBlocks::create([
                        'biolink_id' => $biolink->id,
                        'type' => 'youtube',
                        'name' => 'Youtube',
                        'url' => 'https://www.youtube.com/watch?v=6v2L2UGZJAM',
                        'position' => 4,
                    ]);
                    BiolinkBlocks::create([
                        'biolink_id' => $biolink->id,
                        'type' => 'email-collector',
                        'name' => $faker->name(),
                        'background_color' => $faker->hexColor,
                        'position' => 5,
                    ]);
                    BiolinkBlocks::create([
                        'biolink_id' => $biolink->id,
                        'type' => 'paypal',
                        'name' => $faker->name(),
                        'email' => $faker->email,
                        'paypal_type' => PaypalType::DONATION,
                        'product_title' => $faker->sentence,
                        'currency_code' => 'USD',
                        'price' => $faker->randomFloat(2, 1, 100),
                        'position' => 6,
                    ]);
                });

            }
        }

        config(['app.seeding' => false]);

    }

}
