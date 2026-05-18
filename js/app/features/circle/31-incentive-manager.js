/* v3 semantic split: class from js/app/08-settings-search-circle-page.js | keep script order */
        class IncentiveManager {
            constructor() {
                this.tasks = [
                    { id: 1, title: "每日签到", reward: 10, done: false },
                    { id: 2, title: "发布一条动态", reward: 20, done: false }
                ];
            }

            openTaskModal() {
                app.pageManager.pushState('task-sheet');
                document.getElementById('task-sheet').classList.add('active');
                this.renderTasks();
            }

            renderTasks() {
                const container = document.getElementById('daily-task-list');
                const balanceEl = document.getElementById('task-coin-balance');

                // 更新余额显示
                if (app.accountManager.user) {
                    if (balanceEl) balanceEl.innerText = app.accountManager.user.coins || 0;
                }

                if (!container) return;

                container.innerHTML = this.tasks.map(t => `
                <div class="my-list-item">
                    <div class="item-info">
                        <div class="item-title">${t.title}</div>
                        <div class="item-sub" style="color:#fbbf24;">+${t.reward} 币</div>
                    </div>
                    <div class="glass-pill ${t.done ? '' : 'active'}" 
                         style="height:28px; font-size:12px;max-width:50px"
                         onclick="app.incentiveManager.doTask(${t.id})">
                         ${t.done ? '已领' : '领取'}
                    </div>
                </div>
            `).join('');
            }

            doTask(id) {
                const task = this.tasks.find(t => t.id === id);
                if (task && !task.done) {
                    if (!app.accountManager.user) return app.interaction.showToast('请先登录');

                    task.done = true;

                    // 模拟增加积分 (实际应调用后端接口)
                    // 这里直接修改本地内存中的 user 对象并保存，下一次同步会覆盖
                    // 理想做法是 apiFetch('circle_api.php', 'complete_task', {task_id: id})

                    app.accountManager.user.coins = (parseInt(app.accountManager.user.coins) || 0) + task.reward;
                    app.accountManager.saveLocal();

                    app.interaction.showToast(`领取成功 +${task.reward}币`);
                    this.renderTasks();
                    app.circleManager.updateHeader();
                }
            }

            buyQuota(type) {
                const cost = type === 'download' ? 10 : 20;
                const user = app.accountManager.user;

                if (!user) return app.interaction.showToast('请登录');
                if (user.coins < cost) return app.interaction.showToast('余额不足');

                if (confirm(`确定消耗 ${cost} 硬币兑换吗？`)) {
                    user.coins -= cost;
                    app.accountManager.saveLocal();

                    if (type === 'download') {
                        app.quotaManager.add(5);
                    } else {
                        app.interaction.showToast('功能开发中');
                    }
                    this.renderTasks();
                    app.circleManager.updateHeader();
                }
            }
        }



