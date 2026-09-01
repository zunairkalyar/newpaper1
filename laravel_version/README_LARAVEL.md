# Laravel Integration Guide for E-Paper PDF Downloader & Watermarker

This directory contains the ready-to-use Laravel code if you wish to host or run this project inside a Laravel PHP framework.

## Files Included:
1. **Controller**: `app/Http/Controllers/EpaperController.php`
2. **Service**: `app/Services/EpaperWatermarkService.php`
3. **Routes**: `routes/web.php`
4. **Blade View**: `resources/views/epaper/index.blade.php`

## Quick Setup in your Laravel Project:
1. Copy `app/Services/EpaperWatermarkService.php` to your Laravel project's `app/Services/` directory.
2. Copy `app/Http/Controllers/EpaperController.php` to `app/Http/Controllers/`.
3. Add the routes from `routes/web.php` into your Laravel `routes/web.php`.
4. Ensure `storage/app/public/newspapers` is linked via:
   ```bash
   php artisan storage:link
   ```
5. Install dependencies in your project root:
   ```bash
   npm install pdf-lib fontkit
   ```
