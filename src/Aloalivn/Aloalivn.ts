import {LanguageCode, SourceInfo, TagType} from "paperback-extensions-common";
import {Madara} from '../Madara'

const ALOALIVN_DOMAIN = "https://aloalivn.com"

export const AloalivnInfo: SourceInfo = {
    version: '1.1.0',
    name: 'Aloalivn',
    description: 'Extension that pulls manga from aloalivn.com',
    author: 'GameFuzzy',
    authorWebsite: 'http://github.com/gamefuzzy',
    icon: "icon.png",
    hentaiSource: false,
    websiteBaseURL: ALOALIVN_DOMAIN,
    sourceTags: [
        {
            text: "Notifications",
            type: TagType.GREEN
        }
    ]
}

export class Aloalivn extends Madara {
    baseUrl: string = ALOALIVN_DOMAIN
    languageCode: LanguageCode = LanguageCode.ENGLISH
    hasAdvancedSearchPage: boolean = true
    chapterDetailsSelector: string = 'li.blocks-gallery-item > figure > img'
}
