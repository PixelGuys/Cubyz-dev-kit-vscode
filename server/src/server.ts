/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    InitializeParams,
    DidChangeConfigurationNotification,
    CompletionItem,
    CompletionItemKind,
    TextDocumentPositionParams,
    TextDocumentSyncKind,
    InitializeResult,
    DidChangeWatchedFilesNotification,
    WatchKind,
} from "vscode-languageserver/node";

import { TextDocument } from "vscode-languageserver-textdocument";
import * as fs from "fs";
import * as path from "path";

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
        var index = new AssetIndex();

        for (const addon of await fs.promises.readdir("assets/", {
            withFileTypes: true,
            recursive: false,
        })) {
            if (!addon.isDirectory()) continue;

            await AssetIndex.registerAsset(
                index.blocks,
                "blocks",
                addon.name,
                ".zon",
                CompletionItemKind.Class
            );
            await AssetIndex.registerAsset(
                index.items,
                "items",
                addon.name,
                ".zon",
                CompletionItemKind.Class
            );
            await AssetIndex.registerAsset(
                index.tools,
                "tools",
                addon.name,
                ".zon",
                CompletionItemKind.Class
            );
            await AssetIndex.registerAsset(
                index.biomes,
                "biomes",
                addon.name,
                ".zon",
                CompletionItemKind.Class
            );
            await AssetIndex.registerAsset(
                index.models,
                "models",
                addon.name,
                ".zon",
                CompletionItemKind.Class
            );
            await AssetIndex.registerAsset(
                index.structureBuildingBlocks,
                "sbb",
                addon.name,
                ".zon",
                CompletionItemKind.Class
            );
            await AssetIndex.registerAsset(
                index.blueprints,
                "sbb",
                addon.name,
                ".zon",
                CompletionItemKind.Class
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
        const path = `assets/${addon}/${scope}/`;
        if (!fs.existsSync(path) || !fs.statSync(path).isDirectory()) return;

        for (const file of await fs.promises.readdir(path, {
            withFileTypes: true,
            recursive: true,
        })) {
            if (!file.isFile()) continue;
            if (!file.name.endsWith(extension)) continue;
            if (file.name.startsWith("_default")) continue;
            if (file.name.startsWith("_migrations")) continue;

            const fileName = file.name.replace(/\.zig\.zon$/, "").replace(/\.zon$/, "");
            const parentPath = file.parentPath.replace("//", "/").replace("\\", "/");
            const relativePath = parentPath
                .replace(/^assets\//, "")
                .replace(new RegExp("^" + addon + "/"), "")
                .replace(new RegExp("^" + scope + "/"), "");

            storage.push({
                id: `${addon}:${relativePath}${fileName}`,
                location: parentPath + fileName,
                kind: kind,
            });
        }
    }
}

var ASSET_INDEX: AssetIndex | null = null;

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
connection.onCompletion((_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    // The pass parameter contains the position of the text document in
    // which code complete got requested. For the example we ignore this
    // info and always provide the same completion items.
    var completions: CompletionItem[] = [];
    if (!!ASSET_INDEX) {
        ASSET_INDEX.blocks.forEach((element) => {
            completions.push({
                label: element.id,
                kind: CompletionItemKind.Class,
                data: completions.length,
            });
        });
    }
    return completions;
});

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    return item;
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
