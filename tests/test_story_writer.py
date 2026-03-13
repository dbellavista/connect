import pymupdf


def test_story_writer() -> None:
    html = "<h1>Test</h1><p>This is a test of the DocumentWriter API. " * 100 + "</p>"
    story = pymupdf.Story(html=html)
    
    writer = pymupdf.DocumentWriter("test_writer.pdf")
    rect = pymupdf.Rect(50, 50, 545, 792)
    
    more = 1
    while more:
        device = writer.begin_page(rect)
        more, _ = story.place(device)
        story.draw(device)
        writer.end_page()
    
    writer.close()
    print("Success")

if __name__ == "__main__":
    test_story_writer()
