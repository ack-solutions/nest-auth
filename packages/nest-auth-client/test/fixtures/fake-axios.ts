/**
 * A minimal REAL axios-like instance for tests.
 *
 * This is not a mock — it's a real implementation of the `AxiosLikeInstance`
 * interface. It actually runs interceptors in order, supports eject, and
 * dispatches the request to a user-provided handler.
 *
 * No `axios` peer dependency needed; the structural type is all that matters.
 */

import type { AxiosLikeInstance } from '../../src/client/http-attach';

type RequestInterceptor = (
  config: any,
) => any | Promise<any>;
type ResponseInterceptor = {
  fulfilled?: (response: any) => any | Promise<any>;
  rejected?: (error: any) => any | Promise<any>;
};

export class FakeAxios implements AxiosLikeInstance {
  /** The user-provided dispatcher decides what response/error a given config gets. */
  constructor(private dispatcher: (config: any) => any | Promise<any>) {}

  private reqInterceptors = new Map<number, RequestInterceptor>();
  private resInterceptors = new Map<number, ResponseInterceptor>();
  private nextReqId = 1;
  private nextResId = 1;

  /** Number of times the actual underlying request was dispatched. */
  public dispatchCount = 0;

  interceptors = {
    request: {
      use: (onFulfilled?: RequestInterceptor | null) => {
        const id = this.nextReqId++;
        if (onFulfilled) this.reqInterceptors.set(id, onFulfilled);
        return id;
      },
      eject: (id: number) => this.reqInterceptors.delete(id),
    },
    response: {
      use: (
        onFulfilled?: ((response: any) => any) | null,
        onRejected?: ((error: any) => any) | null,
      ) => {
        const id = this.nextResId++;
        this.resInterceptors.set(id, {
          fulfilled: onFulfilled ?? undefined,
          rejected: onRejected ?? undefined,
        });
        return id;
      },
      eject: (id: number) => this.resInterceptors.delete(id),
    },
  };

  /**
   * Send a request: runs request interceptors → dispatcher → response interceptors.
   * Mirrors axios' semantics for simple cases.
   */
  async request<T = any>(config: any): Promise<T> {
    // Request interceptors
    let cfg = config;
    for (const interceptor of this.reqInterceptors.values()) {
      cfg = await interceptor(cfg);
    }

    // Dispatch
    this.dispatchCount++;
    let response: any;
    let error: any;
    try {
      response = await this.dispatcher(cfg);
    } catch (e) {
      error = e;
    }

    // Response interceptors — fulfilled chain on success, rejected chain on error
    if (error) {
      for (const { rejected } of this.resInterceptors.values()) {
        if (rejected) {
          try {
            response = await rejected(error);
            error = undefined;
            break;
          } catch (e) {
            error = e;
          }
        }
      }
      if (error) throw error;
      return response;
    }

    for (const { fulfilled } of this.resInterceptors.values()) {
      if (fulfilled) {
        response = await fulfilled(response);
      }
    }
    return response;
  }
}

/** Build an error-shaped object compatible with the axios error shape. */
export function makeAxiosError(status: number, config: any): any {
  const err: any = new Error(`HTTP ${status}`);
  err.response = { status, config };
  err.config = config;
  return err;
}
