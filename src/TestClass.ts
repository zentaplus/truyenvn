import { Madara, LanguageCode } from "paperback-extensions-common"

export class TestClass extends Madara {
    baseUrl: string = "https://www.webtoon.xyz"
    languageCode: LanguageCode = LanguageCode.ENGLISH
    sourceTraversalPathName: string = 'read'
    homePage: string = 'webtoons'
}