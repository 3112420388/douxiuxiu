/* v3 semantic split: class from js/app/07-log-backup-clean-menu.js | keep script order */
        class LogManager {
            constructor() {
                this.logs = [];
                this.maxLogs = 200; // 最大保留条数
                this.container = document.getElementById('log-list-container');

                // 初始化时捕获全局错误
                this.initGlobalErrorHandling();
                this.log('system', '日志系统初始化完成');
                this.log('system', `UserAgent: ${navigator.userAgent}`);
            }

            // 拦截全局错误和 Promise 拒绝
            initGlobalErrorHandling() {
                window.onerror = (msg, url, line, col, error) => {
                    this.error(`Global: ${msg} (${line}:${col})`);
                    return false;
                };

                window.addEventListener('unhandledrejection', (event) => {
                    this.warn(`Unhandled Promise: ${event.reason}`);
                });

                // 可选：拦截 console.log (慎用，可能会导致无限循环如果这里面也调用了console)
                // const originalLog = console.log;
                // console.log = (...args) => {
                //    originalLog.apply(console, args);
                //    this.info(args.join(' '));
                // };
            }

            addEntry(level, msg) {
                const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: "numeric", minute: "numeric", second: "numeric" }) + "." + new Date().getMilliseconds().toString().padStart(3, '0');

                // 如果是对象，尝试转字符串
                if (typeof msg === 'object') {
                    try { msg = JSON.stringify(msg); } catch (e) { msg = '[Object]'; }
                }

                this.logs.push({ time, level, msg });
                if (this.logs.length > this.maxLogs) this.logs.shift();
            }

            log(level, msg) { this.addEntry(level, msg); }
            info(msg) { this.addEntry('info', msg); }
            warn(msg) { this.addEntry('warn', msg); }
            error(msg) { this.addEntry('error', msg); }

            // 渲染日志到界面
            renderLogs() {
                if (!this.container) this.container = document.getElementById('log-list-container');
                if (!this.container) return;

                if (this.logs.length === 0) {
                    this.container.innerHTML = '<div style="color:#666;text-align:center;padding:20px;">暂无日志</div>';
                    return;
                }

                // 倒序显示（最新的在最上面）或者正序，这里用最新的在最下面
                // 为了方便手机看，最新的在最上面可能更好？通常日志是追加在底部。
                // 这里采用：追加在底部，自动滚动。

                let html = this.logs.map(l => {
                    let colorClass = `log-level-${l.level}`; // default
                    if (l.level === 'system') colorClass = 'log-level-system';

                    return `
                        <div class="log-entry">
                            <div class="log-meta">
                                <div>${l.time}</div>
                                <div class="${colorClass}">[${l.level.toUpperCase()}]</div>
                            </div>
                            <div class="log-content ${colorClass}">${this.escapeHtml(l.msg)}</div>
                        </div>
                    `;
                }).join('');

                this.container.innerHTML = html;
                // 滚动到底部
                this.container.scrollTop = this.container.scrollHeight;
            }

            clearLogs() {
                this.logs = [];
                this.log('system', '日志已手动清空');
                this.renderLogs();
            }

            copyLogs() {
                const text = this.logs.map(l => `[${l.time}] [${l.level.toUpperCase()}] ${l.msg}`).join('\n');
                navigator.clipboard.writeText(text).then(() => {
                    alert('日志已复制到剪贴板');
                }).catch(err => {
                    alert('复制失败，请手动长按选择');
                });
            }

            escapeHtml(str) {
                if (!str) return '';
                return String(str)
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");
            }
        }

        // ==========================================
        //  4. BackupManager (云备份管理 - 完整版)
        // ==========================================
        // --- 独立的数据备份与恢复管理器 (终极融合版) ---
