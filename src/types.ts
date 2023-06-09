import { NextFunction, Request, RequestHandler, Response } from "express";

export type ComputedHandler =
    | ((req: Request, res: Response, next: NextFunction, route: string) => void)
    | ((req: Request, res: Response, next: NextFunction, route: string) => Promise<void>);
export type Middleware<T = RequestHandler> = T | T[] | HttpMethods<T | T[]>;
export interface HttpMethods<T = RequestHandler> {
    all: T | undefined;
    checkout: T | undefined;
    copy: T | undefined;
    delete: T | undefined;
    get: T | undefined;
    head: T | undefined;
    lock: T | undefined;
    merge: T | undefined;
    mkactivity: T | undefined;
    mkcol: T | undefined;
    move: T | undefined;
    "m-search": T | undefined;
    notify: T | undefined;
    options: T | undefined;
    patch: T | undefined;
    post: T | undefined;
    purge: T | undefined;
    put: T | undefined;
    report: T | undefined;
    search: T | undefined;
    subscribe: T | undefined;
    trace: T | undefined;
    unlock: T | undefined;
    unsubscribe: T | undefined;
}
export interface Route<T = RequestHandler> extends HttpMethods<T> {
    middleware: Middleware<T> | undefined;
    endMiddleware: Middleware<T> | undefined;
}

export interface ComputedRoute extends Route<ComputedHandler> {
    pattern: RegExp | undefined;
    recursive: boolean | undefined;
}
