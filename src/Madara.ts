import {
    Chapter,
    ChapterDetails,
    HomeSection,
    LanguageCode,
    Manga,
    MangaStatus,
    MangaTile, MangaUpdates,
    PagedResults,
    SearchRequest,
    Source,
    Tag
} from "paperback-extensions-common"

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

    async getMangaDetails(mangaId: string): Promise<Manga> {
        const request = createRequestObject({
            url: `${this.baseUrl}/${this.sourceTraversalPathName}/${mangaId}`,
            method: 'GET'
        })

        let data = await this.requestManager.schedule(request, 1)
        let $ = this.cheerio.load(data.data)

        let numericId = $('a.wp-manga-action-button').attr('data-post')
        let title = this.decodeHTMLEntity($('div.post-title h1').first().text().replace(/NEW/, '').replace(/HOT/, '').replace('\\n', '').trim())
        let author = this.decodeHTMLEntity($('div.author-content').first().text().replace("\\n", '').trim()).replace('Updating', 'Unknown')
        let artist = this.decodeHTMLEntity($('div.artist-content').first().text().replace("\\n", '').trim()).replace('Updating', 'Unknown')
        let summary = this.decodeHTMLEntity($('p', $('div.description-summary')).text())
        let image = $('div.summary_image img').first().attr('data-src') ?? ''
        let rating = $('span.total_votes').text().replace('Your Rating', '')
        let isOngoing = $('div.summary-content', $('div.post-content_item').last()).text().toLowerCase().trim() == "ongoing"
        let genres: Tag[] = []
        let hentai = $('.manga-title-badges.adult').length > 0

        for (let obj of $('div.genres-content a').toArray()) {
            let genre = $(obj).text()
            if (genre.toLowerCase().includes('smut')) hentai = true
            genres.push(createTag({label: genre, id: genre}))
        }

        // If we cannot parse out the data-id for this title, we cannot complete subsequent requests
        if (!numericId) {
            throw(`Could not parse out the data-id for ${mangaId} - This method might need overridden in the implementing source`)
        }

        return createManga({
            id: numericId,
            titles: [title],
            image: image,
            author: author,
            artist: artist,
            desc: summary,
            status: isOngoing ? MangaStatus.ONGOING : MangaStatus.COMPLETED,
            rating: Number(rating),
            hentai: hentai
        })
    }

    // Time parsing logic

    protected convertTime(timeAgo: string): Date {
        let time: Date
        let trimmed: number = Number((/\d*/.exec(timeAgo) ?? [])[0])
        trimmed = (trimmed == 0 && timeAgo.includes('a')) ? 1 : trimmed
        if (timeAgo.includes('minutes') || timeAgo.includes('minute')) {
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

    encodeObject(obj: { [x: string]: any }): any {
        let ret: any = {}
        for (const entry of Object.entries(obj)) {
            ret[encodeURIComponent(entry[0])] = encodeURIComponent(entry[1])
        }
        return ret
    }

    sortChapters(chapters: Chapter[]): Chapter[] {
        let sortedChapters: Chapter[] = []
        chapters.forEach((c) => {
            if (sortedChapters[sortedChapters.indexOf(c)]?.id !== c?.id) {
                sortedChapters.push(c)
            }
        })
        sortedChapters.sort((a, b) => (a.id > b.id) ? 1 : -1)
        return sortedChapters
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = createRequestObject({
            url: `${this.baseUrl}/wp-admin/admin-ajax.php/`,
            method: 'POST',
            headers: {
                "content-type": "application/x-www-form-urlencoded",
                "referer": this.baseUrl
            },
            data: this.encodeObject({
                "action": "manga_get_chapters",
                "manga": mangaId
            })
        })

        let data = await this.requestManager.schedule(request, 1)
        let $ = this.cheerio.load(data.data)
        let chapters: Chapter[] = []

        // Capture the manga title, as this differs from the ID which this function is fed
        let realTitle = $('a', $('li.wp-manga-chapter  ').first()).attr('href')?.replace(`${this.baseUrl}/${this.sourceTraversalPathName}/`, '').replace(/\/chapter.*/, '')

        if (!realTitle) {
            throw(`Failed to parse the human-readable title for ${mangaId}`)
        }

        // For each available chapter..
        for (let obj of $('li.wp-manga-chapter  ').toArray()) {
            let id = ($('a', $(obj)).first().attr('href') || '').replace(`${this.baseUrl}/${this.sourceTraversalPathName}/${realTitle}/`, '').replace('/', '')
            let chapNum = $('a', $(obj)).first().attr('href')?.match(/\/chapter-(\d*)/)
            if (!chapNum) continue
            let releaseDate = $('i', $(obj)).length > 0 ? $('i', $(obj)).text() : $('.c-new-tag a', $(obj)).attr('title') ?? ''

            if (typeof id === 'undefined') {
                throw(`Could not parse out ID when getting chapters for ${mangaId}`)
            }
            chapters.push(createChapter({
                id: id,
                mangaId: realTitle ?? '',
                langCode: this.languageCode ?? LanguageCode.UNKNOWN,
                chapNum: Number(chapNum[1]) ?? 0,
                time: this.convertTime(releaseDate)
            }))
        }

        return this.sortChapters(chapters)
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = createRequestObject({
            url: `${this.baseUrl}/${this.sourceTraversalPathName}/${mangaId}/${chapterId}/`,
            method: 'GET',
            cookies: [createCookie({name: 'wpmanga-adault', value: "1", domain: this.baseUrl})]
        })

        let data = await this.requestManager.schedule(request, 1)
        let $ = this.cheerio.load(data.data)

        let pages: string[] = []

        for (let obj of $('div.page-break').toArray()) {
            let page = $('img', $(obj)).attr('data-src')

            if (!page) {
                throw(`Could not parse page for ${mangaId}/${chapterId}`)
            }

            pages.push(page.replace(/[\t|\n]/g, ''))
        }
        return createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages,
            longStrip: false
        })

    }


    async searchRequest(query: SearchRequest, metadata: any): Promise<PagedResults> {
        // If we're supplied a page that we should be on, set our internal reference to that page. Otherwise, we start from page 0.
        let page = metadata?.page ?? 0
        let results: MangaTile[] = []

        const request = createRequestObject({
            url: `${this.baseUrl}/wp-admin/admin-ajax.php/`,
            method: 'POST',
            headers: {
                "content-type": "application/x-www-form-urlencoded",
                "referer": this.baseUrl
            },
            data: this.encodeObject({
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
        for (let obj of $(this.searchMangaSelector).toArray()) {
            let id = ($('a', $(obj)).attr('href') ?? '').replace(`${this.baseUrl}/${this.sourceTraversalPathName}/`, '').replace('/', '')
            let title = createIconText({text: this.decodeHTMLEntity($('a', $(obj)).attr('title') ?? '')})
            let image = $('img', $(obj)).attr('data-src')

            if (typeof id === 'undefined' || typeof image === 'undefined' || typeof title.text === 'undefined') {
                // Something went wrong with our parsing, return a detailed error
                throw(`Failed to parse searchResult for ${this.baseUrl} using ${this.searchMangaSelector} as a loop selector`)
            }

            results.push(createMangaTile({
                id: id,
                title: title,
                image: image ?? ''
            }))
        }
        let mData = undefined
        if (results.length > 49) {
            mData = {page: (page + 1)}
        }
        return createPagedResults({
            results: results,
            metadata: typeof mData?.page === 'undefined' ? undefined : mData
        })
    }

    parseHomeSection($: CheerioStatic): MangaTile[] {
        let items: MangaTile[] = []

        for (let obj of $('div.manga').toArray()) {
            let image = $('img', $(obj)).attr('data-src')
            let title = this.decodeHTMLEntity($('a', $('h3.h5', $(obj))).text())
            let id = $('a', $('h3.h5', $(obj))).attr('href')?.replace(`${this.baseUrl}/${this.sourceTraversalPathName}/`, '').replace('/', '')

            if (!id || !title || !image) {
                throw(`Failed to parse homepage sections for ${this.baseUrl}/${this.homePage}/`)
            }

            items.push(createMangaTile({
                id: id,
                title: createIconText({text: title}),
                image: image
            }))
        }
        return items
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

        // Parse all of the available data
        const request = createRequestObject({
            url: `${this.baseUrl}/${this.homePage}/?m_orderby=latest`,
            method: 'GET',
            cookies: [createCookie({name: 'wpmanga-adault', value: "1", domain: this.baseUrl})]
        })

        let data = await this.requestManager.schedule(request, 1)
        let $ = this.cheerio.load(data.data)
        let items: MangaTile[] = this.parseHomeSection($)

        section.items = items
        sectionCallback(section)
    }

    async filterUpdatedManga(mangaUpdatesFoundCallback: (updates: MangaUpdates) => void, time: Date, ids: string[]): Promise<void> {
        // If we're supplied a page that we should be on, set our internal reference to that page. Otherwise, we start from page 0.
        let page = 0
        let passedReferenceTime = false
        while (!passedReferenceTime) {
            const request = createRequestObject({
                url: `${this.baseUrl}/wp-admin/admin-ajax.php/`,
                method: 'POST',
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    "referer": this.baseUrl
                },
                data: this.encodeObject({
                    "action": "madara_load_more",
                    "page": page,
                    "template": "madara-core/content/content-archive",
                    "vars[orderby]": "meta_value_num",
                    "vars[meta_key]":"_latest_update",
                    "vars[paged]": "1",
                    "vars[posts_per_page]": "50"
                })
                // For use with Mocha tests only
                // data: `action=madara_load_more&page=${page}&template=madara-core/content/content-archive&vars[orderby]=meta_value_num&vars[paged]=1&vars[posts_per_page]=50&vars[meta_key]=_latest_update`
            })

            let data = await this.requestManager.schedule(request, 1)
            let $ = this.cheerio.load(data.data)
            let updatedManga: string[] = []

            for (let obj of $('div.manga').toArray()) {
                let id = $('a', $('h3.h5', $(obj))).attr('href')?.replace(`${this.baseUrl}/${this.sourceTraversalPathName}/`, '').replace('/', '') ?? ''
                let mangaTime = this.convertTime($('.c-new-tag', obj).text().trim())
                passedReferenceTime = mangaTime <= time
                if (!passedReferenceTime) {
                    if (ids.includes(id)) {
                        updatedManga.push(id)
                    }
                } else break

                if (typeof id === 'undefined') {
                    throw(`Failed to parse homepage sections for ${this.baseUrl}/${this.homePage}/`)
                }
            }
            if (updatedManga.length > 0) {
                mangaUpdatesFoundCallback(createMangaUpdates({
                    ids: updatedManga
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
        let items: MangaTile[] = []

        for (let obj of $('div.manga').toArray()) {
            let image = $('img', $(obj)).attr('data-src')
            let title = this.decodeHTMLEntity($('a', $('h3.h5', $(obj))).text())
            let id = $('a', $('h3.h5', $(obj))).attr('href')?.replace(`${this.baseUrl}/${this.sourceTraversalPathName}/`, '').replace('/', '')

            if (!id || !title || !image) {
                throw(`Failed to parse homepage sections for ${this.baseUrl}/${this.sourceTraversalPathName}`)
            }

            items.push(createMangaTile({
                id: id,
                title: createIconText({text: title}),
                image: image
            }))
        }

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