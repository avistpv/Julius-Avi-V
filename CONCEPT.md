# Julius — новый сайт. Концепция

Референс: https://haoqi.design/ — повторяем механику и ощущение, образы и контент свои.
Старый сайт (источник контента): https://www.julius-agency.co.il/en

## Решения
- **Язык:** только EN (иврит, возможно, позже — не закладываем сейчас).
- **Главный объект:** надутое 3D-слово **JULIUS** — рукописная непрерывная стеклянная «трубка» (как «hello» у haoqi). Делаем процедурно в коде (Three.js), без Blender — 3D-дизайнера нет.
- **Персонаж:** 3D лавровый венок (вместо стрелки-курсора у haoqi). В сцене «гиперпрыжок» превращается в светящиеся кольца. Тоже процедурно.
- **Цвета:** максимально близко к референсу — светлое небесно-голубое «небо» с кремовыми пятнами, ярко-синий акцент, чёрный текст; тёмная тема — глубокий синий «космос».
- **Объём:** сначала главная. Потом страницы **Проекты** и **О нас** → сразу Next.js с роутингом.
- **Тексты:** пишем новые (короче и смелее, в духе референса), факты берём со старого сайта. Черновик ниже.
- **Картинки проектов:** пока заглушки — реальные фото/мокапы из бесплатных стоков (Unsplash/Pexels, лицензия разрешает использование). Pinterest не берём: там чужие работы с авторскими правами. Потом заменим на ваши скрины.
- **Звук:** не нужен. **Тёмная тема:** пока не нужна.
- **Римская стилистика** (выбраны 1 + 2 + 3):
  1. Шрифт римских надписей **Cinzel** — только акценты: метки секций (`I · ORIGO`, `II · OPERA SELECTA`…), «Est · MMXXI», девиз в прелоадере.
  2. **Римские цифры** как система: номера секций и проектов, годы; часы в углу по клику переключаются на римские.
  3. **3D-объекты из Higgsfield** (стекло/надутый стиль, наш материал поверх геометрии). Кредитов мало → генерируем по одной модели и только с подтверждения. Первая кандидатура — бюст Цезаря для финала (Hunyuan 3D v3.1, только геометрия, ~12 кредитов).

## Стек
Next.js (App Router) + React Three Fiber / Three.js + Lenis (плавный скролл) + GSAP ScrollTrigger (анимации по скролку).

## Структура главной (сверху вниз)
1. **Hero.** Небо-градиент (живой шейдер), 3D «JULIUS» «рисуется» при загрузке, сетка колонок с крестиками, мелкий моно-текст.
   Крупно: «WE BUILD PRODUCTS THAT SHIP». Углы: `PETAH TIKVA GMT+2 · 24°C`, счётчик координат мыши `0720 X 0450 Y`.
   Подзаголовок: «One product team — strategy, design and engineering — from idea to launch.»
2. **Intro.** Текст проявляется по скроллу (серый → чёрный): история (выпускники элитных техподразделений, с 2021, AI внутри процесса). Фон перетекает из голубого в почти белый.
3. **Selected work.** Шахматная сетка карточек, подписи моно, римская нумерация I–XVII, теги-плашки по доменам
   (Recruitment, Business operations, Commerce & marketplaces, Property & construction, Energy monitoring, Consumer products).
   Проекты: Solya V2, BIZ4SALE, FindMe, BuyByPower, NoSplit, B2B, ALTA, LaVision, Job Target, Metch, Or Menachem CRM, Gymnote, Techory, Iyushit, Dalia Medic, Mifrat, Master Fit.
4. **Венок** вырастает на весь экран → переход в «гиперпрыжок».
5. **Гиперпрыжок (чёрный, неоновые линии).** Слоганы: VENI (idea) → VIDI (design) → VICI (launch). Кольца из венка, вокруг ценности:
   Uncompromising excellence · Precision · Innovation · Partnership.
6. **Цифры / отзыв.** 140+ projects · 5 years · отзыв Nevo Adisol (CEO).
7. **Финал.** Обратно в небо, «LET'S BUILD SOMETHING THAT SHIPS» с эффектом перебора символов, контакты:
   gal@julius-agency.co.il · +972-52-667-6446 · BSR City, Building C, Floor 11, Petah Tikva · LinkedIn.

## Фишки из референса, которые повторяем
- Инерционный скролл (Lenis)
- Живой градиентный фон-шейдер
- Видимая сетка колонок с крестиками
- Часы/погода/координаты мыши в углах
- Проявление текста по скроллу
- Смена фона секций по скроллу
- Шахматная сетка работ
- Персонаж, который масштабируется по скроллу
- Сцена «гиперпрыжок» со сменой слоганов
- Эффект перебора символов (scramble text)
- ~~Переключатель темы~~ и ~~звук~~ — не делаем

