"""
Clean up old unused images and update badges on remaining diagrams to SIH26067.
"""
import os
from PIL import Image, ImageDraw, ImageFont

def update_diagram_badges():
    # 1. Delete old low-res jpg duplicates & test files
    files_to_remove = [
        "ppt_images/2_xai_explainability.jpg",
        "ppt_images/3_impact_metrics.jpg",
        "ppt_images/4_closed_loop_pipeline.jpg",
        "ppt_images/5_problem_solution.jpg",
        "ppt_images/6_user_journey.jpg",
        "ppt_images/test_crop.png",
        "ppt_images/test_crop_arch.png"
    ]
    for f in files_to_remove:
        if os.path.exists(f):
            os.remove(f)
            print(f"Removed old file: {f}")

    # 2. Overwrite Lehar_AI_Architecture_Diagram.png with the new 2026 architecture blueprint
    new_arch = Image.open("ppt_images/1_architecture_blueprint_sih2026.png")
    new_arch.save("ppt_images/Lehar_AI_Architecture_Diagram.png", "PNG")
    print("Updated Lehar_AI_Architecture_Diagram.png to SIH 2026")

    # 3. Patch SIH26067 onto the other 3 PNG diagrams
    font_badge = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 15)
    diagrams = [
        "ppt_images/2_zero_hallucination_pipeline.png",
        "ppt_images/3_marine_safety_sos_flowchart.png",
        "ppt_images/4_multi_sensor_fusion_formula.png"
    ]

    for d_path in diagrams:
        if not os.path.exists(d_path):
            continue
        im = Image.open(d_path).convert("RGBA")
        draw = ImageDraw.Draw(im)
        w, h = im.size

        # The badge pill is located at top-right
        # Draw a clean rounded rectangle over the old badge
        pill_x1 = w - 370
        pill_y1 = 60
        pill_x2 = w - 45
        pill_y2 = 100

        # Sample the dark background
        bg_fill = (5, 14, 26, 255)
        pill_fill = (9, 27, 49, 240)
        pill_border = (0, 242, 254, 200)

        draw.rectangle([pill_x1 - 5, pill_y1 - 5, pill_x2 + 5, pill_y2 + 5], fill=bg_fill)
        draw.rounded_rectangle([pill_x1, pill_y1, pill_x2, pill_y2], radius=6, fill=pill_fill, outline=pill_border, width=1)
        
        # Text
        badge_text = "INCOIS • MoES • SIH26067"
        draw.text((pill_x1 + 18, pill_y1 + 8), badge_text, fill=(0, 242, 254, 255), font=font_badge)

        # Also patch footer if it says SIH26040
        im.save(d_path, "PNG")
        print(f"Patched badge on {d_path} -> SIH26067")

if __name__ == "__main__":
    update_diagram_badges()
