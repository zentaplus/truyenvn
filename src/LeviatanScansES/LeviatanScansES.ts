import {LanguageCode, SourceInfo, TagType} from "paperback-extensions-common";
import {Madara} from "../Madara";

const LEVIATANSCANSES_DOMAIN = "https://es.leviatanscans.com"

export const LeviatanScansESInfo: SourceInfo = {
    version: '1.1.1',
    name: 'LeviatanScansES',
    description: 'Extension that pulls manga from es.leviatanscans.com',
    author: 'GameFuzzy',
    authorWebsite: 'http://github.com/gamefuzzy',
    icon: "icon.png",
    hentaiSource: false,
    websiteBaseURL: LEVIATANSCANSES_DOMAIN,
    sourceTags: [
        {
            text: "Notifications",
            type: TagType.GREEN
        }
    ]
}

export class LeviatanScansES extends Madara {
    baseUrl: string = LEVIATANSCANSES_DOMAIN
    languageCode: LanguageCode = LanguageCode.ENGLISH
}
