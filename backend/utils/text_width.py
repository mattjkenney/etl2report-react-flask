import tkinter as tk

def measure_text_width(text, font_family='Times New Roman', font_size=12):
    root = tk.Tk()
    root.withdraw()
    font = (font_family, font_size)
    canvas = tk.Canvas(root)
    width = canvas.create_text(0, 0, text=text, font=font)
    bbox = canvas.bbox(width)
    root.destroy()
    if bbox:
        return bbox[2] - bbox[0]
    return 0
