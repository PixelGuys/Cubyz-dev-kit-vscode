import * as childProcess from "child_process";
import * as fs from "fs";
import { platform } from "os";
import * as vsc from "vscode";
import * as vscode from "vscode";
import * as log from "./log";

let TERMINAL: vsc.Terminal | null = null;

export enum BuildType {
    Debug = "Debug",
    ReleaseSafe = "Release Safe",
}

function getBuildScriptPrefix(buildType: BuildType): string {
    switch (buildType) {
        case BuildType.Debug:
            return "debug";
        case BuildType.ReleaseSafe:
            return "run";
        default:
            throw new Error("Unsupported build type: " + buildType);
    }
}

export function build(buildType: BuildType): void {
    const compiler = CompilerInfo.init();
    ensureTerminal();
    TERMINAL.sendText(compiler.getBuildScriptCommand(buildType), true);
}

function getScriptSuffix(): string {
    switch (platform()) {
        case "linux":
            return "linux.sh";
        case "win32":
            return "windows.bat";
        default:
            throw new Error("Unsupported platform: " + platform());
    }
}

function ensureTerminal(): void {
    if (TERMINAL === null) {
        vsc.window.onDidCloseTerminal((terminal) => {
            if (terminal.processId == TERMINAL?.processId) {
                TERMINAL = null;
            }
        });
        TERMINAL = vsc.window.createTerminal(`Cubyz Build`);
    }
    TERMINAL.show();
}

export async function formatAll(): Promise<void> {
    const compiler = await ensureCompiler();
    await compiler.ensureFormatter();

    await vscode.window.withProgress(
        {
            title: "Formatting all Zig and Zon files",
            location: vsc.ProgressLocation.Notification,
        },
        async () => {
            let files: vsc.Uri[] = [];
            const promises: Promise<void>[] = [];
            for (const file of await vsc.workspace.findFiles("src/**/*.{zig,zon}")) {
                files.push(file);
                if (files.length >= 10) {
                    promises.push(compiler.formatFiles(files));
                    files = [];
                }
            }
            if (files.length > 0) {
                promises.push(compiler.formatFiles(files));
            }
            await Promise.all(promises);
            return { message: "Finished", increment: 100 };
        }
    );
    log.info(`All files formatted.`);
}

export async function clearCache(): Promise<void> {
    const compiler = CompilerInfo.init();
    await compiler.clearOut();
    await compiler.clearCache();
}

export async function clearAll(): Promise<void> {
    const compiler = CompilerInfo.init();
    await compiler.clearAll();
}

class CompilerInfo {
    workspacePath: string;
    compilerPath: string;
    outPath: string;