## Второй референс: Shopify Editions Winter '26 («The Renaissance Edition»)
https://www.shopify.com/editions/winter2026 — классическая живопись + современные технологии (Remix + Three.js + Lenis).
Что берём:
- **Картина → гравюра:** изображение растворяется в светящийся штриховой рисунок на тёмном фоне со звёздами (шейдер). → портреты команды.
- **Рваная бумага** как стык секций: светлая «бумажная» секция рвётся, под ней тёмная сцена. → у нас «папирус».
- **Пролёт камеры сквозь проём** (арка/рама) в следующую сцену, слои картины в 3D с параллаксом. → римская арка как вход в секцию команды.
- **Занавес:** контент секции уезжает вверх, открывая зафиксированную сцену главы под ним.
- **Веер карточек:** стопка карточек раскладывается дугой.
- **Курсивная буквица** с росчерком в начале абзацев (у нас — Cinzel).
- **Липкое оглавление** слева с номерами глав (у нас — римские цифры).

## Решения по ходу сборки
- **Слово JULIUS + венок → Цезарь:** при скролле из hero слово рассыпается в частицы и собирается в стеклянный бюст в Intro, венок ложится на голову; финал — скан-линия снизу вверх.
- **Наведение на проекты:** блочная деформация по траектории курсора (как футер ChainGPT Labs). Альтернатива «частицы-магнит» лежит в `components/work/HoverParticles.tsx`.
- **Порядок главной:** Hero → Intro (Цезарь) → II · Opera Selecta (проекты) → III · Virtvtes (гиперпрыжок: пролёт сквозь венок, VENI/VIDI/VICI, кольца + 4 ценности, «LEGIO. MEET THE TEAM.») → **команда (вариант А — гравюры)** → цифры/отзыв → финал.

## На заметку (от заказчика)
- **Курсор:** свой курсор, который по-разному взаимодействует с элементами в каждой секции (напр. в hero — притягивается к слову/венку, в работах — превращается в «VIEW», в команде — подсвечивает гравюру и т.д.). Продумать при сборке каждой секции.
- **GSAP skills** (https://github.com/greensock/gsap-skills) — набор подсказок для Claude по GSAP. GSAP уже стоит в проекте; skills можно подключить, когда начнём анимации секций.

## Порядок работы
1. Каркас проекта + Hero (довести до идеала)
2. Intro + переход фона
3. Selected work
4. Венок → гиперпрыжок
5. Цифры, отзыв, финал
6. Мобильная версия, производительность
7. Страницы «Проекты» и «О нас»

## Тексты — черновик v1 (на обсуждение)

**Hero**
- Крупно: **WE BUILD PRODUCTS THAT SHIP.**
  - варианты: *IDEAS IN. PRODUCTS OUT.* / *FROM IDEA TO LAUNCH. NO DETOURS.*
- Левая колонка: Software studio / Est. MMXXI
- Средняя колонка (моно): Strategy. Design. Code. / One team, one roof.
- Правая колонка (моно): Julius is a product studio from Petah Tikva. Founded by veterans of elite tech units, we design and build software end to end — with AI built into how we work.

**Intro (проявляется по скроллу)**
- We turn rough ideas into products people use. 140+ launches in five years — CRMs, marketplaces, energy platforms, consumer apps.
- *(серым, проявляется)* Behind Mifrat, BuyByPower, Solya and FindMe — and the internal systems that run whole groups of companies.

**Selected work**
- Заголовок: SELECTED WORK — I / XVII
- Подпись: 140+ projects. Five years. Here are a few.

**Гиперпрыжок**
- VENI. **WE LISTEN.** → VIDI. **WE DESIGN.** → VICI. **WE SHIP.**
- Вокруг колец (ценности):
  - Excellence — never “close enough”.
  - Precision — plan first, build once.
  - Innovation — new tech when it serves the product.
  - Partnership — partners, not vendors.

**Цифры + отзыв**
- 140+ products launched · 5 years · 1 team, start to finish
- “I've been working with Julius for four years. They built several internal systems that run across our group of companies.” — Nevo Adisol, CEO

**Финал**
- Крупно: **GOT AN IDEA? LET'S SHIP IT.**
- gal@julius-agency.co.il · +972-52-667-6446 · BSR City, Building C, Floor 11, Petah Tikva · LinkedIn
