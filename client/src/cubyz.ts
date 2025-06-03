import * as child_process from "child_process";
import { platform } from "os";
import * as vsc from "vscode";
import * as util from "util";

const execPromise = util.promisify(child_process.exec);

let TERMINAL: vsc.Terminal | null = null;

export enum BuildType {
    Debug = "Debug",
    ReleaseSafe = "Release Safe",
}

export function build(buildType: BuildType): void {
    let scriptPrefix = "";
    switch (buildType) {
        case BuildType.Debug:
            scriptPrefix = "debug";
            break;
        case BuildType.ReleaseSafe:
            scriptPrefix = "run";
            break;
        default:
            throw new Error("Unsupported build type: " + buildType);
    }

    const scriptSuffix = getScriptSuffix();

    const cwd = vsc.workspace.workspaceFolders?.[0].uri.fsPath;

    const scriptPath = `${scriptPrefix}_${scriptSuffix}`;
    ensureTerminal();
    TERMINAL.sendText(`${cwd}/${scriptPath}`, true);
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
    const compiler = ensureCompiler();
    child_process.execSync(
        `${compiler.compilerPath} build fmt -- "${compiler.workspacePath}/src/zon.zig"`,
        { cwd: compiler.workspacePath, stdio: "pipe" }
    );

    const promises = [];
    for (const file of await vsc.workspace.findFiles("**/{.zig,.zon}")) {
        promises.push(compiler.formatFile(file));
    }
    await Promise.all(promises);
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
    async formatFile(file: vsc.Uri): Promise<void> {
        await execPromise(`${this.formatterPath} "${file.fsPath}"`, {
            cwd: this.workspacePath,
        });
        console.log(`Formatted file: '${file.fsPath}'`);
    }
}

export function ensureCompiler(): CompilerInfo {
    const ws = vsc.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!ws) {
        throw new Error("No workspace folder found.");
    }
    const scriptSuffix = getScriptSuffix();
    const installCompilerScript = `${ws}/scripts/install_compiler_${scriptSuffix}`;

    console.log(`Running script: ${installCompilerScript}`);
    child_process.execSync(installCompilerScript, {
        cwd: ws,
        stdio: "inherit",
        timeout: 1000 * 60 * 16,
    });
    return new CompilerInfo(ws);
}
