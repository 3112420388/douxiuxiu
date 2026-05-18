/* v3 semantic split: class from js/app/07-log-backup-clean-menu.js | keep script order */
        class MenuManager {
            constructor() {
                // 默认自动连播状态
                this.isAutoPlay = false;
                this.sheet = document.getElementById('work-settings-sheet');
            }

            open() {
                if (!this.sheet) return;

                const activeIndex = app.mainSwiper.activeIndex;
                const slide = app.mainSwiper.slides[activeIndex];
                const data = app.fullPlaylist[activeIndex];

                if (!slide || !data) return;

                // --- 1. 停止图集自动轮播 (新增逻辑) ---
                const gallerySwiper = slide.querySelector('.gallery-swiper');
                if (gallerySwiper && gallerySwiper.swiper && gallerySwiper.swiper.autoplay.running) {
                    gallerySwiper.swiper.autoplay.stop();
                    // 标记一下，以便关闭菜单时可以决定是否恢复（可选，目前需求只说停止）
                }

                this.initUI(slide, data);
                app.pageManager.pushState('work-settings');
                this.sheet.classList.add('active');
            }

            close() {
                history.back();
            }

            initUI(slide, data) {
                const isVideo = data.type === '视频';

                // 1. 基础 UI 显隐控制
                const speedSection = document.getElementById('ws-speed-section');
                const landscapeBtn = document.getElementById('btn-ws-landscape');
                const autoBtn = document.getElementById('btn-autoplay-toggle');
                const muteBtn = document.getElementById('btn-mute-toggle');

                // 更新收藏按钮状态
                const favBtn = document.getElementById('btn-favorite-toggle');
                if (favBtn) {
                    const isFav = app.userDataManager.isFavorite(data);
                    this.updateFavoriteBtnState(favBtn, isFav);
                }

                // 视频特有控件
                if (isVideo) {
                    if (speedSection) speedSection.style.display = 'block';

                    // 【核心修复】：获取视频当前的实际倍速，并更新 UI
                    const video = slide.querySelector('video');
                    const currentRate = video ? video.playbackRate : (CONFIG.DEFAULT_SPEED || 1.0);
                    this.updateSpeedUI(currentRate);

                    // 横屏按钮逻辑
                    if (landscapeBtn) {
                        let w = data.width; let h = data.height;
                        if (video) {
                            const vw = video.videoWidth;
                            const vh = video.videoHeight;
                            if (data.is_random_api || !w || !h) {
                                if (vw && vh) {
                                    w = vw;
                                    h = vh;
                                    data.width = vw;
                                    data.height = vh;
                                }
                            }
                        }
                        const ratio = (w && h) ? (w / h) : 0;
                        landscapeBtn.style.display = ratio >= 1.5 ? 'flex' : 'none';
                        if ((data.is_random_api || !w || !h) && video) {
                            const refreshLandscapeBtn = () => {
                                const vw = video.videoWidth || 0;
                                const vh = video.videoHeight || 0;
                                if (vw && vh) {
                                    data.width = vw;
                                    data.height = vh;
                                }
                                const nextRatio = (vw && vh) ? (vw / vh) : 0;
                                landscapeBtn.style.display = nextRatio >= 1.5 ? 'flex' : 'none';
                            };
                            video.addEventListener('loadedmetadata', refreshLandscapeBtn, { once: true });
                            video.addEventListener('loadeddata', refreshLandscapeBtn, { once: true });
                        }
                    }
                } else {
                    // 图集隐藏倍速和横屏按钮
                    if (speedSection) speedSection.style.display = 'none';
                    if (landscapeBtn) landscapeBtn.style.display = 'none';
                }

                // 按钮状态同步
                if (autoBtn) {
                    autoBtn.classList.toggle('active', CONFIG.AUTO_NEXT_VIDEO);
                }

                if (muteBtn) {
                    this.updateMuteBtnState(muteBtn, app.mediaManager.isGlobalMuted);
                }
                this._updateClearModeBtn();

                // 执行媒体信息分析
                this._analyzeMedia(slide, data);
            }
            /**
       * 分析媒体信息 (视频/图片) 并展示
       * 修改点：图集模式下隐藏图标，点击色块复制色值
       */
            async _analyzeMedia(slide, data) {
                // UI 元素
                const iconBox = document.getElementById('ws-info-icon-box');
                const icon = document.getElementById('ws-info-icon');
                const mainText = document.getElementById('ws-info-main');
                const subText = document.getElementById('ws-info-sub');
                const detailText = document.getElementById('ws-info-detail');

                // 重置状态
                mainText.innerText = '分析中...';
                subText.innerText = '--';
                detailText.innerText = '计算文件大小...';

                // 重置图标盒子样式
                iconBox.style.background = 'rgba(255,255,255,0.1)';
                iconBox.style.cursor = 'default';
                iconBox.onclick = null; // 清除旧事件
                iconBox.removeAttribute('title');

                // 重置图标显示状态 (默认显示白色图标)
                icon.style.display = 'block';
                icon.style.color = '#fff';

                // === 场景 A: 视频 ===
                if (data.type === '视频') {
                    const video = slide.querySelector('video');
                    icon.className = 'fa-solid fa-film';

                    if (video) {
                        // 1. 分辨率
                        const w = video.videoWidth || data.width || 0;
                        const h = video.videoHeight || data.height || 0;
                        if (w && h && (data.is_random_api || !data.width || !data.height)) {
                            data.width = w;
                            data.height = h;
                        }
                        // 2. 时长
                        const duration = video.duration || 0;
                        const timeStr = app.mediaManager.formatTime(duration);
                        // 3. 比例
                        const ratio = w && h ? (w / h).toFixed(2) : '-';

                        mainText.innerText = w && h ? `${w} × ${h} (${ratio})` : '分辨率未知';
                        subText.innerText = `视频时长: ${timeStr}`;

                        const landscapeBtn = document.getElementById('btn-ws-landscape');
                        if (landscapeBtn) {
                            const ratioVal = w && h ? (w / h) : 0;
                            landscapeBtn.style.display = ratioVal >= 1.5 ? 'flex' : 'none';
                        }

                        // 4. 获取大小 (异步)
                        const url = video.currentSrc || video.src || data.url;
                        if (url) {
                            const sizeStr = await app.mediaAnalyzer.getFileSize(url);
                            detailText.innerText = `文件大小: ${sizeStr}`;
                        } else {
                            detailText.innerText = '文件地址无效';
                        }
                    }
                }
                // === 场景 B: 图集 ===
                else {
                    // 【核心修改】隐藏图标，只显示纯色背景
                    icon.style.display = 'none';

                    // 获取图集信息
                    const gallerySwiper = slide.querySelector('.gallery-swiper');
                    const totalImages = data.images ? data.images.length : 0;
                    let currentIdx = 1;
                    let currentImg = null;

                    if (gallerySwiper && gallerySwiper.swiper) {
                        currentIdx = gallerySwiper.swiper.realIndex + 1;
                        const activeSlide = gallerySwiper.swiper.slides[gallerySwiper.swiper.activeIndex];
                        if (activeSlide) currentImg = activeSlide.querySelector('img');
                    }

                    // 1. 显示数量
                    mainText.innerText = `图集: 第 ${currentIdx} / ${totalImages} 张`;

                    // 2. 分析当前图片
                    if (currentImg) {
                        const w = currentImg.naturalWidth || 0;
                        const h = currentImg.naturalHeight || 0;

                        subText.innerText = w && h ? `当前分辨率: ${w} × ${h}` : '加载中...';

                        // 提取色调
                        try {
                            const color = app.mediaAnalyzer.extractColor(currentImg);

                            // 设置背景色
                            iconBox.style.background = color.rgb;

                            // 【核心修改】添加点击复制色值功能
                            iconBox.style.cursor = 'pointer';
                            iconBox.title = '点击复制主题色';

                            // 添加点击波纹反馈效果（简单的透明度变化）
                            iconBox.onclick = () => {
                                // 视觉反馈
                                iconBox.style.opacity = '0.7';
                                setTimeout(() => iconBox.style.opacity = '1', 150);

                                // 执行复制
                                if (navigator.clipboard) {
                                    navigator.clipboard.writeText(color.hex).then(() => {
                                        app.interaction.showToast(`已复制色值: <span style="font-family:monospace; font-weight:bold;">${color.hex}</span>`);
                                    }).catch(() => {
                                        app.interaction.showToast(`色值: ${color.hex}`);
                                    });
                                } else {
                                    // 兼容性兜底
                                    const input = document.createElement('textarea');
                                    input.value = color.hex;
                                    document.body.appendChild(input);
                                    input.select();
                                    document.execCommand('copy');
                                    document.body.removeChild(input);
                                    app.interaction.showToast(`已复制色值: ${color.hex}`);
                                }
                            };

                        } catch (e) {
                            console.log('Color extract failed', e);
                            iconBox.style.background = '#555';
                        }

                        // 3. 获取大小 (异步)
                        const url = currentImg.currentSrc || currentImg.src;
                        if (url) {
                            const sizeStr = await app.mediaAnalyzer.getFileSize(url);
                            detailText.innerText = `当前图片大小: ${sizeStr}`;
                        }
                    } else {
                        subText.innerText = '图片未加载';
                        detailText.innerText = '-';
                    }
                }
            }

            toggleFavorite(btn) {
                // 打开收藏夹选择面板
                app.favManager.openAddToSheet();

                // 关闭长按菜单（为了体验更好，可以选择不关闭，或者延迟关闭）
                this.close();
            }

            // 增加一个无参的更新状态方法，供 FavManager 调用
            updateFavoriteBtnState(btn = null) {
                if (!btn) btn = document.getElementById('btn-favorite-toggle');
                if (!btn) return;

                const idx = app.mainSwiper.activeIndex;
                const work = app.fullPlaylist[idx];
                const isFav = app.userDataManager.isFavorite(work);

                const icon = btn.querySelector('i');
                const text = btn.querySelector('span');

                if (isFav) {
                    btn.classList.add('active');
                    icon.style.color = '#face15';
                    text.innerText = '已收藏';
                } else {
                    btn.classList.remove('active');
                    icon.style.color = '#fff';
                    text.innerText = '收藏';
                }
            }


            // 【新增】调用系统分享或自定义分享
            triggerShareMenu() {
                this.close(); // 先关闭菜单

                const currentWork = app.fullPlaylist[app.mainSwiper.activeIndex];
                const title = currentWork.title || '精彩作品';
                const text = `我在抖咻咻发现了一个很棒的作品：@${currentWork.author}`;
                // 构造带定位的链接
                const baseUrl = window.location.href.split('?')[0];
                const shareUrl = `${baseUrl}?share_type=work&author=${encodeURIComponent(currentWork.author)}&work_index=${app.mainSwiper.activeIndex}`;

                // 1. 优先尝试调用浏览器原生分享 (支持微信/QQ/系统面板)
                if (navigator.share) {
                    navigator.share({
                        title: title,
                        text: text,
                        url: shareUrl
                    }).catch((err) => {
                        console.log('分享取消或不支持', err);
                        // 如果取消了，不做处理；如果不支持，走降级
                    });
                } else {
                    // 2. 降级处理：模拟一个简单的选择弹窗
                    const choice = prompt(`【分享到】\n1. 复制链接 (发给微信/QQ好友)\n2. 分享到聊天室\n3. 分享到圈子\n\n请输入数字:`, "1");

                    if (choice === '1') {
                        app.interaction.copyText({ innerText: shareUrl });
                        app.interaction.showToast('链接已复制，请去微信/QQ粘贴');
                    } else if (choice === '2') {
                        // 简单的内部跳转模拟
                        app.pageManager.openComments();
                        setTimeout(() => {
                            const input = document.getElementById('chat-input');
                            if (input) {
                                input.value = `分享作品：${shareUrl}`;
                                input.focus();
                            }
                        }, 500);
                    } else if (choice === '3') {
                        app.pageManager.openPage('圈子');
                    }
                }
            }
            /**
            * 切换静音 (更新全局状态)
            */
            toggleMute(btn) {
                // 1. 切换全局运行时状态
                app.mediaManager.isGlobalMuted = !app.mediaManager.isGlobalMuted;
                const isMuted = app.mediaManager.isGlobalMuted;

                // 2. 立即应用到当前正在播放的媒体
                const slide = app.mainSwiper.slides[app.mainSwiper.activeIndex];
                const video = slide.querySelector('video');
                const audio = slide.querySelector('.bgm-audio');

                if (video) video.muted = isMuted;
                if (audio) audio.muted = isMuted;

                // 3. 更新 UI
                this.updateMuteBtnState(btn, isMuted);

                if (isMuted) {
                    app.interaction.showToast('已开启静音');
                } else {
                    app.interaction.showToast('已取消静音');
                }

                // 操作后保持菜单打开或关闭，看你喜好，原逻辑是关闭
                //this.close();
            }

            // [新增] 更新静音按钮 UI
            updateMuteBtnState(btn, isMuted) {
                const icon = btn.querySelector('i');
                const text = btn.querySelector('span');

                if (isMuted) {
                    btn.classList.add('active'); // 激活状态（绿点）
                    icon.className = 'fa-solid fa-volume-xmark';
                    text.innerText = "取消静音";
                } else {
                    btn.classList.remove('active');
                    icon.className = 'fa-solid fa-volume-high';
                    text.innerText = "静音播放";
                }
            }
            // 分析媒体信息 (尺寸 + 色调 + 大小)
            async _analyzeImageForUI(slide) {
                const mainText = document.getElementById('ws-info-main');
                const subText = document.getElementById('ws-info-sub');
                const colorCircle = document.getElementById('ws-color-circle');

                if (!mainText) return;

                // 1. 确定目标媒体 (Video 或 Img)
                const video = slide.querySelector('video');
                let targetMedia = video;

                if (!targetMedia) {
                    const gallerySwiper = slide.querySelector('.gallery-swiper');
                    if (gallerySwiper && gallerySwiper.swiper) {
                        const activeIdx = gallerySwiper.swiper.activeIndex;
                        const activeSlide = gallerySwiper.swiper.slides[activeIdx];
                        if (activeSlide) targetMedia = activeSlide.querySelector('img');
                    }
                }

                if (targetMedia) {
                    // --- A. 获取尺寸 (同步) ---
                    const w = targetMedia.videoWidth || targetMedia.naturalWidth || 0;
                    const h = targetMedia.videoHeight || targetMedia.naturalHeight || 0;
                    const dimText = w && h ? `${w} × ${h}` : "获取中...";

                    // --- B. 获取色调 (同步) ---
                    const colorInfo = app.mediaAnalyzer.extractColor(targetMedia);
                    colorCircle.style.background = colorInfo.rgb;

                    // --- C. 初始 UI 更新 ---
                    // Main 显示尺寸 (因为这最重要)
                    mainText.innerText = dimText;
                    // Sub 先显示 HEX 颜色
                    subText.innerText = `${colorInfo.hex} · 计算大小...`;

                    // --- D. 获取文件大小 (异步) ---
                    // 获取当前实际的 URL (currentSrc 对视频很重要，src 对图片很重要)
                    const url = targetMedia.currentSrc || targetMedia.src || targetMedia.dataset.src;

                    if (url) {
                        const sizeStr = await app.mediaAnalyzer.getFileSize(url);
                        // 更新 Sub Text：增加文件大小
                        subText.innerText = `${colorInfo.hex} · ${sizeStr}`;
                    } else {
                        subText.innerText = `${colorInfo.hex} · 未知`;
                    }

                } else {
                    mainText.innerText = "无法分析";
                    subText.innerText = "-";
                    colorCircle.style.background = '#333';
                }
            }

            // 清屏按钮状态辅助方法
            _updateClearModeBtn() {
                const clearBtn = document.getElementById('btn-clearmode-toggle');
                const isImmersive = document.body.classList.contains('immersive-mode');
                if (clearBtn) {
                    const span = clearBtn.querySelector('span');
                    if (isImmersive) {
                        clearBtn.classList.add('active');
                        if (span) span.innerText = "退出清屏";
                    } else {
                        clearBtn.classList.remove('active');
                        if (span) span.innerText = "清屏模式";
                    }
                }
            }

            // 原有的 analyzeImage 方法 (保持不变)
            analyzeImage(img) {
                const mainText = document.getElementById('ws-info-main');
                const subText = document.getElementById('ws-info-sub');
                const colorCircle = document.getElementById('ws-color-circle');
                if (!mainText) return;

                if (!img || !img.complete) {
                    mainText.innerText = "分析中...";
                    subText.innerText = "-";
                    return;
                }
                subText.innerText = `${img.naturalWidth} x ${img.naturalHeight} px`;
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = 1; canvas.height = 1;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, 1, 1);
                    const p = ctx.getImageData(0, 0, 1, 1).data;
                    colorCircle.style.background = `rgb(${p[0]}, ${p[1]}, ${p[2]})`;
                    mainText.innerText = `主色调: ${this.rgbToHex(p[0], p[1], p[2])}`;
                } catch (e) {
                    colorCircle.style.background = '#333';
                    mainText.innerText = "色调获取受限";
                }
            }
            rgbToHex(r, g, b) { return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase(); }

            // ================= 功能操作方法 =================

            /**
             * 1. 设置倍速 
             */
            // --- MenuManager 类中 ---

            /**
             * 设置播放速度
             */
            setSpeed(rate) {
                const slide = app.mainSwiper.slides[app.mainSwiper.activeIndex];
                const video = slide.querySelector('video');

                // 设置视频倍速
                if (video) {
                    video.playbackRate = rate;
                    app.interaction.showToast(`播放速度: ${rate}x`);
                }

                // 更新 UI 高亮
                this.updateSpeedUI(rate);

                // 关闭菜单
                // this.close();
            }

            /**
             * 更新倍速按钮高亮状态 (修复版)
             */
            updateSpeedUI(rate) {
                // 1. 【核心修复】限定选择器范围
                // 只查找 ID 为 ws-speed-section 下的 .glass-pill，避免误伤其他页面的胶囊按钮
                const pills = document.querySelectorAll('#ws-speed-section .glass-pill');

                pills.forEach(el => {
                    el.classList.remove('active');

                    // 2. 解析按钮文本 (例如 "1.0x" -> 1.0)
                    const textVal = parseFloat(el.innerText);

                    // 3. 比较数值 (使用 Math.abs 处理浮点数微小差异，虽然 1.0 通常是精确的)
                    // 确保 rate (如 1) 和 textVal (如 1) 能匹配上
                    if (!isNaN(textVal) && Math.abs(textVal - rate) < 0.01) {
                        el.classList.add('active');
                    }
                });
            }

            /**
             * 2. 切换自动连播 (修改版：直接操作 SettingsManager)
             */
            toggleAutoPlay(btn) {
                // 1. 获取新状态
                const newState = !CONFIG.AUTO_NEXT_VIDEO;

                // 2. 调用设置管理器更新 (会自动保存到本地存储)
                app.settingsManager.update('AUTO_NEXT_VIDEO', newState);
                this.isAutoPlay = newState;

                // 3. 更新当前按钮 UI
                if (newState) {
                    btn.classList.add('active');
                    app.interaction.showToast('自动连播: 开启');
                } else {
                    btn.classList.remove('active');
                    app.interaction.showToast('自动连播: 关闭');
                }
            }

            /**
             * 3. 重新加载 (修复：真正的重新加载数据渲染)
             */
            reloadCurrent() {
                this.close(); // 关闭菜单

                const index = app.mainSwiper.activeIndex;
                const slide = app.mainSwiper.slides[index];
                const data = app.fullPlaylist[index];

                if (!slide || !data) return;

                // 1. UI 提示
                app.interaction.showToast('正在重新加载...');

                // 2. 停止当前媒体
                app.mediaManager.stop();

                // 3. 重新生成 HTML
                // 这会将 video/img 重置回初始状态 (只有 data-src，没有 src)
                const newHtml = app.renderer.createSlideHtml(data, index);
                slide.innerHTML = newHtml;

                // 4. 重新初始化组件
                if (data.type !== '视频') {
                    // 如果是图集，必须重新初始化 Swiper 实例
                    app.initGallery();
                }

                // 5. 核心修复：强制资源加载
                // 这一步会将 data-src 赋值给 src，并触发浏览器的下载
                app.coordinator.processSlide(slide, 'active');

                // 6. 稍微延迟后尝试自动播放
                // 等待 DOM 更新和 ResourceCoordinator 处理完毕
                setTimeout(() => {
                    // 尝试调整布局 (封面图等)
                    const media = slide.querySelector('.lazy-media');
                    if (media) app.adjustLayout(media);

                    // 播放
                    app.mediaManager.play(slide);
                }, 150);
            }
            /** 4. 分享当前作品（修复：生成包含作者和索引的链接） */
            shareCurrentWork() {
                const currentWork = app.fullPlaylist[app.mainSwiper.activeIndex];
                const authorName = currentWork.author;
                const workId = currentWork.id;

                // 获取资源的源头信息 (用于判断是否是本地)
                // 这里的逻辑假设 dataLoader.globalCreators 能通过 authorName 找到资源包
                // 如果找不到，或者 origin_type 是 local，则视为本地资源
                const creatorData = app.dataLoader.globalCreators[authorName];
                const isLocal = !creatorData || creatorData.info.origin_type === 'local' || !creatorData.info.source_url;

                const baseUrl = window.location.href.split('?')[0];
                let shareUrl = "";
                let shareTip = "";

                // === 分支 1：如果是网络导入的资源，且保留了 share_url，优先分享源链接 ===
                if (currentWork.share_url && currentWork.share_url.startsWith('http')) {
                    // 直接分享原始链接，让接收方自己去解析
                    shareUrl = currentWork.share_url;
                    shareTip = "已复制原始分享链接";
                }
                // === 分支 2：如果是纯本地数据，或者是解析后的直链数据 ===
                else if (isLocal) {
                    // 提取最小化核心数据 (防止 URL 过长)
                    const miniData = {
                        t: currentWork.title,       // title
                        a: currentWork.author,      // author
                        u: currentWork.url,         // url (视频/音频直链)
                        c: currentWork.cover,       // cover
                        tp: currentWork.type,       // type
                        i: currentWork.images       // images (如果是图集)
                    };

                    try {
                        // 序列化 -> Base64 编码 -> URL 编码
                        const jsonStr = JSON.stringify(miniData);
                        // 处理中文编码问题
                        const base64Data = btoa(unescape(encodeURIComponent(jsonStr)));

                        shareUrl = `${baseUrl}?share_type=payload&data=${base64Data}`;
                        shareTip = "已生成数据便携链接";
                    } catch (e) {
                        console.error("生成长链接失败", e);
                        app.interaction.showToast("数据过长，无法生成分享链接");
                        return;
                    }
                }
                // === 分支 3：普通的 ID 定位分享 (原有逻辑) ===
                else {
                    shareUrl = `${baseUrl}?share_type=work&author=${encodeURIComponent(authorName)}`;
                    if (workId) shareUrl += `&work_id=${encodeURIComponent(workId)}`;
                    shareUrl += `&work_index=${app.mainSwiper.activeIndex}`;
                    shareTip = "作品链接已复制";
                }

                const text = `我在抖咻咻发现了一个很棒的作品：\n${currentWork.title || '分享作品'} \n@${authorName}\n\n查看链接：\n${shareUrl}`;

                // 执行复制
                const doCopy = (content) => {
                    const input = document.createElement('textarea');
                    input.value = content;
                    document.body.appendChild(input);
                    input.select();
                    document.execCommand('copy');
                    document.body.removeChild(input);
                    app.interaction.showToast(shareTip);
                };

                if (navigator.clipboard) {
                    navigator.clipboard.writeText(text).then(() => app.interaction.showToast(shareTip)).catch(() => doCopy(text));
                } else {
                    doCopy(text);
                }
            }

            triggerLandscape() {
                this.close(); // 先关闭菜单
                setTimeout(() => {
                    // 【关键修改】调用新方法
                    if (app.landscapePlayer) {
                        app.landscapePlayer.toggle();
                    }
                }, 300);
            }

            toggleClearMode(btn) {
                // 1. 获取当前状态
                const isCurrentlyImmersive = document.body.classList.contains('immersive-mode');

                // 2. 计算目标状态 (取反)
                const targetState = !isCurrentlyImmersive;

                // 3. 调用统一管理方法 (处理 body class、Swiper 锁定、Toast 提示)
                app.interaction.setImmersiveMode(targetState);

                // 4. 【核心修改】立即更新按钮文字和高亮状态
                const span = btn.querySelector('span');

                if (targetState) {
                    // 进入清屏模式
                    btn.classList.add('active');
                    if (span) span.innerText = "退出清屏";
                } else {
                    // 退出清屏模式
                    btn.classList.remove('active');
                    if (span) span.innerText = "清屏模式";
                }

                // 5. 操作完成后自动关闭菜单，提升体验
                this.close();
            }

            // 3. 保存本地 (修复版：通用支持多视频/多图片/单视频)
            downloadCurrent() {
                const idx = app.mainSwiper.activeIndex;
                const data = app.fullPlaylist[idx];
                const slide = app.mainSwiper.slides[idx];

                // 1. 准备资源数据 (按顺序生成 currentAssets)
                app.downloadMgr.prepareAssets(data);

                let targetIndices = [];
                let msg = '';

                // 2. 检查是否存在轮播组件 (Swiper)
                // 无论 type 是 '视频' 还是 '图集'，只要 UI 上是轮播的，就按轮播索引取
                const galleryEl = slide.querySelector('.gallery-swiper');

                if (galleryEl && galleryEl.swiper) {
                    // --- 多资源模式 (图集 或 视频合集) ---
                    const currentIndex = galleryEl.swiper.realIndex;
                    targetIndices = [currentIndex];

                    // 尝试判断资源类型以优化提示语
                    const asset = app.downloadMgr.currentAssets[currentIndex];
                    const typeName = (asset && asset.type === 'video') ? '视频' : '图片';
                    msg = `正在保存第 ${currentIndex + 1} 个${typeName}...`;
                } else {
                    // --- 单资源模式 (单视频 或 单图) ---
                    // 默认为第 0 个资源
                    targetIndices = [0];
                    msg = '正在保存当前作品...';
                }

                // 3. 执行下载
                if (targetIndices.length > 0 && app.downloadMgr.currentAssets.length > 0) {
                    // 边界检查：防止索引越界 (例如数据只有1个，但Swiper错乱指向了2)
                    if (targetIndices[0] >= app.downloadMgr.currentAssets.length) {
                        targetIndices = [0]; // 回退到第一个
                    }

                    app.interaction.showToast(msg);
                    setTimeout(() => {
                        app.downloadMgr.downloadDirect(targetIndices);
                        this.close();
                    }, 300);
                } else {
                    app.interaction.showToast('未找到可下载资源');
                }
            }

            triggerDislike() {

                app.interaction.showToast('将减少此类作品推荐');
                setTimeout(() => app.mainSwiper.slideNext(), 500);
            }

            triggerReport() {

                setTimeout(() => {
                    if (confirm("确定要举报该作品吗？")) {
                        app.interaction.showToast('举报已提交');
                    }
                }, 300);
            }
        }
