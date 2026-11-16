/* AllReady — language switcher for the whole site. MIT licensed.

   One translator for all three pages. It works on the rendered page rather than on
   individual code paths: every text node, placeholder, tooltip and accessible name is looked
   up in the phrase table below, and a MutationObserver keeps doing that as panels re-render
   with live data. That is what lets a single choice change the entire site, including text
   created after load, without threading a translate call through every module.

   Languages offered are the ones this table actually covers: Spanish, Tagalog, Japanese,
   Traditional Chinese, Korean and Vietnamese. Hawaiian, Ilocano, Samoan, Chuukese and
   Marshallese are deliberately NOT offered yet: a half-right translation on an emergency
   planning tool is worse than none, and those need native-speaker review first.
   Figures, place names, agency names and model-written text are left as they are. */

export const LANGS = [["en", "English"], ["es", "Español"], ["tl", "Tagalog"], ["ja", "日本語"], ["zh-Hant", "中文（繁體）"], ["ko", "한국어"], ["vi", "Tiếng Việt"]];
const ORDER = ["es", "tl", "ja", "zh-Hant", "ko", "vi"];

// English | Spanish | Tagalog | Japanese | Traditional Chinese | Korean | Vietnamese
const TABLE = `
Home|Inicio|Home|ホーム|首頁|홈|Trang chủ
Insights|Análisis|Mga Insight|インサイト|分析|인사이트|Phân tích
Map|Mapa|Mapa|地図|地圖|지도|Bản đồ
Widgets|Paneles|Mga Widget|ウィジェット|小工具|위젯|Tiện ích
Open planning map|Abrir el mapa de planificación|Buksan ang mapa ng pagpaplano|計画マップを開く|開啟規劃地圖|계획 지도 열기|Mở bản đồ lập kế hoạch
Open insights|Abrir el análisis|Buksan ang mga insight|インサイトを開く|開啟分析|인사이트 열기|Mở phân tích
Layers|Capas|Mga Layer|レイヤー|圖層|레이어|Lớp
Shelters|Refugios|Mga Silungan|避難所|避難所|대피소|Nơi trú ẩn
Markup|Anotaciones|Mga Marka|マークアップ|標記|표시|Đánh dấu
Alerts|Alertas|Mga Alerto|警報|警報|경보|Cảnh báo
Assistant|Asistente|Katulong|アシスタント|助理|도우미|Trợ lý
AI assistant|Asistente de IA|AI na katulong|AIアシスタント|AI 助理|AI 도우미|Trợ lý AI
Inspector|Inspector|Inspektor|インスペクター|檢視器|검사기|Trình kiểm tra
Legend|Leyenda|Alamat ng mapa|凡例|圖例|범례|Chú giải
History|Historial|Kasaysayan|履歴|歷史|기록|Lịch sử
Event clock|Reloj del evento|Orasan ng pangyayari|イベントクロック|事件時鐘|이벤트 시계|Đồng hồ sự kiện
Resources & gaps|Recursos y carencias|Mga mapagkukunan at kakulangan|資源と不足|資源與缺口|자원과 부족분|Nguồn lực và thiếu hụt
Goals & metrics|Metas y métricas|Mga layunin at sukatan|目標と指標|目標與指標|목표와 지표|Mục tiêu và chỉ số
Needs (CMIST)|Necesidades (CMIST)|Mga Pangangailangan (CMIST)|ニーズ（CMIST）|需求（CMIST）|필요 사항(CMIST)|Nhu cầu (CMIST)
Data sources|Fuentes de datos|Mga pinagmulan ng datos|データソース|資料來源|데이터 출처|Nguồn dữ liệu
Data sources: verify every feed|Fuentes de datos: verifique cada una|Mga pinagmulan ng datos: suriin ang bawat isa|データソース：各フィードを確認|資料來源：查證每一項|데이터 출처: 각 피드 확인|Nguồn dữ liệu: kiểm tra từng nguồn
Planning factors|Factores de planificación|Mga salik sa pagpaplano|計画係数|規劃係數|계획 계수|Hệ số lập kế hoạch
Shelters & readiness|Refugios y preparación|Mga silungan at kahandaan|避難所と準備状況|避難所與準備程度|대피소와 준비 상태|Nơi trú ẩn và mức sẵn sàng
Markup: shapes and icons|Anotaciones: formas e iconos|Mga marka: hugis at icon|マークアップ：図形とアイコン|標記：圖形與圖示|표시: 도형과 아이콘|Đánh dấu: hình và biểu tượng
Live|En vivo|Live|ライブ|即時|실시간|Trực tiếp
What-if scenario|Escenario hipotético|Senaryong “paano kung”|仮定シナリオ|假設情境|가정 시나리오|Kịch bản giả định
No active event|Sin evento activo|Walang aktibong pangyayari|進行中のイベントなし|目前無事件|진행 중인 이벤트 없음|Không có sự kiện đang diễn ra
no active event|sin evento activo|walang aktibong pangyayari|進行中のイベントなし|目前無事件|진행 중인 이벤트 없음|không có sự kiện đang diễn ra
Clear data layers|Quitar capas de datos|Alisin ang mga layer ng datos|データレイヤーを消去|清除資料圖層|데이터 레이어 지우기|Xóa các lớp dữ liệu
Basemap|Mapa base|Batayang mapa|ベースマップ|底圖|기본 지도|Bản đồ nền
Hazards|Peligros|Mga Panganib|ハザード|災害|위험 요소|Hiểm họa
Weather (one at a time)|Clima (uno a la vez)|Panahon (isa-isa)|気象（1つずつ）|天氣（一次一項）|날씨(한 번에 하나)|Thời tiết (từng lớp một)
Population and needs|Población y necesidades|Populasyon at pangangailangan|人口とニーズ|人口與需求|인구와 필요 사항|Dân số và nhu cầu
Resources|Recursos|Mga Mapagkukunan|資源|資源|자원|Nguồn lực
ArcGIS layers|Capas de ArcGIS|Mga layer ng ArcGIS|ArcGIS レイヤー|ArcGIS 圖層|ArcGIS 레이어|Lớp ArcGIS
Add an ArcGIS layer|Añadir una capa de ArcGIS|Magdagdag ng layer ng ArcGIS|ArcGIS レイヤーを追加|新增 ArcGIS 圖層|ArcGIS 레이어 추가|Thêm lớp ArcGIS
Dark|Oscuro|Madilim|ダーク|深色|어둡게|Tối
Light|Claro|Maliwanag|ライト|淺色|밝게|Sáng
Streets|Calles|Mga Kalye|道路地図|街道|도로|Đường phố
3D tilt|Inclinación 3D|3D na tagilid|3D 傾斜|3D 傾斜|3D 기울기|Nghiêng 3D
Globe|Globo|Globo|地球|地球|지구본|Địa cầu
3D terrain|Terreno 3D|3D na lupain|3D 地形|3D 地形|3D 지형|Địa hình 3D
Hillshade|Sombreado del relieve|Anino ng burol|陰影起伏|地形陰影|음영 기복|Bóng địa hình
Roads|Carreteras|Mga Kalsada|道路|道路|도로|Đường
Place and water names|Nombres de lugares y aguas|Mga pangalan ng lugar at tubig|地名と水域名|地名與水域名稱|지명과 수역 이름|Tên địa danh và vùng nước
Flood hazard zones|Zonas de riesgo de inundación|Mga sona ng panganib sa baha|洪水危険区域|洪水危險區|홍수 위험 구역|Vùng nguy cơ lũ lụt
Tsunami evacuation zones|Zonas de evacuación por tsunami|Mga sona ng paglikas sa tsunami|津波避難区域|海嘯疏散區|쓰나미 대피 구역|Vùng sơ tán sóng thần
Active fire detections|Detecciones de incendios activos|Mga natukoy na aktibong sunog|火災検知|火點偵測|활성 화재 감지|Phát hiện đám cháy
NWS alerts|Alertas del NWS|Mga alerto ng NWS|NWS 警報|NWS 警報|NWS 경보|Cảnh báo NWS
Earthquakes (M2.5+)|Terremotos (M2.5+)|Mga lindol (M2.5+)|地震（M2.5以上）|地震（M2.5+）|지진(M2.5+)|Động đất (M2.5+)
Shelters (county plans)|Refugios (planes de los condados)|Mga silungan (plano ng county)|避難所（郡の計画）|避難所（郡計畫）|대피소(카운티 계획)|Nơi trú ẩn (kế hoạch của quận)
AFN need (census tracts)|Necesidad AFN (sectores censales)|Pangangailangang AFN (census tract)|AFN ニーズ（国勢調査区）|AFN 需求（普查區）|AFN 필요도(인구조사 구역)|Nhu cầu AFN (khu điều tra dân số)
Temperature|Temperatura|Temperatura|気温|氣溫|기온|Nhiệt độ
Wind|Viento|Hangin|風|風|바람|Gió
Precipitation|Precipitación|Ulan|降水量|降水|강수|Lượng mưa
Cloud cover|Nubosidad|Ulap|雲量|雲量|구름양|Mây che phủ
Hurricane|Huracán|Bagyo|ハリケーン|颶風|허리케인|Bão
Tsunami|Tsunami|Tsunami|津波|海嘯|쓰나미|Sóng thần
Wildfire|Incendio forestal|Wildfire|山火事|野火|산불|Cháy rừng
Flood|Inundación|Baha|洪水|洪水|홍수|Lũ lụt
Earthquake|Terremoto|Lindol|地震|地震|지진|Động đất
Shelters open now|Refugios abiertos ahora|Mga silungang bukas ngayon|現在開設中の避難所|目前開放的避難所|현재 운영 중인 대피소|Nơi trú ẩn đang mở
Shelters on record|Refugios registrados|Mga silungang nakatala|登録済み避難所|已登錄的避難所|등록된 대피소|Nơi trú ẩn có trong hồ sơ
Shelter spaces on record|Plazas de refugio registradas|Mga puwesto sa silungan na nakatala|登録済み収容人数|已登錄的收容名額|등록된 대피소 수용 인원|Chỗ trú ẩn có trong hồ sơ
Confirmed accessible (ADA)|Accesibles confirmados (ADA)|Kumpirmadong accessible (ADA)|バリアフリー確認済み（ADA）|已確認無障礙（ADA）|접근 가능 확인(ADA)|Đã xác nhận tiếp cận được (ADA)
With backup power|Con energía de respaldo|May reserbang kuryente|非常用電源あり|具備用電力|비상 전원 있음|Có điện dự phòng
Accepting animals|Aceptan animales|Tumatanggap ng hayop|動物受け入れ可|可帶動物|동물 수용 가능|Nhận động vật
Wind-hardened|Reforzados contra el viento|Pinatibay laban sa hangin|耐風補強済み|已強化抗風|내풍 보강|Gia cố chống gió
Counties publishing a shelter feed|Condados que publican datos de refugios|Mga county na naglalathala ng datos ng silungan|避難所データを公開している郡|有公開避難所資料的郡|대피소 데이터를 공개하는 카운티|Số quận công bố dữ liệu nơi trú ẩn
Plan a what-if scenario|Planificar un escenario hipotético|Magplano ng senaryong “paano kung”|仮定シナリオを計画|規劃假設情境|가정 시나리오 계획|Lập kịch bản giả định
Export the plan|Exportar el plan|I-export ang plano|計画をエクスポート|匯出計畫|계획 내보내기|Xuất kế hoạch
Shelter space|Espacio de refugio|Espasyo sa silungan|避難所面積|避難所空間|대피소 공간|Diện tích trú ẩn
Shelter spaces (people)|Plazas de refugio (personas)|Mga puwesto sa silungan (tao)|収容人数|收容名額（人）|대피소 수용 인원|Chỗ trú ẩn (người)
Accessible (ADA) spaces|Plazas accesibles (ADA)|Mga accessible na puwesto (ADA)|バリアフリー対応枠（ADA）|無障礙名額（ADA）|접근 가능 자리(ADA)|Chỗ tiếp cận được (ADA)
Wind-hardened spaces|Plazas reforzadas contra el viento|Mga puwestong pinatibay laban sa hangin|耐風補強済みの枠|抗風強化名額|내풍 보강 자리|Chỗ được gia cố chống gió
Shelter spaces with backup power|Plazas con energía de respaldo|Mga puwestong may reserbang kuryente|非常用電源付きの枠|具備用電力的名額|비상 전원이 있는 자리|Chỗ có điện dự phòng
Generators for shelters without power|Generadores para refugios sin energía|Mga generator para sa silungang walang kuryente|電源のない避難所用の発電機|無電力避難所所需發電機|전원 없는 대피소용 발전기|Máy phát cho nơi trú ẩn không có điện
Cots|Catres|Mga tiheras|簡易ベッド|行軍床|간이침대|Giường xếp
Blankets|Mantas|Mga kumot|毛布|毛毯|담요|Chăn
Water|Agua|Tubig|水|飲水|물|Nước
Meals|Comidas|Mga pagkain|食事|餐食|식사|Bữa ăn
Dialysis sessions|Sesiones de diálisis|Mga sesyon ng dialysis|透析回数|洗腎次數|투석 횟수|Lượt lọc máu
Oxygen resupply|Reabastecimiento de oxígeno|Muling suplay ng oxygen|酸素の補給|氧氣補給|산소 재공급|Tiếp tế oxy
Interpreters|Intérpretes|Mga interpreter|通訳者|口譯員|통역사|Thông dịch viên
Paratransit lift runs|Viajes de paratránsito con elevador|Mga biyahe ng paratransit na may lift|リフト付き福祉車両の運行|無障礙升降車趟次|리프트 특별교통 운행|Chuyến xe có thang nâng
Transport runs (ambulatory)|Viajes de transporte (ambulatorios)|Mga biyahe ng transportasyon (nakakalakad)|送迎便（歩行可能者）|接送趟次（可行走者）|수송 운행(보행 가능자)|Chuyến xe (người tự đi lại được)
Companion-animal spaces|Plazas para animales de compañía|Mga puwesto para sa alagang hayop|ペット受け入れ枠|同伴動物名額|반려동물 자리|Chỗ cho vật nuôi
Shelter staff|Personal del refugio|Mga tauhan ng silungan|避難所スタッフ|避難所人員|대피소 인력|Nhân viên nơi trú ẩn
Communication|Comunicación|Komunikasyon|コミュニケーション|溝通|의사소통|Giao tiếp
Medical|Atención médica|Medikal|医療|醫療|의료|Y tế
Independence|Independencia|Kasarinlan|自立|自主生活|자립|Tự lập
Safety and support|Seguridad y apoyo|Kaligtasan at suporta|安全と支援|安全與支持|안전과 지원|An toàn và hỗ trợ
Safety & support|Seguridad y apoyo|Kaligtasan at suporta|安全と支援|安全與支持|안전과 지원|An toàn và hỗ trợ
Transportation|Transporte|Transportasyon|交通手段|交通|교통|Giao thông
Age 65 and older|65 años o más|Edad 65 pataas|65歳以上|65 歲以上|65세 이상|Từ 65 tuổi trở lên
Residents|Residentes|Mga residente|住民|居民|주민|Cư dân
With a disability|Con discapacidad|May kapansanan|障害のある人|身心障礙者|장애가 있는 사람|Người khuyết tật
Limited English|Inglés limitado|Limitado sa Ingles|英語が不自由な人|英語能力有限|영어가 제한적인 사람|Hạn chế tiếng Anh
Households, no vehicle|Hogares sin vehículo|Mga sambahayang walang sasakyan|車のない世帯|無車家戶|차량 없는 가구|Hộ không có xe
Households with no vehicle|Hogares sin vehículo|Mga sambahayang walang sasakyan|車のない世帯|無車家戶|차량 없는 가구|Hộ không có xe
Manual value|Valor manual|Manu-manong halaga|手入力の値|手動輸入值|수동 입력 값|Giá trị nhập tay
Shelters confirmed accessible|Refugios accesibles confirmados|Mga silungang kumpirmadong accessible|バリアフリー確認済みの避難所|已確認無障礙的避難所|접근 가능 확인된 대피소|Nơi trú ẩn đã xác nhận tiếp cận được
Shelters with backup power|Refugios con energía de respaldo|Mga silungang may reserbang kuryente|非常用電源のある避難所|具備用電力的避難所|비상 전원이 있는 대피소|Nơi trú ẩn có điện dự phòng
Shelters accepting animals|Refugios que aceptan animales|Mga silungang tumatanggap ng hayop|動物を受け入れる避難所|可帶動物的避難所|동물을 받는 대피소|Nơi trú ẩn nhận động vật
Wind-hardened shelters|Refugios reforzados contra el viento|Mga silungang pinatibay laban sa hangin|耐風補強済みの避難所|已強化抗風的避難所|내풍 보강 대피소|Nơi trú ẩn gia cố chống gió
Residents in high-AFN tracts|Residentes en sectores de alta necesidad AFN|Mga residente sa mga tract na mataas ang AFN|AFN の高い地区の住民|高 AFN 普查區的居民|AFN가 높은 구역의 주민|Cư dân ở khu có AFN cao
Share living in high-AFN tracts|Proporción en sectores de alta necesidad AFN|Bahagi ng nakatira sa mga tract na mataas ang AFN|AFN の高い地区に住む割合|居住於高 AFN 普查區的比例|AFN가 높은 구역 거주 비율|Tỷ lệ sống ở khu có AFN cao
Residents with a disability|Residentes con discapacidad|Mga residenteng may kapansanan|障害のある住民|身心障礙居民|장애가 있는 주민|Cư dân khuyết tật
Disability, share of residents|Discapacidad, proporción de residentes|Kapansanan, bahagi ng mga residente|障害、住民に占める割合|身心障礙，占居民比例|장애, 주민 대비 비율|Khuyết tật, tỷ lệ trong cư dân
Limited-English residents|Residentes con inglés limitado|Mga residenteng limitado sa Ingles|英語が不自由な住民|英語能力有限的居民|영어가 제한적인 주민|Cư dân hạn chế tiếng Anh
Limited English, share of residents|Inglés limitado, proporción de residentes|Limitado sa Ingles, bahagi ng mga residente|英語が不自由、住民に占める割合|英語能力有限，占居民比例|영어 제한, 주민 대비 비율|Hạn chế tiếng Anh, tỷ lệ trong cư dân
Residents 65 and older|Residentes de 65 años o más|Mga residenteng 65 pataas|65歳以上の住民|65 歲以上居民|65세 이상 주민|Cư dân từ 65 tuổi trở lên
65 and older, share of residents|65 años o más, proporción de residentes|65 pataas, bahagi ng mga residente|65歳以上、住民に占める割合|65 歲以上，占居民比例|65세 이상, 주민 대비 비율|Từ 65 tuổi, tỷ lệ trong cư dân
Power-dependent residents|Residentes dependientes de electricidad|Mga residenteng umaasa sa kuryente|電力に依存する住民|依賴電力的居民|전력 의존 주민|Cư dân phụ thuộc điện
Residents on dialysis|Residentes en diálisis|Mga residenteng nagda-dialysis|透析を受けている住民|洗腎居民|투석 중인 주민|Cư dân đang lọc máu
Power-dependent per 1,000 residents|Dependientes de electricidad por 1,000 residentes|Umaasa sa kuryente sa bawat 1,000 residente|住民1,000人あたりの電力依存者|每千名居民中依賴電力者|주민 1,000명당 전력 의존자|Người phụ thuộc điện trên 1.000 cư dân
Residents per shelter space|Residentes por plaza de refugio|Mga residente sa bawat puwesto sa silungan|収容枠1つあたりの住民数|每個收容名額對應居民數|대피소 자리당 주민 수|Số cư dân trên mỗi chỗ trú ẩn
NWS alerts in force|Alertas del NWS vigentes|Mga alerto ng NWS na umiiral|発令中の NWS 警報|生效中的 NWS 警報|발효 중인 NWS 경보|Cảnh báo NWS đang có hiệu lực
Earthquakes M2.5+, past 7 days|Terremotos M2.5+, últimos 7 días|Mga lindol M2.5+, nakaraang 7 araw|M2.5以上の地震（過去7日間）|過去 7 天 M2.5+ 地震|지난 7일간 M2.5+ 지진|Động đất M2.5+, 7 ngày qua
AI summary|Resumen de IA|Buod ng AI|AI 要約|AI 摘要|AI 요약|Tóm tắt AI
County data readiness|Preparación de datos por condado|Kahandaan ng datos ng county|郡のデータ整備状況|各郡資料完備度|카운티 데이터 준비도|Mức sẵn sàng dữ liệu của quận
CMIST breakdown|Desglose CMIST|Paghahati ng CMIST|CMIST の内訳|CMIST 分項|CMIST 세부 내역|Phân tích CMIST
Medical dependence (emPOWER)|Dependencia médica (emPOWER)|Pag-asa sa medikal (emPOWER)|医療依存（emPOWER）|醫療依賴（emPOWER）|의료 의존(emPOWER)|Phụ thuộc y tế (emPOWER)
Data actions|Acciones sobre los datos|Mga aksyon sa datos|データに関する対応|資料待辦事項|데이터 조치|Việc cần làm về dữ liệu
Highest-need census tracts|Sectores censales con mayor necesidad|Mga census tract na pinakamataas ang pangangailangan|ニーズが最も高い国勢調査区|需求最高的普查區|필요도가 가장 높은 인구조사 구역|Khu điều tra có nhu cầu cao nhất
Decision points|Puntos de decisión|Mga punto ng pagpapasya|意思決定ポイント|決策點|의사결정 시점|Điểm quyết định
Planning assumptions|Supuestos de planificación|Mga palagay sa pagpaplano|計画上の前提|規劃假設|계획 가정|Giả định lập kế hoạch
Note|Nota|Tala|メモ|備註|메모|Ghi chú
+ Add widget|+ Añadir panel|+ Magdagdag ng widget|+ ウィジェットを追加|+ 新增小工具|+ 위젯 추가|+ Thêm tiện ích
Add a widget|Añadir un panel|Magdagdag ng widget|ウィジェットを追加|新增小工具|위젯 추가|Thêm tiện ích
Regenerate|Regenerar|Buuin muli|再生成|重新產生|다시 생성|Tạo lại
Event|Evento|Pangyayari|イベント|事件|이벤트|Sự kiện
Phase|Fase|Yugto|フェーズ|階段|단계|Giai đoạn
Area|Área|Lugar|地域|區域|지역|Khu vực
All of Hawaiʻi|Todo Hawaiʻi|Buong Hawaiʻi|ハワイ全域|全夏威夷|하와이 전체|Toàn Hawaiʻi
Statewide|Todo el estado|Buong estado|州全体|全州|주 전체|Toàn tiểu bang
Summarise the map|Resumir el mapa|Ibuod ang mapa|地図を要約|摘要地圖|지도 요약|Tóm tắt bản đồ
Brief my markup|Informar sobre mis anotaciones|Ipaliwanag ang aking mga marka|マークアップを説明|說明我的標記|내 표시 브리핑|Tóm lược phần đánh dấu
Biggest gaps|Mayores carencias|Pinakamalalaking kakulangan|最大の不足|最大缺口|가장 큰 부족분|Thiếu hụt lớn nhất
Clear|Borrar|I-clear|クリア|清除|지우기|Xóa
Ask|Preguntar|Magtanong|質問する|提問|질문|Hỏi
Select|Seleccionar|Pumili|選択|選取|선택|Chọn
Radius|Radio|Radius|半径|半徑|반경|Bán kính
Line|Línea|Linya|線|線段|선|Đường
Arrow|Flecha|Palaso|矢印|箭頭|화살표|Mũi tên
Draw|Dibujar|Gumuhit|描画|手繪|그리기|Vẽ
Title|Título|Pamagat|タイトル|標題|제목|Tiêu đề
Notes|Notas|Mga tala|メモ|備註|메모|Ghi chú
Point of contact|Persona de contacto|Taong makokontak|連絡窓口|聯絡窗口|담당 연락처|Đầu mối liên hệ
Name|Nombre|Pangalan|名前|姓名|이름|Tên
Role|Cargo|Tungkulin|役割|職務|역할|Vai trò
Phone|Teléfono|Telepono|電話|電話|전화|Điện thoại
Email|Correo electrónico|Email|メール|電子郵件|이메일|Email
Colour|Color|Kulay|色|顏色|색상|Màu
Size|Tamaño|Laki|サイズ|大小|크기|Kích thước
Delete|Eliminar|Burahin|削除|刪除|삭제|Xóa
Zoom to|Acercar|I-zoom|ズーム|縮放至|확대|Phóng tới
Export|Exportar|I-export|エクスポート|匯出|내보내기|Xuất
Import|Importar|I-import|インポート|匯入|가져오기|Nhập
Hazards|Peligros|Mga Panganib|ハザード|災害|위험 요소|Hiểm họa
Help & AFN support|Ayuda y apoyo AFN|Tulong at suportang AFN|支援と AFN サポート|協助與 AFN 支援|도움과 AFN 지원|Trợ giúp và hỗ trợ AFN
Refresh|Actualizar|I-refresh|更新|重新整理|새로 고침|Làm mới
Show on the map|Mostrar en el mapa|Ipakita sa mapa|地図に表示|在地圖上顯示|지도에 표시|Hiện trên bản đồ
Already in the plan.|Ya están en el plan.|Kasama na sa plano.|すでに計画の中に。|早已納入計畫。|이미 계획 안에.|Đã có trong kế hoạch.
ESF-6 mass care · access and functional needs|ESF-6 atención masiva · necesidades de acceso y funcionales|ESF-6 mass care · mga pangangailangan sa access at paggana|ESF-6 マスケア · アクセスおよび機能上のニーズ|ESF-6 大規模照護 · 無障礙與功能性需求|ESF-6 대규모 돌봄 · 접근 및 기능적 필요|ESF-6 chăm sóc đại chúng · nhu cầu tiếp cận và chức năng
Access and functional needs planning · Hawaiʻi|Planificación de necesidades de acceso y funcionales · Hawaiʻi|Pagpaplano para sa mga pangangailangan sa access at paggana · Hawaiʻi|アクセスおよび機能上のニーズの計画 · ハワイ|無障礙與功能性需求規劃 · 夏威夷|접근 및 기능적 필요 계획 · 하와이|Lập kế hoạch nhu cầu tiếp cận và chức năng · Hawaiʻi
When a hurricane, wildfire, tsunami or flood threatens Hawaiʻi, the people who need the most help should be in the plan before it arrives. AllReady brings together where residents with access and functional needs live, what each county’s shelters can support, and who acts when.|Cuando un huracán, incendio forestal, tsunami o inundación amenaza a Hawaiʻi, las personas que más ayuda necesitan deben estar en el plan antes de que llegue. AllReady reúne dónde viven los residentes con necesidades de acceso y funcionales, qué pueden ofrecer los refugios de cada condado y quién actúa en cada momento.|Kapag may bantang bagyo, wildfire, tsunami o baha sa Hawaiʻi, dapat kasama na sa plano ang mga taong pinakanangangailangan ng tulong bago pa ito dumating. Pinagsasama ng AllReady kung saan nakatira ang mga residenteng may pangangailangan sa access at paggana, kung ano ang kayang suportahan ng mga silungan ng bawat county, at kung sino ang kikilos at kailan.|ハリケーン、山火事、津波、洪水がハワイを脅かすとき、最も支援を必要とする人々は、災害が来る前に計画に含まれているべきです。AllReady は、アクセスおよび機能上のニーズのある住民がどこに住んでいるか、各郡の避難所が何に対応できるか、誰がいつ動くかを一つにまとめます。|當颶風、野火、海嘯或洪水威脅夏威夷時，最需要協助的人應該在災害來臨前就已納入計畫。AllReady 整合了有無障礙與功能性需求的居民住在哪裡、各郡避難所能提供什麼，以及由誰在何時行動。|허리케인, 산불, 쓰나미, 홍수가 하와이를 위협할 때 가장 도움이 필요한 사람들은 재난이 오기 전에 이미 계획에 들어 있어야 합니다. AllReady는 접근 및 기능적 필요가 있는 주민이 어디에 사는지, 각 카운티 대피소가 무엇을 지원할 수 있는지, 누가 언제 움직이는지를 한데 모읍니다.|Khi bão, cháy rừng, sóng thần hay lũ lụt đe dọa Hawaiʻi, những người cần giúp đỡ nhiều nhất phải có trong kế hoạch trước khi thiên tai tới. AllReady tập hợp nơi sinh sống của cư dân có nhu cầu tiếp cận và chức năng, khả năng hỗ trợ của nơi trú ẩn tại từng quận, và ai hành động vào lúc nào.
Who and where|Quién y dónde|Sino at saan|誰が、どこに|誰、在哪裡|누가, 어디에|Ai và ở đâu
What it takes|Qué se necesita|Ano ang kailangan|何が必要か|需要什麼|무엇이 필요한가|Cần những gì
Who acts|Quién actúa|Sino ang kikilos|誰が動くか|誰來行動|누가 움직이는가|Ai hành động
Residents by census tract across the CMIST needs: communication, medical, independence, safety and support, transportation.|Residentes por sector censal según las necesidades CMIST: comunicación, atención médica, independencia, seguridad y apoyo, transporte.|Mga residente ayon sa census tract sa mga pangangailangang CMIST: komunikasyon, medikal, kasarinlan, kaligtasan at suporta, transportasyon.|国勢調査区ごとの住民を CMIST のニーズ別に：コミュニケーション、医療、自立、安全と支援、交通手段。|依普查區呈現居民的 CMIST 需求：溝通、醫療、自主生活、安全與支持、交通。|인구조사 구역별 주민을 CMIST 필요 사항별로: 의사소통, 의료, 자립, 안전과 지원, 교통.|Cư dân theo khu điều tra dân số, theo các nhu cầu CMIST: giao tiếp, y tế, tự lập, an toàn và hỗ trợ, giao thông.
Shelter space, accessible space, power, water, transport and more, set against what the counties have on record.|Espacio de refugio, plazas accesibles, energía, agua, transporte y más, comparado con lo que los condados tienen registrado.|Espasyo sa silungan, accessible na puwesto, kuryente, tubig, transportasyon at iba pa, itinatapat sa nakatala ng mga county.|避難所の面積、バリアフリー枠、電力、水、輸送などを、各郡の記録と照らし合わせます。|避難所空間、無障礙名額、電力、飲水、交通等，與各郡現有紀錄相互對照。|대피소 공간, 접근 가능 자리, 전력, 물, 수송 등을 카운티 기록과 비교합니다.|Diện tích trú ẩn, chỗ tiếp cận được, điện, nước, vận chuyển và hơn nữa, đối chiếu với hồ sơ của các quận.
Counties lead mass care and the State supports. Decision points, contacts and an assistant that reads the live map.|Los condados dirigen la atención masiva y el Estado apoya. Puntos de decisión, contactos y un asistente que lee el mapa en vivo.|Ang mga county ang nangunguna sa mass care at sumusuporta ang Estado. Mga punto ng pagpapasya, mga kontak, at katulong na bumabasa ng live na mapa.|マスケアは郡が主導し、州が支援します。意思決定ポイント、連絡先、そしてライブ地図を読み取るアシスタント。|大規模照護由各郡主導、州政府支援。包含決策點、聯絡窗口，以及能讀取即時地圖的助理。|대규모 돌봄은 카운티가 주도하고 주가 지원합니다. 의사결정 시점, 연락처, 그리고 실시간 지도를 읽는 도우미.|Các quận chủ trì chăm sóc đại chúng, Tiểu bang hỗ trợ. Điểm quyết định, đầu mối liên hệ và trợ lý đọc bản đồ trực tiếp.
Scroll for each island’s current figures|Desplácese para ver las cifras actuales de cada isla|Mag-scroll para sa kasalukuyang bilang ng bawat isla|スクロールして各島の最新の数値を見る|向下捲動查看各島最新數據|스크롤하여 각 섬의 현재 수치 보기|Cuộn để xem số liệu hiện tại của từng đảo
Plan before the event.|Planifique antes del evento.|Magplano bago ang pangyayari.|災害の前に計画を。|在事件發生前先規劃。|재난 전에 계획하세요.|Lập kế hoạch trước khi sự kiện xảy ra.
Back to the top|Volver arriba|Bumalik sa itaas|トップに戻る|回到頂端|맨 위로|Về đầu trang
For planners|Para planificadores|Para sa mga tagaplano|計画担当者向け|給規劃人員|계획 담당자용|Dành cho người lập kế hoạch
Reading live feeds…|Leyendo datos en vivo…|Binabasa ang live na datos…|ライブデータを読み込み中…|正在讀取即時資料…|실시간 데이터 읽는 중…|Đang đọc dữ liệu trực tiếp…
Skip to content|Saltar al contenido|Lumaktaw sa nilalaman|本文へスキップ|跳至內容|본문으로 건너뛰기|Bỏ qua tới nội dung
Skip to the workspace|Saltar al área de trabajo|Lumaktaw sa workspace|ワークスペースへスキップ|跳至工作區|작업 영역으로 건너뛰기|Bỏ qua tới vùng làm việc
Skip to the dashboard|Saltar al panel|Lumaktaw sa dashboard|ダッシュボードへスキップ|跳至儀表板|대시보드로 건너뛰기|Bỏ qua tới bảng điều khiển
Language|Idioma|Wika|言語|語言|언어|Ngôn ngữ
ESF-6 planning|Planificación ESF-6|Pagpaplano ng ESF-6|ESF-6 計画|ESF-6 規劃|ESF-6 계획|Lập kế hoạch ESF-6
County-led, State-supported|Dirigido por los condados, con apoyo del Estado|Pinangungunahan ng county, suportado ng Estado|郡が主導、州が支援|各郡主導、州政府支援|카운티 주도, 주 지원|Quận chủ trì, Tiểu bang hỗ trợ
Add|Añadir|Idagdag|追加|新增|추가|Thêm
Public data only|Solo datos públicos|Pampublikong datos lamang|公開データのみ|僅使用公開資料|공개 데이터만 사용|Chỉ dữ liệu công khai
no PII|sin datos personales|walang personal na impormasyon|個人情報なし|不含個資|개인정보 없음|không có thông tin cá nhân
Reading data…|Leyendo datos…|Binabasa ang datos…|データを読み込み中…|正在讀取資料…|데이터 읽는 중…|Đang đọc dữ liệu…
Re-read all data sources now|Volver a leer todas las fuentes ahora|Basahin muli ang lahat ng pinagmulan ngayon|すべてのデータソースを今すぐ再読み込み|立即重新讀取所有資料來源|모든 데이터 출처 지금 다시 읽기|Đọc lại tất cả nguồn dữ liệu ngay
`;

