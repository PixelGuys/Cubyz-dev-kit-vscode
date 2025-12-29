import { CompletionItem, CompletionItemKind, CompletionParams } from "vscode-languageserver/node";
import { Block, Item, Tool, Biome, SBB, Model, BlockTexture, ItemTexture } from "./assets";
import {
    ZonNode,
    Is,
    ZonSyntaxError,
    ZonIdentifier,
    ZonEntry,
    ZonObject,
    ZonEmpty,
    ZonArray,
    ZonNodePath,
    ZonString,
} from "./zon";

export class CompletionVisitor {
    params: CompletionParams;
    completions: CompletionItem[];
    ast: ZonNode;
    node: ZonNode;
    nodePath: ZonNodePath;

    constructor(params: CompletionParams, ast: ZonNode, node: ZonNode, nodePath: ZonNodePath) {
        this.params = params;
        this.completions = [];
        this.ast = ast;
        this.node = node;
        this.nodePath = nodePath;
    }
    async onBlock(_asset: Block): Promise<void> {
        const completeTexture = () => {
            const completions = BlockTexture.getCompletions((m: Model) =>
                m.id.startsWith((node as ZonString).value),
            );
            this.completions.push(...completions);
            return;
        };

        const topLevelKeys: Record<string, () => void> = {
            ".rotation": () => {},
            ".blockHealth": () => {},
            ".blockResistance": () => {},
            ".tags": () => {},
            ".emittedLight": () => {},
            ".absorbedLight": () => {},
            ".degradable": () => {},
            ".selectable": () => {},
            ".replacable": () => {},
            ".transparent": () => {},
            ".collide": () => {},
            ".alwaysViewThrough": () => {},
            ".viewThrough": () => {},
            ".hasBackFace": () => {},
            ".friction": () => {},
            ".bounciness": () => {},
            ".density": () => {},
            ".terminalVelocity": () => {},
            ".mobility": () => {},
            ".allowOres": () => {},
            ".blockEntity": () => {},
            ".ore": () => {},
            ".model": () => {
                const completions = Model.getCompletions((m: Model) =>
                    m.id.startsWith((node as ZonString).value),
                );
                this.completions.push(...completions);
                return;
            },
            ".texture_bottom": completeTexture,
            ".texture_top": completeTexture,
            ".texture_right": completeTexture,
            ".texture_left": completeTexture,
            ".texture_front": completeTexture,
            ".texture_back": completeTexture,
        };

        for (let i = 0; i < 16; i++) {
            topLevelKeys[`.texture${i}`] = completeTexture;
        }

        const node = this.node;

        // Top level completions
        if (node.parent === null) {
            if (node instanceof ZonObject || node instanceof ZonEmpty || node instanceof ZonArray) {
                return this.addCompletions(Object.keys(topLevelKeys), { detail: "option" });
            }
            return;
        }

        if (
            this.nodePath.match([
                (x) => x instanceof ZonObject,
                (x) => {
                    const isZonEntry = x instanceof ZonEntry;
                    if (!isZonEntry) return false;

                    const isKey = node === x.key;
                    if (!isKey) return false;

                    return true;
                },
                (x) => x instanceof ZonIdentifier || x instanceof ZonSyntaxError,
            ])
        ) {
            return this.addCompletionsLike(
                Object.keys(topLevelKeys),
                (node as ZonIdentifier).value,
                {
                    detail: "option",
                },
            );
        }

        const completeTopLevelValueConditions = (predicate: (keyName: string) => boolean) => [
            (x: ZonNode) => x instanceof ZonObject,
            (x: ZonNode) => {
                const isZonEntry = x instanceof ZonEntry;
                if (!isZonEntry) return false;

                const isValue = node === x.value;
                if (!isValue) return false;

                const isKeyStringLike =
                    x.key instanceof ZonIdentifier || x.key instanceof ZonSyntaxError;
                if (!isKeyStringLike) return false;

                const isKeyMatch = predicate((x.key as ZonIdentifier).value);
                if (!isKeyMatch) return false;

                return true;
            },
            (x: ZonNode) => x instanceof ZonString || x instanceof ZonSyntaxError,
        ];

        for (const key in topLevelKeys) {
            if (
                this.nodePath.match(
                    completeTopLevelValueConditions(
                        (keyName) =>
                            key.startsWith(keyName) || key.substring(1).startsWith(keyName),
                    ),
                )
            ) {
                topLevelKeys[key]();
            }
        }
    }
    addCompletionsLike(symbols: string[], like: string, extra: object = {}): void {
        return this.addCompletions(
            symbols.filter((item) => item.startsWith(like) || item.substring(1).startsWith(like)),
            extra,
        );
    }
    addCompletions(symbols: string[], extra: object = {}): void {
        symbols.forEach((symbol) => {
            this.completions.push({
                label: symbol,
                kind: CompletionItemKind.Constant,
                ...extra,
            });
        });
    }
    async onItem(_asset: Item): Promise<void> {
        const topLevelKeys = [
            ".name",
            ".tags",
            ".stackSize",
            ".material",
            ".block",
            ".texture",
            ".foodValue",
        ];
        const materialKeys = [
            ".density",
            ".elasticity",
            ".hardness",
            ".textureRoughness",
            ".colors",
        ];
        if (Is.topLevelObject(this.node)) {
            if (Is.entryKeyEqual(this.node, "texture")) {
                this.completions.push(...ItemTexture.getCompletions());
                return;
            }
            if (Is.childOfEntry(this.node)) {
                if (this.node instanceof ZonSyntaxError || this.node instanceof ZonIdentifier) {
                    this.addCompletions(topLevelKeys);
                    return;
                }
            }
        }
        if (Is.topLevelObject(this.node)) {
            this.addCompletions(topLevelKeys);
            return;
        }
        if (this.node instanceof ZonSyntaxError || this.node instanceof ZonIdentifier) {
            if (this.node.parent instanceof ZonEntry) {
                const materialsEntry = this.node.parent;
                if (materialsEntry.parent instanceof ZonObject) {
                    const materialsObject = materialsEntry.parent;
                    if (materialsObject.parent instanceof ZonEntry) {
                        const itemEntry = materialsObject.parent;
                        if (
                            (itemEntry.key instanceof ZonIdentifier ||
                                itemEntry.key instanceof ZonSyntaxError) &&
                            itemEntry.key.value === "material"
                        ) {
                            this.addCompletions(materialKeys);
                            return;
                        }
                    }
                }
            }
        }
    }
    async onTool(_asset: Tool): Promise<void> {}
    async onBiome(_asset: Biome): Promise<void> {}
    async onSBB(_asset: SBB): Promise<void> {}
}
