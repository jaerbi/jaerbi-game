export type LangCode = 'en' | 'uk';
export type TranslationKey =
  | 'SHAPE_TACTICS'
  | 'TURN_BASED_STRATEGY'
  | 'FEEDBACK_MODULE'
  | 'AUTO_ENGAGE'
  | 'SYSTEM_LOG'
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
  | 'INFO';

  export const translations: Record<TranslationKey, Record<LangCode, string>> = {
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
  AUTO_ENGAGE: {
    en: 'Auto Engage',
    uk: 'Автопілот',
  },
  SYSTEM_LOG: {
    en: 'Logbook',
    uk: 'Реєстри',
  },
};

export function translate(key: TranslationKey, lang: LangCode): string {
  const table = translations[key];
  if (!table) return key;
  return table[lang] ?? table['en'];
}
