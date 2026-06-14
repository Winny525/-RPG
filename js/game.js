/* ============================================================
   RPG Klimov Profiler — game.js (обновлённый)
   Pure HTML/CSS/JS, no frameworks.

   Изменения по требованиям:
   1) Герой на canvas в 1.5 раза больше + тень под ногами.
   2) Иконки квестов заменены на спрайты NPC (эмоции) из папок квестN.
      - до взятия: грустный.png
      - после завершения: весёлый.png
      - пока активен: аватар.png в диалоге
      Спрайты подгружаются динамически (lazy-load) без перезагрузки страницы.
   3) Новая система перемещения:
      - одна главная локация (главная_локация.png)
      - невидимые зоны входа/выхода из конфига (внутри buildings)
      - переход в здания по приближению < 20 px к прямоугольнику
      - на внутренних локациях — спрайты NPC и диалоги

   Сохранено:
   - логика диалогов, вариантов ответа, подсчёт баллов по типам Климова
   ============================================================ */

'use strict';

/* ============================================================
   SECTION A — Config & Constants
   ============================================================ */

// База ассетов относительно файла rpg/js/game.js.
// (Код уже работает с таким путём в исходной версии.)
// Важно: URL в браузере резолвится относительно index.html (а не относительно game.js).
// Поэтому путь должен указывать на папку "rpg/Картинки" относительно rpg/index.html.
const ASSET_BASE = 'Картинки';

/** Hero sprite paths — directional animation sprites */
const HERO_SPRITES = {
  male: {
    down:  { idle: ASSET_BASE + '/персонаж/главный герой/вниз стоит.png',  walk1: ASSET_BASE + '/персонаж/главный герой/вниз идет 1.png',  walk2: ASSET_BASE + '/персонаж/главный герой/вниз идет 2.png' },
    up:    { idle: ASSET_BASE + '/персонаж/главный герой/вверх стоит.png', walk1: ASSET_BASE + '/персонаж/главный герой/вверх идет 1.png', walk2: ASSET_BASE + '/персонаж/главный герой/вверх идет 2.png' },
    left:  { idle: ASSET_BASE + '/персонаж/главный герой/влево стоит.png', walk1: ASSET_BASE + '/персонаж/главный герой/влево идет 1.png', walk2: ASSET_BASE + '/персонаж/главный герой/влево идет 2.png' },
    right: { idle: ASSET_BASE + '/персонаж/главный герой/вправо стоит.png',walk1: ASSET_BASE + '/персонаж/главный герой/вправо идет 1.png',walk2: ASSET_BASE + '/персонаж/главный герой/вправо идет 2.png' }
  },
  female: {
    down:  { idle: ASSET_BASE + '/персонаж/главная героиня/вниз стоит.png',  walk1: ASSET_BASE + '/персонаж/главная героиня/вниз идет 1.png',  walk2: ASSET_BASE + '/персонаж/главная героиня/вниз идет 2.png' },
    up:    { idle: ASSET_BASE + '/персонаж/главная героиня/вверх стоит.png', walk1: ASSET_BASE + '/персонаж/главная героиня/вверх идет 1.png', walk2: ASSET_BASE + '/персонаж/главная героиня/вверх идет 2.png' },
    left:  { idle: ASSET_BASE + '/персонаж/главная героиня/влево стоит.png', walk1: ASSET_BASE + '/персонаж/главная героиня/влево идет 1.png', walk2: ASSET_BASE + '/персонаж/главная героиня/влево идет 2.png' },
    right: { idle: ASSET_BASE + '/персонаж/главная героиня/вправо стоит.png',walk1: ASSET_BASE + '/персонаж/главная героиня/вправо идет 1.png',walk2: ASSET_BASE + '/персонаж/главная героиня/вправо идет 2.png' }
  }
};

/** Background images */
const LOCATION_IMAGES = {
  // Файл в проекте называется "главный экран.png"
  main: ASSET_BASE + '/локации/главный экран.png',

  // Фон зданий (можно заменить на любые другие png в конфигах buildings ниже)
  promz: ASSET_BASE + '/локации/промзона.png',
  culture: ASSET_BASE + '/локации/культурный квартал.png',
  office: ASSET_BASE + '/локации/офисный центр.png',
  science: ASSET_BASE + '/локации/научный центр.png',
  nature: ASSET_BASE + '/локации/природная зона.png',
  hospital: ASSET_BASE + '/локации/больница.png'
};

/** Movement & animation constants */
// Скорость перемещения (в пикселях/сек).
// Зависимость от расстояния отсутствует: время пути зависит только от дистанции.
const MOVE_SPEED_PX_PER_SEC = 180;

// 1) Базовый герой: 1.5 раза больше, чем был.
const HERO_BASE_W = 56;
const HERO_BASE_H = 84;

// ПК/мобайл адаптация.
// Важно: на мобиле/ПК полагаться не только на pointer:coarse.
const IS_MOBILE_UA =
  (typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent));

const IS_MOBILE_SCREEN =
  (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 768px)').matches);

const IS_MOBILE = IS_MOBILE_UA || IS_MOBILE_SCREEN;

// Базовый масштаб героя.
// Требование: увеличить размер персонажей ещё в 1.5 раза.
// Было 2.25 => 2.25 * 1.5 = 3.375.
const HERO_SCALE_BASE = 3.375;

// Требование:
// - Mobile: уменьшить персонажа в 2 раза
// - PC: увеличить только НПС в 2 раза (герой не увеличивается относительно PC)
const HERO_PLATFORM_MULT = IS_MOBILE ? 0.5 : 1;

// NPC масштаб — независим от размера героя, чтобы уменьшение героя на mobile
// не делало НПС меньше.
const NPC_MULT = IS_MOBILE ? 1 : 2;

// Размеры героя (с учётом ранее сделанного уменьшения высоты в /2).
const HERO_W = Math.round(HERO_BASE_W * HERO_SCALE_BASE * HERO_PLATFORM_MULT);
const HERO_H = Math.round((HERO_BASE_H * HERO_SCALE_BASE * HERO_PLATFORM_MULT) / 2);

// Базовые размеры для НПС (без HERO_PLATFORM_MULT, но с уменьшением высоты /2).
const NPC_H_BASE = Math.round((HERO_BASE_H * HERO_SCALE_BASE) / 2);
const NPC_W_BASE = Math.round(HERO_BASE_W * HERO_SCALE_BASE);

// Фракции для proximity к NPC (как в исходной версии).
const NPC_TRIGGER_FRAC = 0.09;

const FADE_DURATION_MS = 400;
const WALK_CYCLE_MS = 400;

// Чтобы не было “мгновенного” входа в здание из стартовой позиции на карте.
// Герой должен сначала заметно сместиться.
const MIN_MOVE_BEFORE_MAIN_ENTRY_PX = 25;

// NPC placement editor
const NPC_EDITOR_STORAGE_KEY = 'rpg_npc_overrides_v1';
const NPC_EDITOR_SNAP_PX = 45;

// Размеры тени на canvas для anchor-точки ног героя.
const HERO_SHADOW_RX = HERO_W * 0.35;
const HERO_SHADOW_RY = 4; // высота тени: 8px
const HERO_SHADOW_OFFSET_Y = HERO_SHADOW_RY; // верх тени касается ног (anchor ног = y=0)

// Мини-плейсхолдер для отсутствующих картинок эмоций.
const FALLBACK_SVG_SRC =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">' +
    '<rect width="100%" height="100%" fill="rgba(30,30,30,0.6)"/>' +
    '<circle cx="80" cy="80" r="56" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" stroke-width="4"/>' +
    '<text x="80" y="92" text-anchor="middle" font-size="34" font-family="Arial" fill="rgba(255,255,255,0.55)">?</text>' +
    '</svg>'
  );

/* ============================================================
   SECTION B — QuestDataLoader
   ============================================================ */

async function loadQuestData(url = 'quests.json') {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[QuestLoader] fetch failed, trying inline fallback:', err.message);
    const el = document.getElementById('quest-data-fallback');
    const raw = el ? el.textContent.trim() : '';
    if (raw && raw.length > 2) {
      return JSON.parse(raw);
    }
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.onload = () => {
        if (xhr.status === 200 || xhr.status === 0) {
          try { resolve(JSON.parse(xhr.responseText)); }
          catch (e) { reject(e); }
        } else {
          reject(new Error('XHR failed: ' + xhr.status));
        }
      };
      xhr.onerror = () => reject(new Error('XHR error'));
      xhr.send();
    });
  }
}

/* ============================================================
   SECTION C — GameState
   ============================================================ */

class GameState {
  constructor() {
    this.reset();
  }

  reset() {
    this.scores = { Ч: 0, Т: 0, П: 0, З: 0, Х: 0 };

    // completedQuests: квест сдан
    this.completedQuests = new Set();

    // takenQuests: квест взят (открывали диалог), но ещё не сдан
    this.takenQuests = new Set();

    this.currentLocation = 'main';

    this.heroGender = 'male';

    // Hero position as fraction [0..1] of canvas dimensions.
    // Anchor: ног (bottom-center), чтобы shadow можно было “прижать” к ногам.
    this.heroX = 0.5;
    this.heroY = 0.75;

    this.targetX = 0.5;
    this.targetY = 0.75;

    this.heroDirection = 'down';

    this.moveStartTime = 0;
  }

