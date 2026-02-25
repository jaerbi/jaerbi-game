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
    | 'TURN_3'
    | 'TURN_4'
    | 'PLUS_8_WOOD_PER_TURN'
    | 'PLUS_2_IRON_PER_TURN'
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
    | 'IRON_CYCLE'
    | 'SHAPE_TACTIC_DESCRIPTION'
    | 'TOWER_DEFFENCE_DESCRIPTION'
    | 'EXIT_GAME'
    | 'MONEY'
    | 'LIVES'
    | 'WAVE'
    | 'WAVES'
    | 'RESET'
    | 'INTEL'
    | 'WAVE_IN_PROGRESS'
    | 'START_WAVE'
    | 'BUY_DEFENDER'
    | 'DEFENDER_INFO'
    | 'TIER'
    | 'LEVEL'
    | 'DAMAGE'
    | 'RANGE'
    | 'UPGRADE'
    | 'MAX_LEVEL'
    | 'SELL'
    | 'SELECT_BUILD_TILE'
    | 'TO_PLACE_DEFENDER'
    | 'GAME_OVER'
    | 'YOU_SURVIVED'
    | 'TRY_AGAIN'
    | 'ABILITY_ACTIVE'
    | 'BUY_ABILITY'
    | 'FROST_AURA'
    | 'FROST_AURA_INFO'
    | 'CHAIN_LIGHTNING'
    | 'CHAIN_LIGHTNING_INFO'
    | 'SHATTER_INFO'
    | 'SHATTER'
    | 'FINAL_STRIKE'
    | 'FINAL_STRIKE_INFO'
    | 'MASTERIES'
    | 'BACK_TO_DEFENSE'
    | 'TOTAL_XP'
    | 'SPENT'
    | 'AVAILABLE'
    | 'LOG_IN_MASTERY_MSG'
    | 'NEED_LOG_IN'
    | 'LOGIN_GOOGLE'
    | 'MASTERIES_SUBTITLE'
    | 'PER_LEVEL'
    | 'REQUIRES_5_POINTS'
    | 'SAVE_CHANGES'
    | 'SAVING'
    | 'SAVED'
    | 'COST'
    | 'MAXED'
    | 'LOCAL_STORAGE_MSG'
    | 'T1_NAME'
    | 'T1_GOLDEN_TITLE'
    | 'T1_GOLDEN_DESC'
    | 'T2_NAME'
    | 'T2_GOLDEN_TITLE'
    | 'T2_GOLDEN_DESC'
    | 'T3_NAME'
    | 'T3_GOLDEN_TITLE'
    | 'T3_GOLDEN_DESC'
    | 'T4_NAME'
    | 'T4_GOLDEN_TITLE'
    | 'T4_GOLDEN_DESC'
    | 'T5_NAME'
    | 'T5_GOLDEN_TITLE'
    | 'T5_GOLDEN_DESC'
    | 'T6_NAME'
    | 'T6_GOLDEN_TITLE'
    | 'T6_GOLDEN_DESC'
    | 'T7_NAME'
    | 'T7_GOLDEN_TITLE'
    | 'T7_GOLDEN_DESC'
    | 'GOLD_MASTERY'
    | 'GOLD_MASTERY_INFO'
    | 'THANK_SUPPORTING'
    | 'OPEN_LINK'
    | 'COPY_LINK'
    | 'SUPPORT_COMMUNITY'
    | 'MONOBANK_JAR'
    | 'SOCIAL_FEEDBACK'
    | 'SPEED'
    | 'TARGETING'
    | 'FIRST'
    | 'WEAKEST'
    | 'STRONGEST'
    | 'RANDOM'
    | 'NAPALM_STRIKE'
    | 'NAPALM_STRIKE_INFO'
    | 'REFRACTION_BEAM'
    | 'REFRACTION_BEAM_INFO'
    | 'NEUROTOXIN'
    | 'NEUROTOXIN_INFO'
    | 'DAMAGE_STATS'
    | 'DAMAGE_STATS_DESC'
    | 'NO_DATA'
    | 'SELECT_TILE_TO_BUILD'
    | 'CAMPAIGN'
    | 'COMMENCE'
    | 'ENGAGED'
    | 'CREDITS'
    | 'SHIELDS'
    | 'INFO';

