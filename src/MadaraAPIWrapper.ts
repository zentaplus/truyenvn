import { Madara } from "./Madara";
import { APIWrapper } from "paperback-extensions-common";

export class MadaraAPIWrapper extends APIWrapper {
    async getMadaraNumericId(source: Madara, mangaId: string): Promise<string> {
        return source.getNumericId(mangaId)
    }
}