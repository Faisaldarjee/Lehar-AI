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
    WIDTH = 1920
    HEIGHT = 1080

    # 1. Base Image & Background Gradient
    img = Image.new("RGBA", (WIDTH, HEIGHT), (5, 14, 26, 255))
    draw = ImageDraw.Draw(img)

    # Subtle background gradient
    for y in range(HEIGHT):
        ratio = y / HEIGHT
        r = int(5 + ratio * 4)
        g = int(14 + ratio * 12)
        b = int(26 + ratio * 20)
        draw.line([(0, y), (WIDTH, y)], fill=(r, g, b, 255))

    # Subtle grid lines
    grid_color = (14, 35, 60, 90)
    for x in range(0, WIDTH, 60):
        draw.line([(x, 0), (x, HEIGHT)], fill=grid_color, width=1)
    for y in range(0, HEIGHT, 60):
        draw.line([(0, y), (WIDTH, y)], fill=grid_color, width=1)

    # Load system fonts
    font_path = "C:/Windows/Fonts/segoeui.ttf"
    font_bold_path = "C:/Windows/Fonts/segoeuib.ttf"
    font_semibold_path = "C:/Windows/Fonts/seguisb.ttf"

    font_title = ImageFont.truetype(font_bold_path, 32)
    font_header_sub = ImageFont.truetype(font_semibold_path, 14)
    font_badge_main = ImageFont.truetype(font_bold_path, 13)
    font_badge_sub = ImageFont.truetype(font_semibold_path, 11)
    font_col_header = ImageFont.truetype(font_bold_path, 13)
    font_card_title = ImageFont.truetype(font_bold_path, 13)
    font_card_body = ImageFont.truetype(font_path, 10)
    font_card_spec = ImageFont.truetype(font_semibold_path, 10)
    font_footer = ImageFont.truetype(font_semibold_path, 12)

    # 2. Top Header Section
    draw.text((60, 36), "LEHAR AI", fill=(0, 242, 254, 255), font=font_title)
    draw.text((215, 36), "— OCEANLENS 3D PLATFORM (लहर)", fill=(255, 255, 255, 255), font=font_title)
    draw.text((60, 78), "Web-Based Interactive 3D Platform Integrating Numerical Ocean Models & In-Situ Observations for Disaster Resilience", fill=(148, 163, 184, 255), font=font_header_sub)

    # Top Right SIH 2026 Official Badge
    badge_x1, badge_y1, badge_x2, badge_y2 = 1350, 28, 1860, 100
    draw.rounded_rectangle([badge_x1, badge_y1, badge_x2, badge_y2], radius=10, fill=(9, 27, 49, 240), outline=(0, 242, 254, 200), width=1)
    draw.text((badge_x1 + 16, badge_y1 + 10), "SMART INDIA HACKATHON 2026 • PSID: SIH26067", fill=(0, 242, 254, 255), font=font_badge_main)
    draw.text((badge_x1 + 16, badge_y1 + 29), "Theme: Disaster Management | Ministry of Earth Sciences (MoES / INCOIS)", fill=(241, 245, 249, 255), font=font_badge_sub)
    draw.text((badge_x1 + 16, badge_y1 + 47), "Team: Ctrl Alt Elites (SIH2654) | OceanLens 3D", fill=(148, 163, 184, 255), font=font_badge_sub)

    # 3. Five Architectural Columns Layout
    COL_WIDTH = 330
    COL_GAP = 28
    START_X = 60
    START_Y = 118
    COL_HEIGHT = 868

    columns_meta = [
        {
            "num": "01",
            "title": "DATA PIPELINE & SOURCES",
            "accent": (0, 242, 254),      # Cyan
            "cards": [
                {
                    "tag": "IN-SITU OBSERVATIONS",
                    "title": "Argo & Gliders (Ifremer FTP)",
                    "desc": "Robotic profiling floats & autonomous gliders measuring depth columns (0-2000m).",
                    "specs": ["• 646+ Arabian Sea & Bay of Bengal Profiles", "• 72,000+ CTD & BGC Telemetry Points", "• Real-time NetCDF Ingestion Engine"]
                },
                {
                    "tag": "NUMERICAL OCEAN MODELS",
                    "title": "INCOIS LAS & ERDDAP",
                    "desc": "Official ocean model outputs from Live Access Server & ERDDAP servers.",
                    "specs": ["• High-Resolution Ocean State Forecast", "• 0.25° Standardized Gridded Fields"]
                },
                {
                    "tag": "GLOBAL OCEAN PHYSICS",
                    "title": "Copernicus Marine Service",
                    "desc": "Multi-layer hydrodynamics, 3D salinity, and multi-depth current velocities.",
                    "specs": ["• 3D U/V Ocean Current Vectors", "• Subsurface Thermohaline Fields"]
                },
                {
                    "tag": "REMOTE SENSING MODELS",
                    "title": "NOAA MUR SST & NASA VIIRS",
                    "desc": "Multi-scale Sea Surface Temperature grids and ocean color phytoplankton biomass.",
                    "specs": ["• Daily Cloud-Free Ultra-High Res SST", "• Chlorophyll-a Biomass Fronts"]
                }
            ]
        },
        {
            "num": "02",
            "title": "PARSING, ZARR STORE & XAI",
            "accent": (45, 212, 191),     # Teal
            "cards": [
                {
                    "tag": "CF METADATA COMPLIANCE",
                    "title": "xarray + PyNIO Parser",
                    "desc": "High-throughput NetCDF parser compliant with international CF-1.8 conventions.",
                    "specs": ["• Modular Multi-Variable Ingestion Layer", "• Sub-second Dimensional Slicing", "• Zero Data Corruption Validation"]
                },
                {
                    "tag": "STANDARDIZED SPATIAL GRID",
                    "title": "0.25° Resampling Engine",
                    "desc": "Harmonizes heterogeneous satellite models and observational float tracks.",
                    "specs": ["• 0.25° x 0.25° (~27 km) Regular Grid", "• In-Memory Spatial KD-Tree Indexing", "• Daily Synoptic Time-Step Sync"]
                },
                {
                    "tag": "SCIENTIFIC VERIFICATION",
                    "title": "Model vs In-Situ Validation",
                    "desc": "Rigorous verification comparing numerical model predictions against ground-truth floats.",
                    "specs": ["• Real-Time Residual Delta (|Model - Float|)", "• Root Mean Square Error (RMSE) Calculus", "• Historical Calibration & Sensor Drift"]
                },
                {
                    "tag": "CLOUD-NATIVE PERSISTENCE",
                    "title": "NetCDF Store (xarray / Zarr)",
                    "desc": "Chunked array storage backed by high-speed SQLite Write-Ahead Logging (WAL).",
                    "specs": ["• Optimized Cloud Zarr Chunks", "• <5ms Read Latency for 72k+ Points", "• Edge-Compatible Lightweight Footprint"]
                }
            ]
        },
        {
            "num": "03",
            "title": "FASTAPI, OPENDAP & OGC",
            "accent": (59, 130, 246),     # Blue
            "cards": [
                {
                    "tag": "RESTFUL MICROSERVICES",
                    "title": "FastAPI (Python 3.12) + Uvicorn",
                    "desc": "Asynchronous high-performance API backend powering interactive web queries.",
                    "specs": ["• Sub-50ms Microservice Response Time", "• Asynchronous Non-Blocking Workers", "• Auto-Generated OpenAPI / Swagger Docs"]
                },
                {
                    "tag": "SCIENTIFIC INTEROPERABILITY",
                    "title": "OPeNDAP Data Server",
                    "desc": "Standard scientific protocol for direct remote array data slicing and retrieval.",
                    "specs": ["• Remote NetCDF Array Subsetting", "• Zero-Download In-Browser Streaming", "• Direct Python & R Client Compatibility"]
                },
                {
                    "tag": "GEOSPATIAL COMPLIANCE",
                    "title": "OGC WMS / WCS Engine",
                    "desc": "Open Geospatial Consortium standard Web Map & Coverage Services layer.",
                    "specs": ["• Standardized Map Tiles (WMS 1.3.0)", "• Gridded Coverage Data Slices (WCS)", "• GIS Interoperability (QGIS / ArcGIS)"]
                },
                {
                    "tag": "0% HALLUCINATION GUARANTEE",
                    "title": "AST Sandboxed NL2SQL",
                    "desc": "Deterministic Python calculation engine wrapped with Groq LLaMA 70B.",
                    "specs": ["• AST Grammar Syntax Whitelist", "• Read-Only Mathematical Verification", "• Facts-In, Narration-Out AI Delivery"]
                }
            ]
        },
        {
            "num": "04",
            "title": "THREE.JS / CESIUM 3D HERO",
            "accent": (168, 85, 247),     # Purple
            "cards": [
                {
                    "tag": "CORE SIH26067 SOLUTION",
                    "title": "3D Volumetric Ocean Renderer",
                    "desc": "Browser-native Three.js / Cesium.js WebGL engine running at 60 FPS.",
                    "specs": ["• Full Water Column Stratification (0-2000m)", "• Zero-Client Install (Pure Web Browser)", "• GPU Instancing & Dynamic LOD Meshes"]
                },
                {
                    "tag": "VOLUMETRIC SLICING",
                    "title": "Thermocline Isosurface Slicer",
                    "desc": "Interactive depth-slicing and thermocline gradient (dT/dz) analysis tool.",
                    "specs": ["• Dynamic Depth-Slice Navigation", "• Mixed Layer Depth (MLD) Boundary", "• Customizable Colormap & Exaggeration"]
                },
                {
                    "tag": "3D VECTOR FLUID DYNAMICS",
                    "title": "Current Streamlines & Particles",
                    "desc": "Real-time particle advection showing surface and subsurface ocean currents.",
                    "specs": ["• Directional Flow Velocity Particles", "• Multi-Depth Shear Vector Fields", "• Interactive Spatial Probe Hover Tool"]
                },
                {
                    "tag": "INSTRUMENT OVERLAY",
                    "title": "Float & Glider Marker Engine",
                    "desc": "Interactive 3D markers for Argo, Gliders, CTD & BGC observation stations.",
                    "specs": ["• Click-to-Inspect Depth Profile Charts", "• Recharts Telemetry Visualizations", "• Historical Trajectory Track Overlay"]
                }
            ]
        },
        {
            "num": "05",
            "title": "DISASTER INTELLIGENCE & ACCESS",
            "accent": (251, 146, 60),     # Coral/Orange
            "cards": [
                {
                    "tag": "DISASTER EARLY WARNING",
                    "title": "Marine Heatwave (MHW) Radar",
                    "desc": "Hierarchical thermal anomaly detector preventing fish mortality and coral bleaching.",
                    "specs": ["• Hobday et al. (2016) Cat I-IV Classifier", "• 3D Heat Penetration Depth Slicing", "• Proactive INCOIS Advisory Alerts"]
                },
                {
                    "tag": "CYCLONE DISASTER MITIGATION",
                    "title": "Cyclone Fuel & TCHP Engine",
                    "desc": "Tropical Cyclone Heat Potential calculated by integrating 26°C isotherm depth.",
                    "specs": ["• Cyclone Fuel Energy Index", "• Automated Storm Surge Geofencing", "• Rapid Coastal Evacuation Advisories"]
                },
                {
                    "tag": "LIFE-SAVING GUARDIAN",
                    "title": "Coast Guard 1554 SOS Mesh",
                    "desc": "Sub-second emergency distress pipeline bypassing LLM latencies.",
                    "specs": ["• <1.0s Direct Indian Coast Guard (1554)", "• Offshore Radio Mesh Emergency Relay", "• 90s Inactivity Fail-Safe Escalation"]
                },
                {
                    "tag": "OMNICHANNEL OUTREACH",
                    "title": "9 Indian Languages Gateway",
                    "desc": "Public science communication, e-learning and field access across coastal India.",
                    "specs": ["• Groq Whisper v3 (<300ms STT) + TTS", "• Telegram Bot (@LeharAIBot) & WebGIS", "• INCOIS Outreach & Exhibition Ready"]
                }
            ]
        }
    ]

    # Draw Columns
    for col_idx, col in enumerate(columns_meta):
        x = START_X + col_idx * (COL_WIDTH + COL_GAP)
        accent = col["accent"]

        # Column Header Box
        header_y1 = START_Y
        header_y2 = START_Y + 42
        draw.rounded_rectangle([x, header_y1, x + COL_WIDTH, header_y2], radius=8, fill=(11, 27, 48, 240), outline=(accent[0], accent[1], accent[2], 180), width=1)
        
        # Column number pill
        pill_w = 26
        draw.rounded_rectangle([x + 8, header_y1 + 8, x + 8 + pill_w, header_y1 + 34], radius=4, fill=(accent[0], accent[1], accent[2], 50))
        draw.text((x + 13, header_y1 + 12), col["num"], fill=accent, font=font_badge_main)
        
        # Column title
        draw.text((x + 42, header_y1 + 13), col["title"], fill=(255, 255, 255), font=font_col_header)

        # Draw Cards inside Column
        card_y = header_y2 + 14
        num_cards = len(col["cards"])
        available_height = COL_HEIGHT - 60
        card_gap = 12
        card_height = (available_height - (num_cards - 1) * card_gap) // num_cards

        for card in col["cards"]:
            card_box = [x, card_y, x + COL_WIDTH, card_y + card_height]
            draw.rounded_rectangle(card_box, radius=10, fill=(8, 21, 38, 235), outline=(22, 53, 87, 210), width=1)

            # Left accent stripe
            draw.rounded_rectangle([x, card_y + 8, x + 4, card_y + card_height - 8], radius=2, fill=accent)

            # Card Tag
            draw.text((x + 14, card_y + 10), card["tag"], fill=accent, font=font_card_spec)

            # Card Title
            draw.text((x + 14, card_y + 26), card["title"], fill=(255, 255, 255), font=font_card_title)

            # Card Description (Wrapped nicely to 2 lines maximum)
            wrapped_desc = textwrap.wrap(card["desc"], width=46)
            desc_y = card_y + 48
            for line in wrapped_desc[:2]:
                draw.text((x + 14, desc_y), line, fill=(148, 163, 184), font=font_card_body)
                desc_y += 14

            # Card Specs / Bullets
            bullet_y = desc_y + 6
            for spec in card["specs"]:
                draw.text((x + 14, bullet_y), spec, fill=(203, 213, 225), font=font_card_spec)
                bullet_y += 16

            card_y += card_height + card_gap

        # Connector arrow between columns (except last)
        if col_idx < len(columns_meta) - 1:
            arrow_x = x + COL_WIDTH + 6
            arrow_y = START_Y + COL_HEIGHT // 2
            draw.line([(arrow_x, arrow_y), (arrow_x + 14, arrow_y)], fill=(0, 242, 254, 150), width=2)
            draw.polygon([(arrow_x + 14, arrow_y - 4), (arrow_x + 20, arrow_y), (arrow_x + 14, arrow_y + 4)], fill=(0, 242, 254, 220))

    # 4. Bottom Footer Benchmarks & Standards Bar
    footer_y1 = 1005
    footer_y2 = 1050
    draw.rounded_rectangle([START_X, footer_y1, WIDTH - START_X, footer_y2], radius=8, fill=(7, 18, 33, 245), outline=(22, 53, 87, 230), width=1)

    items = [
        "[+] Browser-Native WebGL 60 FPS",
        "[+] CF-1.8 & OGC WMS/WCS Compliant",
        "[+] 0.25 deg Standardized Spatial Grid",
        "[+] <5ms Telemetry Read Latency",
        "[+] Zero-Client Desktop Install",
        "[+] Docker Compose Containerized",
        "[+] 19/19 Pytest Suite Passed"
    ]
    item_gap = (WIDTH - 2 * START_X) // len(items)
    for i, item in enumerate(items):
        item_x = START_X + i * item_gap + 12
        draw.text((item_x, footer_y1 + 14), item, fill=(148, 163, 184), font=font_footer)

    # 5. Save Outputs
    output_dir = "ppt_images"
    os.makedirs(output_dir, exist_ok=True)
    
    png_path = os.path.join(output_dir, "1_architecture_blueprint_sih2026.png")
    img.save(png_path, "PNG", quality=95)
    print(f"Saved: {png_path}")

    rgb_img = img.convert("RGB")
    jpg_path = os.path.join(output_dir, "1_architecture.jpg")
    rgb_img.save(jpg_path, "JPEG", quality=95)
    print(f"Saved: {jpg_path}")

if __name__ == "__main__":
    create_architecture_diagram()
