import { CompletionItemKind, CompletionItem, InsertTextMode } from "vscode-languageserver/node";
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

abstract class AssetInterface {
    abstract id: string;
    abstract location: string;
}

type AssetInterfaceConstructor<T extends AssetInterface> = new (id: string, location: string) => T;

class Asset implements AssetInterface {
    id: string;
    location: string;

    constructor(id: string, location: string) {
        this.id = id;
        this.location = location;
    }
    async visit(_provider: CompletionVisitor): Promise<void> {
        throw new Error("Method 'visit' must be implemented.");
    }
    static all(): Asset[] {
        throw new Error("Static method 'all' must be implemented.");
    }
    static getCompletions(_condition: (asset: Asset) => boolean = () => true): CompletionItem[] {
        throw new Error("Static method 'getCompletions' must be implemented.");
    }
}
export class Block extends Asset {
    async visit(provider: CompletionVisitor): Promise<void> {
        await provider.onBlock(this);
    }
    static all(): Block[] {
        return ASSET_INDEX?.blocks ?? [];
    }
    static getCompletions(condition: (asset: Block) => boolean = () => true): CompletionItem[] {
        const completions: CompletionItem[] = [];
        ASSET_INDEX?.blocks.forEach((element) => {
            if (condition(element))
                completions.push({
                    label: element.id,
                    kind: CompletionItemKind.Class,
                    data: completions.length,
                    detail: "block",
                });
        });
        return completions;
    }
}
export class BlockTexture extends Asset {
    static all(): BlockTexture[] {
        return ASSET_INDEX?.blockTextures ?? [];
    }
    static getCompletions(
        condition: (asset: BlockTexture) => boolean = () => true,
    ): CompletionItem[] {
        const completions: CompletionItem[] = [];
        ASSET_INDEX?.blockTextures.forEach((element) => {
            if (condition(element))
                completions.push({
                    label: element.id,
                    kind: CompletionItemKind.Struct,
                    data: completions.length,
                    detail: "block texture",
                });
        });
        return completions;
    }
}
export class Item extends Asset {
    async visit(provider: CompletionVisitor): Promise<void> {
        await provider.onItem(this);
    }
    static all(): Item[] {
        return ASSET_INDEX?.items ?? [];
    }
    static getCompletions(condition: (asset: Item) => boolean = () => true): CompletionItem[] {
        const completions: CompletionItem[] = [];
        ASSET_INDEX?.items.forEach((element) => {
            if (condition(element))
                completions.push({
                    label: element.id,
                    kind: CompletionItemKind.Class,
                    data: completions.length,
                    detail: "item",
                });
        });
        return completions;
    }
}
export class ItemTexture extends Asset {
    static all(): ItemTexture[] {
        return ASSET_INDEX?.itemTextures ?? [];
    }
    static getCompletions(
        condition: (asset: ItemTexture) => boolean = () => true,
    ): CompletionItem[] {
        const completions: CompletionItem[] = [];
        ASSET_INDEX?.itemTextures.forEach((element) => {
            if (condition(element))
                completions.push({
                    label: element.id,
                    insertText: '"' + element.id + '"',
                    insertTextMode: InsertTextMode.asIs,
                    kind: CompletionItemKind.Struct,
                    data: completions.length,
                    detail: "item texture",
                });
        });
        return completions;
    }
}
export class Tool extends Asset {
    async visit(provider: CompletionVisitor): Promise<void> {
        await provider.onTool(this);
    }
    static all(): Tool[] {
        return ASSET_INDEX?.tools ?? [];
    }
    static getCompletions(condition: (asset: Tool) => boolean = () => true): CompletionItem[] {
        const completions: CompletionItem[] = [];
        ASSET_INDEX?.tools.forEach((element) => {
            if (condition(element))
                completions.push({
                    label: element.id,
                    kind: CompletionItemKind.Class,
                    data: completions.length,
                    detail: "tool",
                });
        });
        return completions;
    }
}
export class Biome extends Asset {
    async visit(provider: CompletionVisitor): Promise<void> {
        await provider.onBiome(this);
    }
    static all(): Biome[] {
        return ASSET_INDEX?.biomes ?? [];
    }
    static getCompletions(condition: (asset: Biome) => boolean = () => true): CompletionItem[] {
        const completions: CompletionItem[] = [];
        ASSET_INDEX?.biomes.forEach((element) => {
            if (condition(element))
                completions.push({
                    label: element.id,
                    kind: CompletionItemKind.Class,
                    data: completions.length,
                    detail: "biome",
                });
        });
        return completions;
    }
}
export class Model extends Asset {
    static all(): Model[] {
        return ASSET_INDEX?.models ?? [];
    }
    static getCompletions(condition: (asset: Model) => boolean = () => true): CompletionItem[] {
        const completions: CompletionItem[] = [];
        ASSET_INDEX?.models.forEach((element) => {
            if (condition(element))
                completions.push({
                    label: element.id,
                    kind: CompletionItemKind.Module,
                    data: completions.length,
                    detail: "model",
                });
        });
        return completions;
    }
}
export class SBB extends Asset {
    async visit(provider: CompletionVisitor): Promise<void> {
        await provider.onSBB(this);
    }
    static all(): SBB[] {
        return ASSET_INDEX?.structureBuildingBlocks ?? [];
    }
    static getCompletions(condition: (asset: SBB) => boolean = () => true): CompletionItem[] {
        const completions: CompletionItem[] = [];
        ASSET_INDEX?.structureBuildingBlocks.forEach((element) => {
            if (condition(element))
                completions.push({
                    label: element.id,
                    kind: CompletionItemKind.Class,
                    data: completions.length,
                    detail: "SBB",
                });
        });
        return completions;
    }
}
export class Blueprint extends Asset {
    static all(): Blueprint[] {
        return ASSET_INDEX?.blueprints ?? [];
    }
    static getCompletions(condition: (asset: Blueprint) => boolean = () => true): CompletionItem[] {
        const completions: CompletionItem[] = [];
        ASSET_INDEX?.blueprints.forEach((element) => {
            if (condition(element))
                completions.push({
                    label: element.id,
                    kind: CompletionItemKind.Module,
                    data: completions.length,
                    detail: "blueprint",
                });
        });
        return completions;
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

    static async registerAsset<T extends Asset>(
        cls: AssetInterfaceConstructor<T>,
        storage: T[],
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
    static async registerTextures<T extends Asset>(
        cls: AssetInterfaceConstructor<T>,
        storage: T[],
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
