import { SPRITE_COLS, SPRITE_ROWS, type Pokemon } from "./types/pokemon";
import fetchPokemon, {
  FetchPokemonLive,
  PokemonFetcher,
} from "./services/fetchPokemon";
import { Argument, Command, Flag } from "effect/unstable/cli";
import { BunServices, BunRuntime } from "@effect/platform-bun";
import { Console, Duration, Effect, Option, Schema, Stream } from "effect";
import chalk, { type ChalkInstance } from "chalk";
import ansiEscapes from "ansi-escapes";

const GENERATIONS: Record<string, { start: number; end: number }> = {
  "1": { start: 1, end: 151 },
  "2": { start: 152, end: 251 },
  "3": { start: 252, end: 386 },
  "4": { start: 387, end: 493 },
  "5": { start: 494, end: 649 },
};

const TYPE_COLOR: Record<string, ChalkInstance> = {
  fire: chalk.red,
  water: chalk.blue,
  grass: chalk.green,
  electric: chalk.yellow,
  ice: chalk.cyanBright,
  fighting: chalk.redBright,
  poison: chalk.magenta,
  ground: chalk.yellow,
  flying: chalk.cyan,
  psychic: chalk.magenta,
  bug: chalk.greenBright,
  rock: chalk.yellow,
  ghost: chalk.magentaBright,
  dragon: chalk.blueBright,
  dark: chalk.blackBright,
  steel: chalk.cyan,
  fairy: chalk.magentaBright,
  normal: chalk.white,
};

const TYPE_EMOJI: Record<string, string> = {
  fire: "🔥",
  water: "💧",
  grass: "🌿",
  electric: "⚡",
  ice: "❄️",
  fighting: "🥊",
  poison: "☠️",
  ground: "🌍",
  flying: "🦅",
  psychic: "🔮",
  bug: "🐛",
  rock: "🪨",
  ghost: "👻",
  dragon: "🐉",
  dark: "🌑",
  steel: "⚙️",
  fairy: "🧚",
  normal: "⭐",
};

const STAT_LABEL: Record<string, string> = {
  hp: "HP",
  attack: "ATK",
  defense: "DEF",
  "special-attack": "SpATK",
  "special-defense": "SpDEF",
  speed: "SPD",
};

const upperCaseName = (name: string) =>
  name.charAt(0).toLocaleUpperCase() + name.slice(1, name.length);

const formatType = (name: string) => {
  const color = TYPE_COLOR[name] ?? chalk.white;
  const emoji = TYPE_EMOJI[name] ?? "🔹";
  return `${emoji} ${color(upperCaseName(name))}`;
};

const statColor = (value: number) =>
  value >= 100 ? chalk.green : value >= 60 ? chalk.yellow : chalk.red;

const formatStat = ({
  stat,
  base_stat,
}: {
  stat: { name: string };
  base_stat: number;
}) => {
  const label = STAT_LABEL[stat.name] ?? stat.name;
  const filled = Math.round((base_stat / 255) * 20);
  const bar =
    statColor(base_stat)("█".repeat(filled)) +
    chalk.dim("░".repeat(20 - filled));
  return `${chalk.gray(label.padEnd(7))} ${statColor(base_stat)(String(base_stat).padStart(3))}  ${bar}`;
};

const formatPokemon = (
  { name: n, types: t, stats: s, id: i }: Pokemon,
  sprite: string,
  duration: number,
) => {
  const id = chalk.gray(`#${String(i).padStart(4, "0")}`);
  const name = chalk.bold.white(upperCaseName(n));
  const types = t.map((t) => formatType(t.type.name)).join(chalk.gray("  │  "));
  const timing = `${chalk.gray("⏲️").padEnd(14)} ${chalk.dim(`${duration}ms`)}`;
  const header = `${timing}  ${id} ${name}  ${types}`;

  const statLines = s.map(formatStat);

  if (!sprite) return `${header}\n${statLines.join("\n")}\n`;

  // Side-by-side: save cursor → print sprite (advances SPRITE_ROWS down) →
  // restore cursor + move right for each stat line → advance past image at end
  const vertOffset = Math.max(
    0,
    Math.floor((SPRITE_ROWS - statLines.length) / 2),
  );
  const totalRows = Math.max(SPRITE_ROWS, vertOffset + statLines.length);

  const statSection = statLines
    .map((line, i) => {
      const row = vertOffset + i;
      const down = row > 0 ? ansiEscapes.cursorDown(row) : "";
      const up = row > 0 ? ansiEscapes.cursorUp(row) : "";
      return `${down}${ansiEscapes.cursorForward(SPRITE_COLS)}${line}\r${up}`;
    })
    .join("");

  // sprite moves cursor down SPRITE_ROWS — use \r + cursorUp to return to
  // the sprite's start row using only relative movements (scroll-safe)
  return `\n${header}\n\n\n${sprite}\r${ansiEscapes.cursorUp(SPRITE_ROWS)}${statSection}${ansiEscapes.cursorDown(totalRows)}\n`;
};

const name = Argument.string("pokemon").pipe(
  Argument.withDefault("pikachu"),
  Argument.variadic(),
);
const generation = Flag.string("gen").pipe(Flag.withAlias("g"), Flag.optional);

const command = Command.make(
  "pokemonfetcher",
  { name, generation },
  ({ name, generation }) =>
    Option.match(generation, {
      onNone: () => Effect.succeed(name as Array<string | number>),
      onSome: (g) =>
        Effect.fromOption(Option.fromNullishOr(GENERATIONS[g])).pipe(
          Effect.mapError(() => `We don't have generation ${g}`),
          Effect.map((gen) =>
            Array.from(
              { length: gen.end - gen.start + 1 },
              (_, i) => gen.start + i,
            ) as Array<string | number>,
          ),
        ),
    }).pipe(
      Effect.flatMap((ids) =>
        fetchPokemon(ids).pipe(
          Stream.tap(([duration, [pokemon, sprite]]) =>
            Console.log(formatPokemon(pokemon, sprite, 1)),
          ),
          Stream.runDrain,
        ),
      ),
    ),
);

Command.run(command, { version: "1.0.0" }).pipe(
  Effect.provide(BunServices.layer),
  BunRuntime.runMain,
);