const DICT = new Map();
for (const line of TABLE.trim().split("\n")) {
  const c = line.split("|");
  if (c.length === 7) DICT.set(c[0], Object.fromEntries(ORDER.map((k, i) => [k, c[i + 1]])));
}

// Short phrases that carry a live value. $1 is the value, left untouched.
const PATTERNS = [
  [/^Data read (.+)$/, { es: "Datos leídos a las $1", tl: "Nabasa ang datos noong $1", ja: "データ読み込み $1", "zh-Hant": "資料讀取時間 $1", ko: "데이터 읽은 시각 $1", vi: "Dữ liệu đọc lúc $1" }],
  [/^(\d[\d,]*) active$/, { es: "$1 activas", tl: "$1 aktibo", ja: "$1 件発令中", "zh-Hant": "$1 則生效中", ko: "$1건 발효 중", vi: "$1 đang có hiệu lực" }],
  [/^(\d[\d,]*) tracts$/, { es: "$1 sectores censales", tl: "$1 census tract", ja: "$1 国勢調査区", "zh-Hant": "$1 個普查區", ko: "인구조사 구역 $1개", vi: "$1 khu điều tra" }],
];

const KEY = "allready.lang";
let cur = "en";
try { const v = localStorage.getItem(KEY); if (LANGS.some(([k]) => k === v)) cur = v; } catch {}
export const getLang = () => cur;