    constructor(workspacePath: string) {
        switch (platform()) {
            case "linux":
                this.workspacePath = workspacePath;
                break;
            case "win32":
                this.workspacePath = workspacePath.replace("/", "\\");
                break;
            default:
                throw new Error("Unsupported platform: " + platform());
        }
        switch (platform()) {
            case "linux":
                this.compilerPath = `${this.workspacePath}/compiler/zig/zig`;
                break;
            case "win32":
                this.compilerPath = `${this.workspacePath}\\compiler\\zig\\zig.exe`;
                break;
            default:
                throw new Error("Unsupported platform: " + platform());
        }
        switch (platform()) {
            case "linux":
                this.outPath = `${this.workspacePath}/zig-out/bin`;
                break;
            case "win32":
                this.outPath = `${this.workspacePath}\\zig-out\\bin`;
                break;
            default:
                throw new Error("Unsupported platform: " + platform());
        }
    }
    static init() {
        const ws = vsc.workspace.workspaceFolders?.[0].uri.fsPath;
        if (!ws) {
            throw new Error("No workspace folder found.");
        }
        return new CompilerInfo(ws);
    }
    getBuildScriptCommand(buildType: BuildType): string {
        const scriptPrefix = getBuildScriptPrefix(buildType);
        const scriptSuffix = getScriptSuffix();
        return `${this.workspacePath}/${scriptPrefix}_${scriptSuffix}`;
    }
    get installScriptPath(): string {
        const scriptSuffix = getScriptSuffix();
        return `"${this.workspacePath}/scripts/install_compiler_${scriptSuffix}"`;
    }
    get formatterPath(): string {
        switch (platform()) {
            case "linux":
                return `${this.outPath}/zig_fmt`;
            case "win32":
                return `${this.outPath}\\zig_fmt.exe`;
            default:
                throw new Error("Unsupported platform: " + platform());
        }
    }
    async ensureFormatter(): Promise<void> {
        await vscode.window.withProgress(
            {
                title: "Building formatter",
                location: vsc.ProgressLocation.Notification,
            },
            async () => {
                const cmd = `"${this.compilerPath}" build fmt -- "${this.workspacePath}\\build.zig"`;
                await runCmd(cmd, { cwd: this.workspacePath, shell: true });
                return { message: "Finished", increment: 100 };
            }
        );
        log.info(`Progress finished, formatter built.`);
    }
    async formatFiles(files: vsc.Uri[]): Promise<void> {
        const fileList = files.reduce((acc, file) => {
            return acc + ` "${file.fsPath}"`;
        }, "");

        try {
            await runCmd(`"${this.formatterPath}" ${fileList}`, {
                cwd: this.workspacePath,
                shell: true,
            });
        } catch (err) {
            if (err instanceof Error) {
                log.err(`Error formatting files ${fileList}: ${err.message}`);
            }
            return;
        }
        log.info(`Formatted files: ${fileList}`);
    }
    async clearOut(): Promise<void> {
        this.clearDirWithProgress(`${this.workspacePath}/zig-out`, "Clearing Zig output directory");
    }
    async clearDirWithProgress(dirPath: string, title: string): Promise<void> {
        await vscode.window.withProgress(
            {
                title: title,
                location: vsc.ProgressLocation.Notification,
            },
            async () => {
                fs.rmSync(dirPath, { recursive: true, force: true });
                log.info(`Cleared: '${dirPath}'`);
                return { message: "Finished", increment: 100 };
            }
        );
        log.info(`Progress finished, cleared: ${dirPath}.`);
    }
    async clearCache(): Promise<void> {
        this.clearDirWithProgress(`${this.workspacePath}/.zig-cache`, "Clearing Zig cache directory");
    }
    async clearCompiler(): Promise<void> {
        await this.clearDirWithProgress(`${this.workspacePath}/compiler`, "Clearing Zig compiler directory");
    }
    async clearAll(): Promise<void> {
        await this.clearOut();
        await this.clearCache();
        await this.clearCompiler();
    }
}

export async function runCmd(cmd: string, options: childProcess.SpawnOptions) {
    log.info(`Running: '${cmd}'`);
    const result = await childProcess.spawnSync(cmd, options);
    if (result.error) throw result.error;
    if (result.status !== 0) {
        log.info(`STATUS '${cmd}'\n${result.status}\n`);
        log.info(`STDOUT '${cmd}'\n${result.stdout}\n`);
        log.info(`STDERR '${cmd}'\n${result.stderr}\n`);
        if (result.status !== 0)
            throw new Error(
                `Failed to build formatter. Compiler exited with status code ${result.status}`
            );
    }
}

export async function ensureCompiler(): Promise<CompilerInfo> {
    const compiler = CompilerInfo.init();

    await vscode.window.withProgress(
        {
            title: "Detecting Zig compiler",
            location: vsc.ProgressLocation.Notification,
        },
        async () => {
            await runCmd(compiler.installScriptPath, {
                cwd: compiler.workspacePath,
                shell: true,
                timeout: 1000 * 60 * 16,
            });
            return { message: "Finished", increment: 100 };
        }
    );
    log.info(`Progress finished, creating CompilerInfo for workspace: '${compiler.workspacePath}'`);
    return compiler;
}
