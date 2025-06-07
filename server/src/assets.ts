import { CompletionItemKind, CompletionItem, CompletionParams } from "vscode-languageserver/node";
import * as fs from "fs";
import * as log from "./log";
import { CompletionVisitor } from "./completions";

let ASSET_INDEX: AssetIndex | null = null;

export async function getAssetIndex(): Promise<AssetIndex> {
    if (ASSET_INDEX === null) {
        ASSET_INDEX = await AssetIndex.new();
    }
    return ASSET_INDEX;
}

export async function resetAssetIndex(): Promise<void> {
    ASSET_INDEX = await AssetIndex.new();
}

class Asset {
    id: string;
    location: string;

    constructor(id: string, location: string) {
        this.id = id;
        this.location = location;
    }
    async visit(_provider: CompletionVisitor): Promise<void> {
        throw new Error("Method 'visit' must be implemented.");
    }
    static getCompletions(): CompletionItem[] {
        throw new Error("Method 'getCompletions' must be implemented.");
    }
}
class Block extends Asset {
    async visit(provider: CompletionVisitor): Promise<void> {
        await provider.onBlock(this);
    }
    static getCompletions(): CompletionItem[] {
        throw new Error("Method 'getCompletions' must be implemented.");
    }
}
class BlockTexture extends Asset {
    static getCompletions(): CompletionItem[] {
        throw new Error("Method 'getCompletions' must be implemented.");
    }
}
class Item extends Asset {
    async visit(provider: CompletionVisitor): Promise<void> {
        await provider.onItem(this);
    }
    static getCompletions(): CompletionItem[] {
        throw new Error("Method 'getCompletions' must be implemented.");
    }
}
class ItemTexture extends Asset {
    static getCompletions(): CompletionItem[] {
        throw new Error("Method 'getCompletions' must be implemented.");
    }
}
class Tool extends Asset {
    async visit(provider: CompletionVisitor): Promise<void> {
        await provider.onTool(this);
    }
    static getCompletions(): CompletionItem[] {
        throw new Error("Method 'getCompletions' must be implemented.");
    }
}
class Biome extends Asset {
    async visit(provider: CompletionVisitor): Promise<void> {
        await provider.onBiome(this);
    }
    static getCompletions(): CompletionItem[] {
        throw new Error("Method 'getCompletions' must be implemented.");
    }
}
class Model extends Asset {
    static getCompletions(): CompletionItem[] {
        throw new Error("Method 'getCompletions' must be implemented.");
    }
}
class SBB extends Asset {
    async visit(provider: CompletionVisitor): Promise<void> {
        await provider.onSBB(this);
    }
    static getCompletions(): CompletionItem[] {
        throw new Error("Method 'getCompletions' must be implemented.");
    }
}
class Blueprint extends Asset {
    static getCompletions(): CompletionItem[] {
        throw new Error("Method 'getCompletions' must be implemented.");
    }
}

export class AssetIndex {
    blocks: Block[] = [];
    blockTextures: BlockTexture[] = [];
    items: Item[] = [];
    itemTextures: ItemTexture[] = [];
    tools: Tool[] = [];
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
            await AssetIndex.registerAsset<Block>(
                Block,
                index.blocks,
                "blocks",
                addon.name,
                ".zig.zon",
            );
            await AssetIndex.registerAsset<BlockTexture>(
                BlockTexture,
                index.blockTextures,
                "blocks/textures",
                addon.name,
                ".png",
            );
            await AssetIndex.registerAsset<Item>(
                Item,
                index.items,
                "items",
                addon.name,
                ".zig.zon",
            );
            await AssetIndex.registerTextures<ItemTexture>(
                ItemTexture,
                index.itemTextures,
                "items/textures",
                addon.name,
            );
            await AssetIndex.registerAsset<Tool>(
                Tool,
                index.tools,
                "tools",
                addon.name,
                ".zig.zon",
            );
            await AssetIndex.registerAsset<Biome>(
                Biome,
                index.biomes,
                "biomes",
                addon.name,
                ".zig.zon",
            );
            await AssetIndex.registerAsset<Model>(
                Model,
                index.models,
                "models",
                addon.name,
                ".obj",
            );
            await AssetIndex.registerAsset<SBB>(
                SBB,
                index.structureBuildingBlocks,
                "sbb",
                addon.name,
                ".zig.zon",
            );
            await AssetIndex.registerAsset<Blueprint>(
                Blueprint,
                index.blueprints,
                "sbb",
                addon.name,
                ".blp",
            );
        }
        return index;
    }

    static async registerAsset<AssetT>(
        cls: new (id: string, location: string) => AssetT,
        storage: AssetT[],
        scope: string,
        addon: string,
        extension: string,
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

            storage.push(new cls(id, location));
            log.log(`Registered ${scope} asset: '${id}' at ${location}`);
        }
    }
    static async registerTextures<AssetT>(
        cls: new (id: string, location: string) => AssetT,
        storage: AssetT[],
        scope: string,
        addon: string,
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

            storage.push(new cls(id, location));
            log.log(`Registered ${scope} asset: '${id}' at ${location}`);
        }
    }
}
