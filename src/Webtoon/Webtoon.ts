import {LanguageCode, SourceInfo, TagType} from "paperback-extensions-common";
import {Madara} from '../Madara'

const WEBTOON_DOMAIN = "https://www.webtoon.xyz"

export const WebtoonInfo: SourceInfo = {
    version: '1.0.0',
    name: 'Webtoon.xyz',
    description: 'Extension that pulls manga from webtoon.xyz',
    author: 'GameFuzzy',
    authorWebsite: 'http://github.com/gamefuzzy',
    icon: "icon.png",
    hentaiSource: false,
    websiteBaseURL: WEBTOON_DOMAIN,
    sourceTags: [
        {
            text: "Notifications",
            type: TagType.GREEN
        }
    ]
}

export class Webtoon extends Madara {
    baseUrl: string = WEBTOON_DOMAIN
    languageCode: LanguageCode = LanguageCode.ENGLISH
    sourceTraversalPathName: string = 'read'
    homePage: string = 'webtoons'
}