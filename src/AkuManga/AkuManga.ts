import {LanguageCode, SourceInfo, TagType} from "paperback-extensions-common";
import {Madara} from '../Madara'

const AKUMANGA_DOMAIN = "https://akumanga.com"

export const AkuMangaInfo: SourceInfo = {
    version: '1.0.0',
    name: 'AkuManga',
    description: 'موقع ترجمة المانجا العربية',
    author: 'GameFuzzy',
    authorWebsite: 'http://github.com/gamefuzzy',
    icon: "icon.png",
    hentaiSource: false,
    websiteBaseURL: AKUMANGA_DOMAIN,
    sourceTags: [
        {
            text: "Notifications",
            type: TagType.GREEN
        }
    ]
}

export class AkuManga extends Madara {
    baseUrl: string = AKUMANGA_DOMAIN
    languageCode: LanguageCode = LanguageCode.ENGLISH
    hasAdvancedSearchPage: boolean = true


}