const SRC = new WeakMap(); // text node -> its English original
const ATTRS = ["placeholder", "title", "aria-label"];
const norm = (s) => s.replace(/\s+/g, " ").trim();

/** Translate one string. Unknown phrases pass through; "A · B" is translated part by part. */
function tr(en) {
  if (cur === "en") return en;
  const k = norm(en);
  if (!k) return en;
  const hit = DICT.get(k);
  if (hit) return en.replace(k, hit[cur]);
  for (const [re, t] of PATTERNS) if (re.test(k)) return k.replace(re, t[cur]);
  if (k.includes(" · ")) {
    const parts = k.split(" · ");
    if (parts.some((p) => DICT.has(p))) return parts.map((p) => DICT.get(p)?.[cur] ?? p).join(" · ");
  }
  return en;
}

function textNode(n) {
  // If the app rewrote the node, what is there now is the new English original.
  const prev = SRC.get(n);
  if (!prev || (n.nodeValue !== prev.out && n.nodeValue !== prev.en)) SRC.set(n, { en: n.nodeValue, out: n.nodeValue });
  const rec = SRC.get(n), out = tr(rec.en);
  rec.out = out;
  if (n.nodeValue !== out) n.nodeValue = out;
}
function element(el) {
  for (const a of ATTRS) {
    if (!el.hasAttribute(a)) continue;
    const store = "data-en-" + a, now = el.getAttribute(a);
    const en = el.getAttribute(store);
    const base = en != null && (now === en || now === tr(en)) ? en : now;
    if (cur !== "en" || en != null) el.setAttribute(store, base);
    const out = tr(base);
    if (now !== out) el.setAttribute(a, out);
  }
}
function walk(root) {
  if (root.nodeType === 3) return root.parentElement?.closest("[data-notranslate], .ai-msg, .ai-out, textarea, .maplibregl-map") ? undefined : textNode(root);
  if (root.nodeType !== 1 || /^(SCRIPT|STYLE|TEXTAREA|CANVAS|SVG)$/i.test(root.tagName) || root.closest?.("[data-notranslate], .ai-msg, .ai-out, .maplibregl-map")) return;
  element(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (n) => (n.nodeType === 1 && (/^(SCRIPT|STYLE|TEXTAREA|CANVAS|svg)$/i.test(n.tagName) || n.matches?.("[data-notranslate], .ai-msg, .ai-out, .maplibregl-map")) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = w.nextNode(); n; n = w.nextNode()) n.nodeType === 3 ? textNode(n) : element(n);
}

let observer = null, busy = false;
function apply() {
  busy = true;
  document.documentElement.lang = cur;
  walk(document.body);
  busy = false;
}
export function setLang(l) {
  cur = LANGS.some(([k]) => k === l) ? l : "en";
  try { localStorage.setItem(KEY, cur); } catch {}
  apply();
}

/** Put the language picker in `host` and start translating the page. */
export function mountLanguage(host) {
  if (host) {
    const label = document.createElement("label");
    label.className = "lang";
    const sr = document.createElement("span"); sr.className = "sr"; sr.textContent = "Language";
    const sel = document.createElement("select");
    sel.className = "sel"; sel.setAttribute("data-notranslate", "");
    for (const [k, n] of LANGS) { const o = document.createElement("option"); o.value = k; o.textContent = n; o.lang = k; sel.append(o); }
    sel.value = cur;
    sel.addEventListener("change", () => setLang(sel.value));
    label.append(sr, sel);
    host.replaceChildren(label);
  }
  apply();
  // Panels re-render constantly with live data; translate whatever appears.
  observer = new MutationObserver((muts) => {
    if (busy) return;
    busy = true;
    for (const m of muts) {
      if (m.type === "characterData") { if (!m.target.parentElement?.closest("[data-notranslate], .ai-msg, .ai-out, textarea")) textNode(m.target); }
      else if (m.type === "attributes") element(m.target);
      else m.addedNodes.forEach(walk);
    }
    busy = false;
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

/** How much of the visible interface the current language covers — used by the self-check. */
export function coverage() {
  let total = 0, done = 0;
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const rec = SRC.get(n); if (!rec || !/[A-Za-z]{3}/.test(rec.en) || !n.parentElement?.offsetParent) continue;
    total++; if (rec.out !== rec.en) done++;
  }
  return { total, done };
}
