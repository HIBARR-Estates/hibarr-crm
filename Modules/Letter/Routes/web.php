<?php

use Illuminate\Support\Facades\Route;
use Modules\Letter\Http\Controllers\LetterController;
/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create something great!
|
*/

use Modules\Letter\Http\Controllers\TemplateController;

Route::group(['middleware' => 'auth', 'prefix' => 'account'], function () {
    Route::group(
        ['prefix' => 'letter', 'as' => 'letter.'],
        function () {
            Route::get('ajax/template/{id}', [LetterController::class, 'letterTemplate'])->name('ajax.template');
            Route::get('employee/{id}', [LetterController::class, 'letterEmployee'])->name('employee');
            Route::post('download/preview', [LetterController::class, 'downloadLetterPreviewStore'])->name('download.preview.store');
            Route::get('download/preview', [LetterController::class, 'downloadLetterPreview'])->name('download.preview');
            Route::get('download/{id}', [LetterController::class, 'downloadLetter'])->name('download');
            Route::resource('template', TemplateController::class);
            Route::resource('generate', LetterController::class);
        }
    );

});
