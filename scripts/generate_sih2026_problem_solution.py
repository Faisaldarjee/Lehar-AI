# -*- coding: utf-8 -*-
import os
import textwrap
from PIL import Image, ImageDraw, ImageFont

def draw_cross(draw, x, y, size=16, color=(248, 113, 113), width=3):
    r = size // 2
    draw.line([(x - r, y - r), (x + r, y + r)], fill=color, width=width)
    draw.line([(x + r, y - r), (x - r, y + r)], fill=color, width=width)

def draw_check(draw, x, y, size=16, color=(52, 211, 153), width=3):
    draw.line([(x - 7, y), (x - 1, y + 6)], fill=color, width=width)
    draw.line([(x - 1, y + 6), (x + 9, y - 7)], fill=color, width=width)

def render_problem_solution():
    W, H = 1920, 1080
    im = Image.new('RGB', (W, H), (6, 16, 32))
    draw = ImageDraw.Draw(im)

    # 1. Background Gradient (Dark Navy Deep Ocean)
    for y in range(H):
        ratio = y / H
        r = int(6 + ratio * 5)
        g = int(16 + ratio * 10)
        b = int(32 + ratio * 18)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    # Subtle horizontal guide lines
    for y in range(0, H, 90):
        draw.line([(0, y), (W, y)], fill=(14, 32, 56), width=1)

    # Fonts
    f_bold = 'C:/Windows/Fonts/segoeuib.ttf'
    f_reg = 'C:/Windows/Fonts/segoeui.ttf'
    f_semi = 'C:/Windows/Fonts/seguisb.ttf'

    font_main_title = ImageFont.truetype(f_bold, 42)
    font_sub_title = ImageFont.truetype(f_reg, 16)
    font_badge_bold = ImageFont.truetype(f_bold, 15)
    font_badge_sub = ImageFont.truetype(f_reg, 12)

    font_sec_h1 = ImageFont.truetype(f_bold, 30)
    font_sec_sub = ImageFont.truetype(f_bold, 20)

    font_card_title = ImageFont.truetype(f_bold, 22)
    font_card_desc = ImageFont.truetype(f_reg, 14)
    font_card_tag_label = ImageFont.truetype(f_bold, 12)
    font_card_tag = ImageFont.truetype(f_semi, 13)
    font_card_stat = ImageFont.truetype(f_bold, 13)
    font_banner = ImageFont.truetype(f_semi, 15)
    font_footer = ImageFont.truetype(f_reg, 13)

    # 2. Header Section
    draw.text((80, 40), 'LEHAR AI — THE PROBLEM vs THE SOLUTION', fill=(255, 255, 255), font=font_main_title)
    draw.text((80, 98), 'Transforming Fragmented 2D Ocean Software into a Browser-Native 3D Volumetric Digital Twin', fill=(148, 163, 184), font=font_sub_title)

    # Top Right SIH 2026 Badge
    badge_x1, badge_y1 = W - 440, 32
    badge_x2, badge_y2 = W - 80, 116
    draw.rounded_rectangle([badge_x1, badge_y1, badge_x2, badge_y2], radius=10, fill=(11, 28, 52), outline=(0, 242, 254), width=1)
    draw.text((badge_x1 + 18, badge_y1 + 14), 'SIH 2026 • PSID: SIH26067', fill=(0, 242, 254), font=font_badge_bold)
    draw.text((badge_x1 + 18, badge_y1 + 38), 'MoES / INCOIS • Disaster Management', fill=(226, 232, 240), font=font_badge_sub)
    draw.text((badge_x1 + 18, badge_y1 + 56), 'Team Ctrl Alt Elites (SIH2654)', fill=(148, 163, 184), font=font_badge_sub)

    # 3. Center Glowing Divider
    div_x = 960
    draw.line([(div_x, 150), (div_x, 940)], fill=(22, 53, 87), width=2)
    draw.line([(div_x, 220), (div_x, 870)], fill=(0, 242, 254), width=2)

    # Center VS Badge
    vs_y = 535
    draw.ellipse([div_x - 26, vs_y - 26, div_x + 26, vs_y + 26], fill=(11, 27, 48), outline=(0, 242, 254), width=2)
    draw.text((div_x - 13, vs_y - 11), 'VS', fill=(0, 242, 254), font=font_badge_bold)

    # 4. Columns Geometry
    card_w = 385
    card_h = 295
    col_gap_x = 24
    row_gap_y = 20

    left_start_x = 80
    right_start_x = 995
    grid_top_y = 245

    # Column Titles
    draw.text((left_start_x, 165), chr(39) + 'THE PROBLEM' + chr(39), fill=(255, 255, 255), font=font_sec_h1)
    draw.text((left_start_x + 250, 174), 'BEFORE LEHAR AI', fill=(248, 113, 113), font=font_sec_sub)

    draw.text((right_start_x, 165), chr(39) + 'THE SOLUTION' + chr(39), fill=(255, 255, 255), font=font_sec_h1)
    draw.text((right_start_x + 255, 174), 'WITH LEHAR AI (OceanLens 3D)', fill=(52, 211, 153), font=font_sec_sub)

    # Problem Cards (Left)
    prob_cards = [
        {
            'col': 0, 'row': 0,
            'title': 'Fragmented Desktop Tools',
            'desc': 'Forecasters toggle between MATLAB, Ferret, ArcGIS & GrADS. Zero integrated web tool exists.',
            'tag_label': 'PAIN POINT:',
            'tag': 'Hours lost wrestling separate desktop apps',
            'stat': '0 Web Integration'
        },
        {
            'col': 1, 'row': 0,
            'title': 'Disconnected Data Silos',
            'desc': 'Gridded NetCDF models and in-situ Argo/Glider floats stored separately with no automated validation.',
            'tag_label': 'PAIN POINT:',
            'tag': 'Manual model-vs-float cross-checking',
            'stat': 'Data Fragmentation'
        },
        {
            'col': 0, 'row': 1,
            'title': 'Flat 2D Visual Blindspots',
            'desc': '2D planar maps fail to display subsurface thermoclines, 0-2000m depth stratification, and internal shear.',
            'tag_label': 'PAIN POINT:',
            'tag': 'Zero volumetric 3D water column depth',
            'stat': 'No Subsurface View'
        },
        {
            'col': 1, 'row': 1,
            'title': 'Delayed Hazard Response',
            'desc': 'Marine heatwaves and cyclone fuel (TCHP) require hours of offline code. Zero regional voice outreach.',
            'tag_label': 'PAIN POINT:',
            'tag': '25-35% hallucination risk in raw AI tools',
            'stat': 'Slow Disaster Action'
        }
    ]

    for c in prob_cards:
        cx = left_start_x + c['col'] * (card_w + col_gap_x)
        cy = grid_top_y + c['row'] * (card_h + row_gap_y)

        # Card Box
        draw.rounded_rectangle([cx, cy, cx + card_w, cy + card_h], radius=12, fill=(15, 24, 40), outline=(239, 68, 68), width=1)

        # Top-left Red Cross Badge (Vector Drawn)
        draw.ellipse([cx + 16, cy + 16, cx + 46, cy + 46], fill=(45, 18, 25), outline=(239, 68, 68), width=1)
        draw_cross(draw, cx + 31, cy + 31, size=14, color=(248, 113, 113), width=2)

        # Top-right Stat pill
        draw.rounded_rectangle([cx + card_w - 180, cy + 16, cx + card_w - 14, cy + 46], radius=6, fill=(45, 18, 25), outline=(239, 68, 68), width=1)
        draw.text((cx + card_w - 168, cy + 24), c['stat'], fill=(248, 113, 113), font=font_card_stat)

        # Card Title
        draw.text((cx + 18, cy + 62), c['title'], fill=(255, 255, 255), font=font_card_title)

        # Card Description
        desc_wrapped = textwrap.wrap(c['desc'], width=36)
        dy = cy + 102
        for line in desc_wrapped:
            draw.text((cx + 18, dy), line, fill=(148, 163, 184), font=font_card_desc)
            dy += 22

        # Bottom Pain Point Tag Box
        tag_box_y = cy + card_h - 80
        draw.rounded_rectangle([cx + 14, tag_box_y, cx + card_w - 14, tag_box_y + 66], radius=8, fill=(35, 18, 25), outline=(239, 68, 68), width=1)
        draw.text((cx + 22, tag_box_y + 10), c['tag_label'], fill=(248, 113, 113), font=font_card_tag_label)
        tag_wrapped = textwrap.wrap(c['tag'], width=33)
        ty = tag_box_y + 30
        for t_line in tag_wrapped:
            draw.text((cx + 22, ty), t_line, fill=(254, 202, 202), font=font_card_tag)
            ty += 18

    # Solution Cards (Right)
    sol_cards = [
        {
            'col': 0, 'row': 0,
            'title': 'Browser-Native 60 FPS 3D',
            'desc': 'Zero desktop install. WebGL Three.js & Cesium.js volumetric rendering directly in any standard browser.',
            'tag_label': 'SOLUTION VALUE:',
            'tag': 'Full 0-2000m depth stratification at 60 FPS',
            'stat': '100% Web Engine'
        },
        {
            'col': 1, 'row': 0,
            'title': 'Unified 0.25° Ingestion',
            'desc': 'Standardized grid harmonizing NOAA/INCOIS models with 72k+ Argo CTD points via OPeNDAP & Zarr.',
            'tag_label': 'SOLUTION VALUE:',
            'tag': 'Sub-second real-time RMSE delta verification',
            'stat': '<5ms Read Latency'
        },
        {
            'col': 0, 'row': 1,
            'title': 'Dynamic Volumetric Slicing',
            'desc': 'Interactive thermocline cross-sections, MLD depth cutter, 3D current particle streamlines & float charts.',
            'tag_label': 'SOLUTION VALUE:',
            'tag': 'Customizable colormaps & depth exaggeration',
            'stat': 'Dynamic Isosurfaces'
        },
        {
            'col': 1, 'row': 1,
            'title': 'Disaster Radar & 9 Languages',
            'desc': 'Hobday (2016) Marine Heatwave classifier, Cyclone TCHP, <1s Coast Guard 1554 SOS & vernacular voice.',
            'tag_label': 'SOLUTION VALUE:',
            'tag': '0% hallucination guaranteed via AST sandbox',
            'stat': 'Zero Hallucination'
        }
    ]

    for c in sol_cards:
        cx = right_start_x + c['col'] * (card_w + col_gap_x)
        cy = grid_top_y + c['row'] * (card_h + row_gap_y)

        # Card Box
        draw.rounded_rectangle([cx, cy, cx + card_w, cy + card_h], radius=12, fill=(10, 28, 42), outline=(52, 211, 153), width=1)

        # Top-left Green Checkmark Badge (Vector Drawn)
        draw.ellipse([cx + 16, cy + 16, cx + 46, cy + 46], fill=(12, 45, 32), outline=(52, 211, 153), width=1)
        draw_check(draw, cx + 31, cy + 31, size=14, color=(52, 211, 153), width=2)

        # Top-right Stat pill (Dark emerald fill, bright neon text)
        draw.rounded_rectangle([cx + card_w - 180, cy + 16, cx + card_w - 14, cy + 46], radius=6, fill=(12, 45, 32), outline=(52, 211, 153), width=1)
        draw.text((cx + card_w - 168, cy + 24), c['stat'], fill=(52, 211, 153), font=font_card_stat)

        # Card Title
        draw.text((cx + 18, cy + 62), c['title'], fill=(255, 255, 255), font=font_card_title)

        # Card Description
        desc_wrapped = textwrap.wrap(c['desc'], width=36)
        dy = cy + 102
        for line in desc_wrapped:
            draw.text((cx + 18, dy), line, fill=(148, 163, 184), font=font_card_desc)
            dy += 22

        # Bottom Value Tag Box
        tag_box_y = cy + card_h - 80
        draw.rounded_rectangle([cx + 14, tag_box_y, cx + card_w - 14, tag_box_y + 66], radius=8, fill=(14, 40, 34), outline=(52, 211, 153), width=1)
        draw.text((cx + 22, tag_box_y + 10), c['tag_label'], fill=(52, 211, 153), font=font_card_tag_label)
        tag_wrapped = textwrap.wrap(c['tag'], width=33)
        ty = tag_box_y + 30
        for t_line in tag_wrapped:
            draw.text((cx + 22, ty), t_line, fill=(167, 243, 208), font=font_card_tag)
            ty += 18

    # 5. Bottom Callout Banners
    callout_y = 880
    callout_h = 62

    # Left Callout Banner
    draw.rounded_rectangle([left_start_x, callout_y, left_start_x + 2 * card_w + col_gap_x, callout_y + callout_h], radius=10, fill=(30, 18, 26), outline=(239, 68, 68), width=1)
    draw_cross(draw, left_start_x + 36, callout_y + 31, size=16, color=(248, 113, 113), width=2)
    draw.text((left_start_x + 60, callout_y + 20), 'Forecasters & coastal officers lack a unified 3D platform to correlate models with ground-truth floats.', fill=(254, 202, 202), font=font_banner)

    # Right Callout Banner
    draw.rounded_rectangle([right_start_x, callout_y, right_start_x + 2 * card_w + col_gap_x, callout_y + callout_h], radius=10, fill=(12, 36, 32), outline=(52, 211, 153), width=1)
    draw_check(draw, right_start_x + 36, callout_y + 31, size=16, color=(52, 211, 153), width=2)
    draw.text((right_start_x + 60, callout_y + 20), 'One browser-native platform for INCOIS operations, disaster resilience & public vernacular outreach.', fill=(167, 243, 208), font=font_banner)

    # 6. Bottom Screen Footer
    draw.text((80, 990), 'Ctrl Alt Elites, building Lehar AI for INCOIS and the Ministry of Earth Sciences (MoES)', fill=(100, 116, 139), font=font_footer)
    draw.text((W - 350, 990), 'Smart India Hackathon 2026 • PSID: SIH26067', fill=(100, 116, 139), font=font_footer)

    # 7. Save Images
    out_dir = 'ppt_images'
    os.makedirs(out_dir, exist_ok=True)

    png_path = os.path.join(out_dir, '5_problem_solution.png')
    im.save(png_path, 'PNG', quality=95)
    print(f'Saved: {png_path}')

    jpg_path = os.path.join(out_dir, '5_problem_solution.jpg')
    im.save(jpg_path, 'JPEG', quality=95)
    print(f'Saved: {jpg_path}')

if __name__ == '__main__':
    render_problem_solution()
