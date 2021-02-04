import {LanguageCode, SourceInfo, TagType} from "paperback-extensions-common";
import {Madara} from '../Madara'

const MANGATX_DOMAIN = "https://mangatx.com"

export const MangaTXInfo: SourceInfo = {
    version: '1.0.0',
    name: 'MangaTX.com',
    description: 'Extension that pulls western comics from mangatx.com',
    author: 'GameFuzzy',
    authorWebsite: 'http://github.com/gamefuzzy',
    icon: "icon.png",
    hentaiSource: false,
    websiteBaseURL: MANGATX_DOMAIN,
    sourceTags: [
        {
            text: "Notifications",
            type: TagType.GREEN
        }
    ]
}

export class MangaTX extends Madara {
    baseUrl: string = MANGATX_DOMAIN
    languageCode: LanguageCode = LanguageCode.ENGLISH
    //sourceTraversalPathName: string = 'read'
    //homePage: string = 'webtoons'
}