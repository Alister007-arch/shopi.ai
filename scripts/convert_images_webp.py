import os
import glob
from PIL import Image

def convert_all_products_to_webp():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    products_dir = os.path.join(base_dir, "frontend", "public", "products")
    
    if not os.path.exists(products_dir):
        print(f"Products directory not found: {products_dir}")
        return

    jpg_files = glob.glob(os.path.join(products_dir, "*.jpg"))
    print(f"Found {len(jpg_files)} JPG product images.")

    total_jpg_bytes = 0
    total_webp_bytes = 0

    for jpg_path in jpg_files:
        filename = os.path.basename(jpg_path)
        name, _ = os.path.splitext(filename)
        webp_path = os.path.join(products_dir, f"{name}.webp")

        jpg_size = os.path.getsize(jpg_path)
        total_jpg_bytes += jpg_size

        with Image.open(jpg_path) as img:
            # Convert RGBA or Palette to RGB if needed
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            
            # Enforce < 60KB ceiling
            quality = 80
            dim = 600
            while True:
                temp_img = img.copy()
                if max(temp_img.width, temp_img.height) > dim:
                    temp_img.thumbnail((dim, dim), Image.Resampling.LANCZOS)
                temp_img.save(webp_path, format="WEBP", quality=quality, method=6)
                webp_size = os.path.getsize(webp_path)
                if webp_size <= 60 * 1024 or quality <= 40:
                    break
                # Adjust for next iteration if still exceeding 60KB
                quality -= 10
                dim -= 50

        total_webp_bytes += webp_size
        print(f"Converted {filename}: {jpg_size // 1024} KB -> {webp_size // 1024} KB (Saved {100 - (webp_size * 100 // jpg_size)}%)")

    print("\n--- Summary ---")
    print(f"Total Original JPG Size: {total_jpg_bytes // 1024} KB ({total_jpg_bytes / (1024 * 1024):.2f} MB)")
    print(f"Total Converted WebP Size: {total_webp_bytes // 1024} KB ({total_webp_bytes / (1024 * 1024):.2f} MB)")
    print(f"Overall Space Saved: {100 - (total_webp_bytes * 100 // total_jpg_bytes)}%")

if __name__ == "__main__":
    convert_all_products_to_webp()
