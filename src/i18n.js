// Shared by home.html and index.html. The chosen language is stored in localStorage so both pages agree.
// d:1 = partial or draft text that needs community review; d:2 = no translation yet (English is shown).
import "./langmenu.css";
export const LANGS = [
  { c: "en", n: "English", e: "English" },
  { c: "haw", n: "ʻŌlelo Hawaiʻi", e: "Hawaiian", d: 1 },
  { c: "tl", n: "Tagalog", e: "Filipino" },
  { c: "ilo", n: "Ilokano", e: "Ilocano", d: 1 },
  { c: "ja", n: "日本語", e: "Japanese" },
  { c: "zh-Hant", n: "中文（繁體）", e: "Chinese" },
  { c: "ko", n: "한국어", e: "Korean" },
  { c: "vi", n: "Tiếng Việt", e: "Vietnamese" },
  { c: "es", n: "Español", e: "Spanish" },
  { c: "sm", n: "Gagana Sāmoa", e: "Samoan", d: 1 },
  { c: "chk", n: "Chuuk", e: "Chuukese", d: 1 },
  { c: "mh", n: "Kajin M̧ajeļ", e: "Marshallese", d: 2 },
];
const T = {
  en: { layers: "Map layers", add: "Add a layer…", home: "Home", open: "Open planning map", point: "Selected location", lat: "Latitude", lon: "Longitude", elev: "Elevation", val: "Top data layer", globe: "Globe", island: "Go to island…", op: "Opacity", top: "To top", bottom: "To bottom", remove: "Remove", hint: "Drag the handle to reorder. The top row draws on top.", tabLayers: "Layers", tabAlerts: "Alerts", tabNeeds: "Needs", filter: "Filter layers…", clear: "Clear data layers", refresh: "Refresh", needsH: "Access and functional needs", hiBtn: "Hawaiʻi", tilt: "3D tilt", gBase: "Basemap", gHaz: "Hazards", gWx: "Weather (one at a time)", gNeeds: "Population and needs", gRes: "Resources", gArc: "ArcGIS layers", details: "Layer details", noMatch: "No layers match.", noAlerts: "No active alerts for Hawaiʻi.", zoomTo: "Zoom to" },
  haw: { layers: "Nā papa palapala ʻāina", add: "Hoʻohui i papa…", home: "Hale", open: "E wehe i ka palapala ʻāina hoʻolālā", point: "Kahi i koho ʻia", lat: "Latitu", lon: "Longitu", elev: "Kiʻekiʻe", globe: "Honua", island: "E hele i ka mokupuni…" },
  tl: { layers: "Mga layer ng mapa", add: "Magdagdag ng layer…", home: "Tahanan", open: "Buksan ang mapa ng pagpaplano", point: "Napiling lokasyon", lat: "Latitud", lon: "Longhitud", elev: "Elebasyon", val: "Pinakataas na layer ng datos", globe: "Globo", island: "Pumunta sa isla…", op: "Opasidad", top: "Ilagay sa itaas", bottom: "Ilagay sa ibaba", remove: "Alisin", hint: "I-drag ang hawakan para ayusin. Ang pinakaitaas na hilera ang nasa ibabaw." },
  ilo: { layers: "Dagiti layer ti mapa", add: "Agnayon iti layer…", home: "Pagtaengan", open: "Silulukan ti mapa ti panagplano", point: "Napili a lokasion", lat: "Latitud", lon: "Longhitud", elev: "Elebasion", globe: "Globo", island: "Mapan iti isla…" },
  ja: { layers: "マップレイヤー", add: "レイヤーを追加…", home: "ホーム", open: "計画マップを開く", point: "選択した地点", lat: "緯度", lon: "経度", elev: "標高", val: "最上位のデータレイヤー", globe: "地球", island: "島へ移動…", op: "不透明度", top: "最前面へ", bottom: "最背面へ", remove: "削除", hint: "ハンドルをドラッグして並べ替えます。一番上の行が最前面に表示されます。" },
  "zh-Hant": { layers: "地圖圖層", add: "新增圖層…", home: "首頁", open: "開啟規劃地圖", point: "所選位置", lat: "緯度", lon: "經度", elev: "海拔", val: "最上層資料圖層", globe: "地球", island: "前往島嶼…", op: "不透明度", top: "移到最上層", bottom: "移到最下層", remove: "移除", hint: "拖曳握把可重新排序。最上方的項目顯示在最前面。" },
  ko: { layers: "지도 레이어", add: "레이어 추가…", home: "홈", open: "계획 지도 열기", point: "선택한 위치", lat: "위도", lon: "경도", elev: "고도", val: "최상위 데이터 레이어", globe: "지구본", island: "섬으로 이동…", op: "불투명도", top: "맨 위로", bottom: "맨 아래로", remove: "제거", hint: "핸들을 드래그해 순서를 바꿉니다. 맨 위 항목이 가장 앞에 표시됩니다." },
  vi: { layers: "Các lớp bản đồ", add: "Thêm lớp…", home: "Trang chủ", open: "Mở bản đồ lập kế hoạch", point: "Vị trí đã chọn", lat: "Vĩ độ", lon: "Kinh độ", elev: "Độ cao", val: "Lớp dữ liệu trên cùng", globe: "Địa cầu", island: "Đi đến đảo…", op: "Độ mờ đục", top: "Lên trên cùng", bottom: "Xuống dưới cùng", remove: "Xóa", hint: "Kéo tay cầm để sắp xếp lại. Hàng trên cùng hiển thị phía trước." },
  es: { layers: "Capas del mapa", add: "Añadir capa…", home: "Inicio", open: "Abrir el mapa de planificación", point: "Ubicación seleccionada", lat: "Latitud", lon: "Longitud", elev: "Elevación", val: "Capa de datos superior", globe: "Globo", island: "Ir a una isla…", op: "Opacidad", top: "Al frente", bottom: "Al fondo", remove: "Quitar", hint: "Arrastre el asa para reordenar. La fila superior se dibuja encima." },
  sm: { layers: "Vaega o le mapa", add: "Faʻaopoopo se vaega…", home: "Fale", globe: "Lalolagi", island: "Alu i le motu…" },
  chk: { open: "Pwaken map", globe: "Fonuofan" },
  mh: {},
};
const KEY = "allready.lang";
let cur = "en";
try { const s = localStorage.getItem(KEY); if (s && T[s]) cur = s; } catch {}
export const getLang = () => cur;
export const t = (k) => (T[cur] && T[cur][k]) || T.en[k] || k;
const subs = new Set();
export const onLang = (f) => subs.add(f);
export function applyI18n(root = document) {
  root.querySelectorAll("[data-i]").forEach((n) => (n.textContent = t(n.dataset.i)));
  document.documentElement.lang = cur;
}
export function setLang(c) {
  cur = c;
  try { localStorage.setItem(KEY, c); } catch {}
  applyI18n();
  subs.forEach((f) => f(c));
}
const GLOBE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/></svg>';
export function mountLangMenu(host) {
  if (!host) return;
  host.classList.add("lm");
  host.innerHTML = `<button type="button" class="lm-btn" aria-haspopup="listbox" aria-expanded="false" aria-label="Language">${GLOBE}<span class="lm-cur"></span><svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.4"/></svg></button><ul class="lm-list" role="listbox" hidden></ul>`;
  const btn = host.querySelector(".lm-btn"), list = host.querySelector(".lm-list");
  const render = () => {
    host.querySelector(".lm-cur").textContent = LANGS.find((l) => l.c === cur).n;
    list.innerHTML = LANGS.map((l) => `<li role="presentation"><button type="button" class="lm-opt" role="option" data-c="${l.c}" aria-selected="${l.c === cur}"><span>${l.n}<small>${l.e}</small></span><span class="lm-tag">${l.d === 2 ? "English shown" : l.d ? "needs review" : ""}</span></button></li>`).join("");
  };
  const open = (v) => { list.hidden = !v; btn.setAttribute("aria-expanded", v); if (v) (list.querySelector('[aria-selected="true"]') || list.querySelector(".lm-opt")).focus(); };
  btn.onclick = () => open(list.hidden);
  list.onclick = (e) => { const b = e.target.closest(".lm-opt"); if (b) { setLang(b.dataset.c); render(); open(false); btn.focus(); } };
  list.onkeydown = (e) => {
    const o = [...list.querySelectorAll(".lm-opt")], i = o.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); o[(i + 1) % o.length].focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); o[(i + o.length - 1) % o.length].focus(); }
    else if (e.key === "Escape") { open(false); btn.focus(); }
  };
  document.addEventListener("click", (e) => { if (!host.contains(e.target)) open(false); });
  render();
  applyI18n();
}
