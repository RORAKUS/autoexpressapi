import * as fs from "fs";
import * as path from "path";
import { IRouter, NextFunction, Request, RequestHandler, Response } from "express";
import { logConfig } from "./logger";
import { ComputedHandler, ComputedRoute, Middleware, Route } from "./types";

const logger = logConfig.logger;
const d = logger.debug;
type AddFunction = (method: string, _url: string, scriptMethod: ComputedHandler | RequestHandler) => void;

function computedRouteCheckPath(req: Request, baseUrl: string, recursive: boolean, pattern: RegExp) {
    const rPath = req.path.slice(baseUrl.length);
    if ((!recursive && rPath.includes("/")) || rPath.match(pattern) === null) return null;
    return rPath;
}

export let EXPRESS_METHODS = [
    "all",
    "checkout",
    "copy",
    "delete",
    "get",
    "head",
    "lock",
    "merge",
    "mkactivity",
    "mkcol",
    "move",
    "m-search",
    "notify",
    "options",
    "patch",
    "post",
    "purge",
    "put",
    "report",
    "search",
    "subscribe",
    "trace",
    "unlock",
    "unsubscribe"
];

export class Config {
    routesDir: string = "routes";

    allRouteFilename: string = "all";
    rootRouteFilename: string = "index";

    ignorePrefix: string = "$";
    computedRoutePrefix: string = "#";

    baseUrl: string = "/";

    constructor(source: Partial<Config>) {
        Object.assign(this, source);
    }
    adaptPaths(): Config {
        if (path.isAbsolute(this.routesDir)) this.routesDir = path.resolve(process.cwd(), this.routesDir);
        return this;
    }
}

/**
 * The main class used in Auto Express API
 */
export default class AEA {
    /**
     * The main method of this API. When called it maps all routes according to the `defaults` config.
     * @param server The express instance
     * @param defaults A partial {@link Config} object
     */
    static mapRoutes(server: IRouter, defaults: Partial<Config> = {}) {
        AEA.$mapRoutes(true, server, defaults);
    }

    /**
     * The help method, it acts the same as {@link mapRoutes}, but it returns the list of mapped routes. It's also a bit slower.
     * @param server The express instance
     * @param defaults A partial {@link Config} object
     * @returns The {@link Map} object. The key is the url of the route and the value is the file path.
     */
    static mapRoutesReturn(server: IRouter, defaults: Partial<Config> = {}): Map<string, string> {
        return AEA.$mapRoutes(false, server, defaults);
    }
    private static $mapRoutes(
        efficient: boolean,
        server: IRouter,
        defaults: Partial<Config> = {}
    ): Map<string, string> {
        const config = new Config(defaults).adaptPaths();
        d("Config set up!");
        const instance = new AEA(config, server, efficient);
        logger.info("Mapping directories:");
        instance.mapDir(config.routesDir, config.baseUrl);
        logger.info("Successfully mapped!");
        return instance.mappedRoutes;
    }

    private readonly config: Config;
    private readonly server: IRouter;
    private readonly mappedRoutes: Map<string, string> = new Map<string, string>();

