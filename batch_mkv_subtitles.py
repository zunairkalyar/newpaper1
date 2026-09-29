#!/usr/bin/env python3
"""
Batch MKV Subtitle Multiplexer
Adds subtitle file (.srt / .ass / .vtt) to multiple .mkv files automatically in one click using FFmpeg.
"""

import os
import sys
import subprocess
import glob

def check_ffmpeg():
    try:
        subprocess.run(["ffmpeg", "-version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        return True
    except Exception:
        return False

def batch_add_single_subtitle(mkv_dir, subtitle_path, output_dir=None, language="eng"):
    """
    Adds ONE subtitle file to ALL MKV files in a folder.
    """
    if not os.path.exists(subtitle_path):
        print(f"Error: Subtitle file '{subtitle_path}' not found!")
        return

    if output_dir is None:
        output_dir = os.path.join(mkv_dir, "output_mkv")
    
    os.makedirs(output_dir, exist_ok=True)

    mkv_files = [f for f in os.listdir(mkv_dir) if f.lower().endswith(".mkv")]
    
    if not mkv_files:
        print(f"No .mkv files found in directory: {mkv_dir}")
        return

    print(f"\nFound {len(mkv_files)} MKV file(s). Starting batch subtitle embedding...\n")

    for i, file_name in enumerate(mkv_files, 1):
        input_mkv = os.path.join(mkv_dir, file_name)
        output_mkv = os.path.join(output_dir, file_name)

        print(f"[{i}/{len(mkv_files)}] Processing: {file_name} ...")

        cmd = [
            "ffmpeg", "-y",
            "-i", input_mkv,
            "-i", subtitle_path,
            "-c", "copy",
            "-map", "0",
            "-map", "1:0",
            "-metadata:s:s:0", f"language={language}",
            output_mkv
        ]

        try:
            result = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
            if result.returncode == 0:
                print(f"  ✓ Successfully added subtitle: {output_mkv}")
            else:
                print(f"  ✗ Error processing {file_name}: {result.stderr}")
        except Exception as e:
            print(f"  ✗ Exception: {e}")

    print("\n🎉 Batch processing completed!")
    print(f"Output files saved in: {os.path.abspath(output_dir)}")

def batch_add_matching_subtitles(mkv_dir, output_dir=None, language="eng"):
    """
    Matches Movie.mkv with Movie.srt in the same directory.
    """
    if output_dir is None:
        output_dir = os.path.join(mkv_dir, "output_mkv")
    
    os.makedirs(output_dir, exist_ok=True)

    mkv_files = [f for f in os.listdir(mkv_dir) if f.lower().endswith(".mkv")]

    processed_count = 0
    for file_name in mkv_files:
        base_name = os.path.splitext(file_name)[0]
        input_mkv = os.path.join(mkv_dir, file_name)
        
        # Check for matching subtitle (.srt, .ass, .vtt)
        sub_path = None
        for ext in [".srt", ".ass", ".vtt"]:
            possible_sub = os.path.join(mkv_dir, base_name + ext)
            if os.path.exists(possible_sub):
                sub_path = possible_sub
                break
        
        if not sub_path:
            print(f"Skipping {file_name}: No matching subtitle file found.")
            continue

        output_mkv = os.path.join(output_dir, file_name)
        print(f"Processing: {file_name} with {os.path.basename(sub_path)} ...")

        cmd = [
            "ffmpeg", "-y",
            "-i", input_mkv,
            "-i", sub_path,
            "-c", "copy",
            "-map", "0",
            "-map", "1:0",
            "-metadata:s:s:0", f"language={language}",
            output_mkv
        ]

        result = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
        if result.returncode == 0:
            print(f"  ✓ Saved to {output_mkv}")
            processed_count += 1
        else:
            print(f"  ✗ Error: {result.stderr}")

    print(f"\n🎉 Completed! Processed {processed_count} movies.")

if __name__ == "__main__":
    if not check_ffmpeg():
        print("Error: FFmpeg is not installed or not in PATH!")
        sys.exit(1)

    print("==========================================")
    print("      BATCH MKV SUBTITLE EMBEDDER         ")
    print("==========================================")

    if len(sys.argv) >= 3:
        # Command line usage: python batch_mkv_subtitles.py <mkv_folder> <subtitle_file>
        mkv_folder = sys.argv[1]
        sub_file = sys.argv[2]
        batch_add_single_subtitle(mkv_folder, sub_file)
    else:
        print("\nChoose Option:")
        print("1. Add ONE subtitle file to ALL MKV movies in a folder")
        print("2. Match each Movie.mkv with its corresponding Movie.srt in the folder")
        
        choice = input("\nEnter choice (1 or 2): ").strip()
        folder = input("Enter path to MKV movies folder: ").strip().strip('"').strip("'")
        
        if choice == "1":
            sub = input("Enter path to subtitle file (.srt / .ass): ").strip().strip('"').strip("'")
            batch_add_single_subtitle(folder, sub)
        elif choice == "2":
            batch_add_matching_subtitles(folder)
        else:
            print("Invalid choice.")
