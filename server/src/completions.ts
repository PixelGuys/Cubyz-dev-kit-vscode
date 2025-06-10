import { CompletionItem, CompletionItemKind, CompletionParams } from "vscode-languageserver/node";
import { Block, Item, Tool, Biome, SBB, Model, BlockTexture } from "./assets";
import { ZonNode, Is, ZonSyntaxError, ZonIdentifier } from "./zon";

export class CompletionVisitor {
    params: CompletionParams;
    completions: CompletionItem[];
    ast: ZonNode;
    node: ZonNode;

    constructor(params: CompletionParams, ast: ZonNode, node: ZonNode) {
        this.params = params;
        this.completions = [];
        this.ast = ast;
        this.node = node;
    }
    async onBlock(_asset: Block): Promise<void> {
        if (Is.childOfTopLevelObject(this.node)) {
            if (Is.entryKeyEqual(this.node, "model")) {
                this.completions.push(...Model.getCompletions());
            } else if (Is.entryKeyMatch(this.node, /texture.*/)) {
                this.completions.push(...BlockTexture.getCompletions());
            }
            if (Is.childOfEntry(this.node)) {
                if (this.node instanceof ZonSyntaxError || this.node instanceof ZonIdentifier) {
                    const identifiers = [
                        ".rotation",
                        ".blockHealth",
                        ".blockResistance",
                        ".tags",
                        ".emittedLight",
                        ".absorbedLight",
                        ".degradable",
                        ".selectable",
                        ".replacable",
                        ".gui",
                        "transparent",
                        ".collide",
                        ".alwaysViewThrough",
                        ".viewThrough",
                        ".hasBackFace",
                        ".friction",
                        ".allowOres",
                        ".tickEvent",
                        ".touchFunction",
                        ".blockEntity",
                        ".ore",
                    ];
                    this.addCompletionsFromArray(identifiers);
                }
            }
        }
    }
    addCompletionsFromArray(symbols: string[]): void {
        symbols.forEach((symbol) => {
            this.completions.push({
                label: symbol,
                kind: CompletionItemKind.Constant,
            });
        });
    }
    async onItem(_asset: Item): Promise<void> {}
    async onTool(_asset: Tool): Promise<void> {}
    async onBiome(_asset: Biome): Promise<void> {}
    async onSBB(_asset: SBB): Promise<void> {}
}
