"""Builds data/terrain.png + data/meta.json for the AllReady home page.
Coastlines: US Census cartographic boundary via us-atlas (public domain), 10m.
Relief is MODELED, not survey data: peaks sit at real summit coordinates/heights, shaped with
shield-volcano profiles + erosion noise. Swap in USGS 3DEP for production.
PNG channels: R,G = 16-bit elevation (m, offset), B = vegetation index, A = 255."""
import json, math
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

LON0, LON1, LAT0, LAT1 = -160.45, -154.70, 18.85, 22.35
W, H = 2048, 1328
LAT_C = 20.6
KM_LON, KM_LAT = 111.32 * math.cos(math.radians(LAT_C)), 110.95
KMPX_X = (LON1 - LON0) * KM_LON / W
KMPX_Y = (LAT1 - LAT0) * KM_LAT / H
EMIN, EMAX = -5200.0, 4600.0
rng = np.random.default_rng(11)

def px(lon, lat): return ((lon - LON0) / (LON1 - LON0) * W, (LAT1 - lat) / (LAT1 - LAT0) * H)

# --- land mask from real coastlines (4x supersample for a clean edge)
SS = 4
img = Image.new("L", (W * SS, H * SS), 0); d = ImageDraw.Draw(img)
for r in json.load(open("scripts/coast.json")):
    d.polygon([(x * SS, y * SS) for x, y in (px(*p) for p in r["outer"])], fill=255)
    for h in r["holes"]: d.polygon([(x * SS, y * SS) for x, y in (px(*p) for p in h)], fill=0)
land = np.asarray(img.resize((W, H), Image.LANCZOS), float) / 255.0
mask = land > 0.5
print("land km2 ~", int(mask.sum() * KMPX_X * KMPX_Y))

dist_in = ndi.distance_transform_edt(mask, sampling=[KMPX_Y, KMPX_X])     # km inland
dist_out = ndi.distance_transform_edt(~mask, sampling=[KMPX_Y, KMPX_X])   # km offshore

# --- relief: shield profiles at real summits (name, lon, lat, height m, radius km, aspect, azimuth deg, erosion 0..1)
PEAKS = [
 ("Mauna Kea", -155.468, 19.821, 4207, 26, 0.95, 20, 0.05), ("Mauna Loa", -155.605, 19.476, 4169, 46, 0.62, 25, 0.04),
 ("Hualalai", -155.865, 19.689, 2521, 19, 0.8, 330, 0.1), ("Kohala", -155.72, 20.086, 1670, 17, 0.8, 320, 0.7),
 ("Kilauea", -155.283, 19.407, 1247, 26, 0.55, 80, 0.05),
 ("Haleakala", -156.253, 20.71, 3055, 22, 0.8, 330, 0.25), ("PuuKukui", -156.592, 20.9, 1764, 11, 1.0, 0, 0.85),
 ("Lanaihale", -156.8725, 20.80, 1026, 12, 0.5, 340, 0.35), ("Kamakou", -156.87, 21.113, 1512, 15, 0.38, 270, 0.55),
 ("WestMolokai", -157.2, 21.15, 420, 11, 0.7, 0, 0.3), ("Kahoolawe", -156.5936, 20.5436, 450, 6.5, 0.7, 60, 0.2),
 ("Kaala", -158.146, 21.507, 1227, 13, 0.5, 320, 0.6), ("Konahuanui", -157.7956, 21.333, 947, 20, 0.25, 330, 0.9),
 ("Kawaikini", -159.4936, 22.0589, 1598, 22, 0.95, 0, 0.9), ("Paniau", -160.1642, 21.8975, 390, 8, 0.4, 0, 0.1),
]
X = (np.arange(W) + 0.5) * KMPX_X; Y = (np.arange(H) + 0.5) * KMPX_Y            # km from NW corner
X, Y = np.meshgrid(X, Y)
q = 3.0; acc = np.zeros((H, W)); eacc = np.zeros((H, W))
for name, lon, lat, hm, R, ratio, az, ero in PEAKS:
    x0, y0 = [v * k for v, k in zip(px(lon, lat), (KMPX_X, KMPX_Y))]
    dx, dy = X - x0, -(Y - y0)                                                    # north-positive
    a = math.radians(az); ux, uy = math.sin(a), math.cos(a)
    along, across = dx * ux + dy * uy, -dx * uy + dy * ux
    u = np.sqrt((along / R) ** 2 + (across / (R * ratio)) ** 2)
    hh = hm * np.clip(1 - u ** 1.8, 0, 1) ** 1.35
    if name == "Konahuanui":
        hh = hm * np.clip(1 - (across / (R * ratio)) ** 2, 0, 1) ** 1.1 * (1 - np.clip(np.abs(along) / 20, 0, 1) ** 3)
    acc += hh ** q; eacc += hh ** q * ero
