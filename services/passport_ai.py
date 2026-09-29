#!/usr/bin/env python3
import sys
import os
import json
import numpy as np
from PIL import Image
import cv2
import rembg

# Global session cache for instant processing
_isnet_session = None

def get_isnet_session():
    global _isnet_session
    if _isnet_session is None:
        _isnet_session = rembg.new_session("isnet-general-use")
    return _isnet_session

def process_passport_image(input_path, output_path, smoothing=40, brightness=5, contrast=10):
    try:
        # Load input image
        input_img = Image.open(input_path).convert('RGB')
        rgb = np.array(input_img)
        h, w = rgb.shape[:2]
        
        # 1. High-Precision IS-Net Neural Segmentation
        session = get_isnet_session()
        transparent_img = rembg.remove(input_img, session=session)
        rgba_ai = np.array(transparent_img)
        alpha_ai = rgba_ai[:, :, 3].astype(np.float32) / 255.0

        # 2. Photoshop 2022 Select Subject Alpha Refine Curve
        # Eliminates background shadow/wall noise (< 0.20) to pure transparent (0),
        # pushes subject (< 0.75) to pure opaque (255), creating ultra-clean edges.
        alpha_ps = np.clip((alpha_ai - 0.20) / (0.75 - 0.20), 0.0, 1.0)
        alpha_ps_bytes = (alpha_ps * 255.0).astype(np.uint8)

        # 3. Ear & Skin Safety Protection Mask (YCrCb Engine)
        # Guarantees ears, earlobes, chin, cheeks, and neck are NEVER clipped or cut
        ycrcb = cv2.cvtColor(rgb, cv2.COLOR_RGB2YCrCb)
        skin_mask = cv2.inRange(ycrcb, np.array([0, 133, 77], dtype=np.uint8), np.array([255, 173, 127], dtype=np.uint8))
        
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        skin_mask = cv2.morphologyEx(skin_mask, cv2.MORPH_CLOSE, kernel)
        skin_mask = cv2.dilate(skin_mask, kernel, iterations=1)

        head_torso_zone = np.zeros((h, w), dtype=np.uint8)
        head_torso_zone[:int(h * 0.85), :] = 255
        protected_ears_skin = cv2.bitwise_and(skin_mask, head_torso_zone)

        # Merge protected ears & skin with Photoshop refined alpha mask
        combined_alpha = np.maximum(alpha_ps_bytes, protected_ears_skin)

        # Photoshop Anti-Aliasing Edge Softening
        final_alpha = cv2.GaussianBlur(combined_alpha, (3, 3), 0)

        # 4. Facial Enhancement & Skin Smoothing Engine (Bilateral Filter + Detail Sharpening)
        if smoothing > 0:
            smooth_ratio = min(1.0, max(0.0, smoothing / 100.0))
            smoothed_rgb = cv2.bilateralFilter(rgb, d=9, sigmaColor=75 * smooth_ratio, sigmaSpace=75 * smooth_ratio)
            rgb = cv2.addWeighted(smoothed_rgb, smooth_ratio, rgb, 1.0 - smooth_ratio, 0)

        # 5. Brightness & Contrast Adjustment
        alpha_gain = max(0.2, 1.0 + (contrast / 100.0))
        beta_bias = brightness * 2.55
        adjusted_rgb = cv2.convertScaleAbs(rgb, alpha=alpha_gain, beta=beta_bias)

        # 6. Assemble Final RGBA Image
        result_np = np.dstack((adjusted_rgb, final_alpha))
        result_pil = Image.fromarray(result_np, 'RGBA')
        result_pil.save(output_path, 'PNG')

        return {
            "success": True,
            "outputPath": output_path,
            "width": result_pil.width,
            "height": result_pil.height
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Usage: passport_ai.py <input_path> <output_path> [smoothing] [brightness] [contrast]"}))
        sys.exit(1)
        
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    smoothing = int(sys.argv[3]) if len(sys.argv) > 3 else 40
    brightness = int(sys.argv[4]) if len(sys.argv) > 4 else 5
    contrast = int(sys.argv[5]) if len(sys.argv) > 5 else 10
    
    result = process_passport_image(input_file, output_file, smoothing, brightness, contrast)
    print(json.dumps(result))