export const translations: Record<TranslationKey, Record<LangCode, string>> = {
    SHIELDS: { en: 'Shields', uk: `Щити` },
    CREDITS: { en: 'Credits', uk: `Кредити` },
    ENGAGED: { en: 'In Battle', uk: `У бою` },
    COMMENCE: { en: 'Engage', uk: `До бою!` },
    CAMPAIGN: { en: 'Campaign', uk: `Кампанія` },
    SELECT_TILE_TO_BUILD: { en: 'Select an empty tile to build', uk: `Оберіть вільну ділянку для будівництва` },
    DAMAGE_STATS: { en: 'Damage Statistics', uk: `Статистика шкоди` },
    NO_DATA: { en: 'No data yet', uk: `Дані відсутні` },
    DAMAGE_STATS_DESC: { en: 'Cumulative damage dealt by each tower type', uk: `Сумарна шкода за типами веж` },
    RANDOM: { en: 'Random', uk: `Випадковий` },
    STRONGEST: { en: 'Strongest', uk: `Найсильніший` },
    WEAKEST: { en: 'Weakest', uk: `Найслабший` },
    FIRST: { en: 'First', uk: `Перший` },
    SPEED: { en: 'Speed', uk: `Швидкість` },
    TARGETING: { en: 'Targeting', uk: `Таргетинг` },
    SOCIAL_FEEDBACK: { en: 'Social & Feedback', uk: `Соціальні мережі та зворотний зв'язок` },
    MONOBANK_JAR: { en: 'Monobank Jar', uk: 'Банка Monobank' },
    SUPPORT_COMMUNITY: { en: 'Support & Community', uk: 'Підтримка та спільнота' },
    COPY_LINK: { en: 'Copy Link', uk: 'Копіювати посилання' },
    OPEN_LINK: { en: 'Open Link', uk: 'Відкрити посилання' },
    THANK_SUPPORTING: { en: 'Thank you for supporting the project!', uk: 'Дякую за підтримку проєкту!' },
    MASTERIES: { en: 'Masteries', uk: 'Вміння' },
    GOLD_MASTERY: { en: 'Gold Mastery', uk: 'Золота майстерність' },
    GOLD_MASTERY_INFO: { en: 'Lv 1-7: +5% gold per kill. Lv 8-14: +10% per kill and extra starting gold. Lv 15-20: higher gold and bonus after each wave.', uk: 'Рівні 1-7: +5% золота за вбивство. Рівні 8-14: +10% за вбивство та додаткове початкове золото. Рівні 15-20: більше золота та бонус після кожної хвилі.' },
    BACK_TO_DEFENSE: { en: 'Back to Defense', uk: 'Назад до захисту' },
    TOTAL_XP: { en: 'XP', uk: 'Досвід' },
    SPENT: { en: 'Spent', uk: 'Витрачено' },
    AVAILABLE: { en: 'Available', uk: 'Доступно' },
    LOG_IN_MASTERY_MSG: { en: 'Log in to earn and spend Mastery XP.', uk: 'Увійдіть, щоб заробляти та витрачати досвід майстерності.' },
    NEED_LOG_IN: { en: 'You need to be logged in to earn XP and unlock Masteries.', uk: 'Вам потрібно увійти, щоб заробляти досвід та відкривати Вміння.' },
    LOGIN_GOOGLE: { en: 'Login with Google', uk: 'Увійти через Google' },
    MASTERIES_SUBTITLE: { en: 'Spend points to permanently improve each tower tier.', uk: 'Витрачайте очки, щоб назавжди покращити кожен тир веж.' },
    DAMAGE: { en: 'Damage', uk: 'Шкода' },
    RANGE: { en: 'Range', uk: 'Дальність' },
    PER_LEVEL: { en: 'per level', uk: 'за рівень' },
    REQUIRES_5_POINTS: { en: 'Requires 15 points in tier.', uk: 'Потрібно 15 очок в тирі' },
    SAVE_CHANGES: { en: 'Save Changes', uk: 'Зберегти зміни' },
    SAVING: { en: 'Saving...', uk: 'Збереження...' },
    SAVED: { en: 'Saved', uk: 'Збережено' },
    COST: { en: 'Cost', uk: 'Вартість' },
    MAXED: { en: 'MAXED', uk: 'МАКС' },
    LOCAL_STORAGE_MSG: { en: 'Changes are stored locally until you save.', uk: 'Зміни зберігаються локально, поки ви їх не збережете.' },
    // Ключі для описів тирів
    T1_NAME: { en: 'Tier 1 – Frost', uk: 'Тир 1 – Мороз' },
    T1_GOLDEN_TITLE: { en: 'Frost Aura', uk: 'Аура морозу' },
    T1_GOLDEN_DESC: { en: 'Slow enemies by an extra 10% and increase aura radius.', uk: 'Уповільнює ворогів на додаткові 10% та збільшує радіус аури.' },
    // Tier 2
    T2_NAME: {
        en: 'Tier 2 – Precision',
        uk: 'Тир 2 – Точність',
    },
    T2_GOLDEN_TITLE: {
        en: 'Critical Focus',
        uk: 'Критичне фокусування',
    },
    T2_GOLDEN_DESC: {
        en: 'Boosts Ricochet: higher trigger chance and up to 150%+ damage.',
        uk: 'Підсилює рикошет: вищий шанс активації та до 150%+ шкоди.',
    },

    // Tier 3
    T3_NAME: {
        en: 'Tier 3 – Impact',
        uk: 'Тир 3 – Удар',
    },
    T3_GOLDEN_TITLE: {
        en: 'Concussive Blasts',
        uk: 'Контузійні вибухи',
    },
    T3_GOLDEN_DESC: {
        en: 'Concussive blasts: stronger stun chance and duration on shattered foes.',
        uk: 'Контузійні вибухи: вищий шанс і тривалість оглушення розбитих ворогів.',
    },

    // Tier 4
    T4_NAME: {
        en: 'Tier 4 – Storm',
        uk: 'Тир 4 – Шторм',
    },
    T4_GOLDEN_TITLE: {
        en: 'Chain Lightning',
        uk: 'Ланцюгова блискавка',
    },
    T4_GOLDEN_DESC: {
        en: 'Chance to chain attack and strike an additional target.',
        uk: 'Шанс на ланцюгову атаку по додатковій цілі.',
    },
    T5_NAME: {
        en: 'Tier 5 – Inferno',
        uk: 'Тир 5 – Інферно',
    },
    T5_GOLDEN_TITLE: {
        en: 'Chain Reaction',
        uk: 'Ланцюгова реакція',
    },
    T5_GOLDEN_DESC: {
        en: 'Kills from Inferno or Napalm cause explosions for 50% of max HP.',
        uk: 'Убивства від Інферно чи напалму спричиняють вибухи на 50% від макс. HP.',
    },
    T6_NAME: {
        en: 'Tier 6 – Prism',
        uk: 'Тир 6 – Призма',
    },
    T6_GOLDEN_TITLE: {
        en: 'Spectrum Break',
        uk: 'Спектральний розлом',
    },
    T6_GOLDEN_DESC: {
        en: 'Increases ramp-up cap to +300% and adds +15% taken damage.',
        uk: 'Підвищує ліміт нарощення до +300% та додає +15% отримуваної шкоди.',
    },
    T7_NAME: {
        en: 'Tier 7 – Venom',
        uk: 'Тир 7 – Отрута',
    },
    T7_GOLDEN_TITLE: {
        en: 'Septic Shock',
        uk: 'Септичний шок',
    },
    T7_GOLDEN_DESC: {
        en: 'Neurotoxin causes stronger slow and heavier stacking poison over time.',
        uk: 'Нейротоксин сильніше сповільнює та посилює накопичення отрути з часом.',
    },
    FINAL_STRIKE_INFO: {
        en: 'Execute: Crit on enemies below 50% HP. Bosses take even more damage.',
        uk: `Екзекуція: критичний удар по ворогах з HP нижче 50%. Боси отримують ще більше шкоди.`,
    },
    FINAL_STRIKE: {
        en: 'Final Strike',
        uk: `Останній удар`,
    },
    SHATTER_INFO: {
        en: 'Each hit adds 1 stack (Max 5). Damage is multiplied by (1 + stacks * 0.20). (Stack up to +100% dmg).',
        uk: `Кожен удар додає 1 заряд (максимум 5). Шкода множиться на (1 + заряди * 0.20). (Накопичується до +100% шкоди).`,
    },
    SHATTER: {
        en: 'Shatter',
        uk: `Розколоти`,
    },
    CHAIN_LIGHTNING_INFO: {
        en: 'Chance for shots to ricochet and deal up to 150% damage to nearby enemies.',
        uk: `Шанс рикошету пострілу та нанесення до 150% шкоди сусіднім ворогам.`,
    },
    CHAIN_LIGHTNING: {
        en: 'Chain Lightning',
        uk: `Ланцюгова блискавка`,
    },
    FROST_AURA_INFO: {
        en: 'Apply 30% slow to enemies in range.',
        uk: `Уповільнює ворогів у радіусі дії на 30%.`,
    },
    FROST_AURA: {
        en: 'Frost Aura',
        uk: `Морозна аура`,
    },
    REFRACTION_BEAM: { en: 'Refraction Beam', uk: `Заломлення променя` },
    REFRACTION_BEAM_INFO: { en: 'Allows attacking up to 3 targets simultaneously. Each beam benefits from the laser ramp-up bonus.', uk: `Дозволяє атакувати до 3 цілей одночасно. Кожна ціль отримує бонус від наростання потужності лазера.` },
    NAPALM_STRIKE: { en: 'Напалмовий удар', uk: `Напалмовий удар` },
    NAPALM_STRIKE_INFO: { en: 'Leaves a fire zone for 4s, dealing 50% tower damage per second to all enemies in the blast radius.', uk: `Залишає вогняну зону на 4 сек., що наносить 50% шкодау щосекунди всім ворогам у радіусі вибуху.` },
    NEUROTOXIN: { en: 'Neurotoxin', uk: `Нейротоксин` },
    NEUROTOXIN_INFO: { en: 'Poison now slows enemies by 20%.', uk: `Отрута тепер уповільнює ворогів на 20%.` },
    BUY_ABILITY: {
        en: 'Buy Ability',
        uk: `Купити Здібність`,
    },
    ABILITY_ACTIVE: {
        en: 'Ability Active',
        uk: `Активна здатність`,
    },
    TRY_AGAIN: {
        en: 'TRY AGAIN',
        uk: `СПРОБУЙТЕ ЗНОВУ`,
    },
    WAVES: {
        en: 'waves',
        uk: `хвиль`,
    },
    YOU_SURVIVED: {
        en: 'You survived',
        uk: `Ти вижив`,
    },
    GAME_OVER: {
        en: 'GAME OVER',
        uk: `ГРА ЗАКІНЧЕНА`,
    },
    TO_PLACE_DEFENDER: {
        en: 'to place a defender',
        uk: `щоб розмістити захисника`,
    },
    SELECT_BUILD_TILE: {
        en: 'Select a buildable tile',
        uk: `Виберіть плитку для будівництва,`,
    },
    SELL: {
        en: 'SELL',
        uk: `ПРОДАТИ`,
    },
    MAX_LEVEL: {
        en: 'MAX LEVEL',
        uk: `МАКС РІВЕНЬ`,
    },
    UPGRADE: {
        en: 'UPGRADE',
        uk: `ОНОВЛЕННЯ`,
    },
    TIER: {
        en: 'Tier',
        uk: `Ранг`,
    },
    LEVEL: {
        en: 'Level',
        uk: `Рівень`,
    },
    DEFENDER_INFO: {
        en: 'Defender Info',
        uk: `Інформація про захисника`,
    },
    BUY_DEFENDER: {
        en: 'Buy Defender',
        uk: `Купити Захисника`,
    },
    START_WAVE: {
        en: 'START WAVE',
        uk: `ПОЧАТОК ХВИЛІ`,
    },
    WAVE_IN_PROGRESS: {
        en: 'WAVE IN PROGRESS',
        uk: `ХВИЛЯ В ПРОЦЕСІ`,
    },
    RESET: {
        en: 'Reset',
        uk: `Скинути`,
    },
    INTEL: {
        en: 'Intel',
        uk: `Дані`,
    },
    WAVE: {
        en: 'WAVE',
        uk: `ХВИЛЯ`,
    },
    LIVES: {
        en: 'LIVES',
        uk: `ЖИТТЯ`,
    },
    MONEY: {
        en: 'MONEY',
        uk: `ГРОШІ`,
    },
    EXIT_GAME: {
        en: 'EXIT GAME',
        uk: `ВИХІД З ГРИ`,
    },
    TOWER_DEFFENCE_DESCRIPTION: {
        en: 'Shape Defense is here! Are you ready for a completely new strategy experience and fresh tactical challenges? Step into the battle now.',
        uk: 'Shape Defense вже тут! Чи готові ви до абсолютно нових стратегічних вражень та справжніх тактичних викликів? Вступайте в бій прямо зараз.',
    },
    SHAPE_TACTIC_DESCRIPTION: {
        en: 'Strategic turn-based combat with AI and merging mechanics. Build your base, manage resources, and conquer the battlefield.',
        uk: `Стратегічний покроковий бій зі штучним інтелектом та об'єднаними механіками. Побудуйте свою базу, керуйте ресурсами та завойовуйте поле бою.`,
    },
    IRON_CYCLE: {
        en: 'Iron Cycle',
        uk: `Цикл Заліза`,
    },
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
    TURN_3: {
        en: 'Turn 3',
        uk: 'Хід 3',
    },
    TURN_4: {
        en: 'Turn 4',
        uk: 'Хід 4',
    },
    PLUS_8_WOOD_PER_TURN: {
        en: '+8 Wood/turn',
        uk: '+8 Дерева/хід',
    },
    PLUS_2_IRON_PER_TURN: {
        en: '+2 Iron/turn',
        uk: '+2 Заліза/хід',
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
