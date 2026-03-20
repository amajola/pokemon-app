import {
  Effect,
  Layer,
  Match,
  Random,
  Ref,
  Schedule,
  Schema,
  ServiceMap,
} from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientError,
  HttpClientResponse,
} from "effect/unstable/http";
import { Pokemon, type Pokemon as PokemonType } from "../schema";
import { SchemaError } from "effect/Schema";
import { TerminalRenderer } from "./TerminalRenderer";
import { config } from "../cli";

export class FetchError extends Schema.TaggedErrorClass("FetchError")(
  "FetchError",
  {
    pokemonId: Schema.Union([Schema.String, Schema.Number]),
    statusCode: Schema.Number,
    message: Schema.String,
  },
) {}

export class FetchErrorRetry extends Schema.TaggedErrorClass("FetchErrorRetry")(
  "FetchErrorRetry",
  {
    pokemonId: Schema.Union([Schema.String, Schema.Number]),
    statusCode: Schema.Number,
    message: Schema.String,
  },
) {}

const baseUrl = "https://pokeapi.co/api/v2/pokemon";

export type PokemonLookup = string | number;

export type TimedPokemon = {
  readonly durationMs: number;
  readonly pokemon: PokemonType;
};

export const logRetryAttempt =
  (attempts: Ref.Ref<number>) =>
  (
    error:
      | FetchError
      | FetchErrorRetry
      | HttpClientError.HttpClientError
      | SchemaError,
  ) =>
    Ref.updateAndGet(attempts, (n) => n + 1).pipe(
      Effect.flatMap((attempt) =>
        Match.value(error).pipe(
          Match.tag("FetchError", (e) =>
            TerminalRenderer.use((r) =>
              r.showWhileRetry(e, attempt, config.retries),
            ),
          ),
          Match.orElse(() => Effect.void),
        ),
      ),
    );

export const withChaos = (lookup: PokemonLookup) => (pokemon: Pokemon) =>
  Random.next.pipe(
    Effect.flatMap((roll) =>
      roll < 0.3
        ? Effect.fail(
            new FetchError({
              pokemonId: lookup,
              statusCode: 500,
              message: "Chaos!",
            }),
          )
        : Effect.succeed(pokemon),
    ),
  );

export const withExponentialBackoff = <R>(
  effect: Effect.Effect<
    Pokemon,
    | HttpClientError.HttpClientError
    | Schema.SchemaError
    | FetchError
    | FetchErrorRetry,
    R
  >,
  attempts: Ref.Ref<number>,
) =>
  Effect.retry(effect, ($) =>
    Schedule.exponential("200 millis").pipe(
      Schedule.compose(Schedule.recurs(config.retries - 1)),
      $,
      Schedule.tapInput(logRetryAttempt(attempts)),
    ),
  ).pipe(
    Effect.catchTag("FetchError", (e) =>
      Effect.fail(
        new FetchErrorRetry({
          pokemonId: e.pokemonId,
          statusCode: e.statusCode,
          message: e.message,
        }),
      ),
    ),
  );

const fetchPokemonLive = (lookup: PokemonLookup, chaos: boolean) =>
  Effect.service(HttpClient.HttpClient)
    .pipe(
      Effect.flatMap((client) =>
        client.get(`${baseUrl}/${lookup}`, {
          headers: { "Cache-Control": "no-store" },
        }),
      ),
    )
    .pipe(
      Effect.catchTag("HttpClientError", (error) => Effect.fail(error)),
      Effect.flatMap(HttpClientResponse.schemaBodyJson(Pokemon)),
      Effect.flatMap((pokemon) =>
        chaos ? withChaos(lookup)(pokemon) : Effect.succeed(pokemon),
      ),
    );

export class FetchClient extends ServiceMap.Service<
  FetchClient,
  {
    readonly fetchPokemon: (
      lookup: PokemonLookup,
      chaos: boolean,
    ) => Effect.Effect<
      PokemonType,
      | HttpClientError.HttpClientError
      | Schema.SchemaError
      | FetchError
      | FetchErrorRetry
    >;
  }
>()("@pokemon-app/FetchClient") {}

export const fetchClientLayer = Layer.effect(
  FetchClient,
  Effect.service(HttpClient.HttpClient).pipe(
    Effect.map((client) => ({
      fetchPokemon: (lookup: PokemonLookup, chaos: boolean) =>
        fetchPokemonLive(lookup, chaos).pipe(
          Effect.provideService(HttpClient.HttpClient, client),
        ),
    })),
  ),
).pipe(Layer.provide(FetchHttpClient.layer));
