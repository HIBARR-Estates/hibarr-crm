<?php

namespace Modules\Biolinks\Database\factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Modules\Biolinks\Entities\Biolink;

class BiolinkFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var string
     */
    protected $model = Biolink::class;

    /**
     * Define the model's default state.
     *
     * @return array
     */
    public function definition()
    {

        $faker = $this->faker;

        return [
            'page_link' => $faker->slug($nbWords = 2),
        ];
    }

}
