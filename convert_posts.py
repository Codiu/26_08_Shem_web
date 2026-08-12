import os
import re
import shutil

SRC_DIR = r"c:\Users\Admin\Downloads\!Automation_Project\26_08_Shem_web\posts_src"
POSTS_DIR = r"c:\Users\Admin\Downloads\!Automation_Project\26_08_Shem_web\_posts"
ASSETS_BLOG_DIR = r"c:\Users\Admin\Downloads\!Automation_Project\26_08_Shem_web\assets\images\blog"

os.makedirs(ASSETS_BLOG_DIR, exist_ok=True)
os.makedirs(POSTS_DIR, exist_ok=True)

MONTHS = {
    'янв': '01', 'фев': '02', 'февр': '02', 'мар': '03', 'апр': '04',
    'май': '05', 'мая': '05', 'июн': '06', 'июл': '07', 'авг': '08',
    'сен': '09', 'сент': '09', 'окт': '10', 'ноя': '11', 'нояб': '11', 'дек': '12'
}

TRANSLIT = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts',
    'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu',
    'я': 'ya'
}

def slugify(text):
    text = text.lower()
    res = []
    for char in text:
        if char in TRANSLIT:
            res.append(TRANSLIT[char])
        elif char.isalnum():
            res.append(char)
        elif char in [' ', '-', '_']:
            res.append('-')
    slug = re.sub(r'-+', '-', ''.join(res)).strip('-')
    return slug or "post"

def copy_image(img_path):
    if not img_path or img_path.startswith("http://") or img_path.startswith("https://"):
        return img_path
    
    clean_name = os.path.basename(img_path)
    src_img = os.path.join(SRC_DIR, "images", clean_name)
    dest_img = os.path.join(ASSETS_BLOG_DIR, clean_name)
    
    if os.path.exists(src_img):
        shutil.copy2(src_img, dest_img)
        return f"assets/images/blog/{clean_name}"
    return img_path

def parse_date(text):
    # Match dates like "17 авг. 2020 г.", "13 июл. 2018 г.", "6 апр. 2020 г."
    m_full = re.search(r'(\d{1,2})\s+([а-яяА-Я]+)\.?\s+(\d{4})', text)
    if m_full:
        day = m_full.group(1).zfill(2)
        month_str = m_full.group(2).lower()[:4]
        month = MONTHS.get(month_str, MONTHS.get(month_str[:3], '01'))
        year = m_full.group(3)
        return f"{year}-{month}-{day}", True
    
    # Match dates without year like "17 мар.", "3 февр."
    m_noyear = re.search(r'(\d{1,2})\s+([а-яяА-Я]+)\.?', text)
    if m_noyear:
        day = m_noyear.group(1).zfill(2)
        month_str = m_noyear.group(2).lower()[:4]
        month = MONTHS.get(month_str, MONTHS.get(month_str[:3], '01'))
        return f"2026-{month}-{day}", False
        
    return "2026-01-01", False

def process_post(filename):
    file_path = os.path.join(SRC_DIR, filename)
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    lines = content.splitlines()
    title = os.path.splitext(filename)[0]
    
    cover_image = ""
    category = "Статьи"
    
    cover_match = re.search(r'!\[Обложка\]\(([^)]+)\)', content)
    if not cover_match:
        cover_match = re.search(r'!\[\]\((images/[^)]+)\)', content)
    
    if cover_match:
        raw_cover = cover_match.group(1)
        cover_image = copy_image(raw_cover)

    date_str, has_year = parse_date(content)

    clean_lines = []
    skip_header = True
    
    header_patterns = [
        r'^#\s+',
        r'^\*\s*\d{1,2}\s+[а-яА-Я]+',
        r'^\!\s*\[Обложка\]',
        r'^\!\s*\[\]\(images/',
        r'^\*\s*\[?Шемшук',
        r'^\*\s*\[?Владимир Шемшук',
        r'^\s*\[Владимир Шемшук',
        r'^\*\s*\!\[Фото автора',
        r'^\*\s*\d+\s+мин\.\s+чтения',
        r'^Обновлено:',
        r'^\s*$'
    ]

    body_started = False
    for line in lines:
        stripped = line.strip()
        
        if skip_header:
            is_garbage = False
            for pat in header_patterns:
                if re.search(pat, stripped):
                    is_garbage = True
                    break
            
            if cover_match and cover_match.group(0) in line:
                is_garbage = True
                
            if is_garbage:
                continue
            else:
                skip_header = False
                body_started = True

        if body_started:
            if re.match(r'^\*\s+\[(Статьи|Видео)\]', stripped):
                break
            if re.match(r'^\d+\s*(просмотров|просмотра)?$', stripped):
                break
            if stripped == "Пост не отмечен как понравившийся":
                break
            if stripped == "Шемшук В.А.":
                continue
                
            clean_lines.append(line)

    body_text = "\n".join(clean_lines).strip()
    
    def replace_inline_img(match):
        alt = match.group(1)
        img_src = match.group(2)
        new_src = copy_image(img_src)
        return f"![{alt}]({new_src})"
        
    body_text = re.sub(r'!\[(.*?)\]\((images/[^)]+)\)', replace_inline_img, body_text)

    if "<!--more-->" not in body_text:
        parts = body_text.split("\n\n", 1)
        if len(parts) > 1:
            body_text = parts[0] + "\n\n<!--more-->\n\n" + parts[1]
        else:
            body_text = body_text + "\n\n<!--more-->"

    front_matter = [
        "---",
        "layout: post",
        f'title: "{title}"',
        f"date: {date_str}",
        'category: "Статьи"',
    ]
    if cover_image:
        front_matter.append(f'cover: "{cover_image}"')
    front_matter.append('excerpt_separator: <!--more-->')
    front_matter.append("---\n")

    full_post = "\n".join(front_matter) + "\n" + body_text + "\n"

    slug = slugify(title)
    out_filename = f"{date_str}-{slug}.md"
    out_path = os.path.join(POSTS_DIR, out_filename)

    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(full_post)

    return out_filename, has_year, title

def main():
    files = [f for f in os.listdir(SRC_DIR) if f.endswith('.md')]
    print(f"Total source posts: {len(files)}")

    no_year_list = []
    processed_count = 0

    for f in files:
        out_name, has_year, title = process_post(f)
        processed_count += 1
        if not has_year:
            no_year_list.append((title, out_name))

    print(f"Successfully processed {processed_count} posts!")
    print(f"\n--- POSTS REQUIRING YEAR REVIEW ({len(no_year_list)}) ---")
    for title, out_name in no_year_list:
        print(f"  - [{out_name}] {title}")

if __name__ == "__main__":
    main()
