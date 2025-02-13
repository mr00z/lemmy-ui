import { LemmyHttp } from "lemmy-js-client";
import { getHttpBase } from "../../shared/env";
import { i18n } from "../../shared/i18next";
import { toast } from "../../shared/utils";

type EmptyRequestState = {
  state: "empty";
};

type LoadingRequestState = {
  state: "loading";
};

type FailedRequestState = {
  state: "failed";
  msg: string;
};

type SuccessRequestState<T> = {
  state: "success";
  data: T;
};

/**
 * Shows the state of an API request.
 *
 * Can be empty, loading, failed, or success
 */
export type RequestState<T> =
  | EmptyRequestState
  | LoadingRequestState
  | FailedRequestState
  | SuccessRequestState<T>;

export type WrappedLemmyHttp = {
  [K in keyof LemmyHttp]: LemmyHttp[K] extends (...args: any[]) => any
    ? ReturnType<LemmyHttp[K]> extends Promise<infer U>
      ? (...args: Parameters<LemmyHttp[K]>) => Promise<RequestState<U>>
      : (
          ...args: Parameters<LemmyHttp[K]>
        ) => Promise<RequestState<LemmyHttp[K]>>
    : LemmyHttp[K];
};

class WrappedLemmyHttpClient {
  #client: LemmyHttp;

  constructor(client: LemmyHttp) {
    this.#client = client;

    for (const key of Object.getOwnPropertyNames(
      Object.getPrototypeOf(this.#client)
    )) {
      if (key !== "constructor") {
        WrappedLemmyHttpClient.prototype[key] = async (...args) => {
          try {
            const res = await this.#client[key](...args);

            return {
              data: res,
              state: "success",
            };
          } catch (error) {
            console.error(`API error: ${error}`);
            toast(i18n.t(error), "danger");
            return {
              state: "failed",
              msg: error,
            };
          }
        };
      }
    }
  }
}

export function wrapClient(client: LemmyHttp) {
  return new WrappedLemmyHttpClient(client) as unknown as WrappedLemmyHttp; // unfortunately, this verbose cast is necessary
}

export class HttpService {
  static #_instance: HttpService;
  #client: WrappedLemmyHttp;

  private constructor() {
    this.#client = wrapClient(new LemmyHttp(getHttpBase()));
  }

  static get #Instance() {
    return this.#_instance ?? (this.#_instance = new this());
  }

  public static get client() {
    return this.#Instance.#client;
  }
}
