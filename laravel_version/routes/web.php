<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\EpaperController;

Route::get('/epaper', [EpaperController::class, 'index'])->name('epaper.index');
Route::post('/epaper/process', [EpaperController::class, 'processBatch'])->name('epaper.process');
Route::delete('/epaper/file/{filename}', [EpaperController::class, 'deleteFile'])->name('epaper.delete');
