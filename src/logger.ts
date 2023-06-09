/**
 * A basic logging interface
 */
export interface ILogger {
    /**
     * Method for logs
     * @param message The message to log
     */
    log: (message: string) => void;
    /**
     * Method for debugging
     * @param message The message to debug
     */
    debug: (message: string) => void;
    /**
     * Method for infos
     * @param message The message to info
     */
    info: (message: string) => void;
    /**
     * Method for warnings
     * @param message The message to warn
     */
    warn: (message: string) => void;
    /**
     * Method for error logging
     * @param message The error message
     */
    error: (message: string) => void;
    /**
     * Method for exception logging
     * @param error The exception
     */
    except: (error: Error) => void;
}

/**
 * Wrapper for console logging class. Do not instance this class, instead use {@link consoleLogger}
 */
export class ConsoleLogger implements ILogger {
    debug(message: string): void {
        console.debug(message);
    }

    error(message: string): void {
        console.error(message);
        process.exit(1);
    }

    except(error: Error): void {
        console.error(error.stack);
        process.exit(1);
    }

    info(message: string): void {
        console.info(message);
    }

    log(message: string): void {
        console.log(message);
    }

    warn(message: string): void {
        console.warn(message);
    }
}

/**
 * Constant of console logger (for convenience)
 */
export const consoleLogger = new ConsoleLogger();

/**
 * The settings for logging in autoExpressAPI
 */
export let logConfig: {
    muteLogs: boolean;
    ignoreWarnings: boolean;
    debug: boolean;
    logger: ILogger;
} = {
    /**
     * If the logs (console.log/info) are muted <br>
     * **Default:** `true`
     */
    muteLogs: true,
    /**
     * If warnings are ignored <br>
     * **Default:** `false`
     */
    ignoreWarnings: false,
    /**
     * If debug mode is on  (if debug logs are logged)<br>
     * **Default:** `false`
     */
    debug: false,
    /**
     * The ILogger object to use for logging <br>
     * **Default:** new {@link ConsoleSettingLogger}()
     */
    logger: consoleLogger
};

/**
 * A child of {@link ConsoleLogger}, checks the config and executes the logging only if enabled
 */
export class ConsoleSettingLogger extends ConsoleLogger {
    debug(message: string) {
        if (logConfig.debug) super.debug(message);
    }
    info(message: string) {
        if (!logConfig.muteLogs) super.info(message);
    }
    log(message: string) {
        if (!logConfig.muteLogs) super.log(message);
    }
    warn(message: string) {
        if (!logConfig.ignoreWarnings) super.warn(message);
    }
}

logConfig.logger = new ConsoleSettingLogger();
