import {
    Chapter,
    ChapterDetails,
    HomeSection,
    LanguageCode,
    Manga,
    MangaTile,
    MangaUpdates,
    PagedResults,
    SearchRequest,
    Source,
} from "paperback-extensions-common"

import {Parser} from './MadaraParser'

export abstract class Madara extends Source {
    /**
     * The Madara URL of the website. Eg. https://webtoon.xyz
     */
    abstract baseUrl: string

    /**
     * The language code which this source supports.
     */
    abstract languageCode: LanguageCode

    /**
     * The path that precedes a manga page not including the Madara URL.
     * Eg. for https://www.webtoon.xyz/read/limit-breaker/ it would be 'read'.
     * Used in all functions.
     */
    sourceTraversalPathName: string = 'manga'

    /**
     * By default, the homepage of a Madara is not its true homepage.
     * Accessing the site directory and sorting by the latest title allows
     * functions to step through the multiple pages easier, without a lot of custom
     * logic for each source.
     *
     * This variable holds the latter half of the website path which is required to reach the
     * directory page.
     * Eg. 'webtoons' for https://www.webtoon.xyz/webtoons/?m_orderby=latest
     */
    homePage: string = 'manga'

    /**
     * Some Madara sources have a different selector which is required in order to parse
     * out the popular manga. This defaults to the most common selector
     * but can be overridden by other sources which need it.
     */
    popularMangaSelector: string = "div.page-item-detail"

    /**
     * Much like {@link popularMangaSelector} this will default to the most used CheerioJS
     * selector to extract URLs from popular manga. This is available to be overridden.
     */
    popularMangaUrlSelector: string = "div.post-title a"
    /**
     * Different Madara sources might have a slightly different selector which is required to parse out
     * each manga object while on a search result page. This is the selector
     * which is looped over. This may be overridden if required.
     */
    searchMangaSelector: string = "div.c-tabs-item__content"
    /**
     * Set to false if your source has individual buttons for each page as opposed to a 'LOAD MORE' button
     */
    loadMoreSearchManga: boolean = true

    // Time parsing logic
    protected convertTime(timeAgo: string): Date {
        let time: Date
        let trimmed: number = Number((/\d*/.exec(timeAgo) ?? [])[0])
        trimmed = (trimmed == 0 && timeAgo.includes('a')) ? 1 : trimmed
        if (timeAgo.includes('mins') || timeAgo.includes('minutes') || timeAgo.includes('minute')) {
            time = new Date(Date.now() - trimmed * 60000)
        } else if (timeAgo.includes('hours') || timeAgo.includes('hour')) {
            time = new Date(Date.now() - trimmed * 3600000)
        } else if (timeAgo.includes('days') || timeAgo.includes('day')) {
            time = new Date(Date.now() - trimmed * 86400000)
        } else if (timeAgo.includes('year') || timeAgo.includes('years')) {
            time = new Date(Date.now() - trimmed * 31556952000)
        } else {
            time = new Date(timeAgo)
        }

        return time
    }

    parser = new Parser()

    async getMangaDetails(mangaId: string): Promise<Manga> {
        const request = createRequestObject({
            url: `${this.baseUrl}/${this.sourceTraversalPathName}/${mangaId}`,
            method: 'GET'
        })

        let data = await this.requestManager.schedule(request, 1)
        let $ = this.cheerio.load(data.data)

        return this.parser.parseMangaDetails($, mangaId)
    }


    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = createRequestObject({
            url: `${this.baseUrl}/wp-admin/admin-ajax.php/`,
            method: 'POST',
            headers: {
                "content-type": "application/x-www-form-urlencoded",
                "referer": this.baseUrl
            },
            data: this.urlEncodeObject({
                "action": "manga_get_chapters",
                "manga": mangaId
            })
        })

        let data = await this.requestManager.schedule(request, 1)
        let $ = this.cheerio.load(data.data)

        return this.parser.parseChapterList($, mangaId, this)
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = createRequestObject({
            url: `${this.baseUrl}/${this.sourceTraversalPathName}/${mangaId}/${chapterId}/`,
            method: 'GET',
            cookies: [createCookie({name: 'wpmanga-adault', value: "1", domain: this.baseUrl})]
        })

        let data = await this.requestManager.schedule(request, 1)
        let $ = this.cheerio.load(data.data)

