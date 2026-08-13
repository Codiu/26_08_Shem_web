import os
import shutil
import re
import yaml
import subprocess

SOURCE_DIR = "05 Концерты"
TARGET_DIR = "assets/audio/concerts"
YAML_OUT = "_data/concerts.yml"

def clean_album_name(folder_name):
    if folder_name.isdigit():
        num = int(folder_name)
        if len(folder_name) == 3 and folder_name.startswith('0'):
            main_num = int(folder_name[:2])
            part_num = int(folder_name[2])
            return f"Концерт {main_num} - Часть {part_num}"
        return f"Концерт {num}"
    
    if '-' in folder_name:
        parts = folder_name.split('-')
        if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
            return f"Концерт {int(parts[0])} - Часть {int(parts[1])}"
    
    return f"Концерт {folder_name}"

def clean_track_name(filename):
    name = os.path.splitext(filename)[0]
    name = re.sub(r'^(?:\d+\s*-\s*)?(?:Маскирон\s*-\s*)?(?:\d+\.?\s*)?', '', name, flags=re.IGNORECASE).strip()
    name = name.lstrip('- .')
    if not name:
        name = "Неизвестный трек"
    return name

def main():
    if not os.path.exists(TARGET_DIR):
        os.makedirs(TARGET_DIR)

    concerts_data = []
    album_dirs = sorted([d for d in os.listdir(SOURCE_DIR) if os.path.isdir(os.path.join(SOURCE_DIR, d))])
    album_counter = 1

    total_files = 0
    for album_dir in album_dirs:
        album_path = os.path.join(SOURCE_DIR, album_dir)
        total_files += len([f for f in os.listdir(album_path) if f.lower().endswith('.mp3')])

    processed_files = 0
    print(f"Starting compression for {total_files} audio files to 160 kbps MP3...")

    for album_dir in album_dirs:
        album_path = os.path.join(SOURCE_DIR, album_dir)
        files = [f for f in os.listdir(album_path) if f.lower().endswith('.mp3')]
        
        if not files:
            continue
            
        album_id = f"album_{album_counter:02d}"
        album_target_dir = os.path.join(TARGET_DIR, album_id)
        
        if not os.path.exists(album_target_dir):
            os.makedirs(album_target_dir)

        album_info = {
            'id': album_id,
            'title': clean_album_name(album_dir),
            'tracks': []
        }

        files.sort()
        track_counter = 1
        for f in files:
            source_file_path = os.path.join(album_path, f)
            track_ext = os.path.splitext(f)[1].lower()
            track_id = f"track_{track_counter:02d}{track_ext}"
            target_file_path = os.path.join(album_target_dir, track_id)
            
            # Compress using ffmpeg to 160k high quality libmp3lame
            cmd = [
                'ffmpeg', '-y', '-i', source_file_path,
                '-codec:a', 'libmp3lame', '-b:a', '160k',
                '-map_metadata', '0',
                target_file_path
            ]
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            
            processed_files += 1
            if processed_files % 10 == 0 or processed_files == total_files:
                print(f"Progress: {processed_files}/{total_files} files compressed.")
            
            track_title = clean_track_name(f)
            album_info['tracks'].append({
                'id': f"{album_id}_{track_counter:02d}",
                'title': track_title,
                'file': f"/assets/audio/concerts/{album_id}/{track_id}"
            })
            track_counter += 1
            
        concerts_data.append(album_info)
        album_counter += 1

    with open(YAML_OUT, 'w', encoding='utf-8') as yaml_file:
        yaml.dump(concerts_data, yaml_file, allow_unicode=True, sort_keys=False)
        
    print(f"Finished compressing {processed_files} files! Updated {YAML_OUT}")

if __name__ == "__main__":
    main()
