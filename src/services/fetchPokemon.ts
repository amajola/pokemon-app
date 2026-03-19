import { Data, Effect, Layer, pipe, Schema, ServiceMap, Stream } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientError,
  HttpClientResponse,
} from "effect/unstable/http";
import { Pokemon, SPRITE_ROWS, supportsInlineImages } from "../types/pokemon";

export class HttpError extends Data.TaggedError("HttpError")<{
  readonly status: number;
  readonly message: string;
  readonly url?: string;
  readonly method?: string;
  readonly body?: unknown;
}> {}

const BASE_URL = "https://pokeapi.co/api/v2/pokemon";

export class PokemonFetcher extends ServiceMap.Service<
  PokemonFetcher,
  {
    readonly fetchPokemon: (
      id: number | string,
    ) => Effect.Effect<
      readonly [Pokemon, string],
      HttpClientError.HttpClientError | Schema.SchemaError
    >;
  }
>()("PokemonFetcher") {}

const fetchSprite = (url: string | null): Effect.Effect<string> => {
  if (!supportsInlineImages || url === null) return Effect.succeed("");
  return Effect.tryPromise(() => fetch(url).then((r) => r.arrayBuffer())).pipe(
    Effect.map((buf) => {
      const base64 = Buffer.from(buf).toString("base64");
      // No trailing \n — cursor position is managed manually in formatPokemon
      return `\x1b]1337;File=inline=1;width=12;height=${SPRITE_ROWS};preserveAspectRatio=1:${base64}\x07`;
    }),
    Effect.orElseSucceed(() => ""),
  );
};

export const FetchPokemonLive = Layer.effect(
  PokemonFetcher,
  Effect.service(HttpClient.HttpClient).pipe(
    Effect.map((client) => ({
      fetchPokemon: (id: number | string) =>
        client
          .get(`${BASE_URL}/${id}`, {
            headers: { "Cache-Control": "no-store" },
          })
          .pipe(
            Effect.flatMap(HttpClientResponse.schemaBodyJson(Pokemon)),
            Effect.flatMap((pokemon) =>
              fetchSprite(pokemon.sprites.front_default).pipe(
                Effect.map((sprite) => [pokemon, sprite] as const),
              ),
            ),
          ),
    })),
  ),
);

// const PokemonFetcherProgram = (ids: Array<number | string>) =>
//   Stream.fromIterable(ids).pipe(
//     Stream.mapEffect(
//       (id) =>
//         Effect.gen(function* () {
//           const svc = yield* PokemonFetcher;
//           return yield* svc.fetchPokemon(id);
//         }),
//       { concurrency: 1 },
//     ),
//   );

const PokemonFetcherProgram = (ids: Array<number | string>) =>
  Stream.fromIterable(ids).pipe(
    Stream.mapEffect(
      (id) =>
        Effect.timed(
          PokemonFetcher.use((pokemon_service) =>
            pokemon_service.fetchPokemon(id),
          ),
        ),
      { concurrency: 10 },
    ),
  );

export default (ids: Array<string | number>) =>
  PokemonFetcherProgram(ids).pipe(
    Stream.provide(FetchPokemonLive),
    Stream.provide(FetchHttpClient.layer),
  );
