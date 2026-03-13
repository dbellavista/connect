import pymupdf


def test_story() -> None:
    html = "<h1>Test</h1><p>This is a test of the Story API.</p>"
    story = pymupdf.Story(html=html)
    writer = pymupdf.DocumentWriter("test_story.pdf")
    rect = pymupdf.Rect(50, 50, 545, 792)
    
    # Place text on pages
    more = 1
    while more:
        device = writer.begin_page(rect)
        more, _ = story.place(rect)
        story.draw(device)
        writer.end_page()
    
    writer.close()
    print("Success")

if __name__ == "__main__":
    test_story()