P = acc ** (1 / q); ero = eacc / np.maximum(acc, 1e-9)
# broad apron: real shields slope continuously to the sea, so add a wide, low copy of every peak
acc2 = np.zeros((H, W))
for name, lon, lat, hm, R, ratio, az, e_ in PEAKS:
    x0, y0 = [v * k for v, k in zip(px(lon, lat), (KMPX_X, KMPX_Y))]
    dx, dy = X - x0, -(Y - y0); a = math.radians(az); ux, uy = math.sin(a), math.cos(a)
    al, ac = dx * ux + dy * uy, -dx * uy + dy * ux
    u = np.sqrt((al / (R * 2.1)) ** 2 + (ac / (R * 2.1 * min(1, ratio * 1.5))) ** 2)
    acc2 += (hm * 0.5 * np.clip(1 - u ** 1.5, 0, 1) ** 1.6) ** q
P = ndi.gaussian_filter((P ** 3 + acc2) ** (1 / 3), 4)

def fbm(oct=6, base=70):
    out = np.zeros((H, W)); amp = 1.0; tot = 0
    for o in range(oct):
        n = ndi.gaussian_filter(rng.standard_normal((H, W)), base / (2 ** o)); n /= n.std()
        out += amp * n; tot += amp; amp *= 0.5
    return out / tot
n1 = fbm(); rid = 1 - np.abs(fbm(5, 40)) * 1.6                                    # ridged noise = eroded valleys
rid = np.clip(rid, 0, 1) ** 2
relief = P * (1 + 0.18 * n1) * (1 - ero * 0.55 * (1 - rid))                       # carve valleys where erosion is high
relief += P * 0.0
ramp = np.clip(dist_in / 1.4, 0, 1) ** 0.7                                       # fall to sea level at the coast
relief = np.maximum(relief * ramp, 0) + np.where(mask, 3 + 12 * np.clip(dist_in / 6, 0, 1), 0)
relief = ndi.gaussian_filter(relief, 1.1)

# --- bathymetry from distance to nearest land: shallow Maui Nui bank emerges because channels are narrow
depth = 4700 * (1 - np.exp(-dist_out / 42)) + 25 * np.clip(dist_out / 2, 0, 1)
depth = ndi.gaussian_filter(depth, 2.0)
elev = np.where(mask, relief, -depth)
elev = ndi.gaussian_filter(elev, 0.8)

# --- vegetation: trades blow from ENE; windward slopes wet, leeward + high summits dry/barren
hs = ndi.gaussian_filter(np.where(mask, relief, 0), 6)
gy, gx = np.gradient(hs, KMPX_Y * 1000, KMPX_X * 1000)                           # rows go south
wx, wy = math.cos(math.radians(22)), math.sin(math.radians(22))                  # toward ENE (east, north)
slope_toward_wind = -(gx * wx + (-gy) * wy)                                      # +: surface faces the wind
wet = np.clip(0.45 + 9 * slope_toward_wind, 0, 1)
band = np.exp(-((relief - 900) / 1100) ** 2)
veg = np.clip(0.12 + 0.55 * wet * (0.4 + 0.6 * band) + 0.3 * band * 0.5, 0, 1)
veg *= 1 - np.clip((relief - 2300) / 1400, 0, 1) ** 1.2
veg = np.where(mask, veg, 0)

enc = np.clip((elev - EMIN) / (EMAX - EMIN), 0, 1) * 65535
enc = enc.astype(np.uint16)
rgba = np.dstack([(enc >> 8).astype(np.uint8), (enc & 255).astype(np.uint8), (veg * 255).astype(np.uint8), np.full((H, W), 255, np.uint8)])
Image.fromarray(rgba, "RGBA").save("data/terrain.png", optimize=True)
json.dump({"lon0": LON0, "lon1": LON1, "lat0": LAT0, "lat1": LAT1, "w": W, "h": H, "emin": EMIN, "emax": EMAX,
           "kmLon": KM_LON, "kmLat": KM_LAT}, open("data/meta.json", "w"))

# quick hillshade preview for QA
ls = np.gradient(ndi.gaussian_filter(np.maximum(elev, -300) * 6, 1), KMPX_Y * 1000, KMPX_X * 1000)
shade = np.clip(0.55 + 0.9 * (ls[1] * 0.7 + ls[0] * 0.7) * 0.5, 0, 1)
col = np.where(mask[..., None], np.dstack([0.3 + 0.4 * (1 - veg), 0.35 + 0.35 * veg, 0.2 + 0.1 * veg]), np.dstack([np.full((H, W), 0.03), 0.12 + 0.5 * np.exp(-dist_out[..., None][..., 0] / 5), 0.25 + 0.45 * np.exp(-dist_out / 5)]))
Image.fromarray((np.clip(col * shade[..., None], 0, 1) * 255).astype(np.uint8)).resize((1400, 908)).save("preview_check.png")
print("max relief", int(relief.max()), "min elev", int(elev.min()))