        return this.parser.parseChapterDetails($, mangaId, chapterId)

    }


    async searchRequest(query: SearchRequest, metadata: any): Promise<PagedResults> {
        // If we're supplied a page that we should be on, set our internal reference to that page. Otherwise, we start from page 0.
        let page = metadata?.page ?? 0

        const request = createRequestObject({
            url: `${this.baseUrl}/wp-admin/admin-ajax.php/`,
            method: 'POST',
            headers: {
                "content-type": "application/x-www-form-urlencoded",
                "referer": this.baseUrl
            },
            data: this.urlEncodeObject({
                "action": "madara_load_more",
                "page": page,
                "template": "madara-core/content/content-search",
                "vars[s]": query.title,
                "vars[paged]": "1",
                "vars[posts_per_page]": "50"
            })
        })
        let data = await this.requestManager.schedule(request, 1)
        let $ = this.cheerio.load(data.data)
        let manga = this.parser.parseSearchResults($, this)
        let mData = undefined
        if (manga.length > 49) {
            mData = {page: (page + 1)}
        }
        return createPagedResults({
            results: manga,
            metadata: typeof mData?.page === 'undefined' ? undefined : mData
        })
    }


    /**
     * It's hard to capture a default logic for homepages. So for madara sources,
     * instead we've provided a homesection reader for the base_url/source_traversal_path/ endpoint.
     * This supports having paged views in almost all cases.
     * @param sectionCallback
     */
    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        let section: HomeSection = createHomeSection({id: "latest", title: "Latest Titles"})
        sectionCallback(section)

        const request = createRequestObject({
            url: `${this.baseUrl}/${this.homePage}/?m_orderby=latest`,
            method: 'GET',
            cookies: [createCookie({name: 'wpmanga-adault', value: "1", domain: this.baseUrl})]
        })

        let data = await this.requestManager.schedule(request, 1)
        let $ = this.cheerio.load(data.data)
        let items: MangaTile[] = this.parser.parseHomeSection($, this)

        section.items = items
        sectionCallback(section)
    }

    async filterUpdatedManga(mangaUpdatesFoundCallback: (updates: MangaUpdates) => void, time: Date, ids: string[]): Promise<void> {
        // If we're supplied a page that we should be on, set our internal reference to that page. Otherwise, we start from page 0.
        let page: number = 0
        let loadNextPage = true
        while (loadNextPage) {
            const request = createRequestObject({
                url: `${this.baseUrl}/wp-admin/admin-ajax.php/`,
                method: 'POST',
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    "referer": this.baseUrl
                },
                data: this.urlEncodeObject({
                    "action": "madara_load_more",
                    "page": page,
                    "template": "madara-core/content/content-archive",
                    "vars[orderby]": "meta_value_num",
                    "vars[sidebar]": "right",
                    "vars[post_type]": "wp-manga",
                    "vars[meta_key]": "_latest_update",
                    "vars[paged]": "1",
                    "vars[posts_per_page]": "50",
                    "vars[order]": "desc"
                })
            })

            let data = await this.requestManager.schedule(request, 1)
            let $ = this.cheerio.load(data.data)

            let updatedManga = this.parser.filterUpdatedManga($, time, ids, this)
            loadNextPage = updatedManga.loadNextPage
            if (loadNextPage) {
                page++
            }
            if (updatedManga.updates.length > 0) {
                mangaUpdatesFoundCallback(createMangaUpdates({
                    ids: updatedManga.updates
                }))
            }
        }
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults | null> {
        // We only have one homepage section ID, so we don't need to worry about handling that any
        let page = metadata.page ?? 0   // Default to page 0

        const request = createRequestObject({
            url: `${this.baseUrl}/${this.homePage}/page/${page}/?m_orderby=latest`,
            method: 'GET',
            cookies: [createCookie({name: 'wpmanga-adault', value: "1", domain: this.baseUrl})]
        })

        let data = await this.requestManager.schedule(request, 1)
        let $ = this.cheerio.load(data.data)
        let items: MangaTile[] = this.parser.parseHomeSection($, this)

        // Set up to go to the next page. If we are on the last page, remove the logic.
        metadata.page = page + 1
        if (!$('a.last')) {
            metadata = undefined
        }

        return createPagedResults({
            results: items,
            metadata: metadata
        })
    }

    // Only used in the test wrapper
    async getNumericId(mangaId: string): Promise<string> {
        const request = createRequestObject({
            url: `${this.baseUrl}/${this.sourceTraversalPathName}/${mangaId}/`,
            method: 'GET'
        })

        let data = await this.requestManager.schedule(request, 1)
        let $ = this.cheerio.load(data.data)
        let numericId = $('link[rel="shortlink"]').attr('href')?.replace(`${this.baseUrl}/?p=`, '')
        if (!numericId) {
            throw(`Failed to parse the numeric ID for ${mangaId}`)
        }

        return numericId
    }

    decodeHTMLEntity(str: string): string {
        return str.replace(/&#(\d+);/g, function (match, dec) {
            return String.fromCharCode(dec);
        })
    }

    cloudflareBypassRequest() {
        return createRequestObject({
            url: `${this.baseUrl}`,
            method: 'GET',
        })
    }


}