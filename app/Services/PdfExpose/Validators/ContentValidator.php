<?php

namespace App\Services\PdfExpose\Validators;

use App\Services\PdfExpose\Configuration\ExposeConfiguration;

class ContentValidator
{
    /**
     * Validation rules per entity type
     */
    private array $rules = [
        'property' => [
            'required' => [
                'title' => 'Property title is required',
                'price' => 'Property price is required',
                'address' => 'Property address is required',
            ],
            'recommended' => [
                'images' => 'Property images are recommended (at least 3)',
                'description' => 'Property description is recommended',
                'bedrooms' => 'Number of bedrooms is recommended',
                'bathrooms' => 'Number of bathrooms is recommended',
                'area' => 'Property area is recommended',
            ],
            'optimal' => [
                'features' => 'Property features enhance the expose',
                'agent.name' => 'Agent information improves credibility',
            ]
        ],
        'developer_project' => [
            'required' => [
                'title' => 'Project title is required',
                'developer' => 'Developer name is required',
            ],
            'recommended' => [
                'completion_date' => 'Completion date is recommended',
                'units' => 'Unit information is recommended',
            ],
        ]
    ];

    /**
     * Validate configuration and return warnings
     *
     * @return array Array of warnings with severity levels
     */
    public function validate(ExposeConfiguration $config): array
    {
        $warnings = [];
        $rules = $this->rules[$config->entityType] ?? [];

        // Check required fields
        foreach ($rules['required'] ?? [] as $field => $message) {
            if (!$config->has($field) || empty($config->get($field))) {
                $warnings[] = [
                    'severity' => 'error',
                    'field' => $field,
                    'message' => $message,
                ];
            }
        }

        // Check recommended fields
        foreach ($rules['recommended'] ?? [] as $field => $message) {
            $value = $config->get($field);
            
            // Special handling for images
            if ($field === 'images') {
                if (empty($value) || count($value) < 3) {
                    $warnings[] = [
                        'severity' => 'warning',
                        'field' => $field,
                        'message' => $message,
                    ];
                }
            } elseif (!$config->has($field) || empty($value)) {
                $warnings[] = [
                    'severity' => 'warning',
                    'field' => $field,
                    'message' => $message,
                ];
            }
        }

        // Check optimal fields
        foreach ($rules['optimal'] ?? [] as $field => $message) {
            if (!$config->has($field) || empty($config->get($field))) {
                $warnings[] = [
                    'severity' => 'info',
                    'field' => $field,
                    'message' => $message,
                ];
            }
        }

        // Check for text overflow risks
        $overflowWarnings = $this->checkTextOverflow($config);
        $warnings = array_merge($warnings, $overflowWarnings);

        return $warnings;
    }

    /**
     * Check for potential text overflow issues
     */
    private function checkTextOverflow(ExposeConfiguration $config): array
    {
        $warnings = [];
        $maxLengths = [
            'title' => 100,
            'description' => 1500,
        ];

        foreach ($maxLengths as $field => $maxLength) {
            $value = $config->get($field, '');
            $length = strlen($value);

            if ($length > $maxLength) {
                $warnings[] = [
                    'severity' => 'warning',
                    'field' => $field,
                    'message' => "The {$field} is very long ({$length} chars). It may overflow on the PDF.",
                ];
            }
        }

        return $warnings;
    }

    /**
     * Check if configuration has blocking errors
     */
    public function hasBlockingErrors(array $warnings): bool
    {
        return collect($warnings)
            ->where('severity', 'error')
            ->isNotEmpty();
    }
}