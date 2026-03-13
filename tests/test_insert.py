import pymupdf


def test_insert() -> None:
    doc = pymupdf.open()
    page = doc.new_page()
    rect = pymupdf.Rect(50, 50, 545, 792)
    # create long text
    text = "Line\n" * 100
    
    # insert_textbox
    # The return value depends on PyMuPDF version.
    res = page.insert_textbox(rect, text)
    print("Result:", res)
    doc.save("test_insert.pdf")

if __name__ == "__main__":
    test_insert()
