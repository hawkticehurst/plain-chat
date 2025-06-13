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
import type * as aiStreaming from "../aiStreaming.js";
import type * as aiStreamingNode from "../aiStreamingNode.js";
import type * as chats from "../chats.js";
import type * as cryptoActions from "../cryptoActions.js";
import type * as http from "../http.js";
import type * as httpActions_aiSettings from "../httpActions/aiSettings.js";
import type * as httpActions_auth from "../httpActions/auth.js";
import type * as httpActions_chats from "../httpActions/chats.js";
import type * as httpActions_messages from "../httpActions/messages.js";
import type * as httpActions_streaming from "../httpActions/streaming.js";
import type * as httpActions_usage from "../httpActions/usage.js";
import type * as lib_corsConfig from "../lib/corsConfig.js";
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
  aiStreaming: typeof aiStreaming;
  aiStreamingNode: typeof aiStreamingNode;
  chats: typeof chats;
  cryptoActions: typeof cryptoActions;
  http: typeof http;
  "httpActions/aiSettings": typeof httpActions_aiSettings;
  "httpActions/auth": typeof httpActions_auth;
  "httpActions/chats": typeof httpActions_chats;
  "httpActions/messages": typeof httpActions_messages;
  "httpActions/streaming": typeof httpActions_streaming;
  "httpActions/usage": typeof httpActions_usage;
  "lib/corsConfig": typeof lib_corsConfig;
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
