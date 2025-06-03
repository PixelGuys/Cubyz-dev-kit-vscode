/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from "path";
import * as vsc from "vscode";
import * as cubyz from "./cubyz";

import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
} from "vscode-languageclient/node";

let client: LanguageClient;

export function activate(context: vsc.ExtensionContext) {
    // The server is implemented in node
    const serverModule = context.asAbsolutePath(path.join("server", "out", "server.js"));

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
        },
    };

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
        // Register the server for plain text documents
        documentSelector: [{ language: "zig" }, { language: "zon" }],
    };

    // Create the language client and start the client.
    client = new LanguageClient(
        "CubyzDevKitLSP",
        "Cubyz Dev Kit LSP",
        serverOptions,
        clientOptions
    );

    // Start the client. This will also launch the server
    client.start();

    vsc.commands.registerCommand("cubyz_dev_kit.buildDebug", () => {
        try {
            cubyz.build(cubyz.BuildType.Debug);
        } catch (err) {
            if (err instanceof Error) {
                vsc.window.showErrorMessage(err.message);
            } else {
                throw err;
            }
        }
    });
    vsc.commands.registerCommand("cubyz_dev_kit.formatAll", async () => {
        try {
            await cubyz.formatAll();
        } catch (err) {
            if (err instanceof Error) {
                vsc.window.showErrorMessage(err.message);
            } else {
                throw err;
            }
        }
    });
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
