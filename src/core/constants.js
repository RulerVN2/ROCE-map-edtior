// Hằng số của Minecraft Java 1.20.1.
export const DATA_VERSION = 3465;
export const VERSION_NAME = '1.20.1';
export const MIN_Y = -64;
export const MAX_Y = 319; // khối cao nhất đặt được
export const WORLD_HEIGHT = 384;
export const SECTION_COUNT = WORLD_HEIGHT / 16; // 24
export const MIN_SECTION = MIN_Y / 16; // -4
export const CHUNK_VOLUME = 16 * 16 * WORLD_HEIGHT;
export const BIOME_CELLS = 4 * 4 * (WORLD_HEIGHT / 4);
