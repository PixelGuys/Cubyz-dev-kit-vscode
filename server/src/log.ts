import * as util from "util";
import { Connection, RemoteConsole } from "vscode-languageserver/node";

let _log: Logger | undefined;

type Arguments = unknown[];

export function getLogger(): Logger {
    if (_log === undefined) {
        throw new Error("Logger not initialized. Call initLogger first.");
    }
    return _log;
}

export function initLogger(connection: Connection): void {
    if (_log === undefined) {
        _log = new Logger(connection.console);
    }
}

export function log(...data: Arguments): void {
    getLogger().log(...data);
}
export function err(...data: Arguments): void {
    getLogger().err(...data);
}
export function warn(...data: Arguments): void {
    getLogger().warn(...data);
}
export function info(...data: Arguments): void {
    getLogger().info(...data);
}
export function debug(...data: Arguments): void {
    getLogger().debug(...data);
}

export class Logger {
    constructor(private console: RemoteConsole) {}

    public log(...data: Arguments): void {
        console.log(util.format(...data));
    }
    public err(...data: Arguments): void {
        console.error(util.format(...data));
    }
    public warn(...data: Arguments): void {
        console.warn(util.format(...data));
    }
    public info(...data: Arguments): void {
        console.info(util.format(...data));
    }
    public debug(...data: Arguments): void {
        console.debug(util.format(...data));
    }
}
