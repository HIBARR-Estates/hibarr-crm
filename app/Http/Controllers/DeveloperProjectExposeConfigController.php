<?php

namespace App\Http\Controllers;

use App\Models\DeveloperProject;
use App\Models\DeveloperProjectExposeConfig;
use App\Helper\Reply;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Inertia\Inertia;

/**
 * DeveloperProjectExposeConfigController
 * 
 * @deprecated This controller is deprecated. Expose generation now uses
 *             DeveloperProjectController::generateProjectExpose() and
 *             DeveloperProjectController::generateUnitTypeExpose() which
 *             pull data directly from models and assets. The separate config
 *             store is no longer needed for new exposes.
 * 
 * Handles expose configuration management for developer projects.
 * The expose config contains all data needed to generate PDF exposes,
 * including logos, images, content blocks, and financial data.
 */
class DeveloperProjectExposeConfigController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
    }

    /**
     * Get expose config for a project.
     * 
     * Returns the config if it exists, along with the project
     * and its location for context.
     */
    public function show(Request $request, $projectId)
    {
        $project = DeveloperProject::where('company_id', user()->company_id)
            ->with(['location', 'exposeConfig'])
            ->findOrFail($projectId);

        $config = $project->exposeConfig;

        // For Inertia page render (expose config editor)
        // if (!$request->ajax() && !$request->wantsJson()) {
            return Inertia::render('DeveloperProjects/ExposeConfig', [
                'pageTitle' => "Expose Config: {$project->name}",
                'project' => $project,
                'config' => $config,
                'groupedImageKeys' => DeveloperProjectExposeConfig::GROUPED_IMAGE_KEYS,
                'infoBlockKeys' => DeveloperProjectExposeConfig::INFO_BLOCK_KEYS,
            ]);
        // }

        // return Reply::successWithData('Expose config fetched successfully', [
        //     'config' => $config,
        //     'project' => $project,
        // ]);
    }

    /**
     * Create or update expose config for a project.
     * 
     * Uses updateOrCreate to handle both new configs and updates
     * to existing ones. All fields are optional to allow partial updates.
     */
    public function upsert(Request $request, $projectId)
    {
        $project = DeveloperProject::where('company_id', user()->company_id)
            ->findOrFail($projectId);

        $validator = Validator::make($request->all(), [
            'logo' => 'nullable|array',
            'logo.dark' => 'nullable|string',
            'logo.light' => 'nullable|string',
            'project_overview' => 'nullable|array',
            'project_overview.city' => 'nullable|string',
            'project_overview.propertyTypes' => 'nullable|array',
            'project_overview.completionDate' => 'nullable|string',
            'project_overview.facilities' => 'nullable|array',
            'project_overview.propertyOverviewImage' => 'nullable|string',
            'grouped_images' => 'nullable|array',
            'generic_images' => 'nullable|array',
            'info_blocks' => 'nullable|array',
            'monetary_evaluation' => 'nullable|array',
            'contact_details' => 'nullable|array',
            'contact_details.agent' => 'nullable|array',
            'contact_details.agent.name' => 'nullable|string',
            'contact_details.agent.position' => 'nullable|string',
            'contact_details.phones' => 'nullable|array',
            'contact_details.emails' => 'nullable|array',
            'contact_details.websites' => 'nullable|array',
            'contact_details.addresses' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return Reply::error($validator->errors()->first());
        }

        $config = DeveloperProjectExposeConfig::updateOrCreate(
            ['developer_project_id' => $project->id],
            $request->only([
                'logo',
                'project_overview',
                'grouped_images',
                'generic_images',
                'info_blocks',
                'monetary_evaluation',
                'contact_details',
            ])
        );

        return Reply::successWithData('Expose config saved successfully', [
            'config' => $config->fresh(),
        ]);
    }

    /**
     * Update a specific section of the expose config.
     * 
     * Allows updating individual sections without replacing the entire config.
     * Useful for forms that edit one section at a time.
     * 
     * @param string $section One of: logo, project_overview, grouped_images, 
     *                        generic_images, info_blocks, monetary_evaluation, contact_details
     */
    public function updateSection(Request $request, $projectId, $section)
    {
        $project = DeveloperProject::where('company_id', user()->company_id)
            ->findOrFail($projectId);

        // Validate section is allowed
        $allowedSections = DeveloperProjectExposeConfig::ALLOWED_SECTIONS;
        
        if (!in_array($section, $allowedSections)) {
            return Reply::error("Invalid section: {$section}. Allowed sections: " . implode(', ', $allowedSections));
        }

        // Get or create config
        $config = $project->getOrCreateExposeConfig();

        // Update the specific section
        $data = $request->input('data');
        
        if (!$config->updateSection($section, $data)) {
            return Reply::error('Failed to update section');
        }

        return Reply::successWithData('Section updated successfully', [
            'config' => $config->fresh(),
            'section' => $section,
        ]);
    }

    /**
     * Generate expose PDF preview data.
     * 
     * Combines the stored config with provided client details
     * to create the complete data structure for PDF generation.
     */
    public function previewData(Request $request, $projectId)
    {
        $project = DeveloperProject::with(['location', 'exposeConfig', 'properties'])
            ->where('company_id', user()->company_id)
            ->findOrFail($projectId);

        if (!$project->exposeConfig) {
            return Reply::error('No expose configuration found for this project. Please configure the expose first.');
        }

        // Validate config has minimum required data
        $validation = $project->exposeConfig->validateForExport();
        
        if (!$validation['valid']) {
            return Reply::error('Expose config incomplete. Missing: ' . implode(', ', $validation['missing']));
        }

        // Build client details from request
        $clientDetails = [
            'name' => $request->input('client_name', ''),
            'email' => $request->input('client_email', ''),
        ];

        // Generate the full expose data structure
        $exposeData = $project->exposeConfig->toExposeConfigData($clientDetails);

        return Reply::successWithData('Expose preview data generated', [
            'exposeData' => $exposeData,
            'project' => [
                'id' => $project->id,
                'name' => $project->name,
                'property_count' => $project->properties->count(),
            ],
        ]);
    }

    /**
     * Validate expose config for export.
     * 
     * Checks if all required fields are present for PDF generation.
     */
    public function validateConfig(Request $request, $projectId)
    {
        $project = DeveloperProject::with(['location', 'exposeConfig'])
            ->where('company_id', user()->company_id)
            ->findOrFail($projectId);

        if (!$project->exposeConfig) {
            return Reply::error('No expose configuration found for this project.');
        }

        $validation = $project->exposeConfig->validateForExport();

        if ($validation['valid']) {
            return Reply::success('Expose config is valid and ready for export');
        }

        return Reply::error('Expose config incomplete', 'validation_failed', [
            'missing' => $validation['missing'],
        ]);
    }
}
