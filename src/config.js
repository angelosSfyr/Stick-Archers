// Tunables shared by the whole game. Numbers that belong to one piece of content
// (a weapon, an arrow type, a class, a power-up, an arena) live in src/data/.
export const W = 1600, H = 900;            // logical screen size, scaled to fit the window
export const GRAVITY = 1000;               // px/s^2
export const SWEEP_SPEED = 60;             // degrees/second while holding LT
export const MIN_ANGLE = -20, MAX_ANGLE = 85;
export const BOW_DOWN = -60;               // bow angle when it's not your turn; every turn starts from here
export const HANDOFF_TIME = 0.35;          // pause between a shot and the next player's turn
export const HOLD_TIME = 0.7;              // seconds holding LT+RT that count as a "hold"
export const COUNTDOWN = 3;
export const PLATFORM_RISE = 330;          // how high the 2nd player's platform is above the ground
export const PLATFORM_BACK = 80;           // ...and how far behind the 1st player
export const ARROW_LEN = 56;
export const TRIGGER_PRESS = 0.5, TRIGGER_RELEASE = 0.3;
export const SPEED_SCALE = [0, 0.55, 0.75, 1, 1.3, 1.65]; // arrow speed level 1..5 (same path, faster flight)
export const WIND_MAX = 140;               // sideways push on arrows at full wind, px/s^2
export const OWN_VIEW_ZOOM = 1.25;         // zoom of the "only my team" camera
export const BOT_START_ERR = 0.22, BOT_MIN_ERR = 0.05, BOT_ERR_DECAY = 0.75;
export const HARD_HIT_POWER = 0.7;         // arrows shot with at least this power knock platform archers off
export const FALL_DAMAGE = 15;
export const SHAKY_SHOTS = 2;              // shots with a trembling bow after an arm hit
export const BLOOD = '#a8101b';

export const PLAYER_COLORS = ['#1f6feb', '#d93636', '#1a9e4b', '#e08a00'];
export const BOT_COLOR = '#777';
