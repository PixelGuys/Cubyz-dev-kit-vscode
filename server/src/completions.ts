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
    ZonNumber,
} from "./zon";

interface Completion<T> {
    type: T;
    keyKind?: CompletionItemKind;
    keyDetail?: string;
}

interface CompletionRef extends Completion<"ref"> {
    ref: (string | number)[];
}

interface NumberCompletion extends Completion<"number"> {
    completions: () => void;
}
interface StringCompletion extends Completion<"string"> {
    completions: (prefix: string) => void;
}
interface IdentifierCompletion extends Completion<"identifier"> {
    completions: (prefix: string) => void;
}

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
    | CompletionRef;

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
                if (
                    !(
                        first instanceof ZonObject ||
                        first instanceof ZonEmpty ||
                        first instanceof ZonArray
                    )
                )
                    return;
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
            const allAreSyntaxErrors = zonObject.items
                .map((x) => x instanceof ZonSyntaxError)
                .reduce((prev, curr) => prev && curr);
            if (!allAreSyntaxErrors) return;

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
                detail: objectCompletions[key].keyDetail ?? "option",
            });
        }
    }
    array(_first: ZonArray | ZonEmpty, _rest: ZonNode[], _completion: ArrayCompletion): void {}
    number(_first: ZonNumber | ZonSyntaxError, _completion: NumberCompletion): void {}
    string(first: ZonString | ZonSyntaxError, completion: StringCompletion): void {
        completion.completions(first.getValueString() ?? "");
    }
    identifier(_first: ZonIdentifier | ZonSyntaxError, _completion: IdentifierCompletion): void {}
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

    async onBlock(_asset: Block): Promise<void> {
        const completeTexture = (prefix: string) => {
            const completions = BlockTexture.getCompletions((m: Model) => m.id.startsWith(prefix));
            this.completions.push(...completions);
            return;
        };

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
                            completions: () => {},
                        },
                    }),
                },
                rotation: {
                    type: "string",
                    completions: () => {},
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
                degradable: {
                    type: "string",
                    completions: () => {},
                },
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
                    type: "string",
                    completions: () => {},
                },
                bounciness: {
                    type: "string",
                    completions: () => {},
                },
                density: {
                    type: "string",
                    completions: () => {},
                },
                terminalVelocity: {
                    type: "string",
                    completions: () => {},
                },
                mobility: {
                    type: "string",
                    completions: () => {},
                },
                allowOres: {
                    type: "string",
                    completions: () => {},
                },
                blockEntity: {
                    type: "string",
                    completions: () => {},
                },
                ore: {
                    type: "string",
                    completions: () => {},
                },
                model: {
                    type: "string",
                    completions: (prefix: string) => {
                        const completions = Model.getCompletions((m: Model) =>
                            m.id.startsWith(prefix),
                        );
                        this.completions.push(...completions);
                        return;
                    },
                },
                texture0: {
                    type: "string",
                    completions: completeTexture,
                },
                texture1: {
                    type: "ref",
                    ref: ["texture0"],
                },
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
