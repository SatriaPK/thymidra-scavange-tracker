// Bentuk baris tabel (lihat schema.sql)

export interface Campaign {
  id: string;
  name: string;
  dm_code: string;
  active_zone_id: string | null;
  zone_enabled: boolean;
}

export interface Item {
  id: string;
  campaign_id: string;
  item_no: number;
  name: string;
  slot_weight: number;
  is_wondrous: boolean;
  is_crafted: boolean;
  yield_bio: number;
  yield_arcane: number;
  yield_mech: number;
  yield_ferrous: number;
  description: string | null;
}

export interface Zone {
  id: string;
  campaign_id: string;
  zone_no: number;
  name: string;
  dc: number;
}

export interface ZoneItem {
  zone_id: string;
  item_id: string;
  weight: number;
  is_rare: boolean;
}

export interface Character {
  id: string;
  campaign_id: string;
  char_no: number;
  name: string;
  class: string;
  access_code: string;
  level: number;
  str: number;
  dex: number;
  con: number;
  int_score: number;
  wis: number;
  cha: number;
  invest_proficient: boolean;
  invest_expertise: boolean;
  invest_bonus: number;
  slot_bonus: number;
  pending_exhaustion: number;
  setup_done: boolean;
}

export interface Trade {
  id: string;
  campaign_id: string;
  from_character: string;
  to_character: string;
  mode: 'give' | 'swap';
  offer: unknown; // { items: [{ item_id, qty }], scrap: { bio, arcane, mech, ferrous } }
  request: unknown | null; // hanya untuk swap
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  created_at: string;
}

export interface Recipe {
  id: string;
  campaign_id: string;
  recipe_no: number;
  name: string;
  description: string | null;
  min_level: number;
  enabled: boolean;
  output_item_id: string;
  output_qty: number;
  ing_bio: number;
  ing_arcane: number;
  ing_mech: number;
  ing_ferrous: number;
}

export interface RecipeItem {
  recipe_id: string;
  item_id: string;
  qty: number;
}
