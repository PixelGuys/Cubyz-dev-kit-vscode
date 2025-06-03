import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    InitializeParams,
    DidChangeConfigurationNotification,
    CompletionItem,
    CompletionItemKind,
    TextDocumentSyncKind,
    InitializeResult,
    DidChangeWatchedFilesNotification,
    WatchKind,
    CompletionParams,
} from "vscode-languageserver/node";

import { TextDocument } from "vscode-languageserver-textdocument";
import * as fs from "fs";
import * as uri from "vscode-uri";
import * as path from "path";
import * as zon from "./zon";

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

class Asset {
    id: string;
    location: string;
    kind: CompletionItemKind;

    constructor(id: string, location: string, kind: CompletionItemKind) {
        this.id = id;
        this.location = location;
        this.kind = kind;
    }
}

class AssetIndex {
    blocks: Asset[] = [];
    blockTextures: Asset[] = [];
    items: Asset[] = [];
    itemTextures: Asset[] = [];
    tools: Asset[] = [];
    biomes: Asset[] = [];
    models: Asset[] = [];
    structureBuildingBlocks: Asset[] = [];
    blueprints: Asset[] = [];

    static async new() {
        const index = new AssetIndex();

        if (!fs.existsSync("assets/")) return index;

        for (const addon of await fs.promises.readdir("assets/", {
            withFileTypes: true,
            recursive: false,
        })) {
            if (!addon.isDirectory()) continue;
            await AssetIndex.registerAsset(
                index.blocks,
                "blocks",
                addon.name,
                ".zig.zon",
                CompletionItemKind.Enum
            );
            await AssetIndex.registerAsset(
                index.blockTextures,
                "blocks/textures",
                addon.name,
                ".png",
                CompletionItemKind.Method
            );
            await AssetIndex.registerAsset(
                index.items,
                "items",
                addon.name,
                ".zig.zon",
                CompletionItemKind.Field
            );
            await AssetIndex.registerTextures(
                index.itemTextures,
                "items/textures",
                addon.name,
                CompletionItemKind.Method
            );
            await AssetIndex.registerAsset(
                index.tools,
                "tools",
                addon.name,
                ".zig.zon",
                CompletionItemKind.Keyword
            );
            await AssetIndex.registerAsset(
                index.biomes,
                "biomes",
                addon.name,
                ".zig.zon",
                CompletionItemKind.Constant
            );
            await AssetIndex.registerAsset(
                index.models,
                "models",
                addon.name,
                ".obj",
                CompletionItemKind.Method
            );
            await AssetIndex.registerAsset(
                index.structureBuildingBlocks,
                "sbb",
                addon.name,
                ".zig.zon",
                CompletionItemKind.Class
            );
            await AssetIndex.registerAsset(
                index.blueprints,
                "sbb",
                addon.name,
                ".blp",
                CompletionItemKind.Method
            );
        }
        return index;
    }

    static async registerAsset(
        storage: Asset[],
        scope: string,
        addon: string,
        extension: string,
        kind: CompletionItemKind
    ) {
        const basePath = `assets/${addon}/${scope}/`;
        if (!fs.existsSync(basePath) || !fs.statSync(basePath).isDirectory()) return;

        for (const file of await fs.promises.readdir(basePath, {
            withFileTypes: true,
            recursive: true,
        })) {
            if (!file.isFile()) continue;
            if (!file.name.endsWith(extension)) continue;
            if (file.name.startsWith("_default")) continue;
            if (file.name.startsWith("_migrations")) continue;

            const fileName = file.name.replace(new RegExp(`${extension}$`), "");
            const parentPath = file.parentPath.replace(/\\/g, "/");
            let relativePath = parentPath.replace(new RegExp("^" + basePath), "");
            if (relativePath.length !== 0) {
                relativePath += "/";
            }

            const id = `${addon}:${relativePath}${fileName}`;
            const location = `${parentPath}${file.name}`;

            storage.push({
                id: id,
                location: location,
                kind: kind,
            });
            connection.console.log(`Registered ${scope} asset: '${id}' at ${location}`);
        }
    }
    static async registerTextures(
        storage: Asset[],
        scope: string,
        addon: string,
        kind: CompletionItemKind
    ) {
        const basePath = `assets/${addon}/${scope}/`;
        if (!fs.existsSync(basePath) || !fs.statSync(basePath).isDirectory()) return;

        for (const file of await fs.promises.readdir(basePath, {
            withFileTypes: true,
            recursive: true,
        })) {
            if (!file.isFile()) continue;
            if (!file.name.endsWith(".png")) continue;

            const parentPath = file.parentPath.replace(/\\/g, "/");
            let relativePath = parentPath.replace(new RegExp("^" + basePath), "");
            if (relativePath.length !== 0) {
                relativePath += "/";
            }

            const id = `${relativePath}${file.name}`;
            const location = `${parentPath}${file.name}`;

            storage.push({
                id: id,
                location: location,
                kind: kind,
            });
            connection.console.log(`Registered ${scope} asset: '${id}' at ${location}`);
        }
    }
}

