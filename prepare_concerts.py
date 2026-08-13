import os
import shutil
import re
import yaml

SOURCE_DIR = "05 Концерты"
TARGET_DIR = "assets/audio/concerts"
YAML_OUT = "_data/concerts.yml"

def clean_album_name(folder_name):
    """
    Transforms folder names like '01', '081', '10-2' into 'Концерт 1', 'Концерт 8 - Часть 1'
    """
    if folder_name.isdigit():
        num = int(folder_name)
        if len(folder_name) == 3 and folder_name.startswith('0'):
            # e.g., '081' -> 8, part 1
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
    """
    Removes leading numbers, dashes, 'Маскирон', and the extension.
    Example: '01 - Маскирон - 1. Песнь Кондару.mp3' -> 'Песнь Кондару'
    """
    name = os.path.splitext(filename)[0]
    
    # Remove things like "01 - Маскирон - 1. "
    # Regex breakdown:
    # ^(\d+\s*-\s*)?    -> Optional leading number and dash (e.g. "01 - ")
    # (Маскирон\s*-\s*)? -> Optional "Маскирон - "
    # (\d+\.\s*)?        -> Optional number with dot (e.g. "1. ")
    
    name = re.sub(r'^(?:\d+\s*-\s*)?(?:Маскирон\s*-\s*)?(?:\d+\.?\s*)?', '', name, flags=re.IGNORECASE).strip()
    
    # Some names might still have leading dashes or dots
    name = name.lstrip('- .')
    
    if not name:
        name = "Неизвестный трек"
    
    return name

def main():
    if not os.path.exists(TARGET_DIR):
        os.makedirs(TARGET_DIR)

    concerts_data = []

    # Sort directories so 01 comes before 02, etc.
    try:
        album_dirs = sorted([d for d in os.listdir(SOURCE_DIR) if os.path.isdir(os.path.join(SOURCE_DIR, d))])
    except FileNotFoundError:
        print(f"Error: {SOURCE_DIR} not found.")
        return

    album_counter = 1

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

        # Sort files to maintain order
        files.sort()
        
        track_counter = 1
        for f in files:
            source_file_path = os.path.join(album_path, f)
            track_ext = os.path.splitext(f)[1].lower()
            track_id = f"track_{track_counter:02d}{track_ext}"
            target_file_path = os.path.join(album_target_dir, track_id)
            
            # Copy file
            shutil.copy2(source_file_path, target_file_path)
            
            track_title = clean_track_name(f)
            
            album_info['tracks'].append({
                'id': f"{album_id}_{track_counter:02d}",
                'title': track_title,
                'file': f"/assets/audio/concerts/{album_id}/{track_id}"
            })
            
            track_counter += 1
            
        concerts_data.append(album_info)
        album_counter += 1

    # Write YAML
    with open(YAML_OUT, 'w', encoding='utf-8') as yaml_file:
        yaml.dump(concerts_data, yaml_file, allow_unicode=True, sort_keys=False)
        
    print(f"Processed {len(concerts_data)} albums and generated {YAML_OUT}")

if __name__ == "__main__":
    main()
