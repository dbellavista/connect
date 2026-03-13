import sys
import pymupdf

def main() -> None:
    if len(sys.argv) < 2:
        return
    doc = pymupdf.open(sys.argv[1])
    page = doc[0] # first page
    html = page.get_text("html")
    with open("test_out.html", "w") as f:
        f.write(html)
    doc.close()

if __name__ == "__main__":
    main()
