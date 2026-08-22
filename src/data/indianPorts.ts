export interface IndianPort {
  id: string;
  name: string;
  state: string;
  district?: string;
  lat: number;
  lng: number;
  tier: 1 | 2 | 3; // Tier 1: Major National Harbour, Tier 2: Commercial Mechanized Port, Tier 3: Artisanal/Minor Jetty
  type: string;
  facilities?: string[];
}

export const INDIAN_PORTS_DATABASE: IndianPort[] = [
  // ==========================================
  // GUJARAT (Coastline: ~1,600 km)
  // ==========================================
  // Tier 1 Major
  { id: 'GJ-01', name: 'Veraval Port', state: 'Gujarat', district: 'Gir Somnath', lat: 20.902, lng: 70.368, tier: 1, type: "India's Largest Marine Fish Landing Hub" },
  { id: 'GJ-02', name: 'Porbandar Fishing Harbour', state: 'Gujarat', district: 'Porbandar', lat: 21.641, lng: 69.605, tier: 1, type: 'Deep Sea Mechanized Trawler Hub' },
  { id: 'GJ-03', name: 'Okha Port', state: 'Gujarat', district: 'Devbhumi Dwarka', lat: 22.463, lng: 69.074, tier: 1, type: 'Saurashtra Deep Oceanic Fisheries Base' },
  { id: 'GJ-04', name: 'Mangrol Harbour', state: 'Gujarat', district: 'Junagadh', lat: 21.118, lng: 70.115, tier: 1, type: 'High-Yield Commercial Pelagic Base' },
  // Tier 2 Commercial
  { id: 'GJ-05', name: 'Jakhau Port', state: 'Gujarat', district: 'Kutch', lat: 23.235, lng: 68.705, tier: 2, type: 'Kutch Gulf Artisanal & Mechanized Port' },
  { id: 'GJ-06', name: 'Mandvi Port', state: 'Gujarat', district: 'Kutch', lat: 22.825, lng: 69.352, tier: 2, type: 'Historic Marine Landing Center' },
  { id: 'GJ-07', name: 'Salaya Harbour', state: 'Gujarat', district: 'Devbhumi Dwarka', lat: 22.308, lng: 69.602, tier: 2, type: 'Mechanized Vessel Landing Base' },
  { id: 'GJ-08', name: 'Navabandar Harbour', state: 'Gujarat', district: 'Gir Somnath', lat: 20.760, lng: 71.050, tier: 2, type: 'Pelagic & Demersal Fish Landing' },
  { id: 'GJ-09', name: 'Jafrabad Port', state: 'Gujarat', district: 'Amreli', lat: 20.865, lng: 71.370, tier: 2, type: 'Bombay Duck & Ribbon Fish Base' },
  { id: 'GJ-10', name: 'Pipavav (Shialbet)', state: 'Gujarat', district: 'Amreli', lat: 20.915, lng: 71.505, tier: 2, type: 'Gulf of Khambhat Marine Base' },
  { id: 'GJ-11', name: 'Bedi Port', state: 'Gujarat', district: 'Jamnagar', lat: 22.502, lng: 70.045, tier: 2, type: 'Gulf of Kutch Coastal Base' },
  { id: 'GJ-12', name: 'Dholai Port', state: 'Gujarat', district: 'Navsari', lat: 20.805, lng: 72.880, tier: 2, type: 'South Gujarat Mechanized Base' },
  { id: 'GJ-13', name: 'Umargam Port', state: 'Gujarat', district: 'Valsad', lat: 20.195, lng: 72.750, tier: 2, type: 'Border Trawler & Artisanal Jetty' },
  // Tier 3 Minor / Artisanal
  { id: 'GJ-14', name: 'Rupen (Dwarka)', state: 'Gujarat', district: 'Devbhumi Dwarka', lat: 22.250, lng: 68.960, tier: 3, type: 'Artisanal Landing Center' },
  { id: 'GJ-15', name: 'Miyani Jetty', state: 'Gujarat', district: 'Porbandar', lat: 21.840, lng: 69.390, tier: 3, type: 'Coastal Gillnet Landing' },
  { id: 'GJ-16', name: 'Madhavpur Jetty', state: 'Gujarat', district: 'Porbandar', lat: 21.255, lng: 69.960, tier: 3, type: 'Coastal Fisheries Center' },
  { id: 'GJ-17', name: 'Chorwad Jetty', state: 'Gujarat', district: 'Junagadh', lat: 21.015, lng: 70.230, tier: 3, type: 'Beach Landing Center' },
  { id: 'GJ-18', name: 'Hirakot Jetty', state: 'Gujarat', district: 'Gir Somnath', lat: 20.880, lng: 70.430, tier: 3, type: 'Artisanal Fishermen Base' },
  { id: 'GJ-19', name: 'Sutrapada Jetty', state: 'Gujarat', district: 'Gir Somnath', lat: 20.835, lng: 70.485, tier: 3, type: 'Coastal Fish Landing' },
  { id: 'GJ-20', name: 'Dhamlej Jetty', state: 'Gujarat', district: 'Gir Somnath', lat: 20.795, lng: 70.595, tier: 3, type: 'Artisanal Gillnet Landing' },
  { id: 'GJ-21', name: 'Kotda Jetty', state: 'Gujarat', district: 'Gir Somnath', lat: 20.750, lng: 70.920, tier: 3, type: 'Traditional Fishermen Base' },
  { id: 'GJ-22', name: 'Rajpara Jetty', state: 'Gujarat', district: 'Amreli', lat: 20.840, lng: 71.300, tier: 3, type: 'Coastal Trawler Jetty' },
  { id: 'GJ-23', name: 'Madhwad Jetty', state: 'Gujarat', district: 'Gir Somnath', lat: 20.740, lng: 70.820, tier: 3, type: 'Artisanal Landing Center' },
  { id: 'GJ-24', name: 'Vanakbara Port', state: 'Gujarat / Diu', district: 'Diu', lat: 20.710, lng: 70.900, tier: 3, type: 'High Density Mechanized Base' },
  { id: 'GJ-25', name: 'Ghoghla Jetty', state: 'Gujarat / Diu', district: 'Diu', lat: 20.715, lng: 70.995, tier: 3, type: 'Traditional Landing Center' },
  { id: 'GJ-26', name: 'Mundra Old Port', state: 'Gujarat', district: 'Kutch', lat: 22.795, lng: 69.720, tier: 3, type: 'Gulf Fisheries Landing' },
  { id: 'GJ-27', name: 'Hazira Fishery Jetty', state: 'Gujarat', district: 'Surat', lat: 21.100, lng: 72.645, tier: 3, type: 'Tapi Estuary Marine Landing' },
  { id: 'GJ-28', name: 'Kolak Jetty', state: 'Gujarat', district: 'Valsad', lat: 20.485, lng: 72.875, tier: 3, type: 'Coastal Fish Landing' },
  { id: 'GJ-29', name: 'Maroli Jetty', state: 'Gujarat', district: 'Valsad', lat: 20.355, lng: 72.800, tier: 3, type: 'Artisanal Beach Landing' },
  { id: 'GJ-30', name: 'Nargol Jetty', state: 'Gujarat', district: 'Valsad', lat: 20.230, lng: 72.760, tier: 3, type: 'Traditional Koli Landing' },

  // ==========================================
  // MAHARASHTRA (Coastline: ~720 km)
  // ==========================================
  // Tier 1 Major
  { id: 'MH-01', name: 'Mumbai (Sassoon Dock)', state: 'Maharashtra', district: 'Mumbai City', lat: 18.915, lng: 72.828, tier: 1, type: 'Historical Deep Sea & Export Hub' },
  { id: 'MH-02', name: 'Mumbai (Versova Jetty)', state: 'Maharashtra', district: 'Mumbai Suburban', lat: 19.135, lng: 72.808, tier: 1, type: 'Primary Koli Community Landing Base' },
  { id: 'MH-03', name: 'Ratnagiri (Mirkarwada)', state: 'Maharashtra', district: 'Ratnagiri', lat: 16.988, lng: 73.298, tier: 1, type: 'Konkan Deep Sea Trawler Hub' },
  { id: 'MH-04', name: 'Malvan Fishing Harbour', state: 'Maharashtra', district: 'Sindhudurg', lat: 16.055, lng: 73.465, tier: 1, type: 'South Konkan Marine Hub' },
  // Tier 2 Commercial
  { id: 'MH-05', name: 'Ferry Wharf (Bhaucha Dhakka)', state: 'Maharashtra', district: 'Mumbai City', lat: 18.955, lng: 72.850, tier: 2, type: 'Major Wholesale Trawler Base' },
  { id: 'MH-06', name: 'Worli Koliwada', state: 'Maharashtra', district: 'Mumbai City', lat: 19.020, lng: 72.815, tier: 2, type: 'Heritage Artisanal Fishing Centre' },
  { id: 'MH-07', name: 'Alibaug / Murud Harbour', state: 'Maharashtra', district: 'Raigad', lat: 18.640, lng: 72.875, tier: 2, type: 'Pomfret & Coastal Fisheries Hub' },
  { id: 'MH-08', name: 'Satpati Fishing Harbour', state: 'Maharashtra', district: 'Palghar', lat: 19.730, lng: 72.700, tier: 2, type: 'North Konkan High Volume Trawler Base' },
  { id: 'MH-09', name: 'Uttan Fishing Harbour', state: 'Maharashtra', district: 'Thane', lat: 19.280, lng: 72.775, tier: 2, type: 'Mechanized Purse Seine Base' },
  { id: 'MH-10', name: 'Vasai (Killa Jetty)', state: 'Maharashtra', district: 'Palghar', lat: 19.330, lng: 72.800, tier: 2, type: 'Creek & Marine Landing Base' },
  { id: 'MH-11', name: 'Harnai Fishing Harbour', state: 'Maharashtra', district: 'Ratnagiri', lat: 17.810, lng: 73.090, tier: 2, type: 'Major Silver Pomfret Landing Hub' },
  { id: 'MH-12', name: 'Jaigad Harbour', state: 'Maharashtra', district: 'Ratnagiri', lat: 17.300, lng: 73.210, tier: 2, type: 'Shastri Estuary Marine Base' },
  { id: 'MH-13', name: 'Devgad Fishing Harbour', state: 'Maharashtra', district: 'Sindhudurg', lat: 16.375, lng: 73.375, tier: 2, type: 'Kingfish & Mackerel Trawler Port' },
  { id: 'MH-14', name: 'Vengurla Port', state: 'Maharashtra', district: 'Sindhudurg', lat: 15.855, lng: 73.630, tier: 2, type: 'Deep Sea Pelagic Port' },
  // Tier 3 Minor / Artisanal
  { id: 'MH-15', name: 'Dahanu Jetty', state: 'Maharashtra', district: 'Palghar', lat: 19.970, lng: 72.710, tier: 3, type: 'Artisanal Landing Center' },
  { id: 'MH-16', name: 'Arnala Jetty', state: 'Maharashtra', district: 'Palghar', lat: 19.450, lng: 72.750, tier: 3, type: 'Coastal Fisheries Center' },
  { id: 'MH-17', name: 'Madh Island Jetty', state: 'Maharashtra', district: 'Mumbai Suburban', lat: 19.140, lng: 72.795, tier: 3, type: 'Artisanal Fish Landing' },
  { id: 'MH-18', name: 'Mahim Koliwada', state: 'Maharashtra', district: 'Mumbai City', lat: 19.040, lng: 72.838, tier: 3, type: 'Traditional Inshore Fisheries' },
  { id: 'MH-19', name: 'Karanja (Uran) Jetty', state: 'Maharashtra', district: 'Raigad', lat: 18.860, lng: 72.930, tier: 3, type: 'Dharamtar Creek Marine Base' },
  { id: 'MH-20', name: 'Revdanda Jetty', state: 'Maharashtra', district: 'Raigad', lat: 18.550, lng: 72.930, tier: 3, type: 'Kundalika Estuary Base' },
  { id: 'MH-21', name: 'Shrivardhan Jetty', state: 'Maharashtra', district: 'Raigad', lat: 18.040, lng: 73.010, tier: 3, type: 'Artisanal Landing Center' },
  { id: 'MH-22', name: 'Dighi Port Jetty', state: 'Maharashtra', district: 'Raigad', lat: 18.280, lng: 72.990, tier: 3, type: 'Rajpuri Creek Fisheries' },
  { id: 'MH-23', name: 'Dabhol Fishery Jetty', state: 'Maharashtra', district: 'Ratnagiri', lat: 17.585, lng: 73.175, tier: 3, type: 'Vashishti Estuarine Port' },
  { id: 'MH-24', name: 'Guhagar Jetty', state: 'Maharashtra', district: 'Ratnagiri', lat: 17.480, lng: 73.180, tier: 3, type: 'Beach Landing Center' },
  { id: 'MH-25', name: 'Borya Jetty', state: 'Maharashtra', district: 'Ratnagiri', lat: 17.400, lng: 73.190, tier: 3, type: 'Coastal Gillnet Landing' },
  { id: 'MH-26', name: 'Achra Jetty', state: 'Maharashtra', district: 'Sindhudurg', lat: 16.220, lng: 73.440, tier: 3, type: 'Traditional Estuary Base' },
  { id: 'MH-27', name: 'Shiroda (Redi) Jetty', state: 'Maharashtra', district: 'Sindhudurg', lat: 15.760, lng: 73.660, tier: 3, type: 'Border Fisheries Landing' },

  // ==========================================
  // GOA (Coastline: ~105 km)
  // ==========================================
  // Tier 1 Major
  { id: 'GA-01', name: 'Panaji & Malim Jetty', state: 'Goa', district: 'North Goa', lat: 15.505, lng: 73.825, tier: 1, type: 'Goa Premier Purse Seine Hub' },
  { id: 'GA-02', name: 'Vasco (Cortalim / Mormugao)', state: 'Goa', district: 'South Goa', lat: 15.405, lng: 73.815, tier: 1, type: 'Zuari River Commercial Base' },
  // Tier 2 Commercial
  { id: 'GA-03', name: 'Cutbona Fishing Harbour', state: 'Goa', district: 'South Goa', lat: 15.160, lng: 73.955, tier: 2, type: 'Sal River Trawler Complex' },
  { id: 'GA-04', name: 'Chapora Fishing Jetty', state: 'Goa', district: 'North Goa', lat: 15.605, lng: 73.738, tier: 2, type: 'North Goa Mechanized Jetty' },
  { id: 'GA-05', name: 'Betul Harbour', state: 'Goa', district: 'South Goa', lat: 15.145, lng: 73.960, tier: 2, type: 'Mechanized Gillnet Center' },
  // Tier 3 Minor / Artisanal
  { id: 'GA-06', name: 'Arambol Jetty', state: 'Goa', district: 'North Goa', lat: 15.685, lng: 73.705, tier: 3, type: 'Artisanal Beach Landing' },
  { id: 'GA-07', name: 'Morjim Fish Landing', state: 'Goa', district: 'North Goa', lat: 15.620, lng: 73.725, tier: 3, type: 'Traditional Inshore Landing' },
  { id: 'GA-08', name: 'Colva Fishing Point', state: 'Goa', district: 'South Goa', lat: 15.275, lng: 73.910, tier: 3, type: 'Artisanal Canoe Center' },
  { id: 'GA-09', name: 'Talpona (Canacona)', state: 'Goa', district: 'South Goa', lat: 14.980, lng: 74.040, tier: 3, type: 'Southern Estuary Fisheries' },

  // ==========================================
  // KARNATAKA (Coastline: ~300 km)
  // ==========================================
  // Tier 1 Major
  { id: 'KA-01', name: 'Mangalore (Old Port / Bunder)', state: 'Karnataka', district: 'Dakshina Kannada', lat: 12.868, lng: 74.838, tier: 1, type: 'Major Marine Export & Pelagic Port' },
  { id: 'KA-02', name: 'Malpe Fishing Harbour', state: 'Karnataka', district: 'Udupi', lat: 13.352, lng: 74.702, tier: 1, type: 'National Deep Sea Longlining Hub' },
  { id: 'KA-03', name: 'Karwar (Baithkol Harbour)', state: 'Karnataka', district: 'Uttara Kannada', lat: 14.802, lng: 74.125, tier: 1, type: 'North Karnataka Purse Seine Hub' },
  // Tier 2 Commercial
  { id: 'KA-04', name: 'Honnavar Fishing Harbour', state: 'Karnataka', district: 'Uttara Kannada', lat: 14.280, lng: 74.445, tier: 2, type: 'Sharavathi Estuary Commercial Base' },
  { id: 'KA-05', name: 'Bhatkal Fishing Harbour', state: 'Karnataka', district: 'Uttara Kannada', lat: 13.970, lng: 74.545, tier: 2, type: 'Commercial Pelagic Landing' },
  { id: 'KA-06', name: 'Gangolli Harbour', state: 'Karnataka', district: 'Udupi', lat: 13.640, lng: 74.680, tier: 2, type: 'Five-River Estuarine Fishery Hub' },
  { id: 'KA-07', name: 'Tadadi Fishing Harbour', state: 'Karnataka', district: 'Uttara Kannada', lat: 14.525, lng: 74.375, tier: 2, type: 'Aghanashini Estuary Base' },
  { id: 'KA-08', name: 'Kulai Fishery Harbour', state: 'Karnataka', district: 'Dakshina Kannada', lat: 12.960, lng: 74.800, tier: 2, type: 'Modern Mechanized Harbour' },
  { id: 'KA-09', name: 'Hejamadi Harbour', state: 'Karnataka', district: 'Udupi', lat: 13.150, lng: 74.770, tier: 2, type: 'Shambhavi Estuary Base' },
  // Tier 3 Minor / Artisanal
  { id: 'KA-10', name: 'Majali Jetty', state: 'Karnataka', district: 'Uttara Kannada', lat: 14.900, lng: 74.090, tier: 3, type: 'Border Traditional Base' },
  { id: 'KA-11', name: 'Belekeri Jetty', state: 'Karnataka', district: 'Uttara Kannada', lat: 14.710, lng: 74.270, tier: 3, type: 'Creek Fish Landing' },
  { id: 'KA-12', name: 'Kumta Fishery Jetty', state: 'Karnataka', district: 'Uttara Kannada', lat: 14.420, lng: 74.400, tier: 3, type: 'Artisanal Landing Center' },
  { id: 'KA-13', name: 'Maravanthe Jetty', state: 'Karnataka', district: 'Udupi', lat: 13.710, lng: 74.655, tier: 3, type: 'Beach Landing Center' },
  { id: 'KA-14', name: 'Hangarkatta Jetty', state: 'Karnataka', district: 'Udupi', lat: 13.435, lng: 74.700, tier: 3, type: 'Sita-Swarna Estuary Base' },
  { id: 'KA-15', name: 'Kaup Lighthouse Jetty', state: 'Karnataka', district: 'Udupi', lat: 13.225, lng: 74.740, tier: 3, type: 'Traditional Inshore Fisheries' },
  { id: 'KA-16', name: 'Padubidri Jetty', state: 'Karnataka', district: 'Udupi', lat: 13.135, lng: 74.760, tier: 3, type: 'Artisanal Gillnet Landing' },
  { id: 'KA-17', name: 'Bengre Fishery Point', state: 'Karnataka', district: 'Dakshina Kannada', lat: 12.855, lng: 74.825, tier: 3, type: 'Inshore Artisanal Base' },

  // ==========================================
  // KERALA (Coastline: ~590 km)
  // ==========================================
  // Tier 1 Major
  { id: 'KL-01', name: 'Kochi (Thoppumpady)', state: 'Kerala', district: 'Ernakulam', lat: 9.968, lng: 76.268, tier: 1, type: 'Central Oceanic Tuna & Marine Export Capital' },
  { id: 'KL-02', name: 'Kollam (Neendakara)', state: 'Kerala', district: 'Kollam', lat: 8.942, lng: 76.538, tier: 1, type: 'Deep Sea Mechanized Trawler & Shrimp Port' },
  { id: 'KL-03', name: 'Munambam Fishing Harbour', state: 'Kerala', district: 'Ernakulam', lat: 10.182, lng: 76.172, tier: 1, type: 'High-Capacity Deep Sea Gillnet Hub' },
  { id: 'KL-04', name: 'Beypore Fishing Harbour', state: 'Kerala', district: 'Kozhikode', lat: 11.162, lng: 75.802, tier: 1, type: 'North Kerala Primary Marine Fisheries Port' },
  { id: 'KL-05', name: 'Vizhinjam Fishing Harbour', state: 'Kerala', district: 'Thiruvananthapuram', lat: 8.375, lng: 76.992, tier: 1, type: 'Deep Continental Shelf Tuna & Oceanic Hub' },
  // Tier 2 Commercial
  { id: 'KL-06', name: 'Puthiyappa Harbour', state: 'Kerala', district: 'Kozhikode', lat: 11.310, lng: 75.745, tier: 2, type: 'Modern Mechanized Fish Port' },
  { id: 'KL-07', name: 'Thottappally Harbour', state: 'Kerala', district: 'Alappuzha', lat: 9.315, lng: 76.385, tier: 2, type: 'Oil Sardine & Mackerel Base' },
  { id: 'KL-08', name: 'Kayamkulam (Azheekkal)', state: 'Kerala', district: 'Alappuzha', lat: 9.135, lng: 76.470, tier: 2, type: 'Estuary Barrier Island Base' },
  { id: 'KL-09', name: 'Azhikkal Fishing Harbour', state: 'Kerala', district: 'Kannur', lat: 11.915, lng: 75.310, tier: 2, type: 'Valapattanam River Marine Base' },
  { id: 'KL-10', name: 'Thalassery Fishery Harbour', state: 'Kerala', district: 'Kannur', lat: 11.745, lng: 75.490, tier: 2, type: 'Commercial Gillnet Base' },
  { id: 'KL-11', name: 'Mopla Bay Harbour', state: 'Kerala', district: 'Kannur', lat: 11.855, lng: 75.365, tier: 2, type: 'Historic Natural Harbour Base' },
  { id: 'KL-12', name: 'Ponnani Fishing Harbour', state: 'Kerala', district: 'Malappuram', lat: 10.785, lng: 75.925, tier: 2, type: 'Bharathappuzha Marine Landing' },
  { id: 'KL-13', name: 'Chettuva Fishery Harbour', state: 'Kerala', district: 'Thrissur', lat: 10.530, lng: 76.050, tier: 2, type: 'Central Kerala Mechanized Base' },
  { id: 'KL-14', name: 'Kasaragod (Cheruvathur)', state: 'Kerala', district: 'Kasaragod', lat: 12.215, lng: 75.145, tier: 2, type: 'Kariangode Estuary Base' },
  // Tier 3 Minor / Artisanal
  { id: 'KL-15', name: 'Koyilandy Fishing Harbour', state: 'Kerala', district: 'Kozhikode', lat: 11.435, lng: 75.690, tier: 3, type: 'Mechanized Inshore Landing' },
  { id: 'KL-16', name: 'Tanur Fish Landing', state: 'Kerala', district: 'Malappuram', lat: 10.975, lng: 75.860, tier: 3, type: 'Artisanal Country Craft Hub' },
  { id: 'KL-17', name: 'Chellanam Jetty', state: 'Kerala', district: 'Ernakulam', lat: 9.790, lng: 76.275, tier: 3, type: 'Coastal Fishermen Center' },
  { id: 'KL-18', name: 'Arthunkal Fish Landing', state: 'Kerala', district: 'Alappuzha', lat: 9.680, lng: 76.295, tier: 3, type: 'Beach Landing Center' },
  { id: 'KL-19', name: 'Ambalapuzha Jetty', state: 'Kerala', district: 'Alappuzha', lat: 9.380, lng: 76.350, tier: 3, type: 'Ring Seine Artisanal Landing' },
  { id: 'KL-20', name: 'Thangassery Jetty', state: 'Kerala', district: 'Kollam', lat: 8.880, lng: 76.565, tier: 3, type: 'Traditional Inshore Fisheries' },
  { id: 'KL-21', name: 'Anjengo (Anchuthengu)', state: 'Kerala', district: 'Thiruvananthapuram', lat: 8.680, lng: 76.775, tier: 3, type: 'Historic Marine Landing Center' },
  { id: 'KL-22', name: 'Valiyathura Fish Landing', state: 'Kerala', district: 'Thiruvananthapuram', lat: 8.465, lng: 76.920, tier: 3, type: 'Catamaran & Outboard Base' },
  { id: 'KL-23', name: 'Poovar Fishery Point', state: 'Kerala', district: 'Thiruvananthapuram', lat: 8.315, lng: 77.065, tier: 3, type: 'Border Artisanal Landing' },

  // ==========================================
  // TAMIL NADU & PUDUCHERRY (Coastline: ~1,076 km)
  // ==========================================
  // Tier 1 Major
  { id: 'TN-01', name: 'Chennai (Kasimedu Harbour)', state: 'Tamil Nadu', district: 'Chennai', lat: 13.125, lng: 80.302, tier: 1, type: 'East Coast Primary Deep Sea Trawler Hub' },
  { id: 'TN-02', name: 'Tuticorin (Vembar / VOC)', state: 'Tamil Nadu', district: 'Thoothukudi', lat: 8.762, lng: 78.145, tier: 1, type: 'Gulf of Mannar Deep Oceanic Base' },
  { id: 'TN-03', name: 'Rameswaram / Mandapam', state: 'Tamil Nadu', district: 'Ramanathapuram', lat: 9.282, lng: 79.312, tier: 1, type: 'Palk Bay Squid & Blue Crab Capital' },
  { id: 'TN-04', name: 'Nagapattinam Harbour', state: 'Tamil Nadu', district: 'Nagapattinam', lat: 10.762, lng: 79.842, tier: 1, type: 'Coromandel Pelagic Deep Sea Port' },
  { id: 'TN-05', name: 'Cuddalore Fishing Harbour', state: 'Tamil Nadu', district: 'Cuddalore', lat: 11.748, lng: 79.772, tier: 1, type: 'Uppanar River Mechanized Base' },
  // Tier 2 Commercial
  { id: 'TN-06', name: 'Colachel Fishing Harbour', state: 'Tamil Nadu', district: 'Kanyakumari', lat: 8.175, lng: 77.255, tier: 2, type: 'South Arabian Sea Deep Sea Tuna Hub' },
  { id: 'TN-07', name: 'Chinnamuttom Harbour', state: 'Tamil Nadu', district: 'Kanyakumari', lat: 8.095, lng: 77.560, tier: 2, type: 'Cape Comorin Mechanized Base' },
  { id: 'TN-08', name: 'Pazhaiyar Fishing Harbour', state: 'Tamil Nadu', district: 'Mayiladuthurai', lat: 11.360, lng: 79.825, tier: 2, type: 'Kollidam Estuary Modern Harbour' },
  { id: 'TN-09', name: 'Poompuhar Fish Harbour', state: 'Tamil Nadu', district: 'Mayiladuthurai', lat: 11.145, lng: 79.855, tier: 2, type: 'Cauvery River Marine Landing' },
  { id: 'TN-10', name: 'Mallipattinam Harbour', state: 'Tamil Nadu', district: 'Thanjavur', lat: 10.275, lng: 79.315, tier: 2, type: 'Palk Strait Mechanized Hub' },
  { id: 'TN-11', name: 'Jagathapattinam Harbour', state: 'Tamil Nadu', district: 'Pudukkottai', lat: 9.940, lng: 79.165, tier: 2, type: 'Shrimp & Finfish Landing Port' },
  { id: 'TN-12', name: 'Thengapattinam Harbour', state: 'Tamil Nadu', district: 'Kanyakumari', lat: 8.235, lng: 77.165, tier: 2, type: 'Tamirabarani Estuary Hub' },
  { id: 'TN-13', name: 'Puducherry Fishing Harbour', state: 'Puducherry', district: 'Puducherry', lat: 11.915, lng: 79.825, tier: 2, type: 'Thengaithittu Estuarine Harbour' },
  { id: 'TN-14', name: 'Karaikal Fishing Harbour', state: 'Puducherry', district: 'Karaikal', lat: 10.910, lng: 79.845, tier: 2, type: 'Arasalar River Modern Port' },
  // Tier 3 Minor / Artisanal
  { id: 'TN-15', name: 'Pulicat Lake Jetty', state: 'Tamil Nadu', district: 'Tiruvallur', lat: 13.420, lng: 80.320, tier: 3, type: 'Lagoon & Marine Fish Landing' },
  { id: 'TN-16', name: 'Ennore Fishing Point', state: 'Tamil Nadu', district: 'Chennai', lat: 13.220, lng: 80.325, tier: 3, type: 'Creek Artisanal Center' },
  { id: 'TN-17', name: 'Kovalam Jetty (Chennai)', state: 'Tamil Nadu', district: 'Chengalpattu', lat: 12.790, lng: 80.250, tier: 3, type: 'Artisanal Catamaran Center' },
  { id: 'TN-18', name: 'Mahabalipuram Point', state: 'Tamil Nadu', district: 'Chengalpattu', lat: 12.615, lng: 80.195, tier: 3, type: 'Traditional Inshore Fisheries' },
  { id: 'TN-19', name: 'Marakkanam Landing', state: 'Tamil Nadu', district: 'Viluppuram', lat: 12.195, lng: 79.945, tier: 3, type: 'Salt Pan & Beach Landing' },
  { id: 'TN-20', name: 'Velankanni Fish Landing', state: 'Tamil Nadu', district: 'Nagapattinam', lat: 10.680, lng: 79.850, tier: 3, type: 'Beach Landing Center' },
  { id: 'TN-21', name: 'Kodiakkarai (Pt Calimere)', state: 'Tamil Nadu', district: 'Nagapattinam', lat: 10.285, lng: 79.865, tier: 3, type: 'Seasonal Migration Base' },
  { id: 'TN-22', name: 'Pamban Fishing Jetty', state: 'Tamil Nadu', district: 'Ramanathapuram', lat: 9.278, lng: 79.215, tier: 3, type: 'Island Traditional Harbour' },
  { id: 'TN-23', name: 'Kilakarai Marine Landing', state: 'Tamil Nadu', district: 'Ramanathapuram', lat: 9.230, lng: 78.785, tier: 3, type: 'Gulf of Mannar Artisanal Base' },
  { id: 'TN-24', name: 'Manapad Fishery Point', state: 'Tamil Nadu', district: 'Thoothukudi', lat: 8.375, lng: 78.065, tier: 3, type: 'Historic Coastal Landing' },
  { id: 'TN-25', name: 'Kadiapattinam Landing', state: 'Tamil Nadu', district: 'Kanyakumari', lat: 8.135, lng: 77.295, tier: 3, type: 'Traditional Inshore Fishery' },

  // ==========================================
  // ANDHRA PRADESH (Coastline: ~974 km)
  // ==========================================
  // Tier 1 Major
  { id: 'AP-01', name: 'Visakhapatnam Fishing Harbour', state: 'Andhra Pradesh', district: 'Visakhapatnam', lat: 17.695, lng: 83.225, tier: 1, type: 'Bay of Bengal Deep Sea Commercial Base' },
  { id: 'AP-02', name: 'Kakinada Fishing Harbour', state: 'Andhra Pradesh', district: 'Kakinada', lat: 16.985, lng: 82.255, tier: 1, type: 'Godavari Delta Premier Trawler Base' },
  { id: 'AP-03', name: 'Machilipatnam (Gilakaladindi)', state: 'Andhra Pradesh', district: 'Krishna', lat: 16.182, lng: 81.165, tier: 1, type: 'Krishna River Commercial Hub' },
  // Tier 2 Commercial
  { id: 'AP-04', name: 'Nizampatnam Fishing Harbour', state: 'Andhra Pradesh', district: 'Bapatla', lat: 15.905, lng: 80.665, tier: 2, type: 'Central AP Mechanized Port' },
  { id: 'AP-05', name: 'Bhavanapadu Fishing Harbour', state: 'Andhra Pradesh', district: 'Srikakulam', lat: 18.560, lng: 84.350, tier: 2, type: 'North AP Deep Sea Base' },
  { id: 'AP-06', name: 'Krishnapatnam Fishery Jetty', state: 'Andhra Pradesh', district: 'Nellore', lat: 14.255, lng: 80.125, tier: 2, type: 'Kandaleru Creek Marine Port' },
  { id: 'AP-07', name: 'Vodarevu (Chirala)', state: 'Andhra Pradesh', district: 'Bapatla', lat: 15.795, lng: 80.405, tier: 2, type: 'High Yield Coastal Base' },
  { id: 'AP-08', name: 'Bheemunipatnam (Bheemili)', state: 'Andhra Pradesh', district: 'Visakhapatnam', lat: 17.890, lng: 83.455, tier: 2, type: 'Gosthani Estuary Fishery Port' },
  // Tier 3 Minor / Artisanal
  { id: 'AP-09', name: 'Kalingapatnam Jetty', state: 'Andhra Pradesh', district: 'Srikakulam', lat: 18.340, lng: 84.125, tier: 3, type: 'Vamsadhara River Base' },
  { id: 'AP-10', name: 'Pudimadaka Jetty', state: 'Andhra Pradesh', district: 'Anakapalli', lat: 17.495, lng: 83.005, tier: 3, type: 'Natural Bay Artisanal Landing' },
  { id: 'AP-11', name: 'Antarvedi Fish Landing', state: 'Andhra Pradesh', district: 'Dr B R Ambedkar Konaseema', lat: 16.325, lng: 81.730, tier: 3, type: 'Vashishta Godavari Confluence' },
  { id: 'AP-12', name: 'Manginapudi Beach Landing', state: 'Andhra Pradesh', district: 'Krishna', lat: 16.240, lng: 81.230, tier: 3, type: 'Beach Landing Center' },
  { id: 'AP-13', name: 'Suryalanka Fish Landing', state: 'Andhra Pradesh', district: 'Bapatla', lat: 15.850, lng: 80.520, tier: 3, type: 'Traditional Outboard Base' },
  { id: 'AP-14', name: 'Kothapatnam Landing', state: 'Andhra Pradesh', district: 'Prakasam', lat: 15.450, lng: 80.160, tier: 3, type: 'Artisanal Gillnet Landing' },
  { id: 'AP-15', name: 'Juvvaladinne Fish Harbour', state: 'Andhra Pradesh', district: 'Nellore', lat: 14.890, lng: 80.090, tier: 3, type: 'Pennar Delta Fishery Base' },

  // ==========================================
  // ODISHA (Coastline: ~480 km)
  // ==========================================
  // Tier 1 Major
  { id: 'OD-01', name: 'Paradip Fishing Harbour', state: 'Odisha', district: 'Jagatsinghpur', lat: 20.318, lng: 86.612, tier: 1, type: "Odisha's Largest Mechanized Deep Sea Port" },
  { id: 'OD-02', name: 'Dhamra Fishing Harbour', state: 'Odisha', district: 'Bhadrak', lat: 20.805, lng: 86.975, tier: 1, type: 'Baitarani Estuary Hilsa & Pomfret Hub' },
  // Tier 2 Commercial
  { id: 'OD-03', name: 'Gopalpur / Aryapalli Harbour', state: 'Odisha', district: 'Ganjam', lat: 19.260, lng: 84.910, tier: 2, type: 'South Odisha Marine Port' },
  { id: 'OD-04', name: 'Astaranga Fishing Harbour', state: 'Odisha', district: 'Puri', lat: 19.980, lng: 86.260, tier: 2, type: 'Devi River Estuary Base' },
  { id: 'OD-05', name: 'Balramgadi (Chandipur)', state: 'Odisha', district: 'Balasore', lat: 21.465, lng: 87.035, tier: 2, type: 'Budhabalanga River Trawler Base' },
  { id: 'OD-06', name: 'Bahabalpur Fishing Harbour', state: 'Odisha', district: 'Balasore', lat: 21.610, lng: 87.125, tier: 2, type: 'North Odisha Pelagic Hub' },
  // Tier 3 Minor / Artisanal
  { id: 'OD-07', name: 'Kasafal Fish Landing', state: 'Odisha', district: 'Balasore', lat: 21.560, lng: 87.100, tier: 3, type: 'Artisanal Landing Center' },
  { id: 'OD-08', name: 'Chudamani Jetty', state: 'Odisha', district: 'Bhadrak', lat: 21.080, lng: 86.910, tier: 3, type: 'Coastal Fisheries Center' },
  { id: 'OD-09', name: 'Talchua Fishery Jetty', state: 'Odisha', district: 'Kendrapara', lat: 20.675, lng: 86.940, tier: 3, type: 'Bhitarkanika Estuary Base' },
  { id: 'OD-10', name: 'Jamboo Fishing Jetty', state: 'Odisha', district: 'Kendrapara', lat: 20.440, lng: 86.720, tier: 3, type: 'Mahanadi Delta Landing' },
  { id: 'OD-11', name: 'Nuagarh (Puri) Landing', state: 'Odisha', district: 'Puri', lat: 19.820, lng: 85.870, tier: 3, type: 'Beach Landing Center' },
  { id: 'OD-12', name: 'Pentha Sea Beach Landing', state: 'Odisha', district: 'Kendrapara', lat: 20.530, lng: 86.800, tier: 3, type: 'Traditional Inshore Fisheries' },

  // ==========================================
  // WEST BENGAL (Coastline: ~158 km)
  // ==========================================
  // Tier 1 Major
  { id: 'WB-01', name: 'Digha (Sankarpur Harbour)', state: 'West Bengal', district: 'Purba Medinipur', lat: 21.622, lng: 87.512, tier: 1, type: 'Northern Bay of Bengal Hilsa & Bhetki Hub' },
  { id: 'WB-02', name: 'Kakdwip / Frasergunj Harbour', state: 'West Bengal', district: 'South 24 Parganas', lat: 21.872, lng: 88.185, tier: 1, type: 'Sundarbans Estuarine & Deep Sea Port' },
  // Tier 2 Commercial
  { id: 'WB-03', name: 'Petuaghat Fishing Harbour', state: 'West Bengal', district: 'Purba Medinipur', lat: 21.785, lng: 87.895, tier: 2, type: 'Rasulpur River Premier Port' },
  { id: 'WB-04', name: 'Sultanpur (Diamond Harbour)', state: 'West Bengal', district: 'South 24 Parganas', lat: 22.185, lng: 88.190, tier: 2, type: 'Hooghly River Marine Complex' },
  { id: 'WB-05', name: 'Namkhana Fishing Base', state: 'West Bengal', district: 'South 24 Parganas', lat: 21.765, lng: 88.235, tier: 2, type: 'Hatania-Doania River Port' },
  { id: 'WB-06', name: 'Canning Fishery Base', state: 'West Bengal', district: 'South 24 Parganas', lat: 22.315, lng: 88.665, tier: 2, type: 'Matla Estuary Base' },
  // Tier 3 Minor / Artisanal
  { id: 'WB-07', name: 'Junput Fish Landing', state: 'West Bengal', district: 'Purba Medinipur', lat: 21.720, lng: 87.810, tier: 3, type: 'Dried Fish & Pomfret Landing' },
  { id: 'WB-08', name: 'Mandarmani Beach Landing', state: 'West Bengal', district: 'Purba Medinipur', lat: 21.665, lng: 87.710, tier: 3, type: 'Artisanal Beach Landing' },
  { id: 'WB-09', name: 'Bakkhali Fishery Point', state: 'West Bengal', district: 'South 24 Parganas', lat: 21.560, lng: 88.260, tier: 3, type: 'Delta Marine Landing' },
  { id: 'WB-10', name: 'Sagar Island (Gangasagar)', state: 'West Bengal', district: 'South 24 Parganas', lat: 21.650, lng: 88.080, tier: 3, type: 'Hooghly Confluence Landing' },

  // ==========================================
  // ISLAND TERRITORIES (A&N & Lakshadweep)
  // ==========================================
  // Tier 1 Major
  { id: 'AN-01', name: 'Port Blair (Junglighat)', state: 'Andaman & Nicobar', district: 'South Andaman', lat: 11.662, lng: 92.732, tier: 1, type: 'Oceanic Yellowfin Tuna Hub' },
  { id: 'LD-01', name: 'Kavaratti & Agatti Harbour', state: 'Lakshadweep', district: 'Kavaratti', lat: 10.562, lng: 72.642, tier: 1, type: 'Coral Atoll Skipjack Tuna Base' },
  // Tier 2 Commercial
  { id: 'AN-02', name: 'Diglipur Fishery Harbour', state: 'Andaman & Nicobar', district: 'North Andaman', lat: 13.265, lng: 93.005, tier: 2, type: 'North Andaman Marine Port' },
  { id: 'AN-03', name: 'Hut Bay Harbour', state: 'Andaman & Nicobar', district: 'Little Andaman', lat: 10.595, lng: 92.540, tier: 2, type: 'Deep Sea Oceanic Base' },
  { id: 'LD-02', name: 'Minicoy Fishing Harbour', state: 'Lakshadweep', district: 'Minicoy', lat: 8.285, lng: 73.045, tier: 2, type: 'Southern Atoll Pole & Line Tuna Base' },
  { id: 'LD-03', name: 'Andrott Island Jetty', state: 'Lakshadweep', district: 'Andrott', lat: 10.825, lng: 73.680, tier: 2, type: 'Eastern Atoll Pelagic Base' },
];
