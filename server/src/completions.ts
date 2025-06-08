import { CompletionItem, CompletionParams } from "vscode-languageserver/node";
import { Block, Item, Tool, Biome, SBB, Model, BlockTexture } from "./assets";
import { ZonNode, Is } from "./zon";

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
            if (Is.valueOfKey(this.node, "model")) {
                this.completions.push(...Model.getCompletions());
            } else if (Is.valueOfKeyMatch(this.node, /texture.*/)) {
                this.completions.push(...BlockTexture.getCompletions());
            }
        }
    }
    async onItem(_asset: Item): Promise<void> {}
    async onTool(_asset: Tool): Promise<void> {}
    async onBiome(_asset: Biome): Promise<void> {}
    async onSBB(_asset: SBB): Promise<void> {}
}
