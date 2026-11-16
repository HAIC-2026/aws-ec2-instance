/* AllReady — the list of data sources. MIT licensed.
   One place that names every feed, what it is used for, how fresh it is, and a public link
   where anyone can open the same data and check a figure against it. Shown on both pages. */

export const SOURCES = [
  { key: "shel", n: "Honolulu Dept. of Emergency Management — hurricane refuge areas", use: "Shelter sites and open/closed status, Oʻahu", fresh: "Live, re-read every 5 min", url: "https://services.arcgis.com/tNJpAOha4mODLkXz/arcgis/rest/services/Potential_Emergency_Shelter_Edit_EOC/FeatureServer/0" },
  { key: "shel", n: "Hawaiʻi County Civil Defense Agency — emergency shelters", use: "Shelter sites, capacity, ADA, animals, power, hardening", fresh: "Live, re-read every 5 min", url: "https://services1.arcgis.com/C2LPusZs5OXNGFDn/arcgis/rest/services/Emergency_Shelters_(HCCDA)_Public/FeatureServer/0" },
  { key: "shel", n: "Kauaʻi Emergency Management Agency — shelters", use: "Shelter sites, capacity, hazard eligibility", fresh: "Live, re-read every 5 min", url: "https://services1.arcgis.com/0DaVqrPt2eyXUS9g/arcgis/rest/services/Shelters_Testing_Copy/FeatureServer/0" },
  { key: "nws", n: "National Weather Service — active alerts", use: "The live event; alert polygons", fresh: "Live, re-read every 5 min", url: "https://api.weather.gov/alerts/active?area=HI" },
  { key: "svi", n: "CDC/ATSDR Social Vulnerability Index 2022 (ACS 2018–22)", use: "Residents, disability, limited English, no vehicle, age — by census tract", fresh: "Latest federal release; read on load", url: "https://www.atsdr.cdc.gov/place-health/php/svi/index.html" },
  { key: "emp", n: "HHS emPOWER — public REST service", use: "Electricity-dependent Medicare beneficiaries, dialysis, oxygen", fresh: "Latest HHS release; read on load", url: "https://empowerprogram.hhs.gov/empowermap" },
  { key: null, n: "Iowa Environmental Mesonet — NWS VTEC archive", use: "A year of past alerts for the History timeline", fresh: "Archive, read on demand", url: "https://mesonet.agron.iastate.edu/vtec/" },
  { key: null, n: "USGS Earthquake Hazards Program", use: "Earthquakes M2.5+", fresh: "Live", url: "https://earthquake.usgs.gov/earthquakes/map/" },
  { key: null, n: "Hawaiʻi Statewide GIS Program", use: "Tsunami evacuation zones, hazard and facility layers", fresh: "As published by the State", url: "https://geoportal.hawaii.gov/" },
  { key: null, n: "FEMA National Flood Hazard Layer", use: "Flood hazard zones", fresh: "As published by FEMA", url: "https://www.fema.gov/flood-maps/national-flood-hazard-layer" },
  { key: null, n: "NASA FIRMS / GIBS", use: "Active fire detections, daily satellite imagery", fresh: "Daily", url: "https://firms.modaps.eosdis.nasa.gov/" },
  { key: null, n: "Open-Meteo", use: "Weather layers and hourly weather history", fresh: "Hourly", url: "https://open-meteo.com/" },
];
