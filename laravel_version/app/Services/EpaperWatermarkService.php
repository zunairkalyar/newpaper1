<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\File;

class EpaperWatermarkService
{
    protected string $outputDir;
    protected string $watermarkText;

    public function __construct()
    {
        $this->outputDir = storage_path('app/public/newspapers');
        if (!File::exists($this->outputDir)) {
            File::makeDirectory($this->outputDir, 0755, true);
        }
        $this->watermarkText = config('services.epaper.watermark', 'Social Media Pakistan 0342-4938217');
    }

    /**
     * Download and process The News International edition for a given date
     */
    public function processEdition(string $editionKey, string $cityName, string $dateFormatted, array $customConfig = []): array
    {
        // Parse date DD-MM-YYYY
        $parts = explode('-', $dateFormatted);
        if (count($parts) !== 3) {
            $parts = [date('d'), date('m'), date('Y')];
        }
        [$day, $month, $year] = $parts;
        $day = (int)$day;
        $month = (int)$month;

        $watermarkText = $customConfig['watermarkText'] ?? $this->watermarkText;
        $outputFileName = "{$dateFormatted} The News {$cityName}.pdf";
        $outputPath = "{$this->outputDir}/{$outputFileName}";

        // Step 1: Check direct PDF first
        $directPdfUrl = "https://e.thenews.pk/static_pages/{$month}-{$day}-{$year}/{$editionKey}/thenews.pdf";
        $response = Http::withHeaders(['User-Agent' => 'Mozilla/5.0'])->get($directPdfUrl);

        if ($response->successful() && str_contains($response->header('Content-Type'), 'pdf')) {
            File::put($outputPath, $response->body());
            $this->applyWatermarkToPdf($outputPath, $watermarkText, $cityName, $dateFormatted, $customConfig);
        } else {
            // Step 2: Download page images (1 to 16) and compile
            $imagePaths = [];
            $pageNum = 1;

            while (true) {
                $pageUrl = "https://e.thenews.pk/static_pages/{$month}-{$day}-{$year}/{$editionKey}/mainpage/page{$pageNum}.jpg";
                $imgRes = Http::withHeaders(['User-Agent' => 'Mozilla/5.0'])->get($pageUrl);

                if (!$imgRes->successful() || !str_contains($imgRes->header('Content-Type'), 'image')) {
                    break;
                }

                $tempImg = storage_path("app/temp_{$editionKey}_{$pageNum}.jpg");
                File::put($tempImg, $imgRes->body());
                $imagePaths[] = $tempImg;
                $pageNum++;
            }

            if (empty($imagePaths)) {
                throw new \Exception("No pages found for {$cityName} edition on {$dateFormatted}.");
            }

            // Assemble into PDF via Node/pdf-lib sidecar or Imagick/FPDF
            $this->assembleImagesToPdf($imagePaths, $outputPath, $watermarkText, $cityName, $dateFormatted, $customConfig);

            // Clean temp images
            foreach ($imagePaths as $tempImg) {
                if (File::exists($tempImg)) File::delete($tempImg);
            }
        }

        return [
            'filename' => $outputFileName,
            'size' => round(filesize($outputPath) / (1024 * 1024), 2) . ' MB',
            'path' => $outputPath,
            'url' => asset("storage/newspapers/{$outputFileName}"),
        ];
    }

    /**
     * Watermarking engine runner
     */
    protected function applyWatermarkToPdf(string $pdfPath, string $text, string $cityName, string $date, array $config): void
    {
        // Executes high-performance node watermarker worker
        $nodeScript = base_path('scripts/watermark_worker.js');
        if (File::exists($nodeScript)) {
            $cmd = sprintf('node %s %s %s %s %s', escapeshellarg($nodeScript), escapeshellarg($pdfPath), escapeshellarg($text), escapeshellarg($cityName), escapeshellarg($date));
            shell_exec($cmd);
        }
    }

    protected function assembleImagesToPdf(array $images, string $outputPath, string $text, string $cityName, string $date, array $config): void
    {
        $nodeScript = base_path('scripts/assemble_worker.js');
        if (File::exists($nodeScript)) {
            $imagesJson = json_encode($images);
            $cmd = sprintf('node %s %s %s %s %s %s', escapeshellarg($nodeScript), escapeshellarg($imagesJson), escapeshellarg($outputPath), escapeshellarg($text), escapeshellarg($cityName), escapeshellarg($date));
            shell_exec($cmd);
        }
    }
}
