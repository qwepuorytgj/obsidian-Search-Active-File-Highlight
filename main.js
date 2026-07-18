const { Plugin } = require('obsidian');

class SearchActiveFileHighlightPlugin extends Plugin {

    async onload() {
        console.log('Search Active File Highlight 插件已加载 v2.6');

        document.body.addClass('search-active-file-highlight');

        this.registerEvent(
            this.app.workspace.on('active-leaf-change', () => {
                this.highlightActiveFileInSearch();
            })
        );

        this.registerEvent(
            this.app.workspace.on('file-open', () => {
                this.highlightActiveFileInSearch();
            })
        );

        this.registerEvent(
            this.app.workspace.on('layout-change', () => {
                this.highlightActiveFileInSearch();
            })
        );

        this.registerDomEvent(document, 'keydown', (evt) => {
            const isNavShortcut = (
                (evt.ctrlKey || evt.metaKey) && evt.key === 'Tab' ||
                (evt.altKey && (evt.key === 'ArrowLeft' || evt.key === 'ArrowRight'))
            );
            if (isNavShortcut) {
                setTimeout(() => this.highlightActiveFileInSearch(), 150);
            }
        });

        this.registerDomEvent(document, 'click', () => {
            setTimeout(() => this.highlightActiveFileInSearch(), 100);
        });

        this.setupMutationObserver();

        setTimeout(() => this.highlightActiveFileInSearch(), 500);

        this.refreshInterval = window.setInterval(() => {
            this.highlightActiveFileInSearch();
        }, 500);
    }

    setupMutationObserver() {
        const observer = new MutationObserver((mutations) => {
            let shouldHighlight = false;
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const el = node;
                            if (el.classList && (
                                el.classList.contains('tree-item') ||
                                el.classList.contains('search-result')
                            )) {
                                shouldHighlight = true;
                                break;
                            }
                        }
                    }
                }
            }
            if (shouldHighlight) {
                setTimeout(() => this.highlightActiveFileInSearch(), 100);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        this.mutationObserver = observer;
    }

    highlightActiveFileInSearch() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            this.clearPreviousHighlights();
            return;
        }

        const activePath = activeFile.path;
        const activeName = activeFile.name;
        const activeBasename = activeName.replace(/\.md$/, '');

        this.clearPreviousHighlights();

        const searchLeaves = this.app.workspace.getLeavesOfType('search');

        for (const leaf of searchLeaves) {
            const container = leaf.view.containerEl;
            if (!container) continue;

            // ===== path: 搜索的 DOM 结构 =====
            // <div class="tree-item search-result is-collapsed">
            //   <div class="tree-item-self search-result-file-title is-clickable">
            //     <div class="tree-item-inner">
            //       <span class="search-result-file-matched-text">📁inbox</span>
            //       <span>/20260326.145759.266.md</span>
            //     </div>
            //   </div>
            // </div>

            // 查找所有 tree-item（path: 搜索用 tree-item）
            const treeItems = container.querySelectorAll('.tree-item');
            for (const item of treeItems) {
                let matched = false;

                // 方法1: 检查 tree-item-inner 的所有 span 文本
                const innerEl = item.querySelector('.tree-item-inner');
                if (innerEl) {
                    const spans = innerEl.querySelectorAll('span');
                    for (const span of spans) {
                        const spanText = span.textContent.trim();
                        // span 可能包含 "/文件名.md" 格式
                        const cleanText = spanText.replace(/^\//, ''); // 去掉开头的 /
                        if (cleanText === activeName || cleanText === activeBasename ||
                            spanText === activeName || spanText === activeBasename) {
                            matched = true;
                            break;
                        }
                    }

                    // 如果上面的没匹配，检查完整的 inner text
                    if (!matched) {
                        const fullText = innerEl.textContent.trim();
                        // 完整文本可能包含文件夹名 + /文件名
                        if (fullText.includes('/' + activeName) || 
                            fullText.includes('/' + activeBasename) ||
                            fullText.endsWith(activeName) ||
                            fullText.endsWith(activeBasename)) {
                            matched = true;
                        }
                    }
                }

                // 方法2: 检查 data-path
                if (!matched) {
                    const itemPath = item.getAttribute('data-path');
                    if (itemPath) {
                        const normalizedItemPath = itemPath.replace(/\\/g, '/').trim();
                        const normalizedActivePath = activePath.replace(/\\/g, '/').trim();
                        if (normalizedItemPath === normalizedActivePath) {
                            matched = true;
                        }
                    }
                }

                // 方法3: 检查 tree-item-self 的 data-path
                if (!matched) {
                    const selfEl = item.querySelector('.tree-item-self');
                    if (selfEl) {
                        const selfPath = selfEl.getAttribute('data-path');
                        if (selfPath) {
                            const normalizedSelfPath = selfEl.getAttribute('data-path').replace(/\\/g, '/').trim();
                            const normalizedActivePath = activePath.replace(/\\/g, '/').trim();
                            if (normalizedSelfPath === normalizedActivePath) {
                                matched = true;
                            }
                        }
                    }
                }

                if (matched) {
                    item.addClass('is-active-file');
                }
            }

            // ===== 普通搜索的 DOM 结构（保持原有逻辑）=====
            const searchResults = container.querySelectorAll('.search-result');
            for (const result of searchResults) {
                // 跳过已经处理过的（tree-item 也是 search-result）
                if (result.hasClass('is-active-file')) continue;

                let matched = false;

                const titleEl = result.querySelector('.search-result-file-title');
                if (titleEl) {
                    const titleText = titleEl.textContent.trim();
                    if (titleText === activeName || titleText === activeBasename) {
                        matched = true;
                    }

                    const titlePath = titleEl.getAttribute('data-path');
                    if (!matched && titlePath) {
                        const normalizedTitlePath = titlePath.replace(/\\/g, '/').trim();
                        const normalizedActivePath = activePath.replace(/\\/g, '/').trim();
                        if (normalizedTitlePath === normalizedActivePath) {
                            matched = true;
                        }
                    }
                }

                if (!matched) {
                    const pathEl = result.querySelector('.search-result-file-path');
                    if (pathEl) {
                        const pathText = pathEl.textContent.trim();
                        const combinedPath = pathText.replace(/\\/g, '/') + '/' + activeName;
                        const normalizedCombined = combinedPath.replace(/\\/g, '/');
                        const normalizedActivePath = activePath.replace(/\\/g, '/');
                        if (normalizedCombined === normalizedActivePath) {
                            matched = true;
                        }
                    }
                }

                if (!matched) {
                    const resultPath = result.getAttribute('data-path');
                    if (resultPath) {
                        const normalizedResultPath = resultPath.replace(/\\/g, '/').trim();
                        const normalizedActivePath = activePath.replace(/\\/g, '/').trim();
                        if (normalizedResultPath === normalizedActivePath) {
                            matched = true;
                        }
                    }
                }

                if (matched) {
                    result.addClass('is-active-file');
                }
            }
        }
    }

    clearPreviousHighlights() {
        const highlighted = document.querySelectorAll('.is-active-file');
        for (const el of highlighted) {
            el.removeClass('is-active-file');
        }
    }

    onunload() {
        console.log('Search Active File Highlight 插件已卸载');
        document.body.removeClass('search-active-file-highlight');
        this.clearPreviousHighlights();
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }
}

module.exports = SearchActiveFileHighlightPlugin;
