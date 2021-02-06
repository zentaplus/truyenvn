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
    Source, TagSection,
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

    async getTags(): Promise<TagSection[] | null> {
        const request = createRequestObject({
            url: `${this.baseUrl}/`,
            method: 'GET'
        })

        let data = await this.requestManager.schedule(request, 1)
        let $ = this.cheerio.load(data.data)
        return this.parser.parseTags($)
    }

    async searchRequest(query: SearchRequest, metadata: any): Promise<PagedResults> {
        // If we're supplied a page that we should be on, set our internal reference to that page. Otherwise, we start from page 0.
        let page = metadata?.page ?? 0

        const request = this.constructAjaxRequest(page, 50, '', query.title ?? '')
        let data = await this.requestManager.schedule(request, 1)
        let $ = this.cheerio.load(data.data)
        let manga = this.parser.parseSearchResults($, this)
        let mData: any = {page: (page + 1)}
        if (manga.length < 50) {
            mData = undefined
        }
        return createPagedResults({
            results: manga,
            metadata: typeof mData?.page === 'undefined' ? undefined : mData
        })
    }

    async filterUpdatedManga(mangaUpdatesFoundCallback: (updates: MangaUpdates) => void, time: Date, ids: string[]): Promise<void> {
        // If we're supplied a page that we should be on, set our internal reference to that page. Otherwise, we start from page 0.
        let page: number = 0
        let loadNextPage = true
        while (loadNextPage) {
            const request = this.constructAjaxRequest(page, 50, '_latest_update', '')

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

    /**
     * It's hard to capture a default logic for homepages. So for Madara sources,
     * instead we've provided a homesection reader for the base_url/source_traversal_path/ endpoint.
     * This supports having paged views in almost all cases.
     * @param sectionCallback
     */
    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const sections = [
            {
                request: this.constructAjaxRequest(0, 10, '_latest_update', ''),
                section: createHomeSection({
                    id: '0',
                    title: 'RECENTLY UPDATED',
                    view_more: true,
                }),
            },
            {
                request: this.constructAjaxRequest(0, 10, '_wp_manga_week_views_value', ''),
                section: createHomeSection({
                    id: '1',
                    title: 'CURRENTLY TRENDING',
                    view_more: true,
                })
            },
            {
                request: this.constructAjaxRequest(0, 10, '_wp_manga_views', ''),
                section: createHomeSection({
                    id: '2',
                    title: 'MOST POPULAR',
                    view_more: true,
                })
            },
        ]

        const promises: Promise<void>[] = []

        for (const section of sections) {
            // Let the app load empty sections
            sectionCallback(section.section)

            // Get the section data
            promises.push(
                this.requestManager.schedule(section.request, 1).then(response => {
                    const $ = this.cheerio.load(response.data)
                    section.section.items = this.parser.parseHomeSection($, this)
                    sectionCallback(section.section)
                }),
            )
        }

        // Make sure the function completes
        await Promise.all(promises)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults | null> {
        // We only have one homepage section ID, so we don't need to worry about handling that any
        let page = metadata?.page ?? 0   // Default to page 0
        let sortBy = ''
        switch (homepageSectionId) {
            case '0': {
                sortBy = `_latest_update`
                break
            }
            case '1': {
                sortBy = `_wp_manga_week_views_value`
                break
            }
            case '2': {
                sortBy = `_wp_manga_views`
                break
            }
            default:
                return Promise.resolve(null)
        }
        const request = this.constructAjaxRequest(page, 50, sortBy, '')
        let data = await this.requestManager.schedule(request, 1)
        let $ = this.cheerio.load(data.data)
        let items: MangaTile[] = this.parser.parseHomeSection($, this)
        // Set up to go to the next page. If we are on the last page, remove the logic.
        let mData: any = {page: (page + 1)}
        if (items.length < 50) {
            mData = undefined
        }

        return createPagedResults({
            results: items,
            metadata: mData
        })
    }

    cloudflareBypassRequest() {
        return createRequestObject({
            url: `${this.baseUrl}`,
            method: 'GET',
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

    /**
     * Constructs requests to be sent to the Madara /admin-ajax.php/ endpoint.
     */
    constructAjaxRequest(page: Number, postsPerPage: Number, meta_key: string, searchQuery: string): any {
        let isSearch = searchQuery != ''
        let data: any = {
            "action": "madara_load_more",
            "page": page,
            "vars[paged]": "1",
            "vars[posts_per_page]": postsPerPage,
        }
        if (isSearch) {
            data["vars[s]"] = searchQuery
            data["template"] = "madara-core/content/content-search"
        } else {
            data["template"] = "madara-core/content/content-archive"
            data["vars[orderby]"] = "meta_value_num"
            data["vars[sidebar]"] = "right"
            data["vars[post_type]"] = "wp-manga"
            data["vars[meta_key]"] = meta_key
            data["vars[order]"] = "desc"
        }

        return createRequestObject({
            url: `${this.baseUrl}/wp-admin/admin-ajax.php/`,
            method: 'POST',
            headers: {
                "content-type": "application/x-www-form-urlencoded",
                "referer": this.baseUrl
            },
            data: this.urlEncodeObject(data),
            cookies: [createCookie({name: 'wpmanga-adault', value: "1", domain: this.baseUrl})]
        })
    }

    /**
     * Parses a time string from a Madara source into a Date object.
     */
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

}