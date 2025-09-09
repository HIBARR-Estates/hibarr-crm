<?php

use Illuminate\Support\Facades\Route;
use Modules\Biolinks\Http\Controllers\BiolinksController;
use Modules\Biolinks\Http\Controllers\BiolinkBlocksController;
use Modules\Biolinks\Http\Controllers\BiolinkPageController;
use Modules\Biolinks\Http\Controllers\BiolinkSettingsController;

Route::get('bio/{slug}', [BiolinkPageController::class, 'index'])->name('biolink.index');
Route::post('bio-page/{slug}', [BiolinkPageController::class, 'checkPassword'])->name('biolink.check-password');
Route::post('sensitive-warning/{slug}', [BiolinkPageController::class, 'checkSensitive'])->name('biolink.check-sensitive');
Route::get('biolink-public/open-email-modal', [BiolinkPageController::class, 'emailModal'])->name('biolink.open-email-modal');
Route::post('subscribe-newsletter/{id}', [BiolinkPageController::class, 'subscribe'])->name('biolink.subscribe-newsletter');
Route::get('biolink-public/open-phone-modal', [BiolinkPageController::class, 'phoneModal'])->name('biolink.open-phone-modal');
Route::post('phone-collector/{id}', [BiolinkPageController::class, 'phoneCollector'])->name('biolink.phone-collector');

Route::middleware('auth')->group(function () {
    Route::group(['prefix' => 'account/'], function () {
        Route::post('biolinks/change-status', [BiolinksController::class, 'changeStatus'])->name('biolinks.change_status');
        Route::get('biolinks-preview/{id}', [BiolinksController::class, 'showPreview'])->name('biolinks.show-preview');
        Route::get('biolinks/{id}/edit-slug', [BiolinksController::class, 'editSlug'])->name('biolinks.editSlug');
        Route::resource('biolinks', BiolinksController::class)->names('biolinks');

        Route::resource('biolink-settings', BiolinkSettingsController::class)->names('biolink-settings')->only(['update']);

        Route::get('biolink-blocks/{id}/create/', [BiolinkBlocksController::class, 'create'])->name('biolink-blocks.create');
        Route::get('biolink-blocks/{biolinkId}/create-block/{blockId}', [BiolinkBlocksController::class, 'createBlock'])->name('biolink-blocks.createBlock');
        Route::resource('biolink-blocks', BiolinkBlocksController::class)->names('biolink-blocks')->only(['store', 'update', 'destroy']);
        Route::get('duplicate-block/{duplicateId}', [BiolinkBlocksController::class, 'duplicateBlock'])->name('biolink-blocks.duplicate');
        Route::post('biolink-blocks/sortFields', [BiolinkBlocksController::class, 'sortFields'])->name('biolink-blocks.sortFields');
    });
});
