document.getElementById('download').addEventListener('click', async () => {
    const statusEl = document.getElementById('status');
    statusEl.textContent = '获取高清封面中...';
    statusEl.style.color = '#00a1d6';

    try {
        // 获取当前标签页（修复变量定义）
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url?.includes('bilibili.com')) {
            throw new Error('请在B站视频页面使用');
        }

        // 注入脚本获取封面URL
        const result = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                // 方法1：从B站内部数据获取（最高清）
                if (window.__INITIAL_STATE__?.videoData?.pic) {
                    return window.__INITIAL_STATE__.videoData.pic
                        .replace(/@.*?(\.jpg|\.png)/, '$1');
                }

                // 方法2：从播放器背景图获取
                const player = document.querySelector('.bpx-player-video-wrap');
                if (player) {
                    const bgUrl = getComputedStyle(player).backgroundImage
                        .replace(/^url\(["']?(.*?)["']?\)$/, '$1');
                    if (bgUrl.includes('hdslb.com')) {
                        return bgUrl.split('@')[0]; // 移除压缩参数
                    }
                }

                // 方法3：从meta标签获取（保底）
                const meta = document.querySelector('meta[property="og:image"]');
                if (meta?.content) {
                    return meta.content.split('@')[0];
                }

                return null;
            }
        });

        let coverUrl = result[0]?.result;
        if (!coverUrl) throw new Error('未找到封面');

        // 统一处理URL格式
        coverUrl = coverUrl
            .replace(/(@\d+w_\d+h_?\w*?)(\.jpg|\.png)/, '$2') // 清除压缩参数
            .replace('//i0.hdslb.com/bfs/face/', '//i0.hdslb.com/bfs/archive/');

        // 确保是完整URL
        if (!coverUrl.startsWith('http')) {
            coverUrl = (coverUrl.startsWith('//') ? 'https:' : 'https://') + coverUrl;
        }

        // 下载文件（添加超时处理）
        await new Promise((resolve, reject) => {
            chrome.downloads.download({
                url: `${coverUrl}?t=${Date.now()}`, // 避免缓存
                filename: `bilibili_hd_${Date.now()}.jpg`,
                conflictAction: 'uniquify'
            }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve();
                }
            });
        });

        statusEl.textContent = '高清封面下载成功！';
        statusEl.style.color = '#34C759';

    } catch (error) {
        statusEl.textContent = `失败: ${error.message.replace('Error: ', '')}`;
        statusEl.style.color = '#FF3B30';
        console.error('完整错误:', error);
    }
});