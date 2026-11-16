import { loadHomeFigures } from "./home-live.js";
import { mountLanguage } from "./lang.js";
mountLanguage(document.getElementById("lang-host"));
/* AllReady home v2: daytime scroll flight over the eight main islands, with one hazard "story" per island.
   Layers: (1) pictogram beacons, (2) hazard + route drawn on the terrain, (3) silhouette persona card.
   Terrain = real coastlines + MODELED relief (scripts/build_terrain.py). Personas, routes and shelters are
   ILLUSTRATIVE. MIT licensed. */
import * as THREE from "three";
import "./home.css";

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const VE = 5; // vertical exaggeration (1 world unit = 1 km)
const HZ = { FLOOD: 1, TSUNAMI: 2, HURRICANE: 3, FIRE: 4, QUAKE: 5, ERUPT: 6, DROUGHT: 7 };

/* ---------- Camera keyframes: hero, 8 islands (NW to SE), closing ---------- */
const KF = [
  { lon: -157.6, lat: 20.9, ty: 0, dist: 640, el: 34, az: 212 },
  { lon: -160.14, lat: 21.9, ty: 0.5, dist: 34, el: 19, az: 242 },
  { lon: -159.52, lat: 22.06, ty: 2, dist: 64, el: 17, az: 242 },
  { lon: -157.97, lat: 21.47, ty: 1.5, dist: 68, el: 17, az: 242 },
  { lon: -156.98, lat: 21.13, ty: 1.5, dist: 80, el: 16, az: 236 },
  { lon: -156.93, lat: 20.83, ty: 1, dist: 38, el: 19, az: 242 },
  { lon: -156.6, lat: 20.55, ty: 0.5, dist: 30, el: 20, az: 242 },
  { lon: -156.34, lat: 20.79, ty: 5, dist: 86, el: 16, az: 242 },
  { lon: -155.52, lat: 19.62, ty: 7, dist: 175, el: 17, az: 242 },
  { lon: -157.0, lat: 20.6, ty: 0, dist: 720, el: 30, az: 190 },
];

