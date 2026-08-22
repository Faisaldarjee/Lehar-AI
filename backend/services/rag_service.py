"""
Lehar AI Backend — Oceanographic Vector RAG & Knowledge Service
Provides semantic search and domain knowledge retrieval for oceanography concepts,
INCOIS advisory bulletins, marine heatwave classifications, and WMO Argo float specifications.
"""

from __future__ import annotations
import math
import re
from typing import Any
from collections import Counter


# Curated Oceanographic Knowledge Corpus for SIH 2026 / INCOIS Problem Statement
OCEAN_KNOWLEDGE_CORPUS: list[dict[str, Any]] = [
    {
        "id": "iod_monsoon",
        "title": "Indian Ocean Dipole (IOD) & Monsoon Dynamics",
        "category": "Climate Phenomena",
        "tags": ["iod", "indian ocean dipole", "monsoon", "upwelling", "sea surface temperature", "sst", "climate"],
        "content": (
            "The Indian Ocean Dipole (IOD) is a coupled ocean-atmosphere climate phenomenon in the equatorial Indian Ocean. "
            "In a Positive IOD phase, anomalous easterly winds cause coastal upwelling of cold, nutrient-rich water in the eastern "
            "Indian Ocean (near Sumatra/Java), while sea surface temperatures (SST) rise in the western Indian Ocean and Arabian Sea. "
            "A positive IOD typically enhances the Indian Summer Monsoon Rainfall (ISMR) and triggers vigorous pelagic fish blooms "
            "along India's west coast due to coastal upwelling. A Negative IOD brings warmer waters to the eastern Indian Ocean and "
            "suppressed upwelling in the Arabian Sea, often reducing monsoon activity."
        ),
        "hero_metric": {"label": "Climate Mode", "value": "IOD Phase", "unit": "Enso-Coupled"},
        "key_facts": [
            {"icon": "waves", "label": "Impact", "value": "Monsoon & Upwelling"},
            {"icon": "thermometer", "label": "Thermal Delta", "value": "+1.5°C to -2.0°C"},
            {"icon": "compass", "label": "Primary Sector", "value": "Equatorial Indian Ocean"}
        ]
    },
    {
        "id": "mhw_hobday_classification",
        "title": "Marine Heatwaves (MHW) & Hobday Classification",
        "category": "Thermal Extremes",
        "tags": ["mhw", "marine heatwave", "heatwave", "hobday", "bleaching", "thermal anomaly", "climatology"],
        "content": (
            "Marine Heatwaves (MHW) are prolonged discrete abnormally warm sea surface temperature events defined by Hobday et al. (2016). "
            "An MHW occurs when SST exceeds the 90th percentile of local 30-year climatological baselines for at least 5 consecutive days. "
            "Categories are scaled by the local climatological thermal difference (Delta T): "
            "Category I (Moderate: 1x to 2x Delta T), Category II (Strong: 2x to 3x Delta T), Category III (Severe: 3x to 4x Delta T), and "
            "Category IV (Extreme: >4x Delta T). In the Arabian Sea and Bay of Bengal, Category II+ MHWs cause widespread coral bleaching in "
            "the Lakshadweep and Andaman reefs, displace pelagic fish schools (mackerel, tuna) into deeper bathymetric layers, and fuel rapid "
            "tropical cyclone intensification (TC heat potential)."
        ),
        "hero_metric": {"label": "Baseline Standard", "value": "Hobday et al.", "unit": "Cat I–IV"},
        "key_facts": [
            {"icon": "thermometer", "label": "Threshold", "value": "90th Percentile"},
            {"icon": "alert", "label": "Ecological Risk", "value": "Coral Bleaching / PFZ Shift"},
            {"icon": "activity", "label": "Min Duration", "value": "5+ Days"}
        ]
    },
    {
        "id": "thermocline_mld",
        "title": "Thermocline Gradient & Mixed Layer Depth (MLD)",
        "category": "Physical Oceanography",
        "tags": ["thermocline", "mld", "mixed layer depth", "pycnocline", "halocline", "water column", "stratification"],
        "content": (
            "The Mixed Layer Depth (MLD) is the near-surface ocean layer where active turbulence and wind-driven mixing keep temperature "
            "and salinity homogeneous. In the Indian Ocean, INCOIS defines MLD as the depth where temperature decreases by 0.5°C or 0.8°C "
            "from the 10-meter surface reference. Below the MLD lies the Thermocline—a layer of sharp vertical temperature gradient where "
            "water cools rapidly down to 1000m. A shallow MLD (<20m) indicates strong stratification or coastal upwelling (ideal for pelagic "
            "fish feeding on plankton). A deep MLD (>60m) represents high thermal content that can sustain severe cyclogenesis."
        ),
        "hero_metric": {"label": "Thermal Boundary", "value": "Thermocline", "unit": "ΔT > 0.5°C"},
        "key_facts": [
            {"icon": "ruler", "label": "Typical MLD", "value": "15–60 meters"},
            {"icon": "fish", "label": "PFZ Link", "value": "Shallow MLD = High Feeding"},
            {"icon": "activity", "label": "CTD Sensor", "value": "0.1 dbar Resolution"}
        ]
    },
    {
        "id": "omz_bay_of_bengal",
        "title": "Oxygen Minimum Zones (OMZ) & Arabian Sea Biogeochemistry",
        "category": "Biogeochemistry",
        "tags": ["omz", "oxygen", "dissolved oxygen", "arabian sea", "bay of bengal", "hypoxia", "dead zone"],
        "content": (
            "The northern Arabian Sea and Bay of Bengal harbor some of the world's most intense permanent Oxygen Minimum Zones (OMZ), "
            "typically situated between 100m and 1000m depth. High biological productivity in the surface photic zone leads to massive "
            "organic matter sinking, where bacterial respiration consumes dissolved oxygen (DO < 0.5 ml/L). This forces commercial fish species "
            "such as Yellowfin Tuna, Pomfret, and King Mackerel to compress into the top 50–75m of the oxygenated water column. "
            "Argo biogeochemical (BGC-Argo) profiling floats with optode sensors continuously track the vertical boundaries of this hypoxia zone."
        ),
        "hero_metric": {"label": "Hypoxia Core Depth", "value": "100–800", "unit": "meters"},
        "key_facts": [
            {"icon": "activity", "label": "DO Threshold", "value": "< 0.5 ml/L"},
            {"icon": "fish", "label": "Fisheries Effect", "value": "Epipelagic Compression"},
            {"icon": "compass", "label": "Core Basin", "value": "North Arabian Sea"}
        ]
    },
    {
        "id": "argo_float_technology",
        "title": "Argo Float Network & Sensor Specifications",
        "category": "Observational Oceanography",
        "tags": ["argo", "float", "wmo", "ctd", "sensor", "cycle", "drift", "telemetry", "incois", "moes"],
        "content": (
            "The International Argo Program operates ~4,000 autonomous robotic floats globally, with over 150 active units deployed across "
            "the Indian Ocean by INCOIS (Ministry of Earth Sciences, India). Each float operates on a standard 10-day sampling cycle: "
            "it descends to a parking depth of 1,000 meters for 9 days drifting with ocean currents, then descends to 2,000 meters before "
            "ascending to the surface while its Seabird CTD sensor measures temperature (±0.002°C), salinity (±0.005 PSU), and pressure (±2 dbar). "
            "At the surface, it transmits high-resolution hydrographic profiles via Iridium satellite telemetry to INCOIS data centers."
        ),
        "hero_metric": {"label": "Max Profile Depth", "value": "2,000", "unit": "meters"},
        "key_facts": [
            {"icon": "activity", "label": "Cycle Period", "value": "10 Days"},
            {"icon": "database", "label": "Telemetry", "value": "Iridium Satellite"},
            {"icon": "ruler", "label": "Parking Depth", "value": "1,000 dbar"}
        ]
    },
    {
        "id": "pfz_methodology",
        "title": "INCOIS Potential Fishing Zones (PFZ) Methodology",
        "category": "Fisheries Oceanography",
        "tags": ["pfz", "potential fishing zone", "fishing", "chlorophyll", "thermal front", "sst", "incois", "advisory"],
        "content": (
            "INCOIS generates Potential Fishing Zone (PFZ) advisories by integrating satellite-derived Sea Surface Temperature (SST) gradients "
            "with Ocean Color (Chlorophyll-a) imagery and in-situ Argo thermocline parameters. Thermal fronts, oceanic eddies, and upwelling zones "
            "create biological confluence zones where nutrient-rich deeper water supports dense phytoplankton blooms. Small pelagics (sardines, anchovies) "
            "congregate to graze on this plankton, which in turn attracts commercially valuable predatory fish like King Mackerel (Surmai), Tuna, "
            "and Pomfret. Validated PFZ advisories reduce search time by 30–70% and increase catch-per-unit-effort (CPUE) for Indian artisanal fishermen."
        ),
        "hero_metric": {"label": "Search Time Saved", "value": "30–70%", "unit": "Fuel Reduction"},
        "key_facts": [
            {"icon": "fish", "label": "Target Zones", "value": "Thermal Fronts & Eddies"},
            {"icon": "activity", "label": "Sensors", "value": "NOAA SST + NASA Chl-a"},
            {"icon": "compass", "label": "Coverage", "value": "All Coastal EEZ Sectors"}
        ]
    },
    {
        "id": "monsoon_fishing_ban",
        "title": "Indian Monsoon Uniform Fishing Ban Guidelines",
        "category": "Maritime Governance",
        "tags": ["fishing ban", "ban", "monsoon ban", "breeding", "trawling", "conservation", "government", "regulation"],
        "content": (
            "To conserve marine fishery resources and protect fish spawning during peak breeding seasons, the Ministry of Fisheries, Animal Husbandry "
            "and Dairying mandates an annual 61-day uniform fishing ban across India's Exclusive Economic Zone (EEZ). "
            "1. West Coast (Arabian Sea: Gujarat, Maharashtra, Goa, Karnataka, Kerala): June 1 to July 31. "
            "2. East Coast (Bay of Bengal: Tamil Nadu, Andhra Pradesh, Odisha, West Bengal): April 15 to June 14. "
            "Mechanized fishing vessels and motorized trawlers are strictly barred from operations, while traditional non-motorized craft are exempt."
        ),
        "hero_metric": {"label": "Uniform Ban Period", "value": "61", "unit": "Days"},
        "key_facts": [
            {"icon": "calendar", "label": "West Coast", "value": "01 June – 31 July"},
            {"icon": "calendar", "label": "East Coast", "value": "15 April – 14 June"},
            {"icon": "alert", "label": "Objective", "value": "Spawning Stock Biomass Protection"}
        ]
    },
    {
        "id": "salinity_inversion",
        "title": "Bay of Bengal vs Arabian Sea Salinity Dynamics",
        "category": "Regional Oceanography",
        "tags": ["salinity", "salinity inversion", "bay of bengal", "arabian sea", "freshwater", "monsoon", "barrier layer"],
        "content": (
            "The Arabian Sea and the Bay of Bengal exhibit radically contrasting salinity regimes despite occupying the same tropical latitude band. "
            "The Arabian Sea experiences intense net evaporation, resulting in high surface salinities (>35.5 to 36.5 PSU). In contrast, the Bay of Bengal "
            "receives massive freshwater runoff from the Ganges, Brahmaputra, Mahanadi, Godavari, and Irrawaddy rivers (>1.6 x 10^12 m3/year), creating a thin, "
            "buoyant low-salinity surface layer (28.0–33.0 PSU). This strong halocline forms a 'Barrier Layer' between the mixed layer and thermocline, "
            "which traps solar radiation, creates temperature inversions during winter, and inhibits vertical nutrient mixing."
        ),
        "hero_metric": {"label": "Salinity Delta", "value": "4.5–6.0", "unit": "PSU Difference"},
        "key_facts": [
            {"icon": "waves", "label": "Arabian Sea", "value": "35.5–36.5 PSU (Evaporative)"},
            {"icon": "waves", "label": "Bay of Bengal", "value": "28.0–33.0 PSU (River Influx)"},
            {"icon": "activity", "label": "Barrier Layer", "value": "Thermal Trapping & Halocline"}
        ]
    }
]


