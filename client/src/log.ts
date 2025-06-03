import * as util from "util";
import * as vscode from "vscode";

let _log: Logger | undefined;

type Arguments = unknown[];

export function getLogger(): Logger {
    if (_log === undefined) {
        _log = new Logger(
            vscode.window.createOutputChannel("Cubyz Dev Kit: Extension", { log: true })
        );
    }
    return _log;
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
    constructor(private channel: vscode.LogOutputChannel) {}

    public log(...data: Arguments): void {
        this.channel.appendLine(util.format(...data));
    }
    public err(...data: Arguments): void {
        this.channel.error(util.format(...data));
    }
    public warn(...data: Arguments): void {
        this.channel.warn(util.format(...data));
    }
    public info(...data: Arguments): void {
        this.channel.info(util.format(...data));
    }
    public debug(...data: Arguments): void {
        this.channel.debug(util.format(...data));
    }
    public getChannel(): vscode.LogOutputChannel {
        return this.channel;
    }
}
