<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use App\Services\EpaperWatermarkService;

class EpaperController extends Controller
{
    protected EpaperWatermarkService $epaperService;

    public function __construct(EpaperWatermarkService $epaperService)
    {
        $this->epaperService = $epaperService;
    }

    /**
     * Display Dashboard
     */
    public function index()
    {
        $files = [];
        $dir = storage_path('app/public/newspapers');
        if (File::exists($dir)) {
            $rawFiles = File::files($dir);
            foreach ($rawFiles as $file) {
                if (strtolower($file->getExtension()) === 'pdf') {
                    $files[] = [
                        'name' => $file->getFilename(),
                        'size' => round($file->getSize() / (1024 * 1024), 2) . ' MB',
                        'time' => date('h:i A', $file->getMTime()),
                        'url' => asset('storage/newspapers/' . $file->getFilename()),
                    ];
                }
            }
        }

        return view('epaper.index', compact('files'));
    }

    /**
     * Process Batch Request
     */
    public function processBatch(Request $request)
    {
        $date = $request->input('date', date('d-m-Y'));
        $editions = $request->input('editions', ['karachi', 'lahore', 'pindi']);
        $config = $request->input('config', []);

        $results = [];
        $editionMap = [
            'karachi' => 'Karachi',
            'lahore' => 'Lahore',
            'pindi' => 'Islamabad'
        ];

        foreach ($editions as $ed) {
            $city = $editionMap[$ed] ?? ucfirst($ed);
            try {
                $file = $this->epaperService->processEdition($ed, $city, $date, $config);
                $results[] = $file;
            } catch (\Exception $e) {
                // Log and continue
            }
        }

        return response()->json([
            'success' => true,
            'results' => $results
        ]);
    }

    /**
     * Delete a generated PDF
     */
    public function deleteFile($filename)
    {
        $path = storage_path("app/public/newspapers/{$filename}");
        if (File::exists($path)) {
            File::delete($path);
            return response()->json(['success' => true]);
        }
        return response()->json(['success' => false, 'message' => 'File not found'], 404);
    }
}
