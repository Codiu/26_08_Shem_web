import csv
import os

books_csv = '_data/books.csv'

with open(books_csv, 'r', encoding='utf-8', errors='replace') as f:
    reader = csv.DictReader(f)
    for r in reader:
        c = r.get('cover', '').strip()
        if c and c != 'default-cover.svg':
            full_p = os.path.join('assets/images/books', c)
            thumb_p = os.path.join('assets/images/books/thumbs', c)
            full_e = os.path.exists(full_p)
            thumb_e = os.path.exists(thumb_p)
            if not full_e or not thumb_e:
                print(f"MISSING: {c} | Full: {full_e} | Thumb: {thumb_e}")
print("Check done!")
