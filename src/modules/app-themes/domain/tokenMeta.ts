export type TokenMetaEntry = {
  readonly key: string;
  readonly group: string;
  readonly descriptionRu: string;
};

/** Mirrors Twilite design-system tokenMeta for AI + schema endpoint. */
export const APP_THEME_TOKEN_META: readonly TokenMetaEntry[] = [
  { key: 'surface', group: 'surface', descriptionRu: 'Главный фон экранов приложения' },
  {
    key: 'surfaceRaised',
    group: 'surface',
    descriptionRu: 'Приподнятая поверхность: карточки, модалки, панели',
  },
  {
    key: 'surfaceSunken',
    group: 'surface',
    descriptionRu: 'Утопленная поверхность: поля ввода, пустые зоны',
  },
  { key: 'surfaceDivider', group: 'surface', descriptionRu: 'Цвет разделителей и тонких границ' },
  {
    key: 'surfaceOverlay',
    group: 'surface',
    descriptionRu: 'Полупрозрачный слой поверх контента (оверлеи)',
  },
  { key: 'textPrimary', group: 'text', descriptionRu: 'Основной текст заголовков и тела' },
  { key: 'textSecondary', group: 'text', descriptionRu: 'Вторичный текст: подписи, метаданные' },
  {
    key: 'textTertiary',
    group: 'text',
    descriptionRu: 'Третичный текст: плейсхолдеры, подсказки',
  },
  { key: 'textInverted', group: 'text', descriptionRu: 'Текст на акцентных и тёмных заливках' },
  { key: 'accent', group: 'brand', descriptionRu: 'Главный акцент: CTA, активные элементы' },
  {
    key: 'accentSoft',
    group: 'brand',
    descriptionRu: 'Мягкий фон акцента (chips, soft highlight)',
  },
  { key: 'accentPressed', group: 'brand', descriptionRu: 'Акцент в состоянии нажатия' },
  { key: 'accentOn', group: 'brand', descriptionRu: 'Текст/иконка поверх акцентной заливки' },
  { key: 'secondary', group: 'brand', descriptionRu: 'Вторичный бренд-цвет' },
  { key: 'secondarySoft', group: 'brand', descriptionRu: 'Мягкий фон вторичного цвета' },
  { key: 'tertiary', group: 'brand', descriptionRu: 'Третичный бренд-цвет' },
  { key: 'tertiarySoft', group: 'brand', descriptionRu: 'Мягкий фон третичного цвета' },
  { key: 'positive', group: 'feedback', descriptionRu: 'Успех / позитивный статус' },
  { key: 'negative', group: 'feedback', descriptionRu: 'Ошибка / деструктивное действие' },
  { key: 'warning', group: 'feedback', descriptionRu: 'Предупреждение' },
  {
    key: 'glassTint',
    group: 'glass',
    descriptionRu: 'Оттенок стеклянных поверхностей (iOS blur tint)',
  },
  { key: 'glassRim', group: 'glass', descriptionRu: 'Обводка стеклянных панелей' },
  { key: 'glassRimAndroid', group: 'glass', descriptionRu: 'Обводка стекла на Android' },
  { key: 'glassFillAndroid', group: 'glass', descriptionRu: 'Заливка стекла на Android' },
  {
    key: 'controlActive',
    group: 'control',
    descriptionRu: 'Активное состояние контролов (switch, segment)',
  },
  { key: 'controlInactive', group: 'control', descriptionRu: 'Неактивное состояние контролов' },
  { key: 'controlTrack', group: 'control', descriptionRu: 'Трек слайдеров и переключателей' },
  { key: 'scrim', group: 'overlay', descriptionRu: 'Затемнение под модалками' },
  { key: 'skeleton', group: 'overlay', descriptionRu: 'Плейсхолдер загрузки (skeleton)' },
  { key: 'focusRing', group: 'overlay', descriptionRu: 'Кольцо фокуса для a11y' },
  {
    key: 'sceneBackgroundColors',
    group: 'scene',
    descriptionRu:
      'Градиент НЕБА сцены сверху вниз: 2–5 натуральных цветов (рассвет, ясный день, закат, ночь). Без кислотных и нереалистичных переходов. Согласовать с UI-палитрой.',
  },
];

export function buildThemeAiSystemPrompt(): string {
  const fields = APP_THEME_TOKEN_META.map((entry) => `- ${entry.key}: ${entry.descriptionRu}`).join(
    '\n',
  );

  return [
    'You generate a Twilite mobile app theme as a single JSON object.',
    'Return ONLY valid JSON, no markdown.',
    'Shape: { "name": string, "description": string, "colors": { ... }, "sceneBackgroundColors": string[] }',
    'colors must include every key below with a CSS color (#RRGGBB, #RRGGBBAA, or rgba()).',
    'sceneBackgroundColors is a vertical SKY gradient top→bottom, length 2–5, each #RRGGBB.',
    'Sky must look natural (dawn, day, sunset, night). No neon/unnatural gradients.',
    'UI colors and sky must feel coherent together.',
    'Field meanings:',
    fields,
  ].join('\n');
}
