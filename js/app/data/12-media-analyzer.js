/* v3 semantic split: class from js/app/04-data-media-landscape.js | keep script order */
        class MediaAnalyzer {
            constructor() {
                // 取色用的画布
                this.canvas = document.createElement('canvas');
                this.ctx = this.canvas.getContext('2d');
                this.width = 50;
                this.height = 50;
                this.canvas.width = this.width;
                this.canvas.height = this.height;
            }

            /**
             * 提取主色调 (同步)
             */
            extractColor(source) {
                const fallback = { hex: '#333333', rgb: 'rgb(51,51,51)' };
                if (!source) return fallback;

                try {
                    this.ctx.clearRect(0, 0, this.width, this.height);
                    // 尝试绘制，如果图片跨域且未开启CORS，这里也不会报错，但在getImageData时会报错
                    this.ctx.drawImage(source, 0, 0, this.width, this.height);

                    const imgData = this.ctx.getImageData(0, 0, this.width, this.height);
                    const data = imgData.data;
                    let r = 0, g = 0, b = 0, count = 0;

                    for (let i = 0; i < data.length; i += 4) {
                        if (data[i + 3] < 128) continue; // 忽略透明
                        r += data[i]; g += data[i + 1]; b += data[i + 2];
                        count++;
                    }

                    if (count === 0) return fallback;

                    r = Math.floor(r / count);
                    g = Math.floor(g / count);
                    b = Math.floor(b / count);

                    return {
                        hex: "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase(),
                        rgb: `rgb(${r}, ${g}, ${b})`
                    };
                } catch (e) {
                    // 捕获跨域污染画布错误
                    return fallback;
                }
            }

            /**
             * 获取文件大小 (异步 - 增强版)
             * 策略：DataURI -> Blob -> Performance API -> Direct HEAD -> Proxy HEAD
             */
            async getFileSize(url) {
                if (!url) return '未知';

                // 1. 本地 Data URI (Base64)
                if (url.startsWith('data:')) {
                    // 计算公式：(字符长度 * 3/4) - padding
                    const size = Math.round((url.length - url.indexOf(',') - 1) * 0.75);
                    return this.formatBytes(size);
                }

                // 2. 本地 Blob URL
                if (url.startsWith('blob:')) {
                    try {
                        // Blob URL 可以直接 fetch 获取大小
                        const res = await fetch(url);
                        const blob = await res.blob();
                        return this.formatBytes(blob.size);
                    } catch (e) {
                        return '本地资源';
                    }
                }

                // 3. Performance API (最快，读取缓存/网络日志)
                // 注意：跨域资源如果服务器未发送 Timing-Allow-Origin，transferSize 可能为 0
                const perf = performance.getEntriesByName(url);
                if (perf.length > 0) {
                    const last = perf[perf.length - 1];
                    // 优先取 encodedBodySize (压缩后大小)，其次 transferSize (网络传输大小)，最后 decodedBodySize
                    const size = last.encodedBodySize || last.transferSize || last.decodedBodySize;
                    if (size > 0) return this.formatBytes(size);
                }

                // 4. 尝试发送 HEAD 请求 (Direct)
                try {
                    const res = await fetch(url, { method: 'HEAD' });
                    const len = res.headers.get('content-length');
                    if (len && parseInt(len) > 0) {
                        return this.formatBytes(parseInt(len));
                    }
                } catch (e) {
                    // 忽略 CORS 错误，继续尝试代理
                }

                // 5. 尝试使用下载代理 (Proxy fallback)
                // 如果直连因为 CORS 失败，走 PHP 代理通常能拿到 header
                if (app && app.downloadMgr && app.downloadMgr.proxy) {
                    try {
                        const proxyUrl = app.downloadMgr.proxy + encodeURIComponent(url);
                        // 注意：有些简单代理不支持 HEAD，如果失败可以尝试极短超时的 GET
                        const res = await fetch(proxyUrl, { method: 'HEAD' });
                        const len = res.headers.get('content-length');
                        if (len && parseInt(len) > 0) {
                            return this.formatBytes(parseInt(len));
                        }
                    } catch (e) {
                        console.warn('Proxy size check failed');
                    }
                }

                return '未知大小';
            }

            // 字节格式化 helper
            formatBytes(bytes, decimals = 2) {
                if (!bytes || bytes === 0) return '0 B';
                const k = 1024;
                const dm = decimals < 0 ? 0 : decimals;
                const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
            }
        }
        // --- 任务9完全修复：点击即全屏+强制旋转 (移除系统方向锁) ---