def tokenize_text(text: str) -> list[str]:
    """Tokenize and normalize text into clean lower-case alphanumeric terms."""
    return re.findall(r"\b[a-z0-9]{2,}\b", text.lower())


class SimpleTFIDFIndex:
    """
    Lightweight, fast zero-dependency TF-IDF Vector Space search engine
    for the oceanographic knowledge corpus.
    """
    def __init__(self, corpus: list[dict[str, Any]]):
        self.corpus = corpus
        self.doc_count = len(corpus)
        self.df: Counter[str] = Counter()
        self.doc_vectors: list[dict[str, float]] = []

        # Build vocabulary and document frequencies
        doc_tokens_list: list[list[str]] = []
        for doc in corpus:
            text = f"{doc['title']} {doc['category']} {' '.join(doc['tags'])} {doc['content']}"
            tokens = tokenize_text(text)
            doc_tokens_list.append(tokens)
            unique_terms = set(tokens)
            for term in unique_terms:
                self.df[term] += 1

        # Calculate IDF and document TF-IDF vectors
        for tokens in doc_tokens_list:
            tf = Counter(tokens)
            vector: dict[str, float] = {}
            total_terms = len(tokens)
            for term, count in tf.items():
                idf = math.log((self.doc_count + 1) / (self.df[term] + 1)) + 1.0
                vector[term] = (count / total_terms) * idf
            # Normalize vector magnitude
            norm = math.sqrt(sum(v * v for v in vector.values())) or 1.0
            for term in vector:
                vector[term] /= norm
            self.doc_vectors.append(vector)

    def search(self, query: str, top_k: int = 2) -> list[dict[str, Any]]:
        """Search the corpus and return the top-K highest scoring documents."""
        q_tokens = tokenize_text(query)
        if not q_tokens:
            return []

        q_tf = Counter(q_tokens)
        q_vector: dict[str, float] = {}
        for term, count in q_tf.items():
            if term in self.df:
                idf = math.log((self.doc_count + 1) / (self.df[term] + 1)) + 1.0
                q_vector[term] = count * idf

        q_norm = math.sqrt(sum(v * v for v in q_vector.values())) or 1.0
        for term in q_vector:
            q_vector[term] /= q_norm

        scores: list[tuple[float, int]] = []
        for idx, d_vector in enumerate(self.doc_vectors):
            dot_product = sum(q_vector[t] * d_vector[t] for t in q_vector if t in d_vector)
            
            # Boost score if explicit tags match
            doc_tags = self.corpus[idx]["tags"]
            for tag in doc_tags:
                if tag in query.lower():
                    dot_product += 0.35

            if dot_product > 0.08:
                scores.append((dot_product, idx))

        scores.sort(key=lambda x: x[0], reverse=True)
        results = [self.corpus[idx] for score, idx in scores[:top_k]]
        return results


