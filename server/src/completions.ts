import {
    CompletionItem,
    CompletionItemKind,
    CompletionParams,
    InsertTextFormat,
    InsertTextMode,
} from "vscode-languageserver/node";
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
    ZonNumber,
} from "./zon";

interface Completion<T> {
    type: T;
    keyKind?: CompletionItemKind;
    keyDetail?: string;
}

interface NumberCompletion extends Completion<"number"> {
    completions: () => void;
}
interface StringCompletion extends Completion<"string"> {
    completions: (node: ZonNode) => void;
}
interface IdentifierCompletion extends Completion<"identifier"> {
    completions: (node: ZonIdentifier) => void;
}
type BooleanCompletion = Completion<"boolean">;
interface ObjectCompletion extends Completion<"object"> {
    completions: () => Record<string, AnyCompletion>;
}
interface ArrayCompletion extends Completion<"array"> {
    completions: () => AnyCompletion[];
}

type AnyCompletion =
    | NumberCompletion
    | StringCompletion
    | IdentifierCompletion
    | ObjectCompletion
    | ArrayCompletion
    | BooleanCompletion;

class ResolveCompletion {
    visitor: CompletionVisitor;

    constructor(visitor: CompletionVisitor) {
        this.visitor = visitor;
    }

    /**
     * Append all the relevant completions for a given object indicated by `path` parameter
     * as described by schema from `completion` argument. Completion items are appended directly
     * to visitor specified in a constructor of this class.
     */
    any(path: ZonNode[], completion: AnyCompletion): void {
        if (path.length === 0) return;

        switch (completion.type) {
            case "object": {
                const [first, ...rest] = path;

                if (first instanceof ZonSyntaxError && [".", ""].includes(first.value)) {
                    this.visitor.completions.push({
                        label: ".{}",
                        insertText: ".{$0}",
                        kind: CompletionItemKind.Method,
                        insertTextFormat: InsertTextFormat.Snippet,
                    });
                    break;
                }

                if (
                    !(
                        first instanceof ZonObject ||
                        first instanceof ZonEmpty ||
                        first instanceof ZonArray
                    )
                )
                    break;

                this.obj(first, rest, completion);
                break;
            }
            case "array": {
                const [first, ...rest] = path;
                if (!(first instanceof ZonArray || first instanceof ZonEmpty)) return;
                this.array(first, rest, completion);
                break;
            }
            case "number": {
                const [first, ...rest] = path;
                if (!(first instanceof ZonNumber || first instanceof ZonSyntaxError)) return;
                if (rest.length > 0) return;
                this.number(first, completion);
                break;
            }
            case "string": {
                const [first, ...rest] = path;
                if (!(first instanceof ZonString || first instanceof ZonSyntaxError)) return;
                if (rest.length > 0) return;
                this.string(first, completion);
                break;
            }
            case "identifier": {
                const [first, ...rest] = path;
                if (!(first instanceof ZonIdentifier || first instanceof ZonSyntaxError)) return;
                if (rest.length > 0) return;
                this.identifier(first, completion);
                break;
            }
            case "boolean": {
                const [first, ...rest] = path;
                if (!(first instanceof ZonString || first instanceof ZonSyntaxError)) return;
                if (rest.length > 0) return;
                this.boolean();
            }
        }
    }