/* ---------- Pictograms (flat silhouettes, reused for beacons and cards) ---------- */
const SV = (inner) => `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const ICON = {
  wheel: SV('<circle cx="26" cy="11" r="6" fill="currentColor" stroke="none"/><path d="M26 20v17h15l6 14"/><circle cx="25" cy="43" r="12"/>'),
  cane: SV('<circle cx="29" cy="11" r="6" fill="currentColor" stroke="none"/><path d="M29 20v20M29 40l-6 18M29 40l7 18M29 27l12 6M41 33l3 25"/>'),
  oxy: SV('<circle cx="26" cy="11" r="6" fill="currentColor" stroke="none"/><path d="M26 20v22M26 42l-6 16M26 42l7 16M26 28l-8 8"/><rect x="40" y="26" width="11" height="26" rx="5.5"/><path d="M40 32c-8 0-10-8-14-10"/>'),
  family: SV('<circle cx="17" cy="14" r="5.5" fill="currentColor" stroke="none"/><circle cx="35" cy="17" r="4.5" fill="currentColor" stroke="none"/><circle cx="50" cy="29" r="3.5" fill="currentColor" stroke="none"/><path d="M17 22v18M17 40l-4 16M17 40l5 16M35 24v16M35 40l-4 16M35 40l5 16M50 35v10M50 45l-3 11M50 45l3 11"/>'),
  dog: SV('<circle cx="16" cy="11" r="6" fill="currentColor" stroke="none"/><path d="M16 20v20M16 40l-6 18M16 40l7 18M16 28l12 8"/><ellipse cx="43" cy="46" rx="11" ry="5.5"/><circle cx="56" cy="40" r="4" fill="currentColor" stroke="none"/><path d="M36 51v7M48 51v7M28 36l10 8"/>'),
  grid: SV('<path d="M8 34 32 14l24 20M15 30v22h34V30"/><path d="M6 58 58 6" stroke-width="5"/>'),
  shelter: SV('<path d="M8 32 32 12l24 20M14 28v24h36V28"/><path d="M32 34v12M26 40h12"/>'),
};

/* ---------- Stories (all personas/routes/shelters illustrative) ---------- */
const STORIES = {
  1: { hz: HZ.DROUGHT, hzName: "Drought", c: [-160.15, 21.9], R: 14, note: "No persona is shown. Niʻihau is private and access is restricted, so planning there would rely on island-level information only." },
  2: { hz: HZ.FLOOD, hzName: "Flood", c: [-159.49, 22.19], R: 5.5, fx: { type: 1, c: [-159.45, 22.17], spread: 14, base: 0.6 }, icon: "wheel", scenario: "flood&island=kauai",
    title: "Wheelchair user, north shore", cmist: ["Independence", "Transportation"],
    beats: ["Heavy rain lifts the Hanalei River, and the highway’s one-lane bridges can close.", "A wheelchair-accessible van is needed, and the usual route may be cut.", "Planners pre-position paratransit east of the bridge and route to an accessible sample shelter."],
    route: [[-159.50, 22.205], [-159.47, 22.22], [-159.40, 22.21], [-159.31, 22.14], [-159.32, 22.08]] },
  3: { hz: HZ.TSUNAMI, hzName: "Tsunami", c: [-157.85, 21.29], R: 6.5, icon: "cane", scenario: "tsunami&island=oahu",
    title: "Kupuna in a high-rise, Waikīkī", cmist: ["Independence", "Safety/Support"],
    beats: ["A tsunami warning is issued and the coastal roads begin to gridlock.", "Elevators may stop, and long evacuation walks are not realistic.", "The plan uses vertical evacuation to a designated upper floor, with building-manager checklists."],
    route: [[-157.83, 21.277], [-157.815, 21.30], [-157.80, 21.325]] },
  4: { hz: HZ.HURRICANE, hzName: "Hurricane", c: [-156.2, 20.55], R: 100, fx: { type: 1, c: [-157.0, 21.12], spread: 40, base: 0.8 }, icon: "oxy", scenario: "hurricane&island=molokai",
    title: "Oxygen concentrator user, Kaunakakai", cmist: ["Medical"],
    beats: ["A hurricane approaches and power outages are expected.", "The concentrator needs electricity, and the nearest backup may be far.", "The plan routes to a generator-equipped sample shelter and counts fuel and batteries in the resource model."],
    route: [[-157.02, 21.09], [-157.06, 21.12], [-157.10, 21.15]] },
  5: { hz: HZ.FIRE, hzName: "Wildfire", c: [-157.0, 20.8], R: 7.5, fx: { type: 2, c: [-157.0, 20.8], spread: 6, base: 1.0 }, icon: "family", scenario: "wildfire&island=lanai",
    title: "Caregiver with a kupuna and a child, Lānaʻi City", cmist: ["Safety/Support", "Transportation"],
    beats: ["A wind-driven fire grows on the dry leeward slopes with little notice.", "Few exits, and three people who move at different speeds.", "A pre-set assembly point at the harbor, with boat and air capacity coordinated ahead of time."],
    route: [[-156.92, 20.83], [-156.90, 20.78], [-156.89, 20.74]] },
  6: { hz: 0, note: "No persona is shown. Kahoʻolawe is an uninhabited reserve, so this island is a quiet beat in the journey." },
  7: { hz: HZ.QUAKE, hzName: "Earthquake", c: [-156.3, 20.6], R: 45, icon: "dog", scenario: "earthquake&island=maui",
    title: "Person with a service dog, Kīhei", cmist: ["Independence"],
    beats: ["A strong earthquake damages buildings and some roads.", "Shelter staff may be unsure how to house a service animal.", "The plan routes to an accessible sample shelter where the service animal stays with its handler."],
    route: [[-156.45, 20.75], [-156.51, 20.79], [-156.51, 20.85], [-156.50, 20.89]] },
  8: { hz: HZ.ERUPT, hzName: "Eruption", c: [-154.95, 19.45], R: 7.5, fx: { type: 3, c: [-155.28, 19.41], spread: 1, base: 6.2 }, icon: "grid", scenario: "volcano&island=hawaii",
    title: "Off-grid household, Puna", cmist: ["Communication", "Transportation"],
    beats: ["Lava threatens roads, and volcanic haze drifts downwind.", "Weak connectivity and a long drive to town.", "A trusted community messenger and a printed low-connectivity brief, with a route to a Hilo sample shelter."],
    route: [[-154.95, 19.47], [-154.94, 19.49], [-155.0, 19.6], [-155.09, 19.72]] },
};
const planLink = (s) => `index.html?hazard=${s.scenario}`;

/* ---------- DOM ---------- */
const loader = document.getElementById("loader");
const rail = [...document.querySelectorAll(".rail button")];
const sections = [...document.querySelectorAll(".chapter")];
const hud = document.querySelector(".hud"), hudSummit = document.getElementById("hudSummit"), hudCoord = document.getElementById("hudCoord");
const personaEl = document.getElementById("persona"), beaconBox = document.getElementById("beacons");

function goTo(i) {
  const s = sections[i]; if (!s) return;
  scrollTo({ top: s.offsetTop + s.offsetHeight / 2 - innerHeight / 2, behavior: REDUCED ? "auto" : "smooth" });
}
rail.forEach((b) => b.addEventListener("click", () => goTo(+b.dataset.go)));
document.getElementById("replay")?.addEventListener("click", () => goTo(0));
loadHomeFigures();

// The fictional persona cards were removed: this page now shows only live figures.
const renderPersona = () => {};
let activeIdx = -1;
function setActive(i) {
  if (i === activeIdx) return; activeIdx = i;
  sections.forEach((s, k) => s.classList.toggle("is-active", k === i));
  rail.forEach((b) => { if (+b.dataset.go === i) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current"); });
  const s = sections[i];
  
  renderPersona(i);
}

/* ---------- Scroll to progress ---------- */
let centers = [];
const measure = () => { centers = sections.map((s) => s.offsetTop + s.offsetHeight / 2); };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function scrollState() {
  const mid = scrollY + innerHeight / 2;
  let i = 0; while (i < centers.length - 2 && mid > centers[i + 1]) i++;
  const t = Math.min(1, Math.max(0, (mid - centers[i]) / (centers[i + 1] - centers[i])));
  let near = 0, best = 1e9; centers.forEach((c, k) => { const d = Math.abs(c - mid); if (d < best) { best = d; near = k; } });
  const sec = sections[near]; const sp = Math.min(1, Math.max(0, (mid - sec.offsetTop) / sec.offsetHeight));
  return { i, e: smooth(0.2, 0.8, t), near, sp };
}

/* ---------- Scene ---------- */
async function boot() {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("gl"), antialias: true, powerPreference: "high-performance" }); }
  catch { document.documentElement.classList.add("no-webgl"); loader.classList.add("done"); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 800 ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight);

  // Relative to the page, not the domain root: the app is also served from /<repo>/ on GitHub Pages.
  const meta = await (await fetch(import.meta.env.BASE_URL + "data/meta.json")).json();
  const img = new Image(); img.src = import.meta.env.BASE_URL + "data/terrain.png"; await img.decode();
  const cv = document.createElement("canvas"); cv.width = meta.w; cv.height = meta.h;
  const cx = cv.getContext("2d", { willReadFrequently: true }); cx.drawImage(img, 0, 0);
  const px = cx.getImageData(0, 0, meta.w, meta.h).data;
  const KX = (meta.lon1 - meta.lon0) * meta.kmLon, KZ = (meta.lat1 - meta.lat0) * meta.kmLat;
  const wx = (lon) => (lon - meta.lon0) * meta.kmLon, wz = (lat) => (meta.lat1 - lat) * meta.kmLat;

  const S = innerWidth < 800 ? 4 : 2;
  const cols = Math.floor((meta.w - 1) / S) + 1, rows = Math.floor((meta.h - 1) / S) + 1, n = cols * rows;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), aElev = new Float32Array(n), aVeg = new Float32Array(n), Y = new Float32Array(n);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const sx = Math.min(c * S, meta.w - 1), sy = Math.min(r * S, meta.h - 1), k = (sy * meta.w + sx) * 4, v = r * cols + c;
    const e = meta.emin + ((px[k] * 256 + px[k + 1]) / 65535) * (meta.emax - meta.emin);
    aElev[v] = e; aVeg[v] = px[k + 2] / 255; Y[v] = Math.max(e, 0) / 1000 * VE;
    pos[v * 3] = (sx / (meta.w - 1)) * KX; pos[v * 3 + 1] = Y[v]; pos[v * 3 + 2] = (sy / (meta.h - 1)) * KZ;
  }
  const dx = KX / (cols - 1), dz = KZ / (rows - 1);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const v = r * cols + c, L = Y[r * cols + Math.max(c - 1, 0)], R = Y[r * cols + Math.min(c + 1, cols - 1)], U = Y[Math.max(r - 1, 0) * cols + c], D = Y[Math.min(r + 1, rows - 1) * cols + c];
    const nx = -(R - L) / (2 * dx), nz = -(D - U) / (2 * dz), m = Math.hypot(nx, 1, nz);
    nor[v * 3] = nx / m; nor[v * 3 + 1] = 1 / m; nor[v * 3 + 2] = nz / m;
  }
  const idx = new Uint32Array((cols - 1) * (rows - 1) * 6); let q = 0;
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) {
    const a = r * cols + c, b = a + 1, cc = a + cols, d = cc + 1;
    idx[q++] = a; idx[q++] = cc; idx[q++] = b; idx[q++] = b; idx[q++] = cc; idx[q++] = d;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  geo.setAttribute("aElev", new THREE.BufferAttribute(aElev, 1)); geo.setAttribute("aVeg", new THREE.BufferAttribute(aVeg, 1));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  const heightAt = (x, z) => { // bilinear terrain height in world units
    const fx = Math.min(cols - 1.001, Math.max(0, x / dx)), fz = Math.min(rows - 1.001, Math.max(0, z / dz));
    const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz, a = iz * cols + ix;
    return (Y[a] * (1 - tx) + Y[a + 1] * tx) * (1 - tz) + (Y[a + cols] * (1 - tx) + Y[a + cols + 1] * tx) * tz;
  };

  const dirFrom = (az, el) => { const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el); return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)).normalize(); };
  const uniforms = {
    uTime: { value: 0 }, uSun: { value: dirFrom(105, 38) }, uFill: { value: dirFrom(228, 40) },
    uFogColor: { value: new THREE.Color(0.66, 0.82, 0.94) },
    uHz: { value: new THREE.Vector4(0, 0, 1, 0) }, uHzType: { value: 0 }, uHzOn: { value: 0 },
  };
  const NOISE = `
    float hash21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
    float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
      return mix(mix(hash21(i),hash21(i+vec2(1.,0.)),f.x), mix(hash21(i+vec2(0.,1.)),hash21(i+vec2(1.,1.)),f.x), f.y); }
    float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*vnoise(p); p*=2.03; a*=.5; } return s; }
  `;
  const terrainMat = new THREE.ShaderMaterial({
    uniforms, side: THREE.DoubleSide,
    vertexShader: `
      attribute float aElev; attribute float aVeg;
      varying vec3 vWorld; varying vec3 vN; varying float vElev; varying float vVeg;
      void main(){ vWorld=position; vN=normal; vElev=aElev; vVeg=aVeg; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uSun; uniform vec3 uFill; uniform vec3 uFogColor;
      uniform vec4 uHz; uniform float uHzType; uniform float uHzOn;
      varying vec3 vWorld; varying vec3 vN; varying float vElev; varying float vVeg;
      ${NOISE}
      void main(){
        vec3 V = normalize(cameraPosition - vWorld);
        float dist = length(cameraPosition - vWorld);
        float hd = length(vWorld.xz - uHz.xy);
        float fp = uHz.w * uHzOn;
        float R = uHz.z;
        float nz2 = fbm(vWorld.xz*0.7 + 3.1);
        vec3 col;
        if (vElev > 1.0) {
          vec3 N = normalize(vN);
          float nz = fbm(vWorld.xz*0.9);
          float veg = clamp(vVeg + (nz-0.5)*0.35, 0., 1.);
          vec3 dry=vec3(0.62,0.52,0.30), lush=vec3(0.14,0.46,0.22), deep=vec3(0.06,0.28,0.15), rock=vec3(0.34,0.30,0.29);
          vec3 alb = mix(dry, lush, smoothstep(0.15,0.6,veg)); alb = mix(alb, deep, smoothstep(0.6,0.95,veg));
          float barren = smoothstep(2200.,3300., vElev + (nz-0.5)*500.);
          float steep = smoothstep(0.80,0.55,N.y);
          alb = mix(alb, rock, max(barren, steep*0.8));
          alb = mix(vec3(0.78,0.72,0.55), alb, smoothstep(2.,40.,vElev));
          float sun = max(dot(N,uSun),0.), fill = max(dot(N,uFill),0.);
          col = alb*(vec3(0.34,0.40,0.52) + vec3(1.0,0.93,0.80)*sun*1.05 + vec3(0.25,0.32,0.45)*fill*0.5);
          if (uHzType > 0.5) {
            if (uHzType < 1.5) {
              float m = (1.-smoothstep(R*0.55,R,hd+(nz2-.5)*1.5)) * smoothstep(90.,8.,vElev);
              col = mix(col, vec3(0.22,0.50,0.85)*(0.8+0.2*sin(uTime*1.2+vWorld.x*2.)), m*fp*0.8);
            } else if (uHzType < 2.5) {
              float m = (1.-smoothstep(R*0.6,R,hd+(nz2-.5)*1.2)) * smoothstep(22.,2.,vElev) * smoothstep(0.7,1.0,uHz.w) * uHzOn;
              col = mix(col, vec3(0.30,0.62,0.90), m*0.85);
            } else if (uHzType > 3.5 && uHzType < 4.5) {
              float fr = R*fp; float d2 = hd + (nz2-.5)*2.2; float on = step(0.01,fp);
              float burnt = (1.-smoothstep(fr-0.8,fr,d2))*on;
              col = mix(col, col*0.28+vec3(0.04,0.03,0.03), burnt*0.85);
              float rim = smoothstep(fr-1.4,fr,d2)*(1.-smoothstep(fr,fr+0.7,d2))*on;
              col += vec3(1.0,0.42,0.08)*rim*(0.9+0.9*nz2);
              col += vec3(1.0,0.35,0.05)*step(0.72, fbm(vWorld.xz*2.5+uTime*0.15))*burnt*0.6;
            } else if (uHzType > 4.5 && uHzType < 5.5) {
              float mr = R*max(fp,0.2);
              float ring = smoothstep(0.82,1.0,sin(hd*0.9 - uTime*2.2))*(1.-smoothstep(mr*0.7,mr,hd))*uHzOn;
              col += vec3(1.0,0.82,0.45)*ring*0.5;
            } else if (uHzType > 5.5 && uHzType < 6.5) {
              float m = 1.-smoothstep(R*0.25,R,hd+(nz2-.5)*3.);
              col = mix(col, vec3(0.08,0.04,0.035), m*0.8*fp);
              col += vec3(1.0,0.38,0.06)*pow(m,2.2)*(0.7+0.9*fbm(vWorld.xz*3.+uTime*0.25))*fp;
            } else if (uHzType > 6.5) {
              float m = (1.-smoothstep(R*0.8,R,hd))*uHzOn*0.85;
              col = mix(col, vec3(dot(col, vec3(0.3,0.5,0.2)))*vec3(1.15,0.98,0.72), m);
            }
          }
        } else {
          float d = max(-vElev, 0.);
          vec2 p = vWorld.xz;
          float amp = clamp(70./dist, 0.2, 1.);
          vec2 q = p*0.35 + vec2(uTime*0.03, uTime*0.02);
          vec2 q2 = p*1.6 + vec2(-uTime*0.07, uTime*0.05);
          float h = fbm(q), hx = fbm(q+vec2(.05,0.)), hz = fbm(q+vec2(0.,.05));
          float g = fbm(q2), gx = fbm(q2+vec2(.05,0.)), gz = fbm(q2+vec2(0.,.05));
          vec3 N = normalize(vec3(-(hx-h)*5. - (gx-g)*3.*amp, 1., -(hz-h)*5. - (gz-g)*3.*amp));
          float t0 = 1.-exp(-d/220.);
          vec3 shallow=vec3(0.22,0.84,0.80), mid=vec3(0.04,0.48,0.72), deepc=vec3(0.02,0.22,0.48);
          vec3 base = mix(shallow, mid, smoothstep(0.0,0.35,t0)); base = mix(base, deepc, smoothstep(0.25,0.95,t0));
          float glow = exp(-d/90.);
          vec3 H = normalize(uSun+V);
          float spec = pow(max(dot(N,H),0.), 160.);
          float fres = pow(1.-max(dot(N,V),0.), 4.);
          col = base*(0.8+0.3*max(dot(N,uSun),0.)) + base*glow*0.35;
          col = mix(col, vec3(0.55,0.75,0.95), fres*0.45);
          col += vec3(1.0,0.97,0.9)*spec*1.4;
          float foam = smoothstep(28.,0.,d) * (0.5+0.5*sin(uTime*0.9 + vWorld.x*3. + vWorld.z*2.));
          col += vec3(0.9,1.0,1.0)*foam*0.30;
          if (uHzType > 1.5 && uHzType < 2.5) {
            float zf = mix(uHz.y+120., uHz.y+1., smoothstep(0.,0.8,uHz.w));
            float band = exp(-pow((vWorld.z-zf)/3.5,2.)) * step(abs(vWorld.x-uHz.x),80.);
            col = mix(col, vec3(0.9,0.98,1.0), band*uHzOn*0.85);
          } else if (uHzType > 4.5 && uHzType < 5.5) {
            float mr = R*max(fp,0.2);
            col += vec3(1.0,0.9,0.6)*smoothstep(0.85,1.0,sin(hd*0.9 - uTime*2.2))*(1.-smoothstep(mr*0.7,mr,hd))*uHzOn*0.35;
          }
        }
        col = pow(col, vec3(0.92));
        float fog = 1.-exp(-pow(dist/1100., 1.6));
        gl_FragColor = vec4(mix(col, uFogColor, fog), 1.);
      }`,
  });

  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(geo, terrainMat));

  /* endless sea, parked well below the terrain's flat sea so the two never z-fight */
  const seaGeo = new THREE.PlaneGeometry(12000, 12000, 1, 1); seaGeo.rotateX(-Math.PI / 2);
  const sp = seaGeo.attributes.position.count;
  seaGeo.translate(KX / 2, -3, KZ / 2);
  seaGeo.setAttribute("aElev", new THREE.BufferAttribute(new Float32Array(sp).fill(-4700), 1));
  seaGeo.setAttribute("aVeg", new THREE.BufferAttribute(new Float32Array(sp), 1));
  scene.add(new THREE.Mesh(seaGeo, terrainMat));

  /* daytime sky */
  const sky = new THREE.Mesh(new THREE.SphereGeometry(8000, 32, 16), new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `
      uniform vec3 uSun; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir); float y = max(d.y,0.);
        vec3 col = mix(vec3(0.66,0.82,0.94), vec3(0.13,0.40,0.78), pow(y,0.5));
        float sd = max(dot(d,uSun),0.);
        col += vec3(1.0,0.85,0.6)*pow(sd,8.)*0.25 + vec3(1.0,0.95,0.8)*pow(sd,400.)*1.2;
        float disc = smoothstep(cos(0.03), cos(0.026), dot(d,uSun));
        col = mix(col, vec3(1.0,0.97,0.88), disc);
        gl_FragColor = vec4(col,1.);
      }`,
  }));
  sky.renderOrder = -1; sky.frustumCulled = false; scene.add(sky);

  /* low cloud deck */
  const CLOUD_Y = 7;
  const cg = new THREE.PlaneGeometry(1500, 1000, 1, 1); cg.rotateX(-Math.PI / 2); cg.translate(KX / 2, CLOUD_Y, KZ / 2);
  const clouds = new THREE.Mesh(cg, new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: `varying vec3 vW; void main(){ vW=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `
      uniform float uTime; varying vec3 vW; ${NOISE}
      void main(){
        float dist = length(cameraPosition - vW);
        float nz = fbm(vW.xz*0.012 + vec2(uTime*0.004, uTime*0.002));
        float a = smoothstep(0.52,0.80,nz)*0.55;
        a *= 1.-smoothstep(160.,800.,dist);
        a *= smoothstep(0.,2.5,abs(cameraPosition.y-${CLOUD_Y.toFixed(1)}));
        gl_FragColor = vec4(vec3(0.97,0.98,1.0)*(0.88+0.12*nz), a);
      }`,
  }));
  clouds.renderOrder = 2; scene.add(clouds);

  /* hurricane spiral band (only visible for the hurricane story) */
  const hg = new THREE.PlaneGeometry(1000, 1000, 1, 1); hg.rotateX(-Math.PI / 2); hg.translate(KX / 2, 11, KZ / 2);
  const hurr = new THREE.Mesh(hg, new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: `varying vec3 vW; void main(){ vW=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `
      uniform float uTime; uniform vec4 uHz; uniform float uHzType; uniform float uHzOn; varying vec3 vW; ${NOISE}
      void main(){
        vec2 q = vW.xz - uHz.xy; float r = length(q); float th = atan(q.y,q.x);
        float spiral = sin(th*2. + log(r+1.)*7. - uTime*0.5)*0.5+0.5;
        float n = fbm(q*0.05 + vec2(uTime*0.01));
        float a = clamp(0.35*spiral + 0.75*n - 0.2, 0., 1.) * (1.-smoothstep(70.,130.,r)) * smoothstep(7.,22.,r);
        a *= uHzOn * smoothstep(0.,0.6,uHz.w) * step(2.5,uHzType) * step(uHzType,3.5);
        a *= 1.-smoothstep(300.,900.,length(cameraPosition - vW));
        gl_FragColor = vec4(vec3(0.90,0.92,0.96)*(0.8+0.2*n), a*0.85);
      }`,
  }));
  hurr.renderOrder = 3; hurr.frustumCulled = false; scene.add(hurr);

  /* particles: rain, smoke + embers, ash plume (one system, re-aimed per story) */
  const PN = 3500, seeds = new Float32Array(PN * 3).map(Math.random);
  const pg = new THREE.BufferGeometry();
  pg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(PN * 3), 3)); pg.setAttribute("seed", new THREE.BufferAttribute(seeds, 3));
  const pu = { uP: { value: new THREE.Vector4() }, uPType: { value: 0 }, uPOn: { value: 0 }, uPSize: { value: 700 } };
  const parts = new THREE.Points(pg, new THREE.ShaderMaterial({
    uniforms: { ...uniforms, ...pu }, transparent: true, depthWrite: false,
    vertexShader: `
      uniform float uTime; uniform vec4 uP; uniform float uPType; uniform float uPOn; uniform float uPSize;
      attribute vec3 seed; varying float vA; varying float vT; varying float vEm;
      void main(){
        vec2 wind = vec2(-0.92, 0.38); vec3 p; float a = 1.; float size = 1.; float em = 0.;
        if (uPType < 1.5) {
          float u = fract(seed.y - uTime*0.45);
          p = vec3(uP.x+(seed.x-.5)*2.*uP.z + wind.x*(1.-u)*2., uP.w+u*16., uP.y+(seed.z-.5)*2.*uP.z + wind.y*(1.-u)*2.);
          a = 0.45*smoothstep(0.,0.1,u)*(1.-smoothstep(0.85,1.,u)); size = 0.14;
        } else if (uPType < 2.5) {
          em = step(0.88, seed.x);
          float u = fract(seed.y + uTime*mix(0.06,0.3,em)*(0.6+seed.z*0.4));
          float H = mix(11., 6., em); vec2 off = (vec2(seed.x,seed.z)-.5)*2.*uP.z;
          p = vec3(uP.x+off.x + wind.x*u*u*10., uP.w+u*H, uP.y+off.y + wind.y*u*u*10.);
          a = mix(0.30, 0.9, em)*smoothstep(0.,.1,u)*(1.-u); size = mix(4.+u*6., 0.35, em);
        } else {
          float u = fract(seed.y + uTime*0.045); float spread = 0.25+u*1.2;
          vec2 off = (vec2(seed.x,seed.z)-.5)*2.*spread;
          p = vec3(uP.x+off.x + wind.x*u*u*14., uP.w+u*22., uP.y+off.y + wind.y*u*u*14.);
          a = 0.55*smoothstep(0.,.05,u)*(1.-u*u); size = 3.+u*8.;
        }
        vA = a*uPOn; vT = uPType; vEm = em;
        vec4 mv = modelViewMatrix*vec4(p,1.);
        gl_PointSize = max(size*uPSize/(-mv.z), 1.);
        gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: `
      varying float vA; varying float vT; varying float vEm;
      void main(){
        float d = length(gl_PointCoord-.5); float m = smoothstep(.5,.1,d);
        vec3 col = vT < 1.5 ? vec3(0.85,0.93,1.0) : (vT < 2.5 ? mix(vec3(0.32,0.30,0.30), vec3(1.0,0.55,0.12), vEm) : vec3(0.40,0.35,0.32));
        gl_FragColor = vec4(col, m*vA);
      }`,
  }));
  parts.frustumCulled = false; parts.renderOrder = 4; scene.add(parts);

  /* routes: tube lines draped on the terrain, drawn on with scroll */
  const routes = {};
  Object.entries(STORIES).forEach(([id, s]) => {
    if (!s.route) return;
    const pts = s.route.map(([lo, la]) => new THREE.Vector3(wx(lo), heightAt(wx(lo), wz(la)) + 0.3, wz(la)));
    const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.4);
    const tg = new THREE.TubeGeometry(curve, 120, KF[id].dist * 0.0045, 6, false);
    const mesh = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: 0xffc857 }));
    mesh.visible = false; mesh.frustumCulled = false; scene.add(mesh); routes[id] = { mesh, pts };
  });

  /* beacons (DOM pictograms projected from world positions) */
  const beacons = [];
  Object.entries(STORIES).forEach(([id, s]) => {
    if (!s.route) return;
    const mk = (cls, icon, label, pt) => {
      const el = document.createElement("div"); el.className = `bcn ${cls}`;
      el.innerHTML = `<span class="ring"></span><span class="ico">${icon}</span><span class="lbl">${label}</span>`; beaconBox.appendChild(el);
      beacons.push({ el, id: +id, pt: pt.clone().add(new THREE.Vector3(0, 0.6, 0)), cls });
    };
    mk("origin", ICON[s.icon], "Illustrative persona area", routes[id].pts[0]);
    mk("shelter", ICON.shelter, "Sample shelter", routes[id].pts[routes[id].pts.length - 1]);
  });

  /* camera */
  const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.5, 9000);
  const frameShift = () => { if (innerWidth > 860) camera.setViewOffset(innerWidth, innerHeight, -innerWidth * 0.06, 0, innerWidth, innerHeight); else camera.clearViewOffset(); };
  frameShift();
  const cur = { lon: KF[0].lon, lat: KF[0].lat, ty: KF[0].ty, ldist: Math.log(KF[0].dist), el: KF[0].el, az: KF[0].az };
  const goal = { ...cur };
  const lerpAng = (a, b, t) => a + (((b - a + 540) % 360) - 180) * t;
  const place = () => {
    const el = THREE.MathUtils.degToRad(cur.el), az = THREE.MathUtils.degToRad(cur.az), dist = Math.exp(cur.ldist);
    const tx = wx(cur.lon), tz = wz(cur.lat), h = dist * Math.cos(el);
    camera.position.set(tx + Math.sin(az) * h, cur.ty + dist * Math.sin(el), tz - Math.cos(az) * h);
    camera.lookAt(tx, cur.ty, tz); sky.position.copy(camera.position);
    camera.near = THREE.MathUtils.clamp(dist * 0.012, 0.5, 10); camera.updateProjectionMatrix(); // deeper depth precision when far out
  };
  const st = { near: 0, sp: 0 };
  const aim = () => {
    const { i, e, near, sp: spp } = scrollState(); setActive(near); st.near = near; st.sp = spp;
    const a = KF[i], b = KF[Math.min(i + 1, KF.length - 1)];
    goal.lon = a.lon + (b.lon - a.lon) * e; goal.lat = a.lat + (b.lat - a.lat) * e; goal.ty = a.ty + (b.ty - a.ty) * e;
    goal.el = a.el + (b.el - a.el) * e; goal.az = lerpAng(a.az, b.az, e); goal.ldist = Math.log(a.dist) + (Math.log(b.dist) - Math.log(a.dist)) * e;
  };
  measure(); aim(); Object.assign(cur, goal); place();
  addEventListener("scroll", aim, { passive: true });
  addEventListener("resize", () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; frameShift(); measure(); aim(); });

  const v3 = new THREE.Vector3(); let cfg = null, on = 0, pOn = 0;
  let lastFrame = performance.now(); // seconds since the previous frame (THREE.Clock is deprecated)
  const clock = { getDelta() { const n = performance.now(), d = (n - lastFrame) / 1000; lastFrame = n; return d; } };
  (function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05), k = REDUCED ? 1 : 1 - Math.exp(-dt * 3.2);
    for (const key of ["lon", "lat", "ty", "ldist", "el"]) cur[key] += (goal[key] - cur[key]) * k;
    cur.az = lerpAng(cur.az, goal.az, k);
    if (!REDUCED) uniforms.uTime.value += dt;
    place();
    if (!REDUCED) camera.position.y += Math.sin(uniforms.uTime.value * 0.5) * 0.12;

    /* story state */
    const s = STORIES[st.near]; if (s && s.hz) cfg = s;
    const ph = REDUCED ? 1 : smooth(0.1, 0.7, st.sp), pr = REDUCED ? 1 : smooth(0.45, 0.92, st.sp);
    on += (((s && s.hz) ? 1 : 0) - on) * k;
    if (cfg) { uniforms.uHz.value.set(wx(cfg.c[0]), wz(cfg.c[1]), cfg.R, ph); uniforms.uHzType.value = cfg.hz; }
    uniforms.uHzOn.value = on;
    const fx = (s && s.fx) || null; pOn += (((fx) ? 1 : 0) - pOn) * k;
    if (fx) { pu.uP.value.set(wx(fx.c[0]), wz(fx.c[1]), fx.spread, fx.base); pu.uPType.value = fx.type; }
    pu.uPOn.value = pOn * (fx && fx.type === 1 ? 1 : Math.max(ph, 0.15));
    parts.visible = pOn > 0.01;
    for (const [id, r] of Object.entries(routes)) {
      const show = +id === st.near; r.mesh.visible = show;
      if (show) r.mesh.geometry.setDrawRange(0, Math.max(1, Math.floor(pr * 120)) * 36);
    }
    for (const b of beacons) { // project, then show only what helps: all in overview, the active one up close
      v3.copy(b.pt).project(camera);
      const sx = (v3.x * 0.5 + 0.5) * innerWidth, sy = (-v3.y * 0.5 + 0.5) * innerHeight;
      const inView = v3.z > -1 && v3.z < 1 && sx > -40 && sx < innerWidth + 40 && sy > -40 && sy < innerHeight + 40;
      const overview = st.near === 0 || st.near === sections.length - 1, mine = b.id === st.near;
      const vis = inView && (overview ? b.cls === "origin" : mine && (b.cls === "origin" || pr > 0.85));
      b.el.style.opacity = vis ? "1" : "0"; b.el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%)`;
      b.el.classList.toggle("small", overview); b.el.classList.toggle("labeled", mine && !overview);
    }
    renderer.render(scene, camera);
  })();
  loader.classList.add("done");
}

window.addEventListener("load", measure);
// Failsafe: whatever happens to the terrain (slow image, lost GL context), the page must
// never sit behind its loader — the links on it have to stay usable.
setTimeout(() => loader.classList.add("done"), 6000);
boot().catch((err) => { console.error(err); document.documentElement.classList.add("no-webgl"); loader.classList.add("done"); });
addEventListener("scroll", () => { if (!centers.length) measure(); setActive(scrollState().near); }, { passive: true });

