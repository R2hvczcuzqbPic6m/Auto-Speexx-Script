// ==UserScript==
// @name         AutoSpeexx
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  自动完成 Speexx 平台视频播放、练习答题、发音练习跳过、跨页自动续跑，可设定参数模拟人工做题时长。
// @author       0x9c5 <https://0x9c5.top>
// @match        https://portal.speexx.cn/articles/*
// @grant        GM_addStyle
// @run-at       document-start
// @license      GPL-3.0-only
// ==/UserScript==

(function() {
	'use strict';

	// -------------------------- 1. 核心配置 --------------------------
	const MIN_CONFIG = {
		MIN_TOTAL_TIME: 30000, // 单题最短时间最小值（30秒）
		MIN_RANDOM_DELAY: 1000 // 随机延迟最小值（1000ms）
	};

	const DEFAULT_CONFIG = {
        // 基本配置
		MIN_TOTAL_TIME: 30000, // 单题最短完成时间（默认30秒）
        PRON_WAIT: false,  // 是否在发音页面增加额外停留时间
		// 高级配置
		SOLVE_DELAY: 10000, // 显示答案后延迟
		SUBMIT_DELAY: 10000, // 提交后延迟
		NEXT_LOAD_DELAY: 3000, // Next加载延迟
		SCORE_CHECK_DELAY: 2000, // 成绩检测延迟
        MAX_RANDOM_DELAY: 5000, // 随机延迟最大值（默认5秒）
	};
	let CONFIG = {
		...DEFAULT_CONFIG
	};

	// -------------------------- 2. 前端样式 --------------------------
	GM_addStyle(`
        /* 主面板 */
        .autospeexx-panel {
            max-height: 650px; /* 或者 70vh ? */
            display: flex;
            flex-direction: column;
            overflow: hidden;
            position: fixed;
            top: 20px;
            right: 20px;
            width: 400px;
            background: #fff !important;
            border: 1px solid #ccc;
            border-radius: 8px;
            padding: 12px;
            box-shadow: 0 2px 15px rgba(0,0,0,0.2);
            z-index: 999999;
            font-family: Arial, sans-serif;
            font-size: 14px;
            color: #000 !important;
        }
        .autospeexx-panel, .autospeexx-panel * {
            box-sizing: border-box; 
        }

        /* 表头&拖动 */
        .autospeexx-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: bold;
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 1px solid #eee;
            cursor: move;
            user-select: none;
        }
        .autospeexx-title { font-size: 16px; }
        .autospeexx-min-btn {
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            color: #666 !important;
            padding: 0 5px;
        }

        /* 分页 */
        .autospeexx-tabs {
            display: flex;
            margin-bottom: 10px;
            border-bottom: 1px solid #eee;
            padding-bottom: 8px;
        }
        .autospeexx-tab {
            padding: 6px 12px;
            cursor: pointer;
            border-radius: 4px;
            margin-right: 8px;
            color: #000 !important;
        }
        .autospeexx-tab.active {
            background: #ff7700 !important;
            color: #fff !important;
        }
        .autospeexx-tab:not(.active):hover {
            background: #f5f5f5 !important;
        }
        .autospeexx-tab-content {
            display: none;
            color: #000 !important;
        }
        .autospeexx-tab-content.active {
            display: block;
        }

        /* 悬浮球（左下角） */
        .autospeexx-float-ball {
            position: fixed;
            bottom: 20px;
            left: 20px;
            width: 60px;
            height: 60px;
            background: #ff7700 !important;
            border-radius: 50%;
            color: #fff !important;
            display: none;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            z-index: 999999;
        }
        .autospeexx-float-ball::before {
            content: "🚀";
            font-size: 30px;
        }

        /* 按钮 */
        .autospeexx-btn {
            padding: 6px 12px;
            margin: 5px 0;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            width: 100%;
        }
        .autospeexx-btn-start { background: #28a745 !important; color: #fff !important; }
        .autospeexx-btn-start:disabled { background: #6c757d !important; }
        .autospeexx-btn-stop { background: #dc3545 !important; color: #fff !important; }
        .autospeexx-btn-stop:disabled { background: #6c757d !important; }
        .autospeexx-btn-save { background: #007bff !important; color: #fff !important; margin-right: 5px; }
        .autospeexx-btn-reset { background: #6c757d !important; color: #fff !important; }

        /* 参数配置 */
        .autospeexx-setting-item {
            margin: 10px 0;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .autospeexx-setting-label {
            font-size: 13px;
            color: #333 !important;
            width: 180px;
        }
        .autospeexx-setting-input {
            width: 100px;
            padding: 4px 8px;
            border: 1px solid #ccc;
            border-radius: 4px;
            font-size: 13px;
        }
        
        /* 中间滚动容器 */
        .autospeexx-scroll-container {
            flex-grow: 1;
            overflow-y: scroll;
            padding: 6px;
            border-bottom: 1px solid #eee;
        }

        /*  优化滚动条样式 */
        .autospeexx-scroll-container::-webkit-scrollbar {
            width: 6px;
        }
        .autospeexx-scroll-container::-webkit-scrollbar-thumb {
            background: #ddd;
            border-radius: 10px;
        }
        .autospeexx-scroll-container::-webkit-scrollbar-thumb:hover {
            background: #ccc;
        }
        
        /* advanced-settings 标题样式 */
        /* 隐藏所有页面可能自带的默认箭头 */
        .autospeexx-advanced-settings summary {
            list-style: none !important;
            outline: none !important;
            cursor: pointer;
            position: relative;
            padding-left: 20px !important; /* 为自定义箭头留位 */
            user-select: none;
            color: #666;
            font-size: 13px;
            margin: 10px 0;
        }

        .autospeexx-advanced-settings summary::-webkit-details-marker {
            display: none !important; /* Chrome/Safari */
        }

        /* 伪元素绘制箭头 */
        .autospeexx-advanced-settings summary::before {
            content: '▶';
            position: absolute;
            left: 0;
            top: 50%;
            transform: translateY(-50%);
            font-size: 10px;
            color: #dc3545;
            transition: transform 0.2s ease;
        }

        /* 展开时，让箭头旋转 90 度变成向下 */
        .autospeexx-advanced-settings[open] summary::before {
            transform: translateY(-50%) rotate(90deg);
        }

        /* 状态 & 日志 */
        .autospeexx-page-type { font-size: 12px; color: #007bff !important; margin: 5px 0; }
        .autospeexx-tip { font-size: 12px; color:rgb(128, 128, 128) !important; margin: 5px 0; }
        .autospeexx-log {
            flex-shrink: 0;
            height: 160px;  /* 100px → 160px */
            border: 1px solid #eee;
            padding: 8px;
            margin-top: 10px;
            font-size: 12px;
            overflow-y: auto;
            background: #f0f0f0 !important;
            white-space: pre-wrap; 
        }

        /* 最小化 */
        .autospeexx-panel.minimized { display: none !important; }
    `);

	// -------------------------- 3. 全局变量 --------------------------
	let isRunning = false;
	let isMinimized = false;
	let currentTaskTimer = null;
	let currentPageType = 'unknown';
	let logList = [];
	const STORAGE_KEY = 'AutoSpeexxRunning';
	const CONFIG_STORAGE_KEY = 'AutoSpeexxConfig';

	// -------------------------- 4. 工具函数 --------------------------
	// 打印日志显示运行状态
	function addLog(msg) {
		const time = new Date().toLocaleTimeString();
		const logItem = `[${time}] ${msg}`;
		logList.unshift(logItem);
		if (logList.length > 20) logList.pop();
		const logDoms = document.querySelectorAll('.autospeexx-log');
		logDoms.forEach(dom => {
			dom.innerHTML = logList.join('<br>');
		});
		console.log(`[Speexx] ${logItem}`);
	}

	function loadConfig() {
		const savedConfig = localStorage.getItem(CONFIG_STORAGE_KEY);
		if (savedConfig) {
			try {
				const parsed = JSON.parse(savedConfig);
				// 基本配置
				CONFIG.MIN_TOTAL_TIME = Math.max(parsed.MIN_TOTAL_TIME || DEFAULT_CONFIG.MIN_TOTAL_TIME, MIN_CONFIG.MIN_TOTAL_TIME);
                if (typeof parsed.PRON_WAIT === 'boolean') {CONFIG.PRON_WAIT = parsed.PRON_WAIT;} else {CONFIG.PRON_WAIT = DEFAULT_CONFIG.PRON_WAIT;}

				// 高级配置
				CONFIG.SOLVE_DELAY = (typeof parsed.SOLVE_DELAY === 'number' && parsed.SOLVE_DELAY > 0) ? parsed.SOLVE_DELAY : DEFAULT_CONFIG.SOLVE_DELAY;
				CONFIG.SUBMIT_DELAY = (typeof parsed.SUBMIT_DELAY === 'number' && parsed.SUBMIT_DELAY > 0) ? parsed.SUBMIT_DELAY : DEFAULT_CONFIG.SUBMIT_DELAY;
				CONFIG.NEXT_LOAD_DELAY = (typeof parsed.NEXT_LOAD_DELAY === 'number' && parsed.NEXT_LOAD_DELAY > 0) ? parsed.NEXT_LOAD_DELAY : DEFAULT_CONFIG.NEXT_LOAD_DELAY;
				CONFIG.SCORE_CHECK_DELAY = (typeof parsed.SCORE_CHECK_DELAY === 'number' && parsed.SCORE_CHECK_DELAY > 0) ? parsed.SCORE_CHECK_DELAY : DEFAULT_CONFIG.SCORE_CHECK_DELAY;
                CONFIG.MAX_RANDOM_DELAY = Math.max(parsed.MAX_RANDOM_DELAY || DEFAULT_CONFIG.MAX_RANDOM_DELAY, MIN_CONFIG.MIN_RANDOM_DELAY);

				addLog('✅ 配置加载完成');
			} catch (e) {
				addLog(`❌ 配置加载失败：${e.message}`);
			}
		}
		updateConfigInputs();
	}

	function saveConfig() {
		// 基本配置
		const minTotalTime = Math.max(Number(document.getElementById('minTotalTimeInput').value) || DEFAULT_CONFIG.MIN_TOTAL_TIME, MIN_CONFIG.MIN_TOTAL_TIME);
        const pronWait = document.getElementById('pronWaitInput') ? document.getElementById('pronWaitInput').checked : DEFAULT_CONFIG.PRON_WAIT;

		// 高级配置
		const solveDelay = (Number(document.getElementById('solveDelayInput').value) > 0) ? Number(document.getElementById('solveDelayInput').value) : DEFAULT_CONFIG.SOLVE_DELAY;
		const submitDelay = (Number(document.getElementById('submitDelayInput').value) > 0) ? Number(document.getElementById('submitDelayInput').value) : DEFAULT_CONFIG.SUBMIT_DELAY;
		const nextLoadDelay = (Number(document.getElementById('nextLoadDelayInput').value) > 0) ? Number(document.getElementById('nextLoadDelayInput').value) : DEFAULT_CONFIG.NEXT_LOAD_DELAY;
		const scoreCheckDelay = (Number(document.getElementById('scoreCheckDelayInput').value) > 0) ? Number(document.getElementById('scoreCheckDelayInput').value) : DEFAULT_CONFIG.SCORE_CHECK_DELAY;
        const maxRandomDelay = Math.max(Number(document.getElementById('maxRandomDelayInput').value) || DEFAULT_CONFIG.MAX_RANDOM_DELAY, MIN_CONFIG.MIN_RANDOM_DELAY);

		// 更新配置
		CONFIG.MIN_TOTAL_TIME = minTotalTime;
        CONFIG.PRON_WAIT = pronWait;
		CONFIG.SOLVE_DELAY = solveDelay;
		CONFIG.SUBMIT_DELAY = submitDelay;
		CONFIG.NEXT_LOAD_DELAY = nextLoadDelay;
		CONFIG.SCORE_CHECK_DELAY = scoreCheckDelay;
        CONFIG.MAX_RANDOM_DELAY = maxRandomDelay;

		// 保存到本地存储
		localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify({
			MIN_TOTAL_TIME: CONFIG.MIN_TOTAL_TIME,
            PRON_WAIT: CONFIG.PRON_WAIT,
			SOLVE_DELAY: CONFIG.SOLVE_DELAY,
			SUBMIT_DELAY: CONFIG.SUBMIT_DELAY,
			NEXT_LOAD_DELAY: CONFIG.NEXT_LOAD_DELAY,
			SCORE_CHECK_DELAY: CONFIG.SCORE_CHECK_DELAY,
            MAX_RANDOM_DELAY: CONFIG.MAX_RANDOM_DELAY
		}));

		updateConfigInputs();
		addLog(`⚙️ 配置保存成功：
基本配置：单题最短${CONFIG.MIN_TOTAL_TIME/1000}秒完成，最大随机延迟${CONFIG.MAX_RANDOM_DELAY/1000}秒，发音页面更长停留 [${CONFIG.PRON_WAIT ? '开启' : '关闭'}]
高级配置：显示答案延迟${CONFIG.SOLVE_DELAY/1000}秒，提交延迟${CONFIG.SUBMIT_DELAY/1000}秒，跨页加载预留延迟${CONFIG.NEXT_LOAD_DELAY/1000}秒，成绩检测延迟${CONFIG.SCORE_CHECK_DELAY/1000}秒`);
	}

	function resetConfig() {
		// 重置为默认值（含高级配置）
		CONFIG.MIN_TOTAL_TIME = DEFAULT_CONFIG.MIN_TOTAL_TIME;
        CONFIG.PRON_WAIT = DEFAULT_CONFIG.PRON_WAIT;
		CONFIG.SOLVE_DELAY = DEFAULT_CONFIG.SOLVE_DELAY;
		CONFIG.SUBMIT_DELAY = DEFAULT_CONFIG.SUBMIT_DELAY;
		CONFIG.NEXT_LOAD_DELAY = DEFAULT_CONFIG.NEXT_LOAD_DELAY;
		CONFIG.SCORE_CHECK_DELAY = DEFAULT_CONFIG.SCORE_CHECK_DELAY;
        CONFIG.MAX_RANDOM_DELAY = DEFAULT_CONFIG.MAX_RANDOM_DELAY;

		localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify({
			MIN_TOTAL_TIME: CONFIG.MIN_TOTAL_TIME,
            PRON_WAIT: CONFIG.PRON_WAIT,
			SOLVE_DELAY: CONFIG.SOLVE_DELAY,
			SUBMIT_DELAY: CONFIG.SUBMIT_DELAY,
			NEXT_LOAD_DELAY: CONFIG.NEXT_LOAD_DELAY,
			SCORE_CHECK_DELAY: CONFIG.SCORE_CHECK_DELAY,
            MAX_RANDOM_DELAY: CONFIG.MAX_RANDOM_DELAY
		}));

		updateConfigInputs();
		addLog('⚙️ 配置重置为默认值');
	}

	function updateConfigInputs() {
		// 基本配置输入框更新
		const minTotalTimeInput = document.getElementById('minTotalTimeInput');
        const pronWaitInput = document.getElementById('pronWaitInput');

		if (minTotalTimeInput) minTotalTimeInput.value = CONFIG.MIN_TOTAL_TIME;
        pronWaitInput.checked = !!CONFIG.PRON_WAIT;

		// 高级配置输入框更新
		const solveDelayInput = document.getElementById('solveDelayInput');
		const submitDelayInput = document.getElementById('submitDelayInput');
		const nextLoadDelayInput = document.getElementById('nextLoadDelayInput');
		const scoreCheckDelayInput = document.getElementById('scoreCheckDelayInput');
        const maxRandomDelayInput = document.getElementById('maxRandomDelayInput');

		if (solveDelayInput) solveDelayInput.value = CONFIG.SOLVE_DELAY;
		if (submitDelayInput) submitDelayInput.value = CONFIG.SUBMIT_DELAY;
		if (nextLoadDelayInput) nextLoadDelayInput.value = CONFIG.NEXT_LOAD_DELAY;
		if (scoreCheckDelayInput) scoreCheckDelayInput.value = CONFIG.SCORE_CHECK_DELAY;
        if (maxRandomDelayInput) maxRandomDelayInput.value = CONFIG.MAX_RANDOM_DELAY;
	}

	// 生成随机延迟（1000ms ~ 最大值）
	function getRandomDelay() {
		return Math.floor(Math.random() * (CONFIG.MAX_RANDOM_DELAY - MIN_CONFIG.MIN_RANDOM_DELAY)) + MIN_CONFIG.MIN_RANDOM_DELAY;
	}

	// 检测结算界面（.graphic-stats）
	function isResultPage() {
		return !!document.querySelector('.graphic-stats');
	}

	// 动态检测页面类型（/magazine 和 /vocabulary-trainer 统一归为 unknown）
	function detectPageType() {
		const url = window.location.href;
		let type = 'unknown';

		// 页面类型判断
		if (document.querySelector('.graphic-stats')) {
			type = 'result';
		} else if (document.querySelector('.microphone-pulse') || url.includes('/pronunciation')) {
			type = 'pronunciation';
		} else if (document.querySelector('.vjs-big-play-button') || url.includes('/video')) {
			type = 'video';
		} else if (window.location.href.includes('/exercise') || document.querySelector('.exercise-content')) {
			type = 'exercise';
		} else if (document.querySelector('[data-testid="daily-practice-container"]') || document.querySelector('[aria-label="主页"]')) {
			type = 'home';
		} else if (url.includes('/magazine') || url.includes('/vocabulary')) {
			type = 'unknown';
		}

		// 更新页面类型和日志（保留）
		if (type !== currentPageType) {
			addLog(`🔄 页面类型：${currentPageType} → ${type}`);
			currentPageType = type;
			const pageTypeDoms = document.querySelectorAll('.autospeexx-page-type');
			pageTypeDoms.forEach(dom => {
				dom.textContent = `当前页面：${type}`;
			});
		}
		return type;
	}

	// 检测题目加载 / 下一题 / 成绩显示
	function isExerciseLoaded() {
		return !!document.querySelector('.exercise-content') || !!document.querySelector('.question');
	}

	// 是否存在 Next 按钮
	function hasNextQuestion() {
		const nextBtn = document.querySelector('.next');
		return nextBtn && !nextBtn.disabled;
	}

	// 检测显示成绩的 <span> 元素是否存在（无分数校验）
	function isScoreDisplayed() {
		return !!document.querySelector('span[class*="result"]') || !!document.querySelector('span[class*="result-badge-container"]') || !!document.querySelector('.next:not(:disabled)');
	}

	// 初始化练习组件
	function initExerciseComponent() {
		try {
			if (!window.entryp) {
				window.entryp = {
					trigger: function(action) {
						// 视频页跳过提交触发，避免报错
						if (currentPageType === 'video' && action === 'correct') {
							addLog('⚠️ 视频页跳过correction触发（避免JS报错）');
							return;
						}
						const btn = document.querySelector(`.btn-${action}`) || document.querySelector(`[data-action="${action}"]`);
						if (btn) btn.click();
					}
				};
			}

			// --- BEGIN: Backbone Interception Logic ---
            // Part of this section is derived from speexx-auto by BeautyyuYanli
            // Licensed under GPL-3.0. Source: https://github.com/NAOSI-DLUT/speexx-auto
            // ---
			CourseWare.CourseExercises.CourseExercisesControlsView = Backbone.Speexx.HandlebarsView.extend({
				templateName: "cw-language-course-controls",
				className: "exercise-controls",
				initialize: function(e) {
					var t = this.exerciseView = e.exerciseView,
						n = t.model;
					this.firstTime = !0;
					this.solutionShown = !1;
					this.modified = !1;
					this.dialogEnded = !1;

					this.listenTo(t, "modified", () => {
						this.modified || (this.modified = !0, this.render());
					});
					this.listenToOnce(t, "dialog:ended", () => {
						this.dialogEnded = !0, this.render();
					});
					this.listenTo(t, "static:added static:removed", () => {
						this.render();
					});
					this.listenTo(n, "sync", (e, t, n) => {
						var r = !!this.silent;
						this.silent = !!n.silent;
						(!this.silent || !r) && this.render();
					});
					this.listenTo(CourseWare.Language, "change:textpool", () => {
						this.render();
					});
					this.on("render:after", () => {
						this.$(".btn.btn-link[title]").tooltip();
					});

					window.entryp = this;
				},
				templateModel: function() {
					var e = this.exerciseView,
						t = e.model,
						n = this.silent ? null : t.get("result");
					var r = t.get("type").pronunciation,
						i = !e.static && t.get("type").hasResult && !r;
					var s = e.static || !t.get("type").hasResult,
						o = !this.solutionShown && i && !this.firstTime && n !== 100;
					return {
						firstTime: this.firstTime,
						hasCorrect: i,
						hasSolution: o,
						hideResult: s,
						dialogEnded: this.dialogEnded,
						modified: this.modified,
						solutionShown: this.solutionShown,
						result: n
					};
				},
				events: {
					"click .btn.correct": function() {
						CourseWare.Audio.stop();
						this.trigger("correct");
					},
					"click .btn.next": function() {
						this.trigger("next");
					},
					"click .btn.solution": function() {
						this.render();
						this.trigger("solve");
					}
				}
			});
            // --- END: Backbone Interception Logic ---

			addLog('✅ 练习组件初始化完成');
		} catch (e) {
			addLog(`⚠️ 组件初始化异常：${e.message}`);
		}
	}

	// -------------------------- 5. 核心处理逻辑 --------------------------
	function processCurrentPage() {
		if (!isRunning) return;

		const pageType = detectPageType();

		// 页面类型分别处理（新增 pronunciation）
		switch (pageType) {
			case 'result':
				// 结算页面：随机延迟后点击 Next
				processResultPage();
				break;
			case 'pronunciation':
				// 发音页面：一路 Next（每次 Next 前随机延迟）
				processPronunciationPage();
				break;
			case 'video':
				// 视频页面：播放视频逻辑
				processVideoPage();
				break;
			case 'exercise':
				// 练习页面：自动做题逻辑
				processExercisePage();
				break;
				// home/unknown 页面停止自动任务
			case 'home':
			case 'unknown':
				addLog('❌ 当前是主页/其他页面，停止自动任务');
				stopTask();
				break;
		}
	}

	function processResultPage() {
		addLog('✅ 检测到结算界面，随机延迟后触发Next');
		// 生成随机延迟
		const randomDelay = getRandomDelay();
		addLog(`⌛ 结算页随机延迟${randomDelay/1000}秒`);

		setTimeout(() => {
			if (!isRunning) return;

			// 点击 Next 按钮
			const nextBtn = document.querySelector('.next');
			if (nextBtn && !nextBtn.disabled) {
				nextBtn.click();
				addLog('✅ 结算页触发Next，进入下一页');

				// 防止第一题空题 
				// 清除所有残留定时器，防止提前执行逻辑
				if (currentTaskTimer) {
					clearTimeout(currentTaskTimer);
					currentTaskTimer = null;
				}
				// 强制等待页面加载（延长等待逻辑）
				addLog(`⌛ 强制等待${CONFIG.NEXT_LOAD_DELAY/1000}秒，等待新页面完全加载`);
				currentTaskTimer = setTimeout(() => {
					if (isRunning) {
						processCurrentPage(); // 等待结束后再检测页面
					}
				}, CONFIG.NEXT_LOAD_DELAY);
			} else {
				addLog('⚠️ 结算页未找到可用的Next按钮，任务完成');
				stopTask();
			}
		}, randomDelay);
	}

	// 处理发音页面（仅需一路 Next，每次触发前随机延迟）
	function processPronunciationPage() {
		addLog('✅ 检测到发音练习页面，启用自动跳过逻辑');

		// 将原来的 stopTask() 改为延迟重试
		if (!hasNextQuestion()) {
			addLog('⌛ 发音页面Next按钮未就绪，2秒后重试...');
			currentTaskTimer = setTimeout(processPronunciationPage, 2000);
			return;
		}

		// 生成随机延迟
		const randomDelay = getRandomDelay();
		addLog(`⌛ 延迟${randomDelay * (3 ** CONFIG.PRON_WAIT)/1000}秒后点击Next`);

		setTimeout(() => {
			if (!isRunning) return;
			const nextBtn = document.querySelector('.next');
			if (nextBtn && !nextBtn.disabled) {
				nextBtn.click();
				addLog('✅ 触发Next，进入下一页');
				setTimeout(processCurrentPage, CONFIG.NEXT_LOAD_DELAY);
			} else {
				addLog('⚠️ 发音页面Next按钮不可用，任务停止');
				stopTask();
			}
		}, randomDelay * (3 ** CONFIG.PRON_WAIT));
	}

	// 处理视频页面
	function processVideoPage() {
		addLog('✅ 检测到视频页面，启用视频播放逻辑');

		// 播放视频
		const playBtn = document.querySelector('.vjs-big-play-button') || document.querySelector('.video-play-btn');
		if (playBtn) {
			playBtn.click();
			addLog('▶️ 播放视频');
		} else {
			addLog('⚠️ 未找到播放按钮，假设视频已播放');
		}

		// 检测视频播放完成
		const checkVideoComplete = () => {
			if (!isRunning) return;

			// 检测视频完成状态
			let isComplete = false;
			const videoElement = document.querySelector('video');
			const timeDisplay = document.querySelector('.vjs-remaining-time-display');

			// 1：检测剩余时间
			if (timeDisplay && timeDisplay.textContent.trim() === '0:00') {
				isComplete = true;
			}
			// 2：检测 .ended
			else if (videoElement && videoElement.ended) {
				isComplete = true;
			}
			// 3：检测视频完成标识
			else if (document.querySelector('.video-complete') || document.querySelector('.lesson-complete')) {
				isComplete = true;
			}

			if (isComplete) {
				addLog('✅ 视频播放完成');
				// 随机延迟后点击 Next
				const randomDelay = getRandomDelay();
				addLog(`✅ 视频完成后随机延迟${randomDelay/1000}秒`);

				setTimeout(() => {
					if (!isRunning) return;

					const nextBtn = document.querySelector('.next');
					if (nextBtn && !nextBtn.disabled) {
						nextBtn.click();
						addLog('✅ 视频页点击Next，进入下一页');
						setTimeout(processCurrentPage, CONFIG.NEXT_LOAD_DELAY);
					} else {
						addLog('⚠️ 视频页未找到可用的Next按钮，任务结束');
						stopTask();
					}
				}, randomDelay);
			} else {
				// 1 秒后再次检测
				currentTaskTimer = setTimeout(checkVideoComplete, 1000);
			}
		};

		// 启动视频完成检测
		checkVideoComplete();
	}

	// 处理练习页面（自动做题逻辑）
	function processExercisePage() {
		// 再次检测结算界面
		if (isResultPage()) {
			processResultPage();
			return;
		}

		// --- 新增：针对存在 Start 按钮的特殊题型的处理 ---
		const startBtn = document.querySelector('.btn-primary.start-exercise');
		if (startBtn) {
			addLog('🔎 检测到前置 Start 按钮，尝试激活练习...');
			startBtn.click();
			// 点击后等待 1.5 秒让题目加载，然后重新进入当前页逻辑
			currentTaskTimer = setTimeout(processCurrentPage, 1500);
			return;
		}
		// -----------------------------------------------

		// 等待题目加载 + 强制初始化
		if (!isExerciseLoaded()) {
			addLog('⚠️ 题目未加载，3秒后重试');
			initExerciseComponent();
			currentTaskTimer = setTimeout(processExercisePage, 3000);
			return;
		}

		// 记录开始时间
		const startTime = Date.now();
		addLog(`✅ 开始处理题目（最短${CONFIG.MIN_TOTAL_TIME/1000}秒）`);

		// 1. 显示答案
		if (window.entryp) {
			window.entryp.trigger("solve");
			addLog(`✅ 显示答案，等待${CONFIG.SOLVE_DELAY/1000}秒`);
		}

		// 2. 延迟提交
		setTimeout(() => {
			if (!isRunning) return;

			if (window.entryp) {
				window.entryp.trigger("correct");
				addLog(`✅ 提交答案，等待${CONFIG.SUBMIT_DELAY/1000}秒`);
			}

			// 3. 成绩检测 + 计算总耗时
			setTimeout(() => {
				if (!isRunning) return;

				addLog('✅ 检测成绩显示');
				if (!isScoreDisplayed()) {
					addLog(`⚠️ 未检测到成绩显示，等待${CONFIG.SCORE_CHECK_DELAY/1000}秒`);
					setTimeout(proceedToNext, CONFIG.SCORE_CHECK_DELAY);
				} else {
					proceedToNext();
				}

				function proceedToNext() {
					// 计算已耗时
					const elapsedTime = Date.now() - startTime;
					// 补充延迟仅补到最短时间
					const needWaitTime = Math.max(0, CONFIG.MIN_TOTAL_TIME - elapsedTime);

					if (needWaitTime > 0) {
						addLog(`⌛ 补充延迟${needWaitTime/1000}秒（补至单题最短时间）`);
						setTimeout(() => {
							addRandomDelayThenNext();
						}, needWaitTime);
					} else {
						addRandomDelayThenNext();
					}
				}

				// 独立的随机延迟步骤
				function addRandomDelayThenNext() {
					const randomDelay = getRandomDelay();
					addLog(`⌛ 随机延迟${randomDelay/1000}秒（独立）`);
					setTimeout(() => {
						clickNext();
					}, randomDelay);
				}

				function clickNext() {
					if (!isRunning) return;

					// 再次检测结算界面
					if (isResultPage()) {
						processResultPage();
						return;
					}

					if (hasNextQuestion()) {
						const nextBtn = document.querySelector('.next');
						nextBtn.click();
						addLog('✅ 练习页点击Next，进入下一题');
						setTimeout(processCurrentPage, CONFIG.NEXT_LOAD_DELAY);
					} else {
						addLog('✅ 练习页无下一题，任务完成');
						stopTask();
					}
				}

			}, CONFIG.SUBMIT_DELAY);

		}, CONFIG.SOLVE_DELAY);
	}

	// -------------------------- 6. 启动/停止任务 --------------------------
	function startTask() {
		if (isRunning) return;

		// 启动前强制检测 + 初始化
		detectPageType();
		initExerciseComponent();

		// 仅在视频 / 练习 / 结算 / 发音页面启动
		if (['video', 'exercise', 'result', 'pronunciation'].indexOf(currentPageType) === -1) {
			addLog('❌ 当前是主页/其他页面，无法启动');
			return;
		}

		// 启动任务
		isRunning = true;
		localStorage.setItem(STORAGE_KEY, 'true');
		document.getElementById('startBtn').disabled = true;
		document.getElementById('stopBtn').disabled = false;
		addLog('===== 自动任务启动 =====');

		// 立即执行一次
		processCurrentPage();
	}

	function stopTask() {
		if (currentTaskTimer) clearTimeout(currentTaskTimer);
		currentTaskTimer = null;

		isRunning = false;
		localStorage.removeItem(STORAGE_KEY);
		document.getElementById('startBtn').disabled = false;
		document.getElementById('stopBtn').disabled = true;
		addLog('===== 自动任务停止 =====');
	}


	// -------------------------- 7. 面板初始化 --------------------------
	// 面板拖动限制
	function makeDraggable(dragTarget, dragHandle) {
		let isDragging = false;
		let offsetX, offsetY;

		dragHandle.addEventListener('mousedown', startDrag);
		document.addEventListener('mousemove', drag);
		document.addEventListener('mouseup', stopDrag);

		function startDrag(e) {
			e.preventDefault();
			isDragging = true;
			const rect = dragTarget.getBoundingClientRect();
			offsetX = e.clientX - rect.left;
			offsetY = e.clientY - rect.top;
			dragTarget.style.zIndex = 999999;
		}

		function drag(e) {
			if (!isDragging) return;
			e.preventDefault();

			let newX = e.clientX - offsetX;
			let newY = e.clientY - offsetY;

			// 边界限制
			const windowWidth = window.innerWidth;
			const windowHeight = window.innerHeight;
			const panelWidth = dragTarget.offsetWidth;
			const panelHeight = dragTarget.offsetHeight;

			newX = Math.max(0, Math.min(newX, windowWidth - panelWidth));
			newY = Math.max(0, Math.min(newY, windowHeight - panelHeight));

			dragTarget.style.left = `${newX}px`;
			dragTarget.style.top = `${newY}px`;
			dragTarget.style.right = 'auto';
			dragTarget.style.bottom = 'auto';
		}

		function stopDrag() {
			isDragging = false;
		}

		// 防止内存泄漏
		dragTarget.addEventListener('remove', () => {
			dragHandle.removeEventListener('mousedown', startDrag);
			document.removeEventListener('mousemove', drag);
			document.removeEventListener('mouseup', stopDrag);
		});
	}

	// 面板初始化
	function initPanel() {
		// 创建面板
		const panel = document.createElement('div');
		panel.className = 'autospeexx-panel';
		panel.innerHTML = `
            <div class="autospeexx-header">
                <div class="autospeexx-title">Auto<span style="color:#ff7700;">Speexx</span></div>
                <button class="autospeexx-min-btn">—</button>
            </div>

            <!-- 分页 -->
            <div class="autospeexx-tabs">
                <div class="autospeexx-tab active" data-tab="main">核心功能</div>
                <div class="autospeexx-tab" data-tab="settings">参数配置</div>
            </div>

            <div class="autospeexx-scroll-container">
                <!-- 核心功能页 -->
                <div class="autospeexx-tab-content active" id="mainTab">
                    <button class="autospeexx-btn autospeexx-btn-start" id="startBtn">启动自动任务</button>
                    <button class="autospeexx-btn autospeexx-btn-stop" id="stopBtn" disabled>停止自动任务</button>
                    <div class="autospeexx-page-type">当前页面：unknown</div>
                    <div class="autospeexx-tip">💡 支持视频自动播放 / 练习自动完成 / 发音自动跳过</div>
                    <div class="autospeexx-tip">💡 出现问题请尝试手动返回后重新启动任务，或者刷新页面</div>
                </div>

                <!-- 参数配置页（新增基本 / 高级配置分割） -->
                <div class="autospeexx-tab-content" id="settingsTab">
                    <!-- 基本配置 -->
                    <div style="font-weight:bold; margin:10px 0; color:#ff7700 !important;">⚙️ 基本配置</div>
                    <div class="autospeexx-setting-item">
                        <label class="autospeexx-setting-label">单题最短完成时间（ms）：</label>
                        <input type="number" class="autospeexx-setting-input" id="minTotalTimeInput">
                    </div>
                    <div class="autospeexx-tip">💡 至少设为 30 秒以避免学习时长异常</div>
                    <div class="autospeexx-setting-item">
                        <label class="autospeexx-setting-label">在发音练习页面停留更久：</label>
                        <input type="checkbox" id="pronWaitInput" style="transform: scale(1.2);">
                    </div>
                    <div class="autospeexx-tip">💡 发音练习停留三倍时长（可避免出现 0 分钟学习时间）</div>

                    <!-- 高级配置分割线 -->
                    <hr style="border:0; border-top:2px dashed #eee; margin:15px 0;">
                    <details class="autospeexx-advanced-settings">
                        <summary style="font-weight:bold; margin:10px 0; color:#dc3545 !important;">
                            🔩 高级配置
                        </summary>
                        <div class="autospeexx-tip" style="color: red !important;">⚠️ 若非了解以下参数含义及改动影响，建议保持默认值</div>
                        <!-- 高级配置项 -->
                        <div class="autospeexx-setting-item">
                            <label class="autospeexx-setting-label">显示答案延迟（ms）：</label>
                            <input type="number" class="autospeexx-setting-input" id="solveDelayInput">
                        </div>
                        <div class="autospeexx-tip">💡 触发 Solution 后等待的时间</div>
                        <div class="autospeexx-setting-item">
                            <label class="autospeexx-setting-label">提交延迟（ms）：</label>
                            <input type="number" class="autospeexx-setting-input" id="submitDelayInput">
                        </div>
                        <div class="autospeexx-tip">💡 调用 this.trigger("solve") 后延迟（模拟填入答案的耗时）</div>
                        <div class="autospeexx-setting-item">
                            <label class="autospeexx-setting-label">跨页加载预留延迟（ms）：</label>
                            <input type="number" class="autospeexx-setting-input" id="nextLoadDelayInput">
                        </div>
                        <div class="autospeexx-tip">💡 触发 Next 后预留的加载时间</div>
                        <div class="autospeexx-setting-item">
                            <label class="autospeexx-setting-label">成绩检测延迟（ms）：</label>
                            <input type="number" class="autospeexx-setting-input" id="scoreCheckDelayInput">
                        </div>
                        <div class="autospeexx-tip">💡 查询到 [class*="result-badge-container"] 后的延迟</div>
                        <div class="autospeexx-setting-item">
                            <label class="autospeexx-setting-label">最大随机延迟（ms）：</label>
                            <input type="number" class="autospeexx-setting-input" id="maxRandomDelayInput">
                        </div>
                        <div class="autospeexx-tip">💡 随机延迟范围：1000ms ~ 最大值（模拟人工操作的随机性）</div>
                    </details>
                    <!-- 按钮区域 -->
                    <div style="margin-top:15px;">
                        <button class="autospeexx-btn autospeexx-btn-save" id="saveConfigBtn" style="width: auto;">保存配置</button>
                        <button class="autospeexx-btn autospeexx-btn-reset" id="resetConfigBtn" style="width: auto;">重置为默认</button>
                    </div>
                </div>
            </div>

            <div class="autospeexx-log">=== 日志显示 ===</div>
        `;

		document.body.appendChild(panel); // 似乎导致 Console 报错但不影响运行

		// 悬浮球（左下角）
		const floatBall = document.createElement('div');
		floatBall.className = 'autospeexx-float-ball';
		document.body.appendChild(floatBall);

		// 最小化 / 恢复
		panel.querySelector('.autospeexx-min-btn').addEventListener('click', () => {
			isMinimized = true;
			panel.classList.add('minimized');
			floatBall.style.display = 'flex';
			addLog('🔽 面板已最小化至左下角');
		});
		floatBall.addEventListener('click', () => {
			isMinimized = false;
			panel.classList.remove('minimized');
			floatBall.style.display = 'none';
			addLog('🔼 面板已恢复');
		});

		// 分页切换
		const tabs = panel.querySelectorAll('.autospeexx-tab');
		const tabContents = panel.querySelectorAll('.autospeexx-tab-content');
		tabs.forEach(tab => {
			tab.addEventListener('click', () => {
				tabs.forEach(t => t.classList.remove('active'));
				tabContents.forEach(c => c.classList.remove('active'));
				tab.classList.add('active');
				const targetTab = document.getElementById(`${tab.dataset.tab}Tab`);
				if (targetTab) targetTab.classList.add('active');
			});
		});

		// 绑定事件
		document.getElementById('startBtn').addEventListener('click', startTask);
		document.getElementById('stopBtn').addEventListener('click', stopTask);
		document.getElementById('saveConfigBtn').addEventListener('click', saveConfig);
		document.getElementById('resetConfigBtn').addEventListener('click', resetConfig);

		// 限制拖动
		makeDraggable(panel, panel.querySelector('.autospeexx-header'));

		// 加载配置
		loadConfig();

		// 启动前强制检测页面类型 + 初始化组件
		detectPageType();
		initExerciseComponent();

		// 续跑恢复
		if (localStorage.getItem(STORAGE_KEY) === 'true') {
			startTask();
		}

		// 延迟检测页面类型（针对低网速 / 主页加载的情况）
		setTimeout(() => {
			detectPageType(); // 延迟后重新检测，网速正常的情况下此时主页元素已加载完成
			addLog('🔍 复检测页面类型');
		}, 1500); // 1.5 秒延迟
	}

	// -------------------------- 8. 初始化 --------------------------
	function waitForDOMReady() {
		if (document.readyState === 'complete' || document.readyState === 'interactive') {
			initPanel();
		} else {
			setTimeout(waitForDOMReady, 500);
		}
	}

	window.addEventListener('beforeunload', () => {
		if (currentTaskTimer) clearTimeout(currentTaskTimer);
		if (isRunning) localStorage.setItem(STORAGE_KEY, 'true');
	});

	waitForDOMReady();

})();