    private readonly addRoute: (url: string, name: string) => void;
    private constructor(config: Config, server: IRouter, efficient: boolean) {
        this.config = config;
        this.server = server;
        this.addRoute = efficient ? (url, name) => this.mappedRoutes.set(url, name) : () => {};
    }
    private mapDir(directory: string, baseUrl: string) {
        d(`Mapping directory ${directory} with ${baseUrl}!`);
        const directoryFiles = fs.readdirSync(directory);
        /* map computed routes */ d("Mapping computed routes!");
        directoryFiles.forEach((filename) => {
            const filePath = path.join(directory, filename);
            if (
                !filename.endsWith(this.config.computedRoutePrefix) ||
                !fs.statSync(filePath).isFile() ||
                !filePath.endsWith(".js")
            )
                return;
            this.computedRoute(filePath, baseUrl);
        });
        // all variables
        let allHandler: RequestHandler | undefined;
        let allFilePath: string | undefined;
        /* map others */ d("Mapping all other routes!");
        directoryFiles.forEach((filename) => {
            const filePath = path.join(directory, filename);
            d(`Routing ${filePath}...`);
            // if directory
            if (fs.statSync(filePath).isDirectory()) {
                d("- is a directory:");
                this.mapDir(filePath, `${baseUrl}${filename}/`);
                return;
            }

            if (!filename.endsWith(".js")) {
                d("- not a js file, skipping...");
                return;
            } // if not js
            if (filename.startsWith(this.config.ignorePrefix)) {
                d("- ignore prefix found, skipping...");
                return;
            } // if ignored
            if (filename.startsWith(this.config.computedRoutePrefix)) {
                d("- computed, skipping...");
                return;
            } // if computed

            const routeObj = require(filePath);
            const route = filename.slice(0, -3);
            const url = `${baseUrl}${route === this.config.rootRouteFilename ? "" : route}`;
            d(`- url: ${url}`);

            // is all route
            if (route === this.config.allRouteFilename) {
                d("- all route: setting & skipping...");
                allHandler = routeObj;
                allFilePath = filePath;
                return;
            }
            // if folder with same name exists
            const dirname = path.join(directory, route);
            if (fs.existsSync(dirname) && fs.statSync(dirname).isDirectory())
                logger.warn(`Directory with a same name as ${filePath} exists! Use index in the folder instead!`);

            // load middleware
            if (routeObj.middleware) this.registerMiddleware(url, routeObj.middleware);
            // load methods
            this.registerMethods(url, routeObj);
            // load end middleware
            if (routeObj.endMiddleware) this.registerMiddleware(url, routeObj.endMiddleware);

            this.addRoute(url, filePath);
            logger.log(`${url} --> ${filePath}`);
        });
        // load all:
        if (!allHandler) return;
        d("Registering all handler...");
        if (allHandler.constructor.name === "AsyncFunction") {
            d("- The method is async, adding using await...");
            this.server.all(`${baseUrl}*`, async (req, res, next) => {
                if (!res.headersSent) await allHandler!!(req, res, next);
                else next();
            });
        } else
            this.server.all(`${baseUrl}*`, (req, res, next) => {
                if (!res.headersSent) allHandler!!(req, res, next);
                else next();
            });

        this.addRoute(`${baseUrl}$all`, allFilePath!!);
        logger.log(`${baseUrl}$all --> ${allFilePath!!}`);
    }
    private computedRoute(filePath: string, baseUrl: string) {
        d(`Mapping computed route ${baseUrl}* with ${filePath}:`);
        // variables
        const routeObject: ComputedRoute = require(filePath);
        // check for properties
        const pattern = routeObject.pattern ?? /^.+$/;
        d(`Pattern: ${pattern}`);
        const recursive = routeObject.recursive ?? false;
        d(`Recursive ${recursive}`);

        const addComputedRouteFn: AddFunction = (method, url, scriptMethod) => {
            if (scriptMethod.constructor.name === "AsyncFunction") {
                d("--- The method is async, adding using await...");
                // @ts-ignore
                this.server[method](url, async (req: Request, res: Response, next: NextFunction) => {
                    const rPath = computedRouteCheckPath(req, baseUrl, recursive, pattern);
                    if (rPath) await scriptMethod(req, res, next, rPath);
                    else next();
                });
            } else {
                // @ts-ignore
                this.server[method](url, (req: Request, res: Response, next: NextFunction) => {
                    const rPath = computedRouteCheckPath(req, baseUrl, recursive, pattern);
                    if (rPath) scriptMethod(req, res, next, rPath);
                    else next();
                });
            }
        };

        // register start middleware
        if (routeObject.middleware) this.registerMiddleware(`${baseUrl}*`, routeObject.middleware, addComputedRouteFn);
        // register the methods
        this.registerMethods(`${baseUrl}*`, routeObject, addComputedRouteFn);
        // register end middleware
        if (routeObject.endMiddleware)
            this.registerMiddleware(`${baseUrl}*`, routeObject.endMiddleware, addComputedRouteFn);

        this.addRoute(recursive ? `${baseUrl}**/\`${pattern}\`` : `${baseUrl}\`${pattern}\``, filePath);
        logger.log(`${recursive ? `${baseUrl}**/\`${pattern}\`` : `${baseUrl}\`${pattern}\``} --> ${filePath}`);
    }
    private registerMiddleware(
        url: string,
        mwObject: Middleware<RequestHandler | ComputedHandler>,
        addFunction: AddFunction = (method, _url, scriptOfMethod) => {
            // @ts-ignore
            this.server[method](_url, scriptOfMethod);
        }
    ) {
        d("- middleware found, registering...");
        // if middleware is a single function
        if (typeof mwObject === "function") {
            d("- middleware is a function, adding...");
            addFunction("use", url, mwObject);
            return;
        }
        // if middleware is an array (of functions)
        if (Array.isArray(mwObject)) {
            d("- middleware is a function, adding all...");
            mwObject.filter((mw) => typeof mw === "function").forEach((mw) => addFunction("use", url, mw));
            return;
        }
        if (typeof mwObject !== "object") {
            logger.warn("- middleware is not a function, array nor an object. Returned.");
            return;
        }
        /* if middleware is an object: */ d("- middleware is an object, computing...");
        EXPRESS_METHODS.forEach((methodName) => {
            if (!(methodName in mwObject)) return;
            d(`- ${methodName} method found:`);
            // @ts-ignore
            const mw = mwObject[methodName];
            if (typeof mw === "function") {
                d("-> is a function, adding...");
                addFunction(methodName, url, mw);
                return;
            }
            if (Array.isArray(mw)) {
                d("-> is an array, adding all...");
                mw.forEach((mwFun, index) => {
                    if (typeof mwFun !== "function") {
                        logger.warn(
                            `Method ${methodName} of middleware in ${url}: Index of array ${index} is not a function!`
                        );
                        return;
                    }
                    addFunction(methodName, url, mwFun);
                });
                return;
            }
            logger.warn(
                `Method ${methodName} of middleware in ${url} is neither a function nor an array of functions!`
            );
        });
    }
    private registerMethods(
        url: string,
        script: Route | ComputedRoute,
        addFunction: AddFunction = (method, _url, scriptMethod) => {
            // @ts-ignore
            this.server[method](_url, scriptMethod);
        }
    ) {
        d("- registering methods...");
        EXPRESS_METHODS.forEach((methodName) => {
            if (!(methodName in script)) return;
            // @ts-ignore
            if (typeof script[methodName] !== "function") {
                console.warn(`Method ${methodName} in ${url} is not a function! Skipping...`);
                return;
            }
            d(`-- ${methodName} method found, adding...`);
            // @ts-ignore
            addFunction(methodName, url, script[methodName]);
        });
    }
}
