import {LanguageCode, SourceInfo, TagType} from "paperback-extensions-common";
import {Madara} from '../Madara'

const WEBTOON_DOMAIN = "https://www.webtoon.xyz"

export const WebtoonXYZInfo: SourceInfo = {
    version: '1.1.0',
    name: 'WebtoonXYZ',
    description: 'Extension that pulls manga from Webtoon.XYZ',
    author: 'GameFuzzy',
    authorWebsite: 'http://github.com/gamefuzzy',
    icon: "icon.png",
    hentaiSource: false,
    websiteBaseURL: WEBTOON_DOMAIN,
    sourceTags: [
        {
            text: "Notifications",
            type: TagType.GREEN
        },
        {
            text: "Cloudflare",
            type: TagType.RED
        }
    ]
}

export class WebtoonXYZ extends Madara {
    baseUrl: string = WEBTOON_DOMAIN
    languageCode: LanguageCode = LanguageCode.ENGLISH
    sourceTraversalPathName: string = 'read'
    userAgentRandomizer = ''
}
