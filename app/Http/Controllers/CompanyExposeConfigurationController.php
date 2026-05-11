<?php

namespace App\Http\Controllers;

use App\Helper\Files;
use App\Helper\Reply;
use App\Models\CompanyExposeConfiguration;
use App\Services\FileStorageService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class CompanyExposeConfigurationController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
    }

    public function show()
    {
        $config = CompanyExposeConfiguration::firstOrCreate(
            ['company_id' => user()->company_id],
            [
                'outro_enabled' => false,
                'qr_enabled' => false,
            ]
        );

        return Inertia::render('ExposeConfiguration/Index', [
            'pageTitle' => 'Expose Configuration',
            'config' => $config,
        ]);
    }

    public function update(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'outro_enabled' => ['required', 'boolean'],
            'outro_title' => [
                'nullable',
                'string',
                'max:255',
                Rule::requiredIf(fn () => $request->boolean('outro_enabled')),
            ],
            'outro_description' => [
                'nullable',
                'string',
                Rule::requiredIf(fn () => $request->boolean('outro_enabled')),
            ],
            'qr_enabled' => ['required', 'boolean'],
            'qr_code_link' => [
                'nullable',
                'url',
                'max:2048',
                Rule::requiredIf(fn () => $request->boolean('qr_enabled')),
            ],
            'remove_outro_primary_image' => ['nullable', 'boolean'],
            'remove_outro_secondary_image' => ['nullable', 'boolean'],
        ]);

        if ($validator->fails()) {
            return Reply::formErrors($validator);
        }

        $config = CompanyExposeConfiguration::firstOrCreate(
            ['company_id' => user()->company_id],
            [
                'outro_enabled' => false,
                'qr_enabled' => false,
            ]
        );

        if ($request->boolean('remove_outro_primary_image') && !empty($config->outro_primary_image)) {
            $this->deleteStoredImage($config->outro_primary_image);
            $config->outro_primary_image = null;
        }

        if ($request->boolean('remove_outro_secondary_image') && !empty($config->outro_secondary_image)) {
            $this->deleteStoredImage($config->outro_secondary_image);
            $config->outro_secondary_image = null;
        }

        $config->outro_enabled = $request->boolean('outro_enabled');
        $config->outro_title = $request->input('outro_title');
        $config->outro_description = $request->input('outro_description');
        $config->qr_enabled = $request->boolean('qr_enabled');
        $config->qr_code_link = $request->input('qr_code_link');
        $config->save();

        return Reply::successWithData('Expose configuration updated successfully', [
            'data' => $config->fresh(),
        ]);
    }

    public function uploadImage(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'field' => ['required', Rule::in(['outro_primary_image', 'outro_secondary_image'])],
            'file' => ['required_without:url', 'file', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'url' => ['required_without:file', 'nullable', 'url', 'max:2048'],
            'filename' => ['nullable', 'string', 'max:255'],
            'object_path' => ['nullable', 'string', 'max:500'],
        ]);

        if ($validator->fails()) {
            return Reply::formErrors($validator);
        }

        $config = CompanyExposeConfiguration::firstOrCreate(
            ['company_id' => user()->company_id],
            [
                'outro_enabled' => false,
                'qr_enabled' => false,
            ]
        );

        $field = $request->input('field');

        if (!empty($config->{$field})) {
            $this->deleteStoredImage($config->{$field});
        }

        if ($request->hasFile('file')) {
            $filename = Files::uploadLocalOrS3(
                $request->file('file'),
                CompanyExposeConfiguration::FILE_PATH
            );

            $config->{$field} = $filename;
            $config->save();

            $url = $field === 'outro_primary_image'
                ? $config->outro_primary_image_url
                : $config->outro_secondary_image_url;

            return Reply::successWithData('Image uploaded successfully', [
                'data' => [
                    'field' => $field,
                    'filename' => $filename,
                    'url' => $url,
                    'object_path' => null,
                ],
            ]);
        }

        $downloadUrl = $request->input('url');
        $objectPath = $request->input('object_path') ?: FileStorageService::extractObjectPathFromUrl($downloadUrl);
        $filename = $request->input('filename') ?: basename(parse_url($downloadUrl, PHP_URL_PATH) ?: $downloadUrl);

        $config->{$field} = $downloadUrl;
        $config->save();

        return Reply::successWithData('Image uploaded successfully', [
            'data' => [
                'field' => $field,
                'filename' => $filename,
                'url' => $downloadUrl,
                'object_path' => $objectPath,
            ],
        ]);
    }

    private function deleteStoredImage(?string $storedValue): void
    {
        if (empty($storedValue)) {
            return;
        }

        if (FileStorageService::isExternalUrl($storedValue)) {
            $objectPath = FileStorageService::extractObjectPathFromUrl($storedValue);

            if (!empty($objectPath)) {
                try {
                    app(FileStorageService::class)->delete($objectPath);
                } catch (\Throwable $e) {
                    Log::warning('Failed to delete expose configuration image from external storage', [
                        'object_path' => $objectPath,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            return;
        }

        Files::deleteFile($storedValue, CompanyExposeConfiguration::FILE_PATH);
    }
}
