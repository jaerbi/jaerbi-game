export type LangCode = 'en' | 'uk';
export type TranslationKey =
  | 'SHAPE_TACTICS'
  | 'TURN_BASED_STRATEGY'
  | 'FEEDBACK_MODULE'
  | 'STRATEGIC_PLAN'
  | 'AUTO_ENGAGE'
  | 'SYSTEM_LOG'
  | 'COMMUNITY_SIGNALS'
  | 'RETURN_TO_MAP'
  | 'DEPLOY_REPORT'
  | 'OPERATOR_ONLINE'
  | 'EFFICIENCY_RATING'
  | 'TACTICAL_NOTE'
  | 'TRANSMIT_REPORT'
  | 'FEEDBACK_VALIDATION_RANGE'
  | 'FEEDBACK_LIMIT_REACHED'
  | 'FEEDBACK_SUBMITTED'
  | 'COMMUNITY_SIGNALS_TABLE'
  | 'TOGGLE_BACK'
  | 'VIEW_FULL_ARCHIVE'
  | 'TABLE_OPERATOR'
  | 'TABLE_RATING'
  | 'TABLE_MESSAGE'
  | 'TABLE_DATE'
  | 'NO_SIGNALS'
  | 'PREVIOUS'
  | 'NEXT'
  | 'GAME_GUIDE'
  | 'VICTORY_CONDITIONS'
  | 'MONOPOLY_LABEL'
  | 'MONOPOLY_DESC'
  | 'ANNIHILATION'
  | 'ANNIHILATION_DESC'
  | 'UNIT_EVOLUTION'
  | 'NEW_UNIT_EVOLUTION'
  | 'EVOLUTION'
  | 'EVOLUTION_DESC'
  | 'COMBAT_DEEP_DIVE'
  | 'SUCCESSFUL_ATTACK'
  | 'SUCCESSFUL_ATTACK_DESC'
  | 'CRITICAL_HIT'
  | 'CRITICAL_HIT_DESC'
  | 'MISS'
  | 'MISS_DESC'
  | 'MOVEMENT'
  | 'T1_1_TILE'
  | 'T3_3_TILES'
  | 'T4_4_TILES'
  | 'FOREST_CYCLE'
  | 'TURN_1'
  | 'TURN_2'
  | 'PLUS_8_WOOD_PER_TURN'
  | 'WALL_LEGEND'
  | 'AI_FACTION'
  | 'RANKING'
  | 'RECORDS'
  | 'RELOAD'
  | 'VERIFIED'
  | 'LOGOUT'
  | 'CONNECT'
  | 'COMMANDER'
  | 'PLAYER'
  | 'TURN_CYCLE'
  | 'MONOPOLY'
  | 'LFT'
  | 'HOSTILE'
  | 'ECONOMIC_DOMINATION_GREETING'
  | 'CONFIRM_NAME'
  | 'SAVE_SCORE'
  | 'PLAY_AGAIN'
  | 'VIEW_LEADERBOARD'
  | 'SUPPORT'
  | 'CD'
  | 'RISK'
  | 'BABY'
  | 'NORMAL'
  | 'HARD'
  | 'NIGHTMARE'
  | 'ENGAGE'
  | 'AUTO'
  | 'ALL'
  | 'MAP_HACK'
  | 'Action_LOG'
  | 'CLEAR'
  | 'COMBAT_ONLY'
  | 'NOT_LOGS_DATA'
  | 'SYSTEM_SETTINGS'
  | 'TACTICAL_DIFF'
  | 'LEVEL_SELECTION'
  | 'SECTOR_DIMENSIONS'
  | 'HIGH_SCORES'
  | 'CURRENT'
  | 'TOP_3_PLAYER'
  | 'TOP_3_LOSES_PLAYER'
  | 'TURNS'
  | 'NO_RECORDS_YET'
  | 'CHANGE_RECORDS_INFO'
  | 'NEXT_TURN'
  | 'SETTINGS'
  | 'NEW_DESIGN_UNIT'
  | 'INFO';

  export const translations: Record<TranslationKey, Record<LangCode, string>> = {
    NEW_DESIGN_UNIT: {
      en: 'New Evolution',
      uk: `Нова еволюція`,
    },
    SETTINGS: {
      en: 'Settings',
      uk: `Налаштування`,
    },
    NEXT_TURN: {
      en: 'Next Turn',
      uk: `Кінець ходу`,
    },
    CHANGE_RECORDS_INFO: {
      en: 'Change Difficulty or Map Size in Settings to view other boards.',
      uk: `Змініть складність або розмір карти в налаштуваннях, щоб переглянути інші дошки.`,
    },
    NO_RECORDS_YET: {
      en: 'No records yet',
      uk: `Поки що немає записів`,
    },
    TURNS: {
      en: 'turns',
      uk: `ходів`,
    },
    TOP_3_LOSES_PLAYER: {
      en: 'Player Loses (Top 3)',
      uk: `Програші гравців (Топ-3)`,
    },
    TOP_3_PLAYER: {
      en: 'Player Wins (Top 3)',
      uk: `Перемоги гравців (топ-3)`,
    },
    CURRENT: {
      en: 'Current',
      uk: `Поточний`,
    },
    HIGH_SCORES: {
      en: 'High Scores',
      uk: `Рекорди`,
    },
    SECTOR_DIMENSIONS: {
      en: 'Sector Dimensions',
      uk: `Розміри карти`,
    },
    LEVEL_SELECTION: {
      en: 'Level Selection',
      uk: `Вибір рівня`,
    },
    TACTICAL_DIFF: {
      en: 'Tactical Difficulty',
      uk: `Тактична складність`,
    },
    SYSTEM_SETTINGS: {
      en: 'System Settings',
      uk: `Системні налаштування`,
    },
    NOT_LOGS_DATA: {
      en: 'No logs to display',
      uk: `Немає записів для відображення`,
    },
    COMBAT_ONLY: {
      en: 'Combat Only',
      uk: `Тільки бойові дії`,
    },
    CLEAR: {
      en: 'Clear',
      uk: `Очистити`,
    },
    Action_LOG: {
      en: 'Action Log',
      uk: `Журнал Дій`,
    },
    MAP_HACK: {
      en: 'Map Hack',
      uk: `Мап-хак`,
    },
    ALL: {
      en: 'ALL',
      uk: `ВСІ`,
    },
    ENGAGE: {
      en: 'ENGAGE',
      uk: `Автопілот`,
    },
    AUTO: {
      en: 'AUTO',
      uk: ``,
    },
    NIGHTMARE: {
      en: 'Nightmare',
      uk: `Cтрахіття`,
    },
    HARD: {
      en: 'Hard',
      uk: `Дужий`,
    },
    NORMAL: {
      en: 'Normal',
      uk: `Звичайний`,
    },
    BABY: {
      en: 'Baby',
      uk: `Маля`,
    },
    RISK: {
      en: 'Mission Risk',
      uk: `Ризик Місії`,
    },
    CD: {
      en: 'CD',
      uk: `ЧВ`,
    },
    SUPPORT: {
      en: 'Support',
      uk: `Засоби для Існування`,
    },
    VIEW_LEADERBOARD: {
      en: 'View Leaderboard',
      uk: `Переглянути таблицю лідерів`,
    },
    SAVE_SCORE: {
      en: 'Save Score',
      uk: `Зберегти результат`,
    },
    PLAY_AGAIN: {
      en: 'Play Again',
      uk: `Грати знову`,
    },
    CONFIRM_NAME: {
      en: 'Confirm Player Name',
      uk: `Підтвердьте ім'я гравця`,
    },
    ECONOMIC_DOMINATION_GREETING: {
      en: 'ECONOMIC DOMINATION! Forest majority held for 10 turns.',
      uk: 'ЕКОНОМІЧНА ДОМІНАЦІЯ! Лісова більшість утримується протягом 10 ходів.',
    },
    HOSTILE: {
      en: 'Hostile',
      uk: 'Противник',
    },
    LFT: {
      en: 'LFT',
      uk: 'ходів',
    },
    MONOPOLY: {
      en: 'Monopoly:',
      uk: 'Монополія: залишилося',
    },
    TURN_CYCLE: {
      en: 'Turn Cycle',
      uk: 'Цикл ходів',
    },
    PLAYER: {
      en: 'Player',
      uk: 'Гравець',
    },
    COMMANDER: {
      en: 'Commander',
      uk: 'Командуючий',
    },
    CONNECT: {
      en: 'Connect',
      uk: 'Підключення',
    },
    LOGOUT: {
      en: 'Logout',
      uk: 'Вихід',
    },
    VERIFIED: {
      en: 'Verified User',
      uk: 'Авторизовано',
    },
  RELOAD: {
    en: 'Reload',
    uk: 'Рестарт',
  },
  INFO: {
    en: 'Info',
    uk: 'Правила',
  },
  RECORDS: {
    en: 'Records',
    uk: 'Рекорди',
  },
  RANKING: {
    en: 'Ranking',
    uk: 'Рейтинг',
  },
  SHAPE_TACTICS: {
    en: 'Shape Tactics',
    uk: 'Shape Tactics',
  },
  TURN_BASED_STRATEGY: {
    en: 'Turn-Based Strategy',
    uk: 'Покрокова Стратегія',
  },
  FEEDBACK_MODULE: {
    en: 'Feedbacks',
    uk: "Відгуки",
  },
  STRATEGIC_PLAN: {
    en: 'Roadmap',
    uk: 'Стратегічний План',
  },
  AUTO_ENGAGE: {
    en: 'Auto Engage',
    uk: 'Автопілот',
  },
  SYSTEM_LOG: {
    en: 'Logbook',
    uk: 'Реєстри',
  },
  COMMUNITY_SIGNALS: {
    en: 'Community Signals',
    uk: 'Сигнали Спільноти',
  },
  RETURN_TO_MAP: {
    en: 'Return to Map',
    uk: 'Повернутись до Мапи',
  },
  DEPLOY_REPORT: {
    en: 'Deploy Report',
    uk: 'Надіслати Звіт',
  },
  OPERATOR_ONLINE: {
    en: 'OPERATOR ONLINE',
    uk: 'ОПЕРАТОР НА ЗВ’ЯЗКУ',
  },
  EFFICIENCY_RATING: {
    en: 'Efficiency Rating',
    uk: 'Коефіцієнт Ефективності',
  },
  TACTICAL_NOTE: {
    en: 'Tactical Note',
    uk: 'Тактична Примітка',
  },
  TRANSMIT_REPORT: {
    en: 'Transmit Report',
    uk: 'Передати Дані',
  },
  FEEDBACK_VALIDATION_RANGE: {
    en: 'Text must be between 10 and 500 characters.',
    uk: 'Текст має містити від 10 до 500 символів.',
  },
  FEEDBACK_LIMIT_REACHED: {
    en: 'Daily limit reached: 3 feedbacks per 24 hours.',
    uk: 'Досягнуто денний ліміт: 3 відгуки за 24 години.',
  },
  FEEDBACK_SUBMITTED: {
    en: 'Thanks! Your feedback was submitted.',
    uk: 'Дякуємо! Ваш відгук надіслано.',
  },
  COMMUNITY_SIGNALS_TABLE: {
    en: 'Community Signals Table',
    uk: 'Таблиця Сигналів Спільноти',
  },
  TOGGLE_BACK: {
    en: 'Back',
    uk: 'Назад',
  },
  VIEW_FULL_ARCHIVE: {
    en: 'View Full Archive',
    uk: 'Повний Архів',
  },
  TABLE_OPERATOR: {
    en: 'Operator',
    uk: 'Оператор',
  },
  TABLE_RATING: {
    en: 'Rating',
    uk: 'Оцінка',
  },
  TABLE_MESSAGE: {
    en: 'Message',
    uk: 'Повідомлення',
  },
  TABLE_DATE: {
    en: 'Date',
    uk: 'Дата',
  },
  NO_SIGNALS: {
    en: 'No signals',
    uk: 'Немає сигналів',
  },
  PREVIOUS: {
    en: 'Previous',
    uk: 'Попередня',
  },
  NEXT: {
    en: 'Next',
    uk: 'Наступна',
  },
  GAME_GUIDE: {
    en: 'Game Guide',
    uk: 'Польовий Довідник',
  },
  VICTORY_CONDITIONS: {
    en: 'Victory Conditions',
    uk: 'Умови Перемоги',
  },
  MONOPOLY_LABEL: {
    en: 'Monopoly',
    uk: 'Монополія',
  },
  MONOPOLY_DESC: {
    en: 'Hold forest majority for 10 turns.',
    uk: 'Утримуйте більшість лісів протягом 10 ходів.',
  },
  ANNIHILATION: {
    en: 'Annihilation',
    uk: 'Знищення',
  },
  ANNIHILATION_DESC: {
    en: 'Reduce enemy Base HP to 0.',
    uk: 'Зменште HP бази противника до 0.',
  },
  UNIT_EVOLUTION: {
    en: 'Unit Evolution',
    uk: 'Еволюція Юнітів',
  },
  NEW_UNIT_EVOLUTION: {
    en: 'New Unit Evolution',
    uk: 'Нова Еволюція Юнітів',
  },
  EVOLUTION: {
    en: 'Evolution',
    uk: 'Еволюція',
  },
  EVOLUTION_DESC: {
    en: 'Two T2 merge into a T3.',
    uk: 'Дві T2 зливаються у T3.',
  },
  COMBAT_DEEP_DIVE: {
    en: 'Combat Deep-Dive',
    uk: 'Бойовий Аналіз',
  },
  SUCCESSFUL_ATTACK: {
    en: 'Successful Attack',
    uk: 'Успішна Атака',
  },
  SUCCESSFUL_ATTACK_DESC: {
    en: 'Attacker tier ≥ defender; defender downgraded or destroyed.',
    uk: 'Ранг атакуючого ≥ захисника; захисник понижується або знищується.',
  },
  CRITICAL_HIT: {
    en: 'Critical Hit',
    uk: 'Критичний Удар',
  },
  CRITICAL_HIT_DESC: {
    en: 'Chance-based bonus (tier-scaled)',
    uk: 'Ймовірнісний бонус (залежить від рангу)',
  },
  MISS: {
    en: 'Miss',
    uk: 'Промах',
  },
  MISS_DESC: {
    en: 'Attack can MISS; lower effective impact.',
    uk: 'Атака може ПРОМАХНУТИСЯ; знижений ефект.',
  },
  MOVEMENT: {
    en: 'Movement',
    uk: 'Маневрування',
  },
  T1_1_TILE: {
    en: 'T1: 1 tile',
    uk: 'T1: 1 клітинка',
  },
  T3_3_TILES: {
    en: 'T3: 3 tiles',
    uk: 'T3: 3 клітинки',
  },
  T4_4_TILES: {
    en: 'T4: 4 tiles',
    uk: 'T4: 4 клітинки',
  },
  FOREST_CYCLE: {
    en: 'Forest Cycle',
    uk: 'Цикл Лісу',
  },
  TURN_1: {
    en: 'Turn 1',
    uk: 'Хід 1',
  },
  TURN_2: {
    en: 'Turn 2',
    uk: 'Хід 2',
  },
  PLUS_8_WOOD_PER_TURN: {
    en: '+8 Wood/turn',
    uk: '+8 дерева/хід',
  },
  WALL_LEGEND: {
    en: 'Wall Legend',
    uk: 'Легенда Стін',
  },
  AI_FACTION: {
    en: 'AI',
    uk: 'AI',
  },
};

export function translate(key: TranslationKey, lang: LangCode): string {
  const table = translations[key];
  if (!table) return key;
  return table[lang] ?? table['en'];
}
