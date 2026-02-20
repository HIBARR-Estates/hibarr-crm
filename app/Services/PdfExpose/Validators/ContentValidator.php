<?php

namespace App\Services\PdfExpose\Validators;

use App\Services\PdfExpose\Configuration\ExposeConfiguration;

class ContentValidator
{
    /**
     * Required image counts per tag for expose template
     */
    private array $imageRequirements = [
        'hero' => ['min' => 1, 'label' => 'Hero image'],
        'exterior' => ['min' => 5, 'label' => 'Exterior images'],
        'interior' => ['min' => 2, 'label' => 'Interior images'],
        'facilities' => ['min' => 6, 'label' => 'Facilities images'],
        'floor-plan' => ['min' => 1, 'label' => 'Floor plan'],
        'area' => ['min' => 1, 'label' => 'Area/location image'],
    ];

    /**
     * Validation rules per entity type
     */
    private array $rules = [
        'property' => [
            'required' => [
                'title' => 'Property title is required',
                'price' => 'Property price is required',
                'city' => 'Property city is required',
            ],
            'recommended' => [
                'description' => 'Property description is recommended',
                'bedrooms' => 'Number of bedrooms is recommended',
                'bathrooms' => 'Number of bathrooms is recommended',
                'living_area_sqm' => 'Living area (sqm) is recommended',
                'property_type' => 'Property type is recommended',
            ],
            'optimal' => [
                'features' => 'Property features enhance the expose',
                'agent.name' => 'Agent information improves credibility',
                'distances' => 'Distance information enhances the infrastructure page',
            ]
        ],
        'developer_project' => [
            'required' => [
                'title' => 'Project title is required',
                'developer' => 'Developer name is required',
                'city' => 'Project city/area is required',
            ],
            'recommended' => [
                'description' => 'Project description is recommended',
                'completion_date' => 'Completion date is recommended',
                'construction_status' => 'Construction status is recommended',
                'starting_price' => 'Starting price is recommended',
                'unit_types' => 'Unit type summaries enhance the brochure',
            ],
            'optimal' => [
                'facilities' => 'Facility information enhances the brochure',
                'distances' => 'Distance information enhances the infrastructure page',
                'payment_plan' => 'Payment plan details improve buyer engagement',
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

        // Check image counts for property and project exposes
        if (in_array($config->entityType, ['property', 'developer_project'])) {
            $imageWarnings = $this->checkImageCounts($config);
            $warnings = array_merge($warnings, $imageWarnings);
        }

        return $warnings;
    }

    /**
     * Check if required image counts are met
     */
    private function checkImageCounts(ExposeConfiguration $config): array
    {
        $warnings = [];
        $assets = $config->get('assets', []);

        foreach ($this->imageRequirements as $tag => $requirement) {
            $count = count($assets[$tag] ?? []);
            $minRequired = $requirement['min'];
            $label = $requirement['label'];

            if ($count === 0) {
                // Critical - no images at all for this tag
                $severity = in_array($tag, ['hero', 'exterior']) ? 'error' : 'warning';
                $warnings[] = [
                    'severity' => $severity,
                    'field' => "assets.{$tag}",
                    'message' => "{$label}: No images uploaded (requires {$minRequired})",
                ];
            } elseif ($count < $minRequired) {
                // Has some but not enough
                $warnings[] = [
                    'severity' => 'warning',
                    'field' => "assets.{$tag}",
                    'message' => "{$label}: {$count} of {$minRequired} required",
                ];
            }
        }

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