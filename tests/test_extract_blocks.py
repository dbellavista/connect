import sys
import pymupdf

def main() -> None:
    if len(sys.argv) < 2:
        return
    doc = pymupdf.open(sys.argv[1])
    page = doc[0] # first page
    blocks = page.get_text("blocks", sort=True)
    for b in blocks:
        if b[-1] == 1:
            print("Found image block:", b)
        else:
            pass
            
    tables = page.find_tables()  # type: ignore
    if tables:
        for i, tab in enumerate(tables.tables):
            print(f"Found table {i}:")
            print(tab.extract())
    doc.close()

if __name__ == "__main__":
    main()
