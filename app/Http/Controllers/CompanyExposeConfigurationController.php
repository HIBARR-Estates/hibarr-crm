<?php

namespace App\Http\Controllers;

use App\Helper\Files;
use App\Helper\Reply;
use App\Models\CompanyExposeConfiguration;
use Illuminate\Http\Request;
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
            Files::deleteFile($config->outro_primary_image, CompanyExposeConfiguration::FILE_PATH);
            $config->outro_primary_image = null;
        }

        if ($request->boolean('remove_outro_secondary_image') && !empty($config->outro_secondary_image)) {
            Files::deleteFile($config->outro_secondary_image, CompanyExposeConfiguration::FILE_PATH);
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
            'file' => ['required', 'file', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
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
            Files::deleteFile($config->{$field}, CompanyExposeConfiguration::FILE_PATH);
        }

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
            ],
        ]);
    }
}