# Global singleton instance of the index
RAG_INDEX = SimpleTFIDFIndex(OCEAN_KNOWLEDGE_CORPUS)


def retrieve_ocean_knowledge(query: str, top_k: int = 2) -> list[dict[str, Any]]:
    """Retrieve top-K matching oceanographic knowledge documents."""
    return RAG_INDEX.search(query, top_k=top_k)


def classify_query_intent(query: str) -> str:
    """
    Classify whether the query requires:
    1. 'marine_weather_safety': Wave height, wind, swell, storm, safe to sail, Go/No-Go
    2. 'ocean_science_rag': Conceptual, definitions, mechanisms, INCOIS policies
    3. 'sql_data': Numerical ARGO float data (SST, depth cast, float counts)
    4. 'hybrid': Both data and conceptual explanations
    """
    lowered = query.lower()

    weather_triggers = [
        "weather", "wave", "waves", "swell", "wind", "storm", "cyclone", "gust", "safe to sail",
        "safe for fishing", "is it safe", "safe hai", "kaisa hai weather", "mausam", "havaman", "hawa",
        "lahare", "lehar", "toofan", "rough sea", "मौसम", "हवामान", "लहरें", "हवा", "तूफान", "सुरक्षित", "सावधानी", "लाटा"
    ]

    rag_triggers = [
        "what is", "explain", "how does", "why does", "define", "meaning of",
        "iod", "indian ocean dipole", "marine heatwave", "mhw", "hobday", "bleaching",
        "thermocline", "mld", "mixed layer depth", "oxygen minimum zone", "omz",
        "fishing ban", "ban period", "wmo", "incois", "upwelling", "barrier layer"
    ]

    sql_triggers = [
        "how many", "count", "average temperature", "salinity at", "depth profile",
        "temperature near", "latest float", "floats in", "coordinates", "today", "aaj",
        "machhli kahaan", "fishing spot", "where to catch", "sst near"
    ]

    if any(trigger in lowered for trigger in weather_triggers):
        return "marine_weather_safety"

    has_rag = any(trigger in lowered for trigger in rag_triggers)
    has_sql = any(trigger in lowered for trigger in sql_triggers)

    if has_rag and has_sql:
        return "hybrid"
    elif has_rag:
        return "ocean_science_rag"
    return "sql_data"
