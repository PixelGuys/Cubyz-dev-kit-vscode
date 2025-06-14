import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    CompletionItem,
    TextDocumentSyncKind,
    InitializeResult,
    DidChangeWatchedFilesNotification,
    WatchKind,
    CompletionParams,
} from "vscode-languageserver/node";

import { TextDocument } from "vscode-languageserver-textdocument";
import * as uri from "vscode-uri";
import * as path from "path";
import * as zon from "./zon";
import { resetAssetIndex, Block, Item, Tool, Biome, SBB } from "./assets";
import { CompletionVisitor } from "./completions";
import * as log from "./log";

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents = new TextDocuments(TextDocument);

const DEFAULT_SETTINGS: CubyzDevKitSettings = { maxNumberOfProblems: 1000 };
let GLOBAL_SETTINGS: CubyzDevKitSettings = DEFAULT_SETTINGS;

connection.onInitialize(() => {
    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            // Tell the client that this server supports code completion.
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: [".", ":", "/", '"', "'"],
            },
        },
    };
    result.capabilities.workspace = {
        workspaceFolders: {
            supported: true,
        },
    };
    return result;
});

connection.onInitialized(async () => {
    connection.client.register(DidChangeWatchedFilesNotification.type, {
        watchers: [{ globPattern: "**/*.zon", kind: WatchKind.Change }],
    });
    log.initLogger(connection);
    connection.workspace.onDidChangeWorkspaceFolders((_event) => {
        log.log("Workspace folder change event received.");
    });
    await resetAssetIndex();
    log.log("Initialized Cubyz Dev Kit Language Server");
});

interface CubyzDevKitSettings {
    maxNumberOfProblems: number;
}

// Cache the settings of all open documents
const documentSettings = new Map<string, Thenable<CubyzDevKitSettings>>();

connection.onDidChangeConfiguration((change) => {
    documentSettings.clear();
    GLOBAL_SETTINGS = change.settings.cubyzDevKit || DEFAULT_SETTINGS;
    connection.languages.diagnostics.refresh();
});

documents.onDidClose((e) => {
    documentSettings.delete(e.document.uri);
});

connection.onDidChangeWatchedFiles(async (_change) => {
    resetAssetIndex();
});

connection.onCompletion(async (params: CompletionParams) => {
    console.log(`onCompletion at ${params.position.line}:${params.position.character}`);

    const workspaceUri = (await connection.workspace.getWorkspaceFolders())?.at(0)?.uri;
    const workspacePath = workspaceUri ? uri.URI.parse(workspaceUri).fsPath : ".";
    const documentPath = uri.URI.parse(params.textDocument.uri).fsPath;

    const relativePath = path.relative(workspacePath, documentPath).replace(/\\/g, "/");
    log.log(`onCompletion file relative path: ${relativePath}`);
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
    console.log(params.textDocument.uri);

    const parser = new zon.Parser();
    const ast = parser.parse(source);
    console.log(ast);

    const position = new zon.Location(params.position.character, params.position.line);
    const node = new zon.FindZonNode().find(ast, position);
    console.log(node);

    if (node === null) return [];
    if (!(node instanceof zon.ZonSyntaxError) && !(node instanceof zon.ZonString)) return [];

    const visitor = new CompletionVisitor(params, ast, node);

    switch (scope) {
        case "blocks":
            new Block("<temp>", relativePath).visit(visitor);
            break;
        case "items":
            new Item("<temp>", relativePath).visit(visitor);
            break;
        case "tools":
            new Tool("<temp>", relativePath).visit(visitor);
            break;
        case "biomes":
            new Biome("<temp>", relativePath).visit(visitor);
            break;
        case "sbb":
            new SBB("<temp>", relativePath).visit(visitor);
            break;
    }

    return visitor.completions;
});

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    return item;
});

documents.listen(connection);
connection.listen();
