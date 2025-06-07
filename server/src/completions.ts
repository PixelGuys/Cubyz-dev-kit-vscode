import { CompletionItemKind, CompletionItem, CompletionParams } from "vscode-languageserver/node";

export class CompletionVisitor {
	params: CompletionParams;
	completions: CompletionItem[];

	constructor(params: CompletionParams) {
		this.params = params;
		this.completions = [];
	}

	async onBlock(): Promise<void> {}
	async onItem(): Promise<void> {}
	async onTool(): Promise<void> {}
	async onBiome(): Promise<void> {}
	async onSBB(): Promise<void> {}
}