let ASSET_INDEX: AssetIndex | null = null;

connection.onInitialize((params: InitializeParams) => {
    const capabilities = params.capabilities;

    // Does the client support the `workspace/configuration` request?
    // If not, we fall back using global settings.
    hasConfigurationCapability = !!(
        capabilities.workspace && !!capabilities.workspace.configuration
    );
    hasWorkspaceFolderCapability = !!(
        capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );
    hasDiagnosticRelatedInformationCapability = !!(
        capabilities.textDocument &&
        capabilities.textDocument.publishDiagnostics &&
        capabilities.textDocument.publishDiagnostics.relatedInformation
    );

    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            // Tell the client that this server supports code completion.
            completionProvider: {
                resolveProvider: true,
            },
        },
    };
    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true,
            },
        };
    }
    return result;
});

connection.onInitialized(async () => {
    if (hasConfigurationCapability) {
        // Register for all configuration changes.
        connection.client.register(DidChangeConfigurationNotification.type, undefined);
        connection.client.register(DidChangeWatchedFilesNotification.type, {
            watchers: [{ globPattern: "**/*.zon", kind: WatchKind.Change }],
        });
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders((_event) => {
            connection.console.log("Workspace folder change event received.");
        });
    }
    connection.console.log("Initialized Cubyz Dev Kit Language Server");
    ASSET_INDEX = await AssetIndex.new();
});

// The example settings
interface ExampleSettings {
    maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings = new Map<string, Thenable<ExampleSettings>>();

connection.onDidChangeConfiguration((change) => {
    if (hasConfigurationCapability) {
        // Reset all cached document settings
        documentSettings.clear();
    } else {
        globalSettings = change.settings.cubyzDevKit || defaultSettings;
    }
    // Refresh the diagnostics since the `maxNumberOfProblems` could have changed.
    // We could optimize things here and re-fetch the setting first can compare it
    // to the existing setting, but this is out of scope for this example.
    connection.languages.diagnostics.refresh();
});

// Only keep settings for open documents
documents.onDidClose((e) => {
    documentSettings.delete(e.document.uri);
});

connection.onDidChangeWatchedFiles(async (_change) => {
    ASSET_INDEX = await AssetIndex.new();
});

// This handler provides the initial list of the completion items.
connection.onCompletion(async (params: CompletionParams) => {
    if (!ASSET_INDEX) return [];

    const workspaceUri = (await connection.workspace.getWorkspaceFolders())?.at(0)?.uri;
    const workspacePath = workspaceUri ? uri.URI.parse(workspaceUri).fsPath : ".";
    const documentPath = uri.URI.parse(params.textDocument.uri).fsPath;

    const relativePath = path.relative(workspacePath, documentPath).replace(/\\/g, "/");
    connection.console.log(`Relative path: ${relativePath}`);
    const pathSplit = relativePath.split("/");

    if (pathSplit.length < 4) return [];

    if (pathSplit[0] !== "assets") return [];
    pathSplit.shift();
    // Remove addon name.
    pathSplit.shift();

    const scope = pathSplit.shift();
    const fileName = pathSplit.pop();
    if (!fileName?.endsWith(".zon")) return [];

    const source = documents.get(params.textDocument.uri)?.getText();
    if (!source) return [];

    const parser = new zon.Parser();
    const ast = parser.parse(source);

    const position = new zon.Location(params.position.character, params.position.line);
    const node = new zon.FindZonNode().find(ast, position);
    if (node === null) return [];
    if (!(node instanceof zon.ZonSyntaxError) && !(node instanceof zon.ZonString)) return [];

    const completionsInput: Record<string, Asset> = {};

    switch (scope) {
        case "sbb":
        case "biomes":
            ASSET_INDEX.blueprints.forEach((element) => {
                completionsInput[element.id] = element;
            });
            ASSET_INDEX.structureBuildingBlocks.forEach((element) => {
                completionsInput[element.id] = element;
            });
            break;
        case "blocks":
            ASSET_INDEX.blockTextures.forEach((element) => {
                completionsInput[element.id] = element;
            });
            break;
        case "items":
            ASSET_INDEX.itemTextures.forEach((element) => {
                completionsInput[element.id] = element;
            });
            break;
    }
    connection.console.log(`Completions length: ${Object.keys(completionsInput).length}`);

    const completions: CompletionItem[] = [];
    for (const element of Object.values(completionsInput)) {
        completions.push({
            label: element.id,
            kind: element.kind,
            data: completions.length,
        });
    }
    return completions;
});

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    console.log(item);
    return item;
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
