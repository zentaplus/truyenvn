import {LanguageCode, SourceInfo, TagType} from "paperback-extensions-common";
import {Madara} from '../Madara'

const ARANGSCANS_DOMAIN = "https://arangscans.com"

export const ArangScansInfo: SourceInfo = {
    version: '1.0.0',
    name: 'ArangScans',
    description: 'Extension that pulls manga from arangscans.com',
    author: 'GameFuzzy',
    authorWebsite: 'http://github.com/gamefuzzy',
    icon: "icon.png",
    hentaiSource: false,
    websiteBaseURL: ARANGSCANS_DOMAIN,
    sourceTags: [
        {
            text: "Notifications",
            type: TagType.GREEN
        }
    ]
}

export class ArangScans extends Madara {
    baseUrl: string = ARANGSCANS_DOMAIN
    languageCode: LanguageCode = LanguageCode.ENGLISH
}