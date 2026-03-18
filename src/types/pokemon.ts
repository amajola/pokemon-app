import { Schema as S } from "effect";

const NamedAPIResource = S.Struct({
  name: S.String,
  url: S.String,
});

const Ability = S.Struct({
  ability: NamedAPIResource,
  is_hidden: S.Boolean,
  slot: S.Number,
});

const GameIndex = S.Struct({
  game_index: S.Number,
  version: NamedAPIResource,
});

const HeldItemVersionDetail = S.Struct({
  rarity: S.Number,
  version: NamedAPIResource,
});

const HeldItem = S.Struct({
  item: NamedAPIResource,
  version_details: S.Array(HeldItemVersionDetail),
});

const MoveVersionGroupDetail = S.Struct({
  level_learned_at: S.Number,
  move_learn_method: NamedAPIResource,
  order: S.NullOr(S.Number),
  version_group: NamedAPIResource,
});

const Move = S.Struct({
  move: NamedAPIResource,
  version_group_details: S.Array(MoveVersionGroupDetail),
});

// Fixed: ability can be null in past_abilities
const PastAbilityEntry = S.Struct({
  ability: S.NullOr(NamedAPIResource),
  is_hidden: S.Boolean,
  slot: S.Number,
});

const PastAbility = S.Struct({
  abilities: S.Array(PastAbilityEntry),
  generation: NamedAPIResource,
});

const PastStatEntry = S.Struct({
  base_stat: S.Number,
  effort: S.Number,
  stat: NamedAPIResource,
});

const PastStat = S.Struct({
  generation: NamedAPIResource,
  stats: S.Array(PastStatEntry),
});

const PokemonType = S.Struct({
  slot: S.Number,
  type: NamedAPIResource,
});

const PastType = S.Struct({
  generation: NamedAPIResource,
  types: S.Array(PokemonType),
});

const Stat = S.Struct({
  base_stat: S.Number,
  effort: S.Number,
  stat: NamedAPIResource,
});

const Cries = S.Struct({
  latest: S.String,
  legacy: S.String,
});

// Sprite helpers
const NullableUrl = S.NullOr(S.String);

const BaseSprite = S.Struct({
  front_default: NullableUrl,
  front_female: NullableUrl,
});

const ShinySprite = S.Struct({
  ...BaseSprite.fields,
  front_shiny: NullableUrl,
  front_shiny_female: NullableUrl,
});

const FullSprite = S.Struct({
  back_default: NullableUrl,
  back_female: NullableUrl,
  back_shiny: NullableUrl,
  back_shiny_female: NullableUrl,
  front_default: NullableUrl,
  front_female: NullableUrl,
  front_shiny: NullableUrl,
  front_shiny_female: NullableUrl,
});

const GenerationISprite = S.Struct({
  back_default: NullableUrl,
  back_gray: NullableUrl,
  back_transparent: NullableUrl,
  front_default: NullableUrl,
  front_gray: NullableUrl,
  front_transparent: NullableUrl,
});

const GenerationIISprite = S.Struct({
  back_default: NullableUrl,
  back_shiny: NullableUrl,
  back_shiny_transparent: S.optional(NullableUrl),
  back_transparent: S.optional(NullableUrl),
  front_default: NullableUrl,
  front_shiny: NullableUrl,
  front_shiny_transparent: S.optional(NullableUrl),
  front_transparent: NullableUrl,
});

const GenerationIIISprite = S.Struct({
  back_default: NullableUrl,
  back_shiny: NullableUrl,
  front_default: NullableUrl,
  front_shiny: NullableUrl,
});

const SpriteVersions = S.Struct({
  "generation-i": S.Struct({
    "red-blue": GenerationISprite,
    yellow: GenerationISprite,
  }),
  "generation-ii": S.Struct({
    crystal: GenerationIISprite,
    gold: GenerationIISprite,
    silver: GenerationIISprite,
  }),
  "generation-iii": S.Struct({
    emerald: S.Struct({
      front_default: NullableUrl,
      front_shiny: NullableUrl,
    }),
    "firered-leafgreen": GenerationIIISprite,
    "ruby-sapphire": GenerationIIISprite,
  }),
  "generation-iv": S.Struct({
    "diamond-pearl": FullSprite,
    "heartgold-soulsilver": FullSprite,
    platinum: FullSprite,
  }),
  "generation-v": S.Struct({
    "black-white": S.Struct({
      ...FullSprite.fields,
      animated: FullSprite,
    }),
  }),
  "generation-vi": S.Struct({
    "omegaruby-alphasapphire": ShinySprite,
    "x-y": ShinySprite,
  }),
  "generation-vii": S.Struct({
    icons: BaseSprite,
    "ultra-sun-ultra-moon": ShinySprite,
  }),
  "generation-viii": S.Struct({
    "brilliant-diamond-shining-pearl": BaseSprite,
    icons: BaseSprite,
  }),
  "generation-ix": S.Struct({
    "scarlet-violet": BaseSprite,
  }),
});

const Sprites = S.Struct({
  ...FullSprite.fields,
  other: S.Struct({
    dream_world: BaseSprite,
    home: ShinySprite,
    "official-artwork": S.Struct({
      front_default: NullableUrl,
      front_shiny: NullableUrl,
    }),
    showdown: FullSprite,
  }),
  versions: SpriteVersions,
});

const Pokemon = S.Struct({
  abilities: S.Array(Ability),
  base_experience: S.Number,
  cries: Cries,
  forms: S.Array(NamedAPIResource),
  game_indices: S.Array(GameIndex),
  height: S.Number,
  held_items: S.Array(HeldItem),
  id: S.Number,
  is_default: S.Boolean,
  location_area_encounters: S.String,
  moves: S.Array(Move),
  name: S.String,
  order: S.Number,
  past_abilities: S.Array(PastAbility),
  past_stats: S.Array(PastStat),
  past_types: S.Array(PastType),
  species: NamedAPIResource,
  sprites: Sprites,
  stats: S.Array(Stat),
  types: S.Array(PokemonType),
  weight: S.Number,
});

// Infer the TypeScript type
type Pokemon = S.Schema.Type<typeof Pokemon>;

// Decode/encode helpers
const decodePokemon = S.decodeUnknownSync(Pokemon);
const decodePokemonEither = S.decodeUnknownExit(Pokemon);

const supportsInlineImages =
  process.env["TERM_PROGRAM"] === "iTerm.app" ||
  process.env["TERM_PROGRAM"] === "WezTerm" ||
  process.env["TERM_PROGRAM"] === "WarpTerminal" ||
  process.env["TERM_PROGRAM"] === "Warp" ||
  process.env["TERM"] === "xterm-kitty";

// Sprite renders at 12 cols wide (96px image / 8px per cell) + 2 padding
const SPRITE_COLS = 14;
const SPRITE_ROWS = 6;

export {
  Pokemon,
  decodePokemon,
  decodePokemonEither,
  supportsInlineImages,
  SPRITE_COLS,
  SPRITE_ROWS,
};
export type { Pokemon as PokemonType };
