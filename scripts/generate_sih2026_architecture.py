"""
Generates the official SIH 2026 Architecture Blueprint for Lehar AI.
Specifically designed for Problem Statement SIH26067:
"Develop a web-based interactive 3D visualization platform that integrates numerical ocean model outputs and in-situ observations"
Theme: Disaster Management | Ministry of Earth Sciences (MoES) / INCOIS
"""

import os
import textwrap
from PIL import Image, ImageDraw, ImageFont

def create_architecture_diagram():
    W, H = 1920, 1080
    im = Image.new('RGBA', (W, H), (6, 16, 32, 255))
    draw = ImageDraw.Draw(im)

    # Subtle gradient background
    for y in range(H):
        ratio = y / H
        r = int(6 + ratio * 6)
        g = int(16 + ratio * 10)
        b = int(32 + ratio * 18)
        draw.line([(0, y), (W, y)], fill=(r, g, b, 255))

    # Fonts
    f_bold = 'C:/Windows/Fonts/segoeuib.ttf'
    f_semi = 'C:/Windows/Fonts/seguisb.ttf'
    f_reg = 'C:/Windows/Fonts/segoeui.ttf'

    font_title = ImageFont.truetype(f_bold, 40)
    font_sub = ImageFont.truetype(f_semi, 16)
    font_badge = ImageFont.truetype(f_bold, 15)
    font_badge_sub = ImageFont.truetype(f_reg, 12)

    font_col_header = ImageFont.truetype(f_bold, 18)
    font_pill_title = ImageFont.truetype(f_bold, 22)
    font_pill_desc = ImageFont.truetype(f_semi, 14)
    font_pill_sub = ImageFont.truetype(f_reg, 12)

    font_footer_title = ImageFont.truetype(f_bold, 15)
    font_footer_item = ImageFont.truetype(f_semi, 14)

    # 1. Top Header
    draw.text((60, 36), "'LEHAR AI' — 3D OCEAN DIGITAL TWIN ARCHITECTURE", fill=(0, 242, 254), font=font_title)
    draw.text((60, 88), 'Interactive 3D WebGL Visualization & Numerical Model / In-Situ Observation Ingestion Platform', fill=(148, 163, 184), font=font_sub)

    # Top Right Badge
    badge_x1, badge_y1 = W - 450, 28
    badge_x2, badge_y2 = W - 60, 112
    draw.rounded_rectangle([badge_x1, badge_y1, badge_x2, badge_y2], radius=10, fill=(11, 28, 52, 240), outline=(0, 242, 254, 200), width=1)
    draw.text((badge_x1 + 18, badge_y1 + 14), 'SIH 2026 • PSID: SIH26067', fill=(0, 242, 254), font=font_badge)
    draw.text((badge_x1 + 18, badge_y1 + 38), 'MoES / INCOIS • Disaster Management', fill=(226, 232, 240), font=font_badge_sub)
    draw.text((badge_x1 + 18, badge_y1 + 56), 'Team: Ctrl Alt Elites (SIH2654)', fill=(148, 163, 184), font=font_badge_sub)

    # 2. Five Column Layout
    margin_x = 60
    total_w = W - 2 * margin_x
    num_cols = 5
    gap_x = 22
    col_w = (total_w - (num_cols - 1) * gap_x) // num_cols
    col_top_y = 135
    col_h = 800

    columns = [
        {
            'title': 'USER INTERFACES',
            'accent': (56, 189, 248), # Sky
            'pills': [
                {'title': '3D Web Dashboard', 'sub': 'React 19 + Three.js WebGL', 'detail': 'Browser-Native 60 FPS Engine'},
                {'title': 'Telegram Voice Bot', 'sub': '@LeharAIBot Gateway', 'detail': '9 Indian Vernacular Dialects'},
                {'title': 'WhatsApp Simulator', 'sub': 'Low-Bandwidth Mobile Audio', 'detail': 'Zero-Download Compressed Voice'},
                {'title': '3D WebXR Explorer', 'sub': 'Volumetric Ocean Scene', 'detail': 'Zero Client Software Install'}
            ]
        },
        {
            'title': '3D & AI ENGINES',
            'accent': (168, 85, 247), # Purple
            'pills': [
                {'title': 'Three.js & Cesium', 'sub': 'Volumetric Water Column', 'detail': '0-2000m Depth Stratification'},
                {'title': 'Thermocline Slicer', 'sub': 'Dynamic Isosurface Cutter', 'detail': 'Mixed Layer Depth (MLD) Calculus'},
                {'title': 'Groq LLaMA 70B', 'sub': 'AST SQL Sandbox Validator', 'detail': '0% Data Hallucination Verified'},
                {'title': 'Groq Whisper v3', 'sub': '<300ms Neural Speech STT', 'detail': 'Edge-TTS Indic Voice Synthesis'}
            ]
        },
        {
            'title': 'DISASTER SERVICES',
            'accent': (251, 146, 60), # Orange
            'pills': [
                {'title': 'FastAPI Async Backend', 'sub': 'Python 3.12 + Uvicorn', 'detail': 'RESTful High-Speed Endpoints'},
                {'title': 'Marine Heatwave Radar', 'sub': 'Hobday 2016 Cat I-IV', 'detail': '3D Thermal Anomaly Tracking'},
                {'title': 'Cyclone Fuel / TCHP', 'sub': '26°C Isotherm Integration', 'detail': 'Storm Surge Hazard Geofencing'},
                {'title': 'Coast Guard 1554 SOS', 'sub': '<1.0s Autonomous SAR Mesh', 'detail': 'Crowd-Rescue Emergency Relay'}
            ]
        },
        {
            'title': 'DATA & STANDARDS',
            'accent': (45, 212, 191), # Teal
            'pills': [
                {'title': 'Standard 0.25° Grid', 'sub': 'Daily Synoptic Resampling', 'detail': 'Regular ~27km Spatial Mesh'},
                {'title': 'xarray + PyNIO Engine', 'sub': 'CF-1.8 Compliant NetCDF', 'detail': 'Sub-Second Variable Slicing'},
                {'title': 'NetCDF & Zarr Store', 'sub': 'Cloud-Native Array Chunks', 'detail': 'SQLite WAL (<5ms Reads)'},
                {'title': 'OGC WMS / WCS Layer', 'sub': 'OPeNDAP Data Streaming', 'detail': 'Direct Python & GIS Interop'}
            ]
        },
        {
            'title': 'OCEAN OBSERVATIONS',
            'accent': (52, 211, 153), # Emerald
            'pills': [
                {'title': 'INCOIS / ARGO GDAC', 'sub': '646+ In-Situ Float Profiles', 'detail': '72,000+ Depth CTD Readings'},
                {'title': 'INCOIS LAS & ERDDAP', 'sub': 'Numerical Ocean Models', 'detail': 'State Forecast Gridded Fields'},
                {'title': 'Copernicus Marine', 'sub': 'Global Ocean Physics', 'detail': '3D Currents & Salinity Velocity'},
                {'title': 'NOAA MUR & VIIRS', 'sub': '1km High-Resolution SST', 'detail': 'Chlorophyll-a Biomass Fronts'}
            ]
        }
    ]

    for c_idx, col in enumerate(columns):
        cx = margin_x + c_idx * (col_w + gap_x)
        accent = col['accent']

        # Column Container Box
        draw.rounded_rectangle([cx, col_top_y, cx + col_w, col_top_y + col_h], radius=14, fill=(10, 24, 46, 230), outline=(accent[0], accent[1], accent[2], 140), width=1)

        # Header Box inside column
        draw.rounded_rectangle([cx + 6, col_top_y + 6, cx + col_w - 6, col_top_y + 48], radius=8, fill=(accent[0], accent[1], accent[2], 40))
        draw.text((cx + 18, col_top_y + 16), col['title'], fill=(255, 255, 255), font=font_col_header)

        # Draw 4 Huge Pills inside
        pill_margin_top = col_top_y + 62
        avail_h = col_h - 78
        gap_y = 14
        pill_h = (avail_h - 3 * gap_y) // 4

        for p_idx, p in enumerate(col['pills']):
            py = pill_margin_top + p_idx * (pill_h + gap_y)

            # Pill box with distinct fill and glowing left accent
            draw.rounded_rectangle([cx + 10, py, cx + col_w - 10, py + pill_h], radius=10, fill=(15, 32, 58, 245), outline=(28, 62, 102, 230), width=1)
            # Left accent stripe
            draw.rounded_rectangle([cx + 10, py + 8, cx + 18, py + pill_h - 8], radius=3, fill=accent)

            # Pill Title (Huge, Bold, 22px)
            draw.text((cx + 28, py + 16), p['title'], fill=(255, 255, 255), font=font_pill_title)

            # Pill Subtitle (Semi-bold, colored accent, 14px)
            draw.text((cx + 28, py + 52), p['sub'], fill=accent, font=font_pill_desc)

            # Pill Detail (Clean slate grey, 12px)
            draw.text((cx + 28, py + 80), p['detail'], fill=(148, 163, 184), font=font_pill_sub)

    # 3. Bottom Deployment & Security Bar
    bar_y = 960
    bar_h = 75
    draw.rounded_rectangle([margin_x, bar_y, W - margin_x, bar_y + bar_h], radius=12, fill=(9, 22, 42, 250), outline=(0, 242, 254, 150), width=1)

    draw.text((margin_x + 24, bar_y + 26), 'DEPLOYMENT & STANDARDS:', fill=(0, 242, 254), font=font_footer_title)

    items = [
        '[+] Docker + Docker Compose',
        '[+] 0% Hallucination AST Sandbox',
        '[+] 0.25° Standardized Grid',
        '[+] OGC WMS/WCS Interoperable',
        '[+] 19/19 Pytest Passing'
    ]
    item_x = margin_x + 310
    item_gap = (W - margin_x - item_x) // len(items)
    for i, itm in enumerate(items):
        draw.text((item_x + i * item_gap, bar_y + 27), itm, fill=(226, 232, 240), font=font_footer_item)

    # 4. Save Outputs
    output_dir = 'ppt_images'
    os.makedirs(output_dir, exist_ok=True)

    png_path = os.path.join(output_dir, '1_architecture_blueprint_sih2026.png')
    im.save(png_path, 'PNG', quality=95)
    print(f'Saved: {png_path}')

    arch_png = os.path.join(output_dir, 'Lehar_AI_Architecture_Diagram.png')
    im.save(arch_png, 'PNG', quality=95)
    print(f'Saved: {arch_png}')

    jpg_path = os.path.join(output_dir, '1_architecture.jpg')
    im.convert('RGB').save(jpg_path, 'JPEG', quality=95)
    print(f'Saved: {jpg_path}')

if __name__ == '__main__':
    create_architecture_diagram()

