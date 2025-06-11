/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as aiKeys from "../aiKeys.js";
import type * as chats from "../chats.js";
import type * as cryptoActions from "../cryptoActions.js";
import type * as lib_serverCrypto from "../lib/serverCrypto.js";
import type * as messages from "../messages.js";
import type * as usage from "../usage.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  aiKeys: typeof aiKeys;
  chats: typeof chats;
  cryptoActions: typeof cryptoActions;
  "lib/serverCrypto": typeof lib_serverCrypto;
  messages: typeof messages;
  usage: typeof usage;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
