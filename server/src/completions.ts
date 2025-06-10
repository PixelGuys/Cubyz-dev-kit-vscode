import { CompletionItem, CompletionParams } from "vscode-languageserver/node";
import { Block, Item, Tool, Biome, SBB, Model, BlockTexture } from "./assets";
import { ZonNode, Is, ZonSyntaxError } from "./zon";

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
                if (this.node instanceof ZonSyntaxError) {
                    console.log(ZonSyntaxError);
                    console.log(this.node.value);
                }
            }
        }
    }
    async onItem(_asset: Item): Promise<void> {}
    async onTool(_asset: Tool): Promise<void> {}
    async onBiome(_asset: Biome): Promise<void> {}
    async onSBB(_asset: SBB): Promise<void> {}
}
