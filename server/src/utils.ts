export enum ZipMode {
    truncate,
}
export class Pair<T, U> {
    a: T;
    b: U;
    constructor(a: T, b: U) {
        this.a = a;
        this.b = b;
    }
}
export function zip<T, U>(a: T[], b: U[], mode: ZipMode = ZipMode.truncate): Pair<T, U>[] {
    const length = mode === ZipMode.truncate ? Math.min(a.length, b.length) : a.length;
    const result: Pair<T, U>[] = [];
    for (let i = 0; i < length; i++) {
        result.push(new Pair(a[i], b[i]));
    }
    return result;
}
