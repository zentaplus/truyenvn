import {LanguageCode, SourceInfo, TagType} from "paperback-extensions-common";
import {Madara} from '../Madara'

const LEVIATANSCANS_DOMAIN = "https://leviatanscans.com"

export const LeviatanScansInfo: SourceInfo = {
    version: '1.1.1',
    name: 'LeviatanScans',
    description: 'Extension that pulls manga from leviatanscans.com',
    author: 'GameFuzzy',
    authorWebsite: 'http://github.com/gamefuzzy',
    icon: "icon.png",
    hentaiSource: false,
    websiteBaseURL: LEVIATANSCANS_DOMAIN,
    sourceTags: [
        {
            text: "Notifications",
            type: TagType.GREEN
        }
    ]
}

export class LeviatanScans extends Madara {
    baseUrl: string = LEVIATANSCANS_DOMAIN
    languageCode: LanguageCode = LanguageCode.ENGLISH
    sourceTraversalPathName: string = 'comicss/manga'
}