  addScore(type, points) {
    if (this.scores[type] !== undefined) {
      this.scores[type] += points;
    }
  }

  markQuestTaken(questId) {
    this.takenQuests.add(questId);
  }

  markQuestDone(questId) {
    this.completedQuests.add(questId);
    this.takenQuests.delete(questId);
  }

  unmarkQuestTaken(questId) {
    this.takenQuests.delete(questId);
  }

  isQuestDone(questId) {
    return this.completedQuests.has(questId);
  }

  isQuestTaken(questId) {
    return this.takenQuests.has(questId);
  }

  get totalDone() {
    return this.completedQuests.size;
  }
}

/* ============================================================
   SECTION D — Locations Config (Main + Buildings)
   ============================================================ */

/**
 * Конфиг невидимых зон входа/выхода.
 * Координаты x,y,w,h — фракции [0..1] от текущего canvas размера.
 * Прямоугольник задаётся центром (x,y) и размерами (w,h).
 *
 * Как задавать:
 * - entryMain: зона входа на главной карте (в какой области подходить)
 * - entryBuilding: точка/зона входа внутри здания (куда спавнить героя)
 * - exitBuilding: зона выхода внутри здания
 * - exitMain: куда возвращать героя на главную карту (обычно центр входа)
 */
const MAIN_LOCATION_CFG = {
  id: 'main',
  name: 'Главная',
  image: LOCATION_IMAGES.main,
  // Порог приближения (px) до прямоугольника.
  // Сделано больше, чтобы по зоне было проще попадать.
  enterExitProximityPx: 35
};

// Единая зона выхода для всех вторичных локаций.
// Координаты задаются в фракциях [0..1] от canvas.
// По конфигу buildings ранее выходы были около x~0.48, y~0.92.
const EXIT_ZONE_SECONDARY = {
  x: 0.5,
  y: 0.92,
  w: 0.18,
  h: 0.11
};

const BUILDINGS = [
  {
    id: 'промзона',
    name: 'Промышленная зона',
    image: LOCATION_IMAGES.promz,
    questIds: [1, 2, 3, 4],
    // Слева чуть ниже середины.
    entryMain: { x: 0.25, y: 0.58, w: 0.14, h: 0.20 },
    // Непроходимая зона здания на главной локации (смещена ВВЕРХ относительно входа).
    // Координаты — в долях от размеров canvas.
    mainBlockRect: { x: 0.25, y: 0.52, w: 0.16, h: 0.16 },
    entryBuilding: { x: 0.5, y: 0.72, w: 0.10, h: 0.10 },
    exitBuilding: { x: 0.48, y: 0.92, w: 0.08, h: 0.08 },
    exitMain: { x: 0.25, y: 0.58, w: 0.14, h: 0.20 },
    npcs: [
      { questId: 1, x: 0.20, y: 0.55 },
      { questId: 2, x: 0.42, y: 0.45 },
      { questId: 3, x: 0.62, y: 0.60 },
      { questId: 4, x: 0.80, y: 0.50 }
    ]
  },
  {
    id: 'культурный квартал',
    name: 'Культурный квартал',
    image: LOCATION_IMAGES.culture,
    questIds: [5, 6, 7, 8],
    // Между больницей и офисом, чуть выше их уровня.
    // Подняли вход ещё выше (ближе к краю картинки, чем к середине).
    entryMain: { x: 0.50, y: 0.27, w: 0.14, h: 0.10 },
    // Здание находится над входом.
    mainBlockRect: { x: 0.50, y: 0.23, w: 0.16, h: 0.12 },
    entryBuilding: { x: 0.5, y: 0.72, w: 0.10, h: 0.10 },
    exitBuilding: { x: 0.48, y: 0.92, w: 0.08, h: 0.08 },
    exitMain: { x: 0.50, y: 0.27, w: 0.14, h: 0.10 },
    npcs: [
      { questId: 5, x: 0.18, y: 0.50 },
      { questId: 6, x: 0.40, y: 0.42 },
      { questId: 7, x: 0.60, y: 0.55 },
      { questId: 8, x: 0.80, y: 0.48 }
    ]
  },
  {
    id: 'офисный центр',
    name: 'Офисный центр',
    image: LOCATION_IMAGES.office,
    questIds: [9, 10, 11],
    // Над научным центром на том же уровне, что и больница.
    // Чуть ближе к центру.
    entryMain: { x: 0.82, y: 0.42, w: 0.14, h: 0.20 },
    // Здание выше входа.
    mainBlockRect: { x: 0.82, y: 0.36, w: 0.16, h: 0.16 },
    entryBuilding: { x: 0.5, y: 0.72, w: 0.10, h: 0.10 },
    exitBuilding: { x: 0.48, y: 0.92, w: 0.08, h: 0.08 },
    exitMain: { x: 0.82, y: 0.42, w: 0.14, h: 0.20 },
    npcs: [
      { questId: 9, x: 0.25, y: 0.52 },
      { questId: 10, x: 0.50, y: 0.45 },
      { questId: 11, x: 0.75, y: 0.55 }
    ]
  },
  {
    id: 'научный центр',
    name: 'Научный центр',
    image: LOCATION_IMAGES.science,
    questIds: [12, 13, 14],
    // Справа на том же уровне что и промзона.
    entryMain: { x: 0.75, y: 0.58, w: 0.14, h: 0.20 },
    // Здание находится над входом.
    mainBlockRect: { x: 0.75, y: 0.52, w: 0.16, h: 0.16 },
    entryBuilding: { x: 0.5, y: 0.72, w: 0.10, h: 0.10 },
    exitBuilding: { x: 0.48, y: 0.92, w: 0.08, h: 0.08 },
    exitMain: { x: 0.75, y: 0.58, w: 0.14, h: 0.20 },
    npcs: [
      { questId: 12, x: 0.22, y: 0.50 },
      { questId: 13, x: 0.50, y: 0.48 },
      { questId: 14, x: 0.76, y: 0.53 }
    ]
  },
  {
    id: 'природная зона',
    name: 'Природная зона',
    image: LOCATION_IMAGES.nature,
    questIds: [15, 16, 17],
    // В нижней области посередине.
    // Опустили пониже.
    entryMain: { x: 0.50, y: 0.86, w: 0.14, h: 0.20 },
    // ВАЖНО: по требованию природная зона находится НИЖЕ входа,
    // поэтому блок смещён ВНИЗ относительно entryMain.
    mainBlockRect: { x: 0.50, y: 0.92, w: 0.16, h: 0.14 },
    entryBuilding: { x: 0.5, y: 0.72, w: 0.10, h: 0.10 },
    exitBuilding: { x: 0.48, y: 0.92, w: 0.08, h: 0.08 },
    exitMain: { x: 0.50, y: 0.86, w: 0.14, h: 0.20 },
    npcs: [
      { questId: 15, x: 0.20, y: 0.55 },
      { questId: 16, x: 0.50, y: 0.45 },
      { questId: 17, x: 0.78, y: 0.58 }
    ]
  },
  {
    id: 'больница',
    name: 'Больница',
    image: LOCATION_IMAGES.hospital,
    questIds: [18, 19, 20],
    // Над промзоной, на равном расстоянии от промзоны до левого края.
    // Чуть ближе к центру.
    entryMain: { x: 0.18, y: 0.42, w: 0.14, h: 0.20 },
    // Здание выше входа.
    mainBlockRect: { x: 0.18, y: 0.36, w: 0.16, h: 0.16 },
    entryBuilding: { x: 0.5, y: 0.72, w: 0.10, h: 0.10 },
    exitBuilding: { x: 0.48, y: 0.92, w: 0.08, h: 0.08 },
    exitMain: { x: 0.18, y: 0.42, w: 0.14, h: 0.20 },
    npcs: [
      { questId: 18, x: 0.22, y: 0.52 },
      { questId: 19, x: 0.52, y: 0.45 },
      { questId: 20, x: 0.78, y: 0.55 }
    ]
  }
];

/* ============================================================
   SECTION E — AssetLoader (dynamic images)
   ============================================================ */

class AssetLoader {
  constructor() {
    this._imageCache = new Map(); // key -> { promise, img }
  }

  loadImage(src) {
    if (!src) return Promise.resolve(null);
    const key = src;
    const existing = this._imageCache.get(key);
    if (existing && existing.img) return Promise.resolve(existing.img);
    if (existing && existing.promise) return existing.promise;

    const p = new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        this._imageCache.set(key, { promise: null, img });
        resolve(img);
      };
      img.onerror = () => {
        // Cache negative result to avoid repeated fetches.
        this._imageCache.set(key, { promise: null, img: null });
        resolve(null);
      };
      img.src = src;
    });

    this._imageCache.set(key, { promise: p, img: null });
    return p;
  }
}

function getQuestNpcEmotionSrc(questId, emotion) {
  // Требование: папка квестN, где N = id квеста.
  // Текущая структура проекта: Картинки/НПС/квестN/файл.png
  const folder = ASSET_BASE + '/НПС/квест' + questId + '/';
  const filename = emotion === 'sad' ? 'грустный.png'
    : emotion === 'happy' ? 'весёлый.png'
      : 'аватар.png';
  return folder + filename;
}

/* ============================================================
   SECTION F — SpriteAnimator
   ============================================================ */

