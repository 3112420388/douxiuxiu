/* v3 semantic split: class from js/app/04-data-media-landscape.js | keep script order */
        class DataLoader {
            constructor() {
                this.globalCreators = {};
                this.customManager = new CustomCreatorManager();
            }

            async init() {
                // 1. 立即读取 IndexedDB 中的本地资源
                const localCreators = await this.customManager.getAll();
                this.globalCreators = { ...localCreators };

                // 如果本地已经有数据了，先返回去渲染首屏
                if (Object.keys(this.globalCreators).length > 0) {

                    return this.globalCreators;
                }



                if (Object.keys(this.globalCreators).length === 0) {
                    this.globalCreators = this.generateMockData();
                }
                return this.globalCreators;
            }




            // 演示模式下用来填充多个模拟创作者
            generateMockData() {
                const creators = this.getFallbackCreators();
                const authors = ["演示资源A", "演示资源B"];
                const demoWorksTemplate = [
                    {
                        key: "sunrise",
                        title: "晨光剪影",
                        videoUrl: "https://v-cdn.zjol.com.cn/276982.mp4",
                        musicTitle: "晨光序曲",
                        musicAuthor: "云澈",
                        musicUrl: "https://sf5-hl-cdn-tos.douyinstatic.com/obj/ies-music/7145416888485530375.mp3"
                    },
                    {
                        key: "dream",
                        title: "梦境流年",
                        videoUrl: "https://archive.org/download/SampleVideo1280x7205mb/SampleVideo_1280x720_5mb.mp4",
                        musicTitle: "云间梦",
                        musicAuthor: "雁语",
                        musicUrl: "https://sf5-hl-cdn-tos.douyinstatic.com/obj/ies-music/7145416888485530375.mp3"
                    },
                    {
                        key: "shore",
                        title: "海岸日记",
                        videoUrl: "https://archive.org/download/BigBuckBunny_328/BigBuckBunny_512kb.mp4",
                        musicTitle: "海誓",
                        musicAuthor: "蓝音",
                        musicUrl: "https://sf5-hl-cdn-tos.douyinstatic.com/obj/ies-music/7145416888485530375.mp3"
                    },
                    {
                        key: "groove",
                        title: "律动心跳",
                        videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
                        musicTitle: "节奏轻描",
                        musicAuthor: "晨弦",
                        musicUrl: "https://sf5-hl-cdn-tos.douyinstatic.com/obj/ies-music/7145416888485530375.mp3"
                    },
                    {
                        key: "glimmer",
                        title: "星光短章",
                        videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
                        musicTitle: "星光漫游",
                        musicAuthor: "素夜",
                        musicUrl: "https://sf5-hl-cdn-tos.douyinstatic.com/obj/ies-music/7145416888485530375.mp3"
                    }
                ];

                authors.forEach((name, authorIndex) => {
                    const works = demoWorksTemplate.map((tpl, workIndex) => {
                        const like = 1500 + authorIndex * 120 + workIndex * 25;
                        const comment = 120 + authorIndex * 10 + workIndex * 5;
                        return {
                            id: `mock-${name}-${tpl.key}-${workIndex + 1}`,
                            title: `${name} · ${tpl.title}`,
                            author: name,
                            type: "视频",
                            like,
                            comment,
                            width: 720,
                            height: 1280,
                            music_info: {
                                title: tpl.musicTitle,
                                author: tpl.musicAuthor,
                                url: tpl.musicUrl
                            },
                            url: tpl.videoUrl,
                            cover: getDiceBearAvatar(`${name}-${tpl.key}`)
                        };
                    });

                    creators[name] = {
                        info: {
                            name,
                            avatar: getDiceBearAvatar(name)
                        },
                        works
                    };
                });

                return creators;
            }
            getFallbackCreators() {
                const fallback = JSON.parse(JSON.stringify(FALLBACK_CREATOR));
                return { [fallback.info.name]: fallback };
            }

            getAllWorksRandomly() {
                let all = [];
                Object.values(this.globalCreators).forEach(c => all = all.concat(c.works));
                return all.sort(() => Math.random() - 0.5);
            }
        }
