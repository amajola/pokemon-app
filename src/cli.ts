import { Argument, Command, Flag } from "effect/unstable/cli";
import { Duration, Effect, Option, Ref, Stream } from "effect";
import {
  FetchClient,
  withExponentialBackoff,
  type PokemonLookup,
} from "./services/FetchClient";
import {
  capitalizePokemonName,
  formatError,
  TerminalRenderer,
} from "./services/TerminalRenderer";
import { Pokemon } from "./schema";
import { SchemaError } from "effect/Schema";
import { HttpClientError } from "effect/unstable/http/HttpClientError";

const pokemonGenerations = ["1", "2", "3", "4", "5"] as const;
export const config = {
  retries: 3,
};

type PokemonGeneration = (typeof pokemonGenerations)[number];

const pokemonGenerationRanges = {
  "1": { start: 1, end: 151 },
  "2": { start: 152, end: 251 },
  "3": { start: 252, end: 386 },
  "4": { start: 387, end: 493 },
  "5": { start: 494, end: 649 },
} satisfies Record<
  PokemonGeneration,
  { readonly start: number; readonly end: number }
>;

const getPokemonLookupsForGeneration = (
  generation: PokemonGeneration,
): ReadonlyArray<PokemonLookup> => {
  const range = pokemonGenerationRanges[generation];

  return Array.from(
    { length: range.end - range.start + 1 },
    (_, index) => range.start + index,
  );
};

const streamPokemonLookups = (
  lookups: ReadonlyArray<PokemonLookup>,
  concurrency: number,
) =>
  Stream.fromIterable(lookups).pipe(
    Stream.mapEffect(
      (lookup) =>
        Ref.make(0).pipe(
          Effect.flatMap((attempts) =>
            withExponentialBackoff(
              FetchClient.use((c) => c.fetchPokemon(lookup)),
              attempts,
            ).pipe(Effect.timed),
          ),
          Effect.map(([duration, pokemon]) => ({
            durationMs: Duration.toMillis(duration),
            pokemon,
          })),
        ),
      { concurrency },
    ),
  );

const pokemon = Argument.string("pokemon").pipe(Argument.variadic());
const generation = Flag.choice("gen", pokemonGenerations).pipe(
  Flag.withAlias("g"),
  Flag.optional,
);
const concurrency = Flag.integer("concurrency").pipe(
  Flag.withAlias("c"),
  Flag.withDefault(10),
  Flag.mapTryCatch(
    (n) => {
      if (n < 1 || n > 30) throw new Error("concurrency must be between 1 and 30");
      return n;
    },
    (e) => String(e),
  ),
);

const resolvePokemonLookups = ({
  pokemon,
  generation,
}: {
  readonly pokemon: ReadonlyArray<string>;
  readonly generation: Option.Option<PokemonGeneration>;
}) =>
  Option.match(generation, {
    onNone: () =>
      Effect.succeed<ReadonlyArray<PokemonLookup>>(
        pokemon.length > 0 ? pokemon : ["pikachu"],
      ),
    onSome: (selectedGeneration) =>
      Effect.succeed<ReadonlyArray<PokemonLookup>>(
        getPokemonLookupsForGeneration(selectedGeneration),
      ),
  });

const command = Command.make(
  "pokemonfetcher",
  { pokemon, generation, concurrency },
  ({ pokemon, generation, concurrency }) =>
    resolvePokemonLookups({ pokemon, generation }).pipe(
      Effect.flatMap((lookups) =>
        streamPokemonLookups(lookups, concurrency).pipe(
          Stream.tap((timedPokemon) =>
            TerminalRenderer.use((terminalRenderer) =>
              terminalRenderer.showPokemon(timedPokemon),
            ),
          ),
          Stream.runDrain,
          Effect.catchTag("FetchErrorRetry", (error) =>
            TerminalRenderer.use((t) => t.showRetryError(error)),
          ),
          Effect.catchTag("HttpClientError", (error) => formatError(error)),
        ),
      ),
    ),
);

export const cli = Command.run(command, { version: "1.0.0" });