    obj(
        zonObject: ZonObject | ZonEmpty | ZonArray,
        rest: ZonNode[],
        completion: ObjectCompletion,
    ): void {
        const objectCompletions = completion.completions();

        // Object can be misinterpreted as an array if there is a syntax error / it was not finished yet.
        if (zonObject instanceof ZonArray) {
            if (rest.length > 1) return; // Deep completion inside arrays is not supported form object perspective.
            if (rest.length === 0) {
                const target = rest[0] as ZonSyntaxError;
                this.suggestObjectKeys(zonObject, objectCompletions, target.getValueString() ?? "");
            } else {
                this.suggestObjectKeys(zonObject, objectCompletions);
            }
            return;
        }

        // Completion was done directly inside an object, likely to add a new key.
        if (rest.length === 0 || zonObject instanceof ZonEmpty) {
            this.suggestObjectKeys(zonObject, objectCompletions);
            return;
        }

        // We have at least one `rest` node to inspect now.
        const [newFirst, ...newRest] = rest;
        if (newFirst instanceof ZonSyntaxError || newFirst instanceof ZonIdentifier) {
            this.suggestObjectKeys(newFirst, objectCompletions, newFirst.getValueString() ?? "");
            return;
        }
        if (!(newFirst instanceof ZonEntry)) return;
        const entryNode = newFirst;

        if (newRest.length === 0) {
            this.visitor.completions.push({
                label: `=`,
                kind: CompletionItemKind.Text,
            });
            return;
        }

        const childNode = newRest[0];
        if (childNode === entryNode.key) {
            if (childNode instanceof ZonSyntaxError || childNode instanceof ZonIdentifier) {
                this.suggestObjectKeys(
                    zonObject,
                    objectCompletions,
                    childNode.getValueString() ?? "",
                );
                return;
            }
            // No other viable completions available.
            return;
        }
        if (childNode === entryNode.value) {
            const completion = objectCompletions[entryNode.key.getValueString() ?? ""];
            if (completion) return this.any(newRest, completion);
            return;
        }
    }
    /**
     * Append suggestion entries for all relevant keys that can be present in object described by `completion`.
     * `prefix` argument can be used to narrow down the list by startsWith check.
     */
    suggestObjectKeys(
        node: ZonNode,
        objectCompletions: Record<string, AnyCompletion>,
        prefix = "",
    ): void {
        const existingKeys: string[] = [];
        if (node instanceof ZonObject) {
            existingKeys.push(...node.getKeyStrings());
        }
        for (const key in objectCompletions) {
            // Keys cannot be duplicated, so we shouldn't suggest duplicated keys.
            if (existingKeys.includes(key)) continue;
            // If we already have a prefix, we should skip everyting that starts differently.
            if (!key.startsWith(prefix)) continue;

            this.visitor.completions.push({
                label: `.${key}`,
                kind: objectCompletions[key].keyKind ?? CompletionItemKind.Keyword,
                detail: objectCompletions[key].keyDetail ?? objectCompletions[key].type,
            });
        }
    }
    array(_first: ZonArray | ZonEmpty, _rest: ZonNode[], _completion: ArrayCompletion): void {}
    number(_first: ZonNumber | ZonSyntaxError, _completion: NumberCompletion): void {}
    string(first: ZonString | ZonSyntaxError, completion: StringCompletion): void {
        completion.completions(first);
    }
    boolean(): void {
        const completions = ["true", "false"].map((e: string): CompletionItem => {
            return {
                label: e,
                kind: CompletionItemKind.Constant,
                detail: "item texture",
            };
        });
        this.visitor.completions.push(...completions);
    }
    identifier(first: ZonIdentifier | ZonSyntaxError, completion: IdentifierCompletion): void {
        completion.completions(first);
    }
}

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

    getBlockTextureCompletionCallback(): (node: ZonNode) => void {
        return (node: ZonNode) => {
            const completions = BlockTexture.all().map((e: BlockTexture): CompletionItem => {
                return {
                    label: e.id,
                    insertText: node instanceof ZonString ? e.id : '"' + e.id + '"',
                    insertTextMode: InsertTextMode.asIs,
                    kind: CompletionItemKind.Struct,
                    detail: "block texture",
                };
            });
            this.completions.push(...completions);
            return;
        };
    }
    getItemTextureCompletionCallback(): (node: ZonNode) => void {
        return (node: ZonNode) => {
            const completions = ItemTexture.all().map((e: ItemTexture): CompletionItem => {
                return {
                    label: e.id,
                    insertText: node instanceof ZonString ? e.id : '"' + e.id + '"',
                    insertTextMode: InsertTextMode.asIs,
                    kind: CompletionItemKind.Struct,
                    detail: "item texture",
                };
            });
            this.completions.push(...completions);
        };
    }
    getModelCompletionCallback(): (node: ZonNode) => void {
        return (node: ZonNode) => {
            const completions = Model.all().map((e: Model): CompletionItem => {
                return {
                    label: e.id,
                    insertText: node instanceof ZonString ? e.id : '"' + e.id + '"',
                    insertTextMode: InsertTextMode.asIs,
                    kind: CompletionItemKind.Module,
                    detail: "model",
                };
            });
            this.completions.push(...completions);
        };
    }
    getRotationCompletionCallback(): (node: ZonNode) => void {
        return (node: ZonNode) => {
            const completions = [
                "cubyz:branch",
                "cubyz:carpet",
                "cubyz:direction",
                "cubyz:fence",
                "cubyz:hanging",
                "cubyz:log",
                "cubyz:no_rotation",
                "cubyz:ore",
                "cubyz:planar",
                "cubyz:sign",
                "cubyz:stairs",
                "cubyz:texture_pile",
                "cubyz:torch",
            ].map((s: string): CompletionItem => {
                return {
                    label: s,
                    insertText: node instanceof ZonString ? s : '"' + s + '"',
                    insertTextMode: InsertTextMode.asIs,
                    kind: CompletionItemKind.Module,
                    detail: "model",
                };
            });
            this.completions.push(...completions);
        };
    }
    async onBlock(_asset: Block): Promise<void> {
        new ResolveCompletion(this).any(this.nodePath.path, {
            type: "object",
            completions: () => ({
                item: {
                    type: "object",
                    completions: () => ({
                        material: {
                            type: "object",
                            completions: () => ({
                                durability: {
                                    type: "number",
                                    completions: () => {},
                                },
                                massDamage: {
                                    type: "number",
                                    completions: () => {},
                                },
                                hardnessDamage: {
                                    type: "number",
                                    completions: () => {},
                                },
                                swingSpeed: {
                                    type: "number",
                                    completions: () => {},
                                },
                                textureRoughness: {
                                    type: "number",
                                    completions: () => {},
                                },
                                colors: {
                                    type: "array",
                                    completions: () => [],
                                },
                                modifiers: {
                                    type: "array",
                                    completions: () => [],
                                },
                            }),
                        },
                        texture: {
                            type: "string",
                            completions: this.getItemTextureCompletionCallback(),
                        },
                    }),
                },
                rotation: {
                    type: "string",
                    completions: this.getRotationCompletionCallback(),
                },
                blockHealth: {
                    type: "string",
                    completions: () => {},
                },
                blockResistance: {
                    type: "string",
                    completions: () => {},
                },
                tags: {
                    type: "string",
                    completions: () => {},
                },
                emittedLight: {
                    type: "string",
                    completions: () => {},
                },
                absorbedLight: {
                    type: "string",
                    completions: () => {},
                },
                degradable: { type: "boolean" },
                selectable: {
                    type: "string",
                    completions: () => {},
                },
                replacable: {
                    type: "string",
                    completions: () => {},
                },
                transparent: {
                    type: "string",
                    completions: () => {},
                },
                collide: {
                    type: "string",
                    completions: () => {},
                },
                alwaysViewThrough: {
                    type: "string",
                    completions: () => {},
                },
                viewThrough: {
                    type: "string",
                    completions: () => {},
                },
                hasBackFace: {
                    type: "string",
                    completions: () => {},
                },
                friction: {
                    type: "number",
                    completions: () => {},
                },
                bounciness: {
                    type: "number",
                    completions: () => {},
                },
                density: {
                    type: "number",
                    completions: () => {},
                },
                terminalVelocity: {
                    type: "number",
                    completions: () => {},
                },
                mobility: {
                    type: "number",
                    completions: () => {},
                },
                allowOres: {
                    type: "boolean",
                    completions: () => {},
                },
                blockEntity: {
                    type: "string",
                    completions: () => {},
                },
                ore: {
                    type: "object",
                    completions: () => ({
                        veins: {
                            type: "number",
                            completions: () => {},
                        },
                        size: {
                            type: "number",
                            completions: () => {},
                        },
                        height: {
                            type: "number",
                            completions: () => {},
                        },
                        minHeight: {
                            type: "number",
                            completions: () => {},
                        },
                        density: {
                            type: "number",
                            completions: () => {},
                        },
                    }),
                },
                model: {
                    type: "string",
                    completions: this.getModelCompletionCallback(),
                },
                ...(() => {
                    const completions: Record<string, AnyCompletion> = {};
                    const completionCallback = this.getBlockTextureCompletionCallback();
                    for (const suffix of [
                        ...Array(16).keys(),
                        "",
                        "_front",
                        "_left",
                        "_right",
                        "_top",
                        "_bottom",
                    ]) {
                        completions[`texture${suffix}`] = {
                            type: "string",
                            completions: completionCallback,
                        };
                    }
                    return completions;
                })(),
            }),
        });

        return;
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
