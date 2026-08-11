import os
from PIL import Image, ImageChops

def trim_white_side_borders(image_path):
    try:
        img = Image.open(image_path)
        
        if img.mode != 'RGB':
            img = img.convert('RGB')
            
        # Create a pure white image
        bg = Image.new("RGB", img.size, (255, 255, 255))
        
        # Find difference between image and white background
        diff = ImageChops.difference(img, bg)
        
        # Convert difference to grayscale to simplify thresholding
        diff = diff.convert('L')
        # Threshold: allow slight off-white (difference > 15 is considered non-white content)
        diff = diff.point(lambda p: p > 15 and 255)
        
        bbox = diff.getbbox()
        
        if bbox:
            # bbox is (left, upper, right, lower)
            left, upper, right, lower = bbox
            
            # The user specifically asked to crop white borders from the SIDES ("сбоку")
            # So we only apply the left and right crop, and keep the full original height.
            new_bbox = (left, 0, right, img.height)
            
            # If the new bounding box is actually smaller than the original image width
            if new_bbox != (0, 0, img.width, img.height):
                cropped_img = img.crop(new_bbox)
                # Repack/Save with good quality
                cropped_img.save(image_path, quality=90, optimize=True)
                return True
        return False
    except Exception as e:
        print(f"Error processing {image_path}: {e}")
        return False

if __name__ == "__main__":
    img_dir = r"c:\Users\Admin\Downloads\!Automation_Project\26_08_Shem_web\assets\images\books"
    
    print("Scanning images for white side borders...")
    processed = 0
    cropped = 0
    
    for filename in os.listdir(img_dir):
        # Process only images, skip directories like 'thumbs'
        filepath = os.path.join(img_dir, filename)
        if os.path.isfile(filepath) and filename.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
            processed += 1
            if trim_white_side_borders(filepath):
                print(f"Cropped sides of: {filename}")
                cropped += 1
                
    print(f"\nDone! Processed {processed} images. Cropped and repacked {cropped} images.")
