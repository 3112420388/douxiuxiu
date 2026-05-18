/* v3 semantic split: script from js/app/11-bootstrap.js | keep script order */
        // --- 启动 ---
        const app = new App();
        app.init();
        //获取版本号
        document.addEventListener('DOMContentLoaded', () => {
            const versionEl = document.getElementById('sys-version-text');
            if (versionEl && window.DxxSystem) {
                // 获取版本号并显示，例如 "v5.2"
                versionEl.innerText = 'v' + DxxSystem.getVersion();
            }
        });