class SpriteAnimator {
  constructor() {
    this._cycleTime = 0;
  }

  getFrame(elapsedMs) {
    const t = elapsedMs % WALK_CYCLE_MS;
    const phase = t / WALK_CYCLE_MS;
    if (phase < 0.2) return 'idle';
    if (phase < 0.4) return 'walk1';
    if (phase < 0.6) return 'idle';
    if (phase < 0.8) return 'walk2';
    return 'idle';
  }

  reset() {
    this._cycleTime = 0;
  }
}

/* ============================================================
   SECTION G — Renderer
   ============================================================ */

class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {HTMLImageElement} locationImg
   */
  constructor(canvas, locationImg) {
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._locImg = locationImg;

    this._heroSprites = {};

    // questId -> { sad, happy, avatar } where each is HTMLImageElement|null
    this._npcImgMap = {};

    this._animator = new SpriteAnimator();

    // Camera translation in canvas pixels.
    // Moves BOTH background image and canvas so hero remains centered.
    this._camTx = 0;
    this._camTy = 0;
    this._overflowX = 0;
    this._overflowY = 0;

    // Scene rect (image area) in canvas pixels for object-fit: contain.
    // We treat hero/npc coordinates as fractions relative to the image.
    this._sceneOffX = 0;
    this._sceneOffY = 0;
    this._sceneW = 0;
    this._sceneH = 0;
  }

  setHeroSprites(sprites) {
    this._heroSprites = sprites;
  }

  setNpcImages(map) {
    this._npcImgMap = map;
  }

  syncSize() {
    // В некоторых ситуациях boundingClientRect у location-img может быть 0,
    // когда экран только показали. Берём размеры у контейнера.
    const container = document.getElementById('game-world');
    const rect = (container ? container.getBoundingClientRect() : null) || this._locImg.getBoundingClientRect();

    // fallback: clientWidth/clientHeight надёжнее в некоторых layout-сценариях.
    const w0 = rect && rect.width ? rect.width : 0;
    const h0 = rect && rect.height ? rect.height : 0;
    const w1 = container && container.clientWidth ? container.clientWidth : 0;
    const h1 = container && container.clientHeight ? container.clientHeight : 0;

    // самый последний fallback: размеры окна
    const w2 = window.innerWidth || 800;
    const h2 = (window.innerHeight || 600) - 48;

    const w = w0 || w1 || w2;
    const h = h0 || h1 || h2;
    if (!w || !h) return;

    // Устанавливаем атрибуты canvas (в пикселях буфера), чтобы draw работал.
    const bw = Math.max(1, Math.floor(w));
    const bh = Math.max(1, Math.floor(h));
    if (this._canvas.width !== bw) this._canvas.width = bw;
    if (this._canvas.height !== bh) this._canvas.height = bh;
    this._canvas.style.width = w + 'px';
    this._canvas.style.height = h + 'px';

    // Compute cover overflow so camera translation doesn't reveal blank borders.
    // #location-img uses object-fit: cover.
    const iw = this._locImg?.naturalWidth || w;
    const ih = this._locImg?.naturalHeight || h;
    // Исходное поведение: #location-img использует object-fit: cover,
    // но логика canvas ранее рассчитывала scene-область через contain.
    // Возвращаем исходный масштаб.
    const scale = Math.min(w / iw, h / ih);
    const sceneW = iw * scale;
    const sceneH = ih * scale;
    this._sceneOffX = (w - sceneW) / 2;
    this._sceneOffY = (h - sceneH) / 2;
    this._sceneW = sceneW;
    this._sceneH = sceneH;

    // overflow* kept for backward compatibility; not used for scene mapping.
    this._overflowX = 0;
    this._overflowY = 0;

    // Canvas рисуется в "экранных" координатах с учётом cameraTx/cameraTy,
    // поэтому transform холста не нужен.
    this._canvas.style.transform = 'translate(0px, 0px)';
  }

  get cw() { return this._canvas.width || 800; }
  get ch() { return this._canvas.height || 600; }

  // Scene <-> canvas pixel mapping.
  sceneXToCanvasPx(xFr) {
    return this._sceneOffX + xFr * this._sceneW;
  }
  sceneYToCanvasPx(yFr) {
    return this._sceneOffY + yFr * this._sceneH;
  }
  canvasPxToSceneX(px) {
    if (this._sceneW <= 0) return 0.5;
    return clamp((px - this._sceneOffX) / this._sceneW, 0, 1);
  }
  canvasPxToSceneY(py) {
    if (this._sceneH <= 0) return 0.5;
    return clamp((py - this._sceneOffY) / this._sceneH, 0, 1);
  }

  render(state, locationCfg, animTime) {
    const ctx = this._ctx;

    // Если canvas ещё не получил реальные размеры (width/height=0),
    // дождаться размера можно только через syncSize().
    if (this._canvas.width === 0 || this._canvas.height === 0) {
      this.syncSize();
    }
    ctx.clearRect(0, 0, this.cw, this.ch);

    // Camera follow: keep hero centered on screen.
    const { tx, ty } = this._computeCameraOffset(state.heroX, state.heroY);
    this._camTx = tx;
    this._camTy = ty;

    // Move background (map) by camera shift.
    // Canvas is rendered with camera offsets in draw functions.
    this._locImg.style.transform = `translate(${-this._camTx}px, ${-this._camTy}px)`;

    if (locationCfg && locationCfg.id !== 'main') {
      this._drawNPCSprites(locationCfg, state, animTime);
    }

    this._drawHero(state, animTime);
    this._drawClickTarget(state);
  }

  _drawHero(state, animTime) {
    const ctx = this._ctx;

    // NOTE: Раньше здесь был debug-маркер (зелёный круг), который мешал.
    // Если нужен отладочный маркер — включайте вручную через флаг в консоли.
    if (window.__RPG_DEBUG_HERO_MARK === true) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = 'lime';
      ctx.beginPath();
      ctx.arc(this.cw / 2, this.ch / 2, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const spriteSet = this._heroSprites[state.heroGender];
    if (!spriteSet) {
      // Маркер в центре canvas, чтобы видеть вызов отрисовки героя.
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = 'rgba(0,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(this.cw / 2, this.ch / 2, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    // Защита от ситуаций, когда heroDirection не инициализирован/содержит неожиданное значение.
    const directionSprites = spriteSet[state.heroDirection] || spriteSet.down;
    if (!directionSprites) return;

    const px = this.sceneXToCanvasPx(state.heroX) - this._camTx;
    const py = this.sceneYToCanvasPx(state.heroY) - this._camTy;

    const isMoving = Math.abs(state.heroX - state.targetX) > 0.003 ||
      Math.abs(state.heroY - state.targetY) > 0.003;

    let frameKey = 'idle';
    if (isMoving) {
      const elapsed = animTime - state.moveStartTime;
      frameKey = this._animator.getFrame(elapsed);
    }

    const img = directionSprites[frameKey];
    const isImgLoaded = (el) => {
      // HTMLImageElement: naturalWidth===0 означает, что фактически не загружено.
      if (!el) return false;
      if (el instanceof HTMLImageElement) {
        return el.complete && el.naturalWidth > 0;
      }
      return true;
    };

    if (!isImgLoaded(img)) {
      // Диагностический маркер: если герой не отрисовался из-за отсутствия/незагруженного спрайта.
      ctx.save();
      ctx.translate(px, py);
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = 'rgba(255, 0, 0, 0.85)';
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(px, py);

    // 1) Тень под ногами: anchor ног героя = (0,0).
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(0, HERO_SHADOW_OFFSET_Y, HERO_SHADOW_RX, HERO_SHADOW_RY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Спрайт anchor-bottom: низ спрайта = y=0.
    ctx.drawImage(img, -HERO_W / 2, -HERO_H, HERO_W, HERO_H);
    ctx.restore();
  }

  _drawNPCSprites(locationCfg, state, animTime) {
    const ctx = this._ctx;
    const npcs = locationCfg.npcs || [];

    npcs.forEach(npc => {
      const questId = npc.questId;
      const x = this.sceneXToCanvasPx(npc.x) - this._camTx;
      const yFeet = this.sceneYToCanvasPx(npc.y) - this._camTy;

      // Optional debug: show questId markers.
      const debugNpc = (window.__RPG_DEBUG_NPCS === true);

      // Эмоция на карте:
      // - done -> happy
      // - active или not taken -> sad (нейтральный вариант — на усмотрение, выбрано sad)
      const emotion = state.isQuestDone(questId) ? 'happy' : 'sad';

      const imgs = this._npcImgMap[questId] || {};
      const img = (emotion === 'happy' ? imgs.happy : imgs.sad) || null;

      const bob = Math.sin(animTime / 600 + questId) * 3;

      if (img) {
        // Рисуем с сохранением пропорций.
        const aspect = (img.width && img.height) ? (img.width / img.height) : 1;
        // НПС масштабируются отдельно от героя.
        // Mobile: персонаж уменьшается (/2), НПС остаются базовыми.
        // PC: НПС увеличиваются в 2 раза.
        const npcHeroH = NPC_H_BASE * NPC_MULT;
        const npcHeroW = NPC_W_BASE * NPC_MULT;

        const maxH = npcHeroH * 0.62;
        const drawH = Math.min(maxH, img.height ? maxH : maxH);
        const drawW = drawH * aspect;
        // Доп. ограничение по ширине на случай “широких” ассетов.
        const maxW = npcHeroW * 0.9;
        const finalW = Math.min(drawW, maxW);
        const finalH = finalW / (aspect || 1);

        ctx.save();
        ctx.globalAlpha = 0.98;
        ctx.drawImage(img, x - finalW / 2, yFeet - finalH + bob, finalW, finalH);
        ctx.restore();
      } else {
      // Fallback: старая визуальная метка, если спрайт эмоции не найден.
        const markerR = 22 * NPC_MULT;
        const alpha = 0.15 + 0.07 * Math.sin(animTime / 400 + questId);

        ctx.save();
        // glow
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(x, yFeet + bob, markerR + 10, 0, Math.PI * 2);
        ctx.fill();

        // circle
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#1a1200';
        ctx.beginPath();
        ctx.arc(x, yFeet + bob, markerR, 0, Math.PI * 2);
        ctx.fill();

        // border
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#ffd700';
        ctx.font = `bold ${Math.round(26 * NPC_MULT)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', x, yFeet + bob);

        ctx.restore();
      }

      if (debugNpc) {
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = 'rgba(255,0,0,0.85)';
        ctx.beginPath();
        ctx.arc(x, yFeet + bob, 6 * NPC_MULT, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.font = `${Math.round(12 * NPC_MULT)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(String(questId), x, yFeet + bob - 8 * NPC_MULT);
        ctx.restore();
      }
    });
  }

  _drawClickTarget(state) {
    const dx = state.targetX - state.heroX;
    const dy = state.targetY - state.heroY;
    if (Math.sqrt(dx * dx + dy * dy) < 0.015) return;

    const ctx = this._ctx;
    const tx = this.sceneXToCanvasPx(state.targetX) - this._camTx;
    const ty = this.sceneYToCanvasPx(state.targetY) - this._camTy;

    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(tx, ty, 6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(tx, ty, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _computeCameraOffset(heroX, heroY) {
    // Hero position is in scene-image coords: heroX/heroY fractions.
    const heroPxX = this.sceneXToCanvasPx(heroX);
    const heroPxY = this.sceneYToCanvasPx(heroY);
    const targetTx = heroPxX - this.cw / 2;
    const targetTy = heroPxY - this.ch / 2;

    // Не ограничиваем камеру clamp'ом.
    // При разных aspect/режимах (object-fit) вычисленные overflow могут оказаться 0,
    // из-за чего follow полностью “замирает”.
    return { tx: targetTx, ty: targetTy };
  }

  getCameraForState(state) {
    return this._computeCameraOffset(state.heroX, state.heroY);
  }

  get cameraTx() { return this._camTx; }
  get cameraTy() { return this._camTy; }
}

/* ============================================================
   SECTION H — InputController
   ============================================================ */

class InputController {
  constructor() {
    this._listeners = {};
  }

  on(event, callback) {
    this._listeners[event] = callback;
    return this;
  }

  _emit(event, data) {
    if (this._listeners[event]) this._listeners[event](data);
  }

  attachTo(el) {
    const getCoords = (clientX, clientY) => {
      const rect = el.getBoundingClientRect();
      return {
        x: (clientX - rect.left) / rect.width,
        y: (clientY - rect.top) / rect.height
      };
    };

    el.addEventListener('click', e => {
      e.preventDefault();
      this._emit('tap', getCoords(e.clientX, e.clientY));
    });

    let touchStartX = 0, touchStartY = 0;
    el.addEventListener('touchstart', e => {
      const t = e.touches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
    }, { passive: true });

    el.addEventListener('touchend', e => {
      const t = e.changedTouches[0];
      const dx = Math.abs(t.clientX - touchStartX);
      const dy = Math.abs(t.clientY - touchStartY);
      if (dx < 12 && dy < 12) {
        e.preventDefault();
        this._emit('tap', getCoords(t.clientX, t.clientY));
      }
    }, { passive: false });
  }
}

/* ============================================================
   SECTION I — DialogueManager
   ============================================================ */

class DialogueManager {
  constructor() {
    this._screen = document.getElementById('screen-dialogue');
    this._backdrop = document.getElementById('dialogue-backdrop');
    this._avatar = document.getElementById('npc-avatar');
    this._npcName = document.getElementById('dialogue-npc-name');
    this._questTitle = document.getElementById('dialogue-quest-title');
    this._questText = document.getElementById('dialogue-quest-text');
    this._answerBtns = Array.from(document.querySelectorAll('.answer-btn'));

    this._onAnswer = null;
    this._onDismiss = null;

    this._currentQuest = null;
    this._currentImages = null;

    this._answering = false;

    this._answerBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        this._handleAnswer(idx);
      });
    });

    // Backdrop click = dismiss без ответа, показываем грустное лицо
    this._backdrop.addEventListener('click', () => {
      if (!this._currentQuest || this._answering) return;
      this._showSadAndDismiss();
    });
  }

  onAnswer(callback) {
    this._onAnswer = callback;
  }

  onDismiss(callback) {
    this._onDismiss = callback;
  }

  /**
   * @param {Object} questData
   * @param {{avatar:HTMLImageElement|null, happy:HTMLImageElement|null, sad:HTMLImageElement|null}} npcImages
   */
  show(questData, npcImages) {
    // Требование: в каждом квесте должно быть только 2 варианта ответа.
    // В исходных данных иногда хранится 4, поэтому показываем первые два.
    const answers = Array.isArray(questData?.answers) ? questData.answers.slice(0, 2) : [];
    this._currentQuest = { ...questData, answers };
    this._currentImages = npcImages;

    this._npcName.textContent = questData.npcName;
    this._questTitle.textContent = questData.title;
    this._questText.textContent = questData.text;

    // Требование: аватар.png в диалоговом окне для активного квеста
    // В рамках данной игры — диалог открывается при "taken".
    if (npcImages && npcImages.avatar) {
      this._avatar.src = npcImages.avatar.src;
    } else {
      // чтобы не было сломанного запроса, показываем плейсхолдер.
      this._avatar.src = FALLBACK_SVG_SRC;
    }

    this._answerBtns.forEach((btn, i) => {
      const answer = this._currentQuest.answers[i];
      btn.textContent = '';
      btn.dataset.letter = ['А', 'Б', 'В', 'Г'][i];
      if (answer) {
        btn.textContent = answer.text;
        btn.dataset.letter = ['А', 'Б', 'В', 'Г'][i];
        btn.style.display = '';
      } else {
        btn.style.display = 'none';
      }
      btn.classList.remove('selected');
    });

    this._screen.classList.add('active');

    // animation re-trigger
    const panel = document.getElementById('dialogue-panel');
    panel.style.animation = 'none';
    void panel.offsetWidth;
    panel.style.animation = '';
  }

  hide() {
    this._screen.classList.remove('active');
    this._currentQuest = null;
    this._currentImages = null;
    this._answering = false;
  }

  _showSadAndDismiss() {
    this._answering = true;
    const sadImg = this._currentImages && this._currentImages.sad;
    this._avatar.src = sadImg ? sadImg.src : FALLBACK_SVG_SRC;

    const quest = this._currentQuest;
    setTimeout(() => {
      this.hide();
      if (this._onDismiss) this._onDismiss(quest.id);
    }, 600);
  }

  _handleAnswer(idx) {
    if (!this._currentQuest || this._answering) return;
    const answer = this._currentQuest.answers[idx];
    if (!answer) return;

    this._answering = true;

    const btn = this._answerBtns[idx];
    btn.classList.add('selected');

    // Быстро подсветить счастливое лицо
    const happyImg = this._currentImages && this._currentImages.happy;
    if (happyImg) {
      setTimeout(() => {
        this._avatar.src = happyImg.src;
      }, 150);
    }

    setTimeout(() => {
      const quest = this._currentQuest;
      this.hide();
      if (this._onAnswer) {
        this._onAnswer(quest.id, idx, answer.personalityType, answer.points);
      }
    }, 700);
  }
}

/* ============================================================
   SECTION J — MovementSystem
   ============================================================ */

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function rectFromCenter(fr, cw, ch) {
  // fr: {x,y,w,h} in fractions
  const cx = fr.x * cw;
  const cy = fr.y * ch;
  const rw = fr.w * cw;
  const rh = fr.h * ch;
  return {
    left: cx - rw / 2,
    top: cy - rh / 2,
    right: cx + rw / 2,
    bottom: cy + rh / 2,
    width: rw,
    height: rh
  };
}

function pointRectDistance(px, py, rect) {
  // Distance from point to axis-aligned rectangle (px)
  const dx = (px < rect.left) ? rect.left - px : (px > rect.right) ? px - rect.right : 0;
  const dy = (py < rect.top) ? rect.top - py : (py > rect.bottom) ? py - rect.top : 0;
  return Math.hypot(dx, dy);
}

function mapPointFromRectToRect(srcRect, dstRect, heroX, heroY) {
  // Сохраняем относительную позицию внутри прямоугольника при переходе локаций.
  // srcRect/dstRect: {x,y,w,h} in fractions (center+size)
  const srcLeft = srcRect.x - srcRect.w / 2;
  const srcTop = srcRect.y - srcRect.h / 2;
  const srcW = srcRect.w;
  const srcH = srcRect.h;

  const dstLeft = dstRect.x - dstRect.w / 2;
  const dstTop = dstRect.y - dstRect.h / 2;
  const dstW = dstRect.w;
  const dstH = dstRect.h;

  const u = srcW ? clamp((heroX - srcLeft) / srcW, 0, 1) : 0.5;
  const v = srcH ? clamp((heroY - srcTop) / srcH, 0, 1) : 0.5;

  return {
    x: dstLeft + u * dstW,
    y: dstTop + v * dstH
  };
}

class MovementSystem {
  update(state, animTime) {
    // Move with constant speed (no dependence on distance).
    // We move in fraction-space but compute delta length in canvas pixels.
    const cw = this._cw || 800;
    const ch = this._ch || 600;

    // delta time based on previous frame (per-state)
    if (state._lastMoveFrameTime == null) state._lastMoveFrameTime = animTime;
    const dtMs = Math.min(50, Math.max(0, animTime - state._lastMoveFrameTime));
    state._lastMoveFrameTime = animTime;
    const dtSecFrame = dtMs / 1000;

    const dx = state.targetX - state.heroX;
    const dy = state.targetY - state.heroY;

    const distFrac = Math.hypot(dx, dy);
    if (distFrac < 0.0005) {
      state.heroX = state.targetX;
      state.heroY = state.targetY;
      return;
    }

    // Convert fraction delta to pixels to move with constant speed.
    const distPx = distFrac * Math.min(cw, ch);
    const stepPx = MOVE_SPEED_PX_PER_SEC * dtSecFrame;

    // If we're going to overshoot, snap.
    if (stepPx >= distPx) {
      state.heroX = state.targetX;
      state.heroY = state.targetY;
    } else {
      const ratio = stepPx / distPx;
      state.heroX = state.heroX + dx * ratio;
      state.heroY = state.heroY + dy * ratio;

      if (Math.abs(dy) > Math.abs(dx)) {
        state.heroDirection = dy > 0 ? 'down' : 'up';
      } else {
        state.heroDirection = dx > 0 ? 'right' : 'left';
      }
    }
  }

  setTarget(state, targetX, targetY, animTime) {
    state.targetX = clamp(targetX, 0, 1);
    state.targetY = clamp(targetY, 0, 1);
    state.moveStartTime = animTime;
    state._lastMoveFrameTime = animTime;
  }

  checkNPCProximity(state, npcs) {
    if (!npcs) return null;
    const radius = NPC_TRIGGER_FRAC;

    for (const npc of npcs) {
      const questId = npc.questId;
      if (state.isQuestDone(questId)) continue;

      const dx = state.heroX - npc.x;
      const dy = state.heroY - npc.y;

      if (Math.abs(dx) < radius && Math.abs(dy) < radius * 1.3) {
        return npc;
      }
    }
    return null;
  }

  isHeroStill(state) {
    return Math.abs(state.heroX - state.targetX) < 0.01 &&
      Math.abs(state.heroY - state.targetY) < 0.01;
  }

  /**
   * Return {building} if hero is close to entry zone in pixels.
   */
  checkMainEntrances(state, buildings, cw, ch, proximityPx) {
    const px = state.heroX * cw;
    const py = state.heroY * ch;

     // Дверные зоны на карте рисуются визуально “широко”.
     // Чтобы герой не телепортировался при любом попадании рядом,
     // используем более строгий порог входа (внутри/очень близко к двери).
     const effectiveProximityPx = proximityPx * 0.35;

    for (const b of buildings) {
      const rect = rectFromCenter(b.entryMain, cw, ch);
      const dist = pointRectDistance(px, py, rect);
      if (dist < effectiveProximityPx) return b;
    }
    return null;
  }

  checkBuildingExit(state, building, cw, ch, proximityPx) {
    const px = state.heroX * cw;
    const py = state.heroY * ch;
    const rect = rectFromCenter(building.exitBuilding, cw, ch);
    const dist = pointRectDistance(px, py, rect);
    const effectiveProximityPx = proximityPx * 0.35;
    return dist < effectiveProximityPx;
  }

  computeEnterSpawn(state, building) {
    // Map position from main entry rect to building entry rect.
    return mapPointFromRectToRect(building.entryMain, building.entryBuilding, state.heroX, state.heroY);
  }

  computeExitSpawn(state, building) {
    // Map position from building exit rect to main exit rect.
    return mapPointFromRectToRect(building.exitBuilding, building.exitMain, state.heroX, state.heroY);
  }
}

/* ============================================================
   SECTION K — GameController + main()
   ============================================================ */

const STATE_GENDER_SELECT = 'GENDER_SELECT';
const STATE_EXPLORING = 'EXPLORING';
const STATE_DIALOGUE = 'DIALOGUE';
const STATE_TRANSITIONING = 'TRANSITIONING';
const STATE_RESULTS = 'RESULTS';

class GameController {
  constructor(questData) {
    this._questData = questData;
    this._questMap = new Map(questData.quests.map(q => [q.id, q]));

    this._buildings = BUILDINGS;
    this._buildingMap = new Map(this._buildings.map(b => [b.id, b]));

    this._gameState = new GameState();

    this._renderer = null;
    this._input = new InputController();
    this._dialogue = new DialogueManager();
    this._movement = new MovementSystem();
    this._assetLoader = new AssetLoader();

    // npcId -> { sad, happy, avatar } loaded images (or null).
    this._npcImages = {};

    this._appState = STATE_GENDER_SELECT;

    this._raf = null;
    this._animTime = 0;
    this._lastFrameTime = null;

    // guards
    this._dialogueCooldown = 0;
    this._transitionCooldown = 0;
    this._exitCooldown = 0;

    // Prevent instant main->building re-entry right after arriving on main.
    this._mainEnterCooldown = 0;

    // Хранит последнюю стартовую (spawn) позицию героя на главной карте.
    // Нужна, чтобы исключить телепорты сразу после спавна на зоне входа.
    this._mainSpawnX = null;
    this._mainSpawnY = null;

    // Optional: persist NPC overrides for harmonizing with background.
    this._npcOverrides = this._loadNpcOverrides();

    this._lastTriggeredNPCQuestId = null;

    // Если перед сменой локации рассчитан spawn героя — держим координаты тут,
    // чтобы _loadLocation() их не перетёр.
    this._pendingSpawn = null; // {x,y}

    // DOM refs
    this._elGenderScreen = document.getElementById('screen-gender');
    this._elGameScreen = document.getElementById('screen-game');
    this._elResultsScreen = document.getElementById('screen-results');
    this._elLocImg = document.getElementById('location-img');
    this._elCanvas = document.getElementById('game-canvas');

    this._elHudLocation = document.getElementById('hud-location');
    this._elHudProgress = document.getElementById('hud-progress');
    this._elHudDots = document.getElementById('hud-dots');
    this._elGameWorld = document.getElementById('game-world');

    this._elLocationLabel = document.getElementById('location-label');
    this._elExitHint = document.getElementById('exit-hint');
    this._elLoadingStatus = document.getElementById('loading-status');
  }

  _loadNpcOverrides() {
    try {
      const raw = localStorage.getItem(NPC_EDITOR_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  _saveNpcOverrides() {
    try {
      localStorage.setItem(NPC_EDITOR_STORAGE_KEY, JSON.stringify(this._npcOverrides));
    } catch {
      // ignore
    }
  }

  _applyNpcOverridesToBuildings() {
    // Overrides format: { [locationId]: { [questId]: {x,y} } }
    // We map to BUILDINGS.npcs by questId.
    for (const b of this._buildings) {
      const locOverrides = this._npcOverrides?.[b.id];
      if (!locOverrides) continue;
      for (const npc of b.npcs) {
        const ov = locOverrides?.[npc.questId];
        if (!ov) continue;
        if (typeof ov.x === 'number' && typeof ov.y === 'number') {
          npc.x = ov.x;
          npc.y = ov.y;
        }
      }
    }
  }

  _getQuestNpcEmotionSrc(questId, emotion) {
    // Источник правды — quests.json, т.к. имена файлов в папке НПС
    // включают имя персонажа и могут иметь нестандартные окончания.
    const q = this._questMap?.get(questId);
    if (q && q.npcFolder) {
      const folder = ASSET_BASE + '/НПС/' + q.npcFolder + '/';
      const filename = emotion === 'sad'
        ? q.npcSad
        : emotion === 'happy'
          ? q.npcHappy
          : q.npcAvatar;
      if (filename) return folder + filename;
    }

    // Fallback на старую схему, если данных нет.
    return getQuestNpcEmotionSrc(questId, emotion);
  }

  async init() {
    this._renderer = new Renderer(this._elCanvas, this._elLocImg);
    this._renderer.setNpcImages(this._npcImages);

    await this._preloadStaticImages();

    // Apply NPC placement overrides after assets are ready.
    this._applyNpcOverridesToBuildings();

    if (window.__RPG_NPC_EDIT === true) {
      // Force marker visibility during edit.
      window.__RPG_DEBUG_NPCS = true;
    }

    this._buildHudDots();
    this._setupGenderSelect();

    this._setupNpcEditor();
  
    this._dialogue.onAnswer((questId, idx, type, pts) => {
      this._onDialogueAnswer(questId, idx, type, pts);
    });

    // Dismissed без ответа — отменяем taken состояние
    this._dialogue.onDismiss((questId) => {
      this._gameState.unmarkQuestTaken(questId);
      this._appState = STATE_EXPLORING;
      this._dialogueCooldown = 1500;
      this._lastTriggeredNPCQuestId = null;
      this._updateHUD();
    });

    window.addEventListener('resize', () => {
      if (this._appState === STATE_EXPLORING || this._appState === STATE_DIALOGUE) {
        this._renderer.syncSize();
      }
    });

    document.getElementById('btn-restart').addEventListener('click', () => {
      this._restart();
    });

    this._showScreen(STATE_GENDER_SELECT);
  }

  async _preloadStaticImages() {
    const allPaths = [];

    // Hero directional sprites
    ['male', 'female'].forEach(gender => {
      ['down', 'up', 'left', 'right'].forEach(dir => {
        allPaths.push(HERO_SPRITES[gender][dir].idle);
        allPaths.push(HERO_SPRITES[gender][dir].walk1);
        allPaths.push(HERO_SPRITES[gender][dir].walk2);
      });
    });

    // Location images: main + all buildings
    const locPaths = [MAIN_LOCATION_CFG.image, ...this._buildings.map(b => b.image)];
    locPaths.forEach(p => allPaths.push(p));

    this._elLoadingStatus.textContent = 'Загрузка изображений…';

    const total = allPaths.length;
    let loaded = 0;

    const imgs = await Promise.all(allPaths.map(src => new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        loaded++;
        this._elLoadingStatus.textContent = `Загрузка… ${Math.round(loaded / total * 100)}%`;
        resolve({ src, img, ok: true });
      };
      img.onerror = () => {
        loaded++;
        resolve({ src, img: null, ok: false });
      };
      img.src = src;
    })));

    // Запакуем обратно hero sprites
    let i = 0;
    const heroSprites = { male: {}, female: {} };

    ['male', 'female'].forEach(gender => {
      ['down', 'up', 'left', 'right'].forEach(dir => {
        heroSprites[gender][dir] = {
          idle: (imgs[i++]?.img) || null,
          walk1: (imgs[i++]?.img) || null,
          walk2: (imgs[i++]?.img) || null
        };
      });
    });

    // Fallback: если по каким-то причинам preloading не подхватил idle-вниз,
    // берём уже загруженное превью с экрана выбора пола.
    // Это гарантирует, что герой хотя бы визуально появится на локации.
    const malePreview = document.getElementById('hero-preview-male');
    const femalePreview = document.getElementById('hero-preview-female');

    // Важно: даже если картинка ещё не полностью загрузилась, она будет загружаться асинхронно,
    // а canvas-отрисовка повторится в игровом цикле.
    if (heroSprites.male?.down && !heroSprites.male.down.idle && malePreview) {
      heroSprites.male.down.idle = malePreview;
    }
    if (heroSprites.female?.down && !heroSprites.female.down.idle && femalePreview) {
      heroSprites.female.down.idle = femalePreview;
    }

    // Если не удалось предзагрузить walk1/walk2, используем idle, чтобы герой всё равно был виден.
    if (heroSprites.male?.down && heroSprites.male.down.idle) {
      heroSprites.male.down.walk1 = heroSprites.male.down.walk1 || heroSprites.male.down.idle;
      heroSprites.male.down.walk2 = heroSprites.male.down.walk2 || heroSprites.male.down.idle;
    }
    if (heroSprites.female?.down && heroSprites.female.down.idle) {
      heroSprites.female.down.walk1 = heroSprites.female.down.walk1 || heroSprites.female.down.idle;
      heroSprites.female.down.walk2 = heroSprites.female.down.walk2 || heroSprites.female.down.idle;
    }

    this._renderer.setHeroSprites(heroSprites);

    // Где-то дальше может понадобиться “фон” — он грузится через <img> и syncSize.

    // 2) Динамическая подгрузка эмоций NPC.
    // Чтобы на карте были грустные спрайты “до взятия”, заранее подгружаем sad для всех квестов.
    this._elLoadingStatus.textContent = 'Загрузка спрайтов NPC…';
    const questIds = this._questData.quests.map(q => q.id);

    await Promise.all(questIds.map(questId => this._prefetchNpcEmotion(questId, 'sad')));

    this._elLoadingStatus.textContent = 'Нажмите на персонажа, чтобы начать';
  }

  async _prefetchNpcEmotion(questId, emotion) {
    const src = this._getQuestNpcEmotionSrc(questId, emotion);
    const img = await this._assetLoader.loadImage(src);

    if (!this._npcImages[questId]) this._npcImages[questId] = {};

    // если файла нет — оставляем null, Renderer нарисует fallback (!)
    if (img) {
      this._npcImages[questId][emotion] = img;
      this._renderer.setNpcImages(this._npcImages);
    }
  }

  async _ensureQuestNpcImages(questId) {
    if (this._npcImages[questId]?.__fullyLoaded) return;

    const [sadImg, happyImg, avatarImg] = await Promise.all([
      this._assetLoader.loadImage(this._getQuestNpcEmotionSrc(questId, 'sad')),
      this._assetLoader.loadImage(this._getQuestNpcEmotionSrc(questId, 'happy')),
      this._assetLoader.loadImage(this._getQuestNpcEmotionSrc(questId, 'avatar'))
    ]);

    if (!this._npcImages[questId]) this._npcImages[questId] = {};

    this._npcImages[questId].sad = sadImg || null;
    this._npcImages[questId].happy = happyImg || null;
    this._npcImages[questId].avatar = avatarImg || null;
    this._npcImages[questId].__fullyLoaded = true;

    this._renderer.setNpcImages(this._npcImages);
  }

  _setupGenderSelect() {
    const select = gender => {
      this._gameState.heroGender = gender;
      this._enterGame();
    };

    document.getElementById('card-male').addEventListener('click', () => select('male'));
    document.getElementById('card-female').addEventListener('click', () => select('female'));

    document.getElementById('card-male').addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') select('male');
    });
    document.getElementById('card-female').addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') select('female');
    });
  }

  async _enterGame() {
    // Важно: _startGameLoop использует _appState для отрисовки.
    // Если не выставить _appState=EXPLORING, render() не вызовется.
    this._appState = STATE_EXPLORING;
    this._showScreen(STATE_EXPLORING);
    await this._loadLocation(MAIN_LOCATION_CFG.id);
    this._startGameLoop();
  }

  async _loadLocation(locationId) {
    const isMain = locationId === MAIN_LOCATION_CFG.id;

    const buildingCfg = isMain ? null : this._buildingMap.get(locationId);
    if (locationId !== MAIN_LOCATION_CFG.id && !buildingCfg) return;

    this._gameState.currentLocation = locationId;

    // Load background via <img> and sync canvas size.
    // Важно: ждём завершения загрузки, чтобы canvas точно получил размеры.
    const src = isMain ? MAIN_LOCATION_CFG.image : buildingCfg.image;
    this._elLocImg.src = src;

    await new Promise(resolve => {
      if (this._elLocImg.complete && this._elLocImg.naturalWidth > 0) {
        resolve();
        return;
      }
      const onDone = () => resolve();
      this._elLocImg.addEventListener('load', onDone, { once: true });
      this._elLocImg.addEventListener('error', onDone, { once: true });
    });

    // На всякий случай — после загрузки и после layout-пересчёта.
    this._renderer.syncSize();
    requestAnimationFrame(() => this._renderer.syncSize());

    // 3) Позиционирование героя при смене локации.
    // Если prior transition вычислил spawn — применяем его.
    if (this._pendingSpawn) {
      this._gameState.heroX = this._pendingSpawn.x;
      this._gameState.heroY = this._pendingSpawn.y;
      this._gameState.targetX = this._pendingSpawn.x;
      this._gameState.targetY = this._pendingSpawn.y;
      this._pendingSpawn = null;
      } else {
        // Дефолт на случай ручного перехода/ресета.
        if (isMain) {
          this._gameState.heroX = 0.5;
          // Ближе к центру экрана.
          this._gameState.heroY = 0.70;
          this._gameState.targetX = 0.5;
          this._gameState.targetY = 0.70;
        } else {
        this._gameState.heroX = 0.5;
        this._gameState.heroY = 0.72;
        this._gameState.targetX = 0.5;
        this._gameState.targetY = 0.72;
      }
    }

    // Запоминаем spawn на главной карте для ограничения мгновенного входа.
    if (isMain) {
      this._mainSpawnX = this._gameState.heroX;
      this._mainSpawnY = this._gameState.heroY;
    } else {
      this._mainSpawnX = null;
      this._mainSpawnY = null;
    }

    this._elExitHint.classList.remove('visible');

    // На главной карте не триггерим вход в здания мгновенно.
    // Это предотвращает цикл: building exit -> main -> тут же main->building.
    this._mainEnterCooldown = isMain ? 1200 : 0;

    this._elHudLocation.textContent = isMain ? MAIN_LOCATION_CFG.name : buildingCfg.name;
    this._showLocationLabel(isMain ? MAIN_LOCATION_CFG.name : buildingCfg.name);

    this._updateHUD();

    this._lastTriggeredNPCQuestId = null;
    this._dialogueCooldown = 0;

    // prevent instant exit after entering
    this._exitCooldown = 2000;
  }

  _showLocationLabel(name) {
    this._elLocationLabel.textContent = name;
    this._elLocationLabel.classList.add('visible');
    setTimeout(() => this._elLocationLabel.classList.remove('visible'), 2500);
  }

  _transitionToLocation(targetLocationId) {
    if (this._appState === STATE_TRANSITIONING) return;
    this._appState = STATE_TRANSITIONING;

    this._elGameWorld.classList.add('fading');
    setTimeout(async () => {
      await this._loadLocation(targetLocationId);
      this._elGameWorld.classList.remove('fading');
      this._appState = STATE_EXPLORING;
    }, FADE_DURATION_MS);
  }

  _buildHudDots() {
    this._elHudDots.innerHTML = '';
    for (let i = 1; i <= 20; i++) {
      const dot = document.createElement('div');
      dot.className = 'hud-dot';
      dot.id = `dot-${i}`;
      this._elHudDots.appendChild(dot);
    }
  }

  _updateHUD() {
    const done = this._gameState.totalDone;
    this._elHudProgress.textContent = `${done} / 20`;

    for (let i = 1; i <= 20; i++) {
      const dot = document.getElementById(`dot-${i}`);
      if (dot) dot.classList.toggle('done', this._gameState.isQuestDone(i));
    }

    // exit hint is separate
  }

  _setupWorldInput() {
    if (window.__RPG_NPC_EDIT === true) return;
    this._input.attachTo(this._elGameWorld);
    this._input.on('tap', ({ x, y }) => {
      if (this._appState !== STATE_EXPLORING) return;

      // x/y are screen-space fractions of #game-world.
      // With camera follow the canvas/background are shifted by cameraTx/cameraTy,
      // so convert screen -> world coordinates.
      const cw = this._renderer.cw;
      const ch = this._renderer.ch;

      const worldXpx = x * cw + this._renderer.cameraTx;
      const worldYpx = y * ch + this._renderer.cameraTy;

      const worldX = worldXpx / cw;
      const worldY = worldYpx / ch;

      const { x: fx, y: fy } = this._constrainMovePoint(worldX, worldY);
      this._movement.setTarget(this._gameState, fx, fy, this._animTime);
    });
  }

  _setupNpcEditor() {
    // Подписываемся всегда, но активируем логику только когда включён флаг.
    // Это нужно, чтобы можно было включить редактор после загрузки через консоль.

    // Enable only in exploring/game screens.
    const el = this._elGameWorld;
    let draggingNpc = null; // { npc, building, startPointerXpx, startPointerYpx, offsetX, offsetY }

    const getWorldFromScreenFrac = (fx, fy) => {
      const cw = this._renderer.cw;
      const ch = this._renderer.ch;
      const worldXpx = fx * cw + this._renderer.cameraTx;
      const worldYpx = fy * ch + this._renderer.cameraTy;
      return {
        x: worldXpx / cw,
        y: worldYpx / ch,
        xPx: worldXpx,
        yPx: worldYpx
      };
    };

    const snapToGridFrac = (x, y) => {
      const cw = this._renderer.cw;
      const ch = this._renderer.ch;
      const snapX = Math.round(x * cw / NPC_EDITOR_SNAP_PX) * NPC_EDITOR_SNAP_PX;
      const snapY = Math.round(y * ch / NPC_EDITOR_SNAP_PX) * NPC_EDITOR_SNAP_PX;
      return {
        x: snapX / cw,
        y: snapY / ch
      };
    };

    const getHitNpc = (xFrac, yFrac) => {
      const locId = this._gameState.currentLocation;
      const building = locId === MAIN_LOCATION_CFG.id ? null : this._buildingMap.get(locId);
      const npcs = building?.npcs || [];
      const rPx = NPC_EDITOR_SNAP_PX * 0.6;

      let best = null;
      let bestD = Infinity;
      for (const npc of npcs) {
        const dx = (xFrac - npc.x) * this._renderer.cw;
        const dy = (yFrac - npc.y) * this._renderer.ch;
        const d = Math.hypot(dx, dy);
        if (d < rPx && d < bestD) {
          best = npc;
          bestD = d;
        }
      }
      return best;
    };

    const onPointerDown = (e) => {
      if (window.__RPG_NPC_EDIT !== true) return;
      // Only left click / primary.
      if (e.button != null && e.button !== 0) return;
      const rect = el.getBoundingClientRect();
      const fx = (e.clientX - rect.left) / rect.width;
      const fy = (e.clientY - rect.top) / rect.height;
      const world = getWorldFromScreenFrac(fx, fy);

      const npc = getHitNpc(world.x, world.y);
      if (!npc) return;

      // Start drag.
      draggingNpc = { npc, buildingId: this._gameState.currentLocation };
      e.preventDefault();
    };

    const onPointerMove = (e) => {
      if (window.__RPG_NPC_EDIT !== true) return;
      if (!draggingNpc) return;
      const rect = el.getBoundingClientRect();
      const fx = (e.clientX - rect.left) / rect.width;
      const fy = (e.clientY - rect.top) / rect.height;
      const world = getWorldFromScreenFrac(fx, fy);

      let x = world.x;
      let y = world.y;
      // Keep inside map.
      const inset = 0.02;
      x = clamp(x, inset, 1 - inset);
      y = clamp(y, inset, 1 - inset);
      const snapped = snapToGridFrac(x, y);
      draggingNpc.npc.x = snapped.x;
      draggingNpc.npc.y = snapped.y;

      // Persist override.
      const locId = this._gameState.currentLocation;
      const questId = draggingNpc.npc.questId;
      if (!this._npcOverrides[locId]) this._npcOverrides[locId] = {};
      this._npcOverrides[locId][questId] = { x: snapped.x, y: snapped.y };
    };

    const onPointerUp = () => {
      if (!draggingNpc) return;
      this._saveNpcOverrides();
      draggingNpc = null;
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
  }

  _constrainMovePoint(x, y) {
    // Bounds: keep hero inside the map (avoid going outside canvas).
    const inset = this._gameState.currentLocation === MAIN_LOCATION_CFG.id ? 0.03 : 0.02;
    let cx = clamp(x, inset, 1 - inset);
    let cy = clamp(y, inset, 1 - inset);

    // Block walking on building bodies on the main map.
    // Требование: здания над входами, поэтому на main карте запрещаем проход
    // внутри mainBlockRect, но оставляем проходным вход (entryMain).
    if (this._gameState.currentLocation === MAIN_LOCATION_CFG.id) {
      for (const b of this._buildings) {
        const door = b.entryMain; // allowed area (entry)
        const buildingBlock = b.mainBlockRect; // forbidden area (building body)
        if (!buildingBlock) continue;

        const insideBuilding = this._pointInRectCenter(buildingBlock, cx, cy);
        const insideDoor = this._pointInRectCenter(door, cx, cy);

        if (insideBuilding && !insideDoor) {
          // Project the point into the nearest allowed area (door rectangle).
          // Так герой не “залипает” внутри здания.
          const doorRect = rectFromCenter(door, this._renderer.cw, this._renderer.ch);
          const px = cx * this._renderer.cw;
          const py = cy * this._renderer.ch;
          const clampedPx = clamp(px, doorRect.left + 1, doorRect.right - 1);
          const clampedPy = clamp(py, doorRect.top + 1, doorRect.bottom - 1);
          cx = clampedPx / this._renderer.cw;
          cy = clampedPy / this._renderer.ch;
          break;
        }
      }
    }

    // Block walking through NPCs on internal locations (simple soft-collision).
    // This prevents the hero from "standing on top" of the NPC markers.
    if (this._gameState.currentLocation !== MAIN_LOCATION_CFG.id) {
      const building = this._buildingMap.get(this._gameState.currentLocation);
      const npcs = building?.npcs || [];
      const blockR = 0.045; // fractions (~a few percent of map)

      for (const npc of npcs) {
        const dx = x - npc.x;
        const dy = y - npc.y;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < blockR) {
          const nx = dx / d;
          const ny = dy / d;
          x = npc.x + nx * blockR;
          y = npc.y + ny * blockR;
        }
      }
    }

    return { x: cx, y: cy };
  }

  _pointInRectCenter(fr, pxFrac, pyFrac) {
    const left = fr.x - fr.w / 2;
    const right = fr.x + fr.w / 2;
    const top = fr.y - fr.h / 2;
    const bottom = fr.y + fr.h / 2;
    return pxFrac >= left && pxFrac <= right && pyFrac >= top && pyFrac <= bottom;
  }

  _startGameLoop() {
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }

    this._setupWorldInput();
    this._lastFrameTime = performance.now();

    const loop = (now) => {
      const dt = now - (this._lastFrameTime || now);
      this._lastFrameTime = now;
      this._animTime += dt;

      if (this._appState === STATE_EXPLORING) {
        // Provide renderer size to MovementSystem for px/fraction conversions.
        this._movement._cw = this._renderer.cw;
        this._movement._ch = this._renderer.ch;
        this._movement.update(this._gameState, this._animTime);
        this._checkProximities();
      }

      if (this._appState === STATE_EXPLORING || this._appState === STATE_DIALOGUE) {
        const locationCfg = this._getLocationRenderCfg();
        if (locationCfg) this._renderer.render(this._gameState, locationCfg, this._animTime);
      }

      if (this._dialogueCooldown > 0) this._dialogueCooldown -= dt;
      if (this._exitCooldown > 0) this._exitCooldown -= dt;
      if (this._mainEnterCooldown > 0) this._mainEnterCooldown -= dt;

      // На всякий случай: повторно syncSize после смены локации/изменения размеров.
      if (this._appState === STATE_EXPLORING || this._appState === STATE_DIALOGUE) {
        this._renderer.syncSize();
      }

      this._raf = requestAnimationFrame(loop);
    };

    this._raf = requestAnimationFrame(loop);
  }

  _getLocationRenderCfg() {
    const locId = this._gameState.currentLocation;
    if (locId === MAIN_LOCATION_CFG.id) {
      return { id: 'main', npcs: [] };
    }
    const b = this._buildingMap.get(locId);
    if (!b) return null;
    return { id: b.id, npcs: b.npcs };
  }

  _checkProximities() {
    if (this._dialogueCooldown > 0) {
      return;
    }

    const cw = this._renderer.cw;
    const ch = this._renderer.ch;

    const locId = this._gameState.currentLocation;
    const heroStill = this._movement.isHeroStill(this._gameState);

    // 3) Entrance/Exit zones
    if (locId === MAIN_LOCATION_CFG.id) {
      if (this._mainEnterCooldown > 0) return;

      // Доп. защита от “телепорта при любом клике”:
      // если герой всё ещё практически в стартовой точке — не разрешаем вход.
      if (this._mainSpawnX != null && this._mainSpawnY != null) {
        const movedPx = Math.hypot(
          (this._gameState.heroX - this._mainSpawnX) * cw,
          (this._gameState.heroY - this._mainSpawnY) * ch
        );
        if (movedPx < MIN_MOVE_BEFORE_MAIN_ENTRY_PX) return;
      }

      // main -> buildings
      const b = this._movement.checkMainEntrances(
        this._gameState,
        this._buildings,
        cw,
        ch,
        MAIN_LOCATION_CFG.enterExitProximityPx
      );

      if (b && heroStill) {
        const spawn = this._movement.computeEnterSpawn(this._gameState, b);
        this._pendingSpawn = spawn;

        this._transitionToLocation(b.id);
        return;
      }
    } else {
      const building = this._buildingMap.get(locId);
      if (building) {
        // exit zone: building -> main
        if (this._exitCooldown <= 0) {
          // Чтобы избежать телепорта при мгновенно выставленной цели
          // (когда isHeroStill() ещё успел стать true), даём минимальную паузу.
          if (this._animTime - this._gameState.moveStartTime < 250) return;

          // Новый общий триггер выхода для ВСЕХ вторичных локаций.
          // Проверяем приближение к прямоугольнику в середине внизу локации.
          const heroX = this._gameState.heroX;
          const heroY = this._gameState.heroY;
          const exitRect = rectFromCenter(EXIT_ZONE_SECONDARY, cw, ch);
          const heroPx = heroX * cw;
          const heroPy = heroY * ch;
          const dist = pointRectDistance(heroPx, heroPy, exitRect);
          const nearExit = dist < (MAIN_LOCATION_CFG.enterExitProximityPx * 0.6);

          if (nearExit && heroStill) {
            const spawn = this._movement.computeExitSpawn(this._gameState, building);
            this._pendingSpawn = spawn;
            this._transitionToLocation(MAIN_LOCATION_CFG.id);
            return;
          }

          // Показываем подсказку только когда рядом
          if (nearExit) this._elExitHint.classList.add('visible');
          else this._elExitHint.classList.remove('visible');
        }
      }
    }

    // NPC dialogue triggers
    if (locId === MAIN_LOCATION_CFG.id) return;

    const building = this._buildingMap.get(locId);
    if (!building) return;

    const npc = this._movement.checkNPCProximity(this._gameState, building.npcs);
    if (npc && heroStill) {
      const questId = npc.questId;
      if (this._lastTriggeredNPCQuestId !== questId) {
        this._lastTriggeredNPCQuestId = questId;
        this._triggerDialogue(questId);
      }
    } else if (!npc) {
      this._lastTriggeredNPCQuestId = null;
    }
  }

  /* ============================================================
     Dialogue logic (quest states)
     ============================================================ */

  async _triggerDialogue(questId) {
    const quest = this._questMap.get(questId);
    if (!quest) return;
    if (this._gameState.isQuestDone(questId)) return;

    // 2) Квест становится активным при открытии диалога.
    this._gameState.markQuestTaken(questId);

    // Нужны динамические спрайты (avatar в диалоге, sad/happy для переключений)
    await this._ensureQuestNpcImages(questId);

    this._appState = STATE_DIALOGUE;

    const imgs = this._npcImages[questId] || {};
    this._dialogue.show(quest, {
      avatar: imgs.avatar || null,
      happy: imgs.happy || null,
      sad: imgs.sad || null
    });
  }

  async _onDialogueAnswer(questId, idx, type, pts) {
    this._gameState.addScore(type, pts);
    this._gameState.markQuestDone(questId);

    // Чтобы при завершении гарантированно переключилась “весёлый” иконка.
    // Если файл есть — загрузим до продолжения.
    await this._ensureQuestNpcImages(questId).catch(() => {});

    this._appState = STATE_EXPLORING;
    this._dialogueCooldown = 1200;
    this._lastTriggeredNPCQuestId = null;

    this._updateHUD();

    if (this._gameState.totalDone >= 20) {
      setTimeout(() => this._showResults(), 800);
    }
  }

  /* ============================================================
     Results
     ============================================================ */

  _showResults() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._appState = STATE_RESULTS;

    const scores = this._gameState.scores;
    const types = this._questData.personalityTypes;

    let winnerType = 'Ч';
    let winnerScore = -1;
    Object.entries(scores).forEach(([t, s]) => {
      if (s > winnerScore) {
        winnerScore = s;
        winnerType = t;
      }
    });

    const winner = types[winnerType];

    const badge = document.getElementById('winner-type-badge');
    badge.textContent = winner.label;
    badge.style.background = winner.color;

    document.getElementById('winner-type-name').textContent = winner.label;
    document.getElementById('winner-description').textContent = winner.description;

    const careersEl = document.getElementById('winner-careers');
    careersEl.innerHTML = '';
    winner.careers.forEach(c => {
      const tag = document.createElement('div');
      tag.className = 'career-tag';
      tag.textContent = c;
      careersEl.appendChild(tag);
    });

    const barsEl = document.getElementById('score-bars');
    const h3 = barsEl.querySelector('h3');
    barsEl.innerHTML = '';
    if (h3) barsEl.appendChild(h3);

    const maxScore = Math.max(...Object.values(scores), 1);
    Object.entries(scores).forEach(([t, s]) => {
      const info = types[t];
      const pct = Math.round(s / maxScore * 100);

      const row = document.createElement('div');
      row.className = 'score-row';

      const labelDiv = document.createElement('div');
      labelDiv.className = 'score-row-label';
      labelDiv.textContent = info.label;

      const trackDiv = document.createElement('div');
      trackDiv.className = 'score-bar-track';

      const fillDiv = document.createElement('div');
      fillDiv.className = 'score-bar-fill';
      fillDiv.style.background = info.color;
      fillDiv.style.width = '0%';
      trackDiv.appendChild(fillDiv);

      const valueDiv = document.createElement('div');
      valueDiv.className = 'score-row-value';
      valueDiv.textContent = String(s);

      row.append(labelDiv, trackDiv, valueDiv);
      barsEl.appendChild(row);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const fill = row.querySelector('.score-bar-fill');
          if (fill) fill.style.width = pct + '%';
        });
      });
    });

    this._showScreen(STATE_RESULTS);
  }

  /* ============================================================
     Restart
     ============================================================ */

  _restart() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;

    this._animTime = 0;
    this._lastFrameTime = null;

    this._exitCooldown = 0;
    this._dialogueCooldown = 0;
    this._lastTriggeredNPCQuestId = null;

    this._gameState.reset();
    this._updateHUD();

    this._appState = STATE_GENDER_SELECT;
    this._elLoadingStatus.textContent = 'Нажмите на персонажа, чтобы начать';
    this._showScreen(STATE_GENDER_SELECT);
  }

  /* ============================================================
     Screen switcher
     ============================================================ */

  _showScreen(stateOrId) {
    const all = ['screen-gender', 'screen-game', 'screen-results', 'screen-dialogue'];
    all.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });

    const map = {
      [STATE_GENDER_SELECT]: ['screen-gender'],
      [STATE_EXPLORING]: ['screen-game'],
      [STATE_DIALOGUE]: ['screen-game', 'screen-dialogue'],
      [STATE_TRANSITIONING]: ['screen-game'],
      [STATE_RESULTS]: ['screen-results']
    };

    const ids = map[stateOrId] || [];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('active');
    });
  }
}

/* ============================================================
   ENTRY POINT
   ============================================================ */

async function main() {
  let questData;
  try {
    questData = await loadQuestData('quests.json');
  } catch (err) {
    document.getElementById('loading-status').textContent =
      'Ошибка загрузки данных. Запустите через локальный сервер.';
    console.error('[main] Failed to load quest data:', err);
    return;
  }

  const controller = new GameController(questData);
  await controller.init();
}

main();
