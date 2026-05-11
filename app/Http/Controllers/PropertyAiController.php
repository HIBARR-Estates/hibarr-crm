<?php

namespace App\Http\Controllers;

use App\Contracts\PropertyDescriptionInterface;
use App\Http\Requests\GeneratePropertyDescriptionRequest;
use Illuminate\Http\JsonResponse;

class PropertyAiController extends AccountBaseController
{
    public function __construct(
        private PropertyDescriptionInterface $propertyDescription,
    ) {
        parent::__construct();
    }

    public function generateDescription(GeneratePropertyDescriptionRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $description = $this->propertyDescription->generate(
            $validated['form_data'],
            $validated['feature_context'] ?? null,
        );

        return response()->json([
            'description' => $description,
        ]);
    }
}
